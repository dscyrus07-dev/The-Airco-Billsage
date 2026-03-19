"""
BillSage Backend Application

Main FastAPI application with all API routes for the BillSage system.
"""

from fastapi import FastAPI, HTTPException, Depends, status, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.openapi.docs import get_swagger_ui_html
from fastapi.openapi.utils import get_openapi
from contextlib import asynccontextmanager
import logging
import os
from datetime import datetime
from typing import Dict, Any, List, Optional
from dotenv import load_dotenv

from config.database import db_config

# Load environment variables
load_dotenv()

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan events"""
    # Startup
    logger.info("Starting BillSage Backend API...")
    
    # Validate configuration
    try:
        from config.settings import settings
        settings.validate()
        logger.info("Configuration validation passed")
    except ValueError as e:
        logger.error(f"Configuration validation failed: {e}")
        logger.warning("Application may not function correctly. Please fix configuration issues.")
    except Exception as e:
        logger.error(f"Unexpected error during configuration validation: {e}")
    
    # Test database connection
    try:
        health = db_config.health_check()
        if health["status"] == "healthy":
            logger.info("Database connection healthy")
        else:
            logger.error(f"Database connection failed: {health.get('error')}")
    except Exception as e:
        logger.error(f"Database health check failed: {e}")
    
    yield
    
    # Shutdown
    logger.info("Shutting down BillSage Backend API...")
    db_config.close_connections()

# Create FastAPI app
app = FastAPI(
    title="BillSage API",
    description="Complete API for BillSage billing and invoicing system",
    version="1.0.0",
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url="/openapi.json",
    redirect_slashes=False  # Disable automatic trailing slash redirects to prevent CORS issues
)

# Configure CORS - MUST be the very first middleware added
# Get allowed origins from environment variable or use defaults
cors_origins_str = os.getenv(
    "CORS_ORIGINS",
    "http://localhost:8080,http://localhost:3000,http://127.0.0.1:8080,http://127.0.0.1:3000,http://localhost:5173,http://127.0.0.1:5173"
)
cors_origins = [origin.strip() for origin in cors_origins_str.split(",")]

logger.info(f"CORS enabled for origins: {cors_origins}")

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=True,  # Required for cookies and authentication
    allow_methods=["*"],  # Allow all HTTP methods
    allow_headers=["*"],  # Allow all headers
    expose_headers=["*"],  # Expose all headers to the client
    max_age=600,  # Cache preflight requests for 10 minutes
)

# Import all routers
from routers.auth import router as auth_router
from routers.purchases import router as purchases_router
from routers.sales import router as sales_router
from routers.parties import router as parties_router
from routers.products import router as products_router
from routers.payments import router as payments_router
from routers.receivables import router as receivables_router
from routers.gst import router as gst_router
from routers.kpis import router as kpis_router
from routers.approvals import router as approvals_router
from routers.company import router as company_router
from routers.users import router as users_router
from routers.settings import router as settings_router
from routers.journal import router as journal_router

# Register all routers
app.include_router(auth_router, prefix="/api/auth", tags=["Authentication"])
app.include_router(purchases_router, prefix="/api/v1/purchases", tags=["Purchases"])
app.include_router(sales_router, prefix="/api/v1/sales", tags=["Sales"])
app.include_router(parties_router, prefix="/api/v1/parties", tags=["Parties"])
app.include_router(products_router, prefix="/api/v1/products", tags=["Products"])
app.include_router(payments_router, prefix="/api/v1/payments", tags=["Payments"])
app.include_router(receivables_router, prefix="/api/v1/receivables", tags=["Receivables"])
app.include_router(gst_router, prefix="/api/v1/gst", tags=["GST"])
app.include_router(kpis_router, prefix="/api/v1/kpis", tags=["KPIs"])
app.include_router(approvals_router, prefix="/api/v1/approvals", tags=["Approvals"])
app.include_router(company_router, prefix="/api/v1/company", tags=["Company"])
app.include_router(users_router, prefix="/api/v1/users", tags=["Users"])
app.include_router(settings_router, prefix="/api/v1/settings", tags=["Settings"])
app.include_router(journal_router, prefix="/api/v1/journal", tags=["Journal"])

# Health check endpoint
@app.get("/health")
async def health_check():
    """Health check endpoint"""
    try:
        db_health = db_config.health_check()
        return {
            "status": "healthy",
            "timestamp": datetime.utcnow().isoformat(),
            "database": db_health["status"],
            "version": "1.0.0"
        }
    except Exception as e:
        return JSONResponse(
            status_code=503,
            content={
                "status": "unhealthy",
                "timestamp": datetime.utcnow().isoformat(),
                "error": str(e),
                "database": "error"
            }
        )

# HTTP exception handler (for authentication, validation errors, etc.)
@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    logger.warning(f"HTTP exception on {request.method} {request.url.path}: {exc.status_code} - {exc.detail}")
    
    # Get allowed origins from environment
    cors_origins_str = os.getenv(
        "CORS_ORIGINS",
        "http://localhost:8080,http://localhost:3000,http://127.0.0.1:8080,http://127.0.0.1:3000,http://localhost:5173,http://127.0.0.1:5173"
    )
    cors_origins = [origin.strip() for origin in cors_origins_str.split(",")]
    
    # Determine origin for CORS headers
    origin = request.headers.get("origin", "")
    allowed_origin = origin if origin in cors_origins else cors_origins[0]
    
    return JSONResponse(
        status_code=exc.status_code,
        content={"detail": exc.detail},
        headers={
            "Access-Control-Allow-Origin": allowed_origin,
            "Access-Control-Allow-Credentials": "true",
            "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
            "Access-Control-Allow-Headers": "*"
        }
    )

# Global exception handler
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.error(f"Global exception on {request.method} {request.url.path}: {exc}", exc_info=True)
    
    # In development, provide more detailed error information
    error_detail = {
        "message": "Internal server error",
        "type": type(exc).__name__,
        "path": request.url.path,
        "method": request.method
    }
    
    # Add exception message in development for debugging
    if os.getenv("ENVIRONMENT", "development") == "development":
        error_detail["error"] = str(exc)
    
    # Get allowed origins from environment
    cors_origins_str = os.getenv(
        "CORS_ORIGINS",
        "http://localhost:8080,http://localhost:3000,http://127.0.0.1:8080,http://127.0.0.1:3000,http://localhost:5173,http://127.0.0.1:5173"
    )
    cors_origins = [origin.strip() for origin in cors_origins_str.split(",")]
    
    # Determine origin for CORS headers
    origin = request.headers.get("origin", "")
    allowed_origin = origin if origin in cors_origins else cors_origins[0]
    
    return JSONResponse(
        status_code=500,
        content={"detail": error_detail},
        headers={
            "Access-Control-Allow-Origin": allowed_origin,
            "Access-Control-Allow-Credentials": "true",
            "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
            "Access-Control-Allow-Headers": "*"
        }
    )

# Custom OpenAPI schema
def custom_openapi():
    if app.openapi_schema:
        return app.openapi_schema
    
    openapi_schema = get_openapi(
        title="BillSage API",
        version="1.0.0",
        description="Complete API for BillSage billing and invoicing system",
        routes=app.routes,
    )
    
    # Add security schemes for authentication
    openapi_schema["components"]["securitySchemes"] = {
        "cookieAuth": {
            "type": "apiKey",
            "in": "cookie",
            "name": "session"
        }
    }
    
    app.openapi_schema = openapi_schema
    return app.openapi_schema

app.openapi = custom_openapi

# Root endpoint
@app.get("/")
async def root():
    """Root endpoint with API information"""
    return {
        "name": "BillSage API",
        "version": "1.0.0",
        "description": "Complete API for BillSage billing and invoicing system",
        "docs": "/docs",
        "health": "/health",
        "endpoints": {
            "auth": "/api/auth",
            "purchases": "/api/v1/purchases",
            "sales": "/api/v1/sales",
            "parties": "/api/v1/parties",
            "products": "/api/v1/products",
            "payments": "/api/v1/payments",
            "receivables": "/api/v1/receivables",
            "gst": "/api/v1/gst",
            "kpis": "/api/v1/kpis",
            "approvals": "/api/v1/approvals",
            "settings": "/api/v1/settings",
            "journal": "/api/v1/journal"
        }
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
        log_level="info"
    )
