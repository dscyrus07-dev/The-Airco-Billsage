"""
Users Router

Handles user management within companies.
"""

from fastapi import APIRouter, HTTPException, Depends, status
from pydantic import BaseModel, EmailStr, Field
from typing import Optional, List
from sqlalchemy import text
from sqlalchemy.orm import Session
import logging
from datetime import datetime
from passlib.context import CryptContext

from config.database import get_db
from dependencies.auth import CurrentUser, get_current_user

logger = logging.getLogger(__name__)
router = APIRouter()

# Password hashing
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# Pydantic Models
class UserResponse(BaseModel):
    id: str
    company_id: str
    email: str
    name: str
    phone: Optional[str] = None
    role: str
    is_active: bool
    last_login: Optional[datetime] = None
    created_at: datetime

class UserCreateRequest(BaseModel):
    email: EmailStr
    name: str = Field(..., min_length=2, max_length=255)
    phone: Optional[str] = None
    role: str = Field(..., pattern="^(admin|accountant|operator|viewer)$")
    password: str = Field(..., min_length=8)

class UserUpdateRequest(BaseModel):
    name: Optional[str] = Field(None, min_length=2, max_length=255)
    phone: Optional[str] = None
    role: Optional[str] = Field(None, pattern="^(admin|accountant|operator|viewer)$")
    is_active: Optional[bool] = None

class UserListResponse(BaseModel):
    users: List[UserResponse]
    total: int

def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a password against its hash."""
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password: str) -> str:
    """Hash a password."""
    return pwd_context.hash(password)

@router.get("", response_model=UserListResponse)
async def list_users(
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user)
):
    """List all users for current company"""
    try:
        company_id = str(current_user.company_id)
        
        # Query users for this company
        query = text("""
            SELECT 
                id,
                company_id,
                email,
                full_name,
                phone,
                role,
                status,
                last_login_at,
                created_at
            FROM users 
            WHERE company_id = :company_id AND deleted_at IS NULL
            ORDER BY created_at DESC
        """)
        
        results = db.execute(query, {"company_id": company_id}).fetchall()
        
        users = []
        for result in results:
            user_data = dict(result._mapping)
            
            # Convert UUID to string
            if 'id' in user_data and user_data['id'] is not None:
                user_data['id'] = str(user_data['id'])
            if 'company_id' in user_data and user_data['company_id'] is not None:
                user_data['company_id'] = str(user_data['company_id'])
            
            # Map database fields to frontend fields
            user_data['name'] = user_data.pop('full_name')
            user_data['is_active'] = user_data.pop('status') == 'active'
            user_data['last_login'] = user_data.pop('last_login_at')
            users.append(UserResponse(**user_data))
        
        return UserListResponse(users=users, total=len(users))
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"List users error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to fetch users"
        )

@router.post("", response_model=UserResponse)
async def create_user(
    user_data: UserCreateRequest,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user)
):
    """Create a new user in the company"""
    try:
        # Check permissions (only admin/super_admin can create users)
        if current_user.role not in ['admin', 'super_admin']:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Insufficient permissions to create users"
            )
        
        company_id = str(current_user.company_id)
        
        # Check if email already exists in company
        existing_user = db.execute(
            text("""
                SELECT 1 FROM users 
                WHERE company_id = :company_id AND email = :email AND deleted_at IS NULL
            """),
            {"company_id": company_id, "email": user_data.email}
        ).fetchone()
        
        if existing_user:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="User with this email already exists"
            )
        
        # Hash password
        password_hash = get_password_hash(user_data.password)
        
        # Create user
        query = text("""
            INSERT INTO users (
                company_id, full_name, username, email, phone, 
                password_hash, role, status, created_at, updated_at
            ) VALUES (
                :company_id, :full_name, :username, :email, :phone,
                :password_hash, :role, 'active', now(), now()
            )
            RETURNING id, company_id, email, full_name, phone, role, status, created_at
        """)
        
        result = db.execute(query, {
            "company_id": company_id,
            "full_name": user_data.name,
            "username": user_data.email.split('@')[0],  # Use email prefix as username
            "email": user_data.email,
            "phone": user_data.phone,
            "password_hash": password_hash,
            "role": user_data.role
        }).fetchone()
        
        db.commit()
        
        user_response = dict(result._mapping)
        
        # Convert UUID to string
        if 'id' in user_response and user_response['id'] is not None:
            user_response['id'] = str(user_response['id'])
        if 'company_id' in user_response and user_response['company_id'] is not None:
            user_response['company_id'] = str(user_response['company_id'])
        
        user_response['name'] = user_response.pop('full_name')
        user_response['is_active'] = user_response.pop('status') == 'active'
        user_response['last_login'] = None
        
        return UserResponse(**user_response)
        
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"Create user error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create user"
        )

@router.patch("/{user_id}", response_model=UserResponse)
async def update_user(
    user_id: str,
    user_data: UserUpdateRequest,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user)
):
    """Update a user"""
    try:
        # Check permissions (only admin/super_admin can update users)
        if current_user.role not in ['admin', 'super_admin']:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Insufficient permissions to update users"
            )
        
        company_id = str(current_user.company_id)
        
        # Get target user
        target_user = db.execute(
            text("""
                SELECT id, company_id, role, status 
                FROM users 
                WHERE id = :user_id AND company_id = :company_id AND deleted_at IS NULL
            """),
            {"user_id": user_id, "company_id": company_id}
        ).fetchone()
        
        if not target_user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found"
            )
        
        # Users cannot update their own role or deactivate themselves
        if user_id == str(current_user.user_id):
            if user_data.role is not None and user_data.role != target_user['role']:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Cannot change your own role"
                )
            if user_data.is_active is not None and user_data.is_active == False:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Cannot deactivate yourself"
                )
        
        # Update user
        update_fields = []
        params = {"user_id": user_id, "company_id": company_id}
        
        if user_data.name is not None:
            update_fields.append("full_name = :name")
            params["name"] = user_data.name
        
        if user_data.phone is not None:
            update_fields.append("phone = :phone")
            params["phone"] = user_data.phone
        
        if user_data.role is not None:
            update_fields.append("role = :role")
            params["role"] = user_data.role
        
        if user_data.is_active is not None:
            update_fields.append("status = :status")
            params["status"] = "active" if user_data.is_active else "suspended"
        
        if update_fields:
            update_fields.append("updated_at = now()")
            query = text(f"""
                UPDATE users 
                SET {', '.join(update_fields)}
                WHERE id = :user_id AND company_id = :company_id
            """)
            db.execute(query, params)
            db.commit()
        
        # Return updated user
        updated_user = db.execute(
            text("""
                SELECT 
                    id, company_id, email, full_name, phone, role, 
                    status, last_login_at, created_at
                FROM users 
                WHERE id = :user_id AND company_id = :company_id AND deleted_at IS NULL
            """),
            {"user_id": user_id, "company_id": company_id}
        ).fetchone()
        
        user_response = dict(updated_user._mapping)
        
        # Convert UUID to string
        if 'id' in user_response and user_response['id'] is not None:
            user_response['id'] = str(user_response['id'])
        if 'company_id' in user_response and user_response['company_id'] is not None:
            user_response['company_id'] = str(user_response['company_id'])
        
        user_response['name'] = user_response.pop('full_name')
        user_response['is_active'] = user_response.pop('status') == 'active'
        user_response['last_login'] = user_response.pop('last_login_at')
        
        return UserResponse(**user_response)
        
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"Update user error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update user"
        )

@router.delete("/{user_id}")
async def delete_user(
    user_id: str,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user)
):
    """Deactivate a user (soft delete)"""
    try:
        # Check permissions (only admin/super_admin can delete users)
        if current_user.role not in ['admin', 'super_admin']:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Insufficient permissions to delete users"
            )
        
        company_id = str(current_user.company_id)
        
        # Cannot delete yourself
        if user_id == str(current_user.user_id):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Cannot delete yourself"
            )
        
        # Get target user
        target_user = db.execute(
            text("""
                SELECT 1 FROM users 
                WHERE id = :user_id AND company_id = :company_id AND deleted_at IS NULL
            """),
            {"user_id": user_id, "company_id": company_id}
        ).fetchone()
        
        if not target_user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found"
            )
        
        # Soft delete user
        query = text("""
            UPDATE users 
            SET status = 'suspended', deleted_at = now(), updated_at = now()
            WHERE id = :user_id AND company_id = :company_id
        """)
        
        db.execute(query, {"user_id": user_id, "company_id": company_id})
        db.commit()
        
        return {"message": "User deactivated successfully"}
        
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"Delete user error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to delete user"
        )
