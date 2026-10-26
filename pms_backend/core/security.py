"""
Core Security and Cryptographic Services for WAYMARK Project Management System.
Implements:
- Bcrypt password hashing and verification
- PyJWT token generation, payload encoding, and cryptographic verification
- OAuth2 Bearer token dependency injection with MongoDB user hydration
- Role-Based Access Control (RBAC) dependency factories
- Multi-tenant organization scoping & strict Admin Invisibility filtering
"""

import os
import bcrypt
import jwt
from datetime import datetime, timedelta, timezone
from typing import List, Union, Sequence, Optional, Dict, Any
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from core.database import get_db

# Cryptographic and JWT Configuration
SECRET_KEY = os.getenv("JWT_SECRET", "waymark-enterprise-secure-jwt-secret-key-change-in-prod")
ALGORITHM = "HS256"
DEFAULT_ACCESS_TOKEN_EXPIRE_HOURS = 24

# Bearer token extractor
oauth2_scheme = HTTPBearer(auto_error=True)


# ==============================================================================
# 1. PASSWORD HASHING & VERIFICATION (BCRYPT)
# ==============================================================================

def hash_password(password: str) -> str:
    """
    Hashes a plaintext password using bcrypt with a generated salt.
    """
    if not password:
        raise ValueError("Password cannot be empty.")
    salt = bcrypt.gensalt(rounds=12)
    return bcrypt.hashpw(password.encode("utf-8"), salt).decode("utf-8")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """
    Verifies a plaintext password against a stored bcrypt hash.
    Safe against timing attacks and handles malformed hashes cleanly.
    """
    if not plain_password or not hashed_password:
        return False
    try:
        return bcrypt.checkpw(
            plain_password.encode("utf-8"),
            hashed_password.encode("utf-8")
        )
    except Exception:
        return False


# ==============================================================================
# 2. JWT TOKEN GENERATION & DECODING (PYJWT)
# ==============================================================================

def create_access_token(
    data: Dict[str, Any],
    expires_delta: Optional[timedelta] = None
) -> str:
    """
    Generates a cryptographically signed JWT access token.
    Payload incorporates subject identity, tenant organization ID, and role.
    """
    to_encode = data.copy()
    now = datetime.now(timezone.utc)
    
    if expires_delta:
        expire = now + expires_delta
    else:
        expire = now + timedelta(hours=DEFAULT_ACCESS_TOKEN_EXPIRE_HOURS)
        
    to_encode.update({
        "iat": now,
        "exp": expire
    })
    
    # Ensure userId or sub is explicitly populated
    if "userId" in to_encode and "sub" not in to_encode:
        to_encode["sub"] = str(to_encode["userId"])
        
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt


def decode_access_token(token: str) -> Dict[str, Any]:
    """
    Decodes and validates the signature, structure, and expiration of a JWT token.
    Raises HTTPException(401) on failure.
    """
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        return payload
    except jwt.ExpiredSignatureError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication token has expired. Please log in again.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    except (jwt.InvalidTokenError, jwt.PyJWTError):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication token credentials.",
            headers={"WWW-Authenticate": "Bearer"},
        )


# ==============================================================================
# 3. AUTHENTICATION DEPENDENCY (CURRENT USER HYDRATION)
# ==============================================================================

async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(oauth2_scheme),
    db = Depends(get_db)
) -> Dict[str, Any]:
    """
    Extracts Bearer token from the HTTP Authorization header, verifies signature,
    and hydrates the full active user document from MongoDB.
    """
    token = credentials.credentials
    payload = decode_access_token(token)
    
    user_id = payload.get("userId") or payload.get("sub")
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token payload is missing user identification.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    user = await db["users"].find_one({"id": str(user_id)})
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User account associated with this token no longer exists.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if not user.get("isActive", True):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User account is deactivated. Contact your workspace administrator.",
        )

    # Sanitize MongoDB ObjectId for downstream JSON safety
    user.pop("_id", None)
    return user


async def get_current_active_user(
    current_user: Dict[str, Any] = Depends(get_current_user)
) -> Dict[str, Any]:
    """
    Strict dependency ensuring user is both active and email-verified.
    """
    if not current_user.get("isVerified", False):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account email is not verified. Please complete OTP verification.",
        )
    return current_user


# Alias for compatibility
verify_token = get_current_user


# ==============================================================================
# 4. ROLE NORMALIZATION & RBAC DEPENDENCY FACTORY
# ==============================================================================

ROLE_MAPPINGS = {
    "admin": "admin",
    "administrator": "admin",
    "owner": "owner",
    "workspace_owner": "owner",
    "pm": "project_manager",
    "project manager": "project_manager",
    "project_manager": "project_manager",
    "employee": "employee",
    "staff": "employee",
    "dev": "employee",
    "developer": "employee",
    "member": "member",
    "guest": "guest"
}

def normalize_role(role: Optional[str]) -> str:
    """
    Normalizes role strings to lowercase canonical identifiers
    (e.g., 'Project Manager' -> 'project_manager', 'Admin' -> 'admin').
    """
    if not role:
        return "employee"
    cleaned = role.strip().lower().replace("-", "_")
    return ROLE_MAPPINGS.get(cleaned, cleaned)


def require_role(allowed_roles: Union[str, Sequence[str]]):
    """
    FastAPI dependency factory enforcing Role-Based Access Control (RBAC).
    
    Usage:
        @router.post("/projects", dependencies=[Depends(require_role(["admin", "project_manager"]))])
        or
        async def my_endpoint(user = Depends(require_role(["Admin", "Project Manager"]))):
            ...
    
    Owners and Admins possess super-tenant authority according to WAYMARK specs.
    """
    if isinstance(allowed_roles, str):
        allowed_roles = [allowed_roles]
    
    normalized_allowed = {normalize_role(r) for r in allowed_roles}

    async def role_checker(
        current_user: Dict[str, Any] = Depends(get_current_active_user)
    ) -> Dict[str, Any]:
        user_role = normalize_role(current_user.get("role", "employee"))
        
        # 'owner' has full administrative rights
        if user_role == "owner":
            return current_user

        if user_role not in normalized_allowed:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Access denied: This action requires one of the following roles: {list(normalized_allowed)}. Your role is '{user_role}'.",
            )
        return current_user

    return role_checker


# ==============================================================================
# 5. MULTI-TENANT ISOLATION & ADMIN INVISIBILITY HELPERS
# ==============================================================================

def enforce_tenant_isolation(resource_org_id: Optional[str], current_user: Dict[str, Any]) -> None:
    """
    Enforces multi-tenant data isolation. Ensures that the caller's organizationId
    strictly matches the resource's organizationId.
    """
    user_org_id = current_user.get("organizationId")
    if not user_org_id or str(resource_org_id) != str(user_org_id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Cross-tenant access prohibited. You cannot access resources outside your organization.",
        )


def apply_admin_invisibility(query: Dict[str, Any], current_user: Dict[str, Any]) -> Dict[str, Any]:
    """
    Enforces WAYMARK's Strict Admin Invisibility rule:
    When a non-admin (e.g. employee, guest) queries team rosters, staff directories,
    or project assignees, Administrator/Owner accounts are filtered out.
    """
    caller_role = normalize_role(current_user.get("role", "employee"))
    
    # If caller is admin or owner, they can see all users
    if caller_role in ["admin", "owner"]:
        return query

    # Non-admin callers cannot discover admin or owner users
    existing_role_filter = query.get("role")
    if existing_role_filter is None:
        query["role"] = {"$nin": ["admin", "owner"]}
    elif isinstance(existing_role_filter, str):
        if normalize_role(existing_role_filter) in ["admin", "owner"]:
            # Intentionally impossible condition so empty result is returned
            query["role"] = "__inaccessible_role__"
    elif isinstance(existing_role_filter, dict):
        # Merge $nin condition
        nin_list = existing_role_filter.get("$nin", [])
        if "admin" not in nin_list:
            nin_list.append("admin")
        if "owner" not in nin_list:
            nin_list.append("owner")
        query["role"]["$nin"] = nin_list

    return query