"""
GST Calculation Service

Provides server-side GST calculation engine for accurate tax computation
following Indian GST rules.
"""

from decimal import Decimal, ROUND_HALF_UP
from typing import Dict, Optional, List
from dataclasses import dataclass


@dataclass
class GSTCalculationResult:
    """Result of GST calculation"""
    taxable_amount: Decimal
    cgst_rate: Decimal
    cgst_amount: Decimal
    sgst_rate: Decimal
    sgst_amount: Decimal
    igst_rate: Decimal
    igst_amount: Decimal
    cess_rate: Decimal
    cess_amount: Decimal
    total_tax: Decimal
    total_amount: Decimal


class GSTCalculationService:
    """GST calculation engine with business rules"""
    
    # Valid GST rates in India
    VALID_GST_RATES = [Decimal('0'), Decimal('0.25'), Decimal('3'), Decimal('5'), 
                       Decimal('12'), Decimal('18'), Decimal('28')]
    
    def __init__(self):
        pass
    
    def calculate_line_item_gst(
        self,
        quantity: Decimal,
        rate: Decimal,
        discount_pct: Decimal,
        gst_rate: Decimal,
        is_interstate: bool,
        cess_rate: Decimal = Decimal('0'),
        reverse_charge: bool = False
    ) -> GSTCalculationResult:
        """
        Calculate GST for a single line item
        
        Args:
            quantity: Item quantity
            rate: Item rate per unit
            discount_pct: Discount percentage (0-100)
            gst_rate: Total GST rate (e.g., 18 for 18%)
            is_interstate: True for IGST, False for CGST+SGST
            cess_rate: Cess rate if applicable
            reverse_charge: Whether reverse charge applies
            
        Returns:
            GSTCalculationResult with all calculated values
        """
        # Validate inputs
        if quantity <= 0:
            raise ValueError("Quantity must be greater than 0")
        if rate < 0:
            raise ValueError("Rate cannot be negative")
        if discount_pct < 0 or discount_pct > 100:
            raise ValueError("Discount percentage must be between 0 and 100")
        if gst_rate not in self.VALID_GST_RATES:
            raise ValueError(f"Invalid GST rate: {gst_rate}. Must be one of {self.VALID_GST_RATES}")
        
        # Calculate gross amount
        gross_amount = self._round(quantity * rate)
        
        # Calculate discount amount
        discount_amount = self._round(gross_amount * discount_pct / Decimal('100'))
        
        # Calculate taxable amount
        taxable_amount = gross_amount - discount_amount
        
        # Calculate GST amounts
        if is_interstate:
            # Interstate: IGST only
            cgst_rate = Decimal('0')
            sgst_rate = Decimal('0')
            igst_rate = gst_rate
            
            cgst_amount = Decimal('0')
            sgst_amount = Decimal('0')
            igst_amount = self._round(taxable_amount * igst_rate / Decimal('100'))
        else:
            # Intrastate: CGST + SGST (equal split)
            cgst_rate = gst_rate / Decimal('2')
            sgst_rate = gst_rate / Decimal('2')
            igst_rate = Decimal('0')
            
            cgst_amount = self._round(taxable_amount * cgst_rate / Decimal('100'))
            sgst_amount = self._round(taxable_amount * sgst_rate / Decimal('100'))
            igst_amount = Decimal('0')
        
        # Calculate cess if applicable
        cess_amount = self._round(taxable_amount * cess_rate / Decimal('100')) if cess_rate > 0 else Decimal('0')
        
        # Calculate total tax and total amount
        total_tax = cgst_amount + sgst_amount + igst_amount + cess_amount
        total_amount = taxable_amount + total_tax
        
        return GSTCalculationResult(
            taxable_amount=taxable_amount,
            cgst_rate=cgst_rate,
            cgst_amount=cgst_amount,
            sgst_rate=sgst_rate,
            sgst_amount=sgst_amount,
            igst_rate=igst_rate,
            igst_amount=igst_amount,
            cess_rate=cess_rate,
            cess_amount=cess_amount,
            total_tax=total_tax,
            total_amount=total_amount
        )
    
    def calculate_voucher_totals(
        self,
        line_items: List[Dict],
        is_interstate: bool
    ) -> Dict[str, Decimal]:
        """
        Calculate voucher-level totals from line items
        
        Args:
            line_items: List of line item dictionaries with calculated values
            is_interstate: Whether this is an interstate transaction
            
        Returns:
            Dictionary with voucher totals
        """
        subtotal = Decimal('0')
        discount_amount = Decimal('0')
        taxable_amount = Decimal('0')
        cgst_amount = Decimal('0')
        sgst_amount = Decimal('0')
        igst_amount = Decimal('0')
        cess_amount = Decimal('0')
        
        for item in line_items:
            # Sum up all amounts
            subtotal += Decimal(str(item.get('quantity', 0))) * Decimal(str(item.get('rate', 0)))
            discount_amount += Decimal(str(item.get('discount_amount', 0)))
            taxable_amount += Decimal(str(item.get('taxable_amount', 0)))
            cgst_amount += Decimal(str(item.get('cgst_amount', 0)))
            sgst_amount += Decimal(str(item.get('sgst_amount', 0)))
            igst_amount += Decimal(str(item.get('igst_amount', 0)))
            cess_amount += Decimal(str(item.get('cess_amount', 0)))
        
        total_tax = cgst_amount + sgst_amount + igst_amount + cess_amount
        total_before_rounding = taxable_amount + total_tax
        
        # Calculate round-off to nearest rupee
        rounded_total = total_before_rounding.quantize(Decimal('1'), rounding=ROUND_HALF_UP)
        round_off = rounded_total - total_before_rounding
        
        return {
            'subtotal': self._round(subtotal),
            'discount_amount': self._round(discount_amount),
            'taxable_amount': self._round(taxable_amount),
            'cgst_amount': self._round(cgst_amount),
            'sgst_amount': self._round(sgst_amount),
            'igst_amount': self._round(igst_amount),
            'cess_amount': self._round(cess_amount),
            'total_tax': self._round(total_tax),
            'round_off': round_off,
            'total_amount': rounded_total
        }
    
    def validate_gst_calculation(
        self,
        submitted_totals: Dict,
        calculated_totals: Dict,
        tolerance: Decimal = Decimal('0.01')
    ) -> bool:
        """
        Validate that submitted totals match calculated totals
        
        Args:
            submitted_totals: Totals submitted by client
            calculated_totals: Server-calculated totals
            tolerance: Acceptable difference (default 0.01 for rounding)
            
        Returns:
            True if totals match within tolerance
            
        Raises:
            ValueError: If totals don't match
        """
        fields_to_check = [
            'taxable_amount', 'cgst_amount', 'sgst_amount', 
            'igst_amount', 'cess_amount', 'total_amount'
        ]
        
        mismatches = []
        for field in fields_to_check:
            submitted = Decimal(str(submitted_totals.get(field, 0)))
            calculated = Decimal(str(calculated_totals.get(field, 0)))
            diff = abs(submitted - calculated)
            
            if diff > tolerance:
                mismatches.append(
                    f"{field}: submitted={submitted}, calculated={calculated}, diff={diff}"
                )
        
        if mismatches:
            raise ValueError(
                f"GST calculation mismatch: {'; '.join(mismatches)}"
            )
        
        return True
    
    def determine_supply_type(
        self,
        party_gstin: Optional[str],
        company_gstin: Optional[str],
        party_state: Optional[str],
        company_state: Optional[str]
    ) -> tuple[bool, str]:
        """
        Determine if transaction is interstate and supply type
        
        Args:
            party_gstin: Customer/Supplier GSTIN
            company_gstin: Company GSTIN
            party_state: Customer/Supplier state
            company_state: Company state
            
        Returns:
            Tuple of (is_interstate, supply_type)
        """
        # If no GSTIN, it's B2C
        if not party_gstin:
            supply_type = 'B2C'
        else:
            supply_type = 'B2B'
        
        # Determine interstate based on state codes in GSTIN or state names
        is_interstate = False
        
        if party_gstin and company_gstin:
            # Extract state codes from GSTIN (first 2 digits)
            party_state_code = party_gstin[:2]
            company_state_code = company_gstin[:2]
            is_interstate = party_state_code != company_state_code
        elif party_state and company_state:
            # Fallback to state name comparison
            is_interstate = party_state.lower() != company_state.lower()
        
        return is_interstate, supply_type
    
    def _round(self, value: Decimal, places: int = 2) -> Decimal:
        """Round decimal to specified places"""
        quantize_str = '0.' + '0' * places
        return value.quantize(Decimal(quantize_str), rounding=ROUND_HALF_UP)


# Singleton instance
gst_service = GSTCalculationService()
