"""
Sales Router

Handles sales invoices and related operations.
"""

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
import logging
from datetime import datetime

logger = logging.getLogger(__name__)
router = APIRouter()

class Sale(BaseModel):
    id: Optional[str] = None
    company_id: str
    customer_id: str
    invoice_number: str
    invoice_date: datetime
    items: List[Dict[str, Any]]
    total_amount: float
    gst_amount: float
    status: str = "draft"
    created_at: Optional[datetime] = None

# Mock data
MOCK_SALES: Dict[str, Sale] = {}

@router.get("/")
async def get_sales(
    status: Optional[str] = Query(None),
    customer: Optional[str] = Query(None),
    date_from: Optional[str] = Query(None),
    date_to: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=100)
):
    """Get list of sales"""
    try:
        sales = list(MOCK_SALES.values())
        
        if status:
            sales = [s for s in sales if s.status == status]
        if customer:
            sales = [s for s in sales if s.customer_id == customer]
        
        start = (page - 1) * limit
        end = start + limit
        
        return {
            "sales": sales[start:end],
            "total": len(sales),
            "page": page,
            "limit": limit
        }
    except Exception as e:
        logger.error(f"Get sales error: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch sales")

@router.post("/")
async def create_sale(sale: Dict[str, Any]):
    """Create a new sale"""
    try:
        sale_id = f"sale_{len(MOCK_SALES) + 1}"
        new_sale = Sale(
            id=sale_id,
            **sale,
            created_at=datetime.utcnow()
        )
        MOCK_SALES[sale_id] = new_sale
        return new_sale
    except Exception as e:
        logger.error(f"Create sale error: {e}")
        raise HTTPException(status_code=500, detail="Failed to create sale")

@router.get("/{sale_id}")
async def get_sale(sale_id: str):
    """Get sale by ID"""
    if sale_id not in MOCK_SALES:
        raise HTTPException(status_code=404, detail="Sale not found")
    return MOCK_SALES[sale_id]

@router.put("/{sale_id}")
async def update_sale(sale_id: str, updates: Dict[str, Any]):
    """Update sale"""
    try:
        if sale_id not in MOCK_SALES:
            raise HTTPException(status_code=404, detail="Sale not found")
        
        sale = MOCK_SALES[sale_id]
        for field, value in updates.items():
            if hasattr(sale, field):
                setattr(sale, field, value)
        
        return sale
    except Exception as e:
        logger.error(f"Update sale error: {e}")
        raise HTTPException(status_code=500, detail="Failed to update sale")

@router.delete("/{sale_id}")
async def delete_sale(sale_id: str):
    """Delete sale"""
    try:
        if sale_id not in MOCK_SALES:
            raise HTTPException(status_code=404, detail="Sale not found")
        
        del MOCK_SALES[sale_id]
        return {"message": "Sale deleted successfully"}
    except Exception as e:
        logger.error(f"Delete sale error: {e}")
        raise HTTPException(status_code=500, detail="Failed to delete sale")

@router.post("/generate")
async def generate_invoice():
    """Generate invoice"""
    # TODO: Implement invoice generation
    raise HTTPException(status_code=501, detail="Invoice generation not implemented yet")

@router.get("/kpis")
async def get_sale_kpis():
    """Get sales KPIs"""
    return {
        "total_sales": len(MOCK_SALES),
        "total_amount": sum(s.total_amount for s in MOCK_SALES.values()),
        "pending_count": len([s for s in MOCK_SALES.values() if s.status == "pending"]),
        "approved_count": len([s for s in MOCK_SALES.values() if s.status == "approved"])
    }

@router.get("/analytics")
async def get_sale_analytics():
    """Get sales analytics"""
    # TODO: Implement analytics
    raise HTTPException(status_code=501, detail="Analytics not implemented yet")
