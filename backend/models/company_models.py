"""
Company and User SQLAlchemy Models

Models for multi-tenant company management and user authentication.
All models follow the exact schema.sql structure.
"""

from sqlalchemy import (
    Column, String, Text, Boolean, TIMESTAMP, Numeric, Date,
    ForeignKey, CheckConstraint, UniqueConstraint, Index
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
import uuid

# Import Base from product_models to use the same declarative base
from .product_models import Base


class Company(Base):
    """Multi-tenant Company Management"""
    __tablename__ = 'companies'
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    company_code = Column(String(30), nullable=False, unique=True)
    legal_name = Column(String(255), nullable=False)
    trade_name = Column(String(255), nullable=True)
    display_name = Column(String(255), nullable=True)
    primary_email = Column(String(255), nullable=True)
    primary_phone = Column(String(20), nullable=True)
    logo_url = Column(Text, nullable=True)
    status = Column(String(20), nullable=False, default='active')
    base_currency = Column(String(3), nullable=False, default='INR')
    timezone = Column(String(100), nullable=False, default='Asia/Kolkata')
    is_active = Column(Boolean, nullable=False, default=True)
    created_by = Column(UUID(as_uuid=True), nullable=True)
    updated_by = Column(UUID(as_uuid=True), nullable=True)
    created_at = Column(TIMESTAMP(timezone=True), nullable=False, server_default=func.now())
    updated_at = Column(TIMESTAMP(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now())
    deleted_at = Column(TIMESTAMP(timezone=True), nullable=True)
    
    # Relationships
    company_details = relationship("CompanyDetails", back_populates="company", uselist=False)
    company_settings = relationship("CompanySettings", back_populates="company", uselist=False)
    users = relationship("User", back_populates="company")
    parties = relationship("Party", back_populates="company")
    products = relationship("Product", back_populates="company")
    vouchers = relationship("Voucher", back_populates="company")
    accounts = relationship("Account", back_populates="company")
    bank_accounts = relationship("BankAccount", back_populates="company")
    
    __table_args__ = (
        CheckConstraint("status IN ('active','inactive','suspended')", name='companies_status_check'),
        Index('idx_companies_legal_name', 'legal_name'),
        Index('idx_companies_status', 'status'),
        Index('idx_companies_deleted_at', 'deleted_at'),
    )


class CompanyDetails(Base):
    """Extended Company Information"""
    __tablename__ = 'company_details'
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    company_id = Column(UUID(as_uuid=True), ForeignKey('companies.id', ondelete='CASCADE'), nullable=False, unique=True)
    address_line_1 = Column(String(255), nullable=True)
    address_line_2 = Column(String(255), nullable=True)
    landmark = Column(String(255), nullable=True)
    city = Column(String(100), nullable=True)
    district = Column(String(100), nullable=True)
    state = Column(String(100), nullable=True)
    country = Column(String(100), nullable=False, default='India')
    postal_code = Column(String(20), nullable=True)
    pan = Column(String(20), nullable=True)
    gstin = Column(String(20), nullable=True)
    cin = Column(String(30), nullable=True)
    tan = Column(String(20), nullable=True)
    bank_account_name = Column(String(255), nullable=True)
    bank_name = Column(String(255), nullable=True)
    bank_branch = Column(String(255), nullable=True)
    bank_account_number_encrypted = Column(Text, nullable=True)
    bank_account_number_masked = Column(String(30), nullable=True)
    ifsc_code = Column(String(20), nullable=True)
    upi_id = Column(String(100), nullable=True)
    billing_email = Column(String(255), nullable=True)
    support_email = Column(String(255), nullable=True)
    alternate_phone = Column(String(20), nullable=True)
    website = Column(String(255), nullable=True)
    financial_year_start_month = Column(String(2), nullable=False, default='4')
    invoice_prefix = Column(String(20), nullable=True, default='INV')
    credit_note_prefix = Column(String(20), nullable=True, default='CN')
    debit_note_prefix = Column(String(20), nullable=True, default='DN')
    payment_prefix = Column(String(20), nullable=True, default='PAY')
    receipt_prefix = Column(String(20), nullable=True, default='REC')
    po_prefix = Column(String(20), nullable=True, default='PO')
    created_at = Column(TIMESTAMP(timezone=True), nullable=False, server_default=func.now())
    updated_at = Column(TIMESTAMP(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now())
    
    # Relationships
    company = relationship("Company", back_populates="company_details")
    
    __table_args__ = (
        CheckConstraint("financial_year_start_month BETWEEN 1 AND 12", name='company_details_fy_start_check'),
        UniqueConstraint('pan', name='uq_cd_pan'),
        UniqueConstraint('gstin', name='uq_cd_gstin'),
        UniqueConstraint('cin', name='uq_cd_cin'),
        Index('idx_company_details_company_id', 'company_id'),
    )


class CompanySettings(Base):
    """Company Preferences and Settings"""
    __tablename__ = 'company_settings'
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    company_id = Column(UUID(as_uuid=True), ForeignKey('companies.id', ondelete='CASCADE'), nullable=False, unique=True)
    # Notification Settings
    notification_duplicate_invoice = Column(Boolean, nullable=False, default=True)
    notification_gst_mismatch = Column(Boolean, nullable=False, default=True)
    notification_overdue_receivable = Column(Boolean, nullable=False, default=True)
    notification_overdue_payable = Column(Boolean, nullable=False, default=True)
    notification_concentration_risk = Column(Boolean, nullable=False, default=True)
    notification_gstr_reminders = Column(Boolean, nullable=False, default=True)
    # Audit Settings
    lock_after_approval = Column(Boolean, nullable=False, default=False)
    dual_approval = Column(Boolean, nullable=False, default=False)
    dual_approval_threshold = Column(Numeric(18, 2), nullable=False, default=0)
    created_at = Column(TIMESTAMP(timezone=True), nullable=False, server_default=func.now())
    updated_at = Column(TIMESTAMP(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now())
    
    # Relationships
    company = relationship("Company", back_populates="company_settings")
    
    __table_args__ = (
        Index('idx_company_settings_company_id', 'company_id'),
    )


class User(Base):
    """User Management"""
    __tablename__ = 'users'
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    company_id = Column(UUID(as_uuid=True), ForeignKey('companies.id', ondelete='CASCADE'), nullable=False)
    full_name = Column(String(255), nullable=False)
    username = Column(String(100), nullable=False)
    email = Column(String(255), nullable=False)
    phone = Column(String(20), nullable=True)
    password_hash = Column(Text, nullable=False)
    role = Column(String(50), nullable=False)
    status = Column(String(20), nullable=False, default='active')
    is_email_verified = Column(Boolean, nullable=False, default=False)
    is_phone_verified = Column(Boolean, nullable=False, default=False)
    must_change_password = Column(Boolean, nullable=False, default=False)
    failed_login_attempts = Column(String(10), nullable=False, default=0)  # Using String to avoid INT constraint issues
    locked_until = Column(TIMESTAMP(timezone=True), nullable=True)
    last_login_at = Column(TIMESTAMP(timezone=True), nullable=True)
    last_password_changed_at = Column(TIMESTAMP(timezone=True), nullable=True)
    created_by = Column(UUID(as_uuid=True), nullable=True)
    updated_by = Column(UUID(as_uuid=True), nullable=True)
    created_at = Column(TIMESTAMP(timezone=True), nullable=False, server_default=func.now())
    updated_at = Column(TIMESTAMP(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now())
    deleted_at = Column(TIMESTAMP(timezone=True), nullable=True)
    
    # Relationships
    company = relationship("Company", back_populates="users")
    user_sessions = relationship("UserSession", back_populates="user")
    
    __table_args__ = (
        CheckConstraint("role IN ('super_admin','admin','accountant','operator','viewer')", name='users_role_check'),
        CheckConstraint("status IN ('active','invited','suspended','disabled')", name='users_status_check'),
        UniqueConstraint('company_id', 'username', name='uq_users_company_username'),
        UniqueConstraint('company_id', 'email', name='uq_users_company_email'),
        Index('idx_users_company_id', 'company_id'),
        Index('idx_users_role', 'role'),
        Index('idx_users_status', 'status'),
        Index('idx_users_deleted_at', 'deleted_at'),
    )


class UserSession(Base):
    """User Session Management"""
    __tablename__ = 'user_sessions'
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey('users.id', ondelete='CASCADE'), nullable=False)
    company_id = Column(UUID(as_uuid=True), ForeignKey('companies.id', ondelete='CASCADE'), nullable=False)
    session_token_hash = Column(Text, nullable=False)
    refresh_token_hash = Column(Text, nullable=True)
    device_info = Column(Text, nullable=True)
    ip_address = Column(String(45), nullable=True)  # IPv6 compatible
    user_agent = Column(Text, nullable=True)
    issued_at = Column(TIMESTAMP(timezone=True), nullable=False, server_default=func.now())
    expires_at = Column(TIMESTAMP(timezone=True), nullable=False)
    revoked_at = Column(TIMESTAMP(timezone=True), nullable=True)
    last_seen_at = Column(TIMESTAMP(timezone=True), nullable=True)
    created_at = Column(TIMESTAMP(timezone=True), nullable=False, server_default=func.now())
    
    # Relationships
    user = relationship("User", back_populates="user_sessions")
    
    __table_args__ = (
        Index('idx_user_sessions_user_id', 'user_id'),
        Index('idx_user_sessions_company_id', 'company_id'),
        Index('idx_user_sessions_expires_at', 'expires_at'),
        Index('idx_user_sessions_revoked_at', 'revoked_at'),
    )
