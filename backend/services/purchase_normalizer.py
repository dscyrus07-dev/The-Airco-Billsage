"""
Purchase Data Normalization Service for BillSage

Normalizes and validates extracted purchase data from LLM output.
Ensures data conforms to BillSage purchase schema and business rules.
"""

import logging
import re
from typing import Dict, Any, List, Optional, Tuple
from datetime import datetime, date
from decimal import Decimal, InvalidOperation

try:
    from dateutil import parser as date_parser
except ImportError:
    raise ImportError("python-dateutil not installed. Run: pip install python-dateutil")

logger = logging.getLogger(__name__)


class PurchaseNormalizer:
    """Service for normalizing extracted purchase data"""
    
    def __init__(self):
        """Initialize normalizer"""
        self.warnings = []
        self.errors = []
    
    def normalize_gstin(self, gstin: Optional[str]) -> Optional[str]:
        """
        Normalize and validate GSTIN
        
        Args:
            gstin: Raw GSTIN string
            
        Returns:
            Normalized GSTIN or None if invalid
        """
        if not gstin:
            return None
        
        # Remove spaces and convert to uppercase
        gstin = gstin.strip().replace(' ', '').upper()
        
        # GSTIN format: 2 digits (state) + 10 chars (PAN) + 1 digit + 1 char + 1 char
        gstin_pattern = r'^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$'
        
        if re.match(gstin_pattern, gstin) and len(gstin) == 15:
            return gstin
        else:
            self.warnings.append(f"Invalid GSTIN format: {gstin}")
            return None
    
    def normalize_pan(self, pan: Optional[str]) -> Optional[str]:
        """
        Normalize and validate PAN
        
        Args:
            pan: Raw PAN string
            
        Returns:
            Normalized PAN or None if invalid
        """
        if not pan:
            return None
        
        # Remove spaces and convert to uppercase
        pan = pan.strip().replace(' ', '').upper()
        
        # PAN format: 5 letters + 4 digits + 1 letter
        pan_pattern = r'^[A-Z]{5}[0-9]{4}[A-Z]{1}$'
        
        if re.match(pan_pattern, pan) and len(pan) == 10:
            return pan
        else:
            self.warnings.append(f"Invalid PAN format: {pan}")
            return None
    
    def normalize_date(self, date_str: Optional[str]) -> Optional[str]:
        """
        Normalize date to YYYY-MM-DD format
        
        Args:
            date_str: Raw date string
            
        Returns:
            Normalized date string or None if invalid
        """
        if not date_str:
            return None
        
        try:
            # Parse date using dateutil
            parsed_date = date_parser.parse(str(date_str), dayfirst=True)
            return parsed_date.strftime('%Y-%m-%d')
        except (ValueError, TypeError) as e:
            self.warnings.append(f"Invalid date format: {date_str}")
            return None
    
    def normalize_decimal(
        self, 
        value: Any, 
        field_name: str = "value",
        allow_negative: bool = False
    ) -> Decimal:
        """
        Normalize numeric value to Decimal
        
        Args:
            value: Raw numeric value
            field_name: Field name for error messages
            allow_negative: Whether to allow negative values
            
        Returns:
            Decimal value
        """
        if value is None:
            return Decimal('0')
        
        try:
            # Convert to string and remove currency symbols
            str_value = str(value).strip()
            str_value = re.sub(r'[₹$,\s]', '', str_value)
            
            # Convert to Decimal
            decimal_value = Decimal(str_value)
            
            # Check for negative values
            if not allow_negative and decimal_value < 0:
                self.warnings.append(f"{field_name} is negative: {decimal_value}")
                return Decimal('0')
            
            return decimal_value
            
        except (InvalidOperation, ValueError) as e:
            self.warnings.append(f"Invalid numeric value for {field_name}: {value}")
            return Decimal('0')
    
    def normalize_phone(self, phone: Optional[str]) -> Optional[str]:
        """
        Normalize phone number
        
        Args:
            phone: Raw phone string
            
        Returns:
            Normalized phone or None
        """
        if not phone:
            return None
        
        # Remove all non-digit characters
        digits = re.sub(r'\D', '', phone)
        
        # Indian phone numbers are 10 digits (mobile) or with country code
        if len(digits) == 10:
            return digits
        elif len(digits) == 12 and digits.startswith('91'):
            return digits[2:]  # Remove country code
        else:
            return digits if digits else None
    
    def normalize_email(self, email: Optional[str]) -> Optional[str]:
        """
        Normalize and validate email
        
        Args:
            email: Raw email string
            
        Returns:
            Normalized email or None if invalid
        """
        if not email:
            return None
        
        email = email.strip().lower()
        
        # Basic email validation
        email_pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
        
        if re.match(email_pattern, email):
            return email
        else:
            self.warnings.append(f"Invalid email format: {email}")
            return None
    
    def validate_totals(self, amounts: Dict[str, Any]) -> bool:
        """
        Validate that totals are internally consistent
        
        Args:
            amounts: Amounts dictionary
            
        Returns:
            True if valid, False otherwise
        """
        try:
            subtotal = self.normalize_decimal(amounts.get('subtotal', 0))
            discount = self.normalize_decimal(amounts.get('discount_amount', 0))
            taxable = self.normalize_decimal(amounts.get('taxable_amount', 0))
            cgst = self.normalize_decimal(amounts.get('cgst_amount', 0))
            sgst = self.normalize_decimal(amounts.get('sgst_amount', 0))
            igst = self.normalize_decimal(amounts.get('igst_amount', 0))
            cess = self.normalize_decimal(amounts.get('cess_amount', 0))
            tds = self.normalize_decimal(amounts.get('tds_amount', 0))
            round_off = self.normalize_decimal(amounts.get('round_off', 0), allow_negative=True)
            grand_total = self.normalize_decimal(amounts.get('grand_total', 0))
            
            # Calculate expected taxable amount
            expected_taxable = subtotal - discount
            
            # Calculate expected grand total
            expected_total = taxable + cgst + sgst + igst + cess - tds + round_off
            
            # Allow small rounding differences (1 rupee)
            taxable_diff = abs(taxable - expected_taxable)
            total_diff = abs(grand_total - expected_total)
            
            if taxable_diff > Decimal('1'):
                self.warnings.append(
                    f"Taxable amount mismatch: expected {expected_taxable}, got {taxable}"
                )
            
            if total_diff > Decimal('1'):
                self.warnings.append(
                    f"Grand total mismatch: expected {expected_total}, got {grand_total}"
                )
            
            # Check if CGST and SGST are used together (not with IGST)
            if (cgst > 0 or sgst > 0) and igst > 0:
                self.warnings.append(
                    "Both CGST/SGST and IGST are present (should be mutually exclusive)"
                )
            
            return True
            
        except Exception as e:
            self.errors.append(f"Error validating totals: {e}")
            return False
    
    def normalize_line_items(
        self, 
        line_items: List[Dict[str, Any]]
    ) -> List[Dict[str, Any]]:
        """
        Normalize line items
        
        Args:
            line_items: Raw line items list
            
        Returns:
            Normalized line items
        """
        normalized_items = []
        
        for idx, item in enumerate(line_items, start=1):
            try:
                normalized_item = {
                    'line_number': idx,
                    'description': str(item.get('description', '')).strip() or f'Item {idx}',
                    'hsn_sac_code': str(item.get('hsn_sac_code', '')).strip() or None,
                    'quantity': float(self.normalize_decimal(item.get('quantity', 1))),
                    'unit': str(item.get('unit', 'PCS')).strip().upper(),
                    'rate': float(self.normalize_decimal(item.get('rate', 0))),
                    'discount_pct': float(self.normalize_decimal(item.get('discount_pct', 0))),
                    'discount_amount': float(self.normalize_decimal(item.get('discount_amount', 0))),
                    'taxable_amount': float(self.normalize_decimal(item.get('taxable_amount', 0))),
                    'cgst_rate': float(self.normalize_decimal(item.get('cgst_rate', 0))),
                    'cgst_amount': float(self.normalize_decimal(item.get('cgst_amount', 0))),
                    'sgst_rate': float(self.normalize_decimal(item.get('sgst_rate', 0))),
                    'sgst_amount': float(self.normalize_decimal(item.get('sgst_amount', 0))),
                    'igst_rate': float(self.normalize_decimal(item.get('igst_rate', 0))),
                    'igst_amount': float(self.normalize_decimal(item.get('igst_amount', 0))),
                    'cess_rate': float(self.normalize_decimal(item.get('cess_rate', 0))),
                    'cess_amount': float(self.normalize_decimal(item.get('cess_amount', 0))),
                    'line_total': float(self.normalize_decimal(item.get('line_total', 0)))
                }
                
                normalized_items.append(normalized_item)
                
            except Exception as e:
                self.warnings.append(f"Error normalizing line item {idx}: {e}")
                continue
        
        return normalized_items
    
    def normalize_purchase_data(
        self, 
        extracted_data: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Normalize complete purchase data from LLM extraction
        
        Args:
            extracted_data: Raw extracted data from LLM
            
        Returns:
            Normalized purchase data ready for database insertion
        """
        # Reset warnings and errors
        self.warnings = []
        self.errors = []
        
        try:
            # Normalize supplier data
            supplier = extracted_data.get('supplier', {})
            normalized_supplier = {
                'name': str(supplier.get('name', '')).strip() or None,
                'gstin': self.normalize_gstin(supplier.get('gstin')),
                'pan': self.normalize_pan(supplier.get('pan')),
                'address': str(supplier.get('address', '')).strip() or None,
                'phone': self.normalize_phone(supplier.get('phone')),
                'email': self.normalize_email(supplier.get('email'))
            }
            
            # Normalize invoice data
            invoice = extracted_data.get('invoice', {})
            normalized_invoice = {
                'invoice_number': str(invoice.get('invoice_number', '')).strip() or None,
                'invoice_date': self.normalize_date(invoice.get('invoice_date')),
                'due_date': self.normalize_date(invoice.get('due_date')),
                'place_of_supply': str(invoice.get('place_of_supply', '')).strip() or None,
                'reverse_charge': bool(invoice.get('reverse_charge', False))
            }
            
            # Normalize amounts
            amounts = extracted_data.get('amounts', {})
            normalized_amounts = {
                'subtotal': float(self.normalize_decimal(amounts.get('subtotal', 0))),
                'discount_amount': float(self.normalize_decimal(amounts.get('discount_amount', 0))),
                'taxable_amount': float(self.normalize_decimal(amounts.get('taxable_amount', 0))),
                'cgst_amount': float(self.normalize_decimal(amounts.get('cgst_amount', 0))),
                'sgst_amount': float(self.normalize_decimal(amounts.get('sgst_amount', 0))),
                'igst_amount': float(self.normalize_decimal(amounts.get('igst_amount', 0))),
                'cess_amount': float(self.normalize_decimal(amounts.get('cess_amount', 0))),
                'tds_amount': float(self.normalize_decimal(amounts.get('tds_amount', 0))),
                'round_off': float(self.normalize_decimal(amounts.get('round_off', 0), allow_negative=True)),
                'grand_total': float(self.normalize_decimal(amounts.get('grand_total', 0)))
            }
            
            # Validate totals
            self.validate_totals(normalized_amounts)
            
            # Normalize line items
            line_items = extracted_data.get('line_items', [])
            normalized_line_items = self.normalize_line_items(line_items)
            
            # Normalize extra charges
            extra_charges = extracted_data.get('extra_charges', [])
            normalized_charges = []
            for charge in extra_charges:
                if charge.get('description') and charge.get('amount'):
                    normalized_charges.append({
                        'description': str(charge['description']).strip(),
                        'amount': float(self.normalize_decimal(charge['amount']))
                    })
            
            # Build normalized result
            normalized_data = {
                'supplier': normalized_supplier,
                'invoice': normalized_invoice,
                'amounts': normalized_amounts,
                'line_items': normalized_line_items,
                'extra_charges': normalized_charges,
                'notes': str(extracted_data.get('notes', '')).strip() or None,
                'payment_terms': str(extracted_data.get('payment_terms', '')).strip() or None
            }
            
            # Add validation metadata
            normalized_data['_validation'] = {
                'warnings': self.warnings,
                'errors': self.errors,
                'is_valid': len(self.errors) == 0,
                'has_warnings': len(self.warnings) > 0,
                'normalized_at': datetime.now().isoformat()
            }
            
            logger.info(
                f"Normalization complete: {len(self.warnings)} warnings, "
                f"{len(self.errors)} errors"
            )
            
            return normalized_data
            
        except Exception as e:
            logger.error(f"Normalization error: {e}")
            self.errors.append(f"Critical normalization error: {e}")
            raise


# Singleton instance
_normalizer_instance = None


def get_purchase_normalizer() -> PurchaseNormalizer:
    """
    Get singleton purchase normalizer instance
    
    Returns:
        PurchaseNormalizer instance
    """
    global _normalizer_instance
    
    if _normalizer_instance is None:
        _normalizer_instance = PurchaseNormalizer()
    
    return _normalizer_instance
