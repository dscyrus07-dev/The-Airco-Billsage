"""
Database Statement Classification and Clean Output Utilities

This module provides utilities for:
- Classifying SQL statements by type
- Generating clean, concise output
- Tracking progress and statistics
"""

import re
import logging
from typing import Dict, List, Optional, Tuple
from rich.console import Console

logger = logging.getLogger(__name__)

class SQLClassifier:
    """Classifies SQL statements for clean output"""
    
    def __init__(self):
        self.console = Console()
        
        # Define regex patterns for different statement types
        self.patterns = {
            'table': re.compile(r'CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?([^\s(]+)', re.IGNORECASE),
            'index': re.compile(r'CREATE\s+(?:UNIQUE\s+)?INDEX\s+(?:IF\s+NOT\s+EXISTS\s+)?([^\s(]+)', re.IGNORECASE),
            'function': re.compile(r'CREATE\s+(?:OR\s+REPLACE\s+)?FUNCTION\s+([^\s(]+)', re.IGNORECASE),
            'trigger': re.compile(r'CREATE\s+(?:OR\s+REPLACE\s+)?TRIGGER\s+(?:IF\s+NOT\s+EXISTS\s+)?([^\s(]+)', re.IGNORECASE),
            'extension': re.compile(r'CREATE\s+EXTENSION\s+(?:IF\s+NOT\s+EXISTS\s+)?\s*([^\s;]+)', re.IGNORECASE),
            'alter_table': re.compile(r'ALTER\s+TABLE\s+([^\s(]+)', re.IGNORECASE),
            'insert': re.compile(r'INSERT\s+INTO\s+([^\s(]+)', re.IGNORECASE),
            'attach_trigger': re.compile(r"SELECT\s+_attach_updated_at\s*\(\s*'([^']+)'\s*\)", re.IGNORECASE),
            'view': re.compile(r'CREATE\s+(?:OR\s+REPLACE\s+)?VIEW\s+([^\s(]+)', re.IGNORECASE),
            'drop': re.compile(r'DROP\s+(?:TRIGGER|FUNCTION|TABLE|INDEX)\s+(?:IF\s+NOT\s+EXISTS\s+)?([^\s(]+)', re.IGNORECASE),
        }
    
    def classify_statement(self, statement: str) -> Dict[str, str]:
        """
        Classify a SQL statement and extract relevant information
        
        Args:
            statement: SQL statement to classify
            
        Returns:
            dict: Classification information
        """
        statement_clean = statement.strip()
        
        for stmt_type, pattern in self.patterns.items():
            match = pattern.search(statement_clean)
            if match:
                name = match.group(1).strip('"[]`')
                # Clean up any trailing semicolons or special characters
                name = name.rstrip(';').strip()
                return {
                    'type': stmt_type,
                    'name': name,
                    'display_text': self._format_display_text(stmt_type, name),
                    'category': self._get_category(stmt_type)
                }      
        # Fallback for unknown statements
        first_words = ' '.join(statement_clean.split()[:3])
        return {
            'type': 'unknown',
            'name': 'statement',
            'display_text': f'Statement: {first_words}...',
            'category': 'other'
        }
    
    def _format_display_text(self, stmt_type: str, name: str) -> str:
        """Format display text for different statement types"""
        type_names = {
            'table': 'Table',
            'index': 'Index',
            'function': 'Function',
            'trigger': 'Trigger',
            'extension': 'Extension',
            'alter_table': 'Alter Table',
            'insert': 'Seed',
            'attach_trigger': 'Attach Trigger',
            'view': 'View',
            'drop': 'Drop',
            'unknown': 'Statement'
        }
        
        return f"{type_names.get(stmt_type, 'Statement')}: {name}"
    
    def _get_category(self, stmt_type: str) -> str:
        """Get broader category for statement type"""
        categories = {
            'table': 'schema',
            'index': 'schema',
            'function': 'logic',
            'trigger': 'logic',
            'extension': 'system',
            'alter_table': 'schema',
            'insert': 'data',
            'attach_trigger': 'logic',
            'view': 'schema',
            'drop': 'schema',
            'unknown': 'other'
        }
        return categories.get(stmt_type, 'other')

class ProgressTracker:
    """Tracks progress and statistics for database initialization"""
    
    def __init__(self):
        self.stats = {
            'tables': 0,
            'indexes': 0,
            'functions': 0,
            'triggers': 0,
            'extensions': 0,
            'alter_statements': 0,
            'seed_inserts': 0,
            'views': 0,
            'drop_statements': 0,
            'other_statements': 0,
            'total_statements': 0,
            'failed_statements': 0,
            'total_batches': 0,
            'failed_batches': 0
        }
        self.current_batch = 0
        self.console = Console()
    
    def start_batch(self, batch_num: int, total_batches: int, statement_count: int):
        """Start tracking a new batch"""
        self.current_batch = batch_num
        self.stats['total_batches'] = total_batches
        
        self.console.print(f"\n[bold cyan]Batch {batch_num}/{total_batches}[/bold cyan]")
        self.console.print("   • Transaction started")
    
    def record_statement(self, classification: Dict[str, str], success: bool, error: Optional[str] = None):
        """Record a statement execution"""
        stmt_type = classification['type']
        
        # Update counters
        if stmt_type in self.stats:
            self.stats[stmt_type] += 1
        else:
            self.stats['other_statements'] += 1
        
        self.stats['total_statements'] += 1
        
        if not success:
            self.stats['failed_statements'] += 1
        
        # Print result
        status = "✅" if success else "❌"
        self.console.print(f"   • {classification['display_text']} {status}")
        
        if not success and error:
            self.console.print(f"     [red]Error: {error}[/red]")
    
    def end_batch(self, success: bool):
        """End tracking a batch"""
        if success:
            self.console.print("   • Transaction committed")
        else:
            self.console.print("   • Transaction rolled back")
            self.stats['failed_batches'] += 1
    
    def print_final_summary(self):
        """Print final summary statistics"""
        self.console.print("\n[bold blue]Final Summary[/bold blue]")
        
        # Create summary table
        from rich.table import Table
        
        table = Table(show_header=False, box=None)
        table.add_column("Metric", style="cyan")
        table.add_column("Count", style="green")
        
        # Add rows for each metric
        metrics = [
            ("Tables processed", self.stats['tables']),
            ("Indexes processed", self.stats['indexes']),
            ("Functions processed", self.stats['functions']),
            ("Triggers processed", self.stats['triggers']),
            ("Extensions processed", self.stats['extensions']),
            ("Views processed", self.stats['views']),
            ("Alter statements", self.stats['alter_statements']),
            ("Seed inserts", self.stats['seed_inserts']),
            ("Other statements", self.stats['other_statements']),
            ("Total statements", self.stats['total_statements']),
            ("Errors", self.stats['failed_statements']),
        ]
        
        for metric, count in metrics:
            table.add_row(f"   • {metric}", str(count))
        
        self.console.print(table)
        
        # Overall status
        if self.stats['failed_statements'] == 0:
            self.console.print("\n[green]✅ All statements executed successfully![/green]")
        else:
            success_rate = ((self.stats['total_statements'] - self.stats['failed_statements']) / self.stats['total_statements']) * 100
            self.console.print(f"\n[yellow]⚠️  {self.stats['failed_statements']} statements failed ({success_rate:.1f}% success rate)[/yellow]")

class CleanOutputPrinter:
    """Handles clean console output for database initialization"""
    
    def __init__(self):
        self.console = Console()
        self.classifier = SQLClassifier()
        self.tracker = ProgressTracker()
    
    def print_step(self, step_num: int, description: str, status: str = "pending"):
        """Print a step with status"""
        status_icons = {
            "pending": "⏳",
            "running": "🔄",
            "success": "✅",
            "error": "❌"
        }
        
        icon = status_icons.get(status, "⏳")
        self.console.print(f"{step_num}. {description}... {icon}")
    
    def print_connection_summary(self, health_result: Dict):
        """Print concise database connection summary"""
        self.console.print("   • Status: connected")
        self.console.print(f"   • Database: {health_result.get('database', 'postgres')}")
        self.console.print(f"   • Host: {health_result.get('host', 'unknown')}")
        self.console.print(f"   • PostgreSQL version: {health_result.get('version', 'unknown')}")
    
    def print_error_summary(self, batch_num: int, statement_num: int, classification: Dict, error: str):
        """Print clean error summary"""
        self.console.print(f"\n[red]❌ Batch {batch_num}, Statement {statement_num} failed[/red]")
        self.console.print(f"   • Type: {classification['type'].title()}")
        self.console.print(f"   • Name: {classification['name']}")
        self.console.print(f"   • Error: {error}")

# Global instance for easy access
clean_printer = CleanOutputPrinter()
