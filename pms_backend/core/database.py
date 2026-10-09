import os
import certifi
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv
import os

# Load variables from .env.local and .env files
load_dotenv(os.path.join(os.path.dirname(os.path.dirname(__file__)), ".env.local"))
load_dotenv(os.path.join(os.path.dirname(os.path.dirname(__file__)), ".env"))

MONGO_URI = os.getenv("MONGO_URI") or "mongodb://localhost:27017"
DB_NAME = os.getenv("DB_NAME") or "project_management_system"

client_kwargs = {}
if "mongodb+srv://" in MONGO_URI or "tls=true" in MONGO_URI.lower() or "ssl=true" in MONGO_URI.lower():
    client_kwargs["tlsCAFile"] = certifi.where()

client = AsyncIOMotorClient(MONGO_URI, **client_kwargs)
db = client[DB_NAME]

def get_db():
    """Dependency injection function to provide the database instance to routes."""
    return db

async def init_db():
    try:
        # Departments indexes
        await db.departments.create_index([("organization_id", 1), ("department_name", 1)], unique=True)
        await db.departments.create_index([("organization_id", 1)])
        await db.departments.create_index([("status", 1)])

        # Core Systems: Permissions indexes
        await db.permissions.create_index([("permission_key", 1)], unique=True)
        await db.permissions.create_index([("module", 1)])
        await db.permissions.create_index([("action", 1)])
        await db.permissions.create_index([("status", 1)])

        # Core Systems: Roles indexes
        await db.roles.create_index([("role_key", 1)], unique=True)
        await db.roles.create_index([("scope_type", 1)])
        await db.roles.create_index([("organization_id", 1)])
        await db.roles.create_index([("status", 1)])

        # Core Systems: Role-Permissions mapping indexes
        await db.role_permissions.create_index([("role_id", 1), ("permission_id", 1)], unique=True)
        await db.role_permissions.create_index([("role_id", 1)])
        await db.role_permissions.create_index([("permission_id", 1)])
        await db.role_permissions.create_index([("created_at", 1)])

        # Core Systems: Activity & Audit Logs indexes
        await db.activity_logs.create_index([("created_at", -1)])
        await db.activity_logs.create_index([("module", 1)])
        await db.activity_logs.create_index([("action", 1)])
        await db.activity_logs.create_index([("entity_type", 1)])
        await db.activity_logs.create_index([("entity_id", 1)])
        await db.activity_logs.create_index([("user_id", 1)])
        await db.activity_logs.create_index([("status", 1)])
        await db.activity_logs.create_index([("module", 1), ("entity_type", 1)])
        await db.activity_logs.create_index([("module", 1), ("created_at", -1)])

        # Notifications (TTL 7 days)
        await db.notifications.create_index([("created_at", 1)], expireAfterSeconds=604800)
        await db.notifications.create_index([("recipient_id", 1)])

        # System Logs (TTL 24 hours)
        await db.system_logs.create_index([("timestamp", 1)], expireAfterSeconds=86400)

        print("MongoDB collections and indexes initialized successfully.")
    except Exception as exc:
        print(f"Could not initialize MongoDB indexes: {exc}")