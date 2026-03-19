"""
Ledger Posting Service

Handles double-entry bookkeeping for vouchers.
Creates balanced ledger entries when vouchers are confirmed.
"""

from sqlalchemy.orm import Session
from sqlalchemy import text
from typing import List, Dict, Optional
from decimal import Decimal
import uuid
from datetime import date
import logging

logger = logging.getLogger(__name__)


class LedgerPostingService:
    """Service for creating ledger entries from vouchers"""
    
    def __init__(self):
        pass
    
    def post_sales_invoice(
        self,
        db: Session,
        voucher_id: str,
        company_id: str,
        party_id: str,
        voucher_date: date,
        taxable_amount: Decimal,
        cgst_amount: Decimal,
        sgst_amount: Decimal,
        igst_amount: Decimal,
        cess_amount: Decimal,
        total_amount: Decimal,
        narration: Optional[str] = None
    ) -> List[str]:
        """
        Post ledger entries for a sales invoice
        
        Creates:
        - Debit: Customer Account (Receivable)
        - Credit: Sales Revenue Account
        - Credit: CGST Output Account
        - Credit: SGST Output Account
        - Credit: IGST Output Account
        - Credit: Cess Output Account (if applicable)
        
        Args:
            db: Database session
            voucher_id: Voucher UUID
            company_id: Company UUID
            party_id: Customer UUID
            voucher_date: Invoice date
            taxable_amount: Taxable amount (before tax)
            cgst_amount: CGST amount
            sgst_amount: SGST amount
            igst_amount: IGST amount
            cess_amount: Cess amount
            total_amount: Total invoice amount
            narration: Optional narration
            
        Returns:
            List of created ledger entry IDs
        """
        try:
            # Check if already posted
            check_query = text("""
                SELECT COUNT(*) FROM ledger_entries
                WHERE voucher_id = :voucher_id
            """)
            result = db.execute(check_query, {"voucher_id": voucher_id}).fetchone()
            if result[0] > 0:
                logger.warning(f"Voucher {voucher_id} already has ledger entries. Skipping.")
                return []
            
            entry_ids = []
            
            # Get or create customer account
            customer_account_id = self._get_or_create_party_account(
                db, company_id, party_id, 'receivable'
            )
            
            # Get system accounts
            sales_account_id = self._get_system_account(db, company_id, 'sales_revenue')
            cgst_output_account_id = self._get_system_account(db, company_id, 'cgst_output')
            sgst_output_account_id = self._get_system_account(db, company_id, 'sgst_output')
            igst_output_account_id = self._get_system_account(db, company_id, 'igst_output')
            cess_output_account_id = self._get_system_account(db, company_id, 'cess_output')
            
            # Debit: Customer Account (total amount)
            entry_ids.append(
                self._create_ledger_entry(
                    db, company_id, voucher_id, customer_account_id, voucher_date,
                    dr_amount=total_amount, cr_amount=Decimal('0'),
                    narration=narration or "Sales Invoice"
                )
            )
            
            # Credit: Sales Revenue (taxable amount)
            entry_ids.append(
                self._create_ledger_entry(
                    db, company_id, voucher_id, sales_account_id, voucher_date,
                    dr_amount=Decimal('0'), cr_amount=taxable_amount,
                    narration=narration or "Sales Revenue"
                )
            )
            
            # Credit: CGST Output (if applicable)
            if cgst_amount > 0:
                entry_ids.append(
                    self._create_ledger_entry(
                        db, company_id, voucher_id, cgst_output_account_id, voucher_date,
                        dr_amount=Decimal('0'), cr_amount=cgst_amount,
                        narration="CGST Output"
                    )
                )
            
            # Credit: SGST Output (if applicable)
            if sgst_amount > 0:
                entry_ids.append(
                    self._create_ledger_entry(
                        db, company_id, voucher_id, sgst_output_account_id, voucher_date,
                        dr_amount=Decimal('0'), cr_amount=sgst_amount,
                        narration="SGST Output"
                    )
                )
            
            # Credit: IGST Output (if applicable)
            if igst_amount > 0:
                entry_ids.append(
                    self._create_ledger_entry(
                        db, company_id, voucher_id, igst_output_account_id, voucher_date,
                        dr_amount=Decimal('0'), cr_amount=igst_amount,
                        narration="IGST Output"
                    )
                )
            
            # Credit: Cess Output (if applicable)
            if cess_amount > 0:
                entry_ids.append(
                    self._create_ledger_entry(
                        db, company_id, voucher_id, cess_output_account_id, voucher_date,
                        dr_amount=Decimal('0'), cr_amount=cess_amount,
                        narration="Cess Output"
                    )
                )
            
            # Validate balanced entries
            self._validate_balanced_entries(db, voucher_id)
            
            logger.info(f"Posted {len(entry_ids)} ledger entries for voucher {voucher_id}")
            return entry_ids
            
        except Exception as e:
            logger.error(f"Error posting ledger entries for voucher {voucher_id}: {e}")
            raise
    
    def reverse_ledger_entries(
        self,
        db: Session,
        voucher_id: str
    ) -> int:
        """
        Reverse all ledger entries for a voucher (for cancellation/amendment)
        
        Args:
            db: Database session
            voucher_id: Voucher UUID
            
        Returns:
            Number of entries reversed
        """
        try:
            # Get all entries for this voucher
            query = text("""
                SELECT id, account_id, entry_date, dr_amount, cr_amount, narration
                FROM ledger_entries
                WHERE voucher_id = :voucher_id
            """)
            entries = db.execute(query, {"voucher_id": voucher_id}).fetchall()
            
            if not entries:
                logger.warning(f"No ledger entries found for voucher {voucher_id}")
                return 0
            
            # Create reversing entries (swap dr and cr)
            for entry in entries:
                reverse_query = text("""
                    INSERT INTO ledger_entries (
                        id, company_id, voucher_id, account_id, entry_date,
                        dr_amount, cr_amount, narration, created_at
                    )
                    SELECT 
                        :new_id, company_id, voucher_id, account_id, entry_date,
                        cr_amount, dr_amount, 
                        'REVERSAL: ' || narration,
                        NOW()
                    FROM ledger_entries
                    WHERE id = :entry_id
                """)
                db.execute(reverse_query, {
                    "new_id": str(uuid.uuid4()),
                    "entry_id": str(entry.id)
                })
            
            logger.info(f"Reversed {len(entries)} ledger entries for voucher {voucher_id}")
            return len(entries)
            
        except Exception as e:
            logger.error(f"Error reversing ledger entries for voucher {voucher_id}: {e}")
            raise
    
    def _create_ledger_entry(
        self,
        db: Session,
        company_id: str,
        voucher_id: str,
        account_id: str,
        entry_date: date,
        dr_amount: Decimal,
        cr_amount: Decimal,
        narration: Optional[str] = None,
        cost_centre_id: Optional[str] = None
    ) -> str:
        """Create a single ledger entry"""
        entry_id = str(uuid.uuid4())
        
        query = text("""
            INSERT INTO ledger_entries (
                id, company_id, voucher_id, account_id, entry_date,
                dr_amount, cr_amount, narration, cost_centre_id, created_at
            ) VALUES (
                :id, :company_id, :voucher_id, :account_id, :entry_date,
                :dr_amount, :cr_amount, :narration, :cost_centre_id, NOW()
            )
        """)
        
        db.execute(query, {
            "id": entry_id,
            "company_id": company_id,
            "voucher_id": voucher_id,
            "account_id": account_id,
            "entry_date": entry_date,
            "dr_amount": float(dr_amount),
            "cr_amount": float(cr_amount),
            "narration": narration,
            "cost_centre_id": cost_centre_id
        })
        
        return entry_id
    
    def _get_or_create_party_account(
        self,
        db: Session,
        company_id: str,
        party_id: str,
        account_type: str  # 'receivable' or 'payable'
    ) -> str:
        """Get or create account for a party"""
        # Check if party account exists
        query = text("""
            SELECT id FROM accounts
            WHERE company_id = :company_id
            AND party_id = :party_id
            AND deleted_at IS NULL
            LIMIT 1
        """)
        result = db.execute(query, {
            "company_id": company_id,
            "party_id": party_id
        }).fetchone()
        
        if result:
            return str(result.id)
        
        # Create new party account
        account_id = str(uuid.uuid4())
        
        # Get party name
        party_query = text("SELECT party_name FROM parties WHERE id = :party_id")
        party_result = db.execute(party_query, {"party_id": party_id}).fetchone()
        party_name = party_result.party_name if party_result else "Unknown Party"
        
        # Get appropriate group
        nature = 'assets' if account_type == 'receivable' else 'liabilities'
        group_query = text("""
            SELECT id FROM account_groups
            WHERE company_id = :company_id
            AND nature = :nature
            AND is_system = TRUE
            LIMIT 1
        """)
        group_result = db.execute(group_query, {
            "company_id": company_id,
            "nature": nature
        }).fetchone()
        
        if not group_result:
            raise ValueError(f"No system account group found for {nature}")
        
        # Create account
        create_query = text("""
            INSERT INTO accounts (
                id, company_id, group_id, account_code, account_name,
                nature, is_system, is_active, party_id, created_at, updated_at
            ) VALUES (
                :id, :company_id, :group_id, :account_code, :account_name,
                :nature, FALSE, TRUE, :party_id, NOW(), NOW()
            )
        """)
        
        db.execute(create_query, {
            "id": account_id,
            "company_id": company_id,
            "group_id": str(group_result.id),
            "account_code": f"PARTY-{party_id[:8]}",
            "account_name": party_name,
            "nature": nature,
            "party_id": party_id
        })
        
        return account_id
    
    def _get_system_account(
        self,
        db: Session,
        company_id: str,
        account_key: str
    ) -> str:
        """Get system account ID by key"""
        # Map account keys to account names
        account_names = {
            'sales_revenue': 'Sales Revenue',
            'purchase': 'Purchase',
            'cgst_output': 'CGST Output',
            'sgst_output': 'SGST Output',
            'igst_output': 'IGST Output',
            'cess_output': 'Cess Output',
            'cgst_input': 'CGST Input',
            'sgst_input': 'SGST Input',
            'igst_input': 'IGST Input',
            'cess_input': 'Cess Input',
            'round_off': 'Round Off'
        }
        
        account_name = account_names.get(account_key)
        if not account_name:
            raise ValueError(f"Unknown account key: {account_key}")
        
        query = text("""
            SELECT id FROM accounts
            WHERE company_id = :company_id
            AND account_name = :account_name
            AND is_system = TRUE
            AND deleted_at IS NULL
            LIMIT 1
        """)
        
        result = db.execute(query, {
            "company_id": company_id,
            "account_name": account_name
        }).fetchone()
        
        if not result:
            raise ValueError(f"System account '{account_name}' not found for company {company_id}")
        
        return str(result.id)
    
    def _validate_balanced_entries(
        self,
        db: Session,
        voucher_id: str
    ) -> bool:
        """Validate that ledger entries for a voucher are balanced"""
        query = text("""
            SELECT 
                SUM(dr_amount) as total_dr,
                SUM(cr_amount) as total_cr
            FROM ledger_entries
            WHERE voucher_id = :voucher_id
        """)
        
        result = db.execute(query, {"voucher_id": voucher_id}).fetchone()
        
        total_dr = Decimal(str(result.total_dr or 0))
        total_cr = Decimal(str(result.total_cr or 0))
        
        if abs(total_dr - total_cr) > Decimal('0.01'):
            raise ValueError(
                f"Ledger entries not balanced for voucher {voucher_id}: "
                f"DR={total_dr}, CR={total_cr}"
            )
        
        return True


# Singleton instance
ledger_service = LedgerPostingService()
