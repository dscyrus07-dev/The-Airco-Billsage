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


@router.get("", response_model=PartyListResponse)
@router.get("/", response_model=PartyListResponse, include_in_schema=False)
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
        logger.info(f"Getting parties - party_type: {party_type}, search: {search}, status: {status}")
        # Build base query with correct schema
        query = """
            SELECT 
                p.id, p.company_id, p.party_name, p.display_name, p.party_code,
                p.is_supplier, p.is_customer, p.party_category,
                p.gstin, p.pan, p.cin, p.tan,
                p.email, p.phone, p.alternate_phone, p.website,
                p.address, p.state, p.pin_code,
                p.credit_limit, p.payment_terms_days, p.opening_balance, p.opening_balance_type,
                p.notes, p.status, p.created_by, p.updated_by, p.deleted_at, p.created_at, p.updated_at
            FROM parties p
            WHERE p.company_id = :company_id AND p.deleted_at IS NULL
        """
        
        params = {"company_id": str(current_user.company_id)}
        
        # Apply filters
        if party_type and party_type != 'all':
            if party_type == 'supplier':
                query += " AND p.is_supplier = TRUE"
            elif party_type == 'customer':
                query += " AND p.is_customer = TRUE"
            elif party_type == 'both':
                query += " AND (p.is_supplier = TRUE OR p.is_customer = TRUE)"
            else:
                # Invalid filter value - will be handled by validation
                pass
        
        if search:
            query += """ AND (
                p.party_name ILIKE :search OR 
                p.display_name ILIKE :search OR 
                p.email ILIKE :search OR 
                p.phone ILIKE :search OR
                p.gstin ILIKE :search
            )"""
            params["search"] = f"%{search}%"
        
        if status and status != 'all':
            query += " AND p.status = :status"
            params["status"] = status
        
        # state filter removed - addresses in separate table
        
        # msme filter removed - not in database schema
        
        # Count total
        count_query = f"SELECT COUNT(*) FROM ({query}) AS subquery"
        count_result = db.execute(text(count_query), params).fetchone()
        total = count_result[0] if count_result else 0
        
        # Add pagination
        query += " ORDER BY p.created_at DESC LIMIT :limit OFFSET :offset"
        params["limit"] = page_size
        params["offset"] = (page - 1) * page_size
        
        # Execute query
        result = db.execute(text(query), params).fetchall()
        
        # Map results with correct field mapping
        parties = []
        for row in result:
            # Determine party type from boolean fields
            party_type = 'both'
            if row.is_supplier and not row.is_customer:
                party_type = 'supplier'
            elif row.is_customer and not row.is_supplier:
                party_type = 'customer'
            elif row.is_supplier and row.is_customer:
                party_type = 'both'
            
            parties.append({
                "id": str(row.id),
                "company_id": str(row.company_id),
                "party_name": row.party_name,
                "display_name": row.display_name,
                "party_code": row.party_code,
                "party_type": party_type,
                "party_category": row.party_category,
                "gstin": row.gstin,
                "pan": row.pan,
                "cin": row.cin,
                "tan": row.tan,
                "email": row.email,
                "phone": row.phone,
                "alternate_phone": row.alternate_phone,
                "website": row.website,
                "address": row.address,
                "state": row.state,
                "pin_code": row.pin_code,
                "credit_limit": float(row.credit_limit) if row.credit_limit else None,
                "payment_terms_days": row.payment_terms_days,
                "opening_balance": float(row.opening_balance) if row.opening_balance else None,
                "opening_balance_type": row.opening_balance_type,
                "status": row.status,
                "notes": row.notes,
                "created_by": str(row.created_by) if row.created_by else None,
                "updated_by": str(row.updated_by) if row.updated_by else None,
                "deleted_at": row.deleted_at,
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
        logger.error(f"Get parties error: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch parties: {str(e)}"
        )


@router.post("", response_model=PartyResponse, status_code=status.HTTP_201_CREATED)
@router.post("/", response_model=PartyResponse, status_code=status.HTTP_201_CREATED, include_in_schema=False)
async def create_party(
    party: PartyCreate,
    current_user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Create a new party"""
    try:
        logger.info(f"Starting party creation: {party.party_name} (type: {party.party_type})")
        
        # Validate party_type
        if party.party_type not in ["supplier", "customer", "both"]:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="party_type must be 'supplier', 'customer', or 'both'"
            )
        
        # Generate UUID
        party_id = str(uuid.uuid4())
        logger.debug(f"Generated party ID: {party_id}")
        
        # Insert party with correct schema
        query = text("""
            INSERT INTO parties (
                id, company_id, party_name, display_name, party_code,
                is_supplier, is_customer, party_category,
                gstin, pan, cin, tan,
                email, phone, alternate_phone, website,
                address, state, pin_code,
                credit_limit, payment_terms_days, opening_balance, opening_balance_type,
                notes, status, created_by, updated_by, created_at, updated_at
            ) VALUES (
                :id, :company_id, :party_name, :display_name, :party_code,
                :is_supplier, :is_customer, :party_category,
                :gstin, :pan, :cin, :tan,
                :email, :phone, :alternate_phone, :website,
                :address, :state, :pin_code,
                :credit_limit, :payment_terms_days, :opening_balance, :opening_balance_type,
                :notes, :status, :created_by, :updated_by, NOW(), NOW()
            )
            RETURNING id, company_id, party_name, display_name, party_code,
                      is_supplier, is_customer, party_category,
                      gstin, pan, cin, tan,
                      email, phone, alternate_phone, website,
                      address, state, pin_code,
                      credit_limit, payment_terms_days, opening_balance, opening_balance_type,
                      notes, status, created_by, updated_by, deleted_at, created_at, updated_at
        """)
        
        # Map party_type to boolean fields
        is_supplier = party.party_type in ['supplier', 'both']
        is_customer = party.party_type in ['customer', 'both']
        
        # Use provided party_code or generate one
        if party.party_code and party.party_code.strip():
            party_code = party.party_code.strip()
        else:
            party_code = f"PT-{datetime.utcnow().strftime('%Y%m%d%H%M%S')}"
        
        result = db.execute(query, {
            "id": party_id,
            "company_id": str(current_user.company_id),
            "party_name": party.party_name,
            "display_name": party.display_name,
            "party_code": party_code,
            "is_supplier": is_supplier,
            "is_customer": is_customer,
            "party_category": party.party_category or "business",
            "gstin": party.gstin,
            "pan": party.pan,
            "cin": party.cin,
            "tan": party.tan,
            "email": party.email,
            "phone": party.phone,
            "alternate_phone": party.alternate_phone,
            "website": party.website,
            "address": party.address,
            "state": party.state,
            "pin_code": party.pin_code,
            "credit_limit": party.credit_limit or 0,
            "payment_terms_days": party.payment_terms_days or 0,
            "opening_balance": party.opening_balance or 0,
            "opening_balance_type": party.opening_balance_type or "dr",
            "notes": party.notes,
            "status": party.status or "active",
            "created_by": current_user.user_id,
            "updated_by": current_user.user_id
        }).fetchone()
        
        logger.debug(f"Party insert completed, committing transaction")
        db.commit()
        
        logger.info(f"Successfully created party: {party_id}")
        logger.debug(f"Building response for party: {party_id}")
        
        # Reconstruct party type from boolean fields
        created_party_type = 'both'
        if result.is_supplier and not result.is_customer:
            created_party_type = 'supplier'
        elif result.is_customer and not result.is_supplier:
            created_party_type = 'customer'
        
        # Build response with defensive column access
        try:
            response = {
                "id": str(result.id),
                "company_id": str(result.company_id),
                "party_name": result.party_name,
                "display_name": result.display_name,
                "party_code": result.party_code,
                "party_type": created_party_type,
                "party_category": result.party_category,
                "gstin": result.gstin,
                "pan": result.pan,
                "cin": result.cin,
                "tan": result.tan,
                "email": result.email,
                "phone": result.phone,
                "alternate_phone": result.alternate_phone,
                "website": result.website,
                "address": result.address,
                "state": result.state,
                "pin_code": result.pin_code,
                "credit_limit": float(result.credit_limit) if result.credit_limit else None,
                "payment_terms_days": result.payment_terms_days,
                "opening_balance": float(result.opening_balance) if result.opening_balance else None,
                "opening_balance_type": result.opening_balance_type,
                "status": result.status,
                "notes": result.notes,
                "created_by": str(result.created_by) if result.created_by else None,
                "updated_by": str(result.updated_by) if result.updated_by else None,
                "deleted_at": result.deleted_at,
                "created_at": result.created_at,
                "updated_at": result.updated_at
            }
            logger.debug(f"Response built successfully for party: {party_id}")
            return response
        except AttributeError as attr_err:
            # Log which columns are available vs which was requested
            available_columns = list(result.keys()) if hasattr(result, 'keys') else dir(result)
            logger.error(f"Column access error building response: {attr_err}")
            logger.error(f"Available columns in result: {available_columns}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Response mapping error: {str(attr_err)}"
            )
        
    except HTTPException:
        db.rollback()
        raise
    except Exception as e:
        db.rollback()
        
        # Enhanced error logging to capture exact PostgreSQL error
        logger.error(f"Create party error: {e}", exc_info=True)
        
        # Extract specific PostgreSQL error details
        error_str = str(e)
        error_details = {
            "error_type": type(e).__name__,
            "error_message": error_str,
            "full_traceback": str(e.__dict__) if hasattr(e, '__dict__') else "No dict available"
        }
        
        # Try to extract specific psycopg2 error details
        if 'psycopg2' in error_str:
            import re
            
            # Extract UndefinedColumn error
            if 'UndefinedColumn' in error_str:
                column_match = re.search(r'column "([^"]+)"', error_str)
                if column_match:
                    error_details["missing_column"] = column_match.group(1)
                    error_details["error_type"] = "UndefinedColumn"
            
            # Extract UndefinedTable error  
            elif 'UndefinedTable' in error_str:
                table_match = re.search(r'table "([^"]+)"', error_str)
                if table_match:
                    error_details["missing_table"] = table_match.group(1)
                    error_details["error_type"] = "UndefinedTable"
            
            # Extract UndefinedFunction error
            elif 'UndefinedFunction' in error_str:
                func_match = re.search(r'function "([^"]+)"', error_str)
                if func_match:
                    error_details["missing_function"] = func_match.group(1)
                    error_details["error_type"] = "UndefinedFunction"
            
            # Extract SQLSTATE code
            sqlstate_match = re.search(r'sqlstate: ([A-Z0-9]+)', error_str)
            if sqlstate_match:
                error_details["sqlstate"] = sqlstate_match.group(1)
        
        logger.error(f"Detailed error analysis: {error_details}")
        
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create party: {str(e)}. Error details: {error_details}"
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
                id, company_id, party_name, display_name, party_code,
                is_supplier, is_customer, party_category,
                gstin, pan, cin, tan,
                email, phone, alternate_phone, website,
                address, state, pin_code,
                credit_limit, payment_terms_days, opening_balance, opening_balance_type,
                notes, status, created_by, updated_by, deleted_at, created_at, updated_at
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
        
        # Reconstruct party type from boolean fields
        party_type = 'both'
        if result.is_supplier and not result.is_customer:
            party_type = 'supplier'
        elif result.is_customer and not result.is_supplier:
            party_type = 'customer'
        
        return {
            "id": str(result.id),
            "company_id": str(result.company_id),
            "party_name": result.party_name,
            "display_name": result.display_name,
            "party_code": result.party_code,
            "party_type": party_type,
            "party_category": result.party_category,
            "gstin": result.gstin,
            "pan": result.pan,
            "cin": result.cin,
            "tan": result.tan,
            "email": result.email,
            "phone": result.phone,
            "alternate_phone": result.alternate_phone,
            "website": result.website,
            "address": result.address,
            "state": result.state,
            "pin_code": result.pin_code,
            "credit_limit": float(result.credit_limit) if result.credit_limit else None,
            "payment_terms_days": result.payment_terms_days,
            "opening_balance": float(result.opening_balance) if result.opening_balance else None,
            "opening_balance_type": result.opening_balance_type,
            "status": result.status,
            "notes": result.notes,
            "created_by": str(result.created_by) if result.created_by else None,
            "updated_by": str(result.updated_by) if result.updated_by else None,
            "deleted_at": result.deleted_at,
            "created_at": result.created_at,
            "updated_at": result.updated_at
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Get party error: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch party: {str(e)}"
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
        
        # Handle party_type specially - it needs to be mapped to is_supplier/is_customer
        if 'party_type' in update_data:
            party_type_value = update_data.pop('party_type')
            if party_type_value == 'supplier':
                update_fields.append("is_supplier = TRUE")
                update_fields.append("is_customer = FALSE")
            elif party_type_value == 'customer':
                update_fields.append("is_supplier = FALSE")
                update_fields.append("is_customer = TRUE")
            elif party_type_value == 'both':
                update_fields.append("is_supplier = TRUE")
                update_fields.append("is_customer = TRUE")
        
        # Handle other fields
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
            RETURNING id, company_id, party_name, display_name,
                      is_supplier, is_customer, party_category,
                      gstin, pan, cin, tan,
                      email, phone, alternate_phone, website,
                      credit_limit, payment_terms_days, opening_balance, opening_balance_type,
                      notes, status, created_at, updated_at
        """)
        
        result = db.execute(query, params).fetchone()
        
        if not result:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Party not found"
            )
        
        db.commit()
        
        logger.info(f"Updated party: {party_id}")
        
        # Reconstruct party type from boolean fields
        party_type = 'both'
        if result.is_supplier and not result.is_customer:
            party_type = 'supplier'
        elif result.is_customer and not result.is_supplier:
            party_type = 'customer'
        
        return {
            "id": str(result.id),
            "company_id": str(result.company_id),
            "party_name": result.party_name,
            "display_name": result.display_name,
            "party_type": party_type,
            "party_category": result.party_category,
            "gstin": result.gstin,
            "pan": result.pan,
            "cin": result.cin,
            "tan": result.tan,
            "email": result.email,
            "phone": result.phone,
            "alternate_phone": result.alternate_phone,
            "website": result.website,
            "credit_limit": float(result.credit_limit) if result.credit_limit else None,
            "payment_terms_days": result.payment_terms_days,
            "opening_balance": float(result.opening_balance) if result.opening_balance else None,
            "opening_balance_type": result.opening_balance_type,
            "status": result.status,
            "notes": result.notes,
            "created_at": result.created_at,
            "updated_at": result.updated_at
        }
        
    except HTTPException:
        db.rollback()
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"Update party error: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update party: {str(e)}"
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
        logger.error(f"Delete party error: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to delete party: {str(e)}"
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
        logger.error(f"Get party summary error: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch party summary: {str(e)}"
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
        logger.error(f"Get party invoices error: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch party invoices: {str(e)}"
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
                COUNT(*) FILTER (WHERE is_supplier = TRUE AND status = 'active') as active_suppliers,
                COUNT(*) FILTER (WHERE is_customer = TRUE AND status = 'active') as active_customers,
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
        logger.error(f"Get party analytics error: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch party analytics: {str(e)}"
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
                id, party_name, display_name, is_supplier, is_customer,
                email, phone, gstin
            FROM parties
            WHERE company_id = :company_id 
              AND deleted_at IS NULL
              AND (
                  party_name ILIKE :search OR 
                  display_name ILIKE :search OR 
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
            if party_type == 'supplier':
                query += " AND is_supplier = TRUE"
            elif party_type == 'customer':
                query += " AND is_customer = TRUE"
            elif party_type == 'both':
                query += " AND is_supplier = TRUE AND is_customer = TRUE"
        
        query += " ORDER BY party_name LIMIT :limit"
        params["limit"] = limit
        
        result = db.execute(text(query), params).fetchall()
        
        results = []
        for row in result:
            # Derive party_type from boolean fields
            derived_party_type = 'both'
            if row.is_supplier and not row.is_customer:
                derived_party_type = 'supplier'
            elif row.is_customer and not row.is_supplier:
                derived_party_type = 'customer'
            
            results.append({
                "id": str(row.id),
                "party_name": row.party_name,
                "display_name": row.display_name,
                "party_type": derived_party_type,
                "email": row.email,
                "phone": row.phone,
                "gstin": row.gstin
            })
        
        return {
            "results": results,
            "total": len(results),
            "query": q
        }
        
    except Exception as e:
        logger.error(f"Search parties error: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to search parties: {str(e)}"
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
        logger.error(f"Bulk update status error: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to bulk update party status: {str(e)}"
        )
