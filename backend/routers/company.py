"""
Company Router

Handles company profile management and settings.
"""

from fastapi import APIRouter, HTTPException, Depends, status
from pydantic import BaseModel, EmailStr, Field
from pydantic.config import ConfigDict
from typing import Optional, Dict, Any
from sqlalchemy import text
from sqlalchemy.orm import Session
import logging
from datetime import datetime

from config.database import get_db
from dependencies.auth import CurrentUser, get_current_user

logger = logging.getLogger(__name__)
router = APIRouter()

# Pydantic Models
class CompanyResponse(BaseModel):
    id: str
    legal_name: str
    trade_name: Optional[str] = None
    display_name: Optional[str] = None
    company_code: Optional[str] = None
    primary_email: Optional[str] = None
    primary_phone: Optional[str] = None
    logo_url: Optional[str] = None
    base_currency: Optional[str] = None
    timezone: Optional[str] = None
    
    # Company Details
    gstin: Optional[str] = None
    pan: Optional[str] = None
    cin: Optional[str] = None
    tan: Optional[str] = None
    address_line_1: Optional[str] = None
    address_line_2: Optional[str] = None
    landmark: Optional[str] = None
    city: Optional[str] = None
    district: Optional[str] = None
    state: Optional[str] = None
    postal_code: Optional[str] = None
    country: Optional[str] = None
    website: Optional[str] = None
    billing_email: Optional[str] = None
    support_email: Optional[str] = None
    alternate_phone: Optional[str] = None
    
    # Financial Settings
    financial_year_start_month: Optional[int] = None
    invoice_prefix: Optional[str] = None
    credit_note_prefix: Optional[str] = None
    debit_note_prefix: Optional[str] = None
    payment_prefix: Optional[str] = None
    receipt_prefix: Optional[str] = None
    po_prefix: Optional[str] = None
    
    # Bank Details
    bank_account_name: Optional[str] = None
    bank_name: Optional[str] = None
    bank_branch: Optional[str] = None
    bank_account_number_masked: Optional[str] = None
    ifsc_code: Optional[str] = None
    upi_id: Optional[str] = None
    
    # Company Settings
    notification_duplicate_invoice: Optional[bool] = None
    notification_gst_mismatch: Optional[bool] = None
    notification_overdue_receivable: Optional[bool] = None
    notification_overdue_payable: Optional[bool] = None
    notification_concentration_risk: Optional[bool] = None
    notification_gstr_reminders: Optional[bool] = None
    lock_after_approval: Optional[bool] = None
    dual_approval: Optional[bool] = None
    dual_approval_threshold: Optional[float] = None
    
    status: str
    is_active: bool
    created_at: datetime
    updated_at: datetime

class CompanyUpdateRequest(BaseModel):
    legal_name: Optional[str] = None
    trade_name: Optional[str] = None
    display_name: Optional[str] = None
    primary_email: Optional[EmailStr] = None
    primary_phone: Optional[str] = None
    gstin: Optional[str] = None
    pan: Optional[str] = None
    cin: Optional[str] = None
    tan: Optional[str] = None
    address_line1: Optional[str] = None
    address_line2: Optional[str] = None
    landmark: Optional[str] = None
    city: Optional[str] = None
    district: Optional[str] = None
    state: Optional[str] = None
    postal_code: Optional[str] = None
    country: Optional[str] = None
    website: Optional[str] = None
    billing_email: Optional[EmailStr] = None
    support_email: Optional[EmailStr] = None
    alternate_phone: Optional[str] = None
    financial_year_start_month: Optional[int] = Field(None, ge=1, le=12)
    invoice_prefix: Optional[str] = None
    credit_note_prefix: Optional[str] = None
    debit_note_prefix: Optional[str] = None
    payment_prefix: Optional[str] = None
    receipt_prefix: Optional[str] = None
    po_prefix: Optional[str] = None
    bank_account_name: Optional[str] = None
    bank_name: Optional[str] = None
    bank_branch: Optional[str] = None
    bank_account_number_masked: Optional[str] = None
    ifsc_code: Optional[str] = None
    upi_id: Optional[str] = None
    notification_duplicate_invoice: Optional[bool] = None
    notification_gst_mismatch: Optional[bool] = None
    notification_overdue_receivable: Optional[bool] = None
    notification_overdue_payable: Optional[bool] = None
    notification_concentration_risk: Optional[bool] = None
    notification_gstr_reminders: Optional[bool] = None
    lock_after_approval: Optional[bool] = None
    dual_approval: Optional[bool] = None
    dual_approval_threshold: Optional[float] = None

@router.get("/me", response_model=CompanyResponse)
async def get_my_company(
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user)
):
    """Get current user's company profile"""
    try:
        company_id = str(current_user.company_id)
        logger.info(f"Fetching company data for company_id: {company_id}")
        
        # Query company, company_details, and company_settings
        query = text("""
            SELECT 
                c.id,
                c.legal_name,
                c.trade_name,
                c.display_name,
                c.company_code,
                c.primary_email,
                c.primary_phone,
                c.logo_url,
                c.base_currency,
                c.timezone,
                c.status,
                c.is_active,
                c.created_at,
                c.updated_at,
                cd.gstin,
                cd.pan,
                cd.cin,
                cd.tan,
                cd.address_line_1,
                cd.address_line_2,
                cd.landmark,
                cd.city,
                cd.district,
                cd.state,
                cd.postal_code,
                cd.country,
                cd.website,
                cd.billing_email,
                cd.support_email,
                cd.alternate_phone,
                cd.financial_year_start_month,
                cd.invoice_prefix,
                cd.credit_note_prefix,
                cd.debit_note_prefix,
                cd.payment_prefix,
                cd.receipt_prefix,
                cd.po_prefix,
                cd.bank_account_name,
                cd.bank_name,
                cd.bank_branch,
                cd.bank_account_number_masked,
                cd.ifsc_code,
                cd.upi_id,
                cs.notification_duplicate_invoice,
                cs.notification_gst_mismatch,
                cs.notification_overdue_receivable,
                cs.notification_overdue_payable,
                cs.notification_concentration_risk,
                cs.notification_gstr_reminders,
                cs.lock_after_approval,
                cs.dual_approval,
                cs.dual_approval_threshold
            FROM companies c
            LEFT JOIN company_details cd ON c.id = cd.company_id
            LEFT JOIN company_settings cs ON c.id = cs.company_id
            WHERE c.id = :company_id AND c.deleted_at IS NULL
        """)
        
        result = db.execute(query, {"company_id": company_id}).fetchone()
        
        if not result:
            logger.error(f"Company not found for company_id: {company_id}")
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Company not found"
            )
        
        # Convert to dict
        company_data = dict(result._mapping)
        logger.info(f"Raw company data keys: {list(company_data.keys())}")
        
        # Convert UUID to string
        if 'id' in company_data and company_data['id'] is not None:
            company_data['id'] = str(company_data['id'])
        
        # Convert Decimal to float for dual_approval_threshold
        if 'dual_approval_threshold' in company_data and company_data['dual_approval_threshold'] is not None:
            company_data['dual_approval_threshold'] = float(company_data['dual_approval_threshold'])
        
        # Ensure all required fields have default values if NULL
        # Handle missing company_details
        if company_data.get('gstin') is None:
            company_data['gstin'] = None
        if company_data.get('pan') is None:
            company_data['pan'] = None
        if company_data.get('cin') is None:
            company_data['cin'] = None
        if company_data.get('tan') is None:
            company_data['tan'] = None
        if company_data.get('address_line_1') is None:
            company_data['address_line_1'] = None
        if company_data.get('address_line_2') is None:
            company_data['address_line_2'] = None
        if company_data.get('landmark') is None:
            company_data['landmark'] = None
        if company_data.get('city') is None:
            company_data['city'] = None
        if company_data.get('district') is None:
            company_data['district'] = None
        if company_data.get('state') is None:
            company_data['state'] = None
        if company_data.get('postal_code') is None:
            company_data['postal_code'] = None
        if company_data.get('country') is None:
            company_data['country'] = None
        if company_data.get('website') is None:
            company_data['website'] = None
        if company_data.get('billing_email') is None:
            company_data['billing_email'] = None
        if company_data.get('support_email') is None:
            company_data['support_email'] = None
        if company_data.get('alternate_phone') is None:
            company_data['alternate_phone'] = None
        if company_data.get('financial_year_start_month') is None:
            company_data['financial_year_start_month'] = 4  # Default to April
        if company_data.get('invoice_prefix') is None:
            company_data['invoice_prefix'] = "INV"
        if company_data.get('credit_note_prefix') is None:
            company_data['credit_note_prefix'] = "CN"
        if company_data.get('debit_note_prefix') is None:
            company_data['debit_note_prefix'] = "DN"
        if company_data.get('payment_prefix') is None:
            company_data['payment_prefix'] = "PAY"
        if company_data.get('receipt_prefix') is None:
            company_data['receipt_prefix'] = "REC"
        if company_data.get('po_prefix') is None:
            company_data['po_prefix'] = "PO"
        if company_data.get('bank_account_name') is None:
            company_data['bank_account_name'] = None
        if company_data.get('bank_name') is None:
            company_data['bank_name'] = None
        if company_data.get('bank_branch') is None:
            company_data['bank_branch'] = None
        if company_data.get('bank_account_number_masked') is None:
            company_data['bank_account_number_masked'] = None
        if company_data.get('ifsc_code') is None:
            company_data['ifsc_code'] = None
        if company_data.get('upi_id') is None:
            company_data['upi_id'] = None
        
        # Handle missing company_settings
        if company_data.get('notification_duplicate_invoice') is None:
            company_data['notification_duplicate_invoice'] = True
        if company_data.get('notification_gst_mismatch') is None:
            company_data['notification_gst_mismatch'] = True
        if company_data.get('notification_overdue_receivable') is None:
            company_data['notification_overdue_receivable'] = True
        if company_data.get('notification_overdue_payable') is None:
            company_data['notification_overdue_payable'] = True
        if company_data.get('notification_concentration_risk') is None:
            company_data['notification_concentration_risk'] = True
        if company_data.get('notification_gstr_reminders') is None:
            company_data['notification_gstr_reminders'] = True
        if company_data.get('lock_after_approval') is None:
            company_data['lock_after_approval'] = False
        if company_data.get('dual_approval') is None:
            company_data['dual_approval'] = False
        if company_data.get('dual_approval_threshold') is None:
            company_data['dual_approval_threshold'] = 0.0
        
        logger.info(f"Final company data prepared for response")
        return CompanyResponse(**company_data)
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Get company error: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to fetch company data"
        )

@router.patch("/me", response_model=CompanyResponse)
async def update_my_company(
    company_data: CompanyUpdateRequest,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user)
):
    """Update current user's company profile"""
    try:
        company_id = str(current_user.company_id)
        
        # Check role permissions (admin or super_admin can update company)
        if current_user.role not in ['admin', 'super_admin']:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Insufficient permissions to update company"
            )
        
        # Update companies table
        company_update_fields = []
        company_params = {"company_id": company_id}
        
        for field, value in company_data.dict(exclude_unset=True).items():
            if field in ['legal_name', 'trade_name', 'display_name', 'primary_email', 'primary_phone']:
                company_update_fields.append(f"{field} = :{field}")
                company_params[field] = value
        
        if company_update_fields:
            company_query = text(f"""
                UPDATE companies 
                SET {', '.join(company_update_fields)}, updated_at = now()
                WHERE id = :company_id
            """)
            db.execute(company_query, company_params)
        
        # Update company_details table (ensure it exists first)
        # Check if company_details exists
        details_exists = db.execute(
            text("SELECT 1 FROM company_details WHERE company_id = :company_id"),
            {"company_id": company_id}
        ).fetchone()
        
        if not details_exists:
            # Create company_details record
            insert_query = text("""
                INSERT INTO company_details (company_id, country, created_at, updated_at)
                VALUES (:company_id, 'India', now(), now())
            """)
            db.execute(insert_query, {"company_id": company_id})
        
        # Update company_details table
        details_update_fields = []
        details_params = {"company_id": company_id}
        
        field_mapping = {
            'gstin': 'gstin',
            'pan': 'pan',
            'cin': 'cin',
            'tan': 'tan',
            'address_line1': 'address_line_1',
            'address_line2': 'address_line_2',
            'landmark': 'landmark',
            'city': 'city',
            'district': 'district',
            'state': 'state',
            'postal_code': 'postal_code',
            'country': 'country',
            'website': 'website',
            'billing_email': 'billing_email',
            'support_email': 'support_email',
            'alternate_phone': 'alternate_phone',
            'financial_year_start_month': 'financial_year_start_month',
            'invoice_prefix': 'invoice_prefix',
            'credit_note_prefix': 'credit_note_prefix',
            'debit_note_prefix': 'debit_note_prefix',
            'payment_prefix': 'payment_prefix',
            'receipt_prefix': 'receipt_prefix',
            'po_prefix': 'po_prefix',
            'bank_account_name': 'bank_account_name',
            'bank_name': 'bank_name',
            'bank_branch': 'bank_branch',
            'bank_account_number_masked': 'bank_account_number_masked',
            'ifsc_code': 'ifsc_code',
            'upi_id': 'upi_id'
        }
        
        # Special handling for bank_account_number - encrypt and create masked version
        if 'bank_account_number_masked' in company_data.dict(exclude_unset=True):
            account_number = company_data.dict(exclude_unset=True)['bank_account_number_masked']
            if account_number:
                # Store as masked (show last 4 digits)
                if len(account_number) > 4:
                    masked = 'X' * (len(account_number) - 4) + account_number[-4:]
                else:
                    masked = account_number
                details_update_fields.append("bank_account_number_masked = :masked_account")
                details_params['masked_account'] = masked
                
                # Store encrypted version
                details_update_fields.append("bank_account_number_encrypted = pgp_sym_encrypt(:account_number, current_setting('app.encryption_key'))")
                details_params['account_number'] = account_number
            # Remove from normal field mapping to avoid double processing
            company_data.dict(exclude_unset=True).pop('bank_account_number_masked', None)
        
        for field, value in company_data.dict(exclude_unset=True).items():
            if field in field_mapping:
                db_field = field_mapping[field]
                details_update_fields.append(f"{db_field} = :{field}")
                details_params[field] = value
        
        if details_update_fields:
            details_query = text(f"""
                UPDATE company_details 
                SET {', '.join(details_update_fields)}, updated_at = now()
                WHERE company_id = :company_id
            """)
            db.execute(details_query, details_params)
        
        # Update company_settings table
        # Check if company_settings exists
        settings_exists = db.execute(
            text("SELECT 1 FROM company_settings WHERE company_id = :company_id"),
            {"company_id": company_id}
        ).fetchone()
        
        if not settings_exists:
            # Create company_settings record
            insert_settings_query = text("""
                INSERT INTO company_settings (company_id, created_at, updated_at)
                VALUES (:company_id, now(), now())
            """)
            db.execute(insert_settings_query, {"company_id": company_id})
        
        # Update company_settings table
        settings_update_fields = []
        settings_params = {"company_id": company_id}
        
        settings_fields = [
            'notification_duplicate_invoice', 'notification_gst_mismatch',
            'notification_overdue_receivable', 'notification_overdue_payable',
            'notification_concentration_risk', 'notification_gstr_reminders',
            'lock_after_approval', 'dual_approval', 'dual_approval_threshold'
        ]
        
        for field in settings_fields:
            if field in company_data.dict(exclude_unset=True):
                value = company_data.dict(exclude_unset=True)[field]
                settings_update_fields.append(f"{field} = :{field}")
                settings_params[field] = value
        
        if settings_update_fields:
            settings_query = text(f"""
                UPDATE company_settings 
                SET {', '.join(settings_update_fields)}, updated_at = now()
                WHERE company_id = :company_id
            """)
            db.execute(settings_query, settings_params)
        
        db.commit()
        
        # Return updated company data
        return await get_my_company(db, current_user)
        
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"Update company error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update company"
        )

@router.get("/{company_id}", response_model=CompanyResponse)
async def get_company_by_id(
    company_id: str,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user)
):
    """Get company by ID (admin/super_admin only)"""
    try:
        # Check permissions (only admin/super_admin can access any company)
        if current_user.role not in ['admin', 'super_admin']:
            # Users can only access their own company
            if str(current_user.company_id) != company_id:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Insufficient permissions"
                )
        
        # Use the same logic as get_my_company
        query = text("""
            SELECT 
                c.id,
                c.legal_name,
                c.trade_name,
                c.display_name,
                c.primary_email,
                c.primary_phone,
                c.status,
                c.created_at,
                c.updated_at,
                cd.gstin,
                cd.pan,
                cd.address_line_1,
                cd.address_line_2,
                cd.city,
                cd.state,
                cd.postal_code,
                cd.country,
                cd.website,
                cd.billing_email,
                cd.support_email,
                cd.financial_year_start_month,
                cd.invoice_prefix
            FROM companies c
            LEFT JOIN company_details cd ON c.id = cd.company_id
            WHERE c.id = :company_id AND c.deleted_at IS NULL
        """)
        
        result = db.execute(query, {"company_id": company_id}).fetchone()
        
        if not result:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Company not found"
            )
        
        company_data = dict(result._mapping)
        
        # Convert UUID to string
        if 'id' in company_data and company_data['id'] is not None:
            company_data['id'] = str(company_data['id'])
        
        company_data['address_line1'] = company_data.pop('address_line_1', None)
        company_data['address_line2'] = company_data.pop('address_line_2', None)
        company_data['postal_code'] = company_data.pop('postal_code', None)
        
        return CompanyResponse(**company_data)
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Get company by ID error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to fetch company data"
        )
