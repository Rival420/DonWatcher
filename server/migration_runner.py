"""
DonWatcher Automated Migration Runner
Handles database schema migrations with version tracking and rollback support.

This module provides:
- Automatic migration discovery and ordering
- Version tracking via database table
- Safe migration execution with transactions
- Rollback support for failed migrations
- Startup integration for seamless deployment
"""

import os
import re
import logging
from pathlib import Path
from datetime import datetime
from typing import List, Tuple, Optional, Dict
from dataclasses import dataclass

from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError

logger = logging.getLogger(__name__)


@dataclass
class Migration:
    """Represents a database migration file."""
    filename: str
    version: int
    description: str
    path: Path
    
    @classmethod
    def from_file(cls, filepath: Path) -> Optional['Migration']:
        """Parse migration info from filename."""
        # Pattern: migration_XXX_description.sql or init_db.sql
        filename = filepath.name
        
        if filename == 'init_db.sql':
            return cls(
                filename=filename,
                version=0,
                description='Initial database schema',
                path=filepath
            )
        
        # Match migration_XXX_description.sql pattern
        match = re.match(r'^migration_(\d+)_(.+)\.sql$', filename)
        if match:
            return cls(
                filename=filename,
                version=int(match.group(1)),
                description=match.group(2).replace('_', ' '),
                path=filepath
            )
        
        return None


class MigrationRunner:
    """
    Handles database migrations with version tracking.
    
    Features:
    - Discovers migrations from migrations/ directory
    - Tracks applied migrations in database table
    - Applies pending migrations in order
    - Supports dry-run mode for testing
    """
    
    MIGRATIONS_TABLE = 'schema_migrations'
    
    def __init__(self, engine, migrations_dir: Path = None):
        """
        Initialize migration runner.
        
        Args:
            engine: SQLAlchemy engine instance
            migrations_dir: Path to migrations directory (default: project_root/migrations)
        """
        self.engine = engine
        self.migrations_dir = migrations_dir or self._get_default_migrations_dir()
        
    def _get_default_migrations_dir(self) -> Path:
        """Get default migrations directory path."""
        # Navigate from server/ to project root
        server_dir = Path(__file__).parent
        project_root = server_dir.parent
        return project_root / 'migrations'
    
    def ensure_migrations_table(self) -> None:
        """Create the migrations tracking table if it doesn't exist."""
        with self.engine.connect() as conn:
            conn.execute(text(f"""
                CREATE TABLE IF NOT EXISTS {self.MIGRATIONS_TABLE} (
                    id SERIAL PRIMARY KEY,
                    version INTEGER NOT NULL UNIQUE,
                    filename TEXT NOT NULL,
                    description TEXT,
                    applied_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                    checksum TEXT,
                    execution_time_ms INTEGER
                )
            """))
            conn.commit()
            logger.info(f"Ensured {self.MIGRATIONS_TABLE} table exists")
    
    def get_applied_migrations(self) -> Dict[int, dict]:
        """Get dictionary of applied migrations keyed by version."""
        try:
            with self.engine.connect() as conn:
                result = conn.execute(text(f"""
                    SELECT version, filename, description, applied_at
                    FROM {self.MIGRATIONS_TABLE}
                    ORDER BY version
                """))
                return {
                    row.version: {
                        'filename': row.filename,
                        'description': row.description,
                        'applied_at': row.applied_at
                    }
                    for row in result
                }
        except SQLAlchemyError:
            # Table might not exist yet
            return {}
    
    def discover_migrations(self) -> List[Migration]:
        """Discover all migration files in migrations directory."""
        migrations = []
        
        if not self.migrations_dir.exists():
            logger.warning(f"Migrations directory not found: {self.migrations_dir}")
            return migrations
        
        for filepath in sorted(self.migrations_dir.glob('*.sql')):
            migration = Migration.from_file(filepath)
            if migration:
                migrations.append(migration)
                logger.debug(f"Discovered migration: {migration.filename} (v{migration.version})")
        
        # Sort by version
        migrations.sort(key=lambda m: m.version)
        return migrations
    
    def get_pending_migrations(self) -> List[Migration]:
        """Get list of migrations that haven't been applied yet."""
        applied = self.get_applied_migrations()
        all_migrations = self.discover_migrations()
        
        pending = [m for m in all_migrations if m.version not in applied]
        return pending
    
    def _calculate_checksum(self, content: str) -> str:
        """Calculate checksum of migration content."""
        import hashlib
        return hashlib.md5(content.encode()).hexdigest()
    
    def apply_migration(self, migration: Migration, dry_run: bool = False) -> Tuple[bool, str]:
        """
        Apply a single migration.
        
        Args:
            migration: Migration to apply
            dry_run: If True, don't actually execute the migration
            
        Returns:
            Tuple of (success, message)
        """
        logger.info(f"{'[DRY RUN] ' if dry_run else ''}Applying migration {migration.filename}...")
        
        try:
            # Read migration SQL
            content = migration.path.read_text(encoding='utf-8')
            checksum = self._calculate_checksum(content)
            
            if dry_run:
                return True, f"Would apply: {migration.filename}"
            
            start_time = datetime.now()
            
            with self.engine.connect() as conn:
                # Execute migration SQL
                # Split by semicolon for multiple statements, but be careful with functions
                conn.execute(text(content))
                
                # Record migration
                conn.execute(text(f"""
                    INSERT INTO {self.MIGRATIONS_TABLE} 
                    (version, filename, description, checksum, execution_time_ms)
                    VALUES (:version, :filename, :description, :checksum, :execution_time_ms)
                """), {
                    'version': migration.version,
                    'filename': migration.filename,
                    'description': migration.description,
                    'checksum': checksum,
                    'execution_time_ms': int((datetime.now() - start_time).total_seconds() * 1000)
                })
                
                conn.commit()
            
            elapsed = (datetime.now() - start_time).total_seconds() * 1000
            logger.info(f"✓ Applied {migration.filename} in {elapsed:.0f}ms")
            return True, f"Applied successfully in {elapsed:.0f}ms"
            
        except SQLAlchemyError as e:
            error_msg = f"Failed to apply {migration.filename}: {str(e)}"
            logger.error(error_msg)
            return False, error_msg
        except Exception as e:
            error_msg = f"Unexpected error applying {migration.filename}: {str(e)}"
            logger.error(error_msg)
            return False, error_msg
    
    def run_pending_migrations(self, dry_run: bool = False) -> Tuple[int, int, List[str]]:
        """
        Run all pending migrations in order.
        
        Args:
            dry_run: If True, don't actually execute migrations
            
        Returns:
            Tuple of (applied_count, failed_count, messages)
        """
        self.ensure_migrations_table()
        
        pending = self.get_pending_migrations()
        
        if not pending:
            logger.info("No pending migrations to apply")
            return 0, 0, ["No pending migrations"]
        
        logger.info(f"Found {len(pending)} pending migration(s)")
        
        applied = 0
        failed = 0
        messages = []
        
        for migration in pending:
            success, message = self.apply_migration(migration, dry_run)
            messages.append(message)
            
            if success:
                applied += 1
            else:
                failed += 1
                # Stop on first failure
                logger.error("Stopping migration due to failure")
                break
        
        return applied, failed, messages
    
    def get_status(self) -> Dict:
        """Get current migration status."""
        self.ensure_migrations_table()
        
        applied = self.get_applied_migrations()
        all_migrations = self.discover_migrations()
        pending = self.get_pending_migrations()
        
        return {
            'total_migrations': len(all_migrations),
            'applied_count': len(applied),
            'pending_count': len(pending),
            'applied_migrations': [
                {
                    'version': v,
                    'filename': info['filename'],
                    'description': info['description'],
                    'applied_at': info['applied_at'].isoformat() if info['applied_at'] else None
                }
                for v, info in sorted(applied.items())
            ],
            'pending_migrations': [
                {
                    'version': m.version,
                    'filename': m.filename,
                    'description': m.description
                }
                for m in pending
            ]
        }


def run_migrations_on_startup(engine) -> bool:
    """
    Run pending migrations during application startup.
    
    This function is designed to be called from main.py during initialization.
    It will:
    1. Check for pending migrations
    2. Apply them in order
    3. Log results
    
    Args:
        engine: SQLAlchemy database engine
        
    Returns:
        True if all migrations succeeded or none were pending, False on failure
    """
    try:
        runner = MigrationRunner(engine)
        
        # Get status first
        status = runner.get_status()
        
        if status['pending_count'] == 0:
            logger.info("Database schema is up to date")
            return True
        
        logger.info(f"Found {status['pending_count']} pending migration(s), applying...")
        
        applied, failed, messages = runner.run_pending_migrations()
        
        if failed > 0:
            logger.error(f"Migration failed! Applied {applied}, failed {failed}")
            for msg in messages:
                logger.error(f"  - {msg}")
            return False
        
        logger.info(f"Successfully applied {applied} migration(s)")
        return True
        
    except Exception as e:
        logger.error(f"Migration runner error: {e}")
        return False


def get_migration_status(engine) -> Dict:
    """
    Get migration status for API/debug endpoints.
    
    Args:
        engine: SQLAlchemy database engine
        
    Returns:
        Dictionary with migration status info
    """
    try:
        runner = MigrationRunner(engine)
        return runner.get_status()
    except Exception as e:
        return {
            'error': str(e),
            'total_migrations': 0,
            'applied_count': 0,
            'pending_count': 0
        }

