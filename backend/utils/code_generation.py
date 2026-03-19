"""
Business Code Generation Utilities

Functions to generate business-facing codes like company_code, party_code, etc.
"""

import random
import string
from typing import Optional
from datetime import datetime
import logging

logger = logging.getLogger(__name__)

def generate_company_code(legal_name: Optional[str] = None) -> str:
    """
    Generate a unique company code
    
    Args:
        legal_name: Optional legal name to base the code on
        
    Returns:
        Unique company code (uppercase, 2-30 characters)
    """
    try:
        if legal_name and legal_name.strip():
            # Extract first few characters from legal name
            name_parts = legal_name.strip().split()
            base_code = ""
            
            # Take first 2 letters from first word, or first letter from first 2 words
            if len(name_parts) >= 2:
                base_code = (name_parts[0][:2] + name_parts[1][:2]).upper()
            else:
                base_code = name_parts[0][:4].upper()
            
            # Remove non-alphanumeric characters
            base_code = ''.join(c for c in base_code if c.isalnum())
            
            # Ensure minimum length of 2
            if len(base_code) < 2:
                base_code = "BS"  # Default to BillSage
        else:
            base_code = "BS"  # Default to BillSage
        
        # Add random suffix to ensure uniqueness
        random_suffix = ''.join(random.choices(string.digits, k=4))
        company_code = f"{base_code}{random_suffix}"
        
        # Ensure it's within valid length (2-30 characters)
        if len(company_code) > 30:
            company_code = company_code[:30]
        
        logger.info(f"Generated company code: {company_code}")
        return company_code
        
    except Exception as e:
        logger.error(f"Error generating company code: {e}")
        # Fallback to simple random code
        return f"BS{''.join(random.choices(string.digits, k=6))}"

def generate_party_code(name: Optional[str] = None) -> str:
    """
    Generate a unique party code for customers/vendors
    
    Args:
        name: Optional party name to base the code on
        
    Returns:
        Unique party code
    """
    try:
        if name and name.strip():
            # Extract first few characters from name
            name_parts = name.strip().split()
            base_code = ""
            
            if len(name_parts) >= 2:
                base_code = (name_parts[0][:2] + name_parts[1][:2]).upper()
            else:
                base_code = name_parts[0][:4].upper()
            
            # Remove non-alphanumeric characters
            base_code = ''.join(c for c in base_code if c.isalnum())
            
            if len(base_code) < 2:
                base_code = "PT"
        else:
            base_code = "PT"
        
        # Add random suffix
        random_suffix = ''.join(random.choices(string.digits, k=3))
        party_code = f"{base_code}{random_suffix}"
        
        return party_code
        
    except Exception as e:
        logger.error(f"Error generating party code: {e}")
        return f"PT{''.join(random.choices(string.digits, k=5))}"

def generate_product_code(name: Optional[str] = None) -> str:
    """
    Generate a unique product code
    
    Args:
        name: Optional product name to base the code on
        
    Returns:
        Unique product code
    """
    try:
        if name and name.strip():
            # Extract first few characters from name
            name_parts = name.strip().split()
            base_code = ""
            
            if len(name_parts) >= 2:
                base_code = (name_parts[0][:2] + name_parts[1][:2]).upper()
            else:
                base_code = name_parts[0][:4].upper()
            
            # Remove non-alphanumeric characters
            base_code = ''.join(c for c in base_code if c.isalnum())
            
            if len(base_code) < 2:
                base_code = "PR"
        else:
            base_code = "PR"
        
        # Add random suffix
        random_suffix = ''.join(random.choices(string.digits, k=3))
        product_code = f"{base_code}{random_suffix}"
        
        return product_code
        
    except Exception as e:
        logger.error(f"Error generating product code: {e}")
        return f"PR{''.join(random.choices(string.digits, k=5))}"

def generate_invoice_number(prefix: str = "INV", sequence: Optional[int] = None) -> str:
    """
    Generate an invoice number
    
    Args:
        prefix: Invoice prefix (e.g., "INV", "CN", "DN")
        sequence: Optional sequence number
        
    Returns:
        Invoice number
    """
    try:
        if sequence is None:
            # Generate random sequence for now (in production, this should be from database)
            sequence = random.randint(1000, 9999)
        
        # Add current year for better uniqueness
        year_suffix = str(datetime.now().year)[-2:]
        
        return f"{prefix}-{year_suffix}-{sequence:04d}"
        
    except Exception as e:
        logger.error(f"Error generating invoice number: {e}")
        return f"{prefix}-00001"
