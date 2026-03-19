"""
Product Service Layer

Business logic for products, categories, UOM, tax rates, price history, and inventory.
All operations are tenant-scoped by company_id.
"""

from sqlalchemy.orm import Session
from sqlalchemy import text, and_, or_, func, desc
from typing import List, Optional, Dict, Any, Tuple
from uuid import UUID
from datetime import datetime, date
from decimal import Decimal
import logging

from models.product_models import (
    Product, ProductCategory, UnitOfMeasure, TaxRate,
    ProductPriceHistory, InventoryMovement
)
from schemas.product_schemas import (
    ProductCreate, ProductUpdate, ProductFilters,
    ProductCategoryCreate, ProductCategoryUpdate, CategoryFilters,
    UnitOfMeasureCreate, UnitOfMeasureUpdate,
    TaxRateCreate, TaxRateUpdate,
    InventoryMovementCreate
)

logger = logging.getLogger(__name__)


class ProductService:
    """Service for product-related operations"""
    
    def __init__(self, db: Session, company_id: UUID, user_id: Optional[UUID] = None):
        self.db = db
        self.company_id = company_id
        self.user_id = user_id
    
    # ========================================================================
    # PRODUCT CATEGORY OPERATIONS
    # ========================================================================
    
    def get_categories(self, filters: CategoryFilters) -> Tuple[List[ProductCategory], int]:
        """Get categories with filters and pagination"""
        query = self.db.query(ProductCategory).filter(
            ProductCategory.company_id == self.company_id,
            ProductCategory.deleted_at.is_(None)
        )
        
        # Apply filters
        if filters.search:
            search_term = f"%{filters.search}%"
            query = query.filter(
                or_(
                    ProductCategory.category_name.ilike(search_term),
                    ProductCategory.category_code.ilike(search_term),
                    ProductCategory.description.ilike(search_term)
                )
            )
        
        if filters.parent_id is not None:
            query = query.filter(ProductCategory.parent_id == filters.parent_id)
        
        if filters.is_active is not None:
            query = query.filter(ProductCategory.is_active == filters.is_active)
        
        # Get total count
        total = query.count()
        
        # Apply pagination
        query = query.order_by(ProductCategory.category_name)
        query = query.offset((filters.page - 1) * filters.page_size).limit(filters.page_size)
        
        categories = query.all()
        return categories, total
    
    def get_category_by_id(self, category_id: UUID) -> Optional[ProductCategory]:
        """Get category by ID"""
        return self.db.query(ProductCategory).filter(
            ProductCategory.id == category_id,
            ProductCategory.company_id == self.company_id,
            ProductCategory.deleted_at.is_(None)
        ).first()
    
    def create_category(self, data: ProductCategoryCreate) -> ProductCategory:
        """Create new category"""
        # Check for duplicate category_code
        existing = self.db.query(ProductCategory).filter(
            ProductCategory.company_id == self.company_id,
            ProductCategory.category_code == data.category_code,
            ProductCategory.deleted_at.is_(None)
        ).first()
        
        if existing:
            raise ValueError(f"Category code '{data.category_code}' already exists")
        
        # Validate parent_id if provided
        if data.parent_id:
            parent = self.get_category_by_id(data.parent_id)
            if not parent:
                raise ValueError("Parent category not found")
            
            # Check for circular reference
            if self._would_create_circular_reference(data.parent_id, None):
                raise ValueError("Cannot create circular parent reference")
        
        # Create category
        category = ProductCategory(
            company_id=self.company_id,
            category_code=data.category_code,
            category_name=data.category_name,
            description=data.description,
            parent_id=data.parent_id,
            is_active=data.is_active,
            created_by=self.user_id
        )
        
        self.db.add(category)
        self.db.commit()
        self.db.refresh(category)
        
        logger.info(f"Created category {category.id} for company {self.company_id}")
        return category
    
    def update_category(self, category_id: UUID, data: ProductCategoryUpdate) -> ProductCategory:
        """Update category"""
        category = self.get_category_by_id(category_id)
        if not category:
            raise ValueError("Category not found")
        
        # Check for duplicate category_code if changing
        if data.category_code and data.category_code != category.category_code:
            existing = self.db.query(ProductCategory).filter(
                ProductCategory.company_id == self.company_id,
                ProductCategory.category_code == data.category_code,
                ProductCategory.deleted_at.is_(None),
                ProductCategory.id != category_id
            ).first()
            
            if existing:
                raise ValueError(f"Category code '{data.category_code}' already exists")
        
        # Validate parent_id if changing
        if data.parent_id is not None:
            if data.parent_id == category_id:
                raise ValueError("Category cannot be its own parent")
            
            if data.parent_id:
                parent = self.get_category_by_id(data.parent_id)
                if not parent:
                    raise ValueError("Parent category not found")
                
                # Check for circular reference
                if self._would_create_circular_reference(data.parent_id, category_id):
                    raise ValueError("Cannot create circular parent reference")
        
        # Update fields
        update_data = data.dict(exclude_unset=True)
        for field, value in update_data.items():
            setattr(category, field, value)
        
        category.updated_by = self.user_id
        category.updated_at = datetime.utcnow()
        
        self.db.commit()
        self.db.refresh(category)
        
        logger.info(f"Updated category {category_id}")
        return category
    
    def delete_category(self, category_id: UUID, soft_delete: bool = True) -> bool:
        """Delete category (soft delete by default)"""
        category = self.get_category_by_id(category_id)
        if not category:
            raise ValueError("Category not found")
        
        # Check if category has active products
        product_count = self.db.query(Product).filter(
            Product.category_id == category_id,
            Product.company_id == self.company_id,
            Product.deleted_at.is_(None)
        ).count()
        
        if product_count > 0:
            raise ValueError(f"Cannot delete category with {product_count} active products")
        
        # Check if category has child categories
        child_count = self.db.query(ProductCategory).filter(
            ProductCategory.parent_id == category_id,
            ProductCategory.company_id == self.company_id,
            ProductCategory.deleted_at.is_(None)
        ).count()
        
        if child_count > 0:
            raise ValueError(f"Cannot delete category with {child_count} child categories")
        
        if soft_delete:
            category.deleted_at = datetime.utcnow()
            category.updated_by = self.user_id
            self.db.commit()
        else:
            self.db.delete(category)
            self.db.commit()
        
        logger.info(f"Deleted category {category_id}")
        return True
    
    def _would_create_circular_reference(self, parent_id: UUID, category_id: Optional[UUID]) -> bool:
        """Check if setting parent_id would create a circular reference"""
        if not parent_id:
            return False
        
        visited = set()
        current_id = parent_id
        
        while current_id:
            if current_id == category_id:
                return True
            
            if current_id in visited:
                return True
            
            visited.add(current_id)
            
            parent = self.db.query(ProductCategory).filter(
                ProductCategory.id == current_id,
                ProductCategory.company_id == self.company_id
            ).first()
            
            if not parent:
                break
            
            current_id = parent.parent_id
        
        return False
    
    # ========================================================================
    # UNIT OF MEASURE OPERATIONS
    # ========================================================================
    
    def get_uoms(self, is_active: Optional[bool] = None) -> List[UnitOfMeasure]:
        """Get all UOMs for company"""
        query = self.db.query(UnitOfMeasure).filter(
            UnitOfMeasure.company_id == self.company_id
        )
        
        if is_active is not None:
            query = query.filter(UnitOfMeasure.is_active == is_active)
        
        return query.order_by(UnitOfMeasure.uom_name).all()
    
    def get_uom_by_id(self, uom_id: UUID) -> Optional[UnitOfMeasure]:
        """Get UOM by ID"""
        return self.db.query(UnitOfMeasure).filter(
            UnitOfMeasure.id == uom_id,
            UnitOfMeasure.company_id == self.company_id
        ).first()
    
    def create_uom(self, data: UnitOfMeasureCreate) -> UnitOfMeasure:
        """Create new UOM"""
        # Check for duplicate uom_code
        existing = self.db.query(UnitOfMeasure).filter(
            UnitOfMeasure.company_id == self.company_id,
            UnitOfMeasure.uom_code == data.uom_code
        ).first()
        
        if existing:
            raise ValueError(f"UOM code '{data.uom_code}' already exists")
        
        uom = UnitOfMeasure(
            company_id=self.company_id,
            uom_code=data.uom_code,
            uom_name=data.uom_name,
            is_active=data.is_active
        )
        
        self.db.add(uom)
        self.db.commit()
        self.db.refresh(uom)
        
        logger.info(f"Created UOM {uom.id} for company {self.company_id}")
        return uom
    
    def update_uom(self, uom_id: UUID, data: UnitOfMeasureUpdate) -> UnitOfMeasure:
        """Update UOM"""
        uom = self.get_uom_by_id(uom_id)
        if not uom:
            raise ValueError("UOM not found")
        
        # Check for duplicate uom_code if changing
        if data.uom_code and data.uom_code != uom.uom_code:
            existing = self.db.query(UnitOfMeasure).filter(
                UnitOfMeasure.company_id == self.company_id,
                UnitOfMeasure.uom_code == data.uom_code,
                UnitOfMeasure.id != uom_id
            ).first()
            
            if existing:
                raise ValueError(f"UOM code '{data.uom_code}' already exists")
        
        update_data = data.dict(exclude_unset=True)
        for field, value in update_data.items():
            setattr(uom, field, value)
        
        self.db.commit()
        self.db.refresh(uom)
        
        logger.info(f"Updated UOM {uom_id}")
        return uom
    
    # ========================================================================
    # TAX RATE OPERATIONS
    # ========================================================================
    
    def get_tax_rates(self, is_active: Optional[bool] = None) -> List[TaxRate]:
        """Get all tax rates for company"""
        query = self.db.query(TaxRate).filter(
            TaxRate.company_id == self.company_id
        )
        
        if is_active is not None:
            query = query.filter(TaxRate.is_active == is_active)
        
        return query.order_by(TaxRate.tax_name).all()
    
    def get_tax_rate_by_id(self, tax_rate_id: UUID) -> Optional[TaxRate]:
        """Get tax rate by ID"""
        return self.db.query(TaxRate).filter(
            TaxRate.id == tax_rate_id,
            TaxRate.company_id == self.company_id
        ).first()
    
    def create_tax_rate(self, data: TaxRateCreate) -> TaxRate:
        """Create new tax rate"""
        # Check for duplicate tax_name
        existing = self.db.query(TaxRate).filter(
            TaxRate.company_id == self.company_id,
            TaxRate.tax_name == data.tax_name
        ).first()
        
        if existing:
            raise ValueError(f"Tax rate '{data.tax_name}' already exists")
        
        tax_rate = TaxRate(
            company_id=self.company_id,
            tax_name=data.tax_name,
            tax_type=data.tax_type,
            cgst_rate=data.cgst_rate,
            sgst_rate=data.sgst_rate,
            igst_rate=data.igst_rate,
            cess_rate=data.cess_rate,
            hsn_sac_code=data.hsn_sac_code,
            is_active=data.is_active
        )
        
        self.db.add(tax_rate)
        self.db.commit()
        self.db.refresh(tax_rate)
        
        logger.info(f"Created tax rate {tax_rate.id} for company {self.company_id}")
        return tax_rate
    
    def update_tax_rate(self, tax_rate_id: UUID, data: TaxRateUpdate) -> TaxRate:
        """Update tax rate"""
        tax_rate = self.get_tax_rate_by_id(tax_rate_id)
        if not tax_rate:
            raise ValueError("Tax rate not found")
        
        # Check for duplicate tax_name if changing
        if data.tax_name and data.tax_name != tax_rate.tax_name:
            existing = self.db.query(TaxRate).filter(
                TaxRate.company_id == self.company_id,
                TaxRate.tax_name == data.tax_name,
                TaxRate.id != tax_rate_id
            ).first()
            
            if existing:
                raise ValueError(f"Tax rate '{data.tax_name}' already exists")
        
        update_data = data.dict(exclude_unset=True)
        for field, value in update_data.items():
            setattr(tax_rate, field, value)
        
        tax_rate.updated_at = datetime.utcnow()
        
        self.db.commit()
        self.db.refresh(tax_rate)
        
        logger.info(f"Updated tax rate {tax_rate_id}")
        return tax_rate
    
    # ========================================================================
    # PRODUCT OPERATIONS
    # ========================================================================
    
    def get_products(self, filters: ProductFilters) -> Tuple[List[Product], int]:
        """Get products with filters and pagination"""
        query = self.db.query(Product).filter(
            Product.company_id == self.company_id,
            Product.deleted_at.is_(None)
        )
        
        # Apply filters
        if filters.search:
            search_term = f"%{filters.search}%"
            query = query.filter(
                or_(
                    Product.product_name.ilike(search_term),
                    Product.product_code.ilike(search_term),
                    Product.description.ilike(search_term),
                    Product.hsn_sac_code.ilike(search_term)
                )
            )
        
        if filters.category_id:
            query = query.filter(Product.category_id == filters.category_id)
        
        if filters.product_type:
            query = query.filter(Product.product_type == filters.product_type)
        
        if filters.is_active is not None:
            query = query.filter(Product.is_active == filters.is_active)
        
        # Get total count
        total = query.count()
        
        # Apply sorting
        if filters.sort_by == 'product_name':
            order_col = Product.product_name
        elif filters.sort_by == 'product_code':
            order_col = Product.product_code
        elif filters.sort_by == 'created_at':
            order_col = Product.created_at
        else:
            order_col = Product.product_name
        
        if filters.sort_order == 'desc':
            query = query.order_by(desc(order_col))
        else:
            query = query.order_by(order_col)
        
        # Apply pagination
        query = query.offset((filters.page - 1) * filters.page_size).limit(filters.page_size)
        
        products = query.all()
        return products, total
    
    def get_product_by_id(self, product_id: UUID) -> Optional[Product]:
        """Get product by ID"""
        return self.db.query(Product).filter(
            Product.id == product_id,
            Product.company_id == self.company_id,
            Product.deleted_at.is_(None)
        ).first()
    
    def create_product(self, data: ProductCreate) -> Product:
        """Create new product"""
        # Check for duplicate product_code
        existing = self.db.query(Product).filter(
            Product.company_id == self.company_id,
            Product.product_code == data.product_code,
            Product.deleted_at.is_(None)
        ).first()
        
        if existing:
            raise ValueError(f"Product code '{data.product_code}' already exists")
        
        # Validate foreign key references
        self._validate_product_references(data)
        
        # Create product
        product = Product(
            company_id=self.company_id,
            product_code=data.product_code,
            product_name=data.product_name,
            description=data.description,
            product_type=data.product_type,
            hsn_sac_code=data.hsn_sac_code,
            category_id=data.category_id,
            uom_id=data.uom_id,
            secondary_uom_id=data.secondary_uom_id,
            tax_rate_id=data.tax_rate_id,
            purchase_price=data.purchase_price,
            selling_price=data.selling_price,
            mrp=data.mrp,
            track_inventory=data.track_inventory,
            opening_stock=data.opening_stock,
            opening_stock_value=data.opening_stock_value,
            reorder_level=data.reorder_level,
            sales_account_id=data.sales_account_id,
            purchase_account_id=data.purchase_account_id,
            stock_account_id=data.stock_account_id,
            is_active=data.is_active,
            created_by=self.user_id
        )
        
        self.db.add(product)
        self.db.flush()  # Get product ID before creating inventory movement
        
        # Create opening stock inventory movement if applicable
        if data.track_inventory and data.opening_stock > 0:
            self._create_opening_stock_movement(product, data.opening_stock, data.opening_stock_value)
        
        self.db.commit()
        self.db.refresh(product)
        
        logger.info(f"Created product {product.id} for company {self.company_id}")
        return product
    
    def update_product(self, product_id: UUID, data: ProductUpdate) -> Product:
        """Update product"""
        product = self.get_product_by_id(product_id)
        if not product:
            raise ValueError("Product not found")
        
        # Check for duplicate product_code if changing
        if data.product_code and data.product_code != product.product_code:
            existing = self.db.query(Product).filter(
                Product.company_id == self.company_id,
                Product.product_code == data.product_code,
                Product.deleted_at.is_(None),
                Product.id != product_id
            ).first()
            
            if existing:
                raise ValueError(f"Product code '{data.product_code}' already exists")
        
        # Validate foreign key references if provided
        if any([data.category_id, data.uom_id, data.secondary_uom_id, data.tax_rate_id,
                data.sales_account_id, data.purchase_account_id, data.stock_account_id]):
            self._validate_product_references(data)
        
        # Track price changes for history
        price_changes = []
        if data.purchase_price is not None and data.purchase_price != product.purchase_price:
            price_changes.append(('purchase', product.purchase_price, data.purchase_price))
        if data.selling_price is not None and data.selling_price != product.selling_price:
            price_changes.append(('selling', product.selling_price, data.selling_price))
        if data.mrp is not None and data.mrp != product.mrp:
            price_changes.append(('mrp', product.mrp, data.mrp))
        
        # Update fields
        update_data = data.dict(exclude_unset=True)
        for field, value in update_data.items():
            setattr(product, field, value)
        
        product.updated_by = self.user_id
        product.updated_at = datetime.utcnow()
        
        self.db.flush()
        
        # Create price history entries
        for price_type, old_price, new_price in price_changes:
            self._create_price_history(product.id, price_type, old_price, new_price)
        
        self.db.commit()
        self.db.refresh(product)
        
        logger.info(f"Updated product {product_id}")
        return product
    
    def delete_product(self, product_id: UUID, soft_delete: bool = True) -> bool:
        """Delete product (soft delete by default)"""
        product = self.get_product_by_id(product_id)
        if not product:
            raise ValueError("Product not found")
        
        if soft_delete:
            product.deleted_at = datetime.utcnow()
            product.updated_by = self.user_id
            self.db.commit()
        else:
            self.db.delete(product)
            self.db.commit()
        
        logger.info(f"Deleted product {product_id}")
        return True
    
    def _validate_product_references(self, data) -> None:
        """Validate that all foreign key references belong to the same company"""
        if hasattr(data, 'category_id') and data.category_id:
            if not self.get_category_by_id(data.category_id):
                raise ValueError("Category not found or doesn't belong to this company")
        
        if hasattr(data, 'uom_id') and data.uom_id:
            if not self.get_uom_by_id(data.uom_id):
                raise ValueError("UOM not found or doesn't belong to this company")
        
        if hasattr(data, 'secondary_uom_id') and data.secondary_uom_id:
            if not self.get_uom_by_id(data.secondary_uom_id):
                raise ValueError("Secondary UOM not found or doesn't belong to this company")
        
        if hasattr(data, 'tax_rate_id') and data.tax_rate_id:
            if not self.get_tax_rate_by_id(data.tax_rate_id):
                raise ValueError("Tax rate not found or doesn't belong to this company")
        
        # Account validation would go here if accounts service is available
    
    # ========================================================================
    # PRICE HISTORY OPERATIONS
    # ========================================================================
    
    def get_price_history(self, product_id: UUID) -> List[ProductPriceHistory]:
        """Get price history for a product"""
        # Verify product belongs to company
        product = self.get_product_by_id(product_id)
        if not product:
            raise ValueError("Product not found")
        
        return self.db.query(ProductPriceHistory).filter(
            ProductPriceHistory.product_id == product_id
        ).order_by(desc(ProductPriceHistory.changed_at)).all()
    
    def _create_price_history(self, product_id: UUID, price_type: str, 
                             old_price: Optional[Decimal], new_price: Optional[Decimal],
                             reason: Optional[str] = None) -> ProductPriceHistory:
        """Create price history entry"""
        history = ProductPriceHistory(
            product_id=product_id,
            price_type=price_type,
            old_price=old_price,
            new_price=new_price,
            changed_by=self.user_id,
            reason=reason
        )
        
        self.db.add(history)
        return history
    
    # ========================================================================
    # INVENTORY OPERATIONS
    # ========================================================================
    
    def _create_opening_stock_movement(self, product: Product, quantity: Decimal, 
                                      value: Decimal) -> InventoryMovement:
        """Create opening stock inventory movement"""
        unit_cost = value / quantity if quantity > 0 else Decimal('0')
        
        movement = InventoryMovement(
            company_id=self.company_id,
            product_id=product.id,
            movement_type='opening',
            movement_date=date.today(),
            quantity=quantity,
            unit_cost=unit_cost,
            total_value=value,
            notes='Opening stock',
            created_by=self.user_id
        )
        
        self.db.add(movement)
        logger.info(f"Created opening stock movement for product {product.id}")
        return movement
    
    def get_current_stock(self, product_id: UUID) -> Optional[Dict[str, Any]]:
        """Get current stock from materialized view"""
        # Verify product belongs to company
        product = self.get_product_by_id(product_id)
        if not product:
            return None
        
        query = text("""
            SELECT 
                product_id,
                qty_on_hand,
                stock_value,
                last_movement_date
            FROM mv_current_stock
            WHERE company_id = :company_id
            AND product_id = :product_id
        """)
        
        result = self.db.execute(query, {
            'company_id': str(self.company_id),
            'product_id': str(product_id)
        }).fetchone()
        
        if result:
            return {
                'product_id': result.product_id,
                'qty_on_hand': result.qty_on_hand,
                'stock_value': result.stock_value,
                'last_movement_date': result.last_movement_date
            }
        
        return None
