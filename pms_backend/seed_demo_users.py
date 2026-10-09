import asyncio
import uuid
from datetime import datetime, timezone
from core.database import db
from core.security import hash_password

async def seed():
    # 1. Organization
    org_id = "org-demo-1234"
    existing_org = await db["organizations"].find_one({"id": org_id})
    now = datetime.now(timezone.utc)
    
    if not existing_org:
        await db["organizations"].insert_one({
            "id": org_id,
            "name": "Waymark Tech Corp",
            "slug": "waymark-tech-corp",
            "plan": "enterprise",
            "isActive": True,
            "createdAt": now
        })
        print("Organization created.")

    # 2. Test Users
    password_hash = hash_password("Password123!")

    test_users = [
        {
            "id": str(uuid.uuid4()),
            "organizationId": org_id,
            "email": "admin@waymark.com",
            "name": "Alex Rivera (Admin)",
            "role": "admin",
            "passwordHash": password_hash,
            "isVerified": True,
            "isActive": True,
            "createdAt": now
        },
        {
            "id": str(uuid.uuid4()),
            "organizationId": org_id,
            "email": "pm@waymark.com",
            "name": "Sarah Chen (PM)",
            "role": "project_manager",
            "employeeId": "EMP-1001",
            "position": "Lead PM",
            "passwordHash": password_hash,
            "isVerified": True,
            "isActive": True,
            "createdAt": now
        },
        {
            "id": str(uuid.uuid4()),
            "organizationId": org_id,
            "email": "employee@waymark.com",
            "name": "Jordan Lee (Dev)",
            "role": "employee",
            "employeeId": "EMP-1002",
            "position": "Full Stack Engineer",
            "passwordHash": password_hash,
            "isVerified": True,
            "isActive": True,
            "createdAt": now
        }
    ]

    for u in test_users:
        existing = await db["users"].find_one({"email": u["email"]})
        if not existing:
            await db["users"].insert_one(u)
            print(f"Created user: {u['email']} ({u['role']})")
        else:
            await db["users"].update_one(
                {"email": u["email"]},
                {"$set": {
                    "passwordHash": password_hash,
                    "isVerified": True,
                    "isActive": True,
                    "organizationId": org_id
                }}
            )
            print(f"Updated user credentials: {u['email']}")

if __name__ == "__main__":
    asyncio.run(seed())
