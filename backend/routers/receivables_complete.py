"""
Receivables and Payables Router - Complete Implementation with Real Database

Handles receivables, payables, and aging reports with real data from vouchers.
"""

from fastapi import APIRouter, HTTPException, Depends, Query, status
from sqlalchemy.orm import Session
from sqlalchemy import text
from typing import Optional, List
import logging
from datetime import datetime, date
from decimal import Decimal

from config.database import get_db
from dependencies.auth import get_current_user, CurrentUser

logger = logging.getLogger(__name__)
router = APIRouter()


@router.get("/")
async def get_receivables(
    status_filter: Optional[str] = Query(None, alias="status"),
    customer_id: Optional[str] = Query(None),
    overdue_only: bool = Query(False),
    current_user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get receivables list from sales vouchers"""
    try:
        query = """
            SELECT 
                v.id,
                v.company_id,
                v.party_id,
                v.voucher_number as invoice_number,
                v.voucher_date as invoice_date,
                v.total_amount,
                v.paid_amount,
                v.balance_amount as pending_amount,
                v.voucher_date + INTERVAL '30 days' as due_date,
                CASE 
                    WHEN v.balance_amount > 0 AND CURRENT_DATE > v.voucher_date + INTERVAL '30 days' 
                    THEN CURRENT_DATE - (v.voucher_date + INTERVAL '30 days')::date
                    ELSE 0
                END as days_overdue,
                CASE 
                    WHEN v.balance_amount = 0 THEN 'paid'
                    WHEN CURRENT_DATE > v.voucher_date + INTERVAL '30 days' THEN 'overdue'
                    ELSE 'pending'
                END as status,
                p.legal_name as customer_name,
                p.email as customer_email
            FROM vouchers v
            LEFT JOIN parties p ON v.party_id = p.id
            WHERE v.company_id = :company_id
            AND v.voucher_type = 'sale'
            AND v.status = 'confirmed'
            AND v.deleted_at IS NULL
            AND v.balance_amount > 0
        """
        
        params = {"company_id": str(current_user.company_id)}
        
        if customer_id:
            query += " AND v.party_id = :customer_id"
            params["customer_id"] = customer_id
        
        if overdue_only:
            query += " AND CURRENT_DATE > v.voucher_date + INTERVAL '30 days'"
        
        query += " ORDER BY v.voucher_date DESC"
        
        result = db.execute(text(query), params).fetchall()
        
        receivables = []
        for row in result:
            receivables.append({
                "id": str(row.id),
                "company_id": str(row.company_id),
                "customer_id": str(row.party_id) if row.party_id else None,
                "customer_name": row.customer_name,
                "customer_email": row.customer_email,
                "invoice_number": row.invoice_number,
                "invoice_date": row.invoice_date,
                "amount": float(row.total_amount),
                "pending_amount": float(row.pending_amount),
                "due_date": row.due_date,
                "days_overdue": row.days_overdue,
                "status": row.status
            })
        
        return {"receivables": receivables, "total": len(receivables)}
        
    except Exception as e:
        logger.error(f"Get receivables error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch receivables: {str(e)}"
        )


@router.get("/aging")
async def get_aging_report(
    current_user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get receivables aging report"""
    try:
        query = text("""
            SELECT 
                CASE 
                    WHEN days_overdue <= 30 THEN '0-30 days'
                    WHEN days_overdue <= 60 THEN '31-60 days'
                    WHEN days_overdue <= 90 THEN '61-90 days'
                    ELSE '90+ days'
                END as bucket,
                COUNT(*) as count,
                SUM(balance_amount) as amount
            FROM (
                SELECT 
                    v.balance_amount,
                    CASE 
                        WHEN CURRENT_DATE > v.voucher_date + INTERVAL '30 days' 
                        THEN CURRENT_DATE - (v.voucher_date + INTERVAL '30 days')::date
                        ELSE 0
                    END as days_overdue
                FROM vouchers v
                WHERE v.company_id = :company_id
                AND v.voucher_type = 'sale'
                AND v.status = 'confirmed'
                AND v.deleted_at IS NULL
                AND v.balance_amount > 0
            ) aging_data
            GROUP BY bucket
            ORDER BY 
                CASE bucket
                    WHEN '0-30 days' THEN 1
                    WHEN '31-60 days' THEN 2
                    WHEN '61-90 days' THEN 3
                    ELSE 4
                END
        """)
        
        result = db.execute(query, {"company_id": str(current_user.company_id)}).fetchall()
        
        # Calculate total for percentage
        total_amount = sum(float(row.amount) for row in result)
        
        aging = []
        for row in result:
            amount = float(row.amount)
            percentage = (amount / total_amount * 100) if total_amount > 0 else 0
            aging.append({
                "bucket": row.bucket,
                "amount": amount,
                "count": row.count,
                "percentage": round(percentage, 2)
            })
        
        return {"aging": aging, "total_amount": total_amount}
        
    except Exception as e:
        logger.error(f"Get aging report error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch aging report: {str(e)}"
        )


@router.get("/summary")
async def get_receivables_summary(
    current_user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get receivables summary"""
    try:
        query = text("""
            SELECT 
                COUNT(*) as total_invoices,
                COALESCE(SUM(balance_amount), 0) as total_receivable,
                COALESCE(SUM(CASE 
                    WHEN CURRENT_DATE > voucher_date + INTERVAL '30 days' 
                    THEN balance_amount 
                    ELSE 0 
                END), 0) as overdue_amount,
                COUNT(*) FILTER (
                    WHERE CURRENT_DATE > voucher_date + INTERVAL '30 days'
                ) as overdue_count
            FROM vouchers
            WHERE company_id = :company_id
            AND voucher_type = 'sale'
            AND status = 'confirmed'
            AND deleted_at IS NULL
            AND balance_amount > 0
        """)
        
        result = db.execute(query, {"company_id": str(current_user.company_id)}).fetchone()
        
        return {
            "total_receivable": float(result.total_receivable),
            "total_invoices": result.total_invoices,
            "overdue_amount": float(result.overdue_amount),
            "overdue_count": result.overdue_count,
            "current_amount": float(result.total_receivable - result.overdue_amount)
        }
        
    except Exception as e:
        logger.error(f"Get receivables summary error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch receivables summary: {str(e)}"
        )


@router.get("/payables")
async def get_payables(
    status_filter: Optional[str] = Query(None, alias="status"),
    vendor_id: Optional[str] = Query(None),
    overdue_only: bool = Query(False),
    current_user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get payables list from purchase vouchers"""
    try:
        query = """
            SELECT 
                v.id,
                v.company_id,
                v.party_id,
                v.voucher_number as invoice_number,
                v.ref_number as vendor_invoice_number,
                v.voucher_date as invoice_date,
                v.total_amount,
                v.paid_amount,
                v.balance_amount as pending_amount,
                v.voucher_date + INTERVAL '30 days' as due_date,
                CASE 
                    WHEN v.balance_amount > 0 AND CURRENT_DATE > v.voucher_date + INTERVAL '30 days' 
                    THEN CURRENT_DATE - (v.voucher_date + INTERVAL '30 days')::date
                    ELSE 0
                END as days_overdue,
                CASE 
                    WHEN v.balance_amount = 0 THEN 'paid'
                    WHEN CURRENT_DATE > v.voucher_date + INTERVAL '30 days' THEN 'overdue'
                    ELSE 'pending'
                END as status,
                p.legal_name as vendor_name,
                p.email as vendor_email
            FROM vouchers v
            LEFT JOIN parties p ON v.party_id = p.id
            WHERE v.company_id = :company_id
            AND v.voucher_type = 'purchase'
            AND v.status = 'confirmed'
            AND v.deleted_at IS NULL
            AND v.balance_amount > 0
        """
        
        params = {"company_id": str(current_user.company_id)}
        
        if vendor_id:
            query += " AND v.party_id = :vendor_id"
            params["vendor_id"] = vendor_id
        
        if overdue_only:
            query += " AND CURRENT_DATE > v.voucher_date + INTERVAL '30 days'"
        
        query += " ORDER BY v.voucher_date DESC"
        
        result = db.execute(text(query), params).fetchall()
        
        payables = []
        for row in result:
            payables.append({
                "id": str(row.id),
                "company_id": str(row.company_id),
                "vendor_id": str(row.party_id) if row.party_id else None,
                "vendor_name": row.vendor_name,
                "vendor_email": row.vendor_email,
                "invoice_number": row.invoice_number,
                "vendor_invoice_number": row.vendor_invoice_number,
                "invoice_date": row.invoice_date,
                "amount": float(row.total_amount),
                "pending_amount": float(row.pending_amount),
                "due_date": row.due_date,
                "days_overdue": row.days_overdue,
                "status": row.status
            })
        
        return {"payables": payables, "total": len(payables)}
        
    except Exception as e:
        logger.error(f"Get payables error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch payables: {str(e)}"
        )


@router.get("/payables/aging")
async def get_payables_aging(
    current_user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get payables aging report"""
    try:
        query = text("""
            SELECT 
                CASE 
                    WHEN days_overdue <= 30 THEN '0-30 days'
                    WHEN days_overdue <= 60 THEN '31-60 days'
                    WHEN days_overdue <= 90 THEN '61-90 days'
                    ELSE '90+ days'
                END as bucket,
                COUNT(*) as count,
                SUM(balance_amount) as amount
            FROM (
                SELECT 
                    v.balance_amount,
                    CASE 
                        WHEN CURRENT_DATE > v.voucher_date + INTERVAL '30 days' 
                        THEN CURRENT_DATE - (v.voucher_date + INTERVAL '30 days')::date
                        ELSE 0
                    END as days_overdue
                FROM vouchers v
                WHERE v.company_id = :company_id
                AND v.voucher_type = 'purchase'
                AND v.status = 'confirmed'
                AND v.deleted_at IS NULL
                AND v.balance_amount > 0
            ) aging_data
            GROUP BY bucket
            ORDER BY 
                CASE bucket
                    WHEN '0-30 days' THEN 1
                    WHEN '31-60 days' THEN 2
                    WHEN '61-90 days' THEN 3
                    ELSE 4
                END
        """)
        
        result = db.execute(query, {"company_id": str(current_user.company_id)}).fetchall()
        
        total_amount = sum(float(row.amount) for row in result)
        
        aging = []
        for row in result:
            amount = float(row.amount)
            percentage = (amount / total_amount * 100) if total_amount > 0 else 0
            aging.append({
                "bucket": row.bucket,
                "amount": amount,
                "count": row.count,
                "percentage": round(percentage, 2)
            })
        
        return {"aging": aging, "total_amount": total_amount}
        
    except Exception as e:
        logger.error(f"Get payables aging error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch payables aging: {str(e)}"
        )


@router.get("/payables/summary")
async def get_payables_summary(
    current_user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get payables summary"""
    try:
        query = text("""
            SELECT 
                COUNT(*) as total_invoices,
                COALESCE(SUM(balance_amount), 0) as total_payable,
                COALESCE(SUM(CASE 
                    WHEN CURRENT_DATE > voucher_date + INTERVAL '30 days' 
                    THEN balance_amount 
                    ELSE 0 
                END), 0) as overdue_amount,
                COUNT(*) FILTER (
                    WHERE CURRENT_DATE > voucher_date + INTERVAL '30 days'
                ) as overdue_count
            FROM vouchers
            WHERE company_id = :company_id
            AND voucher_type = 'purchase'
            AND status = 'confirmed'
            AND deleted_at IS NULL
            AND balance_amount > 0
        """)
        
        result = db.execute(query, {"company_id": str(current_user.company_id)}).fetchone()
        
        return {
            "total_payable": float(result.total_payable),
            "total_invoices": result.total_invoices,
            "overdue_amount": float(result.overdue_amount),
            "overdue_count": result.overdue_count,
            "current_amount": float(result.total_payable - result.overdue_amount)
        }
        
    except Exception as e:
        logger.error(f"Get payables summary error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch payables summary: {str(e)}"
        )
