"""
Voucher and Transaction SQLAlchemy Models

Models for central transaction table including sales, purchases, payments, and receipts.
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


class Voucher(Base):
    """Central Transaction Table - All Financial Events"""
    __tablename__ = 'vouchers'
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    company_id = Column(UUID(as_uuid=True), ForeignKey('companies.id', ondelete='RESTRICT'), nullable=False)
    fy_id = Column(UUID(as_uuid=True), ForeignKey('financial_years.id'), nullable=False)
    voucher_type = Column(String(30), nullable=False)
    voucher_number = Column(String(50), nullable=False)
    voucher_date = Column(Date, nullable=False)
    ref_number = Column(String(100), nullable=True)
    ref_date = Column(Date, nullable=True)
    party_id = Column(UUID(as_uuid=True), ForeignKey('parties.id'), nullable=True)
    billing_address_id = Column(UUID(as_uuid=True), ForeignKey('party_addresses.id'), nullable=True)
    shipping_address_id = Column(UUID(as_uuid=True), ForeignKey('party_addresses.id'), nullable=True)
    
    # Amounts (all in base currency)
    subtotal = Column(Numeric(18, 2), nullable=False, default=0)
    discount_amount = Column(Numeric(18, 2), nullable=False, default=0)
    taxable_amount = Column(Numeric(18, 2), nullable=False, default=0)
    cgst_amount = Column(Numeric(18, 2), nullable=False, default=0)
    sgst_amount = Column(Numeric(18, 2), nullable=False, default=0)
    igst_amount = Column(Numeric(18, 2), nullable=False, default=0)
    cess_amount = Column(Numeric(18, 2), nullable=False, default=0)
    tds_amount = Column(Numeric(18, 2), nullable=False, default=0)
    tcs_amount = Column(Numeric(18, 2), nullable=False, default=0)
    round_off = Column(Numeric(18, 2), nullable=False, default=0)
    total_amount = Column(Numeric(18, 2), nullable=False, default=0)
    paid_amount = Column(Numeric(18, 2), nullable=False, default=0)
    balance_amount = Column(Numeric(18, 2), nullable=False, server_default=func.now())  # Generated column
    
    # GST supply classification
    supply_type = Column(String(20), nullable=True)
    place_of_supply = Column(String(100), nullable=True)
    reverse_charge = Column(Boolean, nullable=False, default=False)
    
    # Workflow
    status = Column(String(20), nullable=False, default='draft')
    is_einvoice = Column(Boolean, nullable=False, default=False)
    irn = Column(String(100), nullable=True)
    ack_number = Column(String(100), nullable=True)
    ack_date = Column(TIMESTAMP(timezone=True), nullable=True)
    ewb_number = Column(String(100), nullable=True)
    ewb_date = Column(TIMESTAMP(timezone=True), nullable=True)
    ewb_valid_until = Column(TIMESTAMP(timezone=True), nullable=True)
    
    # Link for amendments / credit notes against original
    original_voucher_id = Column(UUID(as_uuid=True), ForeignKey('vouchers.id'), nullable=True)
    notes = Column(Text, nullable=True)
    terms_and_conditions = Column(Text, nullable=True)
    cost_centre_id = Column(UUID(as_uuid=True), ForeignKey('cost_centres.id'), nullable=True)
    
    created_by = Column(UUID(as_uuid=True), ForeignKey('users.id'), nullable=True)
    updated_by = Column(UUID(as_uuid=True), ForeignKey('users.id'), nullable=True)
    confirmed_by = Column(UUID(as_uuid=True), ForeignKey('users.id'), nullable=True)
    confirmed_at = Column(TIMESTAMP(timezone=True), nullable=True)
    cancelled_by = Column(UUID(as_uuid=True), ForeignKey('users.id'), nullable=True)
    cancelled_at = Column(TIMESTAMP(timezone=True), nullable=True)
    cancellation_reason = Column(Text, nullable=True)
    
    created_at = Column(TIMESTAMP(timezone=True), nullable=False, server_default=func.now())
    updated_at = Column(TIMESTAMP(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now())
    deleted_at = Column(TIMESTAMP(timezone=True), nullable=True)
    
    # Relationships
    company = relationship("Company", back_populates="vouchers")
    party = relationship("Party", back_populates="vouchers_as_party")
    billing_address = relationship("PartyAddress", foreign_keys=[billing_address_id])
    shipping_address = relationship("PartyAddress", foreign_keys=[shipping_address_id])
    items = relationship("VoucherItem", back_populates="voucher", cascade="all, delete-orphan")
    charges = relationship("VoucherCharge", back_populates="voucher", cascade="all, delete-orphan")
    payment_detail = relationship("PaymentDetail", back_populates="voucher", uselist=False)
    payment_allocations_as_payment = relationship("PaymentAllocation", foreign_keys="PaymentAllocation.payment_voucher_id")
    payment_allocations_as_invoice = relationship("PaymentAllocation", foreign_keys="PaymentAllocation.invoice_voucher_id")
    ledger_entries = relationship("LedgerEntry", back_populates="voucher")
    gst_output_entries = relationship("GSTOutputEntry", back_populates="voucher")
    gst_input_entries = relationship("GSTInputEntry", back_populates="voucher")
    purchase_order_fulfilments_as_po = relationship("PurchaseOrderFulfilment", foreign_keys="PurchaseOrderFulfilment.po_voucher_id")
    purchase_order_fulfilments_as_bill = relationship("PurchaseOrderFulfilment", foreign_keys="PurchaseOrderFulfilment.bill_voucher_id")
    
    __table_args__ = (
        CheckConstraint("voucher_type IN ('sale','purchase','credit_note','debit_note','payment','receipt','journal','contra','purchase_order','delivery_challan','proforma')", name='vouchers_type_check'),
        CheckConstraint("status IN ('draft','confirmed','cancelled','amended')", name='vouchers_status_check'),
        CheckConstraint("supply_type IN ('B2B','B2C','B2CL','export','SEZ','exempt','nil')", name='vouchers_supply_type_check'),
        UniqueConstraint('company_id', 'voucher_number', 'voucher_type', name='uq_vouchers_company_number'),
        Index('idx_vouchers_company_id', 'company_id'),
        Index('idx_vouchers_fy_id', 'fy_id'),
        Index('idx_vouchers_voucher_type', 'voucher_type'),
        Index('idx_vouchers_voucher_date', 'voucher_date'),
        Index('idx_vouchers_party_id', 'party_id'),
        Index('idx_vouchers_status', 'status'),
        Index('idx_vouchers_supply_type', 'supply_type'),
        Index('idx_vouchers_irn', 'irn'),
        Index('idx_vouchers_deleted_at', 'deleted_at'),
        Index('idx_vouchers_company_type_date', 'company_id', 'voucher_type', 'voucher_date'),
    )


class VoucherItem(Base):
    """Voucher Line Items"""
    __tablename__ = 'voucher_items'
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    voucher_id = Column(UUID(as_uuid=True), ForeignKey('vouchers.id', ondelete='CASCADE'), nullable=False)
    line_number = Column(String(10), nullable=False)  # Using String to avoid SMALLINT issues
    product_id = Column(UUID(as_uuid=True), ForeignKey('products.id'), nullable=True)
    description = Column(Text, nullable=False)
    hsn_sac_code = Column(String(20), nullable=True)
    uom_id = Column(UUID(as_uuid=True), ForeignKey('units_of_measure.id'), nullable=True)
    quantity = Column(Numeric(18, 4), nullable=False, default=0)
    rate = Column(Numeric(18, 4), nullable=False, default=0)
    gross_amount = Column(Numeric(18, 2), nullable=False, server_default=func.now())  # Generated column
    discount_pct = Column(Numeric(6, 3), nullable=False, default=0)
    discount_amount = Column(Numeric(18, 2), nullable=False, default=0)
    taxable_amount = Column(Numeric(18, 2), nullable=False, default=0)
    tax_rate_id = Column(UUID(as_uuid=True), ForeignKey('tax_rates.id'), nullable=True)
    cgst_rate = Column(Numeric(6, 3), nullable=False, default=0)
    cgst_amount = Column(Numeric(18, 2), nullable=False, default=0)
    sgst_rate = Column(Numeric(6, 3), nullable=False, default=0)
    sgst_amount = Column(Numeric(18, 2), nullable=False, default=0)
    igst_rate = Column(Numeric(6, 3), nullable=False, default=0)
    igst_amount = Column(Numeric(18, 2), nullable=False, default=0)
    cess_rate = Column(Numeric(6, 3), nullable=False, default=0)
    cess_amount = Column(Numeric(18, 2), nullable=False, default=0)
    line_total = Column(Numeric(18, 2), nullable=False, default=0)
    
    # Account override (if different from product default)
    account_id = Column(UUID(as_uuid=True), ForeignKey('accounts.id'), nullable=True)
    cost_centre_id = Column(UUID(as_uuid=True), ForeignKey('cost_centres.id'), nullable=True)
    batch_number = Column(String(100), nullable=True)
    serial_numbers = Column(Text, nullable=True)  # Stored as JSON array
    expiry_date = Column(Date, nullable=True)
    created_at = Column(TIMESTAMP(timezone=True), nullable=False, server_default=func.now())
    
    # Relationships
    voucher = relationship("Voucher", back_populates="items")
    product = relationship("Product", back_populates="voucher_items")
    tax_rate = relationship("TaxRate")
    uom = relationship("UnitOfMeasure")
    account = relationship("Account")
    cost_centre = relationship("CostCentre")
    
    __table_args__ = (
        UniqueConstraint('voucher_id', 'line_number', name='uq_voucher_items_line'),
        Index('idx_voucher_items_voucher_id', 'voucher_id'),
        Index('idx_voucher_items_product_id', 'product_id'),
        Index('idx_voucher_items_hsn_sac', 'hsn_sac_code'),
    )


class VoucherCharge(Base):
    """Voucher Additional Charges (freight, packaging, other charges)"""
    __tablename__ = 'voucher_charges'
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    voucher_id = Column(UUID(as_uuid=True), ForeignKey('vouchers.id', ondelete='CASCADE'), nullable=False)
    charge_name = Column(String(255), nullable=False)
    amount = Column(Numeric(18, 2), nullable=False, default=0)
    tax_rate_id = Column(UUID(as_uuid=True), ForeignKey('tax_rates.id'), nullable=True)
    tax_amount = Column(Numeric(18, 2), nullable=False, default=0)
    account_id = Column(UUID(as_uuid=True), ForeignKey('accounts.id'), nullable=True)
    is_deduction = Column(Boolean, nullable=False, default=False)
    created_at = Column(TIMESTAMP(timezone=True), nullable=False, server_default=func.now())
    
    # Relationships
    voucher = relationship("Voucher", back_populates="charges")
    tax_rate = relationship("TaxRate")
    account = relationship("Account")
    
    __table_args__ = (
        Index('idx_voucher_charges_voucher_id', 'voucher_id'),
    )
