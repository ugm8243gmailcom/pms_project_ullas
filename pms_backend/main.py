import time
import uuid
import datetime
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.exceptions import RequestValidationError
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request

from core.exceptions import validation_exception_handler
from core.database import init_db, db

class SystemLogMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        start_time = time.time()
        
        response = await call_next(request)
        
        process_time = time.time() - start_time
        level = "INFO" if response.status_code < 400 else "ERROR"
        
        # Don't log system logs endpoint or static docs to prevent log bloat
        path = request.url.path
        if path != "/api/v1/iam/system/logs" and not path.startswith("/docs") and not path.startswith("/openapi.json"):
            now = datetime.datetime.now(datetime.timezone.utc)
            formatted_time = now.strftime("%Y-%m-%d %H:%M:%S UTC")
            log_entry = {
                "log_id": str(uuid.uuid4()),
                "level": level,
                "message": f"[{formatted_time}] {request.method} {path} - {response.status_code} ({process_time:.4f}s)",
                "timestamp": now  # Python datetime is stored as BSON Date for 24h TTL expiration
            }
            try:
                await db.system_logs.insert_one(log_entry)
            except Exception:
                pass
            
        return response

# Import all Domain Routers
from api.routers import (
    v1_auth,
    v1_iam, 
    v1_config, 
    v1_projects, 
    v1_issues, 
    v1_extensions,
    v1_departments,
    v1_rbac,
    v1_audit,
    v1_notifications
)

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Initialize DB indexes
    await init_db()
    yield

app = FastAPI(
    title="Enterprise Project Management API",
    description="Full-stack modular backend with strict RBAC, Workload Intelligence & Dynamic Workflows.",
    version="1.0.0",
    lifespan=lifespan
)

# CORS Configuration - Supports multi-port dev servers and production
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:5174",
        "http://127.0.0.1:5174",
        "http://localhost:3000",
        "https://proman-aura-frontend-362935833196.asia-south1.run.app"
    ],
    allow_origin_regex=r"^https?://(localhost|127\.0\.0\.1)(:\d+)?$",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.add_middleware(SystemLogMiddleware)

# Custom Error Handling for Organization Users
app.add_exception_handler(RequestValidationError, validation_exception_handler)

# Register all routes to the main application
app.include_router(v1_auth.router)
app.include_router(v1_iam.router)
app.include_router(v1_config.router)
app.include_router(v1_projects.router)
app.include_router(v1_issues.router)
app.include_router(v1_extensions.router)
app.include_router(v1_departments.router)
app.include_router(v1_rbac.router)
app.include_router(v1_audit.router)
app.include_router(v1_notifications.router)

@app.get("/health", tags=["System"])
async def health_check():
    return {"status": "healthy", "architecture": "Domain-Driven Design Active"}