"""
Database Schema Inspection Utilities

This module provides utilities for inspecting live database schema
and detecting missing columns before index creation.
"""

import logging
from typing import Dict, List, Set, Optional, Tuple
from sqlalchemy import text
from rich.console import Console

logger = logging.getLogger(__name__)
console = Console()

class SchemaInspector:
    """Inspects live database schema and detects issues"""
    
    def __init__(self, db_engine):
        self.engine = db_engine
        self.console = Console()
    
    def table_exists(self, table_name: str) -> bool:
        """Check if a table exists"""
        try:
            with self.engine.connect() as conn:
                result = conn.execute(text("""
                    SELECT EXISTS (
                        SELECT FROM information_schema.tables 
                        WHERE table_schema = 'public' 
                        AND table_name = :table_name
                    )
                """), {"table_name": table_name})
                return result.fetchone()[0]
        except Exception as e:
            logger.error(f"Error checking if table {table_name} exists: {e}")
            return False
    
    def get_table_columns(self, table_name: str) -> List[str]:
        """Get all column names for a table"""
        try:
            with self.engine.connect() as conn:
                result = conn.execute(text("""
                    SELECT column_name 
                    FROM information_schema.columns 
                    WHERE table_schema = 'public' 
                    AND table_name = :table_name
                    ORDER BY ordinal_position
                """), {"table_name": table_name})
                return [row[0] for row in result.fetchall()]
        except Exception as e:
            logger.error(f"Error getting columns for table {table_name}: {e}")
            return []
    
    def inspect_table(self, table_name: str, expected_columns: List[str]) -> Dict[str, any]:
        """Inspect a table and report missing columns"""
        exists = self.table_exists(table_name)
        actual_columns = self.get_table_columns(table_name) if exists else []
        missing_columns = [col for col in expected_columns if col not in actual_columns]
        
        return {
            'table_name': table_name,
            'exists': exists,
            'actual_columns': actual_columns,
            'expected_columns': expected_columns,
            'missing_columns': missing_columns,
            'is_valid': len(missing_columns) == 0
        }
    
    def add_missing_column(self, table_name: str, column_name: str, column_definition: str) -> bool:
        """Add a missing column to a table"""
        try:
            with self.engine.connect() as conn:
                conn.execute(text(f"""
                    ALTER TABLE {table_name} 
                    ADD COLUMN IF NOT EXISTS {column_name} {column_definition}
                """))
                conn.commit()
                logger.info(f"Added column {column_name} to table {table_name}")
                return True
        except Exception as e:
            logger.error(f"Error adding column {column_name} to table {table_name}: {e}")
            return False
    
    def ensure_required_columns(self, table_name: str, required_columns: Dict[str, str]) -> bool:
        """
        Ensure all required columns exist for a table
        
        Args:
            table_name: Name of the table
            required_columns: Dict of column_name -> column_definition
            
        Returns:
            bool: True if all columns exist or were added successfully
        """
        inspection = self.inspect_table(table_name, list(required_columns.keys()))
        
        if not inspection['exists']:
            logger.warning(f"Table {table_name} does not exist - cannot add columns")
            return False
        
        if inspection['is_valid']:
            logger.info(f"Table {table_name} has all required columns")
            return True
        
        # Add missing columns
        success = True
        for missing_col in inspection['missing_columns']:
            if missing_col in required_columns:
                col_def = required_columns[missing_col]
                if not self.add_missing_column(table_name, missing_col, col_def):
                    success = False
                    console.print(f"[red]❌ Failed to add column {missing_col} to {table_name}[/red]")
                else:
                    console.print(f"[green]✅ Added column {missing_col} to {table_name}[/green]")
        
        return success
    
    def print_table_inspection(self, table_name: str, expected_columns: List[str]):
        """Print detailed table inspection results"""
        inspection = self.inspect_table(table_name, expected_columns)
        
        console.print(f"\n[bold cyan]Table Inspection: {table_name}[/bold cyan]")
        console.print(f"   • Exists: {'✅ Yes' if inspection['exists'] else '❌ No'}")
        
        if inspection['exists']:
            console.print(f"   • Columns found: {', '.join(inspection['actual_columns'])}")
            
            if inspection['missing_columns']:
                console.print(f"   • Missing columns: {', '.join(inspection['missing_columns'])}")
            else:
                console.print("   • Missing columns: None ✅")
        else:
            console.print("   • Columns found: N/A (table doesn't exist)")

# Define required columns for key tables
REQUIRED_TABLE_COLUMNS = {
    'companies': {
        'status': "VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active','inactive','suspended'))"
    },
    'parties': {
        'status': "VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active','inactive','blacklisted'))",
        'is_supplier': "BOOLEAN NOT NULL DEFAULT FALSE",
        'is_customer': "BOOLEAN NOT NULL DEFAULT FALSE",
        'deleted_at': "TIMESTAMPTZ"
    },
    'users': {
        'status': "VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active','inactive','suspended'))",
        'deleted_at': "TIMESTAMPTZ"
    },
    'products': {
        'deleted_at': "TIMESTAMPTZ"
    },
    'vouchers': {
        'status': "VARCHAR(20) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','confirmed','cancelled','paid'))",
        'deleted_at': "TIMESTAMPTZ"
    }
}
