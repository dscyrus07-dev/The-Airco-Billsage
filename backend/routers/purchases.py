"""
Purchases Router - Complete Implementation with Real Database

Handles purchase invoices/vouchers with full CRUD operations.
All operations use real PostgreSQL database (vouchers table).
"""

from fastapi import APIRouter, Depends, HTTPException, Query, status, UploadFile, File
from fastapi.responses import JSONResponse, FileResponse
from sqlalchemy.orm import Session
from sqlalchemy import text
from typing import Optional, List
from datetime import date, datetime
from decimal import Decimal
import uuid
import logging
import tempfile
import os
from config.database import get_db
from dependencies.auth import get_current_user, CurrentUser
from schemas.purchase_schemas import (
    PurchaseCreate, PurchaseUpdate, PurchaseResponse, PurchaseListResponse,
    PurchaseKPIs, PurchaseAnalytics, ApprovalAction, PurchaseItemResponse
)
from services.ocr_service import get_ocr_service
from services.llm_extraction_service import get_llm_extraction_service, LLMProviderError, LLMResponseError
from services.purchase_normalizer import get_purchase_normalizer
from services.matching_service import get_matching_service

logger = logging.getLogger(__name__)
router = APIRouter()

PURCHASE_UPLOAD_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "uploads", "purchase_bills")


def _sanitize_upload_filename(file_name: str) -> str:
    base_name = os.path.basename(file_name or "bill.pdf")
    return "".join(ch if ch.isalnum() or ch in {".", "-", "_"} else "_" for ch in base_name)


def _build_review_file_path(review_id: str, file_name: str) -> str:
    os.makedirs(PURCHASE_UPLOAD_DIR, exist_ok=True)
    return os.path.join(PURCHASE_UPLOAD_DIR, f"{review_id}_{_sanitize_upload_filename(file_name)}")


def _get_original_bill_metadata(db: Session, purchase_id: str, company_id: str):
    query = text("""
        SELECT id, file_name
        FROM extraction_reviews
        WHERE confirmed_purchase_id = :purchase_id
          AND company_id = :company_id
          AND deleted_at IS NULL
        ORDER BY confirmed_at DESC NULLS LAST, created_at DESC
        LIMIT 1
    """)

    result = db.execute(query, {
        "purchase_id": purchase_id,
        "company_id": company_id,
    }).fetchone()

    if not result:
        return None

    file_path = _build_review_file_path(str(result.id), result.file_name)
    if not os.path.exists(file_path):
        return None

    return {
        "review_id": str(result.id),
        "file_name": result.file_name,
        "file_path": file_path,
    }


def get_active_fy_id(db: Session, company_id: str) -> str:
    """Get active financial year ID for the company"""
    query = text("""
        SELECT id FROM financial_years
        WHERE company_id = :company_id
        AND is_current = TRUE
        LIMIT 1
    """)
    result = db.execute(query, {"company_id": company_id}).fetchone()
    if not result:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No active financial year found. Please configure financial year."
        )
    return str(result.id)


@router.get("", response_model=PurchaseListResponse)
@router.get("/", response_model=PurchaseListResponse, include_in_schema=False)
async def get_purchases(
    status_filter: Optional[str] = Query(None, alias="status"),
    vendor: Optional[str] = Query(None, alias="party_id"),
    date_from: Optional[date] = Query(None),
    date_to: Optional[date] = Query(None),
    search: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=100),
    current_user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get list of purchase invoices with filters and pagination"""
    try:
        query = """
            SELECT 
                v.id, v.company_id, v.fy_id, v.voucher_type, v.voucher_number,
                v.voucher_date, v.ref_number, v.ref_date, v.party_id,
                v.subtotal, v.discount_amount, v.taxable_amount,
                v.cgst_amount, v.sgst_amount, v.igst_amount, v.cess_amount,
                v.tds_amount, v.round_off, v.total_amount, v.paid_amount,
                v.balance_amount, v.supply_type, v.place_of_supply,
                v.reverse_charge, v.status, v.notes, v.terms_and_conditions,
                v.created_by, v.created_at, v.updated_at,
                v.confirmed_by, v.confirmed_at,
                p.party_name as vendor_name,
                p.gstin as vendor_gstin,
                p.display_name as vendor_display_name
            FROM vouchers v
            LEFT JOIN parties p ON v.party_id = p.id
            WHERE v.company_id = :company_id
            AND v.voucher_type = 'purchase'
            AND v.deleted_at IS NULL
        """
        
        params = {"company_id": str(current_user.company_id)}
        
        if status_filter and status_filter != 'all':
            query += " AND v.status = :status"
            params["status"] = status_filter
        
        if vendor:
            query += " AND v.party_id = :party_id"
            params["party_id"] = vendor
        
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
        
        # Count total
        count_query = f"SELECT COUNT(*) FROM ({query}) AS subquery"
        count_result = db.execute(text(count_query), params).fetchone()
        total = count_result[0] if count_result else 0
        
        # Add pagination
        query += " ORDER BY v.voucher_date DESC, v.created_at DESC LIMIT :limit OFFSET :offset"
        params["limit"] = page_size
        params["offset"] = (page - 1) * page_size
        
        result = db.execute(text(query), params).fetchall()
        
        purchases = []
        for row in result:
            purchases.append({
                "id": str(row.id),
                "company_id": str(row.company_id),
                "fy_id": str(row.fy_id),
                "voucher_type": row.voucher_type,
                "voucher_number": row.voucher_number,
                "voucher_date": row.voucher_date,
                "ref_number": row.ref_number,
                "ref_date": row.ref_date,
                "party_id": str(row.party_id) if row.party_id else None,
                "vendor_name": row.vendor_name,
                "vendor_gstin": row.vendor_gstin,
                "vendor_display_name": row.vendor_display_name,
                "subtotal": float(row.subtotal),
                "discount_amount": float(row.discount_amount),
                "taxable_amount": float(row.taxable_amount),
                "cgst_amount": float(row.cgst_amount),
                "sgst_amount": float(row.sgst_amount),
                "igst_amount": float(row.igst_amount),
                "cess_amount": float(row.cess_amount),
                "tds_amount": float(row.tds_amount),
                "round_off": float(row.round_off),
                "total_amount": float(row.total_amount),
                "paid_amount": float(row.paid_amount),
                "balance_amount": float(row.balance_amount),
                "supply_type": row.supply_type,
                "place_of_supply": row.place_of_supply,
                "reverse_charge": row.reverse_charge,
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
            "purchases": purchases,
            "total": total,
            "page": page,
            "page_size": page_size,
            "total_pages": total_pages
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Get purchases error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch purchases: {str(e)}"
        )


@router.post("", response_model=PurchaseResponse, status_code=status.HTTP_201_CREATED)
@router.post("/", response_model=PurchaseResponse, status_code=status.HTTP_201_CREATED, include_in_schema=False)
async def create_purchase(
    purchase: PurchaseCreate,
    current_user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Create a new purchase invoice"""
    try:
        # Get active FY
        fy_id = get_active_fy_id(db, str(current_user.company_id))
        
        # Generate UUID
        voucher_id = str(uuid.uuid4())
        
        # Insert voucher
        voucher_query = text("""
            INSERT INTO vouchers (
                id, company_id, fy_id, voucher_type, voucher_number, voucher_date,
                ref_number, ref_date, party_id,
                subtotal, discount_amount, taxable_amount,
                cgst_amount, sgst_amount, igst_amount, cess_amount,
                tds_amount, round_off, total_amount, paid_amount,
                supply_type, place_of_supply, reverse_charge,
                status, notes, terms_and_conditions,
                created_by, created_at, updated_at
            ) VALUES (
                :id, :company_id, :fy_id, 'purchase', :voucher_number, :voucher_date,
                :ref_number, :ref_date, :party_id,
                :subtotal, :discount_amount, :taxable_amount,
                :cgst_amount, :sgst_amount, :igst_amount, :cess_amount,
                :tds_amount, :round_off, :total_amount, 0,
                :supply_type, :place_of_supply, :reverse_charge,
                'draft', :notes, :terms_and_conditions,
                :created_by, NOW(), NOW()
            )
            RETURNING id, company_id, fy_id, voucher_type, voucher_number,
                      voucher_date, ref_number, ref_date, party_id,
                      subtotal, discount_amount, taxable_amount,
                      cgst_amount, sgst_amount, igst_amount, cess_amount,
                      tds_amount, round_off, total_amount, paid_amount,
                      balance_amount, supply_type, place_of_supply,
                      reverse_charge, status, notes, terms_and_conditions,
                      created_by, created_at, updated_at,
                      confirmed_by, confirmed_at
        """)
        
        voucher_result = db.execute(voucher_query, {
            "id": voucher_id,
            "company_id": str(current_user.company_id),
            "fy_id": fy_id,
            "voucher_number": purchase.voucher_number,
            "voucher_date": purchase.voucher_date,
            "ref_number": purchase.ref_number,
            "ref_date": purchase.ref_date,
            "party_id": purchase.party_id,
            "subtotal": float(purchase.subtotal),
            "discount_amount": float(purchase.discount_amount),
            "taxable_amount": float(purchase.taxable_amount),
            "cgst_amount": float(purchase.cgst_amount),
            "sgst_amount": float(purchase.sgst_amount),
            "igst_amount": float(purchase.igst_amount),
            "cess_amount": float(purchase.cess_amount),
            "tds_amount": float(purchase.tds_amount),
            "round_off": float(purchase.round_off),
            "total_amount": float(purchase.total_amount),
            "supply_type": purchase.supply_type,
            "place_of_supply": purchase.place_of_supply,
            "reverse_charge": purchase.reverse_charge,
            "notes": purchase.notes,
            "terms_and_conditions": purchase.terms_and_conditions,
            "created_by": str(current_user.user_id)
        }).fetchone()
        
        # Insert line items
        for item in purchase.items:
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
        
        logger.info(f"Created purchase: {voucher_id}")
        
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
            "tds_amount": float(voucher_result.tds_amount),
            "round_off": float(voucher_result.round_off),
            "total_amount": float(voucher_result.total_amount),
            "paid_amount": float(voucher_result.paid_amount),
            "balance_amount": float(voucher_result.balance_amount),
            "supply_type": voucher_result.supply_type,
            "place_of_supply": voucher_result.place_of_supply,
            "reverse_charge": voucher_result.reverse_charge,
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
        logger.error(f"Create purchase error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create purchase: {str(e)}"
        )


@router.get("/{purchase_id}", response_model=PurchaseResponse)
async def get_purchase(
    purchase_id: str,
    current_user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get purchase invoice by ID with line items"""
    try:
        # Get voucher
        query = text("""
            SELECT 
                v.id, v.company_id, v.fy_id, v.voucher_type, v.voucher_number,
                v.voucher_date, v.ref_number, v.ref_date, v.party_id,
                v.subtotal, v.discount_amount, v.taxable_amount,
                v.cgst_amount, v.sgst_amount, v.igst_amount, v.cess_amount,
                v.tds_amount, v.round_off, v.total_amount, v.paid_amount,
                v.balance_amount, v.supply_type, v.place_of_supply,
                v.reverse_charge, v.status, v.notes, v.terms_and_conditions,
                v.created_by, v.created_at, v.updated_at,
                v.confirmed_by, v.confirmed_at,
                p.party_name as vendor_name,
                p.gstin as vendor_gstin,
                er.file_name as source_file_name
            FROM vouchers v
            LEFT JOIN parties p ON v.party_id = p.id
            LEFT JOIN extraction_reviews er ON er.confirmed_purchase_id = v.id AND er.deleted_at IS NULL
            WHERE v.id = :purchase_id
            AND v.company_id = :company_id
            AND v.voucher_type = 'purchase'
            AND v.deleted_at IS NULL
        """)
        
        result = db.execute(query, {
            "purchase_id": purchase_id,
            "company_id": str(current_user.company_id)
        }).fetchone()
        
        if not result:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Purchase not found"
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
        
        items_result = db.execute(items_query, {"voucher_id": purchase_id}).fetchall()
        
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
            "vendor_name": result.vendor_name,
            "vendor_gstin": result.vendor_gstin,
            "source_file_name": result.source_file_name,
            "subtotal": float(result.subtotal),
            "discount_amount": float(result.discount_amount),
            "taxable_amount": float(result.taxable_amount),
            "cgst_amount": float(result.cgst_amount),
            "sgst_amount": float(result.sgst_amount),
            "igst_amount": float(result.igst_amount),
            "cess_amount": float(result.cess_amount),
            "tds_amount": float(result.tds_amount),
            "round_off": float(result.round_off),
            "total_amount": float(result.total_amount),
            "paid_amount": float(result.paid_amount),
            "balance_amount": float(result.balance_amount),
            "supply_type": result.supply_type,
            "place_of_supply": result.place_of_supply,
            "reverse_charge": result.reverse_charge,
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
        logger.error(f"Get purchase error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to fetch purchase"
        )


@router.get("/{purchase_id}/download")
async def download_purchase_bill(
    purchase_id: str,
    current_user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Download purchase invoice export. Returns original uploaded bill when available, otherwise JSON export."""
    original_bill = _get_original_bill_metadata(db, purchase_id, str(current_user.company_id))
    if original_bill:
        return FileResponse(
            path=original_bill["file_path"],
            media_type="application/pdf",
            filename=original_bill["file_name"],
        )

    purchase = await get_purchase(purchase_id, current_user, db)
    return JSONResponse(
        content=purchase,
        headers={
            "Content-Disposition": f'attachment; filename="purchase-{purchase_id}.json"'
        },
    )


@router.get("/{purchase_id}/download-original")
async def download_original_purchase_bill(
    purchase_id: str,
    current_user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Download original uploaded purchase bill PDF."""
    original_bill = _get_original_bill_metadata(db, purchase_id, str(current_user.company_id))
    if not original_bill:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Original uploaded bill not found"
        )

    return FileResponse(
        path=original_bill["file_path"],
        media_type="application/pdf",
        filename=original_bill["file_name"],
    )


@router.put("/{purchase_id}", response_model=PurchaseResponse)
async def update_purchase(
    purchase_id: str,
    updates: PurchaseUpdate,
    current_user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update purchase invoice"""
    try:
        # Check if exists and is draft
        check_query = text("""
            SELECT status FROM vouchers
            WHERE id = :purchase_id
            AND company_id = :company_id
            AND voucher_type = 'purchase'
            AND deleted_at IS NULL
        """)
        
        check_result = db.execute(check_query, {
            "purchase_id": purchase_id,
            "company_id": str(current_user.company_id)
        }).fetchone()
        
        if not check_result:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Purchase not found"
            )
        
        # Build dynamic update
        update_fields = []
        params = {
            "purchase_id": purchase_id,
            "company_id": str(current_user.company_id),
            "updated_by": str(current_user.user_id)
        }
        
        update_data = updates.dict(exclude_unset=True, exclude={'items'})
        for field, value in update_data.items():
            if value is not None:
                update_fields.append(f"{field} = :{field}")
                params[field] = float(value) if isinstance(value, Decimal) else value
        
        if not update_fields and not updates.items:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No fields to update"
            )
        
        # Update voucher if there are fields
        if update_fields:
            update_fields.append("updated_at = NOW()")
            update_fields.append("updated_by = :updated_by")
            
            update_query = text(f"""
                UPDATE vouchers
                SET {', '.join(update_fields)}
                WHERE id = :purchase_id
                AND company_id = :company_id
                AND voucher_type = 'purchase'
                AND deleted_at IS NULL
            """)
            
            db.execute(update_query, params)
        
        # Update items if provided
        if updates.items is not None:
            # Delete existing items
            delete_items_query = text("""
                DELETE FROM voucher_items
                WHERE voucher_id = :voucher_id
            """)
            db.execute(delete_items_query, {"voucher_id": purchase_id})
            
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
                    "voucher_id": purchase_id,
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
        
        # Fetch updated purchase
        return await get_purchase(purchase_id, current_user, db)
        
    except HTTPException:
        db.rollback()
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"Update purchase error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update purchase"
        )


@router.delete("/{purchase_id}")
async def delete_purchase(
    purchase_id: str,
    current_user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Soft delete purchase invoice"""
    try:
        query = text("""
            UPDATE vouchers
            SET deleted_at = NOW()
            WHERE id = :purchase_id
            AND company_id = :company_id
            AND voucher_type = 'purchase'
            AND status = 'draft'
            AND deleted_at IS NULL
            RETURNING id
        """)
        
        result = db.execute(query, {
            "purchase_id": purchase_id,
            "company_id": str(current_user.company_id)
        }).fetchone()
        
        if not result:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Purchase not found or cannot be deleted (only draft purchases can be deleted)"
            )
        
        db.commit()
        
        logger.info(f"Deleted purchase: {purchase_id}")
        return {"message": "Purchase deleted successfully"}
        
    except HTTPException:
        db.rollback()
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"Delete purchase error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to delete purchase"
        )


@router.post("/{purchase_id}/approve")
async def approve_purchase(
    purchase_id: str,
    action: ApprovalAction,
    current_user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Approve/confirm purchase invoice"""
    try:
        query = text("""
            UPDATE vouchers
            SET status = 'confirmed',
                confirmed_by = :confirmed_by,
                confirmed_at = NOW(),
                updated_at = NOW()
            WHERE id = :purchase_id
            AND company_id = :company_id
            AND voucher_type = 'purchase'
            AND status = 'draft'
            AND deleted_at IS NULL
            RETURNING id
        """)
        
        result = db.execute(query, {
            "purchase_id": purchase_id,
            "company_id": str(current_user.company_id),
            "confirmed_by": str(current_user.user_id)
        }).fetchone()
        
        if not result:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Purchase not found or already confirmed"
            )
        
        db.commit()
        
        logger.info(f"Approved purchase: {purchase_id}")
        return {"message": "Purchase approved successfully"}
        
    except HTTPException:
        db.rollback()
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"Approve purchase error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to approve purchase"
        )


@router.post("/{purchase_id}/reject")
async def reject_purchase(
    purchase_id: str,
    action: ApprovalAction,
    current_user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Reject/cancel purchase invoice"""
    try:
        query = text("""
            UPDATE vouchers
            SET status = 'cancelled',
                cancelled_by = :cancelled_by,
                cancelled_at = NOW(),
                cancellation_reason = :reason,
                updated_at = NOW()
            WHERE id = :purchase_id
            AND company_id = :company_id
            AND voucher_type = 'purchase'
            AND status = 'draft'
            AND deleted_at IS NULL
            RETURNING id
        """)
        
        result = db.execute(query, {
            "purchase_id": purchase_id,
            "company_id": str(current_user.company_id),
            "cancelled_by": str(current_user.user_id),
            "reason": action.reason
        }).fetchone()
        
        if not result:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Purchase not found or already processed"
            )
        
        db.commit()
        
        logger.info(f"Rejected purchase: {purchase_id}")
        return {"message": "Purchase rejected successfully"}
        
    except HTTPException:
        db.rollback()
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"Reject purchase error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to reject purchase"
        )


@router.get("/kpis", response_model=PurchaseKPIs)
async def get_purchase_kpis(
    current_user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get purchase KPIs from real data"""
    try:
        query = text("""
            SELECT 
                COUNT(*) as total_purchases,
                COALESCE(SUM(total_amount), 0) as total_amount,
                COUNT(*) FILTER (WHERE status = 'draft') as pending_count,
                COUNT(*) FILTER (WHERE status = 'confirmed') as confirmed_count,
                COUNT(*) FILTER (WHERE status = 'draft') as draft_count,
                COALESCE(SUM(paid_amount), 0) as total_paid,
                COALESCE(SUM(balance_amount), 0) as total_outstanding
            FROM vouchers
            WHERE company_id = :company_id
            AND voucher_type = 'purchase'
            AND deleted_at IS NULL
        """)
        
        result = db.execute(query, {"company_id": str(current_user.company_id)}).fetchone()
        
        return {
            "total_purchases": result.total_purchases or 0,
            "total_amount": float(result.total_amount or 0),
            "pending_count": result.pending_count or 0,
            "confirmed_count": result.confirmed_count or 0,
            "draft_count": result.draft_count or 0,
            "total_paid": float(result.total_paid or 0),
            "total_outstanding": float(result.total_outstanding or 0)
        }
        
    except Exception as e:
        logger.error(f"Get purchase KPIs error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to fetch purchase KPIs"
        )


@router.get("/analytics", response_model=PurchaseAnalytics)
async def get_purchase_analytics(
    start_date: Optional[date] = Query(None),
    end_date: Optional[date] = Query(None),
    current_user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get purchase analytics from real data"""
    try:
        # Default to current month if not provided
        if not start_date or not end_date:
            from datetime import date
            today = date.today()
            start_date = date(today.year, today.month, 1)
            if today.month == 12:
                end_date = date(today.year + 1, 1, 1)
            else:
                end_date = date(today.year, today.month + 1, 1)
        
        # Basic analytics
        query = text("""
            SELECT 
                COUNT(*) as total_purchases,
                COALESCE(SUM(total_amount), 0) as total_amount,
                COALESCE(AVG(total_amount), 0) as average_purchase_value
            FROM vouchers
            WHERE company_id = :company_id
            AND voucher_type = 'purchase'
            AND voucher_date >= :start_date
            AND voucher_date < :end_date
            AND deleted_at IS NULL
        """)
        
        result = db.execute(query, {
            "company_id": str(current_user.company_id),
            "start_date": start_date,
            "end_date": end_date
        }).fetchone()
        
        return {
            "period_start": start_date,
            "period_end": end_date,
            "total_purchases": result.total_purchases or 0,
            "total_amount": float(result.total_amount or 0),
            "average_purchase_value": float(result.average_purchase_value or 0),
            "top_suppliers": [],  # TODO: Implement with party join
            "category_breakdown": [],  # TODO: Implement with product category join
            "monthly_trend": []  # TODO: Implement monthly aggregation
        }
        
    except Exception as e:
        logger.error(f"Get purchase analytics error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to fetch purchase analytics"
        )


@router.post("/upload")
async def upload_and_extract_bill(
    file: UploadFile = File(...),
    current_user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Upload bill and extract data via OCR + LLM pipeline"""
    review_id = str(uuid.uuid4())
    current_stage = "initialization"
    try:
        logger.info(f"[{review_id}] Starting upload pipeline for file: {file.filename}")
        
        # Validate file type
        current_stage = "validation"
        if not file.content_type or not file.content_type.startswith('application/pdf'):
            logger.warning(f"[{review_id}] Invalid file type: {file.content_type}")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={
                    "status": "failed",
                    "stage": "validation",
                    "message": "Only PDF files are supported",
                    "details": f"Received file type: {file.content_type}",
                    "review_id": review_id
                }
            )
        
        # Validate file size (10MB limit)
        content = await file.read()
        if len(content) > 10 * 1024 * 1024:
            logger.warning(f"[{review_id}] File too large: {len(content)} bytes")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={
                    "status": "failed",
                    "stage": "validation",
                    "message": "File size must be less than 10MB",
                    "details": f"File size: {len(content) / 1024 / 1024:.2f}MB",
                    "review_id": review_id
                }
            )
        
        stored_file_path = _build_review_file_path(review_id, file.filename or "bill.pdf")
        with open(stored_file_path, "wb") as stored_file:
            stored_file.write(content)

        # STEP 1: OCR Extraction
        current_stage = "ocr_extraction"
        logger.info(f"[{review_id}] Step 1: Running OCR extraction...")
        ocr_service = get_ocr_service(languages=['en'])
        
        try:
            ocr_result = ocr_service.extract_text_from_file(
                file_bytes=content,
                file_type=file.content_type,
                preprocess=True
            )
            
            full_text = ocr_result['full_text']
            ocr_confidence = ocr_result['avg_confidence']
            
            logger.info(f"[{review_id}] OCR completed: {len(full_text)} chars, {ocr_confidence:.2%} confidence")
            
            if not full_text or len(full_text.strip()) < 50:
                logger.warning(f"[{review_id}] Insufficient text extracted: {len(full_text)} chars")
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                    detail={
                        "status": "failed",
                        "stage": "ocr_extraction",
                        "message": "Could not extract sufficient text from document",
                        "details": "The file may be unreadable, contain only images, or be a scanned document without text layer.",
                        "review_id": review_id
                    }
                )
                
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"[{review_id}] OCR extraction failed: {e}", exc_info=True)
            error_message = str(e)
            if "OCR dependencies are not installed" in error_message:
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail={
                        "status": "failed",
                        "stage": "ocr_extraction",
                        "message": "OCR service is not configured on the backend",
                        "details": error_message,
                        "review_id": review_id
                    }
                )
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail={
                    "status": "failed",
                    "stage": "ocr_extraction",
                    "message": "Could not extract text from the document",
                    "details": "Please ensure it's a valid PDF with readable text.",
                    "review_id": review_id
                }
            )
        
        # STEP 2: LLM Extraction
        current_stage = "llm_extraction"
        logger.info(f"[{review_id}] Step 2: Running LLM extraction...")
        
        try:
            from services.llm_extraction_service import LLMConfigurationError, LLMProviderError
            
            llm_service = get_llm_extraction_service()
            llm_result = llm_service.extract_purchase_data(full_text)
            
            raw_extracted_data = llm_result['extracted_data']
            llm_confidence = llm_result['confidence']
            
            logger.info(f"[{review_id}] LLM extraction completed: {llm_confidence:.2%} confidence")
            
        except LLMConfigurationError as e:
            logger.error(f"[{review_id}] LLM configuration error: {e}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail={
                    "status": "failed",
                    "stage": "llm_extraction",
                    "message": "LLM service is not properly configured",
                    "details": str(e),
                    "review_id": review_id
                }
            )
            
        except LLMProviderError as e:
            logger.error(f"[{review_id}] LLM provider error: {e}")
            
            # Determine appropriate HTTP status based on provider error
            if e.status_code == 400:
                http_status = status.HTTP_502_BAD_GATEWAY
                message = "Invalid model configuration"
                details = f"The configured LLM model is not valid. {str(e)}"
            elif e.status_code in {401, 403}:
                http_status = status.HTTP_500_INTERNAL_SERVER_ERROR
                message = "LLM API key is invalid or unauthorized"
                details = str(e)
            elif e.status_code == 502:
                http_status = status.HTTP_502_BAD_GATEWAY
                message = "Failed to connect to LLM service"
                details = str(e)
            else:
                http_status = status.HTTP_502_BAD_GATEWAY
                message = "LLM service error"
                details = str(e)
            
            raise HTTPException(
                status_code=http_status,
                detail={
                    "status": "failed",
                    "stage": "llm_extraction",
                    "message": message,
                    "details": details,
                    "review_id": review_id
                }
            )
            
        except LLMResponseError as e:
            logger.error(f"[{review_id}] LLM response error: {e}")
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail={
                    "status": "failed",
                    "stage": "llm_extraction",
                    "message": "LLM returned invalid or empty response",
                    "details": str(e),
                    "review_id": review_id
                }
            )
        
        except ValueError as e:
            logger.error(f"[{review_id}] LLM response parsing failed: {e}")
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail={
                    "status": "failed",
                    "stage": "llm_extraction",
                    "message": "Could not parse structured data from the document",
                    "details": "The LLM returned invalid data. The document format may be unsupported.",
                    "review_id": review_id
                }
            )
            
        except Exception as e:
            logger.error(f"[{review_id}] Unexpected LLM error: {e}", exc_info=True)
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail={
                    "status": "failed",
                    "stage": "llm_extraction",
                    "message": "An unexpected error occurred during LLM extraction",
                    "details": "Please try again or contact support if the issue persists.",
                    "review_id": review_id
                }
            )
        
        # STEP 3: Normalization
        current_stage = "normalization"
        logger.info(f"[{review_id}] Step 3: Normalizing extracted data...")
        
        try:
            normalizer = get_purchase_normalizer()
            normalized_data = normalizer.normalize_purchase_data(raw_extracted_data)
            
            validation = normalized_data.get('_validation', {})
            logger.info(
                f"[{review_id}] Normalization completed: {len(validation.get('warnings', []))} warnings, "
                f"{len(validation.get('errors', []))} errors"
            )
            
        except Exception as e:
            logger.error(f"[{review_id}] Normalization failed: {e}", exc_info=True)
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail={
                    "status": "failed",
                    "stage": "normalization",
                    "message": "Could not normalize the extracted data",
                    "details": "The document format may be invalid or unsupported.",
                    "review_id": review_id
                }
            )
        
        # STEP 4: Supplier and Product Matching
        current_stage = "matching"
        logger.info(f"[{review_id}] Step 4: Matching supplier and products...")
        
        matching_warnings = []
        matching_failed = False
        
        try:
            matching_service = get_matching_service(db, str(current_user.company_id))
            
            # Match supplier
            supplier_match = matching_service.match_supplier(
                normalized_data.get('supplier', {})
            )
            
            # Match products for each line item
            line_items_with_matches = []
            for item in normalized_data.get('line_items', []):
                product_match = matching_service.match_product(item)
                item_with_match = {
                    **item,
                    'product_match': product_match
                }
                line_items_with_matches.append(item_with_match)
            
            logger.info(
                f"[{review_id}] Matching completed: Supplier matched={supplier_match['matched']}, "
                f"Products matched={sum(1 for i in line_items_with_matches if i['product_match']['matched'])}/{len(line_items_with_matches)}"
            )
            
        except Exception as e:
            logger.error(f"[{review_id}] Matching stage failed with error: {e}", exc_info=True)
            matching_failed = True
            matching_warnings.append(f"Matching stage failed: {str(e)}")
            # Continue without matching - matching is non-blocking enrichment
            supplier_match = {'matched': False}
            line_items_with_matches = normalized_data.get('line_items', [])
        
        # STEP 5: Persist extraction review to database
        current_stage = "persistence"
        overall_confidence = (ocr_confidence + llm_confidence) / 2
        
        # Determine workflow status based on supplier matching
        workflow_status = 'completed'
        if not matching_failed and supplier_match.get('requires_creation'):
            workflow_status = 'needs_vendor_review'
            logger.info(f"[{review_id}] New vendor found - requires user review and creation")
        elif matching_failed:
            logger.warning(f"[{review_id}] Upload completed with warnings: matching stage failed")
        else:
            logger.info(f"[{review_id}] All stages completed successfully")
        
        logger.info(f"[{review_id}] Step 5: Persisting extraction review to database...")
        
        # Prepare frontend-compatible extracted data
        extracted_data = {
            'vendor': {
                'name': normalized_data['supplier'].get('name'),
                'gstin': normalized_data['supplier'].get('gstin'),
                'address': normalized_data['supplier'].get('address'),
                'phone': normalized_data['supplier'].get('phone'),
                'email': normalized_data['supplier'].get('email')
            },
            'invoice': {
                'invoice_number': normalized_data['invoice'].get('invoice_number'),
                'invoice_date': normalized_data['invoice'].get('invoice_date'),
                'due_date': normalized_data['invoice'].get('due_date'),
                'place_of_supply': normalized_data['invoice'].get('place_of_supply')
            },
            'amounts': {
                'subtotal': normalized_data['amounts'].get('subtotal', 0),
                'cgst': normalized_data['amounts'].get('cgst_amount', 0),
                'sgst': normalized_data['amounts'].get('sgst_amount', 0),
                'igst': normalized_data['amounts'].get('igst_amount', 0),
                'grand_total': normalized_data['amounts'].get('grand_total', 0)
            },
            'line_items': [
                {
                    'description': item.get('description'),
                    'hsn_sac': item.get('hsn_sac_code'),
                    'quantity': item.get('quantity'),
                    'unit': item.get('unit'),
                    'rate': item.get('rate'),
                    'taxable_value': item.get('taxable_amount'),
                    'cgst': item.get('cgst_amount'),
                    'sgst': item.get('sgst_amount'),
                    'igst': item.get('igst_amount'),
                    'total_amount': item.get('line_total')
                }
                for item in line_items_with_matches
            ]
        }
        
        response = {
            'status': workflow_status,
            'review_id': review_id,
            'extraction_confidence': overall_confidence,
            'extracted_data': extracted_data,
            'supplier_match': supplier_match,
            'normalization_warnings': validation.get('warnings', []),
            'normalization_errors': validation.get('errors', []),
            'matching_warnings': matching_warnings,
            'file_name': file.filename,
            'file_size': len(content),
            'processing_metadata': {
                'ocr_confidence': ocr_confidence,
                'llm_confidence': llm_confidence,
                'ocr_pages': ocr_result.get('total_pages', 1),
                'text_length': len(full_text),
                'supplier_matched': supplier_match['matched'],
                'products_matched': sum(1 for i in line_items_with_matches if i.get('product_match', {}).get('matched', False)),
                'total_items': len(line_items_with_matches),
                'matching_failed': matching_failed
            },
            'created_at': datetime.now().isoformat()
        }
        
        # Add prefill_party data if new vendor needs to be created
        if workflow_status == 'needs_vendor_review' and supplier_match.get('prefill_party'):
            response['prefill_party'] = supplier_match['prefill_party']
            response['message'] = 'New vendor found - please review and create supplier'
        
        # Persist extraction review to database
        try:
            from sqlalchemy import text
            import json
            
            review_query = text("""
                INSERT INTO extraction_reviews (
                    id, company_id, file_name, file_size, uploaded_by,
                    ocr_confidence, llm_confidence, overall_confidence,
                    ocr_pages, text_length,
                    extracted_data, normalized_data,
                    supplier_matched, supplier_match_data,
                    products_matched, total_items, matching_failed,
                    normalization_warnings, normalization_errors, matching_warnings,
                    status, uploaded_at, created_at, updated_at
                ) VALUES (
                    :id, :company_id, :file_name, :file_size, :uploaded_by,
                    :ocr_confidence, :llm_confidence, :overall_confidence,
                    :ocr_pages, :text_length,
                    :extracted_data, :normalized_data,
                    :supplier_matched, :supplier_match_data,
                    :products_matched, :total_items, :matching_failed,
                    :normalization_warnings, :normalization_errors, :matching_warnings,
                    :status, NOW(), NOW(), NOW()
                )
                RETURNING id, created_at
            """)
            
            review_result = db.execute(review_query, {
                "id": review_id,
                "company_id": str(current_user.company_id),
                "file_name": file.filename,
                "file_size": len(content),
                "uploaded_by": str(current_user.user_id),
                "ocr_confidence": float(ocr_confidence),
                "llm_confidence": float(llm_confidence),
                "overall_confidence": float(overall_confidence),
                "ocr_pages": ocr_result.get('total_pages', 1),
                "text_length": len(full_text),
                "extracted_data": json.dumps(extracted_data),
                "normalized_data": json.dumps(normalized_data),
                "supplier_matched": supplier_match['matched'],
                "supplier_match_data": json.dumps(supplier_match),
                "products_matched": sum(1 for i in line_items_with_matches if i.get('product_match', {}).get('matched', False)),
                "total_items": len(line_items_with_matches),
                "matching_failed": matching_failed,
                "normalization_warnings": json.dumps(validation.get('warnings', [])),
                "normalization_errors": json.dumps(validation.get('errors', [])),
                "matching_warnings": json.dumps(matching_warnings),
                "status": workflow_status
            }).fetchone()
            
            db.commit()
            
            logger.info(f"[{review_id}] Extraction review saved to database successfully")
            logger.info(f"[{review_id}] Upload pipeline completed - review ready for user action")
            
        except Exception as e:
            logger.error(f"[{review_id}] Failed to persist extraction review: {e}", exc_info=True)
            db.rollback()
            # Don't fail the entire upload if persistence fails - return the data anyway
            logger.warning(f"[{review_id}] Continuing without database persistence")
        
        # Return 200 OK for review creation (not 201 Created - no purchase created yet)
        return JSONResponse(
            status_code=status.HTTP_200_OK,
            content=response
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[{review_id}] Upload pipeline error at stage '{current_stage}': {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={
                "status": "failed",
                "stage": current_stage,
                "message": "An unexpected error occurred during document processing",
                "details": "Please try again or contact support if the issue persists.",
                "review_id": review_id
            }
        )


@router.get("/extraction-reviews")
async def get_extraction_reviews(
    status_filter: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=100),
    current_user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get list of extraction reviews"""
    try:
        # Build query
        query = text("""
            SELECT 
                id, company_id, file_name, file_size, uploaded_by,
                ocr_confidence, llm_confidence, overall_confidence,
                supplier_matched, products_matched, total_items,
                status, uploaded_at, confirmed_at, confirmed_purchase_id,
                created_at, updated_at
            FROM extraction_reviews
            WHERE company_id = :company_id
                AND deleted_at IS NULL
                AND (:status_filter IS NULL OR status = :status_filter)
            ORDER BY uploaded_at DESC
            LIMIT :limit OFFSET :offset
        """)
        
        offset = (page - 1) * page_size
        
        results = db.execute(query, {
            "company_id": str(current_user.company_id),
            "status_filter": status_filter,
            "limit": page_size,
            "offset": offset
        }).fetchall()
        
        # Get total count
        count_query = text("""
            SELECT COUNT(*)
            FROM extraction_reviews
            WHERE company_id = :company_id
                AND deleted_at IS NULL
                AND (:status_filter IS NULL OR status = :status_filter)
        """)
        
        total = db.execute(count_query, {
            "company_id": str(current_user.company_id),
            "status_filter": status_filter
        }).scalar()
        
        # Format results
        reviews = [
            {
                "id": str(row.id),
                "file_name": row.file_name,
                "file_size": row.file_size,
                "uploaded_by": str(row.uploaded_by),
                "ocr_confidence": float(row.ocr_confidence) if row.ocr_confidence else None,
                "llm_confidence": float(row.llm_confidence) if row.llm_confidence else None,
                "overall_confidence": float(row.overall_confidence) if row.overall_confidence else None,
                "supplier_matched": row.supplier_matched,
                "products_matched": row.products_matched,
                "total_items": row.total_items,
                "status": row.status,
                "uploaded_at": row.uploaded_at.isoformat() if row.uploaded_at else None,
                "confirmed_at": row.confirmed_at.isoformat() if row.confirmed_at else None,
                "confirmed_purchase_id": str(row.confirmed_purchase_id) if row.confirmed_purchase_id else None,
                "created_at": row.created_at.isoformat() if row.created_at else None,
                "updated_at": row.updated_at.isoformat() if row.updated_at else None
            }
            for row in results
        ]
        
        return {
            "reviews": reviews,
            "total": total,
            "page": page,
            "page_size": page_size,
            "total_pages": (total + page_size - 1) // page_size
        }
        
    except Exception as e:
        logger.error(f"Get extraction reviews error: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to fetch extraction reviews"
        )


@router.get("/extraction-reviews/{review_id}")
async def get_extraction_review(
    review_id: str,
    current_user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get extraction review by ID with full data"""
    try:
        import json
        
        query = text("""
            SELECT 
                id, company_id, file_name, file_size, uploaded_by,
                ocr_confidence, llm_confidence, overall_confidence,
                ocr_pages, text_length,
                extracted_data, normalized_data,
                supplier_matched, supplier_match_data,
                products_matched, total_items, matching_failed,
                normalization_warnings, normalization_errors, matching_warnings,
                status, uploaded_at, confirmed_at, confirmed_purchase_id,
                confirmed_by, rejected_at, rejected_by, rejection_reason,
                created_at, updated_at
            FROM extraction_reviews
            WHERE id = :review_id
                AND company_id = :company_id
                AND deleted_at IS NULL
        """)
        
        result = db.execute(query, {
            "review_id": review_id,
            "company_id": str(current_user.company_id)
        }).fetchone()
        
        if not result:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Extraction review not found"
            )
        
        # Parse JSONB fields
        review = {
            "id": str(result.id),
            "file_name": result.file_name,
            "file_size": result.file_size,
            "uploaded_by": str(result.uploaded_by),
            "ocr_confidence": float(result.ocr_confidence) if result.ocr_confidence else None,
            "llm_confidence": float(result.llm_confidence) if result.llm_confidence else None,
            "overall_confidence": float(result.overall_confidence) if result.overall_confidence else None,
            "ocr_pages": result.ocr_pages,
            "text_length": result.text_length,
            "extracted_data": json.loads(result.extracted_data) if result.extracted_data else None,
            "normalized_data": json.loads(result.normalized_data) if result.normalized_data else None,
            "supplier_matched": result.supplier_matched,
            "supplier_match_data": json.loads(result.supplier_match_data) if result.supplier_match_data else None,
            "products_matched": result.products_matched,
            "total_items": result.total_items,
            "matching_failed": result.matching_failed,
            "normalization_warnings": json.loads(result.normalization_warnings) if result.normalization_warnings else [],
            "normalization_errors": json.loads(result.normalization_errors) if result.normalization_errors else [],
            "matching_warnings": json.loads(result.matching_warnings) if result.matching_warnings else [],
            "status": result.status,
            "uploaded_at": result.uploaded_at.isoformat() if result.uploaded_at else None,
            "confirmed_at": result.confirmed_at.isoformat() if result.confirmed_at else None,
            "confirmed_purchase_id": str(result.confirmed_purchase_id) if result.confirmed_purchase_id else None,
            "confirmed_by": str(result.confirmed_by) if result.confirmed_by else None,
            "rejected_at": result.rejected_at.isoformat() if result.rejected_at else None,
            "rejected_by": str(result.rejected_by) if result.rejected_by else None,
            "rejection_reason": result.rejection_reason,
            "created_at": result.created_at.isoformat() if result.created_at else None,
            "updated_at": result.updated_at.isoformat() if result.updated_at else None
        }
        
        return review
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Get extraction review error: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to fetch extraction review"
        )


@router.post("/extraction-reviews/{review_id}/confirm")
async def confirm_extraction(
    review_id: str,
    extraction_data: dict,
    current_user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Confirm extraction and create purchase invoice"""
    try:
        # Map extraction data to PurchaseCreate format
        purchase_data = {
            "party_id": extraction_data.get("vendor_id"),
            "voucher_number": extraction_data.get("invoice_number"),
            "voucher_date": extraction_data.get("invoice_date"),
            "ref_number": extraction_data.get("invoice_number"),
            "ref_date": extraction_data.get("invoice_date"),
            "items": extraction_data.get("items", []),
            "subtotal": extraction_data.get("subtotal", 0),
            "discount_amount": extraction_data.get("discount_amount", 0),
            "taxable_amount": extraction_data.get("taxable_amount", 0),
            "cgst_amount": extraction_data.get("cgst_amount", 0),
            "sgst_amount": extraction_data.get("sgst_amount", 0),
            "igst_amount": extraction_data.get("igst_amount", 0),
            "cess_amount": 0,
            "tds_amount": extraction_data.get("tds_amount", 0),
            "round_off": extraction_data.get("round_off", 0),
            "total_amount": extraction_data.get("total_amount", 0),
            "supply_type": "B2B",
            "place_of_supply": extraction_data.get("place_of_supply"),
            "reverse_charge": False,
            "notes": f"Created from extraction review {review_id}"
        }
        
        # Create purchase using existing create_purchase logic
        # Get active FY
        fy_id = get_active_fy_id(db, str(current_user.company_id))
        
        # Generate UUID
        voucher_id = str(uuid.uuid4())
        
        # Insert voucher
        voucher_query = text("""
            INSERT INTO vouchers (
                id, company_id, fy_id, voucher_type, voucher_number, voucher_date,
                ref_number, ref_date, party_id,
                subtotal, discount_amount, taxable_amount,
                cgst_amount, sgst_amount, igst_amount, cess_amount,
                tds_amount, round_off, total_amount, paid_amount,
                supply_type, place_of_supply, reverse_charge,
                status, notes,
                created_by, created_at, updated_at
            ) VALUES (
                :id, :company_id, :fy_id, 'purchase', :voucher_number, :voucher_date,
                :ref_number, :ref_date, :party_id,
                :subtotal, :discount_amount, :taxable_amount,
                :cgst_amount, :sgst_amount, :igst_amount, :cess_amount,
                :tds_amount, :round_off, :total_amount, 0,
                :supply_type, :place_of_supply, :reverse_charge,
                'draft', :notes,
                :created_by, NOW(), NOW()
            )
            RETURNING id
        """)
        
        db.execute(voucher_query, {
            "id": voucher_id,
            "company_id": str(current_user.company_id),
            "fy_id": fy_id,
            "voucher_number": purchase_data["voucher_number"],
            "voucher_date": purchase_data["voucher_date"],
            "ref_number": purchase_data["ref_number"],
            "ref_date": purchase_data["ref_date"],
            "party_id": purchase_data["party_id"],
            "subtotal": float(purchase_data["subtotal"]),
            "discount_amount": float(purchase_data["discount_amount"]),
            "taxable_amount": float(purchase_data["taxable_amount"]),
            "cgst_amount": float(purchase_data["cgst_amount"]),
            "sgst_amount": float(purchase_data["sgst_amount"]),
            "igst_amount": float(purchase_data["igst_amount"]),
            "cess_amount": float(purchase_data["cess_amount"]),
            "tds_amount": float(purchase_data["tds_amount"]),
            "round_off": float(purchase_data["round_off"]),
            "total_amount": float(purchase_data["total_amount"]),
            "supply_type": purchase_data["supply_type"],
            "place_of_supply": purchase_data["place_of_supply"],
            "reverse_charge": purchase_data["reverse_charge"],
            "notes": purchase_data["notes"],
            "created_by": str(current_user.user_id)
        })
        
        # Insert line items
        for item in purchase_data["items"]:
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
                "line_number": item.get("line_number", 1),
                "product_id": item.get("product_id"),
                "description": item.get("description", ""),
                "hsn_sac_code": item.get("hsn_sac_code"),
                "quantity": float(item.get("quantity", 0)),
                "rate": float(item.get("rate", 0)),
                "discount_pct": float(item.get("discount_pct", 0)),
                "discount_amount": float(item.get("discount_amount", 0)),
                "taxable_amount": float(item.get("taxable_amount", 0)),
                "cgst_rate": float(item.get("cgst_rate", 0)),
                "cgst_amount": float(item.get("cgst_amount", 0)),
                "sgst_rate": float(item.get("sgst_rate", 0)),
                "sgst_amount": float(item.get("sgst_amount", 0)),
                "igst_rate": float(item.get("igst_rate", 0)),
                "igst_amount": float(item.get("igst_amount", 0)),
                "cess_rate": float(item.get("cess_rate", 0)),
                "cess_amount": float(item.get("cess_amount", 0)),
                "line_total": float(item.get("line_total", 0))
            })
        
        # Update extraction review to mark as confirmed
        try:
            update_review_query = text("""
                UPDATE extraction_reviews
                SET status = 'confirmed',
                    confirmed_purchase_id = :purchase_id,
                    confirmed_at = NOW(),
                    confirmed_by = :confirmed_by,
                    updated_at = NOW()
                WHERE id = :review_id
            """)
            
            db.execute(update_review_query, {
                "review_id": review_id,
                "purchase_id": voucher_id,
                "confirmed_by": str(current_user.user_id)
            })
            
            logger.info(f"[{review_id}] Extraction review marked as confirmed")
        except Exception as e:
            logger.warning(f"[{review_id}] Failed to update extraction review status: {e}")
            # Don't fail the purchase creation if review update fails
        
        db.commit()
        
        logger.info(f"[{review_id}] Purchase created from extraction: {voucher_id}")
        logger.info(f"[{review_id}] Transaction committed successfully")
        
        return {
            "message": "Purchase invoice created successfully",
            "purchase_id": voucher_id,
            "invoice_id": voucher_id,
            "review_id": review_id
        }
        
    except HTTPException:
        db.rollback()
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"Confirm extraction error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create purchase from extraction: {str(e)}"
        )
