"""
Supabase Authentication Utilities

Handles JWT verification and user extraction from Supabase auth tokens.
"""

import jwt
from jwt import PyJWKClient
import logging
from typing import Optional, Dict, Any
from fastapi import HTTPException, status
from config.settings import settings

logger = logging.getLogger(__name__)

class SupabaseAuth:
    """Supabase JWT verification and user extraction"""
    
    def __init__(self):
        self.jwt_secret = settings.SUPABASE_JWT_SECRET
        self.supabase_url = settings.SUPABASE_URL
        # JWKS endpoint for Supabase (used for ES256 verification)
        self.jwks_client = PyJWKClient(f"{self.supabase_url}/auth/v1/.well-known/jwks.json")
    
    def verify_jwt(self, token: str) -> Dict[str, Any]:
        """
        Verify and decode Supabase JWT token
        
        Args:
            token: JWT token from Authorization header
            
        Returns:
            Decoded token payload
            
        Raises:
            HTTPException: If token is invalid or expired
        """
        try:
            # Remove Bearer prefix if present
            if token.startswith('Bearer '):
                token = token[7:]
            
            # Try ES256 verification via Supabase JWKS first
            try:
                signing_key = self.jwks_client.get_signing_key_from_jwt(token).key
                payload = jwt.decode(
                    token,
                    signing_key,
                    algorithms=['ES256'],
                    options={
                        'verify_signature': True,
                        'verify_aud': False,
                        'verify_iss': True,
                        'verify_exp': True,
                        'verify_iat': True,
                    },
                    issuer=f'{self.supabase_url}/auth/v1'
                )
            except Exception as es256_error:
                logger.warning(f"ES256 verification failed, trying HS256 fallback: {es256_error}")
                # Fallback to legacy HS256 using shared secret (service role key)
                payload = jwt.decode(
                    token,
                    self.jwt_secret,
                    algorithms=['HS256'],
                    options={
                        'verify_signature': True,
                        'verify_aud': False,
                        'verify_iss': True,
                        'verify_exp': True,
                        'verify_iat': True,
                    },
                    issuer=f'{self.supabase_url}/auth/v1'
                )
            
            logger.info(f"JWT verified for user: {payload.get('sub')}")
            return payload
            
        except jwt.ExpiredSignatureError:
            logger.warning("JWT token has expired")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Token has expired"
            )
        except jwt.InvalidTokenError as e:
            logger.warning(f"Invalid JWT token: {e}")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token"
            )
        except Exception as e:
            logger.error(f"JWT verification error: {e}")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Authentication failed"
            )
    
    def extract_user_id(self, token: str) -> str:
        """
        Extract user ID from JWT token
        
        Args:
            token: JWT token
            
        Returns:
            User ID string
            
        Raises:
            HTTPException: If token is invalid or user ID not found
        """
        payload = self.verify_jwt(token)
        user_id = payload.get('sub')
        
        if not user_id:
            logger.error("User ID not found in JWT payload")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token: missing user ID"
            )
        
        return user_id
    
    def extract_user_email(self, token: str) -> Optional[str]:
        """
        Extract user email from JWT token
        
        Args:
            token: JWT token
            
        Returns:
            User email or None if not found
        """
        try:
            payload = self.verify_jwt(token)
            return payload.get('email')
        except HTTPException:
            return None

# Global instance
supabase_auth = SupabaseAuth()
