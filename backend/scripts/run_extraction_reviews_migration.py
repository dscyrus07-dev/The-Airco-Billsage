"""
Script to run the extraction_reviews table migration
"""
import sys
import os
from pathlib import Path

# Add backend to path
backend_path = Path(__file__).parent.parent
sys.path.insert(0, str(backend_path))

from sqlalchemy import text
from config.database import SessionLocal

def run_migration():
    """Run the extraction_reviews table migration"""
    db = SessionLocal()
    
    try:
        # Read migration SQL
        migration_file = backend_path / 'migrations' / '002_create_extraction_reviews.sql'
        with open(migration_file, 'r') as f:
            migration_sql = f.read()
        
        # Execute migration
        print("Running extraction_reviews table migration...")
        db.execute(text(migration_sql))
        db.commit()
        print("✅ Migration completed successfully!")
        
        # Verify table was created
        result = db.execute(text("""
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_name = 'extraction_reviews'
            );
        """))
        exists = result.scalar()
        
        if exists:
            print("✅ extraction_reviews table verified")
        else:
            print("❌ extraction_reviews table not found after migration")
            return False
            
        return True
        
    except Exception as e:
        print(f"❌ Migration failed: {e}")
        db.rollback()
        return False
    finally:
        db.close()

if __name__ == "__main__":
    success = run_migration()
    sys.exit(0 if success else 1)
