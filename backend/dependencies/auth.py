"""
Authentication Dependencies

Provides authentication and authorization dependencies for FastAPI routes.
Extracts user and company information from Supabase JWT tokens.
"""

from fastapi import Depends, HTTPException, status, Request
from sqlalchemy.orm import Session
from sqlalchemy import text
from typing import Dict, Any, Optional
from uuid import UUID
import logging

from config.database import get_db
from utils.supabase_auth import supabase_auth

logger = logging.getLogger(__name__)


class CurrentUser:
    """Current authenticated user information"""
    def __init__(self, auth_user_id: str, user_id: UUID, company_id: UUID, role: str, username: str, email: str):
        self.auth_user_id = auth_user_id  # Supabase auth.users.id
        self.user_id = user_id            # App users.id
        self.company_id = company_id
        self.role = role
        self.username = username
        self.email = email


async def get_current_user(request: Request, db: Session = Depends(get_db)) -> CurrentUser:
    """
    Extract current user from Supabase JWT token
    
    This dependency should be used on all protected routes to ensure:
    1. User is authenticated via Supabase
    2. Company context is available for tenant scoping
    
    Raises:
        HTTPException: If user is not authenticated or token is invalid
    """
    # Get Authorization header
    authorization = request.headers.get("authorization")
    
    if not authorization:
        logger.warning("No Authorization header found")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated - missing Authorization header"
        )
    
    try:
        # Verify JWT and extract auth user ID / email once
        payload = supabase_auth.verify_jwt(authorization)
        auth_user_id = payload.get("sub")
        token_email = payload.get("email")
        logger.info(f"Authenticated user: {auth_user_id}")
        
        # Get user profile from our database
        logger.info(f"Executing query to find user profile for auth_user_id: {auth_user_id}")
        query = text("""
            SELECT 
                u.id as user_id,
                u.company_id,
                u.role,
                u.username,
                u.email,
                u.status,
                u.deleted_at
            FROM users u
            WHERE (
                u.auth_user_id = :auth_user_id
                OR (:token_email IS NOT NULL AND lower(u.email) = lower(:token_email))
            )
              AND u.deleted_at IS NULL
            ORDER BY CASE WHEN u.auth_user_id = :auth_user_id THEN 0 ELSE 1 END
            LIMIT 1
        """)
        
        result = db.execute(query, {
            "auth_user_id": auth_user_id,
            "token_email": token_email,
        }).fetchone()
        logger.info(f"Query completed. Result: {'Found' if result else 'Not found'}")
        
        if not result:
            logger.warning(f"No profile found for auth user: {auth_user_id}")
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User profile not found"
            )
        
        # Check user status
        if result.status != 'active':
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"User account is {result.status}"
            )
        
        # Return current user object
        return CurrentUser(
            auth_user_id=auth_user_id,
            user_id=result.user_id,
            company_id=result.company_id,
            role=result.role,
            username=result.username,
            email=result.email
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting current user: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error validating authentication"
        )


async def get_current_company_id(current_user: CurrentUser = Depends(get_current_user)) -> UUID:
    """
    Extract company_id from current user
    
    This is a convenience dependency for routes that only need company_id
    """
    return current_user.company_id


def require_role(*allowed_roles: str):
    """
    Dependency factory for role-based access control
    
    Usage:
        @router.get("/admin-only", dependencies=[Depends(require_role("admin", "super_admin"))])
    """
    async def role_checker(current_user: CurrentUser = Depends(get_current_user)):
        if current_user.role not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Insufficient permissions. Required roles: {', '.join(allowed_roles)}"
            )
        return current_user
    
    return role_checker
