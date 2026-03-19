"""
Settings Router

Handles company settings, financial configuration, tax settings, notifications, and audit preferences.
"""

from fastapi import APIRouter, HTTPException, Depends, status, Query
from pydantic import BaseModel, Field
from pydantic.config import ConfigDict
from typing import Optional, List, Dict, Any
from sqlalchemy.orm import Session
from sqlalchemy import text
import logging
from datetime import datetime

from config.database import get_db
from dependencies.auth import CurrentUser, get_current_user

logger = logging.getLogger(__name__)
router = APIRouter()

# Pydantic Models
class FinancialSettings(BaseModel):
    fy_start_month: int = Field(..., ge=1, le=12, description="Financial year start month (1-12)")
    invoice_prefix: str = Field(..., min_length=1, max_length=20, description="Invoice number prefix")

class TaxSettings(BaseModel):
    enabled_gst_rates: List[int] = Field(..., description="List of enabled GST rates")

class NotificationSettings(BaseModel):
    duplicate_invoice: bool = True
    gst_mismatch: bool = True
    overdue_receivable: bool = True
    overdue_payable: bool = True
    concentration_risk: bool = True
    gstr_reminders: bool = True

class AuditSettings(BaseModel):
    lock_after_approval: bool = False
    dual_approval: bool = False
    dual_approval_threshold: float = Field(0.0, ge=0, description="Dual approval threshold amount")

# Financial Settings
@router.get("/financial", response_model=FinancialSettings)
async def get_financial_settings(
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user)
):
    """Get financial settings"""
    try:
        company_id = str(current_user.company_id)
        
        # Check permissions
        if current_user.role not in ['admin', 'super_admin', 'accountant']:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Insufficient permissions"
            )
        
        # Get company_details
        query = text("""
            SELECT financial_year_start_month, invoice_prefix
            FROM company_details 
            WHERE company_id = :company_id
        """)
        
        result = db.execute(query, {"company_id": company_id}).fetchone()
        
        if not result:
            # Create default company_details if not exists
            insert_query = text("""
                INSERT INTO company_details (company_id, financial_year_start_month, invoice_prefix, created_at, updated_at)
                VALUES (:company_id, 4, 'INV', now(), now())
                RETURNING financial_year_start_month, invoice_prefix
            """)
            result = db.execute(insert_query, {"company_id": company_id}).fetchone()
            db.commit()
        
        settings_data = dict(result._mapping)
        
        # Map database fields to model fields
        mapped_data = {
            'fy_start_month': settings_data.get('financial_year_start_month', 4),
            'invoice_prefix': settings_data.get('invoice_prefix', 'INV')
        }
        
        return FinancialSettings(**mapped_data)
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Get financial settings error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to fetch financial settings"
        )

@router.put("/financial", response_model=FinancialSettings)
async def update_financial_settings(
    settings: FinancialSettings,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user)
):
    """Update financial settings"""
    try:
        # Check permissions
        if current_user.role not in ['admin', 'super_admin', 'accountant']:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Insufficient permissions"
            )
        
        company_id = str(current_user.company_id)
        
        # Ensure company_details exists
        exists_query = text("SELECT 1 FROM company_details WHERE company_id = :company_id")
        exists = db.execute(exists_query, {"company_id": company_id}).fetchone()
        
        if not exists:
            # Create company_details
            insert_query = text("""
                INSERT INTO company_details (company_id, financial_year_start_month, invoice_prefix, created_at, updated_at)
                VALUES (:company_id, :fy_start_month, :invoice_prefix, now(), now())
            """)
        else:
            # Update company_details
            insert_query = text("""
                UPDATE company_details 
                SET financial_year_start_month = :fy_start_month, 
                    invoice_prefix = :invoice_prefix,
                    updated_at = now()
                WHERE company_id = :company_id
            """)
        
        db.execute(insert_query, {
            "company_id": company_id,
            "fy_start_month": settings.fy_start_month,
            "invoice_prefix": settings.invoice_prefix
        })
        
        db.commit()
        
        return settings
        
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"Update financial settings error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update financial settings"
        )

# Tax Settings
@router.get("/tax", response_model=TaxSettings)
async def get_tax_settings(
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user)
):
    """Get tax settings (enabled GST rates)"""
    try:
        company_id = str(current_user.company_id)
        
        # Check permissions
        if current_user.role not in ['admin', 'super_admin', 'accountant']:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Insufficient permissions"
            )
        
        # Get enabled GST rates
        query = text("""
            SELECT (cgst_rate + sgst_rate + igst_rate + cess_rate) as total_rate 
            FROM tax_rates 
            WHERE company_id = :company_id 
              AND tax_type = 'gst' 
              AND is_active = true
            ORDER BY total_rate
        """)
        
        results = db.execute(query, {"company_id": company_id}).fetchall()
        
        enabled_rates = [int(row.total_rate) for row in results]
        
        # If no tax rates are configured, return default GST rates for India
        if not enabled_rates:
            enabled_rates = [0, 5, 12, 18, 28]  # Default Indian GST rates
        
        return TaxSettings(enabled_gst_rates=enabled_rates)
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to fetch tax settings"
        )

@router.put("/tax", response_model=TaxSettings)
async def update_tax_settings(
    settings: TaxSettings,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user)
):
    """Update tax settings (toggle GST rates)"""
    try:
        # Check permissions
        if current_user.role not in ['admin', 'super_admin', 'accountant']:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Insufficient permissions"
            )
        
        company_id = str(current_user.company_id)
        
        # Get all GST rates for this company
        all_rates_query = text("""
            SELECT total_rate 
            FROM tax_rates 
            WHERE company_id = :company_id AND tax_type = 'gst'
        """)
        all_rates = db.execute(all_rates_query, {"company_id": company_id}).fetchall()
        
        if not all_rates:
            # Seed default GST rates if none exist
            seed_query = text("""
                INSERT INTO tax_rates (company_id, tax_name, tax_type, cgst_rate, sgst_rate, igst_rate)
                VALUES 
                    (:company_id, 'GST 5%', 'gst', 2.5, 2.5, 5.0),
                    (:company_id, 'GST 12%', 'gst', 6.0, 6.0, 12.0),
                    (:company_id, 'GST 18%', 'gst', 9.0, 9.0, 18.0),
                    (:company_id, 'GST 28%', 'gst', 14.0, 14.0, 28.0)
            """)
            db.execute(seed_query, {"company_id": company_id})
            
            # Re-fetch all rates
            all_rates = db.execute(all_rates_query, {"company_id": company_id}).fetchall()
        
        # Update is_active for each rate
        for rate_row in all_rates:
            rate = int(rate_row.total_rate)
            is_enabled = rate in settings.enabled_gst_rates
            
            update_query = text("""
                UPDATE tax_rates 
                SET is_active = :is_active, updated_at = now()
                WHERE company_id = :company_id 
                  AND total_rate = :rate 
                  AND tax_type = 'gst'
            """)
            db.execute(update_query, {
                "company_id": company_id,
                "rate": rate,
                "is_active": is_enabled
            })
        
        db.commit()
        
        return settings
        
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"Update tax settings error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update tax settings"
        )

# Notification Settings
@router.get("/notifications", response_model=NotificationSettings)
async def get_notification_settings(
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user)
):
    """Get notification settings"""
    try:
        company_id = str(current_user.company_id)
        
        # Check permissions
        if current_user.role not in ['admin', 'super_admin', 'accountant']:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Insufficient permissions"
            )
        
        # Get notification settings
        query = text("""
            SELECT 
                notification_duplicate_invoice,
                notification_gst_mismatch,
                notification_overdue_receivable,
                notification_overdue_payable,
                notification_concentration_risk,
                notification_gstr_reminders
            FROM company_settings 
            WHERE company_id = :company_id
        """)
        
        result = db.execute(query, {"company_id": company_id}).fetchone()
        
        if not result:
            # Create default settings
            insert_query = text("""
                INSERT INTO company_settings (
                    company_id, 
                    notification_duplicate_invoice, notification_gst_mismatch,
                    notification_overdue_receivable, notification_overdue_payable,
                    notification_concentration_risk, notification_gstr_reminders,
                    created_at, updated_at
                ) VALUES (
                    :company_id, true, true, true, true, true, true, now(), now()
                )
                RETURNING 
                    notification_duplicate_invoice, notification_gst_mismatch,
                    notification_overdue_receivable, notification_overdue_payable,
                    notification_concentration_risk, notification_gstr_reminders
            """)
            result = db.execute(insert_query, {"company_id": company_id}).fetchone()
            db.commit()
        
        settings_data = dict(result._mapping)
        return NotificationSettings(**settings_data)
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Get notification settings error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to fetch notification settings"
        )

@router.put("/notifications", response_model=NotificationSettings)
async def update_notification_settings(
    settings: NotificationSettings,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user)
):
    """Update notification settings"""
    try:
        # Check permissions
        if current_user.role not in ['admin', 'super_admin', 'accountant']:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Insufficient permissions"
            )
        
        company_id = str(current_user.company_id)
        
        # Update or insert notification settings
        upsert_query = text("""
            INSERT INTO company_settings (
                company_id,
                notification_duplicate_invoice, notification_gst_mismatch,
                notification_overdue_receivable, notification_overdue_payable,
                notification_concentration_risk, notification_gstr_reminders,
                updated_at
            ) VALUES (
                :company_id,
                :duplicate_invoice, :gst_mismatch,
                :overdue_receivable, :overdue_payable,
                :concentration_risk, :gstr_reminders,
                now()
            )
            ON CONFLICT (company_id) 
            DO UPDATE SET
                notification_duplicate_invoice = EXCLUDED.notification_duplicate_invoice,
                notification_gst_mismatch = EXCLUDED.notification_gst_mismatch,
                notification_overdue_receivable = EXCLUDED.notification_overdue_receivable,
                notification_overdue_payable = EXCLUDED.notification_overdue_payable,
                notification_concentration_risk = EXCLUDED.notification_concentration_risk,
                notification_gstr_reminders = EXCLUDED.notification_gstr_reminders,
                updated_at = now()
        """)
        
        db.execute(upsert_query, {
            "company_id": company_id,
            "duplicate_invoice": settings.duplicate_invoice,
            "gst_mismatch": settings.gst_mismatch,
            "overdue_receivable": settings.overdue_receivable,
            "overdue_payable": settings.overdue_payable,
            "concentration_risk": settings.concentration_risk,
            "gstr_reminders": settings.gstr_reminders
        })
        
        db.commit()
        
        return settings
        
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"Update notification settings error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update notification settings"
        )

# Audit Settings
@router.get("/audit", response_model=AuditSettings)
async def get_audit_settings(
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user)
):
    """Get audit settings"""
    try:
        company_id = str(current_user.company_id)
        
        # Check permissions
        if current_user.role not in ['admin', 'super_admin']:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Insufficient permissions"
            )
        
        # Get audit settings
        query = text("""
            SELECT lock_after_approval, dual_approval, dual_approval_threshold
            FROM company_settings 
            WHERE company_id = :company_id
        """)
        
        result = db.execute(query, {"company_id": company_id}).fetchone()
        
        if not result:
            # Create default settings
            insert_query = text("""
                INSERT INTO company_settings (
                    company_id, lock_after_approval, dual_approval, 
                    dual_approval_threshold, created_at, updated_at
                ) VALUES (
                    :company_id, false, false, 0, now(), now()
                )
                RETURNING lock_after_approval, dual_approval, dual_approval_threshold
            """)
            result = db.execute(insert_query, {"company_id": company_id}).fetchone()
            db.commit()
        
        settings_data = dict(result._mapping)
        settings_data['dual_approval_threshold'] = float(settings_data['dual_approval_threshold'])
        return AuditSettings(**settings_data)
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Get audit settings error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to fetch audit settings"
        )

@router.put("/audit", response_model=AuditSettings)
async def update_audit_settings(
    settings: AuditSettings,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user)
):
    """Update audit settings"""
    try:
        # Check permissions
        if current_user.role not in ['admin', 'super_admin']:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Insufficient permissions"
            )
        
        # Validate dual approval threshold
        if settings.dual_approval and settings.dual_approval_threshold <= 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Dual approval threshold must be greater than 0 when dual approval is enabled"
            )
        
        company_id = str(current_user.company_id)
        
        # Update or insert audit settings
        upsert_query = text("""
            INSERT INTO company_settings (
                company_id,
                lock_after_approval, dual_approval, dual_approval_threshold,
                updated_at
            ) VALUES (
                :company_id,
                :lock_after_approval, :dual_approval, :dual_approval_threshold,
                now()
            )
            ON CONFLICT (company_id) 
            DO UPDATE SET
                lock_after_approval = EXCLUDED.lock_after_approval,
                dual_approval = EXCLUDED.dual_approval,
                dual_approval_threshold = EXCLUDED.dual_approval_threshold,
                updated_at = now()
        """)
        
        db.execute(upsert_query, {
            "company_id": company_id,
            "lock_after_approval": settings.lock_after_approval,
            "dual_approval": settings.dual_approval,
            "dual_approval_threshold": settings.dual_approval_threshold
        })
        
        db.commit()
        
        return settings
        
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"Update audit settings error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update audit settings"
        )
