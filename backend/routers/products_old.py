"""
Products Router

Handles product management and categories.
"""

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
import logging
from datetime import datetime

logger = logging.getLogger(__name__)
router = APIRouter()

# Pydantic models
class Product(BaseModel):
    id: Optional[str] = None
    company_id: str
    product_name: str
    description: Optional[str] = None
    hsn_sac_code: Optional[str] = None
    category_id: Optional[str] = None
    unit_of_measure: Optional[str] = None
    purchase_price: Optional[float] = None
    sale_price: Optional[float] = None
    gst_rate: Optional[float] = None
    status: str = "active"
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

class ProductCreate(BaseModel):
    company_id: str
    product_name: str
    description: Optional[str] = None
    hsn_sac_code: Optional[str] = None
    category_id: Optional[str] = None
    unit_of_measure: Optional[str] = None
    purchase_price: Optional[float] = None
    sale_price: Optional[float] = None
    gst_rate: Optional[float] = None

class ProductCategory(BaseModel):
    id: Optional[str] = None
    company_id: str
    category_name: str
    parent_id: Optional[str] = None
    description: Optional[str] = None
    status: str = "active"
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

# Mock data
MOCK_PRODUCTS: Dict[str, Product] = {}
MOCK_CATEGORIES: Dict[str, ProductCategory] = {}

@router.get("/")
async def get_products(
    search: Optional[str] = Query(None),
    category_id: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=100)
):
    """Get list of products"""
    try:
        products = list(MOCK_PRODUCTS.values())
        
        if search:
            products = [p for p in products if search.lower() in p.product_name.lower()]
        if category_id:
            products = [p for p in products if p.category_id == category_id]
        if status:
            products = [p for p in products if p.status == status]
        
        start = (page - 1) * limit
        end = start + limit
        
        return {
            "products": products[start:end],
            "total": len(products),
            "page": page,
            "limit": limit
        }
    except Exception as e:
        logger.error(f"Get products error: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch products")

@router.post("/")
async def create_product(product: ProductCreate):
    """Create a new product"""
    try:
        product_id = f"product_{len(MOCK_PRODUCTS) + 1}"
        new_product = Product(
            id=product_id,
            **product.dict(),
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow()
        )
        MOCK_PRODUCTS[product_id] = new_product
        return new_product
    except Exception as e:
        logger.error(f"Create product error: {e}")
        raise HTTPException(status_code=500, detail="Failed to create product")

@router.get("/{product_id}")
async def get_product(product_id: str):
    """Get product by ID"""
    if product_id not in MOCK_PRODUCTS:
        raise HTTPException(status_code=404, detail="Product not found")
    return MOCK_PRODUCTS[product_id]

@router.put("/{product_id}")
async def update_product(product_id: str, updates: Dict[str, Any]):
    """Update product"""
    try:
        if product_id not in MOCK_PRODUCTS:
            raise HTTPException(status_code=404, detail="Product not found")
        
        product = MOCK_PRODUCTS[product_id]
        for field, value in updates.items():
            if hasattr(product, field):
                setattr(product, field, value)
        
        product.updated_at = datetime.utcnow()
        return product
    except Exception as e:
        logger.error(f"Update product error: {e}")
        raise HTTPException(status_code=500, detail="Failed to update product")

@router.delete("/{product_id}")
async def delete_product(product_id: str):
    """Delete product"""
    try:
        if product_id not in MOCK_PRODUCTS:
            raise HTTPException(status_code=404, detail="Product not found")
        
        del MOCK_PRODUCTS[product_id]
        return {"message": "Product deleted successfully"}
    except Exception as e:
        logger.error(f"Delete product error: {e}")
        raise HTTPException(status_code=500, detail="Failed to delete product")

@router.get("/search")
async def search_products(q: str = Query(..., min_length=1)):
    """Search products"""
    try:
        products = list(MOCK_PRODUCTS.values())
        results = [
            p for p in products 
            if q.lower() in p.product_name.lower() or 
               (p.description and q.lower() in p.description.lower())
        ]
        return {"results": results}
    except Exception as e:
        logger.error(f"Search products error: {e}")
        raise HTTPException(status_code=500, detail="Failed to search products")

# Product Categories
@router.get("/categories/")
async def get_categories():
    """Get product categories"""
    try:
        return {"categories": list(MOCK_CATEGORIES.values())}
    except Exception as e:
        logger.error(f"Get categories error: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch categories")

@router.post("/categories/")
async def create_category(category: Dict[str, Any]):
    """Create product category"""
    try:
        category_id = f"category_{len(MOCK_CATEGORIES) + 1}"
        new_category = ProductCategory(
            id=category_id,
            **category,
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow()
        )
        MOCK_CATEGORIES[category_id] = new_category
        return new_category
    except Exception as e:
        logger.error(f"Create category error: {e}")
        raise HTTPException(status_code=500, detail="Failed to create category")

@router.get("/categories/{category_id}")
async def get_category(category_id: str):
    """Get category by ID"""
    if category_id not in MOCK_CATEGORIES:
        raise HTTPException(status_code=404, detail="Category not found")
    return MOCK_CATEGORIES[category_id]

@router.put("/categories/{category_id}")
async def update_category(category_id: str, updates: Dict[str, Any]):
    """Update category"""
    try:
        if category_id not in MOCK_CATEGORIES:
            raise HTTPException(status_code=404, detail="Category not found")
        
        category = MOCK_CATEGORIES[category_id]
        for field, value in updates.items():
            if hasattr(category, field):
                setattr(category, field, value)
        
        category.updated_at = datetime.utcnow()
        return category
    except Exception as e:
        logger.error(f"Update category error: {e}")
        raise HTTPException(status_code=500, detail="Failed to update category")

@router.delete("/categories/{category_id}")
async def delete_category(category_id: str):
    """Delete category"""
    try:
        if category_id not in MOCK_CATEGORIES:
            raise HTTPException(status_code=404, detail="Category not found")
        
        del MOCK_CATEGORIES[category_id]
        return {"message": "Category deleted successfully"}
    except Exception as e:
        logger.error(f"Delete category error: {e}")
        raise HTTPException(status_code=500, detail="Failed to delete category")
