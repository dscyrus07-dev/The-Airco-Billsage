"""
Payment and Transaction SQLAlchemy Models

Models for payment processing, allocation, and purchase order fulfilment.
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


class PaymentDetail(Base):
    """Payment/Receipt Details Extended Information"""
    __tablename__ = 'payment_details'
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    voucher_id = Column(UUID(as_uuid=True), ForeignKey('vouchers.id', ondelete='CASCADE'), nullable=False, unique=True)
    payment_mode = Column(String(30), nullable=False)
    payment_account_id = Column(UUID(as_uuid=True), ForeignKey('accounts.id'), nullable=True)
    cheque_number = Column(String(50), nullable=True)
    cheque_date = Column(Date, nullable=True)
    bank_ref_number = Column(String(100), nullable=True)
    upi_ref = Column(String(100), nullable=True)
    payment_status = Column(String(20), nullable=False, default='pending')
    clearing_date = Column(Date, nullable=True)
    created_at = Column(TIMESTAMP(timezone=True), nullable=False, server_default=func.now())
    updated_at = Column(TIMESTAMP(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now())
    
    # Relationships
    voucher = relationship("Voucher", back_populates="payment_detail")
    payment_account = relationship("Account")
    
    __table_args__ = (
        CheckConstraint("payment_mode IN ('cash','bank_transfer','cheque','upi','card','dd','neft','rtgs','imps','other')", name='payment_details_mode_check'),
        CheckConstraint("payment_status IN ('pending','cleared','bounced','cancelled')", name='payment_details_status_check'),
        Index('idx_payment_details_voucher_id', 'voucher_id'),
    )


class PaymentAllocation(Base):
    """Payment Allocation Against Specific Invoices"""
    __tablename__ = 'payment_allocations'
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    payment_voucher_id = Column(UUID(as_uuid=True), ForeignKey('vouchers.id', ondelete='CASCADE'), nullable=False)
    invoice_voucher_id = Column(UUID(as_uuid=True), ForeignKey('vouchers.id', ondelete='CASCADE'), nullable=False)
    allocated_amount = Column(Numeric(18, 2), nullable=False)
    allocation_date = Column(Date, nullable=False, server_default=func.now())
    created_by = Column(UUID(as_uuid=True), ForeignKey('users.id'), nullable=True)
    created_at = Column(TIMESTAMP(timezone=True), nullable=False, server_default=func.now())
    
    # Relationships
    payment_voucher = relationship("Voucher", foreign_keys=[payment_voucher_id], back_populates="payment_allocations_as_payment")
    invoice_voucher = relationship("Voucher", foreign_keys=[invoice_voucher_id], back_populates="payment_allocations_as_invoice")
    creator = relationship("User", foreign_keys=[created_by])
    
    __table_args__ = (
        CheckConstraint("allocated_amount > 0", name='payment_allocations_amount_check'),
        UniqueConstraint('payment_voucher_id', 'invoice_voucher_id', name='uq_payment_allocation'),
        Index('idx_payment_allocations_payment', 'payment_voucher_id'),
        Index('idx_payment_allocations_invoice', 'invoice_voucher_id'),
    )


class PurchaseOrderFulfilment(Base):
    """Purchase Order Fulfilment Tracking"""
    __tablename__ = 'purchase_order_fulfilment'
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    po_voucher_id = Column(UUID(as_uuid=True), ForeignKey('vouchers.id', ondelete='CASCADE'), nullable=False)
    bill_voucher_id = Column(UUID(as_uuid=True), ForeignKey('vouchers.id', ondelete='CASCADE'), nullable=False)
    po_item_id = Column(UUID(as_uuid=True), ForeignKey('voucher_items.id', ondelete='CASCADE'), nullable=False)
    billed_quantity = Column(Numeric(18, 4), nullable=False)
    created_at = Column(TIMESTAMP(timezone=True), nullable=False, server_default=func.now())
    
    # Relationships
    po_voucher = relationship("Voucher", foreign_keys=[po_voucher_id], back_populates="purchase_order_fulfilments_as_po")
    bill_voucher = relationship("Voucher", foreign_keys=[bill_voucher_id], back_populates="purchase_order_fulfilments_as_bill")
    po_item = relationship("VoucherItem")
    
    __table_args__ = (
        CheckConstraint("billed_quantity > 0", name='po_fulfilment_quantity_check'),
        Index('idx_po_fulfilment_po_id', 'po_voucher_id'),
        Index('idx_po_fulfilment_bill_id', 'bill_voucher_id'),
    )
