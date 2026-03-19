"""
Receivables Router

Handles receivables, payables, and aging reports.
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
import logging
from datetime import datetime

logger = logging.getLogger(__name__)
router = APIRouter()

class Receivable(BaseModel):
    id: Optional[str] = None
    company_id: str
    customer_id: str
    invoice_id: str
    amount: float
    pending_amount: float
    due_date: datetime
    days_overdue: int
    status: str

class AgingBucket(BaseModel):
    bucket: str
    amount: float
    count: int
    percentage: float

# Mock data
MOCK_RECEIVABLES: Dict[str, Receivable] = {}

@router.get("/")
async def get_receivables():
    """Get receivables list"""
    try:
        return {"receivables": list(MOCK_RECEIVABLES.values())}
    except Exception as e:
        logger.error(f"Get receivables error: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch receivables")

@router.get("/aging")
async def get_aging_report():
    """Get aging report"""
    try:
        # Mock aging data
        aging = [
            AgingBucket(bucket="0-30 days", amount=50000, count=5, percentage=25.0),
            AgingBucket(bucket="31-60 days", amount=30000, count=3, percentage=15.0),
            AgingBucket(bucket="61-90 days", amount=20000, count=2, percentage=10.0),
            AgingBucket(bucket="90+ days", amount=10000, count=1, percentage=5.0),
        ]
        return {"aging": aging}
    except Exception as e:
        logger.error(f"Get aging report error: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch aging report")

@router.get("/summary")
async def get_receivables_summary():
    """Get receivables summary"""
    try:
        total_receivable = sum(r.pending_amount for r in MOCK_RECEIVABLES.values())
        return {
            "total_receivable": total_receivable,
            "total_invoices": len(MOCK_RECEIVABLES),
            "overdue_amount": sum(r.pending_amount for r in MOCK_RECEIVABLES.values() if r.days_overdue > 0)
        }
    except Exception as e:
        logger.error(f"Get receivables summary error: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch receivables summary")

@router.get("/payables")
async def get_payables():
    """Get payables list"""
    # TODO: Implement payables
    raise HTTPException(status_code=501, detail="Payables not implemented yet")

@router.get("/payables/aging")
async def get_payables_aging():
    """Get payables aging report"""
    # TODO: Implement payables aging
    raise HTTPException(status_code=501, detail="Payables aging not implemented yet")

@router.get("/payables/summary")
async def get_payables_summary():
    """Get payables summary"""
    # TODO: Implement payables summary
    raise HTTPException(status_code=501, detail="Payables summary not implemented yet")
