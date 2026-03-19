"""
Authentication Router

Handles user authentication, signup, login, logout, and session management.
"""

from fastapi import APIRouter, HTTPException, Depends, status, Request, Response
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from sqlalchemy import text
from pydantic import EmailStr
from typing import Optional, Dict, Any
import logging
from datetime import datetime, timedelta
import uuid

from config.database import get_db
from dependencies.auth import CurrentUser, get_current_user
from schemas.auth_schemas import (
    SignupRequest, LoginRequest, SignupResponse, 
    LoginResponse, ErrorResponse
)
from services.auth_service import AuthService

logger = logging.getLogger(__name__)
router = APIRouter(tags=["Authentication"])

def get_auth_service(db: Session = Depends(get_db)) -> AuthService:
    """Get auth service instance"""
    logger.info(f"Creating auth service with db: {db}")
    service = AuthService(db)
    logger.info(f"Auth service created: {service}")
    return service

@router.get("/test")
async def test_endpoint():
    """Simple test endpoint"""
    return {"message": "Test endpoint works"}

@router.get("/debug/token")
async def debug_token(request: Request):
    """Debug endpoint to examine JWT token and verification"""
    from utils.supabase_auth import supabase_auth
    import json
    
    authorization = request.headers.get("authorization")
    result = {
        "auth_header_present": bool(authorization),
        "auth_header_length": len(authorization) if authorization else 0,
        "auth_header_preview": authorization[:50] + "..." if authorization else None,
    }
    
    if not authorization:
        result["error"] = "No Authorization header"
        return result
    
    try:
        payload = supabase_auth.verify_jwt(authorization)
        result["jwt_verification"] = "success"
        result["payload"] = {
            "sub": payload.get("sub"),
            "email": payload.get("email"),
            "iss": payload.get("iss"),
            "exp": payload.get("exp"),
            "iat": payload.get("iat"),
            "role": payload.get("role"),
            "aud": payload.get("aud"),
        }
    except Exception as e:
        result["jwt_verification"] = "failed"
        result["error"] = str(e)
    
    return result

@router.post("/signup", response_model=SignupResponse, status_code=status.HTTP_201_CREATED)
async def signup(
    signup_data: SignupRequest,
    auth_service: AuthService = Depends(get_auth_service)
):
    """
    Sign up a new company with first user
    
    Creates a company, company details, and first user in a single transaction.
    The first user will be assigned the super_admin role.
    """
    logger.info(f"Signup endpoint called with data: {signup_data}")
    try:
        result = await auth_service.signup(signup_data)
        logger.info(f"Auth service returned result: {type(result)} - {result}")
        return result
        
    except ValueError as e:
        logger.warning(f"Signup validation error: {e}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "success": False,
                "message": str(e),
                "error_code": "VALIDATION_ERROR"
            }
        )
    except Exception as e:
        logger.error(f"Signup error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={
                "success": False,
                "message": "Internal server error during signup",
                "error_code": "INTERNAL_ERROR"
            }
        )

@router.get("/me")
async def get_current_user_info(
    current_user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get current authenticated user and company information
    
    Returns user details and associated company information for the authenticated session.
    """
    try:
        logger.info(f"Executing query for full user info in /me endpoint. user_id: {current_user.user_id}")
        # Query full user and company details
        query = text("""
            SELECT 
                u.id, u.auth_user_id, u.company_id, u.username, u.email, u.full_name,
                u.phone, u.role, u.status, u.is_email_verified,
                u.created_at, u.updated_at,
                c.company_code, c.legal_name, c.trade_name, c.display_name,
                c.primary_email, c.primary_phone, c.status as company_status
            FROM users u
            JOIN companies c ON u.company_id = c.id
            WHERE u.id = :user_id AND u.deleted_at IS NULL
        """)
        
        result = db.execute(query, {"user_id": str(current_user.user_id)}).fetchone()
        logger.info("Full user info query completed.")
        
        if not result:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail={
                    "success": False,
                    "message": "User not found",
                    "error_code": "USER_NOT_FOUND"
                }
            )
        
        return {
            "success": True,
            "data": {
                "user": {
                    "user_id": str(result.id),
                    "auth_user_id": str(result.auth_user_id),
                    "company_id": str(result.company_id),
                    "username": result.username,
                    "email": result.email,
                    "name": result.full_name,
                    "phone": result.phone,
                    "role": result.role,
                    "status": result.status,
                    "is_email_verified": result.is_email_verified,
                    "created_at": result.created_at.isoformat() if result.created_at else None,
                    "updated_at": result.updated_at.isoformat() if result.updated_at else None
                },
                "company": {
                    "id": str(result.company_id),
                    "company_code": result.company_code,
                    "legal_name": result.legal_name,
                    "trade_name": result.trade_name,
                    "display_name": result.display_name,
                    "primary_email": result.primary_email,
                    "primary_phone": result.primary_phone,
                    "status": result.company_status
                }
            }
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Get current user error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={
                "success": False,
                "message": "Failed to fetch user information",
                "error_code": "INTERNAL_ERROR"
            }
        )

@router.post("/refresh")
async def refresh_token():
    """
    Refresh authentication token
    
    Note: This is a placeholder implementation.
    In production, this would issue a new token.
    """
    # TODO: Implement actual token refresh
    raise HTTPException(
        status_code=status.HTTP_501_NOT_IMPLEMENTED,
        detail={
            "success": False,
            "message": "Token refresh not implemented yet",
            "error_code": "NOT_IMPLEMENTED"
        }
    )
