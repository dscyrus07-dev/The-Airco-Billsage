"""
Sales Router - Complete Implementation with Real Database

Handles sales invoices/vouchers with full CRUD operations.
All operations use real PostgreSQL database (vouchers table).
"""

from fastapi import APIRouter, HTTPException, Depends, Query, status
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from sqlalchemy import text
from typing import Optional
import logging
from datetime import datetime, date, timedelta
import uuid
from decimal import Decimal

from config.database import get_db
from dependencies.auth import get_current_user, CurrentUser
from schemas.sales_schemas import (
    SalesCreate, SalesUpdate, SalesResponse, SalesListResponse,
    SalesKPIs, SalesAnalytics, InvoiceGenerateRequest
)

logger = logging.getLogger(__name__)
router = APIRouter()


def get_or_create_active_financial_year(db: Session, company_id: str) -> str:
    """Get existing active financial year or create a default one"""
    # First try to get existing active FY
    query = text("""
        SELECT id FROM financial_years
        WHERE company_id = :company_id
        AND is_current = TRUE
        LIMIT 1
    """)
    result = db.execute(query, {"company_id": company_id}).fetchone()
    
    if result:
        return str(result.id)
    
    # No active FY found, create one
    logger.info(f"No active financial year found for company {company_id}, creating default")
    
    # Get company's financial year start month (default April)
    fy_start_month = 4  # Default to April
    company_settings_query = text("""
        SELECT financial_year_start_month FROM company_details
        WHERE company_id = :company_id
        LIMIT 1
    """)
    company_result = db.execute(company_settings_query, {"company_id": company_id}).fetchone()
    if company_result and company_result.financial_year_start_month:
        fy_start_month = company_result.financial_year_start_month
    
    # Calculate current financial year dates
    today = date.today()
    current_year = today.year
    
    if today.month >= fy_start_month:
        # Current year financial year (e.g., April 2026 to March 2027)
        fy_start_date = date(current_year, fy_start_month, 1)
        fy_end_date = date(current_year + 1, fy_start_month, 1) - timedelta(days=1)
        fy_label = f"{current_year}-{current_year + 1}"
    else:
        # Previous year financial year (e.g., April 2025 to March 2026)
        fy_start_date = date(current_year - 1, fy_start_month, 1)
        fy_end_date = date(current_year, fy_start_month, 1) - timedelta(days=1)
        fy_label = f"{current_year - 1}-{current_year}"
    
    # Ensure no other active FY exists (shouldn't happen, but be safe)
    db.execute(text("""
        UPDATE financial_years 
        SET is_current = FALSE 
        WHERE company_id = :company_id
    """), {"company_id": company_id})
    
    # Create new financial year
    fy_id = str(uuid.uuid4())
    create_query = text("""
        INSERT INTO financial_years (
            id, company_id, fy_label, start_date, end_date, 
            is_current, is_locked, created_at
        ) VALUES (
            :id, :company_id, :fy_label, :start_date, :end_date,
            TRUE, FALSE, now()
        )
    """)
    
    db.execute(create_query, {
        "id": fy_id,
        "company_id": company_id,
        "fy_label": fy_label,
        "start_date": fy_start_date,
        "end_date": fy_end_date
    })
    
    logger.info(f"Created financial year {fy_label} for company {company_id}: {fy_start_date} to {fy_end_date}")
    
    return fy_id


def get_active_fy_id(db: Session, company_id: str) -> str:
    """Get active financial year ID for the company"""
    return get_or_create_active_financial_year(db, company_id)


def generate_invoice_number(db: Session, company_id: str, fy_id: str) -> str:
    """Generate next invoice number for the company"""
    query = text("""
        SELECT COUNT(*) FROM vouchers
        WHERE company_id = :company_id
        AND fy_id = :fy_id
        AND voucher_type = 'sale'
    """)
    result = db.execute(query, {"company_id": company_id, "fy_id": fy_id}).fetchone()
    count = result[0] if result else 0
    return f"INV-{count + 1:05d}"


@router.get("", response_model=SalesListResponse)
@router.get("/", response_model=SalesListResponse, include_in_schema=False)
async def get_sales(
    status_filter: Optional[str] = Query(None, alias="status"),
    customer: Optional[str] = Query(None, alias="party_id"),
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
                v.confirmed_by, v.confirmed_at
            FROM vouchers v
            WHERE v.company_id = :company_id
            AND v.voucher_type = 'sale'
            AND v.deleted_at IS NULL
        """
        
        params = {"company_id": str(current_user.company_id)}
        
        if status_filter and status_filter != 'all':
            query += " AND v.status = :status"
            params["status"] = status_filter
        
        if customer:
            query += " AND v.party_id = :party_id"
            params["party_id"] = customer
        
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
                v.notes ILIKE :search
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
            sales.append({
                "id": str(row.id),
                "company_id": str(row.company_id),
                "fy_id": str(row.fy_id),
                "voucher_type": row.voucher_type,
                "voucher_number": row.voucher_number,
                "voucher_date": row.voucher_date,
                "ref_number": row.ref_number,
                "ref_date": row.ref_date,
                "party_id": str(row.party_id) if row.party_id else None,
                "subtotal": float(row.subtotal),
                "discount_amount": float(row.discount_amount),
                "taxable_amount": float(row.taxable_amount),
                "cgst_amount": float(row.cgst_amount),
                "sgst_amount": float(row.sgst_amount),
                "igst_amount": float(row.igst_amount),
                "cess_amount": float(row.cess_amount),
                "tcs_amount": float(row.tcs_amount),
                "round_off": float(row.round_off),
                "total_amount": float(row.total_amount),
                "paid_amount": float(row.paid_amount),
                "balance_amount": float(row.balance_amount),
                "supply_type": row.supply_type,
                "place_of_supply": row.place_of_supply,
                "reverse_charge": row.reverse_charge,
                "is_einvoice": row.is_einvoice,
                "irn": row.irn,
                "ack_number": row.ack_number,
                "ack_date": row.ack_date,
                "status": row.status,
                "notes": row.notes,
                "terms_and_conditions": row.terms_and_conditions,
                "created_by": str(row.created_by) if row.created_by else None,
                "created_at": row.created_at,
                "updated_at": row.updated_at,
                "confirmed_by": str(row.confirmed_by) if row.confirmed_by else None,
                "confirmed_at": row.confirmed_at
            })
        
        total_pages = (total + page_size - 1) // page_size
        
        return {
            "sales": sales,
            "total": total,
            "page": page,
            "page_size": page_size,
            "total_pages": total_pages
        }
        
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
    """Create a new sales invoice"""
    try:
        fy_id = get_active_fy_id(db, str(current_user.company_id))
        voucher_id = str(uuid.uuid4())
        
        logger.info(f"Creating sale voucher - ID: {voucher_id}, Company: {current_user.company_id}, "
                   f"FY: {fy_id}, Number: {sale.voucher_number}, "
                   f"supply_type: '{sale.supply_type}', place_of_supply: '{sale.place_of_supply}', "
                   f"Total: {sale.total_amount}")
        
        voucher_query = text("""
            INSERT INTO vouchers (
                id, company_id, fy_id, voucher_type, voucher_number, voucher_date,
                ref_number, ref_date, party_id, billing_address_id, shipping_address_id,
                subtotal, discount_amount, taxable_amount,
                cgst_amount, sgst_amount, igst_amount, cess_amount,
                tds_amount, tcs_amount, round_off, total_amount, paid_amount,
                supply_type, place_of_supply, reverse_charge, is_einvoice,
                status, notes, terms_and_conditions, cost_centre_id,
                created_by, created_at, updated_at
            ) VALUES (
                :id, :company_id, :fy_id, 'sale', :voucher_number, :voucher_date,
                :ref_number, :ref_date, :party_id, NULL, NULL,
                :subtotal, :discount_amount, :taxable_amount,
                :cgst_amount, :sgst_amount, :igst_amount, :cess_amount,
                0, :tcs_amount, :round_off, :total_amount, 0,
                :supply_type, :place_of_supply, :reverse_charge, :is_einvoice,
                'draft', :notes, :terms_and_conditions, NULL,
                :created_by, NOW(), NOW()
            )
            RETURNING id, company_id, fy_id, voucher_type, voucher_number,
                      voucher_date, ref_number, ref_date, party_id,
                      billing_address_id, shipping_address_id,
                      subtotal, discount_amount, taxable_amount,
                      cgst_amount, sgst_amount, igst_amount, cess_amount,
                      tds_amount, tcs_amount, round_off, total_amount, paid_amount,
                      balance_amount, supply_type, place_of_supply,
                      reverse_charge, is_einvoice, irn, ack_number, ack_date,
                      status, notes, terms_and_conditions, cost_centre_id,
                      created_by, created_at, updated_at,
                      confirmed_by, confirmed_at
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
            "subtotal": float(sale.subtotal),
            "discount_amount": float(sale.discount_amount),
            "taxable_amount": float(sale.taxable_amount),
            "cgst_amount": float(sale.cgst_amount),
            "sgst_amount": float(sale.sgst_amount),
            "igst_amount": float(sale.igst_amount),
            "cess_amount": float(sale.cess_amount),
            "tcs_amount": float(sale.tcs_amount),
            "round_off": float(sale.round_off),
            "total_amount": float(sale.total_amount),
            "supply_type": sale.supply_type,
            "place_of_supply": sale.place_of_supply,
            "reverse_charge": sale.reverse_charge,
            "is_einvoice": sale.is_einvoice,
            "notes": sale.notes,
            "terms_and_conditions": sale.terms_and_conditions,
            "created_by": str(current_user.user_id)
        }).fetchone()
        
        for item in sale.items:
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
        
        logger.info(f"Created sale: {voucher_id}")
        
        return {
            "id": str(voucher_result.id),
            "company_id": str(voucher_result.company_id),
            "fy_id": str(voucher_result.fy_id),
            "voucher_type": voucher_result.voucher_type,
            "voucher_number": voucher_result.voucher_number,
            "voucher_date": voucher_result.voucher_date,
            "ref_number": voucher_result.ref_number,
            "ref_date": voucher_result.ref_date,
            "party_id": str(voucher_result.party_id) if voucher_result.party_id else None,
            "subtotal": float(voucher_result.subtotal),
            "discount_amount": float(voucher_result.discount_amount),
            "taxable_amount": float(voucher_result.taxable_amount),
            "cgst_amount": float(voucher_result.cgst_amount),
            "sgst_amount": float(voucher_result.sgst_amount),
            "igst_amount": float(voucher_result.igst_amount),
            "cess_amount": float(voucher_result.cess_amount),
            "tcs_amount": float(voucher_result.tcs_amount),
            "round_off": float(voucher_result.round_off),
            "total_amount": float(voucher_result.total_amount),
            "paid_amount": float(voucher_result.paid_amount),
            "balance_amount": float(voucher_result.balance_amount),
            "supply_type": voucher_result.supply_type,
            "place_of_supply": voucher_result.place_of_supply,
            "reverse_charge": voucher_result.reverse_charge,
            "is_einvoice": voucher_result.is_einvoice,
            "irn": voucher_result.irn,
            "ack_number": voucher_result.ack_number,
            "ack_date": voucher_result.ack_date,
            "status": voucher_result.status,
            "notes": voucher_result.notes,
            "terms_and_conditions": voucher_result.terms_and_conditions,
            "created_by": str(voucher_result.created_by) if voucher_result.created_by else None,
            "created_at": voucher_result.created_at,
            "updated_at": voucher_result.updated_at,
            "confirmed_by": str(voucher_result.confirmed_by) if voucher_result.confirmed_by else None,
            "confirmed_at": voucher_result.confirmed_at
        }
        
    except HTTPException:
        db.rollback()
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"Create sale error: {e}", exc_info=True)
        
        # Check if it's a constraint violation
        error_msg = str(e)
        if "CheckViolation" in error_msg or "check constraint" in error_msg.lower():
            logger.error(f"CHECK CONSTRAINT VIOLATION - supply_type: '{sale.supply_type}', "
                        f"voucher_type: 'sale', status: 'draft'")
        
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create sale: {str(e)}"
        )





@router.post("/generate", response_model=SalesResponse, status_code=status.HTTP_201_CREATED)
async def generate_invoice(
    invoice_request: InvoiceGenerateRequest,
    current_user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Generate sales invoice with auto-generated invoice number"""
    try:
        fy_id = get_active_fy_id(db, str(current_user.company_id))
        invoice_number = generate_invoice_number(db, str(current_user.company_id), fy_id)
        
        # Calculate totals from items
        subtotal = sum(float(item.line_total) for item in invoice_request.items)
        taxable_amount = sum(float(item.taxable_amount) for item in invoice_request.items)
        cgst_amount = sum(float(item.cgst_amount) for item in invoice_request.items)
        sgst_amount = sum(float(item.sgst_amount) for item in invoice_request.items)
        igst_amount = sum(float(item.igst_amount) for item in invoice_request.items)
        cess_amount = sum(float(item.cess_amount) for item in invoice_request.items)
        total_amount = subtotal + cgst_amount + sgst_amount + igst_amount + cess_amount
        
        # Map supply_type to valid DB constraint values
        # DB allows: 'B2B','B2C','B2CL','export','SEZ','exempt','nil'
        # Frontend may send location-based values like 'Intrastate' or 'Interstate'
        supply_type_mapping = {
            'intrastate': 'B2B',
            'interstate': 'B2B',
            'b2b': 'B2B',
            'b2c': 'B2C',
            'b2cl': 'B2CL',
            'export': 'export',
            'sez': 'SEZ',
            'exempt': 'exempt',
            'nil': 'nil'
        }
        
        raw_supply_type = (invoice_request.supply_type or 'B2B').lower()
        mapped_supply_type = supply_type_mapping.get(raw_supply_type, 'B2B')
        
        logger.info(f"Invoice generation - Company: {current_user.company_id}, "
                   f"Invoice: {invoice_number}, Party: {invoice_request.party_id}, "
                   f"Raw supply_type: '{invoice_request.supply_type}', "
                   f"Mapped supply_type: '{mapped_supply_type}', "
                   f"Place: {invoice_request.place_of_supply}")
        
        sale_data = SalesCreate(
            party_id=invoice_request.party_id,
            voucher_number=invoice_number,
            voucher_date=invoice_request.voucher_date or date.today(),
            items=invoice_request.items,
            subtotal=Decimal(str(subtotal)),
            taxable_amount=Decimal(str(taxable_amount)),
            cgst_amount=Decimal(str(cgst_amount)),
            sgst_amount=Decimal(str(sgst_amount)),
            igst_amount=Decimal(str(igst_amount)),
            cess_amount=Decimal(str(cess_amount)),
            total_amount=Decimal(str(total_amount)),
            supply_type=mapped_supply_type,
            place_of_supply=invoice_request.place_of_supply,
            notes=invoice_request.notes
        )
        
        return await create_sale(sale_data, current_user, db)
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Generate invoice error: {e}", exc_info=True)
        logger.error(f"Invoice request data - party_id: {invoice_request.party_id}, "
                    f"supply_type: {invoice_request.supply_type}, "
                    f"place_of_supply: {invoice_request.place_of_supply}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to generate invoice: {str(e)}"
        )





@router.get("/kpis", response_model=SalesKPIs)
async def get_sale_kpis(
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
        
        # Handle case when no sales data exists
        if not result:
            return {
                "total_sales": 0,
                "total_amount": 0.0,
                "pending_count": 0,
                "confirmed_count": 0,
                "draft_count": 0,
                "total_paid": 0.0,
                "total_outstanding": 0.0
            }
        
        return {
            "total_sales": result.total_sales or 0,
            "total_amount": float(result.total_amount or 0),
            "pending_count": result.pending_count or 0,
            "confirmed_count": result.confirmed_count or 0,
            "draft_count": result.draft_count or 0,
            "total_paid": float(result.total_paid or 0),
            "total_outstanding": float(result.total_outstanding or 0)
        }
        
    except Exception as e:
        logger.error(f"Get sales KPIs error: {e}")
        # Return default values on error instead of failing
        return {
            "total_sales": 0,
            "total_amount": 0.0,
            "pending_count": 0,
            "confirmed_count": 0,
            "draft_count": 0,
            "total_paid": 0.0,
            "total_outstanding": 0.0
        }





@router.get("/analytics", response_model=SalesAnalytics)
async def get_sale_analytics(
    start_date: Optional[date] = Query(None),
    end_date: Optional[date] = Query(None),
    current_user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get sales analytics from real data"""
    try:
        if not start_date or not end_date:
            today = date.today()
            start_date = date(today.year, today.month, 1)
            if today.month == 12:
                end_date = date(today.year + 1, 1, 1)
            else:
                end_date = date(today.year, today.month + 1, 1)
        
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
        
        # Handle case when no sales data exists
        if not result:
            return {
                "period_start": start_date,
                "period_end": end_date,
                "total_sales": 0,
                "total_amount": 0.0,
                "average_sale_value": 0.0,
                "top_customers": [],
                "category_breakdown": [],
                "monthly_trend": []
            }
        
        return {
            "period_start": start_date,
            "period_end": end_date,
            "total_sales": result.total_sales or 0,
            "total_amount": float(result.total_amount or 0),
            "average_sale_value": float(result.average_sale_value or 0),
            "top_customers": [],
            "category_breakdown": [],
            "monthly_trend": []
        }
        
    except Exception as e:
        logger.error(f"Get sales analytics error: {e}")
        # Return default values on error instead of failing
        today = date.today()
        return {
            "period_start": date(today.year, today.month, 1),
            "period_end": end_date or date(today.year, today.month + 1, 1) if today.month < 12 else date(today.year + 1, 1, 1),
            "total_sales": 0,
            "total_amount": 0.0,
            "average_sale_value": 0.0,
            "top_customers": [],
            "category_breakdown": [],
            "monthly_trend": []
        }





@router.get("/receivables/aging")
async def get_sales_receivables_aging(
    current_user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get receivables aging report for sales"""
    try:
        query = text("""
            SELECT 
                CASE 
                    WHEN v.voucher_date < CURRENT_DATE - INTERVAL '90 days' THEN '90+'
                    WHEN v.voucher_date < CURRENT_DATE - INTERVAL '60 days' THEN '61-90'
                    WHEN v.voucher_date < CURRENT_DATE - INTERVAL '30 days' THEN '31-60'
                    WHEN v.voucher_date < CURRENT_DATE THEN '1-30'
                    ELSE 'Current'
                END as bucket,
                COUNT(*) as count,
                COALESCE(SUM(v.balance_amount), 0) as amount
            FROM vouchers v
            WHERE v.company_id = :company_id
            AND v.voucher_type = 'sale'
            AND v.party_id IN (
                SELECT id FROM parties 
                WHERE is_customer = TRUE 
                AND company_id = :company_id
                AND deleted_at IS NULL
            )
            AND v.status = 'confirmed'
            AND v.deleted_at IS NULL
            AND v.balance_amount > 0
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
        
        # Initialize summary with default values
        summary = {
            "total_outstanding": 0.0,
            "current": 0.0,
            "days_1_30": 0.0,
            "days_31_60": 0.0,
            "days_61_90": 0.0,
            "days_90_plus": 0.0
        }
        
        # Calculate totals and populate summary
        total_outstanding = 0.0
        for row in result:
            amount = float(row.amount)
            bucket = row.bucket
            total_outstanding += amount
            
            if bucket == 'Current':
                summary["current"] = amount
            elif bucket == '1-30':
                summary["days_1_30"] = amount
            elif bucket == '31-60':
                summary["days_31_60"] = amount
            elif bucket == '61-90':
                summary["days_61_90"] = amount
            elif bucket == '90+':
                summary["days_90_plus"] = amount
        
        summary["total_outstanding"] = total_outstanding
        
        return {
            "summary": summary,
            "by_customer": [],  # Empty for now, can be implemented later
            "invoices": []  # Empty for now, can be implemented later
        }
        
    except Exception as e:
        logger.error(f"Get sales receivables aging error: {e}")
        # Return default values on error instead of failing
        return {
            "summary": {
                "total_outstanding": 0.0,
                "current": 0.0,
                "days_1_30": 0.0,
                "days_31_60": 0.0,
                "days_61_90": 0.0,
                "days_90_plus": 0.0
            },
            "by_customer": [],
            "invoices": []
        }



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
                v.confirmed_by, v.confirmed_at,
                p.party_name as customer_name,
                p.email as customer_email,
                p.gstin as customer_gstin
            FROM vouchers v
            LEFT JOIN parties p ON v.party_id = p.id
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
        
        items = []
        for item in items_result:
            items.append({
                "id": str(item.id),
                "voucher_id": str(item.voucher_id),
                "line_number": item.line_number,
                "product_id": str(item.product_id) if item.product_id else None,
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
                "line_total": float(item.line_total),
                "created_at": item.created_at
            })
        
        return {
            "id": str(result.id),
            "company_id": str(result.company_id),
            "fy_id": str(result.fy_id),
            "voucher_type": result.voucher_type,
            "voucher_number": result.voucher_number,
            "voucher_date": result.voucher_date,
            "ref_number": result.ref_number,
            "ref_date": result.ref_date,
            "party_id": str(result.party_id) if result.party_id else None,
            "customer_name": result.customer_name,
            "customer_email": result.customer_email,
            "customer_gstin": result.customer_gstin,
            "subtotal": float(result.subtotal),
            "discount_amount": float(result.discount_amount),
            "taxable_amount": float(result.taxable_amount),
            "cgst_amount": float(result.cgst_amount),
            "sgst_amount": float(result.sgst_amount),
            "igst_amount": float(result.igst_amount),
            "cess_amount": float(result.cess_amount),
            "tcs_amount": float(result.tcs_amount),
            "round_off": float(result.round_off),
            "total_amount": float(result.total_amount),
            "paid_amount": float(result.paid_amount),
            "balance_amount": float(result.balance_amount),
            "supply_type": result.supply_type,
            "place_of_supply": result.place_of_supply,
            "reverse_charge": result.reverse_charge,
            "is_einvoice": result.is_einvoice,
            "irn": result.irn,
            "ack_number": result.ack_number,
            "ack_date": result.ack_date,
            "status": result.status,
            "notes": result.notes,
            "terms_and_conditions": result.terms_and_conditions,
            "created_by": str(result.created_by) if result.created_by else None,
            "created_at": result.created_at,
            "updated_at": result.updated_at,
            "confirmed_by": str(result.confirmed_by) if result.confirmed_by else None,
            "confirmed_at": result.confirmed_at,
            "items": items
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Get sale error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to fetch sale"
        )



@router.get("/{sale_id}/download")
async def download_sale_invoice(
    sale_id: str,
    current_user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Download sales invoice export as JSON attachment."""
    sale = await get_sale(sale_id, current_user, db)
    return JSONResponse(
        content=sale,
        headers={
            "Content-Disposition": f'attachment; filename="sale-{sale_id}.json"'
        },
    )







@router.put("/{sale_id}", response_model=SalesResponse)
async def update_sale(
    sale_id: str,
    updates: SalesUpdate,
    current_user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update sales invoice (similar to purchases update)"""
    try:
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
        
        if updates.items is not None:
            delete_items_query = text("DELETE FROM voucher_items WHERE voucher_id = :voucher_id")
            db.execute(delete_items_query, {"voucher_id": sale_id})
            
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
        logger.error(f"Update sale error: {e}", exc_info=True)
        
        # Check if it's a constraint violation
        error_msg = str(e)
        if "CheckViolation" in error_msg or "check constraint" in error_msg.lower():
            logger.error(f"CHECK CONSTRAINT VIOLATION - supply_type: '{updates.supply_type}', "
                        f"status: '{updates.status if hasattr(updates, 'status') else 'draft'}', "
                        f"voucher_type: 'sale'")
        
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update sale: {str(e)}"
        )





@router.delete("/{sale_id}")
async def delete_sale(
    sale_id: str,
    current_user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Soft delete sales invoice"""
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



