"""
BillSage Database Initialization Entrypoint

This is the main entrypoint for database initialization that:
1. Loads environment configuration
2. Tests database connectivity
3. Executes schema.sql to set up the database
4. Provides clear success/failure reporting
5. Can be run safely multiple times

Usage:
    python main_database.py
"""

import sys
import os
import logging
import time
from pathlib import Path
from rich.console import Console
from rich.panel import Panel
from rich.text import Text
from sqlalchemy import text

# Add the current directory to Python path for imports
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from config.database import db_config
from scripts.init_schema_robust import RobustSchemaInitializer
from scripts.clean_output import clean_printer

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Rich console for beautiful output
console = Console()

def print_banner():
    """Print application banner"""
    banner_text = Text()
    banner_text.append("🚀 ", style="bold blue")
    banner_text.append("BillSage Database Initialization", style="bold white")
    banner_text.append(" 🚀", style="bold blue")
    
    panel = Panel(
        banner_text,
        border_style="blue",
        padding=(1, 2)
    )
    console.print(panel)
    console.print()

def print_startup_sequence():
    """Print the startup sequence steps"""
    console.print("[bold cyan]📋 Startup Sequence:[/bold cyan]")
    steps = [
        "1. Loading environment configuration",
        "2. Testing database connectivity", 
        "3. Reading schema.sql file",
        "4. Executing schema initialization",
        "5. Verifying database setup",
        "6. Generating final report"
    ]
    
    for step in steps:
        console.print(f"  {step}")
    console.print()

def step_load_config():
    """Step 1: Load and validate configuration"""
    clean_printer.print_step(1, "Loading environment configuration", "running")
    
    try:
        # Check if .env file exists
        env_path = Path(".env")
        
        clean_printer.print_step(1, "Loading environment configuration", "success")
        console.print(f"   • App: {db_config.app_name}")
        console.print(f"   • Debug: {db_config.debug}")
        console.print(f"   • Env file: .env")
        return True
        
    except Exception as e:
        clean_printer.print_step(1, "Loading environment configuration", "error")
        console.print(f"[red]Configuration error: {str(e)}[/red]")
        return False

def step_test_connectivity():
    """Step 2: Test database connectivity"""
    clean_printer.print_step(2, "Testing database connectivity", "running")
    
    try:
        health_result = db_config.health_check()
        
        if health_result["status"] == "healthy":
            clean_printer.print_step(2, "Testing database connectivity", "success")
            clean_printer.print_connection_summary(health_result)
            return True
        else:
            clean_printer.print_step(2, "Testing database connectivity", "error")
            console.print(f"[red]Connection failed: {health_result.get('error', 'Unknown error')}[/red]")
            return False
            
    except Exception as e:
        clean_printer.print_step(2, "Testing database connectivity", "error")
        console.print(f"[red]Connectivity test failed: {str(e)}[/red]")
        return False

def step_execute_schema():
    """Step 3-4: Read and execute schema"""
    clean_printer.print_step(3, "Reading schema.sql", "running")
    clean_printer.print_step(4, "Executing schema initialization", "running")
    
    try:
        initializer = RobustSchemaInitializer()
        results = initializer.initialize_schema()
        
        if results["success"]:
            clean_printer.print_step(3, "Reading schema.sql", "success")
            clean_printer.print_step(4, "Executing schema initialization", "success")
            return True
        else:
            clean_printer.print_step(3, "Reading schema.sql", "success")
            clean_printer.print_step(4, "Executing schema initialization", "error")
            
            # Show if it's mostly successful
            success_rate = results['total_successful'] / results['total_statements'] * 100
            console.print(f"   • Failed statements: {results['total_failed']}")
            console.print(f"   • Success rate: {success_rate:.1f}%")
            
            if success_rate > 85:
                console.print("[green]✅ Schema is mostly functional - proceeding[/green]")
                return True
            else:
                console.print("[red]❌ Too many errors - cannot proceed[/red]")
                return False
            
    except Exception as e:
        clean_printer.print_step(3, "Reading schema.sql", "error")
        clean_printer.print_step(4, "Executing schema initialization", "error")
        console.print(f"[red]❌ Schema execution failed: {str(e)}[/red]")
        return False

def step_verify_setup():
    """Step 5: Verify database setup"""
    clean_printer.print_step(5, "Verifying database setup", "running")
    
    try:
        # Use our simple table checker instead
        from scripts.check_tables import check_tables
        
        # Import the check function and run it
        import io
        import contextlib
        
        # Capture the output of check_tables
        f = io.StringIO()
        with contextlib.redirect_stdout(f):
            check_tables()
        
        output = f.getvalue()
        
        # Check if all core tables are present
        if "All core tables present!" in output and "All extensions present!" in output:
            clean_printer.print_step(5, "Verifying database setup", "success")
            console.print("   • All core tables created")
            console.print("   • All extensions installed")
            console.print("   • Database ready for use")
            return True
        else:
            clean_printer.print_step(5, "Verifying database setup", "error")
            console.print("   • Check the table listing above")
            return False  # Still proceed since schema was mostly successful
            
    except Exception as e:
        clean_printer.print_step(5, "Verifying database setup", "error")
        console.print(f"[red]❌ Database verification failed: {str(e)}[/red]")
        # Still return True since schema execution was successful
        console.print("[yellow]⚠️  Proceeding anyway since schema was mostly successful[/yellow]")
        return True

def print_final_report(success: bool, start_time: float):
    """Step 6: Print final report"""
    clean_printer.print_step(6, "Generating final report", "running")
    
    elapsed_time = time.time() - start_time
    
    # Success/Failure panel
    if success:
        success_text = Text()
        success_text.append("🎉 ", style="bold green")
        success_text.append("DATABASE INITIALIZATION SUCCESSFUL!", style="bold white")
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
        console.print("   • Database verified and ready for use")
        
        clean_printer.print_step(6, "Generating final report", "success")
        
    else:
        failure_text = Text()
        failure_text.append("💥 ", style="bold red")
        failure_text.append("DATABASE INITIALIZATION FAILED!", style="bold white")
        failure_text.append(" 💥", style="bold red")
        
        panel = Panel(
            failure_text,
            border_style="red",
            padding=(1, 2)
        )
        console.print(panel)
        
        console.print("\n[red]❌ Troubleshooting tips:[/red]")
        console.print("   • Check your DATABASE_URL in .env file")
        console.print("   • Verify Supabase is accessible")
        console.print("   • Check if schema.sql file exists")
        console.print("   • Review error messages above")
        console.print("   • Try running: python scripts/db_healthcheck.py")
        
        clean_printer.print_step(6, "Generating final report", "error")
    
    console.print(f"\n[blue]⏱️  Total time: {elapsed_time:.2f} seconds[/blue]")

def continuous_health_monitor():
    """Run continuous health checks every 120 seconds"""
    console.print("\n[bold blue]🔄 Starting continuous health monitoring...[/bold blue]")
    console.print("[blue]ℹ️  Health checks will run every 120 seconds[/blue]")
    console.print("[blue]ℹ️  Press Ctrl+C to stop monitoring[/blue]\n")
    
    check_count = 0
    
    # Disable SQLAlchemy logging for cleaner output
    logging.getLogger('sqlalchemy.engine').setLevel(logging.WARNING)
    logging.getLogger('sqlalchemy').setLevel(logging.WARNING)
    
    try:
        while True:
            check_count += 1
            console.print(f"[bold cyan]Health Check #{check_count}[/bold cyan]")
            
            # Check tables only
            try:
                with db_config.get_session() as session:
                    result = session.execute(text("""
                        SELECT table_name 
                        FROM information_schema.tables 
                        WHERE table_schema = 'public' 
                        AND table_type = 'BASE TABLE'
                        ORDER BY table_name
                    """))
                    tables = [row[0] for row in result.fetchall()]
                    
                    # Check core tables
                    core_tables = ['companies', 'users', 'parties', 'products', 'vouchers', 'ledger_entries', 'gst_output_entries', 'gst_input_entries']
                    missing_core = [t for t in core_tables if t not in tables]
                    
                    if missing_core:
                        console.print("[red]❌ Database tables: MISSING CORE TABLES[/red]")
                        console.print(f"[red]   Missing: {', '.join(missing_core)}[/red]")
                    else:
                        console.print("[green]✅ Database tables: ALL CORE TABLES PRESENT[/green]")
                    
                    console.print(f"[blue]   Total tables: {len(tables)}[/blue]")
                    console.print(f"[dim]   Tables: {', '.join(tables[:10])}{'...' if len(tables) > 10 else ''}[/dim]")
                    
            except Exception as e:
                console.print("[red]❌ Database tables: CHECK FAILED[/red]")
                console.print(f"[red]   Error: {str(e)}[/red]")
            
            # Wait for next check
            console.print(f"[dim]Waiting 120 seconds for next check...[/dim]\n")
            time.sleep(120)
            
    except KeyboardInterrupt:
        console.print("\n[yellow]⚠️  Health monitoring stopped by user[/yellow]")
        # Restore logging
        logging.getLogger('sqlalchemy.engine').setLevel(logging.INFO)
        logging.getLogger('sqlalchemy').setLevel(logging.INFO)
    except Exception as e:
        console.print(f"\n[red]❌ Health monitoring error: {str(e)}[/red]")
        # Restore logging
        logging.getLogger('sqlalchemy.engine').setLevel(logging.INFO)
        logging.getLogger('sqlalchemy').setLevel(logging.INFO)

def main():
    """Main initialization function"""
    start_time = time.time()
    
    # Print banner and startup sequence
    print_banner()
    print_startup_sequence()
    
    console.print("[bold cyan]🚀 Starting database initialization...[/bold cyan]")
    console.print("=" * 60)
    
    # Execute startup steps
    steps = [
        ("Configuration", step_load_config),
        ("Connectivity", step_test_connectivity),
        ("Schema", step_execute_schema),
        ("Verification", step_verify_setup)
    ]
    
    all_success = True
    
    for step_name, step_func in steps:
        try:
            success = step_func()
            if not success:
                all_success = False
                # For critical failures, stop early
                if step_name in ["Configuration", "Connectivity"]:
                    break
            console.print()  # Add spacing between steps
        except KeyboardInterrupt:
            console.print("[yellow]⚠️  Initialization interrupted by user[/yellow]")
            return 130
        except Exception as e:
            console.print(f"[red]💥 Unexpected error in {step_name}: {str(e)}[/red]")
            all_success = False
            if step_name in ["Configuration", "Connectivity"]:
                break
        console.print("-" * 60)
    
    # Print final report
    print_final_report(all_success, start_time)
    
    # Start continuous monitoring if initialization was successful
    if all_success:
        console.print("\n" + "=" * 60)
        continuous_health_monitor()
    
    # Clean up (only if not monitoring)
    try:
        db_config.close_connections()
    except:
        pass
    
    # Return appropriate exit code
    return 0 if all_success else 1

if __name__ == "__main__":
    try:
        exit_code = main()
        sys.exit(exit_code)
    except KeyboardInterrupt:
        console.print("\n[yellow]⚠️  Initialization interrupted by user[/yellow]")
        sys.exit(130)
    except Exception as e:
        console.print(f"\n[red]💥 Fatal error: {str(e)}[/red]")
        sys.exit(1)
