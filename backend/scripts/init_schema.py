"""
Schema Initialization Script for BillSage Backend

This script handles:
- Reading the schema.sql file
- Splitting SQL statements properly
- Executing schema creation safely
- Error handling and logging
"""

import os
import logging
from typing import List, Optional
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError
from rich.console import Console
from rich.progress import Progress, SpinnerColumn, TextColumn
from rich.table import Table

from config.database import db_config

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Rich console for beautiful output
console = Console()

class SchemaInitializer:
    """Handles database schema initialization"""
    
    def __init__(self, schema_file_path: str = None):
        """
        Initialize schema initializer
        
        Args:
            schema_file_path: Path to schema.sql file
        """
        self.schema_file_path = schema_file_path or self._find_schema_file()
        self.console = Console()
        
    def _find_schema_file(self) -> str:
        """Find the schema.sql file in the project"""
        # Look in current directory and parent directories
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
    
    def split_sql_statements(self, sql_content: str) -> List[str]:
        """
        Split SQL content into individual statements
        
        Args:
            sql_content: Complete SQL content
            
        Returns:
            List[str]: Individual SQL statements
        """
        statements = []
        current_statement = ""
        
        # Split by lines first to handle multi-line statements
        lines = sql_content.split('\n')
        
        in_dollar_quote = False
        dollar_quote_tag = None
        
        for line in lines:
            # Skip empty lines but keep them for proper statement separation
            if not line.strip():
                current_statement += "\n"
                continue
            
            # Skip comments
            if line.strip().startswith('--'):
                continue
            
            # Handle dollar-quoted strings
            if '$$' in line:
                if not in_dollar_quote:
                    # Start of dollar-quoted string
                    in_dollar_quote = True
                    dollar_quote_tag = '$$'
                else:
                    # End of dollar-quoted string
                    in_dollar_quote = False
                    dollar_quote_tag = None
            
            current_statement += line + "\n"
            
            # Only check for statement endings when not in dollar-quoted strings
            if not in_dollar_quote and line.rstrip().endswith(';'):
                # Remove trailing delimiter and whitespace
                statement = current_statement.rstrip().rstrip(';').strip()
                if statement:  # Only add non-empty statements
                    statements.append(statement)
                current_statement = ""
        
        # Add any remaining content (for statements without semicolons or incomplete)
        if current_statement.strip():
            statements.append(current_statement.strip())
        
        console.print(f"[green]✓[/green] Split into {len(statements)} SQL statements")
        return statements
    
    def execute_statement(self, statement: str, session) -> bool:
        """
        Execute a single SQL statement
        
        Args:
            statement: SQL statement to execute
            session: Database session
            
        Returns:
            bool: True if successful, False otherwise
        """
        try:
            # Skip empty statements
            if not statement.strip():
                return True
            
            # Execute the statement
            session.execute(text(statement))
            session.commit()
            return True
            
        except SQLAlchemyError as e:
            session.rollback()
            logger.error(f"SQL Error executing statement: {str(e)}")
            logger.error(f"Statement: {statement[:100]}...")
            return False
        except Exception as e:
            session.rollback()
            logger.error(f"Unexpected error executing statement: {str(e)}")
            logger.error(f"Statement: {statement[:100]}...")
            return False
    
    def initialize_schema(self) -> dict:
        """
        Initialize the complete database schema
        
        Returns:
            dict: Results of the initialization process
        """
        results = {
            "total_statements": 0,
            "successful": 0,
            "failed": 0,
            "errors": [],
            "success": False
        }
        
        try:
            # Read schema file
            console.print("[blue]📖 Reading schema file...[/blue]")
            sql_content = self.read_schema_file()
            
            # Split statements
            console.print("[blue]🔧 Splitting SQL statements...[/blue]")
            statements = self.split_sql_statements(sql_content)
            results["total_statements"] = len(statements)
            
            # Execute statements with progress bar
            with Progress(
                SpinnerColumn(),
                TextColumn("[progress.description]{task.description}"),
                console=console
            ) as progress:
                task = progress.add_task("Executing schema...", total=len(statements))
                
                with db_config.get_session() as session:
                    for i, statement in enumerate(statements, 1):
                        progress.update(task, description=f"Executing statement {i}/{len(statements)}")
                        
                        if self.execute_statement(statement, session):
                            results["successful"] += 1
                        else:
                            results["failed"] += 1
                            results["errors"].append(f"Statement {i}: Failed to execute")
                        
                        progress.advance(task)
            
            # Determine overall success
            results["success"] = results["failed"] == 0
            
        except Exception as e:
            results["success"] = False
            results["errors"].append(f"Initialization failed: {str(e)}")
            console.print(f"[red]✗[/red] Schema initialization failed: {str(e)}")
        
        return results
    
    def print_results(self, results: dict):
        """Print initialization results in a formatted table"""
        table = Table(title="Schema Initialization Results")
        table.add_column("Metric", style="cyan")
        table.add_column("Value", style="green")
        
        table.add_row("Total Statements", str(results["total_statements"]))
        table.add_row("Successful", str(results["successful"]))
        table.add_row("Failed", str(results["failed"]))
        table.add_row("Overall Status", "[green]SUCCESS[/green]" if results["success"] else "[red]FAILED[/red]")
        
        console.print(table)
        
        # Print errors if any
        if results["errors"]:
            console.print("\n[red]Errors encountered:[/red]")
            for error in results["errors"]:
                console.print(f"  • {error}")

def main():
    """Main function to run schema initialization"""
    console.print("[bold blue]🚀 BillSage Database Schema Initialization[/bold blue]")
    console.print("=" * 50)
    
    try:
        # Initialize schema
        initializer = SchemaInitializer()
        results = initializer.initialize_schema()
        
        # Print results
        initializer.print_results(results)
        
        if results["success"]:
            console.print("\n[green]✅ Schema initialization completed successfully![/green]")
            return 0
        else:
            console.print("\n[red]❌ Schema initialization failed with errors![/red]")
            return 1
            
    except Exception as e:
        console.print(f"[red]💥 Fatal error: {str(e)}[/red]")
        return 1

if __name__ == "__main__":
    exit(main())
