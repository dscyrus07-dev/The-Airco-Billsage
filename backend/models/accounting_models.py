"""
Accounting and Financial SQLAlchemy Models

Models for chart of accounts, ledger entries, financial years, and cost centres.
All models follow the exact schema.sql structure.
"""

from sqlalchemy import (
    Column, String, Text, Boolean, TIMESTAMP, Numeric, Date,
    ForeignKey, CheckConstraint, UniqueConstraint, Index
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import uuid

from .product_models import Base


class AccountGroup(Base):
    """Chart of Accounts Groups"""
    __tablename__ = 'account_groups'
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    company_id = Column(UUID(as_uuid=True), ForeignKey('companies.id', ondelete='CASCADE'), nullable=False)
    parent_id = Column(UUID(as_uuid=True), ForeignKey('account_groups.id'), nullable=True)
    name = Column(String(255), nullable=False)
    nature = Column(String(20), nullable=False)
    is_system = Column(Boolean, nullable=False, default=False)  # system groups cannot be deleted
    created_at = Column(TIMESTAMP(timezone=True), nullable=False, server_default=func.now())
    updated_at = Column(TIMESTAMP(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now())
    
    # Relationships
    company = relationship("Company")
    parent = relationship("AccountGroup", remote_side=[id])
    children = relationship("AccountGroup", back_populates="parent")
    accounts = relationship("Account", back_populates="account_group")
    
    __table_args__ = (
        CheckConstraint("nature IN ('assets','liabilities','income','expense','equity')", name='account_groups_nature_check'),
        UniqueConstraint('company_id', 'name', name='uq_account_groups_company_name'),
        Index('idx_account_groups_company_id', 'company_id'),
        Index('idx_account_groups_parent_id', 'parent_id'),
    )


class Account(Base):
    """Individual Ledger Accounts"""
    __tablename__ = 'accounts'
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    company_id = Column(UUID(as_uuid=True), ForeignKey('companies.id', ondelete='CASCADE'), nullable=False)
    group_id = Column(UUID(as_uuid=True), ForeignKey('account_groups.id'), nullable=False)
    account_code = Column(String(30), nullable=False)
    account_name = Column(String(255), nullable=False)
    nature = Column(String(20), nullable=False)
    is_system = Column(Boolean, nullable=False, default=False)
    is_active = Column(Boolean, nullable=False, default=True)
    opening_balance = Column(Numeric(18, 2), nullable=False, default=0)
    opening_balance_type = Column(String(5), nullable=True)
    party_id = Column(UUID(as_uuid=True), ForeignKey('parties.id'), nullable=True)  # if account is linked to a party
    notes = Column(Text, nullable=True)
    created_by = Column(UUID(as_uuid=True), nullable=True)
    updated_by = Column(UUID(as_uuid=True), nullable=True)
    created_at = Column(TIMESTAMP(timezone=True), nullable=False, server_default=func.now())
    updated_at = Column(TIMESTAMP(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now())
    deleted_at = Column(TIMESTAMP(timezone=True), nullable=True)
    
    # Relationships
    company = relationship("Company", back_populates="accounts")
    account_group = relationship("AccountGroup", back_populates="accounts")
    party = relationship("Party")
    ledger_entries = relationship("LedgerEntry", back_populates="account")
    voucher_items = relationship("VoucherItem", back_populates="account")
    voucher_charges = relationship("VoucherCharge", back_populates="account")
    payment_details = relationship("PaymentDetail", back_populates="payment_account")
    bank_account = relationship("BankAccount", back_populates="account")
    products_sales_account = relationship("Product", foreign_keys="Product.sales_account_id")
    products_purchase_account = relationship("Product", foreign_keys="Product.purchase_account_id")
    products_stock_account = relationship("Product", foreign_keys="Product.stock_account_id")
    
    __table_args__ = (
        CheckConstraint("nature IN ('assets','liabilities','income','expense','equity')", name='accounts_nature_check'),
        CheckConstraint("opening_balance_type IN ('dr','cr')", name='accounts_balance_type_check'),
        UniqueConstraint('company_id', 'account_code', name='uq_accounts_company_code'),
        UniqueConstraint('company_id', 'account_name', name='uq_accounts_company_name'),
        Index('idx_accounts_company_id', 'company_id'),
        Index('idx_accounts_group_id', 'group_id'),
        Index('idx_accounts_party_id', 'party_id'),
        Index('idx_accounts_deleted_at', 'deleted_at'),
    )


class LedgerEntry(Base):
    """Double-Entry Ledger Transactions"""
    __tablename__ = 'ledger_entries'
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    company_id = Column(UUID(as_uuid=True), ForeignKey('companies.id', ondelete='RESTRICT'), nullable=False)
    voucher_id = Column(UUID(as_uuid=True), ForeignKey('vouchers.id', ondelete='RESTRICT'), nullable=False)
    account_id = Column(UUID(as_uuid=True), ForeignKey('accounts.id'), nullable=False)
    entry_date = Column(Date, nullable=False)
    dr_amount = Column(Numeric(18, 2), nullable=False, default=0)
    cr_amount = Column(Numeric(18, 2), nullable=False, default=0)
    narration = Column(Text, nullable=True)
    cost_centre_id = Column(UUID(as_uuid=True), ForeignKey('cost_centres.id'), nullable=True)
    created_at = Column(TIMESTAMP(timezone=True), nullable=False, server_default=func.now())
    
    # Relationships
    company = relationship("Company")
    voucher = relationship("Voucher", back_populates="ledger_entries")
    account = relationship("Account", back_populates="ledger_entries")
    cost_centre = relationship("CostCentre")
    
    __table_args__ = (
        CheckConstraint("dr_amount >= 0", name='ledger_dr_amount_check'),
        CheckConstraint("cr_amount >= 0", name='ledger_cr_amount_check'),
        CheckConstraint("(dr_amount > 0 AND cr_amount = 0) OR (cr_amount > 0 AND dr_amount = 0)", name='chk_ledger_one_side'),
        Index('idx_ledger_entries_company_id', 'company_id'),
        Index('idx_ledger_entries_voucher_id', 'voucher_id'),
        Index('idx_ledger_entries_account_id', 'account_id'),
        Index('idx_ledger_entries_entry_date', 'entry_date'),
        Index('idx_ledger_entries_account_date', 'account_id', 'entry_date'),
    )


class FinancialYear(Base):
    """Financial Year Management"""
    __tablename__ = 'financial_years'
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    company_id = Column(UUID(as_uuid=True), ForeignKey('companies.id', ondelete='CASCADE'), nullable=False)
    fy_label = Column(String(20), nullable=False)  # e.g. '2024-25'
    start_date = Column(Date, nullable=False)
    end_date = Column(Date, nullable=False)
    is_current = Column(Boolean, nullable=False, default=False)
    is_locked = Column(Boolean, nullable=False, default=False)  # locked after GST filing
    created_at = Column(TIMESTAMP(timezone=True), nullable=False, server_default=func.now())
    
    # Relationships
    company = relationship("Company")
    vouchers = relationship("Voucher", back_populates="financial_year")
    gst_output_entries = relationship("GSTOutputEntry", back_populates="financial_year")
    gst_input_entries = relationship("GSTInputEntry", back_populates="financial_year")
    gstr3b_summaries = relationship("GSTR3BSummary", back_populates="financial_year")
    
    __table_args__ = (
        CheckConstraint("end_date > start_date", name='chk_fy_dates'),
        UniqueConstraint('company_id', 'fy_label', name='uq_fy_company_label'),
        Index('idx_financial_years_company_id', 'company_id'),
    )


class DocumentSequence(Base):
    """Document Numbering Sequences per Type per FY"""
    __tablename__ = 'document_sequences'
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    company_id = Column(UUID(as_uuid=True), ForeignKey('companies.id', ondelete='CASCADE'), nullable=False)
    fy_id = Column(UUID(as_uuid=True), ForeignKey('financial_years.id'), nullable=False)
    doc_type = Column(String(30), nullable=False)  # 'invoice','credit_note','purchase','payment','receipt','po','dn'
    prefix = Column(String(20), nullable=False)
    suffix = Column(String(20), nullable=True)
    current_number = Column(String(10), nullable=False, default=0)  # Using String to avoid INT issues
    padding_length = Column(String(2), nullable=False, default='4')  # Using String to avoid SMALLINT issues
    created_at = Column(TIMESTAMP(timezone=True), nullable=False, server_default=func.now())
    updated_at = Column(TIMESTAMP(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now())
    
    # Relationships
    company = relationship("Company")
    financial_year = relationship("FinancialYear")
    
    __table_args__ = (
        UniqueConstraint('company_id', 'fy_id', 'doc_type', name='uq_doc_sequences_company_fy_type'),
    )


class CostCentre(Base):
    """Cost Centres for Analytics"""
    __tablename__ = 'cost_centres'
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    company_id = Column(UUID(as_uuid=True), ForeignKey('companies.id', ondelete='CASCADE'), nullable=False)
    parent_id = Column(UUID(as_uuid=True), ForeignKey('cost_centres.id'), nullable=True)
    cc_code = Column(String(30), nullable=False)
    cc_name = Column(String(255), nullable=False)
    is_active = Column(Boolean, nullable=False, default=True)
    created_at = Column(TIMESTAMP(timezone=True), nullable=False, server_default=func.now())
    updated_at = Column(TIMESTAMP(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now())
    
    # Relationships
    company = relationship("Company")
    parent = relationship("CostCentre", remote_side=[id])
    children = relationship("CostCentre", back_populates="parent")
    vouchers = relationship("Voucher", back_populates="cost_centre")
    voucher_items = relationship("VoucherItem", back_populates="cost_centre")
    ledger_entries = relationship("LedgerEntry", back_populates="cost_centre")
    
    __table_args__ = (
        UniqueConstraint('company_id', 'cc_code', name='uq_cost_centres_company_code'),
    )
