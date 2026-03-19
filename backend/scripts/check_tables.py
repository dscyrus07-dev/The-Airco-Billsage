"""
Simple Database Verification Script
"""

import os
import sys

# Add parent directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from config.database import db_config
from sqlalchemy import text

def check_tables():
    """Check what tables actually exist"""
    try:
        with db_config.get_session() as session:
            # Get all tables
            result = session.execute(text("""
                SELECT table_name 
                FROM information_schema.tables 
                WHERE table_schema = 'public' 
                AND table_type = 'BASE TABLE'
                ORDER BY table_name
            """))
            
            tables = [row[0] for row in result.fetchall()]
            
            print("=== TABLES IN DATABASE ===")
            for table in tables:
                print(f"  • {table}")
            
            print(f"\nTotal tables: {len(tables)}")
            
            # Check for core tables
            core_tables = ['companies', 'users', 'parties', 'products', 'vouchers', 'ledger_entries', 'gst_output_entries', 'gst_input_entries']
            missing_core = [t for t in core_tables if t not in tables]
            
            if missing_core:
                print(f"\nMissing core tables: {missing_core}")
            else:
                print("\n✅ All core tables present!")
            
            # Check extensions
            result = session.execute(text("""
                SELECT extname 
                FROM pg_extension 
                WHERE extname IN ('pgcrypto', 'pg_trgm')
            """))
            
            extensions = [row[0] for row in result.fetchall()]
            print(f"\n=== EXTENSIONS ===")
            for ext in extensions:
                print(f"  • {ext}")
            
            missing_ext = ['pgcrypto', 'pg_trgm']
            missing_ext = [e for e in missing_ext if e not in extensions]
            
            if missing_ext:
                print(f"Missing extensions: {missing_ext}")
            else:
                print("✅ All extensions present!")
                
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    check_tables()
