"""
Database Health Check Script for BillSage Backend

This script provides:
- Database connectivity testing
- Schema validation
- Performance metrics
- Connection status reporting
"""

import sys
import os
import time
from typing import Dict, Any
from rich.console import Console
from rich.table import Table
from rich.panel import Panel
from rich.progress import Progress, SpinnerColumn, TextColumn

# Add parent directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from config.database import db_config

console = Console()

class DatabaseHealthChecker:
    """Comprehensive database health checking"""
    
    def __init__(self):
        self.console = Console()
    
    def check_basic_connectivity(self) -> Dict[str, Any]:
        """Check basic database connectivity"""
        try:
            start_time = time.time()
            health_result = db_config.health_check()
            response_time = time.time() - start_time
            
            health_result["response_time_ms"] = round(response_time * 1000, 2)
            return health_result
            
        except Exception as e:
            return {
                "status": "unhealthy",
                "error": str(e),
                "response_time_ms": 0
            }
    
    def check_schema_tables(self) -> Dict[str, Any]:
        """Check if core schema tables exist"""
        core_tables = [
            'companies',
            'users', 
            'parties',
            'products',
            'vouchers',
            'ledger_entries',
            'gst_output_entries',
            'gst_input_entries'
        ]
        
        try:
            with db_config.get_session() as session:
                result = session.execute("""
                    SELECT table_name 
                    FROM information_schema.tables 
                    WHERE table_schema = 'public' 
                    AND table_type = 'BASE TABLE'
                """)
                existing_tables = {row[0] for row in result.fetchall()}
                
                missing_tables = [table for table in core_tables if table not in existing_tables]
                found_tables = [table for table in core_tables if table in existing_tables]
                
                return {
                    "status": "healthy" if not missing_tables else "partial",
                    "total_core_tables": len(core_tables),
                    "found_tables": len(found_tables),
                    "missing_tables": missing_tables,
                    "found_table_names": found_tables
                }
                
        except Exception as e:
            return {
                "status": "unhealthy",
                "error": str(e),
                "total_core_tables": len(core_tables),
                "found_tables": 0,
                "missing_tables": core_tables
            }
    
    def check_extensions(self) -> Dict[str, Any]:
        """Check required PostgreSQL extensions"""
        required_extensions = ['pgcrypto', 'pg_trgm']
        
        try:
            with db_config.get_session() as session:
                result = session.execute("""
                    SELECT extname 
                    FROM pg_extension 
                    WHERE extname = ANY(:extensions)
                """, {"extensions": required_extensions})
                
                installed_extensions = {row[0] for row in result.fetchall()}
                missing_extensions = [ext for ext in required_extensions if ext not in installed_extensions]
                
                return {
                    "status": "healthy" if not missing_extensions else "partial",
                    "required_extensions": required_extensions,
                    "installed_extensions": list(installed_extensions),
                    "missing_extensions": missing_extensions
                }
                
        except Exception as e:
            return {
                "status": "unhealthy",
                "error": str(e),
                "required_extensions": required_extensions,
                "installed_extensions": [],
                "missing_extensions": required_extensions
            }
    
    def check_table_counts(self) -> Dict[str, Any]:
        """Check row counts for key tables"""
        key_tables = ['companies', 'users', 'parties', 'products']
        counts = {}
        
        try:
            with db_config.get_session() as session:
                for table in key_tables:
                    try:
                        result = session.execute(f"SELECT COUNT(*) FROM {table}")
                        counts[table] = result.fetchone()[0]
                    except Exception:
                        counts[table] = "N/A (table not found)"
                
                return {
                    "status": "healthy",
                    "table_counts": counts
                }
                
        except Exception as e:
            return {
                "status": "unhealthy",
                "error": str(e),
                "table_counts": {}
            }
    
    def run_full_health_check(self) -> Dict[str, Any]:
        """Run comprehensive health check"""
        console.print("[bold blue]🏥 Running Database Health Check...[/bold blue]")
        
        results = {
            "overall_status": "healthy",
            "checks": {}
        }
        
        # Run individual checks
        checks = [
            ("Connectivity", self.check_basic_connectivity),
            ("Schema Tables", self.check_schema_tables), 
            ("Extensions", self.check_extensions),
            ("Table Counts", self.check_table_counts)
        ]
        
        with Progress(
            SpinnerColumn(),
            TextColumn("[progress.description]{task.description}"),
            console=console
        ) as progress:
            
            tasks = {
                name: progress.add_task(f"Checking {name}...")
                for name, _ in checks
            }
            
            for check_name, check_func in checks:
                progress.update(tasks[check_name], description=f"Checking {check_name}...")
                check_result = check_func()
                results["checks"][check_name] = check_result
                
                # Update overall status
                if check_result.get("status") == "unhealthy":
                    results["overall_status"] = "unhealthy"
                elif check_result.get("status") == "partial" and results["overall_status"] == "healthy":
                    results["overall_status"] = "partial"
                
                progress.update(tasks[check_name], description=f"✓ {check_name} completed")
        
        return results
    
    def print_health_report(self, results: Dict[str, Any]):
        """Print comprehensive health report"""
        # Overall status panel
        status_color = {
            "healthy": "green",
            "partial": "yellow", 
            "unhealthy": "red"
        }.get(results["overall_status"], "red")
        
        panel = Panel(
            f"[{status_color}]Status: {results['overall_status'].upper()}[/{status_color}]",
            title="🏥 Database Health Summary",
            border_style=status_color
        )
        console.print(panel)
        
        # Detailed results table
        table = Table(title="Detailed Health Check Results")
        table.add_column("Check", style="cyan")
        table.add_column("Status", style="bold")
        table.add_column("Details", style="white")
        
        for check_name, check_result in results["checks"].items():
            status = check_result.get("status", "unknown")
            status_color = {
                "healthy": "green",
                "partial": "yellow",
                "unhealthy": "red"
            }.get(status, "red")
            
            # Format details based on check type
            if check_name == "Connectivity":
                details = f"Response time: {check_result.get('response_time_ms', 'N/A')}ms"
                if "error" in check_result:
                    details += f" | Error: {check_result['error']}"
            
            elif check_name == "Schema Tables":
                details = f"Found: {check_result.get('found_tables', 0)}/{check_result.get('total_core_tables', 0)} core tables"
                if check_result.get("missing_tables"):
                    details += f" | Missing: {', '.join(check_result['missing_tables'])}"
            
            elif check_name == "Extensions":
                details = f"Installed: {len(check_result.get('installed_extensions', []))}/{len(check_result.get('required_extensions', []))}"
                if check_result.get("missing_extensions"):
                    details += f" | Missing: {', '.join(check_result['missing_extensions'])}"
            
            elif check_name == "Table Counts":
                counts = check_result.get("table_counts", {})
                details = ", ".join([f"{table}: {count}" for table, count in counts.items()])
            
            else:
                details = str(check_result)
            
            table.add_row(
                check_name,
                f"[{status_color}]{status.upper()}[/{status_color}]",
                details
            )
        
        console.print(table)

def main():
    """Main function to run health check"""
    try:
        checker = DatabaseHealthChecker()
        results = checker.run_full_health_check()
        checker.print_health_report(results)
        
        # Exit with appropriate code
        if results["overall_status"] == "healthy":
            console.print("\n[green]✅ Database is healthy![/green]")
            return 0
        elif results["overall_status"] == "partial":
            console.print("\n[yellow]⚠️  Database has some issues![/yellow]")
            return 1
        else:
            console.print("\n[red]❌ Database has serious issues![/red]")
            return 2
            
    except Exception as e:
        console.print(f"[red]💥 Health check failed: {str(e)}[/red]")
        return 3

if __name__ == "__main__":
    exit(main())
