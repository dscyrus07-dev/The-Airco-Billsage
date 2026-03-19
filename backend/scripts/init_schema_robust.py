"""
Robust Schema Initialization Script for BillSage Backend

This script handles complex PostgreSQL schemas by executing them in batches
and properly handling functions, triggers, and dollar-quoted strings.
"""

import os
import sys
import re
import logging
import time
from typing import List, Dict, Any
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError
from rich.console import Console

# Add parent directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from config.database import db_config
from scripts.clean_output import clean_printer, SQLClassifier, ProgressTracker
from scripts.schema_inspector import SchemaInspector, REQUIRED_TABLE_COLUMNS

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Rich console for beautiful output
console = Console()

class RobustSchemaInitializer:
    """Robust schema initializer that handles complex PostgreSQL schemas"""
    
    def __init__(self, schema_file_path: str = None):
        """
        Initialize schema initializer
        
        Args:
            schema_file_path: Path to schema.sql file
        """
        self.schema_file_path = schema_file_path or self._find_schema_file()
        self.classifier = SQLClassifier()
        self.tracker = ProgressTracker()
        self.inspector = SchemaInspector(db_config.engine)
        
    def _find_schema_file(self) -> str:
        """Find the schema.sql file in the project"""
        current_dir = os.path.dirname(os.path.abspath(__file__))
        possible_paths = [
            os.path.join(os.path.dirname(os.path.dirname(current_dir)), "schema.sql"),  # backend/../schema.sql
            os.path.join(os.path.dirname(current_dir), "schema.sql"),  # backend/schema.sql
            os.path.join(current_dir, "schema.sql"),  # backend/scripts/schema.sql
            "schema.sql",  # Current directory
        ]
        
        for path in possible_paths:
            if os.path.exists(path):
                console.print(f"[green]✓[/green] Found schema file: {path}")
                return path
        
        raise FileNotFoundError(
            f"Could not find schema.sql. Looked in: {possible_paths}"
        )
    
    def read_schema_file(self) -> str:
        """
        Read the complete schema file
        
        Returns:
            str: Complete schema SQL content
        """
        try:
            with open(self.schema_file_path, 'r', encoding='utf-8') as file:
                content = file.read()
                console.print(f"[green]✓[/green] Read {len(content)} characters from schema file")
                return content
        except Exception as e:
            console.print(f"[red]✗[/red] Failed to read schema file: {str(e)}")
            raise
    
    def split_schema_into_batches(self, schema_content: str) -> List[List[str]]:
        """
        Split schema into logical batches for execution
        
        Args:
            schema_content: Complete schema SQL content
            
        Returns:
            List[List[str]]: Batches of SQL statements
        """
        # First, split into major sections
        sections = self._split_into_sections(schema_content)
        
        batches = []
        for section in sections:
            # Then split each section into individual statements
            statements = self._split_section_into_statements(section)
            if statements:
                batches.append(statements)
        
        console.print(f"[green]✓[/green] Split schema into {len(batches)} batches")
        return batches
    
    def _split_into_sections(self, content: str) -> List[str]:
        """Split schema content into logical sections"""
        sections = []
        
        # Define section markers
        section_patterns = [
            r'-- =============================================================================',
            r'-- SECTION \d+ —',
            r'-- FUNCTION:',
            r'-- TRIGGERS —',
            r'-- END OF SCHEMA'
        ]
        
        current_section = ""
        lines = content.split('\n')
        
        for line in lines:
            # Check if this is a section marker
            is_section_marker = any(re.match(pattern, line.strip()) for pattern in section_patterns)
            
            if is_section_marker and current_section.strip():
                # Save previous section and start new one
                sections.append(current_section.strip())
                current_section = line + '\n'
            else:
                current_section += line + '\n'
        
        # Add the last section
        if current_section.strip():
            sections.append(current_section.strip())
        
        return [s for s in sections if s.strip()]
    
    def _split_section_into_statements(self, section: str) -> List[str]:
        """Split a section into individual SQL statements"""
        statements = []
        current_statement = ""
        
        lines = section.split('\n')
        in_dollar_quote = False
        dollar_quote_start = None
        
        for i, line in enumerate(lines):
            line_stripped = line.strip()
            
            # Skip comments but keep line numbering
            if line_stripped.startswith('--') or not line_stripped:
                if current_statement:
                    current_statement += '\n'
                continue
            
            # Handle dollar-quoted strings
            if '$$' in line:
                if not in_dollar_quote:
                    # Start of dollar-quoted string
                    in_dollar_quote = True
                    dollar_quote_start = i
                else:
                    # End of dollar-quoted string
                    in_dollar_quote = False
                    dollar_quote_start = None
            
            current_statement += line + '\n'
            
            # Check for statement ending (only when not in dollar-quoted strings)
            if not in_dollar_quote and line_stripped.endswith(';'):
                statement = current_statement.rstrip().rstrip(';').strip()
                if statement:
                    statements.append(statement)
                current_statement = ""
        
        # Add any remaining content
        if current_statement.strip():
            statements.append(current_statement.strip())
        
        return statements
    
    def inspect_and_reconcile_schema(self, statements: List[str]):
        """Inspect and reconcile schema before executing statements"""
        console.print("[blue]🔍 Inspecting existing schema...[/blue]")
        
        # Find tables that will be created/modified in this batch
        tables_to_check = set()
        for stmt in statements:
            classification = self.classifier.classify_statement(stmt)
            if classification['type'] == 'table':
                tables_to_check.add(classification['name'])
            elif classification['type'] == 'index':
                # Extract table name from index statement
                if 'ON ' in stmt.upper():
                    table_part = stmt.upper().split('ON ')[1].split('(')[0].strip()
                    tables_to_check.add(table_part.strip('"[]`'))
        
        # Check each table and ensure required columns
        reconciliation_needed = False
        for table_name in tables_to_check:
            if table_name in REQUIRED_TABLE_COLUMNS:
                required_cols = REQUIRED_TABLE_COLUMNS[table_name]
                
                # Print inspection results
                self.inspector.print_table_inspection(table_name, list(required_cols.keys()))
                
                # Ensure required columns exist
                if not self.inspector.ensure_required_columns(table_name, required_cols):
                    console.print(f"[red]❌ Failed to reconcile table {table_name}[/red]")
                    return False
                else:
                    reconciliation_needed = True
        
        if reconciliation_needed:
            console.print("[green]✅ Schema reconciliation completed[/green]")
        
        return True
    
    def execute_statements_batch(self, statements: List[str], batch_num: int, total_batches: int) -> Dict[str, Any]:
        """
        Execute a batch of SQL statements with clean output
        
        Args:
            statements: List of SQL statements to execute
            batch_num: Current batch number
            total_batches: Total number of batches
            
        Returns:
            dict: Batch execution results
        """
        results = {
            "batch_num": batch_num,
            "total_statements": len(statements),
            "successful": 0,
            "failed": 0,
            "errors": []
        }
        
        # Start batch tracking
        self.tracker.start_batch(batch_num, total_batches, len(statements))
        
        # Inspect and reconcile schema before executing
        if not self.inspect_and_reconcile_schema(statements):
            results["errors"].append("Schema reconciliation failed")
            return results
        
        try:
            with db_config.get_session() as session:
                try:
                    # Start transaction
                    session.execute(text("BEGIN"))
                    
                    for i, statement in enumerate(statements, 1):
                        try:
                            # Classify statement
                            classification = self.classifier.classify_statement(statement)
                            
                            # Execute statement
                            session.execute(text(statement))
                            
                            # Record success
                            self.tracker.record_statement(classification, True)
                            results["successful"] += 1
                            
                        except SQLAlchemyError as e:
                            # Record failure
                            error_msg = str(e)
                            self.tracker.record_statement(classification, False, error_msg)
                            results["failed"] += 1
                            results["errors"].append(f"Statement {i}: {error_msg}")
                            
                            # For certain errors, we might want to continue
                            if "already exists" in error_msg.lower() or "duplicate" in error_msg.lower():
                                # This is likely okay - just continue
                                results["successful"] += 1
                                results["failed"] -= 1
                                results["errors"].pop()  # Remove the error
                            else:
                                # For serious errors, we might want to stop
                                logger.error(f"Stopping batch {batch_num} due to error: {error_msg}")
                                break
                    
                    # Commit transaction
                    session.execute(text("COMMIT"))
                    self.tracker.end_batch(True)
                    
                except SQLAlchemyError as e:
                    # Rollback on error
                    session.execute(text("ROLLBACK"))
                    self.tracker.end_batch(False)
                    results["errors"].append(f"Batch execution failed: {str(e)}")
                    logger.error(f"Batch {batch_num} execution failed: {str(e)}")
                    
        except Exception as e:
            results["errors"].append(f"Batch execution failed: {str(e)}")
            logger.error(f"Batch {batch_num} execution failed: {str(e)}")
        
        return results
    
    def initialize_schema(self) -> Dict[str, Any]:
        """
        Initialize the complete database schema with clean output
        
        Returns:
            dict: Results of the initialization process
        """
        results = {
            "total_batches": 0,
            "total_statements": 0,
            "total_successful": 0,
            "total_failed": 0,
            "batch_results": [],
            "success": False
        }
        
        try:
            # Read schema file
            console.print("[blue]📖 Reading schema file...[/blue]")
            schema_content = self.read_schema_file()
            
            # Split into batches
            console.print("[blue]🔧 Splitting schema into batches...[/blue]")
            batches = self.split_schema_into_batches(schema_content)
            results["total_batches"] = len(batches)
            
            # Execute batches
            console.print("[blue]🚀 Executing schema initialization...[/blue]")
            
            for batch_num, statements in enumerate(batches, 1):
                batch_result = self.execute_statements_batch(statements, batch_num, len(batches))
                results["batch_results"].append(batch_result)
                
                results["total_statements"] += batch_result["total_statements"]
                results["total_successful"] += batch_result["successful"]
                results["total_failed"] += batch_result["failed"]
            
            # Determine overall success
            results["success"] = results["total_failed"] == 0
            
            # Print final summary
            self.tracker.print_final_summary()
            
        except Exception as e:
            results["success"] = False
            results["batch_results"].append({
                "errors": [f"Initialization failed: {str(e)}"]
            })
            console.print(f"[red]✗[/red] Schema initialization failed: {str(e)}")
        
        return results

def main():
    """Main function to run schema initialization"""
    console.print("[bold blue]🚀 BillSage Database Schema Initialization (Robust Mode)[/bold blue]")
    console.print("=" * 60)
    
    try:
        # Initialize schema
        initializer = RobustSchemaInitializer()
        results = initializer.initialize_schema()
        
        # Print results
        if results["success"]:
            console.print("\n[green]✅ Schema initialization completed successfully![/green]")
            return 0
        else:
            console.print(f"\n[yellow]⚠️  Schema completed with {results['total_failed']} errors[/yellow]")
            return 1
            
    except Exception as e:
        console.print(f"[red]💥 Fatal error: {str(e)}[/red]")
        return 1

if __name__ == "__main__":
    exit(main())
