"""
Final Schema Initialization Script for BillSage Backend

This script executes the schema in the correct order with proper error handling.
"""

import os
import sys
import time
from typing import Dict, Any
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError
from rich.console import Console
from rich.progress import Progress, SpinnerColumn, TextColumn

# Add parent directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from config.database import db_config

# Rich console for beautiful output
console = Console()

class FinalSchemaInitializer:
    """Final schema initializer with correct execution order"""
    
    def __init__(self):
        self.console = Console()
        
    def find_schema_file(self) -> str:
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
    
    def execute_schema_directly(self) -> Dict[str, Any]:
        """Execute the entire schema file directly"""
        results = {
            "success": False,
            "error": None,
            "execution_time": 0
        }
        
        try:
            schema_file = self.find_schema_file()
            
            # Read the entire schema file
            with open(schema_file, 'r', encoding='utf-8') as file:
                schema_sql = file.read()
            
            console.print(f"[blue]📖 Read {len(schema_sql)} characters from schema file[/blue]")
            
            start_time = time.time()
            
            with Progress(
                SpinnerColumn(),
                TextColumn("[progress.description]{task.description}"),
                console=console
            ) as progress:
                task = progress.add_task("Executing complete schema...", total=None)
                
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
                        
                        # Try to get more detailed error info
                        console.print(f"[red]SQL Error: {str(e)}[/red]")
                        
        except Exception as e:
            results["error"] = str(e)
            console.print(f"[red]✗[/red] Schema execution failed: {str(e)}")
        
        return results
    
    def verify_tables_created(self) -> bool:
        """Verify that core tables were created"""
        core_tables = [
            'companies', 'users', 'parties', 'products', 
            'vouchers', 'ledger_entries', 'gst_output_entries', 'gst_input_entries'
        ]
        
        try:
            with db_config.get_session() as session:
                for table in core_tables:
                    try:
                        result = session.execute(text(f"SELECT COUNT(*) FROM {table}"))
                        count = result.fetchone()[0]
                        console.print(f"[green]✓[/green] Table '{table}' exists ({count} rows)")
                    except Exception as e:
                        console.print(f"[red]✗[/red] Table '{table}' error: {str(e)}")
                        return False
                return True
                
        except Exception as e:
            console.print(f"[red]✗[/red] Verification failed: {str(e)}")
            return False
    
    def initialize_schema(self) -> Dict[str, Any]:
        """Initialize the complete database schema"""
        try:
            # Execute schema
            console.print("[blue]🚀 Executing schema initialization...[/blue]")
            results = self.execute_schema_directly()
            
            if results["success"]:
                # Verify tables were created
                console.print("[blue]🔍 Verifying table creation...[/blue]")
                verification_success = self.verify_tables_created()
                results["verification_success"] = verification_success
                
                if not verification_success:
                    results["success"] = False
                    results["error"] = "Schema executed but tables verification failed"
            
            return results
            
        except Exception as e:
            return {
                "success": False,
                "error": f"Initialization failed: {str(e)}"
            }
    
    def print_results(self, results: Dict[str, Any]):
        """Print initialization results"""
        from rich.table import Table
        from rich.panel import Panel
        from rich.text import Text
        
        if results["success"]:
            success_text = Text()
            success_text.append("🎉 ", style="bold green")
            success_text.append("SCHEMA INITIALIZATION SUCCESSFUL!", style="bold white")
            success_text.append(" 🎉", style="bold green")
            
            panel = Panel(
                success_text,
                border_style="green",
                padding=(1, 2)
            )
            console.print(panel)
            
            console.print("\n[green]✅ What was accomplished:[/green]")
            console.print("   • Database connection established")
            console.print("   • Schema.sql executed successfully")
            console.print("   • All core tables created and verified")
            console.print("   • Database ready for microservices")
            
            if results.get("execution_time"):
                console.print(f"   • Execution time: {results['execution_time']:.2f} seconds")
            
        else:
            failure_text = Text()
            failure_text.append("💥 ", style="bold red")
            failure_text.append("SCHEMA INITIALIZATION FAILED!", style="bold white")
            failure_text.append(" 💥", style="bold red")
            
            panel = Panel(
                failure_text,
                border_style="red",
                padding=(1, 2)
            )
            console.print(panel)
            
            console.print("\n[red]❌ Error details:[/red]")
            if results.get("error"):
                console.print(f"   • {results['error']}")

def main():
    """Main function to run schema initialization"""
    console.print("[bold blue]🚀 BillSage Database Schema Initialization (Final Mode)[/bold blue]")
    console.print("=" * 60)
    
    try:
        # Initialize schema
        initializer = FinalSchemaInitializer()
        results = initializer.initialize_schema()
        
        # Print results
        initializer.print_results(results)
        
        if results["success"]:
            console.print("\n[green]✅ Database is ready for microservices![/green]")
            console.print("[blue]ℹ️  Next steps:[/blue]")
            console.print("   • Start developing your microservices")
            console.print("   • Test with: python scripts/db_healthcheck.py")
            console.print("   • Begin implementing business logic")
            return 0
        else:
            console.print("\n[red]❌ Please fix the errors and try again[/red]")
            console.print("[blue]ℹ️  Troubleshooting tips:[/blue]")
            console.print("   • Check your DATABASE_URL in .env file")
            console.print("   • Verify Supabase is accessible")
            console.print("   • Review the error messages above")
            return 1
            
    except Exception as e:
        console.print(f"[red]💥 Fatal error: {str(e)}[/red]")
        return 1

if __name__ == "__main__":
    exit(main())
