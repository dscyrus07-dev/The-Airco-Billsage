"""
Parties Router - Fixed with Real Database Integration

Handles suppliers, customers, and party management with proper database queries.
"""

from fastapi import APIRouter, HTTPException, Depends, status, Query
from sqlalchemy.orm import Session
from sqlalchemy import text
from typing import Optional, List
import logging
from datetime import datetime
import uuid

from config.database import get_db
from dependencies.auth import get_current_user, CurrentUser
from schemas.party_schemas import (
    PartyCreate, PartyUpdate, PartyResponse, PartyListResponse,
    PartySummaryResponse, PartyInvoicesResponse, PartyAnalyticsSummary,
    BulkStatusUpdate, PartySearchResponse, PartyTransactionSummary
)

logger = logging.getLogger(__name__)
router = APIRouter()


@router.get("/", response_model=PartyListResponse)
async def get_parties(
    party_type: Optional[str] = Query(None, description="Filter by party type: supplier, customer, both"),
    search: Optional[str] = Query(None, description="Search term for name, email, phone"),
    status: Optional[str] = Query(None, description="Filter by status: active, inactive, blocked"),
    state: Optional[str] = Query(None, description="Filter by state"),
    msme: Optional[bool] = Query(None, description="Filter by MSME status"),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=100),
    current_user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get list of parties with filters and pagination"""
    try:
        # Build base query
        query = """
            SELECT 
                id, company_id, legal_name, trade_name, party_type,
                gstin, pan, address_line1, address_line2, city, state,
                pincode, country, contact_person, email, phone,
                credit_limit, payment_terms_sales, payment_terms_purchase,
                msme, notes, tags, status, created_at, updated_at
            FROM parties
            WHERE company_id = :company_id AND deleted_at IS NULL
        """
        
        params = {"company_id": str(current_user.company_id)}
        
        # Apply filters
        if party_type and party_type != 'all':
            query += " AND party_type = :party_type"
            params["party_type"] = party_type
        
        if search:
            query += """ AND (
                legal_name ILIKE :search OR 
                trade_name ILIKE :search OR 
                email ILIKE :search OR 
                phone ILIKE :search OR
                gstin ILIKE :search
            )"""
            params["search"] = f"%{search}%"
        
        if status and status != 'all':
            query += " AND status = :status"
            params["status"] = status
        
        if state and state != 'all':
            query += " AND state = :state"
            params["state"] = state
        
        if msme is not None:
            query += " AND msme = :msme"
            params["msme"] = msme
        
        # Count total
        count_query = f"SELECT COUNT(*) FROM ({query}) AS subquery"
        count_result = db.execute(text(count_query), params).fetchone()
        total = count_result[0] if count_result else 0
        
        # Add pagination
        query += " ORDER BY created_at DESC LIMIT :limit OFFSET :offset"
        params["limit"] = page_size
        params["offset"] = (page - 1) * page_size
        
        # Execute query
        result = db.execute(text(query), params).fetchall()
        
        # Map results
        parties = []
        for row in result:
            parties.append({
                "id": str(row.id),
                "company_id": str(row.company_id),
                "legal_name": row.legal_name,
                "trade_name": row.trade_name,
                "party_type": row.party_type,
                "gstin": row.gstin,
                "pan": row.pan,
                "address_line1": row.address_line1,
                "address_line2": row.address_line2,
                "city": row.city,
                "state": row.state,
                "pincode": row.pincode,
                "country": row.country,
                "contact_person": row.contact_person,
                "email": row.email,
                "phone": row.phone,
                "credit_limit": float(row.credit_limit) if row.credit_limit else None,
                "payment_terms_sales": row.payment_terms_sales,
                "payment_terms_purchase": row.payment_terms_purchase,
                "msme": row.msme,
                "notes": row.notes,
                "tags": row.tags or [],
                "status": row.status,
                "created_at": row.created_at,
                "updated_at": row.updated_at
            })
        
        total_pages = (total + page_size - 1) // page_size
        
        return {
            "parties": parties,
            "total": total,
            "page": page,
            "page_size": page_size,
            "total_pages": total_pages
        }
        
    except Exception as e:
        logger.error(f"Get parties error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to fetch parties"
        )


@router.post("/", response_model=PartyResponse, status_code=status.HTTP_201_CREATED)
async def create_party(
    party: PartyCreate,
    current_user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Create a new party"""
    try:
        # Validate party_type
        if party.party_type not in ["supplier", "customer", "both"]:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="party_type must be 'supplier', 'customer', or 'both'"
            )
        
        # Generate UUID
        party_id = str(uuid.uuid4())
        
        # Insert party
        query = text("""
            INSERT INTO parties (
                id, company_id, legal_name, trade_name, party_type,
                gstin, pan, address_line1, address_line2, city, state,
                pincode, country, contact_person, email, phone,
                credit_limit, payment_terms_sales, payment_terms_purchase,
                msme, notes, tags, status, created_at, updated_at
            ) VALUES (
                :id, :company_id, :legal_name, :trade_name, :party_type,
                :gstin, :pan, :address_line1, :address_line2, :city, :state,
                :pincode, :country, :contact_person, :email, :phone,
                :credit_limit, :payment_terms_sales, :payment_terms_purchase,
                :msme, :notes, :tags, 'active', NOW(), NOW()
            )
            RETURNING id, company_id, legal_name, trade_name, party_type,
                      gstin, pan, address_line1, address_line2, city, state,
                      pincode, country, contact_person, email, phone,
                      credit_limit, payment_terms_sales, payment_terms_purchase,
                      msme, notes, tags, status, created_at, updated_at
        """)
        
        result = db.execute(query, {
            "id": party_id,
            "company_id": str(current_user.company_id),
            "legal_name": party.legal_name,
            "trade_name": party.trade_name,
            "party_type": party.party_type,
            "gstin": party.gstin,
            "pan": party.pan,
            "address_line1": party.address_line1,
            "address_line2": party.address_line2,
            "city": party.city,
            "state": party.state,
            "pincode": party.pincode,
            "country": party.country,
            "contact_person": party.contact_person,
            "email": party.email,
            "phone": party.phone,
            "credit_limit": party.credit_limit,
            "payment_terms_sales": party.payment_terms_sales,
            "payment_terms_purchase": party.payment_terms_purchase,
            "msme": party.msme,
            "notes": party.notes,
            "tags": party.tags
        }).fetchone()
        
        db.commit()
        
        logger.info(f"Created party: {party_id}")
        
        return {
            "id": str(result.id),
            "company_id": str(result.company_id),
            "legal_name": result.legal_name,
            "trade_name": result.trade_name,
            "party_type": result.party_type,
            "gstin": result.gstin,
            "pan": result.pan,
            "address_line1": result.address_line1,
            "address_line2": result.address_line2,
            "city": result.city,
            "state": result.state,
            "pincode": result.pincode,
            "country": result.country,
            "contact_person": result.contact_person,
            "email": result.email,
            "phone": result.phone,
            "credit_limit": float(result.credit_limit) if result.credit_limit else None,
            "payment_terms_sales": result.payment_terms_sales,
            "payment_terms_purchase": result.payment_terms_purchase,
            "msme": result.msme,
            "notes": result.notes,
            "tags": result.tags or [],
            "status": result.status,
            "created_at": result.created_at,
            "updated_at": result.updated_at
        }
        
    except HTTPException:
        db.rollback()
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"Create party error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create party: {str(e)}"
        )


@router.get("/{party_id}", response_model=PartyResponse)
async def get_party(
    party_id: str,
    current_user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get party by ID"""
    try:
        query = text("""
            SELECT 
                id, company_id, legal_name, trade_name, party_type,
                gstin, pan, address_line1, address_line2, city, state,
                pincode, country, contact_person, email, phone,
                credit_limit, payment_terms_sales, payment_terms_purchase,
                msme, notes, tags, status, created_at, updated_at
            FROM parties
            WHERE id = :party_id 
              AND company_id = :company_id 
              AND deleted_at IS NULL
        """)
        
        result = db.execute(query, {
            "party_id": party_id,
            "company_id": str(current_user.company_id)
        }).fetchone()
        
        if not result:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Party not found"
            )
        
        return {
            "id": str(result.id),
            "company_id": str(result.company_id),
            "legal_name": result.legal_name,
            "trade_name": result.trade_name,
            "party_type": result.party_type,
            "gstin": result.gstin,
            "pan": result.pan,
            "address_line1": result.address_line1,
            "address_line2": result.address_line2,
            "city": result.city,
            "state": result.state,
            "pincode": result.pincode,
            "country": result.country,
            "contact_person": result.contact_person,
            "email": result.email,
            "phone": result.phone,
            "credit_limit": float(result.credit_limit) if result.credit_limit else None,
            "payment_terms_sales": result.payment_terms_sales,
            "payment_terms_purchase": result.payment_terms_purchase,
            "msme": result.msme,
            "notes": result.notes,
            "tags": result.tags or [],
            "status": result.status,
            "created_at": result.created_at,
            "updated_at": result.updated_at
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Get party error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to fetch party"
        )


@router.patch("/{party_id}", response_model=PartyResponse)
async def update_party(
    party_id: str,
    updates: PartyUpdate,
    current_user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update party details"""
    try:
        # Build dynamic update query
        update_fields = []
        params = {
            "party_id": party_id,
            "company_id": str(current_user.company_id)
        }
        
        # Add fields that are being updated
        update_data = updates.dict(exclude_unset=True)
        for field, value in update_data.items():
            update_fields.append(f"{field} = :{field}")
            params[field] = value
        
        if not update_fields:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No fields to update"
            )
        
        # Add updated_at
        update_fields.append("updated_at = NOW()")
        
        query = text(f"""
            UPDATE parties
            SET {', '.join(update_fields)}
            WHERE id = :party_id 
              AND company_id = :company_id 
              AND deleted_at IS NULL
            RETURNING id, company_id, legal_name, trade_name, party_type,
                      gstin, pan, address_line1, address_line2, city, state,
                      pincode, country, contact_person, email, phone,
                      credit_limit, payment_terms_sales, payment_terms_purchase,
                      msme, notes, tags, status, created_at, updated_at
        """)
        
        result = db.execute(query, params).fetchone()
        
        if not result:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Party not found"
            )
        
        db.commit()
        
        logger.info(f"Updated party: {party_id}")
        
        return {
            "id": str(result.id),
            "company_id": str(result.company_id),
            "legal_name": result.legal_name,
            "trade_name": result.trade_name,
            "party_type": result.party_type,
            "gstin": result.gstin,
            "pan": result.pan,
            "address_line1": result.address_line1,
            "address_line2": result.address_line2,
            "city": result.city,
            "state": result.state,
            "pincode": result.pincode,
            "country": result.country,
            "contact_person": result.contact_person,
            "email": result.email,
            "phone": result.phone,
            "credit_limit": float(result.credit_limit) if result.credit_limit else None,
            "payment_terms_sales": result.payment_terms_sales,
            "payment_terms_purchase": result.payment_terms_purchase,
            "msme": result.msme,
            "notes": result.notes,
            "tags": result.tags or [],
            "status": result.status,
            "created_at": result.created_at,
            "updated_at": result.updated_at
        }
        
    except HTTPException:
        db.rollback()
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"Update party error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update party"
        )


@router.delete("/{party_id}")
async def delete_party(
    party_id: str,
    current_user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Soft delete party"""
    try:
        query = text("""
            UPDATE parties
            SET deleted_at = NOW()
            WHERE id = :party_id 
              AND company_id = :company_id 
              AND deleted_at IS NULL
            RETURNING id
        """)
        
        result = db.execute(query, {
            "party_id": party_id,
            "company_id": str(current_user.company_id)
        }).fetchone()
        
        if not result:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Party not found"
            )
        
        db.commit()
        
        logger.info(f"Deleted party: {party_id}")
        return {"message": "Party deleted successfully"}
        
    except HTTPException:
        db.rollback()
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"Delete party error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to delete party"
        )


@router.get("/{party_id}/summary")
async def get_party_summary(
    party_id: str,
    current_user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get party summary with financial information"""
    try:
        # Verify party exists and belongs to company
        party_query = text("""
            SELECT id FROM parties
            WHERE id = :party_id 
              AND company_id = :company_id 
              AND deleted_at IS NULL
        """)
        
        party_result = db.execute(party_query, {
            "party_id": party_id,
            "company_id": str(current_user.company_id)
        }).fetchone()
        
        if not party_result:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Party not found"
            )
        
        # TODO: Implement actual transaction summary from vouchers/invoices
        # For now, return mock data structure
        return {
            "party_id": party_id,
            "total_invoices": 0,
            "total_amount": 0.0,
            "pending_amount": 0.0,
            "paid_amount": 0.0,
            "last_invoice_date": None,
            "last_payment_date": None
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Get party summary error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to fetch party summary"
        )


@router.get("/{party_id}/invoices")
async def get_party_invoices(
    party_id: str,
    invoice_type: Optional[str] = Query(None, description="Filter by invoice type: purchase or sale"),
    status: Optional[str] = Query(None, description="Filter by status"),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=100),
    current_user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get invoices for a specific party"""
    try:
        # Verify party exists
        party_query = text("""
            SELECT id FROM parties
            WHERE id = :party_id 
              AND company_id = :company_id 
              AND deleted_at IS NULL
        """)
        
        party_result = db.execute(party_query, {
            "party_id": party_id,
            "company_id": str(current_user.company_id)
        }).fetchone()
        
        if not party_result:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Party not found"
            )
        
        # TODO: Implement actual invoice query from vouchers table
        # For now, return empty list
        return {
            "invoices": [],
            "total": 0,
            "page": page,
            "page_size": page_size
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Get party invoices error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to fetch party invoices"
        )


@router.get("/analytics/summary", response_model=PartyAnalyticsSummary)
async def get_party_analytics_summary(
    current_user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get party analytics summary"""
    try:
        query = text("""
            SELECT 
                COUNT(*) as total_parties,
                COUNT(*) FILTER (WHERE party_type = 'supplier' AND status = 'active') as active_suppliers,
                COUNT(*) FILTER (WHERE party_type = 'customer' AND status = 'active') as active_customers,
                COUNT(*) FILTER (WHERE status = 'inactive') as inactive_parties
            FROM parties
            WHERE company_id = :company_id AND deleted_at IS NULL
        """)
        
        result = db.execute(query, {"company_id": str(current_user.company_id)}).fetchone()
        
        # TODO: Calculate actual spend and revenue from transactions
        return {
            "total_parties": result.total_parties or 0,
            "active_suppliers": result.active_suppliers or 0,
            "active_customers": result.active_customers or 0,
            "inactive_parties": result.inactive_parties or 0,
            "total_spend": 0.0,
            "total_revenue": 0.0,
            "top_supplier_concentration": 0.0,
            "top_customer_concentration": 0.0
        }
        
    except Exception as e:
        logger.error(f"Get party analytics error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to fetch party analytics"
        )


@router.get("/search", response_model=PartySearchResponse)
async def search_parties(
    q: str = Query(..., min_length=1, description="Search query"),
    party_type: Optional[str] = Query(None, description="Filter by party type"),
    limit: int = Query(20, ge=1, le=100),
    current_user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Search parties by name, email, phone, or GSTIN"""
    try:
        query = """
            SELECT 
                id, legal_name, trade_name, party_type, email, phone, city, state
            FROM parties
            WHERE company_id = :company_id 
              AND deleted_at IS NULL
              AND (
                  legal_name ILIKE :search OR 
                  trade_name ILIKE :search OR 
                  email ILIKE :search OR 
                  phone ILIKE :search OR
                  gstin ILIKE :search
              )
        """
        
        params = {
            "company_id": str(current_user.company_id),
            "search": f"%{q}%"
        }
        
        if party_type:
            query += " AND party_type = :party_type"
            params["party_type"] = party_type
        
        query += " ORDER BY legal_name LIMIT :limit"
        params["limit"] = limit
        
        result = db.execute(text(query), params).fetchall()
        
        results = []
        for row in result:
            results.append({
                "id": str(row.id),
                "legal_name": row.legal_name,
                "trade_name": row.trade_name,
                "party_type": row.party_type,
                "email": row.email,
                "phone": row.phone,
                "city": row.city,
                "state": row.state
            })
        
        return {
            "results": results,
            "total": len(results),
            "query": q
        }
        
    except Exception as e:
        logger.error(f"Search parties error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to search parties"
        )


@router.patch("/bulk/status")
async def bulk_update_status(
    bulk_update: BulkStatusUpdate,
    current_user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Bulk update party status"""
    try:
        # Validate status
        if bulk_update.status not in ["active", "inactive", "blocked"]:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Status must be 'active', 'inactive', or 'blocked'"
            )
        
        # Convert party_ids to proper format for SQL
        party_ids_str = ",".join([f"'{pid}'" for pid in bulk_update.party_ids])
        
        query = text(f"""
            UPDATE parties
            SET status = :status, updated_at = NOW()
            WHERE id IN ({party_ids_str})
              AND company_id = :company_id
              AND deleted_at IS NULL
            RETURNING id
        """)
        
        result = db.execute(query, {
            "status": bulk_update.status,
            "company_id": str(current_user.company_id)
        }).fetchall()
        
        db.commit()
        
        updated_count = len(result)
        
        logger.info(f"Bulk updated status for {updated_count} parties")
        return {
            "message": f"Updated {updated_count} parties",
            "updated_count": updated_count
        }
        
    except HTTPException:
        db.rollback()
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"Bulk update status error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to bulk update party status"
        )
