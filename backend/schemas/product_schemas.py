"""
Product-related Pydantic Schemas

Request/Response DTOs for products, categories, UOM, and tax rates.
All schemas match the exact database schema structure.
"""

from pydantic import BaseModel, Field, validator
from typing import Optional, List
from datetime import datetime, date
from decimal import Decimal
from uuid import UUID


# ============================================================================
# PRODUCT CATEGORY SCHEMAS
# ============================================================================

class ProductCategoryBase(BaseModel):
    category_code: str = Field(..., max_length=30)
    category_name: str = Field(..., max_length=255)
    description: Optional[str] = None
    parent_id: Optional[UUID] = None
    is_active: bool = True


class ProductCategoryCreate(ProductCategoryBase):
    pass


class ProductCategoryUpdate(BaseModel):
    category_code: Optional[str] = Field(None, max_length=30)
    category_name: Optional[str] = Field(None, max_length=255)
    description: Optional[str] = None
    parent_id: Optional[UUID] = None
    is_active: Optional[bool] = None


class ProductCategoryResponse(ProductCategoryBase):
    id: UUID
    company_id: UUID
    created_by: Optional[UUID] = None
    updated_by: Optional[UUID] = None
    created_at: datetime
    updated_at: datetime
    deleted_at: Optional[datetime] = None
    
    class Config:
        from_attributes = True


class ProductCategoryListResponse(BaseModel):
    categories: List[ProductCategoryResponse]
    total: int
    page: int
    page_size: int
    total_pages: int


# ============================================================================
# UNIT OF MEASURE SCHEMAS
# ============================================================================

class UnitOfMeasureBase(BaseModel):
    uom_code: str = Field(..., max_length=20)
    uom_name: str = Field(..., max_length=100)
    is_active: bool = True


class UnitOfMeasureCreate(UnitOfMeasureBase):
    pass


class UnitOfMeasureUpdate(BaseModel):
    uom_code: Optional[str] = Field(None, max_length=20)
    uom_name: Optional[str] = Field(None, max_length=100)
    is_active: Optional[bool] = None


class UnitOfMeasureResponse(UnitOfMeasureBase):
    id: UUID
    company_id: UUID
    created_at: datetime
    
    class Config:
        from_attributes = True


class UnitOfMeasureListResponse(BaseModel):
    uoms: List[UnitOfMeasureResponse]
    total: int


# ============================================================================
# TAX RATE SCHEMAS
# ============================================================================

class TaxRateBase(BaseModel):
    tax_name: str = Field(..., max_length=100)
    tax_type: str = Field(..., pattern='^(gst|igst|exempt|nil|cess|other)$')
    cgst_rate: Decimal = Field(default=Decimal('0'), ge=0, le=100)
    sgst_rate: Decimal = Field(default=Decimal('0'), ge=0, le=100)
    igst_rate: Decimal = Field(default=Decimal('0'), ge=0, le=100)
    cess_rate: Decimal = Field(default=Decimal('0'), ge=0, le=100)
    hsn_sac_code: Optional[str] = Field(None, max_length=20)
    is_active: bool = True


class TaxRateCreate(TaxRateBase):
    pass


class TaxRateUpdate(BaseModel):
    tax_name: Optional[str] = Field(None, max_length=100)
    tax_type: Optional[str] = Field(None, pattern='^(gst|igst|exempt|nil|cess|other)$')
    cgst_rate: Optional[Decimal] = Field(None, ge=0, le=100)
    sgst_rate: Optional[Decimal] = Field(None, ge=0, le=100)
    igst_rate: Optional[Decimal] = Field(None, ge=0, le=100)
    cess_rate: Optional[Decimal] = Field(None, ge=0, le=100)
    hsn_sac_code: Optional[str] = Field(None, max_length=20)
    is_active: Optional[bool] = None


class TaxRateResponse(TaxRateBase):
    id: UUID
    company_id: UUID
    total_rate: Decimal  # Computed field from DB
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True


class TaxRateListResponse(BaseModel):
    tax_rates: List[TaxRateResponse]
    total: int


# ============================================================================
# PRODUCT SCHEMAS
# ============================================================================

class ProductBase(BaseModel):
    product_code: str = Field(..., max_length=50)
    product_name: str = Field(..., max_length=255)
    description: Optional[str] = None
    product_type: str = Field(default='goods', pattern='^(goods|service|combo)$')
    hsn_sac_code: Optional[str] = Field(None, max_length=20)
    category_id: Optional[UUID] = None
    uom_id: Optional[UUID] = None
    secondary_uom_id: Optional[UUID] = None
    tax_rate_id: Optional[UUID] = None
    
    # Pricing
    purchase_price: Decimal = Field(default=Decimal('0'), ge=0)
    selling_price: Decimal = Field(default=Decimal('0'), ge=0)
    mrp: Optional[Decimal] = Field(None, ge=0)
    
    # Inventory
    track_inventory: bool = True
    opening_stock: Decimal = Field(default=Decimal('0'), ge=0)
    opening_stock_value: Decimal = Field(default=Decimal('0'), ge=0)
    reorder_level: Optional[Decimal] = Field(None, ge=0)
    
    # Account linkage
    sales_account_id: Optional[UUID] = None
    purchase_account_id: Optional[UUID] = None
    stock_account_id: Optional[UUID] = None
    
    is_active: bool = True
    
    @validator('product_type')
    def validate_product_type(cls, v):
        if v not in ['goods', 'service', 'combo']:
            raise ValueError('product_type must be goods, service, or combo')
        return v
    
    @validator('track_inventory')
    def validate_inventory_for_service(cls, v, values):
        # Services typically don't track inventory
        if values.get('product_type') == 'service' and v:
            # Allow but log warning - business rule can be adjusted
            pass
        return v


class ProductCreate(ProductBase):
    pass


class ProductUpdate(BaseModel):
    product_code: Optional[str] = Field(None, max_length=50)
    product_name: Optional[str] = Field(None, max_length=255)
    description: Optional[str] = None
    product_type: Optional[str] = Field(None, pattern='^(goods|service|combo)$')
    hsn_sac_code: Optional[str] = Field(None, max_length=20)
    category_id: Optional[UUID] = None
    uom_id: Optional[UUID] = None
    secondary_uom_id: Optional[UUID] = None
    tax_rate_id: Optional[UUID] = None
    
    purchase_price: Optional[Decimal] = Field(None, ge=0)
    selling_price: Optional[Decimal] = Field(None, ge=0)
    mrp: Optional[Decimal] = Field(None, ge=0)
    
    track_inventory: Optional[bool] = None
    opening_stock: Optional[Decimal] = Field(None, ge=0)
    opening_stock_value: Optional[Decimal] = Field(None, ge=0)
    reorder_level: Optional[Decimal] = Field(None, ge=0)
    
    sales_account_id: Optional[UUID] = None
    purchase_account_id: Optional[UUID] = None
    stock_account_id: Optional[UUID] = None
    
    is_active: Optional[bool] = None


class ProductResponse(ProductBase):
    id: UUID
    company_id: UUID
    created_by: Optional[UUID] = None
    updated_by: Optional[UUID] = None
    created_at: datetime
    updated_at: datetime
    deleted_at: Optional[datetime] = None
    
    # Optional enriched data
    current_stock: Optional[Decimal] = None
    stock_value: Optional[Decimal] = None
    
    class Config:
        from_attributes = True


class ProductListResponse(BaseModel):
    products: List[ProductResponse]
    total: int
    page: int
    page_size: int
    total_pages: int


class ProductSearchResponse(BaseModel):
    results: List[ProductResponse]
    total: int


# ============================================================================
# PRICE HISTORY SCHEMAS
# ============================================================================

class ProductPriceHistoryResponse(BaseModel):
    id: UUID
    product_id: UUID
    price_type: str
    old_price: Optional[Decimal]
    new_price: Optional[Decimal]
    changed_by: Optional[UUID]
    changed_at: datetime
    reason: Optional[str]
    
    class Config:
        from_attributes = True


class ProductPriceHistoryListResponse(BaseModel):
    price_history: List[ProductPriceHistoryResponse]
    total: int


# ============================================================================
# INVENTORY SCHEMAS
# ============================================================================

class InventoryMovementCreate(BaseModel):
    product_id: UUID
    movement_type: str = Field(..., pattern='^(opening|purchase|sale|return_in|return_out|transfer_in|transfer_out|adjustment|write_off|production)$')
    movement_date: date
    quantity: Decimal
    unit_cost: Decimal = Field(default=Decimal('0'), ge=0)
    total_value: Decimal = Field(default=Decimal('0'))
    batch_number: Optional[str] = Field(None, max_length=100)
    expiry_date: Optional[date] = None
    notes: Optional[str] = None
    voucher_id: Optional[UUID] = None


class InventoryMovementResponse(BaseModel):
    id: UUID
    company_id: UUID
    product_id: UUID
    voucher_id: Optional[UUID]
    movement_type: str
    movement_date: date
    quantity: Decimal
    unit_cost: Decimal
    total_value: Decimal
    batch_number: Optional[str]
    expiry_date: Optional[date]
    notes: Optional[str]
    created_by: Optional[UUID]
    created_at: datetime
    
    class Config:
        from_attributes = True


class CurrentStockResponse(BaseModel):
    product_id: UUID
    qty_on_hand: Decimal
    stock_value: Decimal
    last_movement_date: Optional[date]
    
    class Config:
        from_attributes = True


# ============================================================================
# FILTER SCHEMAS
# ============================================================================

class ProductFilters(BaseModel):
    search: Optional[str] = None
    category_id: Optional[UUID] = None
    product_type: Optional[str] = None
    is_active: Optional[bool] = None
    page: int = Field(default=1, ge=1)
    page_size: int = Field(default=50, ge=1, le=100)
    sort_by: Optional[str] = 'product_name'
    sort_order: Optional[str] = Field(default='asc', pattern='^(asc|desc)$')


class CategoryFilters(BaseModel):
    search: Optional[str] = None
    parent_id: Optional[UUID] = None
    is_active: Optional[bool] = None
    page: int = Field(default=1, ge=1)
    page_size: int = Field(default=50, ge=1, le=100)
