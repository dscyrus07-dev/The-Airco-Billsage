"""
Journal Router

Handles journal entries, categories, trial balance, and balance sheet functionality.
"""

from fastapi import APIRouter, HTTPException, Depends, status, Query
from pydantic import BaseModel, Field
from pydantic.config import ConfigDict
from typing import Optional, List, Dict, Any
from sqlalchemy.orm import Session
from sqlalchemy import text
import logging
from datetime import datetime, date
import uuid

from config.database import get_db
from dependencies.auth import CurrentUser, get_current_user
from services.auth_service import AuthService, get_auth_service

logger = logging.getLogger(__name__)
router = APIRouter()

# Pydantic Models
class JournalCategoryBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    code: str = Field(..., min_length=1, max_length=50)
    description: Optional[str] = Field(None, max_length=500)
    is_active: bool = True

class JournalCategoryCreate(JournalCategoryBase):
    pass

class JournalCategoryUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    code: Optional[str] = Field(None, min_length=1, max_length=50)
    description: Optional[str] = Field(None, max_length=500)
    is_active: Optional[bool] = None

class JournalCategoryResponse(JournalCategoryBase):
    id: str
    company_id: str
    created_at: datetime
    updated_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)

class JournalLineItemBase(BaseModel):
    account_code: str = Field(..., min_length=1, max_length=50)
    account_name: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = Field(None, max_length=500)
    debit: float = Field(..., ge=0)
    credit: float = Field(..., ge=0)
    party_id: Optional[str] = None

class JournalLineItemCreate(JournalLineItemBase):
    pass

class JournalLineItemResponse(JournalLineItemBase):
    id: str
    journal_entry_id: str
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)

class JournalEntryBase(BaseModel):
    entry_number: Optional[str] = None
    entry_date: date
    reference: Optional[str] = Field(None, max_length=100)
    description: str = Field(..., min_length=1, max_length=1000)
    status: str = Field("draft", pattern="^(draft|posted|cancelled)$")

class JournalEntryCreate(JournalEntryBase):
    line_items: List[JournalLineItemCreate] = Field(..., min_items=2)

class JournalEntryUpdate(BaseModel):
    entry_date: Optional[date] = None
    reference: Optional[str] = Field(None, max_length=100)
    description: Optional[str] = Field(None, min_length=1, max_length=1000)
    status: Optional[str] = Field(None, pattern="^(draft|posted|cancelled)$")
    line_items: Optional[List[JournalLineItemCreate]] = None

class JournalEntryResponse(JournalEntryBase):
    id: str
    company_id: str
    total_debit: float
    total_credit: float
    created_by: str
    created_at: datetime
    updated_at: Optional[datetime] = None
    updated_by: Optional[str] = None
    line_items: List[JournalLineItemResponse]

    model_config = ConfigDict(from_attributes=True)

class TrialBalanceLine(BaseModel):
    account_code: str
    account_name: str
    account_type: str
    opening_balance: float
    debit_total: float
    credit_total: float
    closing_balance: float

class TrialBalanceResponse(BaseModel):
    id: str
    company_id: str
    as_of_date: date
    generated_at: datetime
    generated_by: str
    total_debit: float
    total_credit: float
    is_balanced: bool
    status: str
    line_items: List[TrialBalanceLine]

    model_config = ConfigDict(from_attributes=True)

class BalanceSheetLine(BaseModel):
    line_type: str = Field(..., pattern="^(asset|liability|equity)$")
    category: str
    item_name: str
    amount: float
    order_index: int

class BalanceSheetResponse(BaseModel):
    id: str
    company_id: str
    as_of_date: date
    generated_at: datetime
    generated_by: str
    total_assets: float
    total_liabilities: float
    total_equity: float
    is_balanced: bool
    status: str
    line_items: List[BalanceSheetLine]

    model_config = ConfigDict(from_attributes=True)

# Helper functions
def generate_entry_number(db: Session, company_id: str) -> str:
    """Generate unique journal entry number"""
    query = text("""
        SELECT COALESCE(MAX(CAST(SUBSTRING(entry_number FROM 7) AS INTEGER)), 0) + 1 as next_number
        FROM journal_entries 
        WHERE company_id = :company_id AND entry_number LIKE 'JE-%'
    """)
    result = db.execute(query, {"company_id": company_id}).fetchone()
    next_number = result.next_number if result else 1
    return f"JE-{next_number:06d}"

def validate_journal_entry_balance(line_items: List[JournalLineItemCreate]) -> bool:
    """Validate that total debit equals total credit"""
    total_debit = sum(item.debit for item in line_items)
    total_credit = sum(item.credit for item in line_items)
    return abs(total_debit - total_credit) < 0.01  # Allow small floating point differences

# Journal Categories Endpoints
@router.get("/categories", response_model=List[JournalCategoryResponse])
async def get_categories(
    current_user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get all journal categories for the current company"""
    try:
        query = text("""
            SELECT id, company_id, name, code, description, is_active, created_at, updated_at
            FROM journal_categories 
            WHERE company_id = :company_id AND deleted_at IS NULL
            ORDER BY code
        """)
        
        result = db.execute(query, {"company_id": str(current_user.company_id)}).fetchall()
        categories = [JournalCategoryResponse(**row._mapping) for row in result]
        
        return categories
        
    except Exception as e:
        logger.error(f"Get categories error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to fetch categories"
        )

@router.post("/categories", response_model=JournalCategoryResponse, status_code=status.HTTP_201_CREATED)
async def create_category(
    category_data: JournalCategoryCreate,
    current_user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Create a new journal category"""
    try:
        # Check if code already exists for this company
        check_query = text("""
            SELECT id FROM journal_categories 
            WHERE company_id = :company_id AND code = :code AND deleted_at IS NULL
        """)
        existing = db.execute(check_query, {
            "company_id": str(current_user.company_id),
            "code": category_data.code
        }).fetchone()
        
        if existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Category code '{category_data.code}' already exists"
            )
        
        # Insert new category
        category_id = str(uuid.uuid4())
        now = datetime.utcnow()
        
        insert_query = text("""
            INSERT INTO journal_categories (
                id, company_id, name, code, description, is_active, 
                created_at, updated_at, created_by, updated_by
            ) VALUES (
                :id, :company_id, :name, :code, :description, :is_active,
                :created_at, :updated_at, :created_by, :updated_by
            )
        """)
        
        db.execute(insert_query, {
            "id": category_id,
            "company_id": str(current_user.company_id),
            "name": category_data.name,
            "code": category_data.code,
            "description": category_data.description,
            "is_active": category_data.is_active,
            "created_at": now,
            "updated_at": now,
            "created_by": str(current_user.user_id),
            "updated_by": str(current_user.user_id)
        })
        
        db.commit()
        
        # Return created category
        return JournalCategoryResponse(
            id=category_id,
            company_id=str(current_user.company_id),
            name=category_data.name,
            code=category_data.code,
            description=category_data.description,
            is_active=category_data.is_active,
            created_at=now
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Create category error: {e}")
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create category"
        )

@router.get("/categories/{category_id}", response_model=JournalCategoryResponse)
async def get_category(
    category_id: str,
    current_user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get category by ID"""
    try:
        query = text("""
            SELECT id, company_id, name, code, description, is_active, created_at, updated_at
            FROM journal_categories 
            WHERE id = :category_id AND company_id = :company_id AND deleted_at IS NULL
        """)
        
        result = db.execute(query, {
            "category_id": category_id,
            "company_id": str(current_user.company_id)
        }).fetchone()
        
        if not result:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Category not found"
            )
        
        return JournalCategoryResponse(**result._mapping)
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Get category error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to fetch category"
        )

@router.put("/categories/{category_id}", response_model=JournalCategoryResponse)
async def update_category(
    category_id: str,
    category_data: JournalCategoryUpdate,
    current_user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update category"""
    try:
        # Check if category exists
        check_query = text("""
            SELECT id FROM journal_categories 
            WHERE id = :category_id AND company_id = :company_id AND deleted_at IS NULL
        """)
        existing = db.execute(check_query, {
            "category_id": category_id,
            "company_id": str(current_user.company_id)
        }).fetchone()
        
        if not existing:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Category not found"
            )
        
        # Check if new code conflicts with existing category
        if category_data.code:
            code_check_query = text("""
                SELECT id FROM journal_categories 
                WHERE company_id = :company_id AND code = :code AND id != :category_id AND deleted_at IS NULL
            """)
            code_conflict = db.execute(code_check_query, {
                "company_id": str(current_user.company_id),
                "code": category_data.code,
                "category_id": category_id
            }).fetchone()
            
            if code_conflict:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Category code '{category_data.code}' already exists"
                )
        
        # Update category
        update_fields = []
        update_values = {
            "category_id": category_id,
            "company_id": str(current_user.company_id),
            "updated_at": datetime.utcnow(),
            "updated_by": str(current_user.user_id)
        }
        
        if category_data.name is not None:
            update_fields.append("name = :name")
            update_values["name"] = category_data.name
        
        if category_data.code is not None:
            update_fields.append("code = :code")
            update_values["code"] = category_data.code
        
        if category_data.description is not None:
            update_fields.append("description = :description")
            update_values["description"] = category_data.description
        
        if category_data.is_active is not None:
            update_fields.append("is_active = :is_active")
            update_values["is_active"] = category_data.is_active
        
        if update_fields:
            update_query = text(f"""
                UPDATE journal_categories 
                SET {', '.join(update_fields)}, updated_at = :updated_at, updated_by = :updated_by
                WHERE id = :category_id AND company_id = :company_id
            """)
            
            db.execute(update_query, update_values)
            db.commit()
        
        # Return updated category
        return await get_category(category_id, current_user, db)
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Update category error: {e}")
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update category"
        )

@router.delete("/categories/{category_id}")
async def delete_category(
    category_id: str,
    current_user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Delete category (soft delete)"""
    try:
        # Check if category exists and is not in use
        check_query = text("""
            SELECT id FROM journal_categories 
            WHERE id = :category_id AND company_id = :company_id AND deleted_at IS NULL
        """)
        existing = db.execute(check_query, {
            "category_id": category_id,
            "company_id": str(current_user.company_id)
        }).fetchone()
        
        if not existing:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Category not found"
            )
        
        # TODO: Check if category is in use by journal entries
        # For now, just soft delete
        
        delete_query = text("""
            UPDATE journal_categories 
            SET deleted_at = :deleted_at, updated_by = :updated_by
            WHERE id = :category_id AND company_id = :company_id
        """)
        
        db.execute(delete_query, {
            "category_id": category_id,
            "company_id": str(current_user.company_id),
            "deleted_at": datetime.utcnow(),
            "updated_by": str(current_user.user_id)
        })
        
        db.commit()
        
        return {"message": "Category deleted successfully"}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Delete category error: {e}")
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to delete category"
        )

# Journal Entries Endpoints
@router.get("/entries", response_model=List[JournalEntryResponse])
async def get_entries(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    status: Optional[str] = Query(None, pattern="^(draft|posted|cancelled)$"),
    date_from: Optional[date] = Query(None),
    date_to: Optional[date] = Query(None),
    current_user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get journal entries with filtering"""
    try:
        where_conditions = ["company_id = :company_id", "deleted_at IS NULL"]
        query_params = {
            "company_id": str(current_user.company_id),
            "limit": limit,
            "skip": skip
        }
        
        if status:
            where_conditions.append("status = :status")
            query_params["status"] = status
        
        if date_from:
            where_conditions.append("entry_date >= :date_from")
            query_params["date_from"] = date_from
        
        if date_to:
            where_conditions.append("entry_date <= :date_to")
            query_params["date_to"] = date_to
        
        query = text(f"""
            SELECT id, company_id, entry_number, entry_date, reference, description, 
                   status, total_debit, total_credit, created_by, created_at, 
                   updated_at, updated_by
            FROM journal_entries 
            WHERE {' AND '.join(where_conditions)}
            ORDER BY entry_date DESC, created_at DESC
            LIMIT :limit OFFSET :skip
        """)
        
        result = db.execute(query, query_params).fetchall()
        
        entries = []
        for row in result:
            # Get line items for each entry
            line_items_query = text("""
                SELECT id, journal_entry_id, account_code, account_name, description, 
                       debit, credit, party_id, created_at
                FROM journal_line_items 
                WHERE journal_entry_id = :journal_entry_id
                ORDER BY id
            """)
            
            line_items_result = db.execute(line_items_query, {
                "journal_entry_id": row.id
            }).fetchall()
            
            line_items = [JournalLineItemResponse(**item._mapping) for item in line_items_result]
            
            entry_data = row._mapping.copy()
            entry_data["line_items"] = line_items
            entries.append(JournalEntryResponse(**entry_data))
        
        return entries
        
    except Exception as e:
        logger.error(f"Get entries error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to fetch journal entries"
        )

@router.post("/entries", response_model=JournalEntryResponse, status_code=status.HTTP_201_CREATED)
async def create_entry(
    entry_data: JournalEntryCreate,
    current_user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Create a new journal entry"""
    try:
        # Validate entry balance
        if not validate_journal_entry_balance(entry_data.line_items):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Total debit must equal total credit"
            )
        
        # Generate entry number if not provided
        entry_number = entry_data.entry_number or generate_entry_number(db, str(current_user.company_id))
        
        # Calculate totals
        total_debit = sum(item.debit for item in entry_data.line_items)
        total_credit = sum(item.credit for item in entry_data.line_items)
        
        # Create journal entry
        entry_id = str(uuid.uuid4())
        now = datetime.utcnow()
        
        entry_query = text("""
            INSERT INTO journal_entries (
                id, company_id, entry_number, entry_date, reference, description,
                status, total_debit, total_credit, created_by, created_at, updated_at, updated_by
            ) VALUES (
                :id, :company_id, :entry_number, :entry_date, :reference, :description,
                :status, :total_debit, :total_credit, :created_by, :created_at, :updated_at, :updated_by
            )
        """)
        
        db.execute(entry_query, {
            "id": entry_id,
            "company_id": str(current_user.company_id),
            "entry_number": entry_number,
            "entry_date": entry_data.entry_date,
            "reference": entry_data.reference,
            "description": entry_data.description,
            "status": entry_data.status,
            "total_debit": total_debit,
            "total_credit": total_credit,
            "created_by": str(current_user.user_id),
            "created_at": now,
            "updated_at": now,
            "updated_by": str(current_user.user_id)
        })
        
        # Create line items
        line_items = []
        for item_data in entry_data.line_items:
            line_item_id = str(uuid.uuid4())
            
            line_item_query = text("""
                INSERT INTO journal_line_items (
                    id, journal_entry_id, account_code, account_name, description,
                    debit, credit, party_id, created_at
                ) VALUES (
                    :id, :journal_entry_id, :account_code, :account_name, :description,
                    :debit, :credit, :party_id, :created_at
                )
            """)
            
            db.execute(line_item_query, {
                "id": line_item_id,
                "journal_entry_id": entry_id,
                "account_code": item_data.account_code,
                "account_name": item_data.account_name,
                "description": item_data.description,
                "debit": item_data.debit,
                "credit": item_data.credit,
                "party_id": item_data.party_id,
                "created_at": now
            })
            
            line_items.append(JournalLineItemResponse(
                id=line_item_id,
                journal_entry_id=entry_id,
                account_code=item_data.account_code,
                account_name=item_data.account_name,
                description=item_data.description,
                debit=item_data.debit,
                credit=item_data.credit,
                party_id=item_data.party_id,
                created_at=now
            ))
        
        db.commit()
        
        # Return created entry
        return JournalEntryResponse(
            id=entry_id,
            company_id=str(current_user.company_id),
            entry_number=entry_number,
            entry_date=entry_data.entry_date,
            reference=entry_data.reference,
            description=entry_data.description,
            status=entry_data.status,
            total_debit=total_debit,
            total_credit=total_credit,
            created_by=str(current_user.user_id),
            created_at=now,
            line_items=line_items
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Create entry error: {e}")
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create journal entry"
        )

@router.get("/entries/{entry_id}", response_model=JournalEntryResponse)
async def get_entry(
    entry_id: str,
    current_user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get journal entry by ID"""
    try:
        query = text("""
            SELECT id, company_id, entry_number, entry_date, reference, description, 
                   status, total_debit, total_credit, created_by, created_at, 
                   updated_at, updated_by
            FROM journal_entries 
            WHERE id = :entry_id AND company_id = :company_id AND deleted_at IS NULL
        """)
        
        result = db.execute(query, {
            "entry_id": entry_id,
            "company_id": str(current_user.company_id)
        }).fetchone()
        
        if not result:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Journal entry not found"
            )
        
        # Get line items
        line_items_query = text("""
            SELECT id, journal_entry_id, account_code, account_name, description, 
                   debit, credit, party_id, created_at
            FROM journal_line_items 
            WHERE journal_entry_id = :journal_entry_id
            ORDER BY id
        """)
        
        line_items_result = db.execute(line_items_query, {
            "journal_entry_id": entry_id
        }).fetchall()
        
        line_items = [JournalLineItemResponse(**item._mapping) for item in line_items_result]
        
        entry_data = result._mapping.copy()
        entry_data["line_items"] = line_items
        
        return JournalEntryResponse(**entry_data)
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Get entry error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to fetch journal entry"
        )

@router.put("/entries/{entry_id}", response_model=JournalEntryResponse)
async def update_entry(
    entry_id: str,
    entry_data: JournalEntryUpdate,
    current_user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update journal entry"""
    try:
        # Check if entry exists and is not posted
        check_query = text("""
            SELECT id, status FROM journal_entries 
            WHERE id = :entry_id AND company_id = :company_id AND deleted_at IS NULL
        """)
        existing = db.execute(check_query, {
            "entry_id": entry_id,
            "company_id": str(current_user.company_id)
        }).fetchone()
        
        if not existing:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Journal entry not found"
            )
        
        if existing.status == "posted":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot update posted journal entry"
            )
        
        # Update entry
        update_fields = []
        update_values = {
            "entry_id": entry_id,
            "company_id": str(current_user.company_id),
            "updated_at": datetime.utcnow(),
            "updated_by": str(current_user.user_id)
        }
        
        if entry_data.entry_date is not None:
            update_fields.append("entry_date = :entry_date")
            update_values["entry_date"] = entry_data.entry_date
        
        if entry_data.reference is not None:
            update_fields.append("reference = :reference")
            update_values["reference"] = entry_data.reference
        
        if entry_data.description is not None:
            update_fields.append("description = :description")
            update_values["description"] = entry_data.description
        
        if entry_data.status is not None:
            update_fields.append("status = :status")
            update_values["status"] = entry_data.status
        
        # Update line items if provided
        if entry_data.line_items is not None:
            # Validate balance
            if not validate_journal_entry_balance(entry_data.line_items):
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Total debit must equal total credit"
                )
            
            # Delete existing line items
            delete_line_items_query = text("""
                DELETE FROM journal_line_items WHERE journal_entry_id = :journal_entry_id
            """)
            db.execute(delete_line_items_query, {"journal_entry_id": entry_id})
            
            # Create new line items
            total_debit = 0
            total_credit = 0
            
            for item_data in entry_data.line_items:
                line_item_id = str(uuid.uuid4())
                
                line_item_query = text("""
                    INSERT INTO journal_line_items (
                        id, journal_entry_id, account_code, account_name, description,
                        debit, credit, party_id, created_at
                    ) VALUES (
                        :id, :journal_entry_id, :account_code, :account_name, :description,
                        :debit, :credit, :party_id, :created_at
                    )
                """)
                
                db.execute(line_item_query, {
                    "id": line_item_id,
                    "journal_entry_id": entry_id,
                    "account_code": item_data.account_code,
                    "account_name": item_data.account_name,
                    "description": item_data.description,
                    "debit": item_data.debit,
                    "credit": item_data.credit,
                    "party_id": item_data.party_id,
                    "created_at": datetime.utcnow()
                })
                
                total_debit += item_data.debit
                total_credit += item_data.credit
            
            # Update totals
            update_fields.append("total_debit = :total_debit")
            update_fields.append("total_credit = :total_credit")
            update_values["total_debit"] = total_debit
            update_values["total_credit"] = total_credit
        
        if update_fields:
            update_query = text(f"""
                UPDATE journal_entries 
                SET {', '.join(update_fields)}, updated_at = :updated_at, updated_by = :updated_by
                WHERE id = :entry_id AND company_id = :company_id
            """)
            
            db.execute(update_query, update_values)
            db.commit()
        
        # Return updated entry
        return await get_entry(entry_id, current_user, db)
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Update entry error: {e}")
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update journal entry"
        )

@router.delete("/entries/{entry_id}")
async def delete_entry(
    entry_id: str,
    current_user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Delete journal entry (soft delete)"""
    try:
        # Check if entry exists and is not posted
        check_query = text("""
            SELECT id, status FROM journal_entries 
            WHERE id = :entry_id AND company_id = :company_id AND deleted_at IS NULL
        """)
        existing = db.execute(check_query, {
            "entry_id": entry_id,
            "company_id": str(current_user.company_id)
        }).fetchone()
        
        if not existing:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Journal entry not found"
            )
        
        if existing.status == "posted":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot delete posted journal entry"
            )
        
        # Soft delete entry
        delete_query = text("""
            UPDATE journal_entries 
            SET deleted_at = :deleted_at, updated_by = :updated_by
            WHERE id = :entry_id AND company_id = :company_id
        """)
        
        db.execute(delete_query, {
            "entry_id": entry_id,
            "company_id": str(current_user.company_id),
            "deleted_at": datetime.utcnow(),
            "updated_by": str(current_user.user_id)
        })
        
        db.commit()
        
        return {"message": "Journal entry deleted successfully"}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Delete entry error: {e}")
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to delete journal entry"
        )

@router.post("/entries/{entry_id}/post", response_model=JournalEntryResponse)
async def post_entry(
    entry_id: str,
    current_user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Post journal entry (mark as posted)"""
    try:
        # Check if entry exists and is in draft status
        check_query = text("""
            SELECT id, status FROM journal_entries 
            WHERE id = :entry_id AND company_id = :company_id AND deleted_at IS NULL
        """)
        existing = db.execute(check_query, {
            "entry_id": entry_id,
            "company_id": str(current_user.company_id)
        }).fetchone()
        
        if not existing:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Journal entry not found"
            )
        
        if existing.status != "draft":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Only draft entries can be posted"
            )
        
        # Update status to posted
        update_query = text("""
            UPDATE journal_entries 
            SET status = 'posted', updated_at = :updated_at, updated_by = :updated_by
            WHERE id = :entry_id AND company_id = :company_id
        """)
        
        db.execute(update_query, {
            "entry_id": entry_id,
            "company_id": str(current_user.company_id),
            "updated_at": datetime.utcnow(),
            "updated_by": str(current_user.user_id)
        })
        
        db.commit()
        
        # Return updated entry
        return await get_entry(entry_id, current_user, db)
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Post entry error: {e}")
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to post journal entry"
        )

# Trial Balance Endpoints
@router.get("/trial-balance", response_model=List[TrialBalanceResponse])
async def get_trial_balances(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    date_from: Optional[date] = Query(None),
    date_to: Optional[date] = Query(None),
    current_user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get trial balances"""
    try:
        where_conditions = ["company_id = :company_id"]
        query_params = {
            "company_id": str(current_user.company_id),
            "limit": limit,
            "skip": skip
        }
        
        if date_from:
            where_conditions.append("as_of_date >= :date_from")
            query_params["date_from"] = date_from
        
        if date_to:
            where_conditions.append("as_of_date <= :date_to")
            query_params["date_to"] = date_to
        
        query = text(f"""
            SELECT id, company_id, as_of_date, generated_at, generated_by,
                   total_debit, total_credit, is_balanced, status
            FROM trial_balances 
            WHERE {' AND '.join(where_conditions)}
            ORDER BY as_of_date DESC, generated_at DESC
            LIMIT :limit OFFSET :skip
        """)
        
        result = db.execute(query, query_params).fetchall()
        
        trial_balances = []
        for row in result:
            # Get line items for each trial balance
            line_items_query = text("""
                SELECT account_code, account_name, account_type, opening_balance,
                       debit_total, credit_total, closing_balance
                FROM trial_balance_lines 
                WHERE trial_balance_id = :trial_balance_id
                ORDER BY account_code
            """)
            
            line_items_result = db.execute(line_items_query, {
                "trial_balance_id": row.id
            }).fetchall()
            
            line_items = [TrialBalanceLine(**item._mapping) for item in line_items_result]
            
            trial_balance_data = row._mapping.copy()
            trial_balance_data["line_items"] = line_items
            trial_balances.append(TrialBalanceResponse(**trial_balance_data))
        
        return trial_balances
        
    except Exception as e:
        logger.error(f"Get trial balances error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to fetch trial balances"
        )

@router.get("/trial-balance/{trial_balance_id}", response_model=TrialBalanceResponse)
async def get_trial_balance(
    trial_balance_id: str,
    current_user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get trial balance by ID"""
    try:
        query = text("""
            SELECT id, company_id, as_of_date, generated_at, generated_by,
                   total_debit, total_credit, is_balanced, status
            FROM trial_balances 
            WHERE id = :trial_balance_id AND company_id = :company_id
        """)
        
        result = db.execute(query, {
            "trial_balance_id": trial_balance_id,
            "company_id": str(current_user.company_id)
        }).fetchone()
        
        if not result:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Trial balance not found"
            )
        
        # Get line items
        line_items_query = text("""
            SELECT account_code, account_name, account_type, opening_balance,
                   debit_total, credit_total, closing_balance
            FROM trial_balance_lines 
            WHERE trial_balance_id = :trial_balance_id
            ORDER BY account_code
        """)
        
        line_items_result = db.execute(line_items_query, {
            "trial_balance_id": trial_balance_id
        }).fetchall()
        
        line_items = [TrialBalanceLine(**item._mapping) for item in line_items_result]
        
        trial_balance_data = result._mapping.copy()
        trial_balance_data["line_items"] = line_items
        
        return TrialBalanceResponse(**trial_balance_data)
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Get trial balance error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to fetch trial balance"
        )

@router.post("/trial-balance/generate", response_model=TrialBalanceResponse, status_code=status.HTTP_201_CREATED)
async def generate_trial_balance(
    data: Dict[str, Any],
    current_user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Generate trial balance"""
    try:
        as_of_date = date.fromisoformat(data["as_of_date"])
        
        # TODO: Implement actual trial balance calculation logic
        # For now, return a mock trial balance
        
        trial_balance_id = str(uuid.uuid4())
        now = datetime.utcnow()
        
        # Create trial balance record
        insert_query = text("""
            INSERT INTO trial_balances (
                id, company_id, as_of_date, generated_at, generated_by,
                total_debit, total_credit, is_balanced, status
            ) VALUES (
                :id, :company_id, :as_of_date, :generated_at, :generated_by,
                :total_debit, :total_credit, :is_balanced, :status
            )
        """)
        
        # Mock data - replace with actual calculation
        total_debit = 0.0
        total_credit = 0.0
        is_balanced = True
        status = "generated"
        
        db.execute(insert_query, {
            "id": trial_balance_id,
            "company_id": str(current_user.company_id),
            "as_of_date": as_of_date,
            "generated_at": now,
            "generated_by": str(current_user.user_id),
            "total_debit": total_debit,
            "total_credit": total_credit,
            "is_balanced": is_balanced,
            "status": status
        })
        
        db.commit()
        
        # Return created trial balance (mock data for now)
        return TrialBalanceResponse(
            id=trial_balance_id,
            company_id=str(current_user.company_id),
            as_of_date=as_of_date,
            generated_at=now,
            generated_by=str(current_user.user_id),
            total_debit=total_debit,
            total_credit=total_credit,
            is_balanced=is_balanced,
            status=status,
            line_items=[]
        )
        
    except Exception as e:
        logger.error(f"Generate trial balance error: {e}")
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to generate trial balance"
        )

@router.get("/trial-balance/{trial_balance_id}/export")
async def export_trial_balance(
    trial_balance_id: str,
    format: str = Query("csv", pattern="^(csv|pdf)$"),
    current_user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Export trial balance"""
    try:
        # TODO: Implement actual export logic
        # For now, return a mock response
        
        if format == "csv":
            # Return CSV content
            csv_content = "Account Code,Account Name,Debit,Credit\n"
            # Add actual data here
            
            from fastapi.responses import Response
            return Response(
                content=csv_content,
                media_type="text/csv",
                headers={"Content-Disposition": f"attachment; filename=trial_balance_{trial_balance_id}.csv"}
            )
        else:
            # Return PDF content (mock)
            from fastapi.responses import Response
            return Response(
                content=b"%PDF-1.4 mock PDF content",
                media_type="application/pdf",
                headers={"Content-Disposition": f"attachment; filename=trial_balance_{trial_balance_id}.pdf"}
            )
        
    except Exception as e:
        logger.error(f"Export trial balance error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to export trial balance"
        )

# Balance Sheet Endpoints
@router.get("/balance-sheet", response_model=List[BalanceSheetResponse])
async def get_balance_sheets(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    date_from: Optional[date] = Query(None),
    date_to: Optional[date] = Query(None),
    current_user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get balance sheets"""
    try:
        where_conditions = ["company_id = :company_id"]
        query_params = {
            "company_id": str(current_user.company_id),
            "limit": limit,
            "skip": skip
        }
        
        if date_from:
            where_conditions.append("as_of_date >= :date_from")
            query_params["date_from"] = date_from
        
        if date_to:
            where_conditions.append("as_of_date <= :date_to")
            query_params["date_to"] = date_to
        
        query = text(f"""
            SELECT id, company_id, as_of_date, generated_at, generated_by,
                   total_assets, total_liabilities, total_equity, is_balanced, status
            FROM balance_sheets 
            WHERE {' AND '.join(where_conditions)}
            ORDER BY as_of_date DESC, generated_at DESC
            LIMIT :limit OFFSET :skip
        """)
        
        result = db.execute(query, query_params).fetchall()
        
        balance_sheets = []
        for row in result:
            # Get line items for each balance sheet
            line_items_query = text("""
                SELECT line_type, category, item_name, amount, order_index
                FROM balance_sheet_lines 
                WHERE balance_sheet_id = :balance_sheet_id
                ORDER BY order_index
            """)
            
            line_items_result = db.execute(line_items_query, {
                "balance_sheet_id": row.id
            }).fetchall()
            
            line_items = [BalanceSheetLine(**item._mapping) for item in line_items_result]
            
            balance_sheet_data = row._mapping.copy()
            balance_sheet_data["line_items"] = line_items
            balance_sheets.append(BalanceSheetResponse(**balance_sheet_data))
        
        return balance_sheets
        
    except Exception as e:
        logger.error(f"Get balance sheets error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to fetch balance sheets"
        )

@router.get("/balance-sheet/{balance_sheet_id}", response_model=BalanceSheetResponse)
async def get_balance_sheet(
    balance_sheet_id: str,
    current_user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get balance sheet by ID"""
    try:
        query = text("""
            SELECT id, company_id, as_of_date, generated_at, generated_by,
                   total_assets, total_liabilities, total_equity, is_balanced, status
            FROM balance_sheets 
            WHERE id = :balance_sheet_id AND company_id = :company_id
        """)
        
        result = db.execute(query, {
            "balance_sheet_id": balance_sheet_id,
            "company_id": str(current_user.company_id)
        }).fetchone()
        
        if not result:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Balance sheet not found"
            )
        
        # Get line items
        line_items_query = text("""
            SELECT line_type, category, item_name, amount, order_index
            FROM balance_sheet_lines 
            WHERE balance_sheet_id = :balance_sheet_id
            ORDER BY order_index
        """)
        
        line_items_result = db.execute(line_items_query, {
            "balance_sheet_id": balance_sheet_id
        }).fetchall()
        
        line_items = [BalanceSheetLine(**item._mapping) for item in line_items_result]
        
        balance_sheet_data = result._mapping.copy()
        balance_sheet_data["line_items"] = line_items
        
        return BalanceSheetResponse(**balance_sheet_data)
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Get balance sheet error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to fetch balance sheet"
        )

@router.post("/balance-sheet/generate", response_model=BalanceSheetResponse, status_code=status.HTTP_201_CREATED)
async def generate_balance_sheet(
    data: Dict[str, Any],
    current_user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Generate balance sheet"""
    try:
        as_of_date = date.fromisoformat(data["as_of_date"])
        
        # TODO: Implement actual balance sheet calculation logic
        # For now, return a mock balance sheet
        
        balance_sheet_id = str(uuid.uuid4())
        now = datetime.utcnow()
        
        # Create balance sheet record
        insert_query = text("""
            INSERT INTO balance_sheets (
                id, company_id, as_of_date, generated_at, generated_by,
                total_assets, total_liabilities, total_equity, is_balanced, status
            ) VALUES (
                :id, :company_id, :as_of_date, :generated_at, :generated_by,
                :total_assets, :total_liabilities, :total_equity, :is_balanced, :status
            )
        """)
        
        # Mock data - replace with actual calculation
        total_assets = 0.0
        total_liabilities = 0.0
        total_equity = 0.0
        is_balanced = True
        status = "generated"
        
        db.execute(insert_query, {
            "id": balance_sheet_id,
            "company_id": str(current_user.company_id),
            "as_of_date": as_of_date,
            "generated_at": now,
            "generated_by": str(current_user.user_id),
            "total_assets": total_assets,
            "total_liabilities": total_liabilities,
            "total_equity": total_equity,
            "is_balanced": is_balanced,
            "status": status
        })
        
        db.commit()
        
        # Return created balance sheet (mock data for now)
        return BalanceSheetResponse(
            id=balance_sheet_id,
            company_id=str(current_user.company_id),
            as_of_date=as_of_date,
            generated_at=now,
            generated_by=str(current_user.user_id),
            total_assets=total_assets,
            total_liabilities=total_liabilities,
            total_equity=total_equity,
            is_balanced=is_balanced,
            status=status,
            line_items=[]
        )
        
    except Exception as e:
        logger.error(f"Generate balance sheet error: {e}")
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to generate balance sheet"
        )

@router.get("/balance-sheet/{balance_sheet_id}/export")
async def export_balance_sheet(
    balance_sheet_id: str,
    format: str = Query("csv", pattern="^(csv|pdf)$"),
    current_user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Export balance sheet"""
    try:
        # TODO: Implement actual export logic
        # For now, return a mock response
        
        if format == "csv":
            # Return CSV content
            csv_content = "Line Type,Category,Item Name,Amount\n"
            # Add actual data here
            
            from fastapi.responses import Response
            return Response(
                content=csv_content,
                media_type="text/csv",
                headers={"Content-Disposition": f"attachment; filename=balance_sheet_{balance_sheet_id}.csv"}
            )
        else:
            # Return PDF content (mock)
            from fastapi.responses import Response
            return Response(
                content=b"%PDF-1.4 mock PDF content",
                media_type="application/pdf",
                headers={"Content-Disposition": f"attachment; filename=balance_sheet_{balance_sheet_id}.pdf"}
            )
        
    except Exception as e:
        logger.error(f"Export balance sheet error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to export balance sheet"
        )
