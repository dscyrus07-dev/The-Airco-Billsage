"""
Database Configuration Module for BillSage Backend

This module provides:
- Database connection management using SQLAlchemy
- Environment-based configuration loading
- Health check functionality
- Session management for database operations
"""

import os
import logging
from typing import Optional
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker, Session
from sqlalchemy.pool import QueuePool
from dotenv import load_dotenv

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class DatabaseConfig:
    """Database configuration and connection management"""
    
    def __init__(self):
        """Initialize database configuration from environment variables"""
        # Load environment variables
        load_dotenv()
        
        # Get database URL from environment
        self.database_url = os.getenv("DATABASE_URL")
        if not self.database_url:
            raise ValueError(
                "DATABASE_URL environment variable is not set. "
                "Please check your .env file."
            )
        
        # Additional configuration options
        self.app_name = os.getenv("APP_NAME", "BillSage Backend")
        self.debug = os.getenv("DEBUG", "false").lower() == "true"
        self.log_level = os.getenv("LOG_LEVEL", "INFO")
        
        # Initialize engine and session
        self._engine = None
        self._session_local = None
        
        logger.info(f"Database configuration initialized for {self.app_name}")
    
    def _create_engine(self):
        """Create SQLAlchemy engine with production-safe settings"""
        try:
            # Suppress SQLAlchemy logging for clean output
            logging.getLogger('sqlalchemy.engine').setLevel(logging.WARNING)
            logging.getLogger('sqlalchemy.pool').setLevel(logging.WARNING)
            logging.getLogger('sqlalchemy.dialects').setLevel(logging.WARNING)
            
            self._engine = create_engine(
                self.database_url,
                poolclass=QueuePool,
                pool_size=10,
                max_overflow=20,
                pool_pre_ping=True,
                pool_recycle=3600,
                echo=False  # Explicitly disable SQL echo
            )
            logger.info("SQLAlchemy engine created (SQL echo disabled)")
        except Exception as e:
            logger.error(f"Failed to create database engine: {str(e)}")
            raise
    
    @property
    def engine(self):
        """Get or create SQLAlchemy engine"""
        if self._engine is None:
            self._create_engine()
        return self._engine
    
    @property
    def session_local(self):
        """Get or create session factory"""
        if self._session_local is None:
            self._session_local = sessionmaker(
                bind=self.engine,
                autocommit=False,
                autoflush=False,
                future=True
            )
            logger.info("Session factory created")
        return self._session_local
    
    def get_session(self) -> Session:
        """Get a database session"""
        return self.session_local()
    
    def health_check(self) -> dict:
        """
        Perform database health check
        
        Returns:
            dict: Health check results with status and details
        """
        try:
            with self.engine.connect() as connection:
                # Execute a simple query to test connection
                result = connection.execute(text("SELECT 1 as health_check"))
                row = result.fetchone()
                
                if row and row[0] == 1:
                    # Get database version info
                    version_result = connection.execute(text("SELECT version()"))
                    version_info = version_result.fetchone()[0] if version_result else "Unknown"
                    
                    return {
                        "status": "healthy",
                        "database": "connected",
                        "version": version_info,
                        "url": self._mask_password(self.database_url)
                    }
                else:
                    return {
                        "status": "unhealthy",
                        "database": "connected but query failed",
                        "error": "Health check query returned unexpected result"
                    }
                    
        except Exception as e:
            logger.error(f"Database health check failed: {str(e)}")
            return {
                "status": "unhealthy",
                "database": "disconnected",
                "error": str(e),
                "url": self._mask_password(self.database_url)
            }
    
    def _mask_password(self, url: str) -> str:
        """Mask password in database URL for logging"""
        if "://" in url and "@" in url:
            parts = url.split("://")
            if len(parts) == 2:
                auth_and_host = parts[1]
                if "@" in auth_and_host:
                    auth, host = auth_and_host.split("@", 1)
                    if ":" in auth:
                        user, _ = auth.split(":", 1)
                        return f"{parts[0]}://{user}:***@{host}"
        return url
    
    def close_connections(self):
        """Close all database connections"""
        if self._engine:
            self._engine.dispose()
            logger.info("Database connections closed")

    def keep_alive(self):
        """Keep database connections alive"""
        if self._engine:
            try:
                with self._engine.connect() as conn:
                    conn.execute(text("SELECT 1"))
                return True
            except Exception as e:
                logger.error(f"Keep-alive failed: {str(e)}")
                return False

# Global database configuration instance
db_config = DatabaseConfig()

# Export commonly used objects
engine = db_config.engine
SessionLocal = db_config.session_local

def get_db_session() -> Session:
    """Dependency function to get database session"""
    return db_config.get_session()

def get_db() -> Session:
    """FastAPI dependency to get database session"""
    db = db_config.get_session()
    try:
        yield db
    finally:
        db.close()
