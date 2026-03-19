"""
Sales Router - Production-Ready Implementation

Complete sales invoice management with:
- Proper route ordering
- GST calculation engine integration
- Ledger posting
- Inventory management
- Document sequence generation
- Comprehensive validation
- Workflow management
"""

from fastapi import APIRouter, HTTPException, Depends, Query, status
from sqlalchemy.orm import Session
from sqlalchemy import text
from typing import Optional, List
from datetime import datetime, date
import uuid
from decimal import Decimal
import logging

from config.database import get_db
from dependencies.auth import get_current_user, CurrentUser
from schemas.sales_schemas import (
    SalesCreate, SalesUpdate, SalesResponse, SalesListResponse,
    SalesKPIs, SalesAnalytics, ReceivablesAging, SalesItemCreate
)
from services.gst_service import gst_service
from services.ledger_service import ledger_service
from services.inventory_service import inventory_service
from services.document_sequence_service import document_sequence_service

logger = logging.getLogger(__name__)
router = APIRouter()


# ============================================================================
# HELPER FUNCTIONS
# ============================================================================

def get_active_fy_id(db: Session, company_id: str) -> str:
    """Get active financial year ID for the company"""
    query = text("""
        SELECT id FROM financial_years
        WHERE company_id = :company_id
        AND is_current = TRUE
        AND deleted_at IS NULL
        LIMIT 1
    """)
    result = db.execute(query, {"company_id": company_id}).fetchone()
    if not result:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No active financial year found. Please configure financial year in settings."
        )
    return str(result.id)


def validate_party_exists(db: Session, party_id: str, company_id: str, must_be_customer: bool = True):
    """Validate that party exists and is a customer"""
    query = text("""
        SELECT id, party_name, is_customer, state, gstin
        FROM parties
        WHERE id = :party_id
        AND company_id = :company_id
        AND deleted_at IS NULL
    """)
    result = db.execute(query, {"party_id": party_id, "company_id": company_id}).fetchone()
    
    if not result:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Customer not found"
        )
    
    if must_be_customer and not result.is_customer:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Party '{result.party_name}' is not a customer"
        )
    
    return result


def validate_products_exist(db: Session, items: List[SalesItemCreate], company_id: str):
    """Validate that all products exist"""
    for item in items:
        if item.product_id:
            query = text("""
                SELECT id, product_name FROM products
                WHERE id = :product_id
                AND company_id = :company_id
                AND deleted_at IS NULL
            """)
            result = db.execute(query, {
                "product_id": item.product_id,
                "company_id": company_id
            }).fetchone()
            
            if not result:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"Product not found: {item.product_id}"
                )


def validate_status_transition(current_status: str, new_status: str):
    """Validate status transition is allowed"""
    allowed_transitions = {
        'draft': ['confirmed', 'cancelled'],
        'confirmed': ['cancelled', 'amended'],
        'cancelled': [],
        'amended': ['confirmed', 'cancelled']
    }
    
    if new_status not in allowed_transitions.get(current_status, []):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot transition from '{current_status}' to '{new_status}'"
        )


def get_company_state(db: Session, company_id: str) -> Optional[str]:
    """Get company state for GST calculation"""
    query = text("""
        SELECT cd.state
        FROM companies c
        LEFT JOIN company_details cd ON cd.company_id = c.id
        WHERE c.id = :company_id
    """)
    result = db.execute(query, {"company_id": company_id}).fetchone()
    return result.state if result else None


# ============================================================================
# STATIC ROUTES (MUST COME BEFORE PARAMETERIZED ROUTES)
# ============================================================================

@router.get("/kpis", response_model=SalesKPIs)
async def get_sales_kpis(
    current_user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get sales KPIs from real data"""
    try:
        query = text("""
            SELECT 
                COUNT(*) as total_sales,
                COALESCE(SUM(total_amount), 0) as total_amount,
                COUNT(*) FILTER (WHERE status = 'draft') as pending_count,
                COUNT(*) FILTER (WHERE status = 'confirmed') as confirmed_count,
                COUNT(*) FILTER (WHERE status = 'draft') as draft_count,
                COALESCE(SUM(paid_amount), 0) as total_paid,
                COALESCE(SUM(balance_amount), 0) as total_outstanding
            FROM vouchers
            WHERE company_id = :company_id
            AND voucher_type = 'sale'
            AND deleted_at IS NULL
        """)
        
        result = db.execute(query, {"company_id": str(current_user.company_id)}).fetchone()
        
        if not result:
            return SalesKPIs(
                total_sales=0, total_amount=Decimal('0'), pending_count=0,
                confirmed_count=0, draft_count=0, total_paid=Decimal('0'),
                total_outstanding=Decimal('0')
            )
        
        return SalesKPIs(
            total_sales=result.total_sales or 0,
            total_amount=Decimal(str(result.total_amount or 0)),
            pending_count=result.pending_count or 0,
            confirmed_count=result.confirmed_count or 0,
            draft_count=result.draft_count or 0,
            total_paid=Decimal(str(result.total_paid or 0)),
            total_outstanding=Decimal(str(result.total_outstanding or 0))
        )
        
    except Exception as e:
        logger.error(f"Get sales KPIs error: {e}")
        return SalesKPIs(
            total_sales=0, total_amount=Decimal('0'), pending_count=0,
            confirmed_count=0, draft_count=0, total_paid=Decimal('0'),
            total_outstanding=Decimal('0')
        )


@router.get("/analytics", response_model=SalesAnalytics)
async def get_sales_analytics(
    start_date: Optional[date] = Query(None),
    end_date: Optional[date] = Query(None),
    current_user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get sales analytics with top customers and trends"""
    try:
        if not start_date or not end_date:
            today = date.today()
            start_date = date(today.year, today.month, 1)
            if today.month == 12:
                end_date = date(today.year + 1, 1, 1)
            else:
                end_date = date(today.year, today.month + 1, 1)
        
        # Basic aggregates
        query = text("""
            SELECT 
                COUNT(*) as total_sales,
                COALESCE(SUM(total_amount), 0) as total_amount,
                COALESCE(AVG(total_amount), 0) as average_sale_value
            FROM vouchers
            WHERE company_id = :company_id
            AND voucher_type = 'sale'
            AND voucher_date >= :start_date
            AND voucher_date < :end_date
            AND deleted_at IS NULL
        """)
        
        result = db.execute(query, {
            "company_id": str(current_user.company_id),
            "start_date": start_date,
            "end_date": end_date
        }).fetchone()
        
        # Top customers
        top_customers_query = text("""
            SELECT 
                p.id, p.party_name,
                COUNT(v.id) as invoice_count,
                SUM(v.total_amount) as total_amount
            FROM vouchers v
            JOIN parties p ON p.id = v.party_id
            WHERE v.company_id = :company_id
            AND v.voucher_type = 'sale'
            AND v.voucher_date >= :start_date
            AND v.voucher_date < :end_date
            AND v.deleted_at IS NULL
            GROUP BY p.id, p.party_name
            ORDER BY total_amount DESC
            LIMIT 10
        """)
        
        top_customers_result = db.execute(top_customers_query, {
            "company_id": str(current_user.company_id),
            "start_date": start_date,
            "end_date": end_date
        }).fetchall()
        
        top_customers = [
            {
                "customer_id": str(row.id),
                "customer_name": row.party_name,
                "total_amount": float(row.total_amount),
                "invoice_count": row.invoice_count
            }
            for row in top_customers_result
        ]
        
        # Monthly trend (placeholder - can be enhanced)
        monthly_trend = []
        
        # Category breakdown (placeholder - can be enhanced)
        category_breakdown = []
        
        return SalesAnalytics(
            period_start=start_date,
            period_end=end_date,
            total_sales=result.total_sales or 0,
            total_amount=Decimal(str(result.total_amount or 0)),
            average_sale_value=Decimal(str(result.average_sale_value or 0)),
            top_customers=top_customers,
            category_breakdown=category_breakdown,
            monthly_trend=monthly_trend
        )
        
    except Exception as e:
        logger.error(f"Get sales analytics error: {e}")
        today = date.today()
        return SalesAnalytics(
            period_start=start_date or date(today.year, today.month, 1),
            period_end=end_date or today,
            total_sales=0,
            total_amount=Decimal('0'),
            average_sale_value=Decimal('0'),
            top_customers=[],
            category_breakdown=[],
            monthly_trend=[]
        )


@router.get("/receivables/aging", response_model=ReceivablesAging)
async def get_receivables_aging(
    current_user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get receivables aging report"""
    try:
        # Aging buckets based on voucher_date
        # TODO: Should use due_date when available
        query = text("""
            SELECT 
                CASE 
                    WHEN v.voucher_date >= CURRENT_DATE THEN 'Current'
                    WHEN v.voucher_date >= CURRENT_DATE - INTERVAL '30 days' THEN '1-30'
                    WHEN v.voucher_date >= CURRENT_DATE - INTERVAL '60 days' THEN '31-60'
                    WHEN v.voucher_date >= CURRENT_DATE - INTERVAL '90 days' THEN '61-90'
                    ELSE '90+'
                END as bucket,
                COUNT(*) as count,
                COALESCE(SUM(v.balance_amount), 0) as amount
            FROM vouchers v
            WHERE v.company_id = :company_id
            AND v.voucher_type = 'sale'
            AND v.status = 'confirmed'
            AND v.balance_amount > 0
            AND v.deleted_at IS NULL
            GROUP BY bucket
            ORDER BY 
                CASE bucket
                    WHEN 'Current' THEN 1
                    WHEN '1-30' THEN 2
                    WHEN '31-60' THEN 3
                    WHEN '61-90' THEN 4
                    WHEN '90+' THEN 5
                END
        """)
        
        result = db.execute(query, {"company_id": str(current_user.company_id)}).fetchall()
        
        summary = {
            "total_outstanding": Decimal('0'),
            "current": Decimal('0'),
            "days_1_30": Decimal('0'),
            "days_31_60": Decimal('0'),
            "days_61_90": Decimal('0'),
            "days_90_plus": Decimal('0')
        }
        
        for row in result:
            amount = Decimal(str(row.amount))
            summary["total_outstanding"] += amount
            
            if row.bucket == 'Current':
                summary["current"] = amount
            elif row.bucket == '1-30':
                summary["days_1_30"] = amount
            elif row.bucket == '31-60':
                summary["days_31_60"] = amount
            elif row.bucket == '61-90':
                summary["days_61_90"] = amount
            elif row.bucket == '90+':
                summary["days_90_plus"] = amount
        
        # By customer (top 20)
        by_customer_query = text("""
            SELECT 
                p.id, p.party_name,
                SUM(v.balance_amount) as total_outstanding,
                SUM(CASE WHEN v.voucher_date >= CURRENT_DATE THEN v.balance_amount ELSE 0 END) as current,
                SUM(CASE WHEN v.voucher_date >= CURRENT_DATE - INTERVAL '30 days' AND v.voucher_date < CURRENT_DATE THEN v.balance_amount ELSE 0 END) as days_1_30,
                SUM(CASE WHEN v.voucher_date >= CURRENT_DATE - INTERVAL '60 days' AND v.voucher_date < CURRENT_DATE - INTERVAL '30 days' THEN v.balance_amount ELSE 0 END) as days_31_60,
                SUM(CASE WHEN v.voucher_date >= CURRENT_DATE - INTERVAL '90 days' AND v.voucher_date < CURRENT_DATE - INTERVAL '60 days' THEN v.balance_amount ELSE 0 END) as days_61_90,
                SUM(CASE WHEN v.voucher_date < CURRENT_DATE - INTERVAL '90 days' THEN v.balance_amount ELSE 0 END) as days_90_plus
            FROM vouchers v
            JOIN parties p ON p.id = v.party_id
            WHERE v.company_id = :company_id
            AND v.voucher_type = 'sale'
            AND v.status = 'confirmed'
            AND v.balance_amount > 0
            AND v.deleted_at IS NULL
            GROUP BY p.id, p.party_name
            ORDER BY total_outstanding DESC
            LIMIT 20
        """)
        
        by_customer_result = db.execute(by_customer_query, {
            "company_id": str(current_user.company_id)
        }).fetchall()
        
        by_customer = [
            {
                "customer_id": str(row.id),
                "customer_name": row.party_name,
                "total_outstanding": float(row.total_outstanding),
                "current": float(row.current),
                "days_1_30": float(row.days_1_30),
                "days_31_60": float(row.days_31_60),
                "days_61_90": float(row.days_61_90),
                "days_90_plus": float(row.days_90_plus)
            }
            for row in by_customer_result
        ]
        
        return ReceivablesAging(
            summary=summary,
            by_customer=by_customer,
            invoices=[]  # Can be populated if needed
        )
        
    except Exception as e:
        logger.error(f"Get receivables aging error: {e}")
        return ReceivablesAging(
            summary={
                "total_outstanding": Decimal('0'),
                "current": Decimal('0'),
                "days_1_30": Decimal('0'),
                "days_31_60": Decimal('0'),
                "days_61_90": Decimal('0'),
                "days_90_plus": Decimal('0')
            },
            by_customer=[],
            invoices=[]
        )


@router.post("/generate", response_model=SalesResponse, status_code=status.HTTP_201_CREATED)
async def generate_invoice(
    sale: SalesCreate,
    current_user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Generate sales invoice with auto-generated invoice number
    
    Uses document_sequences for proper numbering.
    Validates GST calculations server-side.
    """
    try:
        # Get financial year
        fy_id = get_active_fy_id(db, str(current_user.company_id))
        
        # Generate invoice number using document sequence
        invoice_number = document_sequence_service.get_next_number(
            db, str(current_user.company_id), fy_id, 'sale'
        )
        
        # Override voucher number with generated one
        sale.voucher_number = invoice_number
        
        # Create the sale
        return await create_sale(sale, current_user, db)
        
    except HTTPException:
        db.rollback()
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"Generate invoice error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to generate invoice: {str(e)}"
        )


# ============================================================================
# CRUD ROUTES
# ============================================================================

@router.get("", response_model=SalesListResponse)
@router.get("/", response_model=SalesListResponse, include_in_schema=False)
async def get_sales(
    status_filter: Optional[str] = Query(None, alias="status"),
    party_id: Optional[str] = Query(None),
    date_from: Optional[date] = Query(None),
    date_to: Optional[date] = Query(None),
    search: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=100),
    current_user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get list of sales invoices with filters and pagination"""
    try:
        query = """
            SELECT 
                v.id, v.company_id, v.fy_id, v.voucher_type, v.voucher_number,
                v.voucher_date, v.ref_number, v.ref_date, v.party_id,
                v.subtotal, v.discount_amount, v.taxable_amount,
                v.cgst_amount, v.sgst_amount, v.igst_amount, v.cess_amount,
                v.tcs_amount, v.round_off, v.total_amount, v.paid_amount,
                v.balance_amount, v.supply_type, v.place_of_supply,
                v.reverse_charge, v.is_einvoice, v.irn, v.ack_number, v.ack_date,
                v.status, v.notes, v.terms_and_conditions,
                v.created_by, v.created_at, v.updated_at,
                v.confirmed_by, v.confirmed_at,
                p.party_name
            FROM vouchers v
            LEFT JOIN parties p ON p.id = v.party_id
            WHERE v.company_id = :company_id
            AND v.voucher_type = 'sale'
            AND v.deleted_at IS NULL
        """
        
        params = {"company_id": str(current_user.company_id)}
        
        if status_filter and status_filter != 'all':
            query += " AND v.status = :status"
            params["status"] = status_filter
        
        if party_id:
            query += " AND v.party_id = :party_id"
            params["party_id"] = party_id
        
        if date_from:
            query += " AND v.voucher_date >= :date_from"
            params["date_from"] = date_from
        
        if date_to:
            query += " AND v.voucher_date <= :date_to"
            params["date_to"] = date_to
        
        if search:
            query += """ AND (
                v.voucher_number ILIKE :search OR
                v.ref_number ILIKE :search OR
                v.notes ILIKE :search OR
                p.party_name ILIKE :search
            )"""
            params["search"] = f"%{search}%"
        
        count_query = f"SELECT COUNT(*) FROM ({query}) AS subquery"
        count_result = db.execute(text(count_query), params).fetchone()
        total = count_result[0] if count_result else 0
        
        query += " ORDER BY v.voucher_date DESC, v.created_at DESC LIMIT :limit OFFSET :offset"
        params["limit"] = page_size
        params["offset"] = (page - 1) * page_size
        
        result = db.execute(text(query), params).fetchall()
        
        sales = []
        for row in result:
            sales.append(SalesResponse(
                id=str(row.id),
                company_id=str(row.company_id),
                fy_id=str(row.fy_id),
                voucher_type=row.voucher_type,
                voucher_number=row.voucher_number,
                voucher_date=row.voucher_date,
                ref_number=row.ref_number,
                ref_date=row.ref_date,
                party_id=str(row.party_id) if row.party_id else None,
                subtotal=Decimal(str(row.subtotal)),
                discount_amount=Decimal(str(row.discount_amount)),
                taxable_amount=Decimal(str(row.taxable_amount)),
                cgst_amount=Decimal(str(row.cgst_amount)),
                sgst_amount=Decimal(str(row.sgst_amount)),
                igst_amount=Decimal(str(row.igst_amount)),
                cess_amount=Decimal(str(row.cess_amount)),
                tcs_amount=Decimal(str(row.tcs_amount)),
                round_off=Decimal(str(row.round_off)),
                total_amount=Decimal(str(row.total_amount)),
                paid_amount=Decimal(str(row.paid_amount)),
                balance_amount=Decimal(str(row.balance_amount)),
                supply_type=row.supply_type,
                place_of_supply=row.place_of_supply,
                reverse_charge=row.reverse_charge,
                is_einvoice=row.is_einvoice,
                irn=row.irn,
                ack_number=row.ack_number,
                ack_date=row.ack_date,
                status=row.status,
                notes=row.notes,
                terms_and_conditions=row.terms_and_conditions,
                created_by=str(row.created_by) if row.created_by else None,
                created_at=row.created_at,
                updated_at=row.updated_at,
                confirmed_by=str(row.confirmed_by) if row.confirmed_by else None,
                confirmed_at=row.confirmed_at
            ))
        
        total_pages = (total + page_size - 1) // page_size
        
        return SalesListResponse(
            sales=sales,
            total=total,
            page=page,
            page_size=page_size,
            total_pages=total_pages
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Get sales error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch sales: {str(e)}"
        )


@router.post("", response_model=SalesResponse, status_code=status.HTTP_201_CREATED)
@router.post("/", response_model=SalesResponse, status_code=status.HTTP_201_CREATED, include_in_schema=False)
async def create_sale(
    sale: SalesCreate,
    current_user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Create a new sales invoice
    
    Validates:
    - Party exists and is a customer
    - Products exist
    - GST calculations are correct
    
    Does NOT post to ledger or inventory (only on confirmation)
    """
    try:
        # Validate party
        party = validate_party_exists(db, sale.party_id, str(current_user.company_id))
        
        # Validate products
        validate_products_exist(db, sale.items, str(current_user.company_id))
        
        # Get company state for GST validation
        company_state = get_company_state(db, str(current_user.company_id))
        
        # Determine if interstate
        is_interstate, supply_type = gst_service.determine_supply_type(
            party_gstin=party.gstin,
            company_gstin=None,  # TODO: Get from company
            party_state=party.state,
            company_state=company_state
        )
        
        # Recalculate and validate GST for each line item
        calculated_items = []
        for item in sale.items:
            calc_result = gst_service.calculate_line_item_gst(
                quantity=item.quantity,
                rate=item.rate,
                discount_pct=item.discount_pct,
                gst_rate=item.cgst_rate + item.sgst_rate + item.igst_rate,
                is_interstate=is_interstate,
                cess_rate=item.cess_rate
            )
            
            calculated_items.append({
                **item.dict(),
                'taxable_amount': calc_result.taxable_amount,
                'cgst_rate': calc_result.cgst_rate,
                'cgst_amount': calc_result.cgst_amount,
                'sgst_rate': calc_result.sgst_rate,
                'sgst_amount': calc_result.sgst_amount,
                'igst_rate': calc_result.igst_rate,
                'igst_amount': calc_result.igst_amount,
                'cess_amount': calc_result.cess_amount,
                'line_total': calc_result.total_amount
            })
        
        # Calculate voucher totals
        voucher_totals = gst_service.calculate_voucher_totals(calculated_items, is_interstate)
        
        # Get financial year
        fy_id = get_active_fy_id(db, str(current_user.company_id))
        
        # Create voucher
        voucher_id = str(uuid.uuid4())
        
        voucher_query = text("""
            INSERT INTO vouchers (
                id, company_id, fy_id, voucher_type, voucher_number, voucher_date,
                ref_number, ref_date, party_id,
                subtotal, discount_amount, taxable_amount,
                cgst_amount, sgst_amount, igst_amount, cess_amount,
                tcs_amount, round_off, total_amount, paid_amount,
                supply_type, place_of_supply, reverse_charge, is_einvoice,
                status, notes, terms_and_conditions,
                created_by, created_at, updated_at
            ) VALUES (
                :id, :company_id, :fy_id, 'sale', :voucher_number, :voucher_date,
                :ref_number, :ref_date, :party_id,
                :subtotal, :discount_amount, :taxable_amount,
                :cgst_amount, :sgst_amount, :igst_amount, :cess_amount,
                :tcs_amount, :round_off, :total_amount, 0,
                :supply_type, :place_of_supply, :reverse_charge, :is_einvoice,
                'draft', :notes, :terms_and_conditions,
                :created_by, NOW(), NOW()
            )
            RETURNING *
        """)
        
        voucher_result = db.execute(voucher_query, {
            "id": voucher_id,
            "company_id": str(current_user.company_id),
            "fy_id": fy_id,
            "voucher_number": sale.voucher_number,
            "voucher_date": sale.voucher_date,
            "ref_number": sale.ref_number,
            "ref_date": sale.ref_date,
            "party_id": sale.party_id,
            "subtotal": float(voucher_totals['subtotal']),
            "discount_amount": float(voucher_totals['discount_amount']),
            "taxable_amount": float(voucher_totals['taxable_amount']),
            "cgst_amount": float(voucher_totals['cgst_amount']),
            "sgst_amount": float(voucher_totals['sgst_amount']),
            "igst_amount": float(voucher_totals['igst_amount']),
            "cess_amount": float(voucher_totals['cess_amount']),
            "tcs_amount": float(sale.tcs_amount),
            "round_off": float(voucher_totals['round_off']),
            "total_amount": float(voucher_totals['total_amount']),
            "supply_type": sale.supply_type or supply_type,
            "place_of_supply": sale.place_of_supply,
            "reverse_charge": sale.reverse_charge,
            "is_einvoice": sale.is_einvoice,
            "notes": sale.notes,
            "terms_and_conditions": sale.terms_and_conditions,
            "created_by": str(current_user.user_id)
        }).fetchone()
        
        # Insert line items
        for idx, item in enumerate(calculated_items):
            item_id = str(uuid.uuid4())
            item_query = text("""
                INSERT INTO voucher_items (
                    id, voucher_id, line_number, product_id, description,
                    hsn_sac_code, quantity, rate, discount_pct, discount_amount,
                    taxable_amount, cgst_rate, cgst_amount, sgst_rate, sgst_amount,
                    igst_rate, igst_amount, cess_rate, cess_amount, line_total,
                    created_at
                ) VALUES (
                    :id, :voucher_id, :line_number, :product_id, :description,
                    :hsn_sac_code, :quantity, :rate, :discount_pct, :discount_amount,
                    :taxable_amount, :cgst_rate, :cgst_amount, :sgst_rate, :sgst_amount,
                    :igst_rate, :igst_amount, :cess_rate, :cess_amount, :line_total,
                    NOW()
                )
            """)
            
            db.execute(item_query, {
                "id": item_id,
                "voucher_id": voucher_id,
                "line_number": item['line_number'],
                "product_id": item.get('product_id'),
                "description": item['description'],
                "hsn_sac_code": item.get('hsn_sac_code'),
                "quantity": float(item['quantity']),
                "rate": float(item['rate']),
                "discount_pct": float(item['discount_pct']),
                "discount_amount": float(item.get('discount_amount', 0)),
                "taxable_amount": float(item['taxable_amount']),
                "cgst_rate": float(item['cgst_rate']),
                "cgst_amount": float(item['cgst_amount']),
                "sgst_rate": float(item['sgst_rate']),
                "sgst_amount": float(item['sgst_amount']),
                "igst_rate": float(item['igst_rate']),
                "igst_amount": float(item['igst_amount']),
                "cess_rate": float(item['cess_rate']),
                "cess_amount": float(item['cess_amount']),
                "line_total": float(item['line_total'])
            })
        
        db.commit()
        
        logger.info(f"Created sale: {voucher_id}")
        
        # Return created sale
        return await get_sale(voucher_id, current_user, db)
        
    except HTTPException:
        db.rollback()
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"Create sale error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create sale: {str(e)}"
        )


@router.get("/{sale_id}", response_model=SalesResponse)
async def get_sale(
    sale_id: str,
    current_user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get sales invoice by ID with line items"""
    try:
        query = text("""
            SELECT 
                v.id, v.company_id, v.fy_id, v.voucher_type, v.voucher_number,
                v.voucher_date, v.ref_number, v.ref_date, v.party_id,
                v.subtotal, v.discount_amount, v.taxable_amount,
                v.cgst_amount, v.sgst_amount, v.igst_amount, v.cess_amount,
                v.tcs_amount, v.round_off, v.total_amount, v.paid_amount,
                v.balance_amount, v.supply_type, v.place_of_supply,
                v.reverse_charge, v.is_einvoice, v.irn, v.ack_number, v.ack_date,
                v.status, v.notes, v.terms_and_conditions,
                v.created_by, v.created_at, v.updated_at,
                v.confirmed_by, v.confirmed_at
            FROM vouchers v
            WHERE v.id = :sale_id
            AND v.company_id = :company_id
            AND v.voucher_type = 'sale'
            AND v.deleted_at IS NULL
        """)
        
        result = db.execute(query, {
            "sale_id": sale_id,
            "company_id": str(current_user.company_id)
        }).fetchone()
        
        if not result:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Sale not found"
            )
        
        # Get line items
        items_query = text("""
            SELECT 
                id, voucher_id, line_number, product_id, description,
                hsn_sac_code, quantity, rate, discount_pct, discount_amount,
                taxable_amount, cgst_rate, cgst_amount, sgst_rate, sgst_amount,
                igst_rate, igst_amount, cess_rate, cess_amount, line_total,
                created_at
            FROM voucher_items
            WHERE voucher_id = :voucher_id
            ORDER BY line_number
        """)
        
        items_result = db.execute(items_query, {"voucher_id": sale_id}).fetchall()
        
        from schemas.sales_schemas import SalesItemResponse
        items = [
            SalesItemResponse(
                id=str(item.id),
                voucher_id=str(item.voucher_id),
                line_number=item.line_number,
                product_id=str(item.product_id) if item.product_id else None,
                description=item.description,
                hsn_sac_code=item.hsn_sac_code,
                quantity=Decimal(str(item.quantity)),
                rate=Decimal(str(item.rate)),
                discount_pct=Decimal(str(item.discount_pct)),
                discount_amount=Decimal(str(item.discount_amount)),
                taxable_amount=Decimal(str(item.taxable_amount)),
                cgst_rate=Decimal(str(item.cgst_rate)),
                cgst_amount=Decimal(str(item.cgst_amount)),
                sgst_rate=Decimal(str(item.sgst_rate)),
                sgst_amount=Decimal(str(item.sgst_amount)),
                igst_rate=Decimal(str(item.igst_rate)),
                igst_amount=Decimal(str(item.igst_amount)),
                cess_rate=Decimal(str(item.cess_rate)),
                cess_amount=Decimal(str(item.cess_amount)),
                line_total=Decimal(str(item.line_total)),
                created_at=item.created_at
            )
            for item in items_result
        ]
        
        return SalesResponse(
            id=str(result.id),
            company_id=str(result.company_id),
            fy_id=str(result.fy_id),
            voucher_type=result.voucher_type,
            voucher_number=result.voucher_number,
            voucher_date=result.voucher_date,
            ref_number=result.ref_number,
            ref_date=result.ref_date,
            party_id=str(result.party_id) if result.party_id else None,
            subtotal=Decimal(str(result.subtotal)),
            discount_amount=Decimal(str(result.discount_amount)),
            taxable_amount=Decimal(str(result.taxable_amount)),
            cgst_amount=Decimal(str(result.cgst_amount)),
            sgst_amount=Decimal(str(result.sgst_amount)),
            igst_amount=Decimal(str(result.igst_amount)),
            cess_amount=Decimal(str(result.cess_amount)),
            tcs_amount=Decimal(str(result.tcs_amount)),
            round_off=Decimal(str(result.round_off)),
            total_amount=Decimal(str(result.total_amount)),
            paid_amount=Decimal(str(result.paid_amount)),
            balance_amount=Decimal(str(result.balance_amount)),
            supply_type=result.supply_type,
            place_of_supply=result.place_of_supply,
            reverse_charge=result.reverse_charge,
            is_einvoice=result.is_einvoice,
            irn=result.irn,
            ack_number=result.ack_number,
            ack_date=result.ack_date,
            status=result.status,
            notes=result.notes,
            terms_and_conditions=result.terms_and_conditions,
            created_by=str(result.created_by) if result.created_by else None,
            created_at=result.created_at,
            updated_at=result.updated_at,
            confirmed_by=str(result.confirmed_by) if result.confirmed_by else None,
            confirmed_at=result.confirmed_at,
            items=items
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Get sale error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to fetch sale"
        )


@router.put("/{sale_id}", response_model=SalesResponse)
async def update_sale(
    sale_id: str,
    updates: SalesUpdate,
    current_user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update sales invoice (only drafts can be edited)"""
    try:
        # Check current status
        check_query = text("""
            SELECT status FROM vouchers
            WHERE id = :sale_id
            AND company_id = :company_id
            AND voucher_type = 'sale'
            AND deleted_at IS NULL
        """)
        
        check_result = db.execute(check_query, {
            "sale_id": sale_id,
            "company_id": str(current_user.company_id)
        }).fetchone()
        
        if not check_result:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Sale not found"
            )
        
        # Only drafts can be edited
        if check_result.status != 'draft':
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Cannot edit invoice in '{check_result.status}' status. Only draft invoices can be edited."
            )
        
        # Build update query
        update_fields = []
        params = {
            "sale_id": sale_id,
            "company_id": str(current_user.company_id),
            "updated_by": str(current_user.user_id)
        }
        
        update_data = updates.dict(exclude_unset=True, exclude={'items'})
        for field, value in update_data.items():
            if value is not None:
                update_fields.append(f"{field} = :{field}")
                params[field] = float(value) if isinstance(value, Decimal) else value
        
        if update_fields:
            update_fields.append("updated_at = NOW()")
            update_fields.append("updated_by = :updated_by")
            
            update_query = text(f"""
                UPDATE vouchers
                SET {', '.join(update_fields)}
                WHERE id = :sale_id
                AND company_id = :company_id
                AND voucher_type = 'sale'
                AND deleted_at IS NULL
            """)
            
            db.execute(update_query, params)
        
        # Update items if provided
        if updates.items is not None:
            # Delete existing items
            delete_items_query = text("DELETE FROM voucher_items WHERE voucher_id = :voucher_id")
            db.execute(delete_items_query, {"voucher_id": sale_id})
            
            # Insert new items
            for item in updates.items:
                item_id = str(uuid.uuid4())
                item_query = text("""
                    INSERT INTO voucher_items (
                        id, voucher_id, line_number, product_id, description,
                        hsn_sac_code, quantity, rate, discount_pct, discount_amount,
                        taxable_amount, cgst_rate, cgst_amount, sgst_rate, sgst_amount,
                        igst_rate, igst_amount, cess_rate, cess_amount, line_total,
                        created_at
                    ) VALUES (
                        :id, :voucher_id, :line_number, :product_id, :description,
                        :hsn_sac_code, :quantity, :rate, :discount_pct, :discount_amount,
                        :taxable_amount, :cgst_rate, :cgst_amount, :sgst_rate, :sgst_amount,
                        :igst_rate, :igst_amount, :cess_rate, :cess_amount, :line_total,
                        NOW()
                    )
                """)
                
                db.execute(item_query, {
                    "id": item_id,
                    "voucher_id": sale_id,
                    "line_number": item.line_number,
                    "product_id": item.product_id,
                    "description": item.description,
                    "hsn_sac_code": item.hsn_sac_code,
                    "quantity": float(item.quantity),
                    "rate": float(item.rate),
                    "discount_pct": float(item.discount_pct),
                    "discount_amount": float(item.discount_amount),
                    "taxable_amount": float(item.taxable_amount),
                    "cgst_rate": float(item.cgst_rate),
                    "cgst_amount": float(item.cgst_amount),
                    "sgst_rate": float(item.sgst_rate),
                    "sgst_amount": float(item.sgst_amount),
                    "igst_rate": float(item.igst_rate),
                    "igst_amount": float(item.igst_amount),
                    "cess_rate": float(item.cess_rate),
                    "cess_amount": float(item.cess_amount),
                    "line_total": float(item.line_total)
                })
        
        db.commit()
        
        return await get_sale(sale_id, current_user, db)
        
    except HTTPException:
        db.rollback()
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"Update sale error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update sale"
        )


@router.delete("/{sale_id}")
async def delete_sale(
    sale_id: str,
    current_user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Soft delete sales invoice (only drafts can be deleted)"""
    try:
        query = text("""
            UPDATE vouchers
            SET deleted_at = NOW()
            WHERE id = :sale_id
            AND company_id = :company_id
            AND voucher_type = 'sale'
            AND status = 'draft'
            AND deleted_at IS NULL
            RETURNING id
        """)
        
        result = db.execute(query, {
            "sale_id": sale_id,
            "company_id": str(current_user.company_id)
        }).fetchone()
        
        if not result:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Sale not found or cannot be deleted (only draft sales can be deleted)"
            )
        
        db.commit()
        
        logger.info(f"Deleted sale: {sale_id}")
        return {"message": "Sale deleted successfully"}
        
    except HTTPException:
        db.rollback()
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"Delete sale error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to delete sale"
        )


# ============================================================================
# WORKFLOW ROUTES
# ============================================================================

@router.post("/{sale_id}/confirm", response_model=SalesResponse)
async def confirm_sale(
    sale_id: str,
    current_user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Confirm sales invoice
    
    Posts to:
    - Ledger (double-entry)
    - Inventory (decrements stock)
    """
    try:
        # Get sale
        sale = await get_sale(sale_id, current_user, db)
        
        # Validate status transition
        validate_status_transition(sale.status, 'confirmed')
        
        # Update status
        update_query = text("""
            UPDATE vouchers
            SET status = 'confirmed',
                confirmed_by = :confirmed_by,
                confirmed_at = NOW(),
                updated_at = NOW()
            WHERE id = :sale_id
            AND company_id = :company_id
        """)
        
        db.execute(update_query, {
            "sale_id": sale_id,
            "confirmed_by": str(current_user.user_id),
            "company_id": str(current_user.company_id)
        })
        
        # Post to ledger
        ledger_service.post_sales_invoice(
            db=db,
            voucher_id=sale_id,
            company_id=str(current_user.company_id),
            party_id=sale.party_id,
            voucher_date=sale.voucher_date,
            taxable_amount=sale.taxable_amount,
            cgst_amount=sale.cgst_amount,
            sgst_amount=sale.sgst_amount,
            igst_amount=sale.igst_amount,
            cess_amount=sale.cess_amount,
            total_amount=sale.total_amount,
            narration=sale.notes
        )
        
        # Post to inventory
        items_dict = [item.dict() for item in sale.items] if sale.items else []
        inventory_service.create_sales_movements(
            db=db,
            voucher_id=sale_id,
            company_id=str(current_user.company_id),
            voucher_date=sale.voucher_date,
            line_items=items_dict
        )
        
        db.commit()
        
        logger.info(f"Confirmed sale: {sale_id}")
        
        return await get_sale(sale_id, current_user, db)
        
    except HTTPException:
        db.rollback()
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"Confirm sale error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to confirm sale: {str(e)}"
        )


@router.post("/{sale_id}/cancel", response_model=SalesResponse)
async def cancel_sale(
    sale_id: str,
    reason: Optional[str] = Query(None),
    current_user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Cancel sales invoice
    
    Reverses:
    - Ledger entries
    - Inventory movements
    """
    try:
        # Get sale
        sale = await get_sale(sale_id, current_user, db)
        
        # Validate status transition
        validate_status_transition(sale.status, 'cancelled')
        
        # If confirmed, reverse ledger and inventory
        if sale.status == 'confirmed':
            # Reverse ledger entries
            ledger_service.reverse_ledger_entries(db, sale_id)
            
            # Reverse inventory movements
            inventory_service.reverse_movements(db, sale_id)
        
        # Update status
        update_query = text("""
            UPDATE vouchers
            SET status = 'cancelled',
                cancelled_by = :cancelled_by,
                cancelled_at = NOW(),
                cancellation_reason = :reason,
                updated_at = NOW()
            WHERE id = :sale_id
            AND company_id = :company_id
        """)
        
        db.execute(update_query, {
            "sale_id": sale_id,
            "cancelled_by": str(current_user.user_id),
            "reason": reason,
            "company_id": str(current_user.company_id)
        })
        
        db.commit()
        
        logger.info(f"Cancelled sale: {sale_id}")
        
        return await get_sale(sale_id, current_user, db)
        
    except HTTPException:
        db.rollback()
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"Cancel sale error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to cancel sale: {str(e)}"
        )
