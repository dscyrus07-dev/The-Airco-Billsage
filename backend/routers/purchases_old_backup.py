"""
Purchases Router

Handles purchase orders and bills.
"""

from fastapi import APIRouter, HTTPException, Query, UploadFile, File
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
import logging
from datetime import datetime

logger = logging.getLogger(__name__)
router = APIRouter()

class Purchase(BaseModel):
    id: Optional[str] = None
    company_id: str
    vendor_id: str
    purchase_number: str
    purchase_date: datetime
    items: List[Dict[str, Any]]
    total_amount: float
    gst_amount: float
    status: str = "draft"
    created_at: Optional[datetime] = None

# Mock data
MOCK_PURCHASES: Dict[str, Purchase] = {}

@router.get("/")
async def get_purchases(
    status: Optional[str] = Query(None),
    vendor: Optional[str] = Query(None),
    date_from: Optional[str] = Query(None),
    date_to: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=100)
):
    """Get list of purchases"""
    try:
        purchases = list(MOCK_PURCHASES.values())
        
        if status:
            purchases = [p for p in purchases if p.status == status]
        if vendor:
            purchases = [p for p in purchases if p.vendor_id == vendor]
        
        start = (page - 1) * limit
        end = start + limit
        
        return {
            "purchases": purchases[start:end],
            "total": len(purchases),
            "page": page,
            "limit": limit
        }
    except Exception as e:
        logger.error(f"Get purchases error: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch purchases")

@router.post("/")
async def create_purchase(purchase: Dict[str, Any]):
    """Create a new purchase"""
    try:
        purchase_id = f"purchase_{len(MOCK_PURCHASES) + 1}"
        new_purchase = Purchase(
            id=purchase_id,
            **purchase,
            created_at=datetime.utcnow()
        )
        MOCK_PURCHASES[purchase_id] = new_purchase
        return new_purchase
    except Exception as e:
        logger.error(f"Create purchase error: {e}")
        raise HTTPException(status_code=500, detail="Failed to create purchase")

@router.get("/{purchase_id}")
async def get_purchase(purchase_id: str):
    """Get purchase by ID"""
    if purchase_id not in MOCK_PURCHASES:
        raise HTTPException(status_code=404, detail="Purchase not found")
    return MOCK_PURCHASES[purchase_id]

@router.put("/{purchase_id}")
async def update_purchase(purchase_id: str, updates: Dict[str, Any]):
    """Update purchase"""
    try:
        if purchase_id not in MOCK_PURCHASES:
            raise HTTPException(status_code=404, detail="Purchase not found")
        
        purchase = MOCK_PURCHASES[purchase_id]
        for field, value in updates.items():
            if hasattr(purchase, field):
                setattr(purchase, field, value)
        
        return purchase
    except Exception as e:
        logger.error(f"Update purchase error: {e}")
        raise HTTPException(status_code=500, detail="Failed to update purchase")

@router.delete("/{purchase_id}")
async def delete_purchase(purchase_id: str):
    """Delete purchase"""
    try:
        if purchase_id not in MOCK_PURCHASES:
            raise HTTPException(status_code=404, detail="Purchase not found")
        
        del MOCK_PURCHASES[purchase_id]
        return {"message": "Purchase deleted successfully"}
    except Exception as e:
        logger.error(f"Delete purchase error: {e}")
        raise HTTPException(status_code=500, detail="Failed to delete purchase")

@router.post("/upload")
async def upload_purchase_bill(file: UploadFile = File(...)):
    """Upload purchase bill"""
    # TODO: Implement file upload
    raise HTTPException(status_code=501, detail="File upload not implemented yet")

@router.post("/{purchase_id}/approve")
async def approve_purchase(purchase_id: str):
    """Approve purchase"""
    try:
        if purchase_id not in MOCK_PURCHASES:
            raise HTTPException(status_code=404, detail="Purchase not found")
        
        MOCK_PURCHASES[purchase_id].status = "approved"
        return {"message": "Purchase approved successfully"}
    except Exception as e:
        logger.error(f"Approve purchase error: {e}")
        raise HTTPException(status_code=500, detail="Failed to approve purchase")

@router.post("/{purchase_id}/reject")
async def reject_purchase(purchase_id: str):
    """Reject purchase"""
    try:
        if purchase_id not in MOCK_PURCHASES:
            raise HTTPException(status_code=404, detail="Purchase not found")
        
        MOCK_PURCHASES[purchase_id].status = "rejected"
        return {"message": "Purchase rejected successfully"}
    except Exception as e:
        logger.error(f"Reject purchase error: {e}")
        raise HTTPException(status_code=500, detail="Failed to reject purchase")

@router.get("/kpis")
async def get_purchase_kpis():
    """Get purchase KPIs"""
    return {
        "total_purchases": len(MOCK_PURCHASES),
        "total_amount": sum(p.total_amount for p in MOCK_PURCHASES.values()),
        "pending_count": len([p for p in MOCK_PURCHASES.values() if p.status == "pending"]),
        "approved_count": len([p for p in MOCK_PURCHASES.values() if p.status == "approved"])
    }

@router.get("/analytics")
async def get_purchase_analytics():
    """Get purchase analytics"""
    # TODO: Implement analytics
    raise HTTPException(status_code=501, detail="Analytics not implemented yet")
