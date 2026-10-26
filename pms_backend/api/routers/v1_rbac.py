"""
Role-Based Access Control (RBAC) and Organization Security Router for WAYMARK.
Implements:
- Role & Permission Management with multi-tenant scoping
- Granular Role-Permission assignments
- Strict tenant-scoped staff and teammate directories with Admin Invisibility filtering
- Permission introspection for client-side capability evaluation
"""

import uuid
from datetime import datetime, timezone
from typing import List, Optional, Dict, Any
from fastapi import APIRouter, Depends, Query, HTTPException, status
from core.database import get_db
from core.security import (
    get_current_user,
    require_role,
    enforce_tenant_isolation,
    apply_admin_invisibility,
    normalize_role
)
from models.role import RoleCreate, RoleUpdate, RoleResponse
from models.permission import PermissionCreate, PermissionUpdate, PermissionResponse
from models.role_permission import RolePermissionAssign, RolePermissionMappingResponse

router = APIRouter(prefix="/api/v1/rbac", tags=["Role-Based Access Control"])


# ==============================================================================
# 1. PERMISSION INTROSPECTION & CURRENT USER CAPABILITIES
# ==============================================================================

@router.get("/my-permissions", status_code=status.HTTP_200_OK)
async def get_my_permissions(
    current_user: Dict[str, Any] = Depends(get_current_user),
    db = Depends(get_db)
):
    """
    Returns the effective permissions and access level for the currently authenticated user.
    Permits the frontend to configure dynamic UI capability gates.
    """
    user_role = normalize_role(current_user.get("role", "employee"))
    org_id = current_user.get("organizationId")

    # Owners and Admins have full access across modules
    if user_role in ["admin", "owner"]:
        return {
            "role": user_role,
            "organizationId": org_id,
            "isSuperUser": True,
            "permissions": ["*"]
        }

    # Fetch role permissions for tenant
    role_doc = await db["roles"].find_one({"role_key": user_role})
    permissions = []
    if role_doc:
        mappings = db["role_permissions"].find({"role_id": role_doc.get("role_id")})
        async for m in mappings:
            perm = await db["permissions"].find_one({"permission_id": m.get("permission_id")})
            if perm:
                permissions.append(perm.get("permission_key"))

    return {
        "role": user_role,
        "organizationId": org_id,
        "isSuperUser": False,
        "permissions": permissions
    }


# ==============================================================================
# 2. STAFF ROSTER WITH STRICT ADMIN INVISIBILITY & TENANT ISOLATION
# ==============================================================================

@router.get("/staff", status_code=status.HTTP_200_OK)
async def list_workspace_staff(
    role: Optional[str] = Query(None, description="Filter by role (e.g. employee, project_manager)"),
    current_user: Dict[str, Any] = Depends(get_current_user),
    db = Depends(get_db)
):
    """
    Fetches the staff directory strictly scoped to the caller's organization.
    Enforces WAYMARK's Strict Admin Invisibility rule:
    - If caller is Employee or PM, Administrator/Owner records are completely filtered out.
    - If caller is Admin/Owner, all staff and admins are accessible.
    """
    org_id = current_user.get("organizationId")
    if not org_id:
        return []

    # Base query: multi-tenant scoped to organization
    query: Dict[str, Any] = {
        "organizationId": org_id,
        "isActive": True
    }

    if role:
        query["role"] = normalize_role(role)

    # Apply strict Admin Invisibility filtering
    query = apply_admin_invisibility(query, current_user)

    cursor = db["users"].find(query).sort("name", 1)
    staff_list = []
    async for doc in cursor:
        doc.pop("_id", None)
        doc.pop("passwordHash", None)
        doc.pop("otp", None)
        staff_list.append(doc)

    return staff_list


# ==============================================================================
# 3. ROLES MANAGEMENT (ADMIN / OWNER ONLY)
# ==============================================================================

@router.post(
    "/roles",
    response_model=RoleResponse,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_role(["admin", "owner"]))]
)
async def create_role(
    role_in: RoleCreate,
    current_user: Dict[str, Any] = Depends(get_current_user),
    db = Depends(get_db)
):
    """
    Creates a new custom role within the caller's organization workspace.
    Restricted strictly to Workspace Administrators.
    """
    org_id = current_user.get("organizationId")
    role_doc = role_in.model_dump()
    role_doc["role_id"] = str(uuid.uuid4())
    role_doc["organization_id"] = org_id
    role_doc["created_at"] = datetime.now(timezone.utc)
    role_doc["updated_at"] = datetime.now(timezone.utc)

    # Check for uniqueness within organization
    existing = await db["roles"].find_one({
        "role_key": role_doc["role_key"],
        "$or": [{"organization_id": org_id}, {"organization_id": None}]
    })
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Role with key '{role_doc['role_key']}' already exists."
        )

    await db["roles"].insert_one(role_doc)
    role_doc.pop("_id", None)
    return role_doc


@router.get("/roles", response_model=List[RoleResponse])
async def list_roles(
    current_user: Dict[str, Any] = Depends(get_current_user),
    db = Depends(get_db)
):
    """
    Lists system roles and organization-scoped roles.
    """
    org_id = current_user.get("organizationId")
    cursor = db["roles"].find({
        "$or": [{"organization_id": org_id}, {"organization_id": None}]
    })
    roles = []
    async for doc in cursor:
        doc.pop("_id", None)
        roles.append(doc)
    return roles


@router.delete(
    "/roles/{role_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(require_role(["admin", "owner"]))]
)
async def delete_role(
    role_id: str,
    current_user: Dict[str, Any] = Depends(get_current_user),
    db = Depends(get_db)
):
    """
    Deletes a role and its associated permissions. Enforces tenant scoping.
    """
    org_id = current_user.get("organizationId")
    role = await db["roles"].find_one({"role_id": role_id})
    if not role:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Role not found.")

    if role.get("organization_id") and role.get("organization_id") != org_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Cannot delete other organization's role.")

    await db["roles"].delete_one({"role_id": role_id})
    await db["role_permissions"].delete_many({"role_id": role_id})
    return None


# ==============================================================================
# 4. PERMISSIONS & ROLE-PERMISSION ASSIGNMENTS (ADMIN / OWNER ONLY)
# ==============================================================================

@router.post(
    "/permissions",
    response_model=PermissionResponse,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_role(["admin", "owner"]))]
)
async def create_permission(perm_in: PermissionCreate, db = Depends(get_db)):
    perm_doc = perm_in.model_dump()
    perm_doc["permission_id"] = str(uuid.uuid4())
    perm_doc["created_at"] = datetime.now(timezone.utc)
    perm_doc["updated_at"] = datetime.now(timezone.utc)

    existing = await db["permissions"].find_one({"permission_key": perm_doc["permission_key"]})
    if existing:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Permission key already exists.")

    await db["permissions"].insert_one(perm_doc)
    perm_doc.pop("_id", None)
    return perm_doc


@router.get("/permissions", response_model=List[PermissionResponse])
async def list_permissions(
    current_user: Dict[str, Any] = Depends(get_current_user),
    db = Depends(get_db)
):
    cursor = db["permissions"].find({})
    perms = []
    async for doc in cursor:
        doc.pop("_id", None)
        perms.append(doc)
    return perms


@router.post(
    "/roles/{role_id}/permissions",
    response_model=RolePermissionMappingResponse,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_role(["admin", "owner"]))]
)
async def assign_permission_to_role(
    role_id: str,
    payload: RolePermissionAssign,
    db = Depends(get_db)
):
    rp_doc = payload.model_dump()
    rp_doc["mapping_id"] = str(uuid.uuid4())
    rp_doc["role_id"] = role_id
    rp_doc["created_at"] = datetime.now(timezone.utc)
    rp_doc["updated_at"] = datetime.now(timezone.utc)

    existing = await db["role_permissions"].find_one({
        "role_id": role_id,
        "permission_id": payload.permission_id
    })
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Permission already assigned to this role."
        )

    await db["role_permissions"].insert_one(rp_doc)
    rp_doc.pop("_id", None)
    return rp_doc


@router.get("/roles/{role_id}/permissions", response_model=List[RolePermissionMappingResponse])
async def get_role_permissions(role_id: str, db = Depends(get_db)):
    cursor = db["role_permissions"].find({"role_id": role_id})
    mappings = []
    async for doc in cursor:
        doc.pop("_id", None)
        mappings.append(doc)
    return mappings
