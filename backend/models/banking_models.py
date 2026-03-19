"""
Banking and Support SQLAlchemy Models

Models for bank accounts, bank statements, audit logs, notifications, and report snapshots.
All models follow the exact schema.sql structure.
"""

from sqlalchemy import (
    Column, String, Text, Boolean, TIMESTAMP, Numeric, Date,
    ForeignKey, CheckConstraint, UniqueConstraint, Index
)
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import uuid

from .product_models import Base


class BankAccount(Base):
    """Bank Account Management"""
    __tablename__ = 'bank_accounts'
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    company_id = Column(UUID(as_uuid=True), ForeignKey('companies.id', ondelete='CASCADE'), nullable=False)
    account_id = Column(UUID(as_uuid=True), ForeignKey('accounts.id'), nullable=False, unique=True)  # links to ledger account
    bank_name = Column(String(255), nullable=False)
    branch_name = Column(String(255), nullable=True)
    account_number_encrypted = Column(Text, nullable=True)
    account_number_masked = Column(String(30), nullable=True)
    ifsc_code = Column(String(20), nullable=True)
    account_type = Column(String(20), nullable=False, default='current')
    opening_balance = Column(Numeric(18, 2), nullable=False, default=0)
    is_active = Column(Boolean, nullable=False, default=True)
    created_at = Column(TIMESTAMP(timezone=True), nullable=False, server_default=func.now())
    updated_at = Column(TIMESTAMP(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now())
    
    # Relationships
    company = relationship("Company", back_populates="bank_accounts")
    account = relationship("Account", back_populates="bank_account")
    bank_statements = relationship("BankStatement", back_populates="bank_account")
    payment_details = relationship("PaymentDetail", back_populates="payment_account")
    
    __table_args__ = (
        CheckConstraint("account_type IN ('current','savings','overdraft','cc')", name='bank_accounts_type_check'),
        Index('idx_bank_accounts_company_id', 'company_id'),
    )


class BankStatement(Base):
    """Bank Statement Records for Reconciliation"""
    __tablename__ = 'bank_statements'
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    bank_account_id = Column(UUID(as_uuid=True), ForeignKey('bank_accounts.id', ondelete='CASCADE'), nullable=False)
    transaction_date = Column(Date, nullable=False)
    value_date = Column(Date, nullable=True)
    description = Column(Text, nullable=True)
    ref_number = Column(String(100), nullable=True)
    debit_amount = Column(Numeric(18, 2), nullable=False, default=0)
    credit_amount = Column(Numeric(18, 2), nullable=False, default=0)
    closing_balance = Column(Numeric(18, 2), nullable=True)
    reconciliation_status = Column(String(20), nullable=False, default='unreconciled')
    ledger_entry_id = Column(UUID(as_uuid=True), ForeignKey('ledger_entries.id'), nullable=True)
    reconciled_by = Column(UUID(as_uuid=True), ForeignKey('users.id'), nullable=True)
    reconciled_at = Column(TIMESTAMP(timezone=True), nullable=True)
    import_batch_id = Column(UUID(as_uuid=True), nullable=True)
    created_at = Column(TIMESTAMP(timezone=True), nullable=False, server_default=func.now())
    
    # Relationships
    bank_account = relationship("BankAccount", back_populates="bank_statements")
    ledger_entry = relationship("LedgerEntry")
    reconciler = relationship("User", foreign_keys=[reconciled_by])
    
    __table_args__ = (
        CheckConstraint("reconciliation_status IN ('unreconciled','reconciled','ignored')", name='bank_statements_status_check'),
        Index('idx_bank_statements_bank_account_id', 'bank_account_id'),
        Index('idx_bank_statements_date', 'transaction_date'),
        Index('idx_bank_statements_status', 'reconciliation_status'),
    )


class AuditLog(Base):
    """Comprehensive Audit Trail"""
    __tablename__ = 'audit_log'
    
    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))  # Using String for BIGINT compatibility
    company_id = Column(UUID(as_uuid=True), nullable=True)
    user_id = Column(UUID(as_uuid=True), nullable=True)
    session_id = Column(UUID(as_uuid=True), nullable=True)
    action = Column(String(50), nullable=False)  # 'INSERT','UPDATE','DELETE','LOGIN','EXPORT', etc.
    table_name = Column(String(100), nullable=True)
    record_id = Column(UUID(as_uuid=True), nullable=True)
    old_data = Column(JSONB, nullable=True)
    new_data = Column(JSONB, nullable=True)
    diff = Column(JSONB, nullable=True)  # computed delta
    ip_address = Column(String(45), nullable=True)  # IPv6 compatible
    user_agent = Column(Text, nullable=True)
    occurred_at = Column(TIMESTAMP(timezone=True), nullable=False, server_default=func.now())
    
    # Relationships
    company = relationship("Company")
    user = relationship("User")
    session = relationship("UserSession")
    
    __table_args__ = (
        Index('idx_audit_log_company_id', 'company_id'),
        Index('idx_audit_log_user_id', 'user_id'),
        Index('idx_audit_log_table_name', 'table_name'),
        Index('idx_audit_log_record_id', 'record_id'),
        Index('idx_audit_log_occurred_at', 'occurred_at'),
        Index('idx_audit_log_new_data_gin', 'new_data', postgresql_using='gin'),
    )


class Notification(Base):
    """User Notifications and Alerts"""
    __tablename__ = 'notifications'
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    company_id = Column(UUID(as_uuid=True), ForeignKey('companies.id', ondelete='CASCADE'), nullable=False)
    user_id = Column(UUID(as_uuid=True), ForeignKey('users.id'), nullable=True)  # NULL = broadcast to all
    notification_type = Column(String(50), nullable=False)  # 'payment_due','gst_deadline','low_stock', etc.
    title = Column(String(255), nullable=False)
    body = Column(Text, nullable=True)
    reference_type = Column(String(50), nullable=True)  # 'voucher','party','product', etc.
    reference_id = Column(UUID(as_uuid=True), nullable=True)
    is_read = Column(Boolean, nullable=False, default=False)
    read_at = Column(TIMESTAMP(timezone=True), nullable=True)
    created_at = Column(TIMESTAMP(timezone=True), nullable=False, server_default=func.now())
    
    # Relationships
    company = relationship("Company")
    user = relationship("User")
    
    __table_args__ = (
        Index('idx_notifications_company_id', 'company_id'),
        Index('idx_notifications_user_id', 'user_id'),
        Index('idx_notifications_is_read', 'is_read'),
    )


class ReportSnapshot(Base):
    """Cached Report Storage"""
    __tablename__ = 'report_snapshots'
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    company_id = Column(UUID(as_uuid=True), ForeignKey('companies.id', ondelete='CASCADE'), nullable=False)
    report_type = Column(String(100), nullable=False)  # 'trial_balance','p&l','balance_sheet','gstr1', etc.
    fy_id = Column(UUID(as_uuid=True), ForeignKey('financial_years.id'), nullable=True)
    as_of_date = Column(Date, nullable=True)
    parameters = Column(JSONB, nullable=True)  # filters used to generate report
    snapshot_data = Column(JSONB, nullable=False)
    generated_by = Column(UUID(as_uuid=True), ForeignKey('users.id'), nullable=True)
    generated_at = Column(TIMESTAMP(timezone=True), nullable=False, server_default=func.now())
    expires_at = Column(TIMESTAMP(timezone=True), nullable=True)
    
    # Relationships
    company = relationship("Company")
    financial_year = relationship("FinancialYear")
    generator = relationship("User", foreign_keys=[generated_by])
    
    __table_args__ = (
        Index('idx_report_snapshots_company_id', 'company_id'),
        Index('idx_report_snapshots_type', 'report_type'),
    )
