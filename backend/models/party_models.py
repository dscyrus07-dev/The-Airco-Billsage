"""
Party SQLAlchemy Models

Models for unified vendor/customer management with GST compliance.
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


class Party(Base):
    """Unified Vendor/Customer Management"""
    __tablename__ = 'parties'
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    company_id = Column(UUID(as_uuid=True), ForeignKey('companies.id', ondelete='CASCADE'), nullable=False)
    party_code = Column(String(30), nullable=False)
    party_name = Column(String(255), nullable=False)
    display_name = Column(String(255), nullable=True)
    is_supplier = Column(Boolean, nullable=False, default=False)
    is_customer = Column(Boolean, nullable=False, default=False)
    party_category = Column(String(30), nullable=False, default='business')
    status = Column(String(20), nullable=False, default='active')
    email = Column(String(255), nullable=True)
    phone = Column(String(20), nullable=True)
    alternate_phone = Column(String(20), nullable=True)
    website = Column(String(255), nullable=True)
    address = Column(String(500), nullable=True)
    state = Column(String(50), nullable=True)
    pin_code = Column(String(6), nullable=True)
    gstin = Column(String(20), nullable=True)
    pan = Column(String(20), nullable=True)
    cin = Column(String(30), nullable=True)
    tan = Column(String(20), nullable=True)
    credit_limit = Column(Numeric(18, 2), nullable=False, default=0)
    payment_terms_days = Column(Numeric(10, 0), nullable=False, default=0)
    opening_balance = Column(Numeric(18, 2), nullable=False, default=0)
    opening_balance_type = Column(String(10), nullable=True)
    notes = Column(Text, nullable=True)
    created_by = Column(UUID(as_uuid=True), nullable=True)
    updated_by = Column(UUID(as_uuid=True), nullable=True)
    created_at = Column(TIMESTAMP(timezone=True), nullable=False, server_default=func.now())
    updated_at = Column(TIMESTAMP(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now())
    deleted_at = Column(TIMESTAMP(timezone=True), nullable=True)
    
    # Relationships
    company = relationship("Company", back_populates="parties")
    addresses = relationship("PartyAddress", back_populates="party", cascade="all, delete-orphan")
    contacts = relationship("PartyContact", back_populates="party", cascade="all, delete-orphan")
    bank_accounts = relationship("PartyBankAccount", back_populates="party", cascade="all, delete-orphan")
    vouchers_as_party = relationship("Voucher", back_populates="party")
    
    __table_args__ = (
        CheckConstraint("party_category IN ('business','individual')", name='parties_category_check'),
        CheckConstraint("status IN ('active','inactive','blocked')", name='parties_status_check'),
        CheckConstraint("opening_balance_type IN ('dr','cr')", name='parties_balance_type_check'),
        CheckConstraint("is_supplier = TRUE OR is_customer = TRUE", name='chk_parties_type'),
        UniqueConstraint('company_id', 'party_code', name='uq_parties_company_code'),
        UniqueConstraint('company_id', 'gstin', name='uq_parties_company_gstin'),
        UniqueConstraint('company_id', 'pan', name='uq_parties_company_pan'),
        Index('idx_parties_company_id', 'company_id'),
        Index('idx_parties_party_name', 'party_name'),
        Index('idx_parties_status', 'status'),
        Index('idx_parties_is_supplier', 'is_supplier'),
        Index('idx_parties_is_customer', 'is_customer'),
        Index('idx_parties_deleted_at', 'deleted_at'),
    )


class PartyAddress(Base):
    """Party Address Information"""
    __tablename__ = 'party_addresses'
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    party_id = Column(UUID(as_uuid=True), ForeignKey('parties.id', ondelete='CASCADE'), nullable=False)
    address_type = Column(String(20), nullable=False)
    address_line_1 = Column(String(255), nullable=True)
    address_line_2 = Column(String(255), nullable=True)
    landmark = Column(String(255), nullable=True)
    city = Column(String(100), nullable=True)
    district = Column(String(100), nullable=True)
    state = Column(String(100), nullable=True)
    country = Column(String(100), nullable=False, default='India')
    postal_code = Column(String(20), nullable=True)
    is_primary = Column(Boolean, nullable=False, default=False)
    created_at = Column(TIMESTAMP(timezone=True), nullable=False, server_default=func.now())
    updated_at = Column(TIMESTAMP(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now())
    
    # Relationships
    party = relationship("Party", back_populates="addresses")
    
    __table_args__ = (
        CheckConstraint("address_type IN ('billing','shipping','registered','office','other')", name='party_addresses_type_check'),
        Index('idx_party_addresses_party_id', 'party_id'),
    )


class PartyContact(Base):
    """Party Contact Persons"""
    __tablename__ = 'party_contacts'
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    party_id = Column(UUID(as_uuid=True), ForeignKey('parties.id', ondelete='CASCADE'), nullable=False)
    contact_name = Column(String(255), nullable=False)
    designation = Column(String(100), nullable=True)
    department = Column(String(100), nullable=True)
    email = Column(String(255), nullable=True)
    phone = Column(String(20), nullable=True)
    alternate_phone = Column(String(20), nullable=True)
    is_primary = Column(Boolean, nullable=False, default=False)
    is_active = Column(Boolean, nullable=False, default=True)
    created_at = Column(TIMESTAMP(timezone=True), nullable=False, server_default=func.now())
    updated_at = Column(TIMESTAMP(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now())
    
    # Relationships
    party = relationship("Party", back_populates="contacts")
    
    __table_args__ = (
        Index('idx_party_contacts_party_id', 'party_id'),
    )


class PartyBankAccount(Base):
    """Party Bank Account Details"""
    __tablename__ = 'party_bank_accounts'
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    party_id = Column(UUID(as_uuid=True), ForeignKey('parties.id', ondelete='CASCADE'), nullable=False)
    account_holder_name = Column(String(255), nullable=True)
    bank_name = Column(String(255), nullable=True)
    branch_name = Column(String(255), nullable=True)
    account_number_encrypted = Column(Text, nullable=True)
    account_number_masked = Column(String(30), nullable=True)
    ifsc_code = Column(String(20), nullable=True)
    upi_id = Column(String(100), nullable=True)
    is_primary = Column(Boolean, nullable=False, default=False)
    is_active = Column(Boolean, nullable=False, default=True)
    created_at = Column(TIMESTAMP(timezone=True), nullable=False, server_default=func.now())
    updated_at = Column(TIMESTAMP(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now())
    
    # Relationships
    party = relationship("Party", back_populates="bank_accounts")
    
    __table_args__ = (
        Index('idx_party_bank_accounts_party_id', 'party_id'),
    )
