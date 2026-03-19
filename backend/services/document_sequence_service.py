"""
Document Sequence Service

Handles automatic document numbering using document_sequences table.
Provides thread-safe sequence generation for invoices, credit notes, etc.
"""

from sqlalchemy.orm import Session
from sqlalchemy import text
from typing import Optional
import logging

logger = logging.getLogger(__name__)


class DocumentSequenceService:
    """Service for generating sequential document numbers"""
    
    def __init__(self):
        pass
    
    def get_next_number(
        self,
        db: Session,
        company_id: str,
        fy_id: str,
        doc_type: str
    ) -> str:
        """
        Get next document number for the given type and financial year
        
        Uses atomic increment to prevent race conditions.
        Creates sequence if it doesn't exist.
        
        Args:
            db: Database session
            company_id: Company UUID
            fy_id: Financial year UUID
            doc_type: Document type (invoice, credit_note, purchase, etc.)
            
        Returns:
            Formatted document number (e.g., "INV-2024-00001")
        """
        try:
            # Try to get existing sequence
            query = text("""
                SELECT id, prefix, suffix, current_number, padding_length
                FROM document_sequences
                WHERE company_id = :company_id
                AND fy_id = :fy_id
                AND doc_type = :doc_type
                FOR UPDATE
            """)
            
            result = db.execute(query, {
                "company_id": company_id,
                "fy_id": fy_id,
                "doc_type": doc_type
            }).fetchone()
            
            if result:
                # Increment existing sequence
                new_number = result.current_number + 1
                
                update_query = text("""
                    UPDATE document_sequences
                    SET current_number = :new_number,
                        updated_at = NOW()
                    WHERE id = :sequence_id
                """)
                
                db.execute(update_query, {
                    "new_number": new_number,
                    "sequence_id": str(result.id)
                })
                
                # Format number
                formatted_number = self._format_number(
                    prefix=result.prefix,
                    number=new_number,
                    padding_length=result.padding_length,
                    suffix=result.suffix
                )
                
                logger.info(f"Generated document number: {formatted_number}")
                return formatted_number
            else:
                # Create new sequence
                return self._create_sequence(db, company_id, fy_id, doc_type)
                
        except Exception as e:
            logger.error(f"Error generating document number: {e}")
            raise
    
    def _create_sequence(
        self,
        db: Session,
        company_id: str,
        fy_id: str,
        doc_type: str
    ) -> str:
        """Create a new document sequence"""
        import uuid
        
        # Get prefix from company settings or use default
        prefix = self._get_default_prefix(db, company_id, doc_type)
        
        # Get FY label for suffix
        fy_query = text("SELECT fy_label FROM financial_years WHERE id = :fy_id")
        fy_result = db.execute(fy_query, {"fy_id": fy_id}).fetchone()
        fy_label = fy_result.fy_label if fy_result else ""
        
        sequence_id = str(uuid.uuid4())
        current_number = 1
        padding_length = 5
        
        insert_query = text("""
            INSERT INTO document_sequences (
                id, company_id, fy_id, doc_type, prefix, suffix,
                current_number, padding_length, created_at, updated_at
            ) VALUES (
                :id, :company_id, :fy_id, :doc_type, :prefix, :suffix,
                :current_number, :padding_length, NOW(), NOW()
            )
        """)
        
        db.execute(insert_query, {
            "id": sequence_id,
            "company_id": company_id,
            "fy_id": fy_id,
            "doc_type": doc_type,
            "prefix": prefix,
            "suffix": fy_label,
            "current_number": current_number,
            "padding_length": padding_length
        })
        
        formatted_number = self._format_number(
            prefix=prefix,
            number=current_number,
            padding_length=padding_length,
            suffix=fy_label
        )
        
        logger.info(f"Created new sequence and generated: {formatted_number}")
        return formatted_number
    
    def _get_default_prefix(
        self,
        db: Session,
        company_id: str,
        doc_type: str
    ) -> str:
        """Get default prefix from company settings or use standard prefix"""
        # Map doc types to company_details fields
        prefix_map = {
            'invoice': 'invoice_prefix',
            'credit_note': 'credit_note_prefix',
            'debit_note': 'debit_note_prefix',
            'payment': 'payment_prefix',
            'receipt': 'receipt_prefix',
            'purchase': 'po_prefix'
        }
        
        field_name = prefix_map.get(doc_type)
        
        if field_name:
            query = text(f"""
                SELECT {field_name}
                FROM company_details
                WHERE company_id = :company_id
            """)
            
            result = db.execute(query, {"company_id": company_id}).fetchone()
            if result and result[0]:
                return result[0]
        
        # Default prefixes
        default_prefixes = {
            'invoice': 'INV',
            'sale': 'INV',
            'credit_note': 'CN',
            'debit_note': 'DN',
            'payment': 'PAY',
            'receipt': 'REC',
            'purchase': 'PO',
            'journal': 'JV'
        }
        
        return default_prefixes.get(doc_type, 'DOC')
    
    def _format_number(
        self,
        prefix: str,
        number: int,
        padding_length: int,
        suffix: Optional[str] = None
    ) -> str:
        """Format document number with prefix, padded number, and optional suffix"""
        padded_number = str(number).zfill(padding_length)
        
        if suffix:
            return f"{prefix}-{suffix}-{padded_number}"
        else:
            return f"{prefix}-{padded_number}"


# Singleton instance
document_sequence_service = DocumentSequenceService()
