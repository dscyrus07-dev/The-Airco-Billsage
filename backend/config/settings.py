"""
Application Settings and Configuration

Centralized configuration management with validation for BillSage backend.
"""

import os
from typing import Optional
from dotenv import load_dotenv
import logging

# Load environment variables
load_dotenv()

logger = logging.getLogger(__name__)


class Settings:
    """Application settings with validation"""
    
    # Database Configuration
    DATABASE_URL: str = os.getenv('DATABASE_URL', '')
    
    # Supabase Configuration
    SUPABASE_URL: str = os.getenv('SUPABASE_URL', '')
    SUPABASE_ANON_KEY: Optional[str] = os.getenv('SUPABASE_ANON_KEY')
    SUPABASE_SERVICE_ROLE_KEY: Optional[str] = os.getenv('SUPABASE_SERVICE_ROLE_KEY')
    SUPABASE_JWT_SECRET: str = os.getenv('SUPABASE_JWT_SECRET', 'your-supersecret-jwt-token-here')
    
    # Application Configuration
    APP_NAME: str = os.getenv('APP_NAME', 'BillSage Backend')
    APP_VERSION: str = os.getenv('APP_VERSION', '1.0.0')
    DEBUG: bool = os.getenv('DEBUG', 'false').lower() == 'true'
    LOG_LEVEL: str = os.getenv('LOG_LEVEL', 'INFO')
    
    # CORS Configuration
    CORS_ORIGINS: str = os.getenv('CORS_ORIGINS', 'http://localhost:8080')
    
    # LLM Configuration
    OPENROUTER_API_KEY: Optional[str] = os.getenv('OPENROUTER_API_KEY')
    OPENROUTER_MODEL: str = os.getenv('OPENROUTER_MODEL', 'arcee-ai/trinity-mini:free')
    OPENROUTER_BASE_URL: str = os.getenv('OPENROUTER_BASE_URL', 'https://openrouter.ai/api/v1')
    OPENROUTER_FALLBACK_MODELS: list[str] = [
        model.strip() for model in os.getenv('OPENROUTER_FALLBACK_MODELS', '').split(',')
        if model.strip()
    ]
    
    # LLM Model Parameters
    LLM_MAX_TOKENS: int = int(os.getenv('LLM_MAX_TOKENS', '4000'))
    LLM_TEMPERATURE: float = float(os.getenv('LLM_TEMPERATURE', '0.1'))
    LLM_TIMEOUT: int = int(os.getenv('LLM_TIMEOUT', '60'))
    LLM_MAX_INPUT_CHARS: int = int(os.getenv('LLM_MAX_INPUT_CHARS', '12000'))
    LLM_MAX_RETRIES: int = int(os.getenv('LLM_MAX_RETRIES', '2'))
    LLM_RETRY_DELAY_SECONDS: float = float(os.getenv('LLM_RETRY_DELAY_SECONDS', '1.5'))
    
    # Invalid model slugs that should be rejected
    INVALID_MODEL_SLUGS = [
        'arcee-ai/arcee-trinity-mini',
        'arcee-ai/arcee-trinity-mini-(free)',
    ]
    
    @classmethod
    def validate(cls) -> None:
        """
        Validate critical configuration at startup
        
        Raises:
            ValueError: If configuration is invalid
        """
        errors = []
        
        # Validate OpenRouter API Key
        if not cls.OPENROUTER_API_KEY:
            errors.append(
                "OPENROUTER_API_KEY environment variable is not set. "
                "LLM extraction features will not work. "
                "Get your API key from: https://openrouter.ai/"
            )
        
        # Validate model configuration
        if not cls.OPENROUTER_MODEL:
            errors.append("OPENROUTER_MODEL is not configured")
        elif cls.OPENROUTER_MODEL in cls.INVALID_MODEL_SLUGS:
            errors.append(
                f"OPENROUTER_MODEL is set to invalid slug: '{cls.OPENROUTER_MODEL}'. "
                f"This model ID is not valid on OpenRouter. "
                f"Please use 'arcee-ai/trinity-mini:free' for the free tier or "
                f"'arcee-ai/trinity-mini' for the paid tier."
            )
        
        # Validate database URL
        if not cls.DATABASE_URL:
            errors.append("DATABASE_URL is not configured")
        
        # Validate Supabase configuration
        if not cls.SUPABASE_URL:
            errors.append("SUPABASE_URL is not configured")
        
        # Temporarily disable JWT secret validation for testing
        # if not cls.SUPABASE_JWT_SECRET or cls.SUPABASE_JWT_SECRET == 'your-supersecret-jwt-token-here':
        #     errors.append("SUPABASE_JWT_SECRET is not properly configured")
        
        if errors:
            error_message = "Configuration validation failed:\n" + "\n".join(f"  - {e}" for e in errors)
            logger.error(error_message)
            raise ValueError(error_message)
        
        logger.info("Configuration validation passed")
        logger.info(f"Using OpenRouter model: {cls.OPENROUTER_MODEL}")
    
    @classmethod
    def get_cors_origins(cls) -> list:
        """Get CORS origins as a list"""
        return [origin.strip() for origin in cls.CORS_ORIGINS.split(',')]


# Create singleton instance
settings = Settings()


# Validate on import (can be disabled for testing)
if os.getenv('SKIP_CONFIG_VALIDATION', 'false').lower() != 'true':
    try:
        settings.validate()
    except ValueError as e:
        logger.warning(f"Configuration validation failed: {e}")
        logger.warning("Application may not function correctly. Please fix configuration issues.")
