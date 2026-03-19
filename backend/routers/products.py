"""
Products Router - Complete Implementation

Handles products and categories with full CRUD operations.
All operations are tenant-scoped and use real database integration.
"""

from fastapi import APIRouter, HTTPException, Depends, Query, status
from sqlalchemy.orm import Session
from sqlalchemy import text
from typing import Optional, List, Dict, Any
from uuid import UUID
import logging
import math
from datetime import datetime

from config.database import get_db
from dependencies.auth import get_current_user, CurrentUser

logger = logging.getLogger(__name__)
router = APIRouter()

# ============================================================================
# PRODUCT CATEGORY ENDPOINTS
# ============================================================================

@router.get("/categories")
async def get_categories(
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=1000),
    search: Optional[str] = Query(None),
    parent_id: Optional[str] = Query(None),
    is_active: Optional[bool] = Query(None),
    status: Optional[str] = Query(None),
    sort_by: Optional[str] = Query("category_name"),
    sort_order: Optional[str] = Query("asc"),
    current_user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get product categories with filtering and pagination"""
    try:
        # Build query for current company's categories
        query = """
            SELECT 
                id,
                company_id,
                parent_id,
                category_code,
                category_name,
                description,
                is_active,
                created_by,
                updated_by,
                created_at,
                updated_at,
                deleted_at
            FROM product_categories 
            WHERE company_id = :company_id 
            AND deleted_at IS NULL
        """
        
        params = {"company_id": current_user.company_id}
        
        if search:
            query += " AND (category_name ILIKE :search OR description ILIKE :search)"
            params["search"] = f"%{search}%"
        
        if parent_id:
            try:
                parent_uuid = UUID(parent_id)
                query += " AND parent_id = :parent_id"
                params["parent_id"] = parent_uuid
            except ValueError:
                query += " AND parent_id IS NULL"
        
        if status is not None and status != 'all':
            is_active_mapped = status == 'active'
            query += " AND is_active = :is_active_mapped"
            params["is_active_mapped"] = is_active_mapped
        elif is_active is not None:
            query += " AND is_active = :is_active"
            params["is_active"] = is_active
        
        # Count total
        count_query = f"SELECT COUNT(*) FROM ({query}) AS subquery"
        count_result = db.execute(text(count_query), params).fetchone()
        total = count_result[0] if count_result else 0
        
        # Add sorting and pagination
        allowed_sort_fields = ["category_name", "created_at", "updated_at", "category_code"]
        sort_field = sort_by if sort_by in allowed_sort_fields else "category_name"
        sort_direction = "ASC" if sort_order.lower() == "asc" else "DESC"
        
        query += f" ORDER BY {sort_field} {sort_direction} LIMIT :limit OFFSET :offset"
        params["limit"] = page_size
        params["offset"] = (page - 1) * page_size
        
        result = db.execute(text(query), params).fetchall()
        
        categories = []
        for row in result:
            categories.append({
                "id": str(row.id),
                "company_id": str(row.company_id),
                "parent_id": str(row.parent_id) if row.parent_id else None,
                "category_code": row.category_code,
                "name": row.category_name,
                "description": row.description,
                "status": "active" if row.is_active else "inactive",
                "created_at": row.created_at.isoformat(),
                "updated_at": row.updated_at.isoformat()
            })
        
        total_pages = math.ceil(total / page_size) if total > 0 else 0
        
        return {
            "categories": categories,
            "total": total,
            "page": page,
            "page_size": page_size,
            "total_pages": total_pages
        }
        
    except Exception as e:
        logger.error(f"Error getting categories: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to fetch categories: {str(e)}")

@router.post("/categories", status_code=status.HTTP_201_CREATED)
async def create_category(
    data: Dict[str, Any],
    current_user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Create a new product category"""
    try:
        if not data.get('name'):
            raise ValueError("Category name is required")
        
        category_code = data.get('categoryCode') or f"CAT-{datetime.utcnow().strftime('%Y%m%d%H%M%S')}"
        
        # Check if category code already exists
        existing_query = text("""
            SELECT id FROM product_categories 
            WHERE company_id = :company_id AND category_code = :category_code AND deleted_at IS NULL
        """)
        existing = db.execute(existing_query, {
            "company_id": current_user.company_id,
            "category_code": category_code
        }).fetchone()
        
        if existing:
            raise ValueError("Category code already exists")
        
        parent_id = data.get('parentId')
        if parent_id:
            parent_query = text("""
                SELECT id FROM product_categories 
                WHERE id = :parent_id AND company_id = :company_id AND deleted_at IS NULL
            """)
            parent = db.execute(parent_query, {
                "parent_id": parent_id,
                "company_id": current_user.company_id
            }).fetchone()
            
            if not parent:
                raise ValueError("Invalid parent category")
        
        insert_query = text("""
            INSERT INTO product_categories (
                company_id, parent_id, category_code, category_name, description,
                is_active, created_by, created_at, updated_at
            ) VALUES (
                :company_id, :parent_id, :category_code, :category_name, :description,
                :is_active, :created_by, NOW(), NOW()
            )
            RETURNING id, created_at
        """)
        
        result = db.execute(insert_query, {
            "company_id": current_user.company_id,
            "parent_id": parent_id,
            "category_code": category_code,
            "category_name": data['name'],
            "description": data.get('description'),
            "is_active": data.get('status', 'active') == 'active',
            "created_by": current_user.user_id
        }).fetchone()
        
        db.commit()
        
        return {
            "id": str(result.id),
            "company_id": str(current_user.company_id),
            "parent_id": str(parent_id) if parent_id else None,
            "category_code": category_code,
            "name": data['name'],
            "description": data.get('description'),
            "status": data.get('status', 'active'),
            "created_at": result.created_at.isoformat(),
            "updated_at": result.created_at.isoformat()
        }
        
    except ValueError as e:
        logger.warning(f"Category creation validation error: {e}")
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        logger.error(f"Error creating category: {e}", exc_info=True)
        db.rollback()
        raise HTTPException(status_code=500, detail="Failed to create category")

@router.get("/categories/{category_id}")
async def get_category(
    category_id: UUID,
    current_user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get category by ID"""
    try:
        query = text("""
            SELECT 
                id, company_id, parent_id, category_code, category_name, description,
                is_active, created_by, updated_by, created_at, updated_at, deleted_at
            FROM product_categories 
            WHERE id = :category_id 
            AND company_id = :company_id 
            AND deleted_at IS NULL
        """)
        
        result = db.execute(query, {
            "category_id": category_id,
            "company_id": current_user.company_id
        }).fetchone()
        
        if not result:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Category not found")
        
        return {
            "id": str(result.id),
            "company_id": str(result.company_id),
            "parent_id": str(result.parent_id) if result.parent_id else None,
            "category_code": result.category_code,
            "name": result.category_name,
            "description": result.description,
            "status": "active" if result.is_active else "inactive",
            "created_at": result.created_at.isoformat(),
            "updated_at": result.updated_at.isoformat()
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting category: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to fetch category")

@router.patch("/categories/{category_id}")
async def update_category(
    category_id: UUID,
    data: Dict[str, Any],
    current_user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update category"""
    try:
        check_query = text("""
            SELECT id FROM product_categories 
            WHERE id = :category_id AND company_id = :company_id AND deleted_at IS NULL
        """)
        existing = db.execute(check_query, {
            "category_id": category_id,
            "company_id": current_user.company_id
        }).fetchone()
        
        if not existing:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Category not found")
        
        update_fields = []
        params = {"category_id": category_id, "company_id": current_user.company_id, "updated_by": current_user.user_id}
        
        field_mapping = {
            'name': 'category_name',
            'description': 'description',
            'parentId': 'parent_id'
        }
        
        for frontend_field, db_field in field_mapping.items():
            if frontend_field in data:
                update_fields.append(f"{db_field} = :{frontend_field}")
                params[frontend_field] = data[frontend_field]
        
        if 'status' in data:
            update_fields.append("is_active = :is_active")
            params["is_active"] = data['status'] == 'active'
        
        if update_fields:
            update_fields.append("updated_by = :updated_by")
            update_fields.append("updated_at = NOW()")
            
            update_query = text(f"""
                UPDATE product_categories 
                SET {', '.join(update_fields)}
                WHERE id = :category_id AND company_id = :company_id
            """)
            
            db.execute(update_query, params)
            db.commit()
        
        return await get_category(category_id, current_user, db)
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating category: {e}", exc_info=True)
        db.rollback()
        raise HTTPException(status_code=500, detail="Failed to update category")

@router.delete("/categories/{category_id}")
async def delete_category(
    category_id: UUID,
    current_user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Delete category (soft delete)"""
    try:
        check_query = text("""
            SELECT id FROM product_categories 
            WHERE id = :category_id AND company_id = :company_id AND deleted_at IS NULL
        """)
        existing = db.execute(check_query, {
            "category_id": category_id,
            "company_id": current_user.company_id
        }).fetchone()
        
        if not existing:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Category not found")
        
        delete_query = text("""
            UPDATE product_categories 
            SET deleted_at = NOW(), updated_by = :updated_by, updated_at = NOW()
            WHERE id = :category_id AND company_id = :company_id
        """)
        
        db.execute(delete_query, {
            "category_id": category_id,
            "company_id": current_user.company_id,
            "updated_by": current_user.user_id
        })
        db.commit()
        
        return {"success": True, "message": "Category deleted successfully"}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting category: {e}", exc_info=True)
        db.rollback()
        raise HTTPException(status_code=500, detail="Failed to delete category")

# ============================================================================
# PRODUCT ENDPOINTS
# ============================================================================

@router.get("")  # Primary route without trailing slash
@router.get("/", include_in_schema=False)  # Fallback with trailing slash
async def get_products(
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=1000),
    search: Optional[str] = Query(None),
    category_id: Optional[str] = Query(None),
    type: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    sort_by: Optional[str] = Query("product_name"),
    sort_order: Optional[str] = Query("asc"),
    current_user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get products with filtering and pagination"""
    try:
        query = """
            SELECT 
                p.id,
                p.company_id,
                p.category_id,
                p.product_code,
                p.product_name,
                p.description,
                p.product_type,
                p.hsn_sac_code,
                p.purchase_price,
                p.selling_price,
                p.mrp,
                p.is_active,
                p.created_at,
                p.updated_at,
                pc.category_name
            FROM products p
            LEFT JOIN product_categories pc ON p.category_id = pc.id
            WHERE p.company_id = :company_id 
            AND p.deleted_at IS NULL
        """
        
        params = {"company_id": current_user.company_id}
        
        if search:
            query += " AND (p.product_name ILIKE :search OR p.description ILIKE :search OR p.product_code ILIKE :search)"
            params["search"] = f"%{search}%"
        
        if category_id:
            try:
                category_uuid = UUID(category_id)
                query += " AND p.category_id = :category_id"
                params["category_id"] = category_uuid
            except ValueError:
                pass
        
        if type and type != 'all':
            query += " AND p.product_type = :type"
            params["type"] = type
        
        if status is not None and status != 'all':
            is_active_mapped = status == 'active'
            query += " AND p.is_active = :is_active"
            params["is_active"] = is_active_mapped
        
        # Count total
        count_query = f"SELECT COUNT(*) FROM ({query}) AS subquery"
        count_result = db.execute(text(count_query), params).fetchone()
        total = count_result[0] if count_result else 0
        
        # Add sorting and pagination
        allowed_sort_fields = ["product_name", "product_code", "created_at", "updated_at", "selling_price"]
        sort_field = f"p.{sort_by}" if sort_by in allowed_sort_fields else "p.product_name"
        sort_direction = "ASC" if sort_order.lower() == "asc" else "DESC"
        
        query += f" ORDER BY {sort_field} {sort_direction} LIMIT :limit OFFSET :offset"
        params["limit"] = page_size
        params["offset"] = (page - 1) * page_size
        
        result = db.execute(text(query), params).fetchall()
        
        products = []
        for row in result:
            products.append({
                "id": str(row.id),
                "company_id": str(row.company_id),
                "category_id": str(row.category_id) if row.category_id else None,
                "product_code": row.product_code,
                "name": row.product_name,
                "description": row.description,
                "type": row.product_type,
                "hsn_sac": row.hsn_sac_code,
                "purchase_price": float(row.purchase_price) if row.purchase_price else 0,
                "sale_price": float(row.selling_price) if row.selling_price else 0,
                "mrp": float(row.mrp) if row.mrp else None,
                "status": "active" if row.is_active else "inactive",
                "created_at": row.created_at.isoformat(),
                "updated_at": row.updated_at.isoformat(),
                "category_name": row.category_name
            })
        
        total_pages = math.ceil(total / page_size) if total > 0 else 0
        
        return {
            "products": products,
            "total": total,
            "page": page,
            "page_size": page_size,
            "total_pages": total_pages
        }
        
    except Exception as e:
        logger.error(f"Error getting products: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to fetch products: {str(e)}")

@router.post("", status_code=status.HTTP_201_CREATED)  # Primary route without trailing slash
@router.post("/", status_code=status.HTTP_201_CREATED, include_in_schema=False)  # Fallback with trailing slash
async def create_product(
    data: Dict[str, Any],
    current_user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Create a new product"""
    try:
        logger.info(f"Creating product with data: {data}")
        
        # Accept both snake_case (from frontend) and camelCase (legacy)
        name = data.get('name')
        if not name:
            raise ValueError("Product name is required")
        
        # Support both field naming conventions
        category_id = data.get('category_id') or data.get('categoryId')
        sku = data.get('sku')
        hsn_sac = data.get('hsn_sac') or data.get('hsnSac')
        purchase_price = data.get('purchase_price') or data.get('purchasePrice') or 0
        sale_price = data.get('sale_price') or data.get('salePrice') or 0
        gst_percent = data.get('gst_percent') or data.get('gstPercent') or 0
        
        # Validate and normalize product_type
        VALID_PRODUCT_TYPES = ['goods', 'service', 'combo']
        product_type = data.get('type', 'goods')
        
        # Handle backward compatibility: map 'product' to 'goods'
        if product_type == 'product':
            logger.warning(f"Deprecated product_type 'product' received, mapping to 'goods'")
            product_type = 'goods'
        
        # Validate final product_type
        if product_type not in VALID_PRODUCT_TYPES:
            logger.error(f"Invalid product_type received: {product_type}")
            raise ValueError(f"Invalid product type: {product_type}. Must be one of: {VALID_PRODUCT_TYPES}")
        
        logger.info(f"Validated product_type: {product_type}")
        
        product_code = sku or f"PRD-{datetime.utcnow().strftime('%Y%m%d%H%M%S')}"
        
        # Check if product code already exists
        existing_query = text("""
            SELECT id FROM products 
            WHERE company_id = :company_id AND product_code = :product_code AND deleted_at IS NULL
        """)
        existing = db.execute(existing_query, {
            "company_id": current_user.company_id,
            "product_code": product_code
        }).fetchone()
        
        if existing:
            raise ValueError("Product code already exists")
        
        insert_query = text("""
            INSERT INTO products (
                company_id, category_id, product_code, product_name, description,
                product_type, hsn_sac_code, purchase_price, selling_price, mrp,
                is_active, created_by, created_at, updated_at
            ) VALUES (
                :company_id, :category_id, :product_code, :product_name, :description,
                :product_type, :hsn_sac_code, :purchase_price, :selling_price, :mrp,
                :is_active, :created_by, NOW(), NOW()
            )
            RETURNING id, created_at
        """)
        
        result = db.execute(insert_query, {
            "company_id": current_user.company_id,
            "category_id": category_id,
            "product_code": product_code,
            "product_name": name,
            "description": data.get('description'),
            "product_type": product_type,
            "hsn_sac_code": hsn_sac,
            "purchase_price": purchase_price,
            "selling_price": sale_price,
            "mrp": data.get('mrp'),
            "is_active": data.get('status', 'active') == 'active',
            "created_by": current_user.user_id
        }).fetchone()
        
        db.commit()
        
        logger.info(f"Product created successfully: {result.id}")
        
        return {
            "id": str(result.id),
            "company_id": str(current_user.company_id),
            "category_id": str(category_id) if category_id else None,
            "product_code": product_code,
            "name": name,
            "description": data.get('description'),
            "type": data.get('type', 'goods'),
            "hsn_sac": hsn_sac,
            "purchase_price": purchase_price,
            "sale_price": sale_price,
            "mrp": data.get('mrp'),
            "status": data.get('status', 'active'),
            "created_at": result.created_at.isoformat(),
            "updated_at": result.created_at.isoformat()
        }
        
    except ValueError as e:
        logger.warning(f"Product creation validation error: {e}")
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(e))
    except Exception as e:
        # Check for database constraint violations
        error_str = str(e).lower()
        if "check constraint" in error_str and "product_type" in error_str:
            logger.error(f"Database constraint violation for product_type: {e}", exc_info=True)
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"Invalid product type. Must be one of: goods, service, combo"
            )
        else:
            logger.error(f"Error creating product: {e}", exc_info=True)
            db.rollback()
            raise HTTPException(status_code=500, detail=f"Failed to create product: {str(e)}")

@router.get("/{product_id}")
async def get_product(
    product_id: UUID,
    current_user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get product by ID"""
    try:
        query = text("""
            SELECT 
                p.id, p.company_id, p.category_id, p.product_code, p.product_name, 
                p.description, p.product_type, p.hsn_sac_code, p.purchase_price, 
                p.selling_price, p.mrp, p.is_active, p.created_at, p.updated_at,
                pc.category_name
            FROM products p
            LEFT JOIN product_categories pc ON p.category_id = pc.id
            WHERE p.id = :product_id 
            AND p.company_id = :company_id 
            AND p.deleted_at IS NULL
        """)
        
        result = db.execute(query, {
            "product_id": product_id,
            "company_id": current_user.company_id
        }).fetchone()
        
        if not result:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product not found")
        
        return {
            "id": str(result.id),
            "company_id": str(result.company_id),
            "category_id": str(result.category_id) if result.category_id else None,
            "product_code": result.product_code,
            "name": result.product_name,
            "description": result.description,
            "type": result.product_type,
            "hsn_sac": result.hsn_sac_code,
            "purchase_price": float(result.purchase_price) if result.purchase_price else 0,
            "sale_price": float(result.selling_price) if result.selling_price else 0,
            "mrp": float(result.mrp) if result.mrp else None,
            "status": "active" if result.is_active else "inactive",
            "created_at": result.created_at.isoformat(),
            "updated_at": result.updated_at.isoformat(),
            "category_name": result.category_name
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting product: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to fetch product")

@router.patch("/{product_id}")
async def update_product(
    product_id: UUID,
    data: Dict[str, Any],
    current_user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update product"""
    try:
        check_query = text("""
            SELECT id FROM products 
            WHERE id = :product_id AND company_id = :company_id AND deleted_at IS NULL
        """)
        existing = db.execute(check_query, {
            "product_id": product_id,
            "company_id": current_user.company_id
        }).fetchone()
        
        if not existing:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product not found")
        
        update_fields = []
        params = {"product_id": product_id, "company_id": current_user.company_id, "updated_by": current_user.user_id}
        
        field_mapping = {
            'name': 'product_name',
            'description': 'description',
            'categoryId': 'category_id',
            'type': 'product_type',
            'hsnSac': 'hsn_sac_code',
            'purchasePrice': 'purchase_price',
            'salePrice': 'selling_price',
            'mrp': 'mrp'
        }
        
        for frontend_field, db_field in field_mapping.items():
            if frontend_field in data:
                update_fields.append(f"{db_field} = :{frontend_field}")
                params[frontend_field] = data[frontend_field]
        
        if 'status' in data:
            update_fields.append("is_active = :is_active")
            params["is_active"] = data['status'] == 'active'
        
        if update_fields:
            update_fields.append("updated_by = :updated_by")
            update_fields.append("updated_at = NOW()")
            
            update_query = text(f"""
                UPDATE products 
                SET {', '.join(update_fields)}
                WHERE id = :product_id AND company_id = :company_id
            """)
            
            db.execute(update_query, params)
            db.commit()
        
        return await get_product(product_id, current_user, db)
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating product: {e}", exc_info=True)
        db.rollback()
        raise HTTPException(status_code=500, detail="Failed to update product")

@router.delete("/{product_id}")
async def delete_product(
    product_id: UUID,
    current_user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Delete product (soft delete)"""
    try:
        check_query = text("""
            SELECT id FROM products 
            WHERE id = :product_id AND company_id = :company_id AND deleted_at IS NULL
        """)
        existing = db.execute(check_query, {
            "product_id": product_id,
            "company_id": current_user.company_id
        }).fetchone()
        
        if not existing:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product not found")
        
        delete_query = text("""
            UPDATE products 
            SET deleted_at = NOW(), updated_by = :updated_by, updated_at = NOW()
            WHERE id = :product_id AND company_id = :company_id
        """)
        
        db.execute(delete_query, {
            "product_id": product_id,
            "company_id": current_user.company_id,
            "updated_by": current_user.user_id
        })
        db.commit()
        
        return {"success": True, "message": "Product deleted successfully"}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting product: {e}", exc_info=True)
        db.rollback()
        raise HTTPException(status_code=500, detail="Failed to delete product")

@router.get("/search")
async def search_products(
    q: str = Query(..., min_length=1),
    limit: int = Query(20, ge=1, le=100),
    current_user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Search products by name, code, or HSN/SAC"""
    try:
        query = text("""
            SELECT 
                id, product_code, product_name, hsn_sac_code, 
                selling_price, purchase_price, product_type
            FROM products
            WHERE company_id = :company_id 
            AND deleted_at IS NULL
            AND is_active = TRUE
            AND (
                product_name ILIKE :search 
                OR product_code ILIKE :search 
                OR hsn_sac_code ILIKE :search
            )
            ORDER BY product_name
            LIMIT :limit
        """)
        
        result = db.execute(query, {
            "company_id": current_user.company_id,
            "search": f"%{q}%",
            "limit": limit
        }).fetchall()
        
        results = []
        for row in result:
            results.append({
                "id": str(row.id),
                "name": row.product_name,
                "sku": row.product_code,
                "hsn_sac": row.hsn_sac_code,
                "sale_price": float(row.selling_price) if row.selling_price else 0,
                "purchase_price": float(row.purchase_price) if row.purchase_price else 0,
                "type": row.product_type
            })
        
        return {
            "results": results,
            "total": len(results)
        }
        
    except Exception as e:
        logger.error(f"Error searching products: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to search products")
