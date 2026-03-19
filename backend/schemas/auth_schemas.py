"""
Authentication Schemas

Pydantic models for authentication requests and responses.
"""

from pydantic import BaseModel, EmailStr, Field, validator
from typing import Optional, Dict, Any
from datetime import datetime
import re

# Company schemas
class CompanyCreate(BaseModel):
    company_code: Optional[str] = Field(None, min_length=2, max_length=30, description="Unique company code (will be auto-generated if not provided)")
    legal_name: str = Field(..., min_length=2, max_length=255, description="Legal company name")
    trade_name: Optional[str] = Field(None, max_length=255, description="Trade name")
    display_name: Optional[str] = Field(None, max_length=255, description="Display name")
    primary_email: EmailStr = Field(..., description="Primary email address")
    primary_phone: Optional[str] = Field(None, max_length=20, description="Primary phone number")
    
    @validator('company_code')
    def validate_company_code(cls, v):
        if v and not re.match(r'^[A-Za-z0-9_-]+$', v):
            raise ValueError('Company code can only contain letters, numbers, underscores, and hyphens')
        return v.upper() if v else v

class CompanyDetailsCreate(BaseModel):
    address_line_1: Optional[str] = Field(None, max_length=255)
    address_line_2: Optional[str] = Field(None, max_length=255)
    city: Optional[str] = Field(None, max_length=100)
    state: Optional[str] = Field(None, max_length=100)
    postal_code: Optional[str] = Field(None, max_length=20)
    country: str = Field(default="India", max_length=100)
    pan: Optional[str] = Field(None, max_length=20)
    gstin: Optional[str] = Field(None, max_length=20)
    cin: Optional[str] = Field(None, max_length=30)
    tan: Optional[str] = Field(None, max_length=20)
    billing_email: Optional[EmailStr] = None
    support_email: Optional[EmailStr] = None
    website: Optional[str] = Field(None, max_length=255)
    financial_year_start_month: int = Field(default=4, ge=1, le=12)
    invoice_prefix: str = Field(default="INV", max_length=20)
    
    @validator('pan')
    def validate_pan(cls, v):
        if v and not re.match(r'^[A-Za-z]{5}[0-9]{4}[A-Za-z]{1}$', v):
            raise ValueError('Invalid PAN format')
        return v

# User schemas
class UserCreate(BaseModel):
    full_name: str = Field(..., min_length=2, max_length=255)
    username: str = Field(..., min_length=2, max_length=100)
    email: EmailStr = Field(..., description="User email address")
    phone: Optional[str] = Field(None, max_length=20)
    password: str = Field(..., min_length=6, max_length=255)
    role: str = Field(default="super_admin", description="User role")
    
    @validator('username')
    def validate_username(cls, v):
        if not re.match(r'^[A-Za-z0-9_-]+$', v):
            raise ValueError('Username can only contain letters, numbers, underscores, and hyphens')
        return v.lower()
    
    @validator('role')
    def validate_role(cls, v):
        allowed_roles = {'super_admin', 'admin', 'accountant', 'operator', 'viewer'}
        if v not in allowed_roles:
            raise ValueError(f'Role must be one of: {", ".join(allowed_roles)}')
        return v

# Combined signup request
class SignupRequest(BaseModel):
    company: CompanyCreate
    company_details: Optional[CompanyDetailsCreate] = Field(default_factory=CompanyDetailsCreate)
    user: UserCreate

# Login schemas
class LoginRequest(BaseModel):
    email: EmailStr = Field(..., description="Email address")
    password: str = Field(..., description="Password")

# Response schemas
class CompanyResponse(BaseModel):
    id: str
    company_code: str
    legal_name: str
    trade_name: Optional[str]
    display_name: Optional[str]
    primary_email: str
    primary_phone: Optional[str]
    status: str
    created_at: datetime
    
    class Config:
        from_attributes = True

class UserResponse(BaseModel):
    id: str
    company_id: str
    full_name: str
    username: str
    email: str
    phone: Optional[str]
    role: str
    status: str
    is_email_verified: bool
    last_login_at: Optional[datetime]
    created_at: datetime
    
    class Config:
        from_attributes = True

class SignupResponse(BaseModel):
    success: bool
    message: str
    data: Dict[str, Any]

class LoginResponse(BaseModel):
    success: bool
    message: str
    data: Dict[str, Any]

class ErrorResponse(BaseModel):
    success: bool = False
    message: str
    error_code: Optional[str] = None
    details: Optional[Dict[str, Any]] = None
