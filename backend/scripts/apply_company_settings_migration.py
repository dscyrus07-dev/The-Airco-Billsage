"""
Apply company_settings table migration

This script adds the company_settings table to the database.
"""

import sys
import os
from pathlib import Path

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from sqlalchemy import text
from config.database import db_config
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def apply_migration():
    """Apply the company_settings migration"""
    
    # Read migration file
    migration_file = Path(__file__).parent.parent / "migrations" / "add_company_settings_table.sql"
    
    if not migration_file.exists():
        logger.error(f"Migration file not found: {migration_file}")
        return False
    
    with open(migration_file, 'r') as f:
        migration_sql = f.read()
    
    try:
        # Get database session
        db = db_config.get_session()
        
        logger.info("Applying company_settings migration...")
        
        # Execute migration
        db.execute(text(migration_sql))
        db.commit()
        
        logger.info("✅ Migration applied successfully!")
        
        # Verify table exists
        result = db.execute(text("""
            SELECT COUNT(*) as count 
            FROM information_schema.tables 
            WHERE table_name = 'company_settings'
        """))
        
        count = result.fetchone()[0]
        
        if count > 0:
            logger.info("✅ company_settings table verified")
            
            # Check how many companies have settings
            result = db.execute(text("SELECT COUNT(*) FROM company_settings"))
            settings_count = result.fetchone()[0]
            logger.info(f"✅ {settings_count} company settings records created")
        else:
            logger.error("❌ company_settings table not found after migration")
            return False
        
        db.close()
        return True
        
    except Exception as e:
        logger.error(f"❌ Migration failed: {e}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == "__main__":
    success = apply_migration()
    sys.exit(0 if success else 1)
