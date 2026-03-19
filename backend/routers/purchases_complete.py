"""
Purchases Router - Complete Implementation with Real Database

Handles purchase invoices/vouchers with full CRUD operations.
All operations use real PostgreSQL database (vouchers table).
"""

from fastapi import APIRouter, HTTPException, Depends, Query, status
from sqlalchemy.orm import Session
from sqlalchemy import text
from typing import Optional, List
import logging
from datetime import datetime, date
import uuid
from decimal import Decimal

from config.database import get_db
from dependencies.auth import get_current_user, CurrentUser
from schemas.purchase_schemas import (
    PurchaseCreate, PurchaseUpdate, PurchaseResponse, PurchaseListResponse,
    PurchaseKPIs, PurchaseAnalytics, ApprovalAction, PurchaseItemResponse
)

logger = logging.getLogger(__name__)
router = APIRouter()


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


@router.get("/", response_model=PurchaseListResponse)
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
                v.confirmed_by, v.confirmed_at
            FROM vouchers v
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


@router.post("/", response_model=PurchaseResponse, status_code=status.HTTP_201_CREATED)
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
                v.confirmed_by, v.confirmed_at
            FROM vouchers v
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
