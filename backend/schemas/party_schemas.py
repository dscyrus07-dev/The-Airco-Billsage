"""
Party Schemas

Pydantic models for party (supplier/customer) data validation and serialization.
Matches the database schema in the parties table.
"""

from pydantic import BaseModel, EmailStr, Field
from typing import Optional, List, Literal
from datetime import datetime


class PartyBase(BaseModel):
    """Base party fields - matches real database schema"""
    party_name: str = Field(..., min_length=1, max_length=255, description="Legal name of the party")
    display_name: Optional[str] = Field(None, max_length=255, description="Trade name")
    party_code: Optional[str] = Field(None, max_length=30, description="Unique party code (auto-generated if not provided)")
    party_type: Literal['supplier', 'customer', 'both'] = Field(..., description="Type: 'supplier', 'customer', or 'both'")
    party_category: Optional[Literal['business', 'individual']] = Field("business", description="Category: 'business' or 'individual'")
    gstin: Optional[str] = Field(None, max_length=20, description="GST Identification Number")
    pan: Optional[str] = Field(None, max_length=20, description="PAN number")
    cin: Optional[str] = Field(None, max_length=30, description="CIN number")
    tan: Optional[str] = Field(None, max_length=20, description="TAN number")
    email: Optional[EmailStr] = None
    phone: Optional[str] = Field(None, max_length=20)
    alternate_phone: Optional[str] = Field(None, max_length=20)
    website: Optional[str] = Field(None, max_length=255)
    address: Optional[str] = Field(None, max_length=500, description="Complete address")
    state: Optional[str] = Field(None, max_length=50, description="State name")
    pin_code: Optional[str] = Field(None, max_length=6, description="PIN code")
    credit_limit: Optional[float] = Field(0, ge=0, description="Credit limit amount")
    payment_terms_days: Optional[int] = Field(0, ge=0, description="Payment terms in days")
    opening_balance: Optional[float] = Field(0, description="Opening balance")
    opening_balance_type: Optional[Literal['dr', 'cr']] = Field("dr", description="Opening balance type: 'dr' or 'cr'")
    status: Optional[Literal['active', 'inactive', 'blocked']] = Field("active", description="Status: 'active', 'inactive', or 'blocked'")
    notes: Optional[str] = None


class PartyCreate(PartyBase):
    """Schema for creating a new party"""
    pass


class PartyUpdate(BaseModel):
    """Schema for updating a party - all fields optional"""
    party_name: Optional[str] = Field(None, min_length=1, max_length=255)
    display_name: Optional[str] = Field(None, max_length=255)
    party_code: Optional[str] = Field(None, max_length=30)
    party_type: Optional[Literal['supplier', 'customer', 'both']] = None
    party_category: Optional[Literal['business', 'individual']] = None
    gstin: Optional[str] = Field(None, max_length=20)
    pan: Optional[str] = Field(None, max_length=20)
    cin: Optional[str] = Field(None, max_length=30)
    tan: Optional[str] = Field(None, max_length=20)
    email: Optional[EmailStr] = None
    phone: Optional[str] = Field(None, max_length=20)
    alternate_phone: Optional[str] = Field(None, max_length=20)
    website: Optional[str] = Field(None, max_length=255)
    address: Optional[str] = Field(None, max_length=500)
    state: Optional[str] = Field(None, max_length=50)
    pin_code: Optional[str] = Field(None, max_length=6)
    credit_limit: Optional[float] = Field(None, ge=0)
    payment_terms_days: Optional[int] = Field(None, ge=0)
    opening_balance: Optional[float] = None
    opening_balance_type: Optional[Literal['dr', 'cr']] = None
    status: Optional[Literal['active', 'inactive', 'blocked']] = Field(None, description="Status: 'active', 'inactive', or 'blocked'")
    notes: Optional[str] = None


class PartyResponse(PartyBase):
    """Schema for party response"""
    id: str
    company_id: str
    created_by: Optional[str] = None
    updated_by: Optional[str] = None
    deleted_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True


class PartyListResponse(BaseModel):
    """Schema for paginated party list response"""
    parties: List[PartyResponse]
    total: int
    page: int
    page_size: int
    total_pages: int


class PartyTransactionSummary(BaseModel):
    """Schema for party transaction summary"""
    party_id: str
    total_invoices: int
    total_amount: float
    pending_amount: float
    paid_amount: float
    last_invoice_date: Optional[datetime]
    last_payment_date: Optional[datetime]


class PartySummaryResponse(BaseModel):
    """Schema for party summary with transaction details"""
    party: PartyResponse
    summary: PartyTransactionSummary


class PartyInvoice(BaseModel):
    """Schema for party invoice"""
    id: str
    invoice_number: str
    invoice_date: datetime
    due_date: Optional[datetime]
    total_amount: float
    paid_amount: float
    pending_amount: float
    status: str
    invoice_type: str  # 'purchase' or 'sale'


class PartyInvoicesResponse(BaseModel):
    """Schema for party invoices list"""
    invoices: List[PartyInvoice]
    total: int
    page: int
    page_size: int


class PartyAnalyticsSummary(BaseModel):
    """Schema for party analytics summary"""
    total_parties: int
    active_suppliers: int
    active_customers: int
    inactive_parties: int
    total_spend: float
    total_revenue: float
    top_supplier_concentration: float
    top_customer_concentration: float


class BulkStatusUpdate(BaseModel):
    """Schema for bulk status update"""
    party_ids: List[str] = Field(..., min_items=1, description="List of party IDs to update")
    status: Literal['active', 'inactive', 'blocked'] = Field(..., description="New status: 'active', 'inactive', or 'blocked'")


class PartySearchResult(BaseModel):
    """Schema for party search result"""
    id: str
    party_name: str
    display_name: Optional[str]
    party_type: str
    email: Optional[str]
    phone: Optional[str]
    gstin: Optional[str]


class PartySearchResponse(BaseModel):
    """Schema for party search response"""
    results: List[PartySearchResult]
    total: int
    query: str
