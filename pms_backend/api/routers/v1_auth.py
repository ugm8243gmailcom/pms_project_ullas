"""
Authentication and Organization Onboarding Router for WAYMARK.
Implements:
- Workspace creation for Administrators with 6-digit OTP generation
- Asynchronous SMTP email dispatch via FastAPI BackgroundTasks
- OTP verification and workspace activation
- Unified login with Bcrypt validation and signed JWT issuance
- Current authenticated user introspection (/me)
"""

import uuid
import random
from datetime import datetime, timezone
from typing import Optional, Dict, Any
from pydantic import BaseModel, EmailStr, Field
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks, status
from core.database import get_db
from core.security import (
    hash_password,
    verify_password,
    create_access_token,
    get_current_user,
    normalize_role
)
from services.notification_service import send_email_notification

router = APIRouter(prefix="/api/v1/auth", tags=["Authentication & Onboarding"])


# ==============================================================================
# SCHEMAS
# ==============================================================================

class SignupRequest(BaseModel):
    organizationName: str = Field(..., min_length=2, max_length=100, description="Organization workspace name")
    name: str = Field(..., min_length=2, max_length=100, description="Administrator full name")
    email: EmailStr = Field(..., description="Administrator email address")
    password: str = Field(..., min_length=8, description="Strong password (min 8 chars)")


class OTPVerifyRequest(BaseModel):
    email: EmailStr = Field(..., description="Administrator email address")
    otp: str = Field(..., min_length=6, max_length=6, description="6-digit verification code")


class ResendOTPRequest(BaseModel):
    email: EmailStr = Field(..., description="Administrator email address")


class LoginRequest(BaseModel):
    email: EmailStr = Field(..., description="Registered email address")
    password: str = Field(..., min_length=1, description="Account password")


# ==============================================================================
# 1. WORKSPACE CREATION & OTP DISPATCH
# ==============================================================================

@router.post("/signup", status_code=status.HTTP_201_CREATED)
async def signup_workspace(
    payload: SignupRequest,
    background_tasks: BackgroundTasks,
    db = Depends(get_db)
):
    """
    Creates a new multi-tenant Organization Workspace and primary Administrator account.
    Dispatches a 6-digit OTP code to the administrator's email for verification.
    """
    clean_email = payload.email.strip().lower()
    clean_org_name = payload.organizationName.strip()

    existing_user = await db["users"].find_one({"email": clean_email})
    if existing_user:
        # If user is already verified, reject
        if existing_user.get("isVerified"):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="An account with this email address already exists. Please log in."
            )
        # If registered but unverified, refresh OTP and allow verification
        otp_code = f"{random.randint(100000, 999999)}"
        await db["users"].update_one(
            {"email": clean_email},
            {"$set": {
                "otp": otp_code,
                "passwordHash": hash_password(payload.password),
                "name": payload.name.strip()
            }}
        )
        email_body = (
            f"Hello {payload.name.strip()},\n\n"
            f"Thank you for creating your workspace '{clean_org_name}' on WAYMARK.\n"
            f"Your 6-digit verification code is:\n\n"
            f"    {otp_code}\n\n"
            f"Please enter this code on the verification screen to activate your organization workspace.\n\n"
            f"— The WAYMARK Security Team"
        )
        background_tasks.add_task(
            send_email_notification,
            recipient_email=clean_email,
            subject=f"WAYMARK Verification Code: {otp_code}",
            body=email_body
        )
        return {
            "message": "Verification code refreshed. Please check your email.",
            "email": clean_email,
            "status": "pending_verification"
        }

    # Generate UUIDs and OTP
    org_id = str(uuid.uuid4())
    user_id = str(uuid.uuid4())
    otp_code = f"{random.randint(100000, 999999)}"
    now = datetime.now(timezone.utc)
    slug = clean_org_name.lower().replace(" ", "-")

    # 1. Organization Record
    org_doc = {
        "id": org_id,
        "name": clean_org_name,
        "slug": slug,
        "plan": "enterprise",
        "isActive": False,  # Activated upon successful OTP verification
        "createdAt": now
    }
    await db["organizations"].insert_one(org_doc)

    # 2. Administrator Record (Workspace Owner)
    admin_doc = {
        "id": user_id,
        "organizationId": org_id,
        "email": clean_email,
        "name": payload.name.strip(),
        "role": "admin",
        "employeeId": f"EMP-{random.randint(1000, 9999)}",
        "position": "Workspace Owner / Administrator",
        "passwordHash": hash_password(payload.password),
        "otp": otp_code,
        "isVerified": False,
        "isActive": True,
        "createdAt": now
    }
    await db["users"].insert_one(admin_doc)

    # 3. Asynchronous Email Dispatch
    email_body = (
        f"Hello {payload.name.strip()},\n\n"
        f"Welcome to WAYMARK! Your organization '{clean_org_name}' has been created.\n"
        f"Your 6-digit workspace verification code is:\n\n"
        f"    {otp_code}\n\n"
        f"Enter this code on the verification screen to activate your workspace and log in.\n\n"
        f"— The WAYMARK Security Team"
    )
    background_tasks.add_task(
        send_email_notification,
        recipient_email=clean_email,
        subject=f"Verify your WAYMARK Workspace ({otp_code})",
        body=email_body
    )

    return {
        "message": "Workspace registered successfully. Check your email for the 6-digit verification code.",
        "email": clean_email,
        "organizationId": org_id,
        "status": "pending_verification"
    }


# ==============================================================================
# 2. OTP VERIFICATION & WORKSPACE ACTIVATION
# ==============================================================================

@router.post("/verify-otp", status_code=status.HTTP_200_OK)
async def verify_otp(payload: OTPVerifyRequest, db = Depends(get_db)):
    """
    Validates the 6-digit OTP code, marks the administrator account as verified,
    and activates the multi-tenant organization.
    """
    clean_email = payload.email.strip().lower()
    user = await db["users"].find_one({"email": clean_email})
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No account found associated with this email address."
        )

    if user.get("isVerified"):
        return {
            "message": "Account has already been verified. You can log in directly.",
            "isVerified": True
        }

    stored_otp = user.get("otp")
    if not stored_otp or stored_otp.strip() != payload.otp.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired verification code. Please check your email or request a new OTP."
        )

    # Verify user and activate organization
    await db["users"].update_one(
        {"id": user["id"]},
        {"$set": {"isVerified": True}, "$unset": {"otp": ""}}
    )

    org_id = user.get("organizationId")
    if org_id:
        await db["organizations"].update_one(
            {"id": org_id},
            {"$set": {"isActive": True}}
        )

    # Automatically issue token for immediate authenticated session
    org_doc = await db["organizations"].find_one({"id": org_id}) if org_id else None
    org_name = org_doc.get("name", "Enterprise Workspace") if org_doc else "Enterprise Workspace"

    token_payload = {
        "userId": user["id"],
        "organizationId": org_id or "",
        "role": normalize_role(user.get("role", "admin")),
        "email": clean_email,
        "name": user.get("name", "")
    }
    access_token = create_access_token(data=token_payload)

    return {
        "message": "Workspace and administrator account verified successfully.",
        "isVerified": True,
        "accessToken": access_token,
        "tokenType": "bearer",
        "user": {
            "id": user["id"],
            "name": user.get("name", ""),
            "email": clean_email,
            "role": normalize_role(user.get("role", "admin")),
            "organizationId": org_id,
            "organizationName": org_name,
            "employeeId": user.get("employeeId"),
            "position": user.get("position"),
            "avatarUrl": user.get("avatarUrl")
        }
    }


@router.post("/resend-otp", status_code=status.HTTP_200_OK)
async def resend_otp(
    payload: ResendOTPRequest,
    background_tasks: BackgroundTasks,
    db = Depends(get_db)
):
    """
    Regenerates a fresh 6-digit OTP code and dispatches it via email.
    """
    clean_email = payload.email.strip().lower()
    user = await db["users"].find_one({"email": clean_email})
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No account found associated with this email address."
        )

    if user.get("isVerified"):
        return {"message": "Account is already verified. Please proceed to login."}

    new_otp = f"{random.randint(100000, 999999)}"
    await db["users"].update_one(
        {"id": user["id"]},
        {"$set": {"otp": new_otp}}
    )

    email_body = (
        f"Hello {user.get('name', 'there')},\n\n"
        f"Your new WAYMARK workspace verification code is:\n\n"
        f"    {new_otp}\n\n"
        f"Please enter this code to activate your account."
    )
    background_tasks.add_task(
        send_email_notification,
        recipient_email=clean_email,
        subject=f"New WAYMARK Verification Code: {new_otp}",
        body=email_body
    )

    return {"message": "A new verification code has been dispatched to your email."}


# ==============================================================================
# 3. UNIFIED LOGIN ENDPOINT
# ==============================================================================

@router.post("/login", status_code=status.HTTP_200_OK)
async def login(payload: LoginRequest, db = Depends(get_db)):
    """
    Unified multi-tenant login endpoint.
    - Authenticates user credentials via Bcrypt
    - Validates account active & verified state
    - Resolves organization tenant metadata
    - Returns a cryptographically signed JWT access token and user metadata
    """
    clean_email = payload.email.strip().lower()
    user = await db["users"].find_one({"email": clean_email})

    if not user or not verify_password(payload.password, user.get("passwordHash", "")):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if not user.get("isVerified", False):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account not verified. Please verify your OTP to continue.",
        )

    if not user.get("isActive", True):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Your account has been deactivated. Please contact your organization administrator.",
        )

    org_id = user.get("organizationId")
    org_name = "Enterprise Workspace"
    if org_id:
        org_doc = await db["organizations"].find_one({"id": org_id})
        if org_doc:
            org_name = org_doc.get("name", org_name)

    normalized_user_role = normalize_role(user.get("role", "employee"))

    # Mint JWT access token
    token_payload = {
        "userId": user["id"],
        "organizationId": org_id or "",
        "role": normalized_user_role,
        "email": user["email"],
        "name": user.get("name", "")
    }
    access_token = create_access_token(data=token_payload)

    return {
        "accessToken": access_token,
        "tokenType": "bearer",
        "user": {
            "id": user["id"],
            "name": user.get("name", ""),
            "email": user["email"],
            "role": normalized_user_role,
            "organizationId": org_id,
            "organizationName": org_name,
            "employeeId": user.get("employeeId"),
            "position": user.get("position"),
            "avatarUrl": user.get("avatarUrl")
        }
    }


# ==============================================================================
# 4. CURRENT AUTHENTICATED USER INTROSPECTION
# ==============================================================================

@router.get("/me", status_code=status.HTTP_200_OK)
async def get_my_profile(
    current_user: Dict[str, Any] = Depends(get_current_user),
    db = Depends(get_db)
):
    """
    Returns the sanitized identity and organization context of the currently authenticated user.
    """
    org_id = current_user.get("organizationId")
    org_name = "Enterprise Workspace"
    if org_id:
        org_doc = await db["organizations"].find_one({"id": org_id})
        if org_doc:
            org_name = org_doc.get("name", org_name)

    return {
        "id": current_user["id"],
        "name": current_user.get("name", ""),
        "email": current_user["email"],
        "role": normalize_role(current_user.get("role", "employee")),
        "organizationId": org_id,
        "organizationName": org_name,
        "employeeId": current_user.get("employeeId"),
        "position": current_user.get("position"),
        "avatarUrl": current_user.get("avatarUrl"),
        "isActive": current_user.get("isActive", True),
        "isVerified": current_user.get("isVerified", True)
    }


@router.post("/logout", status_code=status.HTTP_200_OK)
async def logout(current_user: Dict[str, Any] = Depends(get_current_user)):
    """
    Logs out the user and confirms session termination for frontend state synchronization.
    """
    return {
        "message": "Successfully logged out. Please clear your client token.",
        "userId": current_user.get("id")
    }
