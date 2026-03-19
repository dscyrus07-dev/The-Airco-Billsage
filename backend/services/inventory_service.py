"""
Inventory Movement Service

Handles stock tracking for sales and purchases.
Creates inventory movements when vouchers are confirmed.
"""

from sqlalchemy.orm import Session
from sqlalchemy import text
from typing import List, Dict, Optional
from decimal import Decimal
import uuid
from datetime import date
import logging

logger = logging.getLogger(__name__)


class InventoryService:
    """Service for managing inventory movements"""
    
    def __init__(self):
        pass
    
    def create_sales_movements(
        self,
        db: Session,
        voucher_id: str,
        company_id: str,
        voucher_date: date,
        line_items: List[Dict]
    ) -> List[str]:
        """
        Create inventory movements for sales invoice
        
        Decrements stock for goods (negative quantity)
        Skips services and non-tracked items
        
        Args:
            db: Database session
            voucher_id: Voucher UUID
            company_id: Company UUID
            voucher_date: Transaction date
            line_items: List of line item dictionaries
            
        Returns:
            List of created movement IDs
        """
        try:
            movement_ids = []
            
            for item in line_items:
                product_id = item.get('product_id')
                if not product_id:
                    continue
                
                # Check if product tracks inventory
                product_query = text("""
                    SELECT product_type, track_inventory
                    FROM products
                    WHERE id = :product_id
                    AND company_id = :company_id
                    AND deleted_at IS NULL
                """)
                product_result = db.execute(product_query, {
                    "product_id": product_id,
                    "company_id": company_id
                }).fetchone()
                
                if not product_result:
                    logger.warning(f"Product {product_id} not found")
                    continue
                
                # Skip services and non-tracked items
                if product_result.product_type == 'service' or not product_result.track_inventory:
                    continue
                
                # Get quantity
                quantity = Decimal(str(item.get('quantity', 0)))
                if quantity <= 0:
                    continue
                
                # Check stock availability
                available_stock = self._get_available_stock(db, product_id, company_id)
                if available_stock < quantity:
                    raise ValueError(
                        f"Insufficient stock for product {product_id}. "
                        f"Available: {available_stock}, Required: {quantity}"
                    )
                
                # Create movement (negative quantity for sales)
                movement_id = self._create_movement(
                    db=db,
                    company_id=company_id,
                    product_id=product_id,
                    voucher_id=voucher_id,
                    movement_type='sale',
                    movement_date=voucher_date,
                    quantity=-quantity,  # Negative for outward
                    rate=Decimal(str(item.get('rate', 0))),
                    value=Decimal(str(item.get('taxable_amount', 0)))
                )
                
                movement_ids.append(movement_id)
            
            logger.info(f"Created {len(movement_ids)} inventory movements for voucher {voucher_id}")
            return movement_ids
            
        except Exception as e:
            logger.error(f"Error creating inventory movements for voucher {voucher_id}: {e}")
            raise
    
    def create_purchase_movements(
        self,
        db: Session,
        voucher_id: str,
        company_id: str,
        voucher_date: date,
        line_items: List[Dict]
    ) -> List[str]:
        """
        Create inventory movements for purchase invoice
        
        Increments stock for goods (positive quantity)
        Skips services and non-tracked items
        
        Args:
            db: Database session
            voucher_id: Voucher UUID
            company_id: Company UUID
            voucher_date: Transaction date
            line_items: List of line item dictionaries
            
        Returns:
            List of created movement IDs
        """
        try:
            movement_ids = []
            
            for item in line_items:
                product_id = item.get('product_id')
                if not product_id:
                    continue
                
                # Check if product tracks inventory
                product_query = text("""
                    SELECT product_type, track_inventory
                    FROM products
                    WHERE id = :product_id
                    AND company_id = :company_id
                    AND deleted_at IS NULL
                """)
                product_result = db.execute(product_query, {
                    "product_id": product_id,
                    "company_id": company_id
                }).fetchone()
                
                if not product_result:
                    logger.warning(f"Product {product_id} not found")
                    continue
                
                # Skip services and non-tracked items
                if product_result.product_type == 'service' or not product_result.track_inventory:
                    continue
                
                # Get quantity
                quantity = Decimal(str(item.get('quantity', 0)))
                if quantity <= 0:
                    continue
                
                # Create movement (positive quantity for purchases)
                movement_id = self._create_movement(
                    db=db,
                    company_id=company_id,
                    product_id=product_id,
                    voucher_id=voucher_id,
                    movement_type='purchase',
                    movement_date=voucher_date,
                    quantity=quantity,  # Positive for inward
                    rate=Decimal(str(item.get('rate', 0))),
                    value=Decimal(str(item.get('taxable_amount', 0)))
                )
                
                movement_ids.append(movement_id)
            
            logger.info(f"Created {len(movement_ids)} inventory movements for voucher {voucher_id}")
            return movement_ids
            
        except Exception as e:
            logger.error(f"Error creating inventory movements for voucher {voucher_id}: {e}")
            raise
    
    def reverse_movements(
        self,
        db: Session,
        voucher_id: str
    ) -> int:
        """
        Reverse all inventory movements for a voucher
        
        Args:
            db: Database session
            voucher_id: Voucher UUID
            
        Returns:
            Number of movements reversed
        """
        try:
            # Get all movements for this voucher
            query = text("""
                SELECT id, product_id, movement_type, movement_date, 
                       quantity, rate, value
                FROM inventory_movements
                WHERE voucher_id = :voucher_id
            """)
            movements = db.execute(query, {"voucher_id": voucher_id}).fetchall()
            
            if not movements:
                logger.warning(f"No inventory movements found for voucher {voucher_id}")
                return 0
            
            # Create reversing movements (negate quantity)
            for movement in movements:
                reverse_query = text("""
                    INSERT INTO inventory_movements (
                        id, company_id, product_id, voucher_id,
                        movement_type, movement_date, quantity, rate, value,
                        created_at
                    )
                    SELECT 
                        :new_id, company_id, product_id, voucher_id,
                        :reverse_type, movement_date, -quantity, rate, -value,
                        NOW()
                    FROM inventory_movements
                    WHERE id = :movement_id
                """)
                
                reverse_type = 'sale_return' if movement.movement_type == 'sale' else 'purchase_return'
                
                db.execute(reverse_query, {
                    "new_id": str(uuid.uuid4()),
                    "movement_id": str(movement.id),
                    "reverse_type": reverse_type
                })
            
            logger.info(f"Reversed {len(movements)} inventory movements for voucher {voucher_id}")
            return len(movements)
            
        except Exception as e:
            logger.error(f"Error reversing inventory movements for voucher {voucher_id}: {e}")
            raise
    
    def _create_movement(
        self,
        db: Session,
        company_id: str,
        product_id: str,
        voucher_id: str,
        movement_type: str,
        movement_date: date,
        quantity: Decimal,
        rate: Decimal,
        value: Decimal
    ) -> str:
        """Create a single inventory movement"""
        movement_id = str(uuid.uuid4())
        
        query = text("""
            INSERT INTO inventory_movements (
                id, company_id, product_id, voucher_id,
                movement_type, movement_date, quantity, rate, value,
                created_at
            ) VALUES (
                :id, :company_id, :product_id, :voucher_id,
                :movement_type, :movement_date, :quantity, :rate, :value,
                NOW()
            )
        """)
        
        db.execute(query, {
            "id": movement_id,
            "company_id": company_id,
            "product_id": product_id,
            "voucher_id": voucher_id,
            "movement_type": movement_type,
            "movement_date": movement_date,
            "quantity": float(quantity),
            "rate": float(rate),
            "value": float(value)
        })
        
        return movement_id
    
    def _get_available_stock(
        self,
        db: Session,
        product_id: str,
        company_id: str
    ) -> Decimal:
        """Get available stock for a product"""
        query = text("""
            SELECT 
                COALESCE(p.opening_stock, 0) + COALESCE(SUM(im.quantity), 0) as available_stock
            FROM products p
            LEFT JOIN inventory_movements im ON im.product_id = p.id
            WHERE p.id = :product_id
            AND p.company_id = :company_id
            AND p.deleted_at IS NULL
            GROUP BY p.id, p.opening_stock
        """)
        
        result = db.execute(query, {
            "product_id": product_id,
            "company_id": company_id
        }).fetchone()
        
        if not result:
            return Decimal('0')
        
        return Decimal(str(result.available_stock or 0))
    
    def get_stock_summary(
        self,
        db: Session,
        company_id: str,
        product_id: Optional[str] = None
    ) -> List[Dict]:
        """
        Get stock summary for products
        
        Args:
            db: Database session
            company_id: Company UUID
            product_id: Optional product UUID to filter
            
        Returns:
            List of stock summary dictionaries
        """
        query = """
            SELECT 
                p.id,
                p.product_code,
                p.product_name,
                p.opening_stock,
                COALESCE(SUM(CASE WHEN im.quantity > 0 THEN im.quantity ELSE 0 END), 0) as total_inward,
                COALESCE(SUM(CASE WHEN im.quantity < 0 THEN ABS(im.quantity) ELSE 0 END), 0) as total_outward,
                p.opening_stock + COALESCE(SUM(im.quantity), 0) as current_stock,
                p.reorder_level
            FROM products p
            LEFT JOIN inventory_movements im ON im.product_id = p.id
            WHERE p.company_id = :company_id
            AND p.track_inventory = TRUE
            AND p.deleted_at IS NULL
        """
        
        params = {"company_id": company_id}
        
        if product_id:
            query += " AND p.id = :product_id"
            params["product_id"] = product_id
        
        query += """
            GROUP BY p.id, p.product_code, p.product_name, p.opening_stock, p.reorder_level
            ORDER BY p.product_name
        """
        
        result = db.execute(text(query), params).fetchall()
        
        return [
            {
                "product_id": str(row.id),
                "product_code": row.product_code,
                "product_name": row.product_name,
                "opening_stock": float(row.opening_stock),
                "total_inward": float(row.total_inward),
                "total_outward": float(row.total_outward),
                "current_stock": float(row.current_stock),
                "reorder_level": float(row.reorder_level) if row.reorder_level else None,
                "needs_reorder": float(row.current_stock) <= float(row.reorder_level or 0)
            }
            for row in result
        ]


# Singleton instance
inventory_service = InventoryService()
