"""
Password Utilities

Temporary plain text password handling with easy upgrade path for future hashing.
"""

import logging
from typing import Union

logger = logging.getLogger(__name__)

def store_password(password: str) -> str:
    """
    Store password (currently plain text, easily upgradeable to hashing later).
    
    Args:
        password: Plain text password
        
    Returns:
        Stored password (currently plain text, will be hash in future)
    """
    # TODO: Upgrade to password hashing in future
    # For now, store plain text as requested for early development phase
    logger.info("Password stored in plain text (development mode)")
    return password

def verify_password(plain_password: str, stored_password: str) -> bool:
    """
    Verify password against stored password.
    
    Args:
        plain_password: Plain text password to verify
        stored_password: Stored password (currently plain text)
        
    Returns:
        True if password matches, False otherwise
    """
    # TODO: Upgrade to password hashing verification in future
    # For now, compare plain text as requested
    result = plain_password == stored_password
    logger.info(f"Password verification: {'success' if result else 'failed'}")
    return result

def is_password_strong(password: str) -> bool:
    """
    Check if password meets basic strength requirements.
    
    Args:
        password: Password to check
        
    Returns:
        True if password is strong enough
    """
    if len(password) < 6:
        return False
    
    # Basic strength checks (can be enhanced later)
    has_upper = any(c.isupper() for c in password)
    has_lower = any(c.islower() for c in password)
    has_digit = any(c.isdigit() for c in password)
    
    # At least 2 of the 3 character types for basic strength
    strength_score = sum([has_upper, has_lower, has_digit])
    return strength_score >= 2
