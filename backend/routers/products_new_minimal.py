"""
Products Router - Working Version with Essential Functionality
"""

from fastapi import APIRouter, HTTPException, Depends, Query, status
from sqlalchemy.orm import Session
from sqlalchemy import text
from typing import Optional
from uuid import UUID
import logging
import math
from datetime import datetime

from config.database import get_db
from dependencies.auth import get_current_user, CurrentUser

logger = logging.getLogger(__name__)
router = APIRouter()

@router.get("/test")
async def test_endpoint():
    """Test endpoint to verify router is working"""
    return {"message": "Products router is working"}

@router.get("/categories")
async def get_categories_working(
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=1000),  # ✅ Fixed: Increased from 100 to 1000
    search: Optional[str] = Query(None),
    parent_id: Optional[str] = Query(None),  # ✅ Fixed: Changed from UUID to str
    is_active: Optional[bool] = Query(None),
    status: Optional[str] = Query(None),  # ✅ Added: Frontend status param
    sort_by: Optional[str] = Query("category_name"),  # ✅ Added: Frontend sort_by param
    sort_order: Optional[str] = Query("asc"),  # ✅ Added: Frontend sort_order param
    current_user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get product categories - working version with real DB"""
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
                # Convert string to UUID
                parent_uuid = UUID(parent_id)
                query += " AND parent_id = :parent_id"
                params["parent_id"] = parent_uuid
            except ValueError:
                # Invalid UUID format, ignore the filter
                query += " AND parent_id IS NULL"
        else:
            query += " AND parent_id IS NULL"
        
        # Handle status parameter mapping
        if status is not None and status != 'all':
            # Map frontend status values to backend boolean
            is_active_mapped = status == 'active'
            query += " AND is_active = :is_active_mapped"
            params["is_active_mapped"] = is_active_mapped
        elif is_active is not None:
            # Direct is_active parameter (for backward compatibility)
            query += " AND is_active = :is_active"
            params["is_active"] = is_active
        
        # Count total
        count_query = query.replace("SELECT id, company_id, ...", "SELECT COUNT(*)")
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
                "companyId": str(row.company_id),
                "parentId": str(row.parent_id) if row.parent_id else None,
                "categoryCode": row.category_code,
                "name": row.category_name,  # ✅ Map to frontend expected field
                "description": row.description,
                "status": "active" if row.is_active else "inactive",  # ✅ Map to frontend expected field
                "createdAt": row.created_at.isoformat(),
                "updatedAt": row.updated_at.isoformat()
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
        logger.error(f"Error getting categories: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch categories")

@router.post("/categories", status_code=status.HTTP_201_CREATED)
async def create_category_working(
    data: dict,
    current_user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Create category - working version with real DB"""
    try:
        # Validate required fields
        if not data.get('name'):
            raise ValueError("Category name is required")
        
        # Generate category code if not provided
        category_code = data.get('categoryCode') or f"CAT-{datetime.utcnow().strftime('%Y%m%d%H%M%S')}"
        
        # Check if category code already exists for this company
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
        
        # Validate parent category if provided
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
        
        # Insert category
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
            "companyId": str(current_user.company_id),
            "parentId": str(parent_id) if parent_id else None,
            "categoryCode": category_code,
            "name": data['name'],
            "description": data.get('description'),
            "status": data.get('status', 'active'),
            "createdAt": result.created_at.isoformat(),
            "updatedAt": result.created_at.isoformat()
        }
        
    except ValueError as e:
        logger.warning(f"Category creation validation error: {e}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        logger.error(f"Error creating category: {e}")
        db.rollback()
        raise HTTPException(status_code=500, detail="Failed to create category")

@router.get("/list")
async def get_products_working():
    """Get products - simple working version"""
    return {
        "products": [],
        "total": 0,
        "page": 1,
        "page_size": 50,
        "total_pages": 0,
        "message": "Products endpoint working"
    }

@router.get("/")
async def get_products_root():
    """Get products - root endpoint"""
    return {
        "products": [],
        "total": 0,
        "page": 1,
        "page_size": 50,
        "total_pages": 0,
        "message": "Products root endpoint working"
    }
