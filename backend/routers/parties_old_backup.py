"""
Parties Router

Handles suppliers, customers, and party management.
"""

from fastapi import APIRouter, HTTPException, Depends, status, Query
from pydantic import BaseModel, EmailStr
from typing import Optional, List, Dict, Any
import logging
from datetime import datetime

logger = logging.getLogger(__name__)
router = APIRouter()

# Pydantic models
class Party(BaseModel):
    id: Optional[str] = None
    company_id: str
    party_name: str
    party_type: str  # 'supplier' or 'customer'
    email: Optional[EmailStr] = None
    phone: Optional[str] = None
    gstin: Optional[str] = None
    pan: Optional[str] = None
    address: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    pincode: Optional[str] = None
    country: Optional[str] = None
    is_msme: bool = False
    msme_type: Optional[str] = None
    credit_limit: Optional[float] = None
    credit_period: Optional[int] = None
    status: str = "active"  # 'active', 'inactive', 'blocked'
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

class PartyCreate(BaseModel):
    company_id: str
    party_name: str
    party_type: str
    email: Optional[EmailStr] = None
    phone: Optional[str] = None
    gstin: Optional[str] = None
    pan: Optional[str] = None
    address: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    pincode: Optional[str] = None
    country: Optional[str] = None
    is_msme: bool = False
    msme_type: Optional[str] = None
    credit_limit: Optional[float] = None
    credit_period: Optional[int] = None

class PartyUpdate(BaseModel):
    party_name: Optional[str] = None
    email: Optional[EmailStr] = None
    phone: Optional[str] = None
    gstin: Optional[str] = None
    pan: Optional[str] = None
    address: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    pincode: Optional[str] = None
    country: Optional[str] = None
    is_msme: Optional[bool] = None
    msme_type: Optional[str] = None
    credit_limit: Optional[float] = None
    credit_period: Optional[int] = None
    status: Optional[str] = None

class PartySummary(BaseModel):
    party: Party
    total_invoices: int
    total_amount: float
    pending_amount: float
    last_invoice_date: Optional[datetime]

class BulkStatusUpdate(BaseModel):
    party_ids: List[str]
    status: str

# Mock data store (in production, use database)
MOCK_PARTIES: Dict[str, Party] = {
    "party_1": Party(
        id="party_1",
        company_id="company_1",
        party_name="ABC Suppliers",
        party_type="supplier",
        email="abc@suppliers.com",
        phone="9876543210",
        gstin="27AAAPL1234C1ZV",
        status="active",
        created_at=datetime.utcnow()
    ),
    "party_2": Party(
        id="party_2",
        company_id="company_1",
        party_name="XYZ Customer",
        party_type="customer",
        email="xyz@customer.com",
        phone="9876543211",
        gstin="27AAAPL5678C1ZV",
        status="active",
        created_at=datetime.utcnow()
    )
}

@router.get("/")
async def get_parties(
    party_type: Optional[str] = Query(None, description="Filter by party type"),
    search: Optional[str] = Query(None, description="Search term"),
    status: Optional[str] = Query(None, description="Filter by status"),
    state: Optional[str] = Query(None, description="Filter by state"),
    msme: Optional[str] = Query(None, description="Filter by MSME status"),
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=100)
):
    """Get list of parties with filters"""
    try:
        parties = list(MOCK_PARTIES.values())
        
        # Apply filters
        if party_type:
            parties = [p for p in parties if p.party_type == party_type]
        if search:
            parties = [p for p in parties if search.lower() in p.party_name.lower()]
        if status:
            parties = [p for p in parties if p.status == status]
        if state:
            parties = [p for p in parties if p.state and p.state.lower() == state.lower()]
        if msme:
            if msme == "yes":
                parties = [p for p in parties if p.is_msme]
            else:
                parties = [p for p in parties if not p.is_msme]
        
        # Pagination
        start = (page - 1) * limit
        end = start + limit
        paginated_parties = parties[start:end]
        
        return {
            "parties": paginated_parties,
            "total": len(parties),
            "page": page,
            "limit": limit,
            "total_pages": (len(parties) + limit - 1) // limit
        }
        
    except Exception as e:
        logger.error(f"Get parties error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to fetch parties"
        )

@router.post("/")
async def create_party(party: PartyCreate):
    """Create a new party"""
    try:
        # Validate party_type
        if party.party_type not in ["supplier", "customer"]:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="party_type must be 'supplier' or 'customer'"
            )
        
        # Generate ID and create party
        party_id = f"party_{len(MOCK_PARTIES) + 1}"
        new_party = Party(
            id=party_id,
            **party.dict(),
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow()
        )
        
        MOCK_PARTIES[party_id] = new_party
        
        logger.info(f"Created party: {party_id}")
        return new_party
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Create party error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create party"
        )

@router.get("/{party_id}")
async def get_party(party_id: str):
    """Get party by ID"""
    try:
        if party_id not in MOCK_PARTIES:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Party not found"
            )
        
        return MOCK_PARTIES[party_id]
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Get party error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to fetch party"
        )

@router.put("/{party_id}")
async def update_party(party_id: str, updates: PartyUpdate):
    """Update party details"""
    try:
        if party_id not in MOCK_PARTIES:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Party not found"
            )
        
        party = MOCK_PARTIES[party_id]
        update_data = updates.dict(exclude_unset=True)
        
        for field, value in update_data.items():
            setattr(party, field, value)
        
        party.updated_at = datetime.utcnow()
        
        logger.info(f"Updated party: {party_id}")
        return party
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Update party error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update party"
        )

@router.delete("/{party_id}")
async def delete_party(party_id: str):
    """Delete party"""
    try:
        if party_id not in MOCK_PARTIES:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Party not found"
            )
        
        del MOCK_PARTIES[party_id]
        
        logger.info(f"Deleted party: {party_id}")
        return {"message": "Party deleted successfully"}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Delete party error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to delete party"
        )

@router.get("/{party_id}/summary")
async def get_party_summary(party_id: str):
    """Get party summary with financial information"""
    try:
        if party_id not in MOCK_PARTIES:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Party not found"
            )
        
        party = MOCK_PARTIES[party_id]
        
        # Mock summary data
        summary = PartySummary(
            party=party,
            total_invoices=25,
            total_amount=150000.00,
            pending_amount=25000.00,
            last_invoice_date=datetime.utcnow()
        )
        
        return summary
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Get party summary error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to fetch party summary"
        )

@router.get("/{party_id}/invoices")
async def get_party_invoices(party_id: str):
    """Get invoices for a specific party"""
    try:
        if party_id not in MOCK_PARTIES:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Party not found"
            )
        
        # Mock invoice data
        invoices = [
            {
                "id": "inv_1",
                "invoice_number": "INV-001",
                "date": datetime.utcnow(),
                "amount": 10000.00,
                "status": "paid"
            },
            {
                "id": "inv_2",
                "invoice_number": "INV-002",
                "date": datetime.utcnow(),
                "amount": 5000.00,
                "status": "pending"
            }
        ]
        
        return {"invoices": invoices}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Get party invoices error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to fetch party invoices"
        )

@router.get("/analytics/summary")
async def get_party_analytics_summary():
    """Get party analytics summary"""
    try:
        # Mock analytics data
        return {
            "total_parties": len(MOCK_PARTIES),
            "suppliers": len([p for p in MOCK_PARTIES.values() if p.party_type == "supplier"]),
            "customers": len([p for p in MOCK_PARTIES.values() if p.party_type == "customer"]),
            "active_parties": len([p for p in MOCK_PARTIES.values() if p.status == "active"]),
            "msme_parties": len([p for p in MOCK_PARTIES.values() if p.is_msme]),
            "states": list(set(p.state for p in MOCK_PARTIES.values() if p.state))
        }
        
    except Exception as e:
        logger.error(f"Get party analytics error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to fetch party analytics"
        )

@router.get("/analytics/trends")
async def get_party_analytics_trends():
    """Get party analytics trends"""
    # TODO: Implement trends analytics
    raise HTTPException(
        status_code=status.HTTP_501_NOT_IMPLEMENTED,
        detail="Trends analytics not implemented yet"
    )

@router.get("/analytics/top-performers")
async def get_party_analytics_top_performers():
    """Get top performing parties"""
    # TODO: Implement top performers analytics
    raise HTTPException(
        status_code=status.HTTP_501_NOT_IMPLEMENTED,
        detail="Top performers analytics not implemented yet"
    )

@router.get("/analytics/risk-analysis")
async def get_party_analytics_risk():
    """Get party risk analysis"""
    # TODO: Implement risk analysis
    raise HTTPException(
        status_code=status.HTTP_501_NOT_IMPLEMENTED,
        detail="Risk analysis not implemented yet"
    )

@router.get("/search")
async def search_parties(q: str = Query(..., min_length=1)):
    """Search parties"""
    try:
        parties = list(MOCK_PARTIES.values())
        results = [
            p for p in parties 
            if q.lower() in p.party_name.lower() or 
               (p.email and q.lower() in p.email.lower()) or
               (p.phone and q in p.phone)
        ]
        
        return {"results": results, "query": q}
        
    except Exception as e:
        logger.error(f"Search parties error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to search parties"
        )

@router.post("/bulk/status")
async def bulk_update_status(bulk_update: BulkStatusUpdate):
    """Bulk update party status"""
    try:
        updated_count = 0
        
        for party_id in bulk_update.party_ids:
            if party_id in MOCK_PARTIES:
                MOCK_PARTIES[party_id].status = bulk_update.status
                MOCK_PARTIES[party_id].updated_at = datetime.utcnow()
                updated_count += 1
        
        logger.info(f"Bulk updated status for {updated_count} parties")
        return {
            "message": f"Updated {updated_count} parties",
            "updated_count": updated_count
        }
        
    except Exception as e:
        logger.error(f"Bulk update status error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to bulk update party status"
        )
