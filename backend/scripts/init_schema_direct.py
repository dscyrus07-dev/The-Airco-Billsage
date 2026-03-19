"""
Direct Database Schema Initialization for BillSage Backend

This script directly reads and executes the schema.sql file using psql,
which is the most reliable way to handle complex PostgreSQL schemas.
"""

import os
import sys
import subprocess
import logging
from rich.console import Console
from rich.panel import Panel
from rich.text import Text

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Rich console for beautiful output
console = Console()

class DirectSchemaInitializer:
    """Direct schema initializer using psql command"""
    
    def __init__(self):
        self.console = Console()
        
    def parse_database_url(self, database_url: str) -> dict:
        """
        Parse DATABASE_URL into connection components
        
        Args:
            database_url: Complete database URL
            
        Returns:
            dict: Parsed connection components
        """
        # Expected format: postgresql://user:password@host:port/database
        try:
            import re
            pattern = r'postgresql://([^:]+):([^@]+)@([^:]+):(\d+)/(.+)'
            match = re.match(pattern, database_url)
            
            if match:
                return {
                    'user': match.group(1),
                    'password': match.group(2),
                    'host': match.group(3),
                    'port': match.group(4),
                    'database': match.group(5)
                }
            else:
                raise ValueError("Invalid DATABASE_URL format")
                
        except Exception as e:
            console.print(f"[red]✗[/red] Failed to parse DATABASE_URL: {str(e)}")
            raise
    
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
    
    def check_psql_available(self) -> bool:
        """Check if psql command is available"""
        try:
            result = subprocess.run(['psql', '--version'], 
                                  capture_output=True, text=True, timeout=10)
            if result.returncode == 0:
                console.print(f"[green]✓[/green] psql available: {result.stdout.strip()}")
                return True
            else:
                console.print("[red]✗[/red] psql command not available")
                return False
        except (subprocess.TimeoutExpired, FileNotFoundError):
            console.print("[red]✗[/red] psql command not found")
            return False
    
    def execute_schema_with_psql(self, schema_file: str, db_config: dict) -> dict:
        """
        Execute schema using psql command
        
        Args:
            schema_file: Path to schema.sql file
            db_config: Parsed database configuration
            
        Returns:
            dict: Execution results
        """
        results = {
            "success": False,
            "error": None,
            "output": "",
            "error_output": ""
        }
        
        try:
            # Set PGPASSWORD environment variable to avoid password prompt
            env = os.environ.copy()
            env['PGPASSWORD'] = db_config['password']
            
            # Build psql command
            cmd = [
                'psql',
                '-h', db_config['host'],
                '-p', db_config['port'],
                '-U', db_config['user'],
                '-d', db_config['database'],
                '-f', schema_file,
                '-v', 'ON_ERROR_STOP=1'  # Stop on first error
            ]
            
            console.print(f"[blue]🔧 Executing: psql -f {schema_file}[/blue]")
            
            # Execute command
            result = subprocess.run(cmd, 
                                  capture_output=True, 
                                  text=True, 
                                  env=env, 
                                  timeout=300)  # 5 minute timeout
            
            results["output"] = result.stdout
            results["error_output"] = result.stderr
            results["success"] = result.returncode == 0
            
            if result.returncode == 0:
                console.print("[green]✅ Schema executed successfully![/green]")
            else:
                console.print(f"[red]❌ Schema execution failed with return code {result.returncode}[/red]")
                if result.stderr:
                    console.print(f"[red]Error: {result.stderr}[/red]")
            
        except subprocess.TimeoutExpired:
            results["error"] = "Schema execution timed out after 5 minutes"
            console.print("[red]❌ Schema execution timed out[/red]")
        except Exception as e:
            results["error"] = str(e)
            console.print(f"[red]❌ Schema execution failed: {str(e)}[/red]")
        
        return results
    
    def initialize_schema(self) -> dict:
        """
        Initialize the complete database schema
        
        Returns:
            dict: Results of the initialization process
        """
        try:
            # Load environment variables
            from dotenv import load_dotenv
            load_dotenv()
            
            # Get database URL
            database_url = os.getenv("DATABASE_URL")
            if not database_url:
                raise ValueError("DATABASE_URL environment variable is not set")
            
            # Parse database URL
            console.print("[blue]🔍 Parsing database configuration...[/blue]")
            db_config = self.parse_database_url(database_url)
            
            # Check psql availability
            console.print("[blue]🔍 Checking psql availability...[/blue]")
            if not self.check_psql_available():
                return {
                    "success": False,
                    "error": "psql command is not available. Please install PostgreSQL client tools."
                }
            
            # Find schema file
            console.print("[blue]📖 Locating schema file...[/blue]")
            schema_file = self.find_schema_file()
            
            # Execute schema
            console.print("[blue]🚀 Executing schema initialization...[/blue]")
            results = self.execute_schema_with_psql(schema_file, db_config)
            
            return results
            
        except Exception as e:
            return {
                "success": False,
                "error": f"Initialization failed: {str(e)}"
            }
    
    def print_results(self, results: dict):
        """Print initialization results"""
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
            console.print("   • All tables, functions, and triggers created")
            console.print("   • Database ready for use")
            
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
            
            if results.get("error_output"):
                console.print("   • Database errors:")
                for line in results["error_output"].split('\n')[:5]:  # Show first 5 lines
                    if line.strip():
                        console.print(f"     - {line}")

def main():
    """Main function to run schema initialization"""
    console.print("[bold blue]🚀 BillSage Database Schema Initialization (Direct Mode)[/bold blue]")
    console.print("=" * 60)
    
    try:
        # Initialize schema
        initializer = DirectSchemaInitializer()
        results = initializer.initialize_schema()
        
        # Print results
        initializer.print_results(results)
        
        if results["success"]:
            console.print("\n[green]✅ Database is ready for use![/green]")
            console.print("[blue]ℹ️  Next: Run python scripts/db_healthcheck.py to verify setup[/blue]")
            return 0
        else:
            console.print("\n[red]❌ Please fix the errors and try again[/red]")
            return 1
            
    except Exception as e:
        console.print(f"[red]💥 Fatal error: {str(e)}[/red]")
        return 1

if __name__ == "__main__":
    exit(main())
