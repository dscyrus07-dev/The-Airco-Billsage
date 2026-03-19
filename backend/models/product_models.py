"""
Product-related SQLAlchemy Models

Models for products, categories, UOM, tax rates, price history, and inventory.
All models follow the exact schema.sql structure.
"""

from sqlalchemy import (
    Column, String, Text, Boolean, TIMESTAMP, Numeric, Date,
    ForeignKey, CheckConstraint, UniqueConstraint, Index
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.sql import func
import uuid

Base = declarative_base()


class ProductCategory(Base):
    """Product Categories - Hierarchical structure"""
    __tablename__ = 'product_categories'
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    company_id = Column(UUID(as_uuid=True), ForeignKey('companies.id', ondelete='CASCADE'), nullable=False)
    parent_id = Column(UUID(as_uuid=True), ForeignKey('product_categories.id'), nullable=True)
    category_code = Column(String(30), nullable=False)
    category_name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    is_active = Column(Boolean, nullable=False, default=True)
    created_by = Column(UUID(as_uuid=True), nullable=True)
    updated_by = Column(UUID(as_uuid=True), nullable=True)
    created_at = Column(TIMESTAMP(timezone=True), nullable=False, server_default=func.now())
    updated_at = Column(TIMESTAMP(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now())
    deleted_at = Column(TIMESTAMP(timezone=True), nullable=True)
    
    __table_args__ = (
        UniqueConstraint('company_id', 'category_code', name='uq_product_categories_code'),
        Index('idx_product_categories_company_id', 'company_id'),
        Index('idx_product_categories_parent_id', 'parent_id'),
    )


class UnitOfMeasure(Base):
    """Units of Measure"""
    __tablename__ = 'units_of_measure'
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    company_id = Column(UUID(as_uuid=True), ForeignKey('companies.id', ondelete='CASCADE'), nullable=False)
    uom_code = Column(String(20), nullable=False)
    uom_name = Column(String(100), nullable=False)
    is_active = Column(Boolean, nullable=False, default=True)
    created_at = Column(TIMESTAMP(timezone=True), nullable=False, server_default=func.now())
    
    __table_args__ = (
        UniqueConstraint('company_id', 'uom_code', name='uq_uom_company_code'),
    )


class TaxRate(Base):
    """GST Tax Rates"""
    __tablename__ = 'tax_rates'
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    company_id = Column(UUID(as_uuid=True), ForeignKey('companies.id', ondelete='CASCADE'), nullable=False)
    tax_name = Column(String(100), nullable=False)
    tax_type = Column(String(20), nullable=False)
    cgst_rate = Column(Numeric(6, 3), nullable=False, default=0)
    sgst_rate = Column(Numeric(6, 3), nullable=False, default=0)
    igst_rate = Column(Numeric(6, 3), nullable=False, default=0)
    cess_rate = Column(Numeric(6, 3), nullable=False, default=0)
    # total_rate is a generated column in DB, not managed by SQLAlchemy
    hsn_sac_code = Column(String(20), nullable=True)
    is_active = Column(Boolean, nullable=False, default=True)
    created_at = Column(TIMESTAMP(timezone=True), nullable=False, server_default=func.now())
    updated_at = Column(TIMESTAMP(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now())
    
    __table_args__ = (
        CheckConstraint(
            "tax_type IN ('gst','igst','exempt','nil','cess','other')",
            name='tax_rates_tax_type_check'
        ),
        UniqueConstraint('company_id', 'tax_name', name='uq_tax_rates_company_name'),
        Index('idx_tax_rates_company_id', 'company_id'),
    )


class Product(Base):
    """Products and Services Master"""
    __tablename__ = 'products'
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    company_id = Column(UUID(as_uuid=True), ForeignKey('companies.id', ondelete='CASCADE'), nullable=False)
    category_id = Column(UUID(as_uuid=True), ForeignKey('product_categories.id'), nullable=True)
    product_code = Column(String(50), nullable=False)
    product_name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    product_type = Column(String(20), nullable=False, default='goods')
    hsn_sac_code = Column(String(20), nullable=True)
    uom_id = Column(UUID(as_uuid=True), ForeignKey('units_of_measure.id'), nullable=True)
    secondary_uom_id = Column(UUID(as_uuid=True), ForeignKey('units_of_measure.id'), nullable=True)
    tax_rate_id = Column(UUID(as_uuid=True), ForeignKey('tax_rates.id'), nullable=True)
    
    # Pricing
    purchase_price = Column(Numeric(18, 4), nullable=False, default=0)
    selling_price = Column(Numeric(18, 4), nullable=False, default=0)
    mrp = Column(Numeric(18, 4), nullable=True)
    
    # Inventory
    track_inventory = Column(Boolean, nullable=False, default=True)
    opening_stock = Column(Numeric(18, 4), nullable=False, default=0)
    opening_stock_value = Column(Numeric(18, 2), nullable=False, default=0)
    reorder_level = Column(Numeric(18, 4), nullable=True)
    
    # Account linkage
    sales_account_id = Column(UUID(as_uuid=True), ForeignKey('accounts.id'), nullable=True)
    purchase_account_id = Column(UUID(as_uuid=True), ForeignKey('accounts.id'), nullable=True)
    stock_account_id = Column(UUID(as_uuid=True), ForeignKey('accounts.id'), nullable=True)
    
    is_active = Column(Boolean, nullable=False, default=True)
    created_by = Column(UUID(as_uuid=True), nullable=True)
    updated_by = Column(UUID(as_uuid=True), nullable=True)
    created_at = Column(TIMESTAMP(timezone=True), nullable=False, server_default=func.now())
    updated_at = Column(TIMESTAMP(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now())
    deleted_at = Column(TIMESTAMP(timezone=True), nullable=True)
    
    __table_args__ = (
        CheckConstraint(
            "product_type IN ('goods','service','combo')",
            name='products_product_type_check'
        ),
        UniqueConstraint('company_id', 'product_code', name='uq_products_company_code'),
        Index('idx_products_company_id', 'company_id'),
        Index('idx_products_category_id', 'category_id'),
        Index('idx_products_product_name', 'product_name', postgresql_using='gin', postgresql_ops={'product_name': 'gin_trgm_ops'}),
        Index('idx_products_hsn_sac_code', 'hsn_sac_code'),
        Index('idx_products_deleted_at', 'deleted_at'),
    )


class ProductPriceHistory(Base):
    """Product Price Change Audit Trail"""
    __tablename__ = 'product_price_history'
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    product_id = Column(UUID(as_uuid=True), ForeignKey('products.id', ondelete='CASCADE'), nullable=False)
    price_type = Column(String(20), nullable=False)
    old_price = Column(Numeric(18, 4), nullable=True)
    new_price = Column(Numeric(18, 4), nullable=True)
    changed_by = Column(UUID(as_uuid=True), ForeignKey('users.id'), nullable=True)
    changed_at = Column(TIMESTAMP(timezone=True), nullable=False, server_default=func.now())
    reason = Column(Text, nullable=True)
    
    __table_args__ = (
        CheckConstraint(
            "price_type IN ('purchase','selling','mrp')",
            name='product_price_history_price_type_check'
        ),
        Index('idx_product_price_history_product_id', 'product_id'),
    )


class InventoryMovement(Base):
    """Inventory Movement Transactions"""
    __tablename__ = 'inventory_movements'
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    company_id = Column(UUID(as_uuid=True), ForeignKey('companies.id', ondelete='RESTRICT'), nullable=False)
    product_id = Column(UUID(as_uuid=True), ForeignKey('products.id'), nullable=False)
    voucher_id = Column(UUID(as_uuid=True), ForeignKey('vouchers.id'), nullable=True)
    movement_type = Column(String(30), nullable=False)
    movement_date = Column(Date, nullable=False)
    quantity = Column(Numeric(18, 4), nullable=False)
    unit_cost = Column(Numeric(18, 4), nullable=False, default=0)
    total_value = Column(Numeric(18, 2), nullable=False, default=0)
    batch_number = Column(String(100), nullable=True)
    expiry_date = Column(Date, nullable=True)
    notes = Column(Text, nullable=True)
    created_by = Column(UUID(as_uuid=True), ForeignKey('users.id'), nullable=True)
    created_at = Column(TIMESTAMP(timezone=True), nullable=False, server_default=func.now())
    
    __table_args__ = (
        CheckConstraint(
            "movement_type IN ('opening','purchase','sale','return_in','return_out',"
            "'transfer_in','transfer_out','adjustment','write_off','production')",
            name='inventory_movements_movement_type_check'
        ),
        Index('idx_inv_movements_company_id', 'company_id'),
        Index('idx_inv_movements_product_id', 'product_id'),
        Index('idx_inv_movements_voucher_id', 'voucher_id'),
        Index('idx_inv_movements_date', 'movement_date'),
        Index('idx_inv_movements_type', 'movement_type'),
    )
