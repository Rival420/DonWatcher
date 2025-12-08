"""
DonWatcher Database Health Check Service
Comprehensive health monitoring for database schema and connectivity.

This module provides:
- Table existence verification
- View existence verification  
- Index verification
- Connection pool health
- Query performance monitoring
"""

import logging
import time
from typing import Dict, List, Optional, Any
from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum

from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError

logger = logging.getLogger(__name__)


class HealthStatus(str, Enum):
    """Health check status levels."""
    HEALTHY = "healthy"
    DEGRADED = "degraded"
    UNHEALTHY = "unhealthy"
    UNKNOWN = "unknown"


@dataclass
class CheckResult:
    """Result of a single health check."""
    name: str
    status: HealthStatus
    message: str
    duration_ms: float = 0.0
    details: Dict[str, Any] = field(default_factory=dict)


@dataclass
class HealthReport:
    """Complete health report for the database."""
    overall_status: HealthStatus
    timestamp: datetime
    checks: List[CheckResult]
    summary: Dict[str, Any]
    
    def to_dict(self) -> Dict:
        """Convert to dictionary for JSON serialization."""
        return {
            'overall_status': self.overall_status.value,
            'timestamp': self.timestamp.isoformat(),
            'checks': [
                {
                    'name': c.name,
                    'status': c.status.value,
                    'message': c.message,
                    'duration_ms': round(c.duration_ms, 2),
                    'details': c.details
                }
                for c in self.checks
            ],
            'summary': self.summary
        }


class DatabaseHealthChecker:
    """
    Comprehensive database health checker.
    
    Performs multiple health checks:
    - Connection test
    - Required tables existence
    - Required views existence
    - Index verification
    - Query performance
    """
    
    # Required tables for full functionality
    REQUIRED_TABLES = [
        'reports',
        'findings',
        'risks',
        'accepted_risks',
        'monitored_groups',
        'group_memberships',
        'settings',
        'agents',
        'accepted_group_members',
        'group_risk_configs',
        'domain_risk_assessments',
        'group_risk_assessments',
        'global_risk_scores',
        'risk_configuration',
        'risk_calculation_history',
        'schema_migrations'
    ]
    
    # Required views
    REQUIRED_VIEWS = [
        'risk_dashboard_summary'
    ]
    
    # Required indexes for performance
    REQUIRED_INDEXES = [
        'idx_reports_tool_type',
        'idx_reports_domain',
        'idx_reports_report_date',
        'idx_findings_report_id',
        'idx_findings_tool_type',
        'idx_group_memberships_report_id',
        'idx_domain_risk_assessments_domain_date',
        'idx_global_risk_scores_domain_date'
    ]
    
    def __init__(self, engine):
        """Initialize health checker with database engine."""
        self.engine = engine
    
    def check_connection(self) -> CheckResult:
        """Test database connection."""
        start = time.time()
        try:
            with self.engine.connect() as conn:
                result = conn.execute(text("SELECT 1 as test"))
                row = result.fetchone()
                
                if row and row.test == 1:
                    return CheckResult(
                        name="connection",
                        status=HealthStatus.HEALTHY,
                        message="Database connection successful",
                        duration_ms=(time.time() - start) * 1000
                    )
                else:
                    return CheckResult(
                        name="connection",
                        status=HealthStatus.UNHEALTHY,
                        message="Unexpected query result",
                        duration_ms=(time.time() - start) * 1000
                    )
                    
        except SQLAlchemyError as e:
            return CheckResult(
                name="connection",
                status=HealthStatus.UNHEALTHY,
                message=f"Connection failed: {str(e)}",
                duration_ms=(time.time() - start) * 1000
            )
    
    def check_tables(self) -> CheckResult:
        """Verify all required tables exist."""
        start = time.time()
        try:
            with self.engine.connect() as conn:
                result = conn.execute(text("""
                    SELECT table_name 
                    FROM information_schema.tables 
                    WHERE table_schema = 'public' 
                    AND table_type = 'BASE TABLE'
                """))
                existing_tables = {row.table_name for row in result}
            
            missing = [t for t in self.REQUIRED_TABLES if t not in existing_tables]
            present = [t for t in self.REQUIRED_TABLES if t in existing_tables]
            
            if not missing:
                return CheckResult(
                    name="tables",
                    status=HealthStatus.HEALTHY,
                    message=f"All {len(self.REQUIRED_TABLES)} required tables present",
                    duration_ms=(time.time() - start) * 1000,
                    details={'present': len(present), 'missing': []}
                )
            elif len(missing) <= 2:
                return CheckResult(
                    name="tables",
                    status=HealthStatus.DEGRADED,
                    message=f"Missing {len(missing)} table(s): {', '.join(missing)}",
                    duration_ms=(time.time() - start) * 1000,
                    details={'present': len(present), 'missing': missing}
                )
            else:
                return CheckResult(
                    name="tables",
                    status=HealthStatus.UNHEALTHY,
                    message=f"Missing {len(missing)} required tables",
                    duration_ms=(time.time() - start) * 1000,
                    details={'present': len(present), 'missing': missing}
                )
                
        except SQLAlchemyError as e:
            return CheckResult(
                name="tables",
                status=HealthStatus.UNHEALTHY,
                message=f"Table check failed: {str(e)}",
                duration_ms=(time.time() - start) * 1000
            )
    
    def check_views(self) -> CheckResult:
        """Verify all required views exist."""
        start = time.time()
        try:
            with self.engine.connect() as conn:
                result = conn.execute(text("""
                    SELECT table_name 
                    FROM information_schema.views 
                    WHERE table_schema = 'public'
                """))
                existing_views = {row.table_name for row in result}
            
            missing = [v for v in self.REQUIRED_VIEWS if v not in existing_views]
            present = [v for v in self.REQUIRED_VIEWS if v in existing_views]
            
            if not missing:
                return CheckResult(
                    name="views",
                    status=HealthStatus.HEALTHY,
                    message=f"All {len(self.REQUIRED_VIEWS)} required views present",
                    duration_ms=(time.time() - start) * 1000,
                    details={'present': present, 'missing': []}
                )
            else:
                return CheckResult(
                    name="views",
                    status=HealthStatus.DEGRADED,
                    message=f"Missing view(s): {', '.join(missing)}",
                    duration_ms=(time.time() - start) * 1000,
                    details={'present': present, 'missing': missing}
                )
                
        except SQLAlchemyError as e:
            return CheckResult(
                name="views",
                status=HealthStatus.UNHEALTHY,
                message=f"View check failed: {str(e)}",
                duration_ms=(time.time() - start) * 1000
            )
    
    def check_indexes(self) -> CheckResult:
        """Verify performance-critical indexes exist."""
        start = time.time()
        try:
            with self.engine.connect() as conn:
                result = conn.execute(text("""
                    SELECT indexname 
                    FROM pg_indexes 
                    WHERE schemaname = 'public'
                """))
                existing_indexes = {row.indexname for row in result}
            
            missing = [i for i in self.REQUIRED_INDEXES if i not in existing_indexes]
            present = [i for i in self.REQUIRED_INDEXES if i in existing_indexes]
            
            if not missing:
                return CheckResult(
                    name="indexes",
                    status=HealthStatus.HEALTHY,
                    message=f"All {len(self.REQUIRED_INDEXES)} performance indexes present",
                    duration_ms=(time.time() - start) * 1000,
                    details={'present': len(present), 'missing': []}
                )
            elif len(missing) <= 3:
                return CheckResult(
                    name="indexes",
                    status=HealthStatus.DEGRADED,
                    message=f"Missing {len(missing)} index(es) - may affect performance",
                    duration_ms=(time.time() - start) * 1000,
                    details={'present': len(present), 'missing': missing}
                )
            else:
                return CheckResult(
                    name="indexes",
                    status=HealthStatus.DEGRADED,
                    message=f"Missing {len(missing)} indexes - performance may be impacted",
                    duration_ms=(time.time() - start) * 1000,
                    details={'present': len(present), 'missing': missing}
                )
                
        except SQLAlchemyError as e:
            return CheckResult(
                name="indexes",
                status=HealthStatus.UNHEALTHY,
                message=f"Index check failed: {str(e)}",
                duration_ms=(time.time() - start) * 1000
            )
    
    def check_query_performance(self) -> CheckResult:
        """Test query performance with sample queries."""
        start = time.time()
        try:
            with self.engine.connect() as conn:
                # Test a representative query
                query_start = time.time()
                result = conn.execute(text("""
                    SELECT COUNT(*) as count FROM reports
                    WHERE report_date >= NOW() - INTERVAL '30 days'
                """))
                row = result.fetchone()
                query_time = (time.time() - query_start) * 1000
                
                if query_time < 100:
                    return CheckResult(
                        name="query_performance",
                        status=HealthStatus.HEALTHY,
                        message=f"Query performance good ({query_time:.0f}ms)",
                        duration_ms=(time.time() - start) * 1000,
                        details={'sample_query_ms': round(query_time, 2), 'report_count': row.count}
                    )
                elif query_time < 500:
                    return CheckResult(
                        name="query_performance",
                        status=HealthStatus.DEGRADED,
                        message=f"Query performance acceptable ({query_time:.0f}ms)",
                        duration_ms=(time.time() - start) * 1000,
                        details={'sample_query_ms': round(query_time, 2), 'report_count': row.count}
                    )
                else:
                    return CheckResult(
                        name="query_performance",
                        status=HealthStatus.DEGRADED,
                        message=f"Query performance slow ({query_time:.0f}ms)",
                        duration_ms=(time.time() - start) * 1000,
                        details={'sample_query_ms': round(query_time, 2), 'report_count': row.count}
                    )
                    
        except SQLAlchemyError as e:
            return CheckResult(
                name="query_performance",
                status=HealthStatus.UNHEALTHY,
                message=f"Performance check failed: {str(e)}",
                duration_ms=(time.time() - start) * 1000
            )
    
    def check_data_integrity(self) -> CheckResult:
        """Check basic data integrity."""
        start = time.time()
        try:
            with self.engine.connect() as conn:
                # Check for orphaned findings
                result = conn.execute(text("""
                    SELECT COUNT(*) as count
                    FROM findings f
                    LEFT JOIN reports r ON f.report_id = r.id
                    WHERE r.id IS NULL
                """))
                orphaned = result.fetchone().count
                
                if orphaned == 0:
                    return CheckResult(
                        name="data_integrity",
                        status=HealthStatus.HEALTHY,
                        message="Data integrity verified",
                        duration_ms=(time.time() - start) * 1000,
                        details={'orphaned_findings': 0}
                    )
                else:
                    return CheckResult(
                        name="data_integrity",
                        status=HealthStatus.DEGRADED,
                        message=f"Found {orphaned} orphaned findings",
                        duration_ms=(time.time() - start) * 1000,
                        details={'orphaned_findings': orphaned}
                    )
                    
        except SQLAlchemyError as e:
            return CheckResult(
                name="data_integrity",
                status=HealthStatus.UNKNOWN,
                message=f"Integrity check failed: {str(e)}",
                duration_ms=(time.time() - start) * 1000
            )
    
    def run_full_check(self) -> HealthReport:
        """Run all health checks and return comprehensive report."""
        start_time = datetime.utcnow()
        checks = []
        
        # Run all checks
        checks.append(self.check_connection())
        checks.append(self.check_tables())
        checks.append(self.check_views())
        checks.append(self.check_indexes())
        checks.append(self.check_query_performance())
        checks.append(self.check_data_integrity())
        
        # Determine overall status
        statuses = [c.status for c in checks]
        
        if HealthStatus.UNHEALTHY in statuses:
            overall = HealthStatus.UNHEALTHY
        elif HealthStatus.DEGRADED in statuses:
            overall = HealthStatus.DEGRADED
        elif HealthStatus.UNKNOWN in statuses:
            overall = HealthStatus.DEGRADED
        else:
            overall = HealthStatus.HEALTHY
        
        # Build summary
        summary = {
            'total_checks': len(checks),
            'healthy': sum(1 for c in checks if c.status == HealthStatus.HEALTHY),
            'degraded': sum(1 for c in checks if c.status == HealthStatus.DEGRADED),
            'unhealthy': sum(1 for c in checks if c.status == HealthStatus.UNHEALTHY),
            'total_duration_ms': sum(c.duration_ms for c in checks)
        }
        
        return HealthReport(
            overall_status=overall,
            timestamp=start_time,
            checks=checks,
            summary=summary
        )
    
    def run_quick_check(self) -> CheckResult:
        """Run quick connection check only."""
        return self.check_connection()


def get_database_health(engine) -> Dict:
    """
    Get database health status for API endpoints.
    
    Args:
        engine: SQLAlchemy database engine
        
    Returns:
        Dictionary with health report
    """
    try:
        checker = DatabaseHealthChecker(engine)
        report = checker.run_full_check()
        return report.to_dict()
    except Exception as e:
        logger.error(f"Health check failed: {e}")
        return {
            'overall_status': 'error',
            'timestamp': datetime.utcnow().isoformat(),
            'error': str(e),
            'checks': [],
            'summary': {'total_checks': 0}
        }


def get_quick_health(engine) -> Dict:
    """
    Get quick database health status.
    
    Args:
        engine: SQLAlchemy database engine
        
    Returns:
        Dictionary with basic health status
    """
    try:
        checker = DatabaseHealthChecker(engine)
        result = checker.run_quick_check()
        return {
            'status': result.status.value,
            'message': result.message,
            'duration_ms': round(result.duration_ms, 2)
        }
    except Exception as e:
        return {
            'status': 'error',
            'message': str(e),
            'duration_ms': 0
        }

