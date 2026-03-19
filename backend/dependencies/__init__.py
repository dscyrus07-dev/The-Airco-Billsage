"""
Dependencies Package

FastAPI dependencies for authentication, authorization, and common utilities.
"""

from .auth import get_current_user, get_current_company_id, require_role, CurrentUser

__all__ = [
    'get_current_user',
    'get_current_company_id',
    'require_role',
    'CurrentUser'
]
