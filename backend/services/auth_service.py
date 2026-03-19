"""
Authentication Service

Handles business logic for signup and login operations with Supabase integration.
"""

import logging
from typing import Optional, Dict, Any
from passlib.hash import bcrypt
from sqlalchemy.orm import Session
from sqlalchemy import select, and_, or_, text, column
from sqlalchemy.orm import Session
from datetime import datetime, timedelta
from fastapi import Depends
import uuid
import httpx

from config.database import db_config, get_db
from config.settings import settings
from schemas.auth_schemas import (
    SignupRequest, LoginRequest, CompanyCreate, 
    CompanyDetailsCreate, UserCreate
)
from utils.password_utils import store_password, verify_password, is_password_strong
from utils.code_generation import generate_company_code

logger = logging.getLogger(__name__)

class AuthService:
    """Service for authentication operations with Supabase"""
    
    def __init__(self, db: Session):
        self.db = db
        self.supabase_url = settings.SUPABASE_URL
        self.supabase_service_key = settings.SUPABASE_SERVICE_ROLE_KEY
    
    async def signup(self, signup_data: SignupRequest) -> Dict[str, Any]:
        """
        Handle complete signup flow: Supabase user -> company -> company_details -> user profile
        
        Args:
            signup_data: Complete signup request data
            
        Returns:
            Dict with success status and created data
            
        Raises:
            ValueError: For validation errors
            Exception: For database errors
        """
        logger.info(f"Auth service signup called with: {signup_data}")
        try:
            # Validate password strength
            if not is_password_strong(signup_data.user.password):
                raise ValueError("Password must be at least 6 characters and contain letters and numbers")
            
            # Auto-generate company code if not provided
            company_code = signup_data.company.company_code
            if not company_code:
                company_code = generate_company_code(signup_data.company.legal_name)
                logger.info(f"Auto-generated company code: {company_code}")
            else:
                # Check if provided company code already exists
                existing_company = self._check_company_exists(company_code)
                if existing_company:
                    raise ValueError(f"Company code '{company_code}' already exists")
            
            # Step 1: Create Supabase user
            auth_user_id = await self._create_supabase_user(
                email=signup_data.user.email,
                password=signup_data.user.password,
                full_name=signup_data.user.full_name
            )
            
            try:
                # Step 2: Create company
                company_data = CompanyCreate(
                    company_code=company_code,
                    legal_name=signup_data.company.legal_name,
                    trade_name=signup_data.company.trade_name,
                    display_name=signup_data.company.display_name,
                    primary_email=signup_data.company.primary_email,
                    primary_phone=signup_data.company.primary_phone
                )
                
                company = self._create_company(company_data)
                
                try:
                    # Step 3: Create company details
                    company_details = self._create_company_details(company['id'], signup_data.company_details)
                    
                    try:
                        # Step 4: Create user profile linked to Supabase auth
                        user = self._create_user_profile(company['id'], auth_user_id, signup_data.user)
                        
                        return {
                            "success": True,
                            "message": "Account created successfully",
                            "data": {
                                "company": company,
                                "company_details": company_details,
                                "user": user
                            }
                        }
                        
                    except Exception as e:
                        # If user profile creation fails, cleanup
                        logger.error(f"User profile creation failed: {e}")
                        raise ValueError(f"Failed to create user profile: {str(e)}")
                        
                except Exception as e:
                    # If company_details creation fails, delete the company
                    self._delete_company(company['id'])
                    logger.error(f"Company details creation failed: {e}")
                    raise ValueError(f"Failed to create company details: {str(e)}")
                    
            except Exception as e:
                # If company creation fails, delete Supabase user
                await self._delete_supabase_user(auth_user_id)
                logger.error(f"Company creation failed: {e}")
                raise ValueError(f"Failed to create company: {str(e)}")
                
        except ValueError:
            raise
        except Exception as e:
            logger.error(f"Signup failed: {e}")
            raise ValueError(f"Signup failed: {str(e)}")
    
    async def _create_supabase_user(self, email: str, password: str, full_name: str) -> str:
        """Create user in Supabase Auth"""
        try:
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    f"{self.supabase_url}/auth/v1/admin/users",
                    headers={
                        "Authorization": f"Bearer {self.supabase_service_key}",
                        "apikey": self.supabase_service_key,
                        "Content-Type": "application/json"
                    },
                    json={
                        "email": email,
                        "password": password,
                        "email_confirm": True,  # Auto-confirm email for now
                        "user_metadata": {
                            "full_name": full_name
                        },
                        "app_metadata": {
                            "provider": "email",
                            "role": "authenticated"
                        }
                    }
                )
                
                logger.info(f"Supabase response status: {response.status_code}")
                if response.status_code not in [200, 201]:
                    logger.info("Processing error response from Supabase")
                    error_data = response.json() if response.content else {}
                    logger.error(f"Supabase user creation failed: {response.status_code} - {error_data}")
                    raise ValueError(f"Failed to create user account: {error_data.get('message', 'Unknown error')}")
                
                logger.info("Processing success response from Supabase")
                user_data = response.json()
                auth_user_id = user_data.get('id')
                
                if not auth_user_id:
                    raise ValueError("No user ID returned from Supabase")
                
                logger.info(f"Created Supabase user: {auth_user_id}")
                return auth_user_id
                
        except httpx.RequestError as e:
            logger.error(f"Network error creating Supabase user: {e}")
            raise ValueError("Failed to connect to authentication service")
        except Exception as e:
            logger.error(f"Unexpected error creating Supabase user: {e}")
            raise ValueError("Failed to create user account")
    
    async def _delete_supabase_user(self, auth_user_id: str):
        """Delete user from Supabase Auth (cleanup)"""
        try:
            async with httpx.AsyncClient() as client:
                response = await client.delete(
                    f"{self.supabase_url}/auth/v1/admin/users/{auth_user_id}",
                    headers={
                        "Authorization": f"Bearer {self.supabase_service_key}",
                        "apikey": self.supabase_service_key
                    }
                )
                
                if response.status_code not in [200, 204]:
                    logger.warning(f"Failed to delete Supabase user {auth_user_id}: {response.status_code}")
                else:
                    logger.info(f"Deleted Supabase user: {auth_user_id}")
                    
        except Exception as e:
            logger.error(f"Error deleting Supabase user: {e}")
    
    def _create_user_profile(self, company_id: str, auth_user_id: str, user_data: UserCreate) -> Dict[str, Any]:
        """Create user profile record linked to Supabase auth"""
        try:
            # Check if username or email already exists in this company
            existing_user = self._check_user_exists(company_id, user_data.username, user_data.email)
            if existing_user:
                if existing_user['username'] == user_data.username:
                    raise ValueError(f"Username '{user_data.username}' already exists in this company")
                if existing_user['email'] == user_data.email:
                    raise ValueError(f"Email '{user_data.email}' already exists in this company")

            # Store a placeholder hash since Supabase handles authentication; column is NOT NULL
            # Avoid bcrypt backend issues by using a static marker value
            password_hash = "supabase-managed"

            query = text("""
                INSERT INTO users (
                    company_id, auth_user_id, full_name, username, email, phone,
                    role, status, is_email_verified, password_hash,
                    failed_login_attempts, created_at, updated_at
                ) VALUES (
                    :company_id, :auth_user_id, :full_name, :username, :email, :phone,
                    :role, 'active', false, :password_hash,
                    0, now(), now()
                ) RETURNING id, company_id, auth_user_id, full_name, username, email, phone,
                         role, status, is_email_verified, created_at
            """)

            params = user_data.dict()
            params['company_id'] = company_id
            params['auth_user_id'] = auth_user_id
            params['password_hash'] = password_hash
            
            result = self.db.execute(query, params).fetchone()
            self.db.commit()
            
            # Use _mapping to safely convert result to dict
            return dict(result._mapping)
            
        except Exception as e:
            self.db.rollback()
            logger.error(f"Error creating user profile: {e}")
            raise
    
    def login(self, login_data: LoginRequest) -> Dict[str, Any]:
        """
        Login is now handled by Supabase Auth directly.
        This method is deprecated and will be removed after migration.
        """
        raise ValueError("Login should be handled through Supabase Auth. Please use the frontend login flow.")
    
    def _check_company_exists(self, company_code: str) -> Optional[Dict[str, Any]]:
        """Check if company with given code already exists"""
        try:
            query = select(
                'id', 'company_code', 'legal_name', 'status'
            ).where(
                and_(
                    text('company_code = :company_code'),
                    text('deleted_at IS NULL')
                )
            )
            
            result = self.db.execute(query, {'company_code': company_code}).fetchone()
            return dict(result) if result else None
            
        except Exception as e:
            logger.error(f"Error checking company existence: {e}")
            return None
    
    def _create_company(self, company_data: CompanyCreate) -> Dict[str, Any]:
        """Create new company record"""
        try:
            query = text("""
                INSERT INTO companies (
                    company_code, legal_name, trade_name, display_name,
                    primary_email, primary_phone, status, created_at, updated_at
                ) VALUES (
                    :company_code, :legal_name, :trade_name, :display_name,
                    :primary_email, :primary_phone, 'active', now(), now()
                ) RETURNING id, company_code, legal_name, trade_name, display_name,
                         primary_email, primary_phone, status, created_at
            """)
            
            params = company_data.dict()
            result = self.db.execute(query, params).fetchone()
            self.db.commit()
            
            # Use _mapping to safely convert result to dict
            return dict(result._mapping)
            
        except Exception as e:
            self.db.rollback()
            logger.error(f"Error creating company: {e}")
            raise
    
    def _create_company_details(self, company_id: str, details_data: CompanyDetailsCreate) -> Dict[str, Any]:
        """Create company details record"""
        try:
            query = text("""
                INSERT INTO company_details (
                    company_id, address_line_1, address_line_2, city, state,
                    postal_code, country, pan, gstin, cin, tan,
                    billing_email, support_email, website,
                    financial_year_start_month, invoice_prefix, created_at, updated_at
                ) VALUES (
                    :company_id, :address_line_1, :address_line_2, :city, :state,
                    :postal_code, :country, :pan, :gstin, :cin, :tan,
                    :billing_email, :support_email, :website,
                    :financial_year_start_month, :invoice_prefix, now(), now()
                ) RETURNING id, company_id, address_line_1, city, state, country,
                         financial_year_start_month, invoice_prefix, created_at
            """)
            
            params = details_data.dict()
            params['company_id'] = company_id
            
            result = self.db.execute(query, params).fetchone()
            self.db.commit()
            
            # Use _mapping to safely convert result to dict
            return dict(result._mapping)
            
        except Exception as e:
            self.db.rollback()
            logger.error(f"Error creating company details: {e}")
            raise
    
    def _check_user_exists(self, company_id: str, username: str, email: str) -> Optional[Dict[str, Any]]:
        """Check if user with given username or email exists in company"""
        try:
            query = text("""
                SELECT id, username, email 
                FROM users 
                WHERE company_id = :company_id 
                AND deleted_at IS NULL 
                AND (username = :username OR email = :email)
            """)
            
            result = self.db.execute(query, {
                'company_id': company_id,
                'username': username,
                'email': email
            }).fetchone()
            
            return dict(result) if result else None
            
        except Exception as e:
            logger.error(f"Error checking user existence: {e}")
            return None
    
    def _delete_company(self, company_id: str):
        """Delete company (cleanup on failure)"""
        try:
            query = text("DELETE FROM companies WHERE id = :company_id")
            self.db.execute(query, {'company_id': company_id})
            self.db.commit()
        except Exception as e:
            logger.error(f"Error deleting company: {e}")


# Dependency function for FastAPI
def get_auth_service(db: Session = Depends(get_db)) -> AuthService:
    """Get auth service instance"""
    return AuthService(db)
