"""
GST and TDS SQLAlchemy Models

Models for GST compliance, GSTR returns, and TDS management.
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


class GSTOutputEntry(Base):
    """GST Output Entries (GSTR-1) - Sales Tax Data"""
    __tablename__ = 'gst_output_entries'
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    company_id = Column(UUID(as_uuid=True), ForeignKey('companies.id', ondelete='CASCADE'), nullable=False)
    fy_id = Column(UUID(as_uuid=True), ForeignKey('financial_years.id'), nullable=False)
    voucher_id = Column(UUID(as_uuid=True), ForeignKey('vouchers.id', ondelete='CASCADE'), nullable=False)
    return_period = Column(String(7), nullable=False)  # 'MMYYYY'
    supply_type = Column(String(20), nullable=False)
    party_id = Column(UUID(as_uuid=True), ForeignKey('parties.id'), nullable=True)
    party_gstin = Column(String(20), nullable=True)
    invoice_date = Column(Date, nullable=False)
    invoice_number = Column(String(50), nullable=False)
    place_of_supply = Column(String(100), nullable=True)
    reverse_charge = Column(Boolean, nullable=False, default=False)
    hsn_sac_code = Column(String(20), nullable=True)
    description = Column(Text, nullable=True)
    uom_code = Column(String(20), nullable=True)
    quantity = Column(Numeric(18, 4), nullable=True)
    taxable_value = Column(Numeric(18, 2), nullable=False, default=0)
    igst_amount = Column(Numeric(18, 2), nullable=False, default=0)
    cgst_amount = Column(Numeric(18, 2), nullable=False, default=0)
    sgst_amount = Column(Numeric(18, 2), nullable=False, default=0)
    cess_amount = Column(Numeric(18, 2), nullable=False, default=0)
    gst_rate = Column(Numeric(6, 3), nullable=False, default=0)
    is_amended = Column(Boolean, nullable=False, default=False)
    amendment_period = Column(String(7), nullable=True)
    filing_status = Column(String(20), nullable=False, default='pending')
    filed_at = Column(TIMESTAMP(timezone=True), nullable=True)
    created_at = Column(TIMESTAMP(timezone=True), nullable=False, server_default=func.now())
    updated_at = Column(TIMESTAMP(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now())
    
    # Relationships
    company = relationship("Company")
    voucher = relationship("Voucher", back_populates="gst_output_entries")
    party = relationship("Party")
    
    __table_args__ = (
        CheckConstraint("supply_type IN ('B2B','B2C','B2CL','CDN','export','nil','exempt','SEZ')", name='gst_output_supply_type_check'),
        CheckConstraint("filing_status IN ('pending','filed','amended','cancelled')", name='gst_output_filing_status_check'),
        Index('idx_gst_output_company_id', 'company_id'),
        Index('idx_gst_output_return_period', 'return_period'),
        Index('idx_gst_output_party_gstin', 'party_gstin'),
        Index('idx_gst_output_voucher_id', 'voucher_id'),
        Index('idx_gst_output_supply_type', 'supply_type'),
        Index('idx_gst_output_hsn_sac', 'hsn_sac_code'),
    )


class GSTInputEntry(Base):
    """GST Input Entries (GSTR-2A/2B) - Purchase Tax Data"""
    __tablename__ = 'gst_input_entries'
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    company_id = Column(UUID(as_uuid=True), ForeignKey('companies.id', ondelete='CASCADE'), nullable=False)
    fy_id = Column(UUID(as_uuid=True), ForeignKey('financial_years.id'), nullable=False)
    voucher_id = Column(UUID(as_uuid=True), ForeignKey('vouchers.id'), nullable=True)  # NULL if imported from portal
    return_period = Column(String(7), nullable=False)
    source = Column(String(20), nullable=False, default='manual')
    supplier_id = Column(UUID(as_uuid=True), ForeignKey('parties.id'), nullable=True)
    supplier_gstin = Column(String(20), nullable=False)
    supplier_name = Column(String(255), nullable=True)
    invoice_number = Column(String(100), nullable=False)
    invoice_date = Column(Date, nullable=False)
    invoice_value = Column(Numeric(18, 2), nullable=False, default=0)
    place_of_supply = Column(String(100), nullable=True)
    reverse_charge = Column(Boolean, nullable=False, default=False)
    hsn_sac_code = Column(String(20), nullable=True)
    taxable_value = Column(Numeric(18, 2), nullable=False, default=0)
    igst_amount = Column(Numeric(18, 2), nullable=False, default=0)
    cgst_amount = Column(Numeric(18, 2), nullable=False, default=0)
    sgst_amount = Column(Numeric(18, 2), nullable=False, default=0)
    cess_amount = Column(Numeric(18, 2), nullable=False, default=0)
    gst_rate = Column(Numeric(6, 3), nullable=False, default=0)
    itc_eligibility = Column(String(20), nullable=False, default='eligible')
    itc_availed = Column(Boolean, nullable=False, default=False)
    itc_availed_period = Column(String(7), nullable=True)
    match_status = Column(String(20), nullable=False, default='unmatched')
    matched_entry_id = Column(UUID(as_uuid=True), ForeignKey('gst_output_entries.id'), nullable=True)
    filing_status = Column(String(20), nullable=False, default='pending')
    filed_at = Column(TIMESTAMP(timezone=True), nullable=True)
    created_at = Column(TIMESTAMP(timezone=True), nullable=False, server_default=func.now())
    updated_at = Column(TIMESTAMP(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now())
    
    # Relationships
    company = relationship("Company")
    voucher = relationship("Voucher", back_populates="gst_input_entries")
    supplier = relationship("Party")
    matched_entry = relationship("GSTOutputEntry", foreign_keys=[matched_entry_id])
    
    __table_args__ = (
        CheckConstraint("source IN ('manual','gstr2a','gstr2b','import')", name='gst_input_source_check'),
        CheckConstraint("itc_eligibility IN ('eligible','ineligible','blocked','proportionate')", name='gst_input_itc_eligibility_check'),
        CheckConstraint("match_status IN ('matched','unmatched','mismatch','pending','amended')", name='gst_input_match_status_check'),
        CheckConstraint("filing_status IN ('pending','filed','amended','cancelled')", name='gst_input_filing_status_check'),
        Index('idx_gst_input_company_id', 'company_id'),
        Index('idx_gst_input_return_period', 'return_period'),
        Index('idx_gst_input_supplier_gstin', 'supplier_gstin'),
        Index('idx_gst_input_voucher_id', 'voucher_id'),
        Index('idx_gst_input_match_status', 'match_status'),
        Index('idx_gst_input_itc_eligibility', 'itc_eligibility'),
    )


class GSTR3BSummary(Base):
    """GSTR-3B Summary (Monthly Tax Payable/Paid)"""
    __tablename__ = 'gstr3b_summary'
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    company_id = Column(UUID(as_uuid=True), ForeignKey('companies.id', ondelete='CASCADE'), nullable=False)
    fy_id = Column(UUID(as_uuid=True), ForeignKey('financial_years.id'), nullable=False)
    return_period = Column(String(7), nullable=False)
    
    # Outward supplies
    out_taxable_igst = Column(Numeric(18, 2), nullable=False, default=0)
    out_taxable_cgst = Column(Numeric(18, 2), nullable=False, default=0)
    out_taxable_sgst = Column(Numeric(18, 2), nullable=False, default=0)
    out_nil_exempt = Column(Numeric(18, 2), nullable=False, default=0)
    
    # ITC
    itc_igst = Column(Numeric(18, 2), nullable=False, default=0)
    itc_cgst = Column(Numeric(18, 2), nullable=False, default=0)
    itc_sgst = Column(Numeric(18, 2), nullable=False, default=0)
    itc_cess = Column(Numeric(18, 2), nullable=False, default=0)
    
    # Net payable
    net_igst_payable = Column(Numeric(18, 2), nullable=False, default=0)
    net_cgst_payable = Column(Numeric(18, 2), nullable=False, default=0)
    net_sgst_payable = Column(Numeric(18, 2), nullable=False, default=0)
    
    # Challan / payment
    paid_by_itc_igst = Column(Numeric(18, 2), nullable=False, default=0)
    paid_by_itc_cgst = Column(Numeric(18, 2), nullable=False, default=0)
    paid_by_itc_sgst = Column(Numeric(18, 2), nullable=False, default=0)
    paid_by_cash_igst = Column(Numeric(18, 2), nullable=False, default=0)
    paid_by_cash_cgst = Column(Numeric(18, 2), nullable=False, default=0)
    paid_by_cash_sgst = Column(Numeric(18, 2), nullable=False, default=0)
    
    interest_amount = Column(Numeric(18, 2), nullable=False, default=0)
    late_fee_amount = Column(Numeric(18, 2), nullable=False, default=0)
    
    filing_status = Column(String(20), nullable=False, default='pending')
    filed_at = Column(TIMESTAMP(timezone=True), nullable=True)
    arn = Column(String(100), nullable=True)  # Acknowledgement Reference Number
    
    created_at = Column(TIMESTAMP(timezone=True), nullable=False, server_default=func.now())
    updated_at = Column(TIMESTAMP(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now())
    
    # Relationships
    company = relationship("Company")
    
    __table_args__ = (
        CheckConstraint("filing_status IN ('pending','filed','revised')", name='gstr3b_filing_status_check'),
        UniqueConstraint('company_id', 'return_period', name='uq_gstr3b_company_period'),
    )


class TDSSection(Base):
    """TDS Section Configurations"""
    __tablename__ = 'tds_sections'
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    company_id = Column(UUID(as_uuid=True), ForeignKey('companies.id', ondelete='CASCADE'), nullable=False)
    section_code = Column(String(20), nullable=False)  # e.g. '194C', '194J'
    description = Column(String(255), nullable=True)
    rate_individual = Column(Numeric(6, 3), nullable=False, default=0)
    rate_company = Column(Numeric(6, 3), nullable=False, default=0)
    threshold_limit = Column(Numeric(18, 2), nullable=False, default=0)
    is_active = Column(Boolean, nullable=False, default=True)
    created_at = Column(TIMESTAMP(timezone=True), nullable=False, server_default=func.now())
    
    # Relationships
    company = relationship("Company")
    tds_entries = relationship("TDSEntry", back_populates="section")
    
    __table_args__ = (
        UniqueConstraint('company_id', 'section_code', name='uq_tds_sections_company_code'),
    )


class TDSEntry(Base):
    """TDS Deduction Entries"""
    __tablename__ = 'tds_entries'
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    company_id = Column(UUID(as_uuid=True), ForeignKey('companies.id', ondelete='CASCADE'), nullable=False)
    voucher_id = Column(UUID(as_uuid=True), ForeignKey('vouchers.id', ondelete='CASCADE'), nullable=False)
    section_id = Column(UUID(as_uuid=True), ForeignKey('tds_sections.id'), nullable=False)
    party_id = Column(UUID(as_uuid=True), ForeignKey('parties.id'), nullable=False)
    base_amount = Column(Numeric(18, 2), nullable=False)
    tds_rate = Column(Numeric(6, 3), nullable=False)
    tds_amount = Column(Numeric(18, 2), nullable=False)
    tds_account_id = Column(UUID(as_uuid=True), ForeignKey('accounts.id'), nullable=True)
    deducted_at = Column(Date, nullable=False)
    deposited_at = Column(Date, nullable=True)
    challan_number = Column(String(100), nullable=True)
    created_at = Column(TIMESTAMP(timezone=True), nullable=False, server_default=func.now())
    
    # Relationships
    company = relationship("Company")
    voucher = relationship("Voucher")
    section = relationship("TDSSection", back_populates="tds_entries")
    party = relationship("Party")
    tds_account = relationship("Account")
    
    __table_args__ = (
        Index('idx_tds_entries_company_id', 'company_id'),
        Index('idx_tds_entries_voucher_id', 'voucher_id'),
        Index('idx_tds_entries_party_id', 'party_id'),
    )
