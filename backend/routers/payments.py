"""
Payments Router

Handles payment records and related operations.
"""

from fastapi import APIRouter, HTTPException, Query, UploadFile, File
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
import logging
from datetime import datetime

logger = logging.getLogger(__name__)
router = APIRouter()

class Payment(BaseModel):
    id: Optional[str] = None
    company_id: str
    party_id: str
    payment_type: str  # 'payment' or 'receipt'
    amount: float
    payment_date: datetime
    reference_number: Optional[str] = None
    notes: Optional[str] = None
    status: str = "pending"
    created_at: Optional[datetime] = None

# Mock data
MOCK_PAYMENTS: Dict[str, Payment] = {}

@router.get("/")
async def get_payments(
    payment_type: Optional[str] = Query(None),
    party_id: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=100)
):
    """Get list of payments"""
    try:
        payments = list(MOCK_PAYMENTS.values())
        
        if payment_type:
            payments = [p for p in payments if p.payment_type == payment_type]
        if party_id:
            payments = [p for p in payments if p.party_id == party_id]
        if status:
            payments = [p for p in payments if p.status == status]
        
        start = (page - 1) * limit
        end = start + limit
        
        return {
            "payments": payments[start:end],
            "total": len(payments),
            "page": page,
            "limit": limit
        }
    except Exception as e:
        logger.error(f"Get payments error: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch payments")

@router.post("/")
async def create_payment(payment: Dict[str, Any]):
    """Create a new payment"""
    try:
        payment_id = f"payment_{len(MOCK_PAYMENTS) + 1}"
        new_payment = Payment(
            id=payment_id,
            **payment,
            created_at=datetime.utcnow()
        )
        MOCK_PAYMENTS[payment_id] = new_payment
        return new_payment
    except Exception as e:
        logger.error(f"Create payment error: {e}")
        raise HTTPException(status_code=500, detail="Failed to create payment")

@router.get("/{payment_id}")
async def get_payment(payment_id: str):
    """Get payment by ID"""
    if payment_id not in MOCK_PAYMENTS:
        raise HTTPException(status_code=404, detail="Payment not found")
    return MOCK_PAYMENTS[payment_id]

@router.put("/{payment_id}")
async def update_payment(payment_id: str, updates: Dict[str, Any]):
    """Update payment"""
    try:
        if payment_id not in MOCK_PAYMENTS:
            raise HTTPException(status_code=404, detail="Payment not found")
        
        payment = MOCK_PAYMENTS[payment_id]
        for field, value in updates.items():
            if hasattr(payment, field):
                setattr(payment, field, value)
        
        return payment
    except Exception as e:
        logger.error(f"Update payment error: {e}")
        raise HTTPException(status_code=500, detail="Failed to update payment")

@router.delete("/{payment_id}")
async def delete_payment(payment_id: str):
    """Delete payment"""
    try:
        if payment_id not in MOCK_PAYMENTS:
            raise HTTPException(status_code=404, detail="Payment not found")
        
        del MOCK_PAYMENTS[payment_id]
        return {"message": "Payment deleted successfully"}
    except Exception as e:
        logger.error(f"Delete payment error: {e}")
        raise HTTPException(status_code=500, detail="Failed to delete payment")

@router.post("/record")
async def record_payment(payment_data: Dict[str, Any]):
    """Record a payment"""
    # TODO: Implement payment recording
    raise HTTPException(status_code=501, detail="Payment recording not implemented yet")

@router.post("/upload-proof")
async def upload_payment_proof(file: UploadFile = File(...)):
    """Upload payment proof"""
    # TODO: Implement file upload
    raise HTTPException(status_code=501, detail="File upload not implemented yet")
