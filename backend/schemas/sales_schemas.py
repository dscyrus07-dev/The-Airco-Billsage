"""
Sales Schemas

Pydantic models for sales invoice/voucher data validation and serialization.
Maps to vouchers table with voucher_type='sale'.
"""

from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime, date
from decimal import Decimal


class SalesItemCreate(BaseModel):
    """Schema for creating a sales line item"""
    line_number: int = Field(..., ge=1)
    product_id: Optional[str] = None
    description: str = Field(..., min_length=1)
    hsn_sac_code: Optional[str] = Field(None, max_length=20)
    quantity: Decimal = Field(..., gt=0)
    rate: Decimal = Field(..., ge=0)
    discount_pct: Decimal = Field(default=Decimal('0'), ge=0, le=100)
    discount_amount: Decimal = Field(default=Decimal('0'), ge=0)
    taxable_amount: Decimal = Field(..., ge=0)
    cgst_rate: Decimal = Field(default=Decimal('0'), ge=0)
    cgst_amount: Decimal = Field(default=Decimal('0'), ge=0)
    sgst_rate: Decimal = Field(default=Decimal('0'), ge=0)
    sgst_amount: Decimal = Field(default=Decimal('0'), ge=0)
    igst_rate: Decimal = Field(default=Decimal('0'), ge=0)
    igst_amount: Decimal = Field(default=Decimal('0'), ge=0)
    cess_rate: Decimal = Field(default=Decimal('0'), ge=0)
    cess_amount: Decimal = Field(default=Decimal('0'), ge=0)
    line_total: Decimal = Field(..., ge=0)


class SalesItemResponse(SalesItemCreate):
    """Schema for sales line item response"""
    id: str
    voucher_id: str
    created_at: datetime


class SalesCreate(BaseModel):
    """Schema for creating a sales invoice"""
    party_id: str = Field(..., description="Customer ID")
    voucher_number: str = Field(..., max_length=50)
    voucher_date: date
    ref_number: Optional[str] = Field(None, max_length=100, description="Customer PO number")
    ref_date: Optional[date] = None
    
    # Line items
    items: List[SalesItemCreate] = Field(..., min_items=1)
    
    # Amounts
    subtotal: Decimal = Field(..., ge=0)
    discount_amount: Decimal = Field(default=Decimal('0'), ge=0)
    taxable_amount: Decimal = Field(..., ge=0)
    cgst_amount: Decimal = Field(default=Decimal('0'), ge=0)
    sgst_amount: Decimal = Field(default=Decimal('0'), ge=0)
    igst_amount: Decimal = Field(default=Decimal('0'), ge=0)
    cess_amount: Decimal = Field(default=Decimal('0'), ge=0)
    tcs_amount: Decimal = Field(default=Decimal('0'), ge=0)
    round_off: Decimal = Field(default=Decimal('0'))
    total_amount: Decimal = Field(..., ge=0)
    
    # GST details
    supply_type: Optional[str] = Field(None, description="B2B, B2C, B2CL, export, etc.")
    place_of_supply: Optional[str] = None
    reverse_charge: bool = Field(default=False)
    
    # E-invoice
    is_einvoice: bool = Field(default=False)
    
    # Additional fields
    notes: Optional[str] = None
    terms_and_conditions: Optional[str] = None


class SalesUpdate(BaseModel):
    """Schema for updating a sales invoice"""
    party_id: Optional[str] = None
    voucher_date: Optional[date] = None
    ref_number: Optional[str] = None
    ref_date: Optional[date] = None
    
    items: Optional[List[SalesItemCreate]] = None
    
    subtotal: Optional[Decimal] = None
    discount_amount: Optional[Decimal] = None
    taxable_amount: Optional[Decimal] = None
    cgst_amount: Optional[Decimal] = None
    sgst_amount: Optional[Decimal] = None
    igst_amount: Optional[Decimal] = None
    cess_amount: Optional[Decimal] = None
    tcs_amount: Optional[Decimal] = None
    round_off: Optional[Decimal] = None
    total_amount: Optional[Decimal] = None
    
    supply_type: Optional[str] = None
    place_of_supply: Optional[str] = None
    reverse_charge: Optional[bool] = None
    is_einvoice: Optional[bool] = None
    
    notes: Optional[str] = None
    terms_and_conditions: Optional[str] = None
    status: Optional[str] = Field(None, description="draft, confirmed, cancelled")


class SalesResponse(BaseModel):
    """Schema for sales invoice response"""
    id: str
    company_id: str
    fy_id: str
    voucher_type: str
    voucher_number: str
    voucher_date: date
    ref_number: Optional[str]
    ref_date: Optional[date]
    party_id: Optional[str]
    
    # Amounts
    subtotal: Decimal
    discount_amount: Decimal
    taxable_amount: Decimal
    cgst_amount: Decimal
    sgst_amount: Decimal
    igst_amount: Decimal
    cess_amount: Decimal
    tcs_amount: Decimal
    round_off: Decimal
    total_amount: Decimal
    paid_amount: Decimal
    balance_amount: Decimal
    
    # GST details
    supply_type: Optional[str]
    place_of_supply: Optional[str]
    reverse_charge: bool
    
    # E-invoice
    is_einvoice: bool
    irn: Optional[str]
    ack_number: Optional[str]
    ack_date: Optional[datetime]
    
    # Workflow
    status: str
    
    # Metadata
    notes: Optional[str]
    terms_and_conditions: Optional[str]
    created_by: Optional[str]
    created_at: datetime
    updated_at: datetime
    confirmed_by: Optional[str]
    confirmed_at: Optional[datetime]
    
    # Line items (optional, loaded separately)
    items: Optional[List[SalesItemResponse]] = None


class SalesListResponse(BaseModel):
    """Schema for paginated sales list response"""
    sales: List[SalesResponse]
    total: int
    page: int
    page_size: int
    total_pages: int


class SalesKPIs(BaseModel):
    """Schema for sales KPIs"""
    total_sales: int
    total_amount: Decimal
    pending_count: int
    confirmed_count: int
    draft_count: int
    total_paid: Decimal
    total_outstanding: Decimal


class SalesAnalytics(BaseModel):
    """Schema for sales analytics"""
    period_start: date
    period_end: date
    total_sales: int
    total_amount: Decimal
    average_sale_value: Decimal
    top_customers: List[dict]
    category_breakdown: List[dict]
    monthly_trend: List[dict]


class InvoiceGenerateRequest(BaseModel):
    """Schema for invoice generation request"""
    party_id: str
    items: List[SalesItemCreate]
    voucher_date: Optional[date] = None
    supply_type: Optional[str] = "B2B"
    place_of_supply: Optional[str] = None
    notes: Optional[str] = None
