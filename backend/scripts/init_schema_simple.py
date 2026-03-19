"""
Alternative Schema Initialization Script for BillSage Backend

This script executes the entire schema.sql file as a single script,
which handles complex PostgreSQL functions and triggers better.
"""

import os
import sys
import logging
import time
from typing import Dict, Any
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError
from rich.console import Console
from rich.progress import Progress, SpinnerColumn, TextColumn

# Add parent directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from config.database import db_config

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Rich console for beautiful output
console = Console()

class SimpleSchemaInitializer:
    """Simple schema initializer that executes the entire schema as one script"""
    
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
    
    def execute_schema_script(self, schema_sql: str) -> Dict[str, Any]:
        """
        Execute the complete schema as one script
        
        Args:
            schema_sql: Complete schema SQL content
            
        Returns:
            dict: Results of the execution
        """
        results = {
            "success": False,
            "error": None,
            "execution_time": 0
        }
        
        try:
            with Progress(
                SpinnerColumn(),
                TextColumn("[progress.description]{task.description}"),
                console=console
            ) as progress:
                task = progress.add_task("Executing schema script...", total=None)
                
                start_time = time.time()
                
                with db_config.get_session() as session:
                    try:
                        # Execute the entire schema as one script
                        session.execute(text(schema_sql))
                        session.commit()
                        
                        results["success"] = True
                        results["execution_time"] = time.time() - start_time
                        
                        progress.update(task, description="✅ Schema executed successfully!")
                        
                    except SQLAlchemyError as e:
                        session.rollback()
                        results["error"] = str(e)
                        progress.update(task, description="❌ Schema execution failed!")
                        
        except Exception as e:
            results["error"] = str(e)
            console.print(f"[red]✗[/red] Schema execution failed: {str(e)}")
        
        return results
    
    def initialize_schema(self) -> Dict[str, Any]:
        """
        Initialize the complete database schema
        
        Returns:
            dict: Results of the initialization process
        """
        try:
            # Read schema file
            console.print("[blue]📖 Reading schema file...[/blue]")
            schema_sql = self.read_schema_file()
            
            # Execute schema
            console.print("[blue]🔧 Executing schema script...[/blue]")
            results = self.execute_schema_script(schema_sql)
            
            return results
            
        except Exception as e:
            return {
                "success": False,
                "error": f"Initialization failed: {str(e)}"
            }
    
    def print_results(self, results: Dict[str, Any]):
        """Print initialization results"""
        if results["success"]:
            console.print("\n[green]✅ Schema initialization completed successfully![/green]")
            console.print(f"⏱️  Execution time: {results.get('execution_time', 0):.2f} seconds")
        else:
            console.print("\n[red]❌ Schema initialization failed![/red]")
            if results.get("error"):
                console.print(f"Error: {results['error']}")

def main():
    """Main function to run schema initialization"""
    console.print("[bold blue]🚀 BillSage Database Schema Initialization (Simple Mode)[/bold blue]")
    console.print("=" * 50)
    
    try:
        # Initialize schema
        initializer = SimpleSchemaInitializer()
        results = initializer.initialize_schema()
        
        # Print results
        initializer.print_results(results)
        
        if results["success"]:
            console.print("\n[green]✅ Schema initialization completed successfully![/green]")
            return 0
        else:
            console.print("\n[red]❌ Schema initialization failed![/red]")
            return 1
            
    except Exception as e:
        console.print(f"[red]💥 Fatal error: {str(e)}[/red]")
        return 1

if __name__ == "__main__":
    import time
    exit(main())
