import logging
from datetime import datetime, timezone
from typing import List, Dict, Optional, Tuple
from uuid import uuid4
import json

from sqlalchemy.orm import Session
from sqlalchemy import text, and_, or_, desc, asc, func
from sqlalchemy.exc import IntegrityError

from server.database import get_db, SessionLocal
from server.models import (
    Report, Finding, ReportSummary, Settings, AcceptedRisk, Risk,
    MonitoredGroup, GroupMembership, Agent, SecurityToolType, FindingStatus,
    GroupMembershipChange
)

def get_storage():
    """Get storage instance - for dependency injection."""
    return PostgresReportStorage()

class PostgresReportStorage:
    """PostgreSQL-based storage implementation."""
    
    def __init__(self):
        self.db_session = SessionLocal

    def _get_session(self) -> Session:
        """Get a new database session."""
        return self.db_session()
    
    def get_connection(self):
        """Get database connection for raw SQL operations."""
        from server.database import engine
        return engine.connect()

    def save_report(self, report: Report) -> str:
        """Save a report and its findings to the database."""
        with self._get_session() as session:
            try:
                # Handle domain scanner reports differently - don't overwrite domain info
                if report.tool_type == SecurityToolType.DOMAIN_ANALYSIS:
                    # For domain scanner, only save basic report info and domain_sid for validation
                    session.execute(text("""
                        INSERT INTO reports (
                            id, tool_type, domain, report_date, upload_date,
                            domain_sid, original_file, metadata
                        ) VALUES (
                            :id, :tool_type, :domain, :report_date, :upload_date,
                            :domain_sid, :original_file, :metadata
                        )
                        ON CONFLICT (id) DO UPDATE SET
                            upload_date = EXCLUDED.upload_date,
                            metadata = EXCLUDED.metadata,
                            updated_at = NOW()
                    """), {
                        'id': report.id,
                        'tool_type': report.tool_type.value,
                        'domain': report.domain,
                        'report_date': report.report_date,
                        'upload_date': report.upload_date,
                        'domain_sid': report.domain_sid,
                        'original_file': report.original_file,
                        'metadata': json.dumps(report.metadata)
                    })
                else:
                    # For PingCastle and other tools, save full report data
                    # Try with new column name first, fallback to old if migration not run
                    try:
                        session.execute(text("""
                        INSERT INTO reports (
                            id, tool_type, domain, report_date, upload_date,
                            pingcastle_global_score, high_score, medium_score, low_score,
                                stale_objects_score, privileged_accounts_score,
                                trusts_score, anomalies_score, domain_sid,
                                domain_functional_level, forest_functional_level,
                                maturity_level, dc_count, user_count, computer_count,
                                original_file, html_file, metadata
                            ) VALUES (
                                :id, :tool_type, :domain, :report_date, :upload_date,
                                :pingcastle_global_score, :high_score, :medium_score, :low_score,
                                :stale_objects_score, :privileged_accounts_score,
                                :trusts_score, :anomalies_score, :domain_sid,
                                :domain_functional_level, :forest_functional_level,
                                :maturity_level, :dc_count, :user_count, :computer_count,
                                :original_file, :html_file, :metadata
                            )
                            ON CONFLICT (id) DO UPDATE SET
                                upload_date = EXCLUDED.upload_date,
                                html_file = EXCLUDED.html_file,
                                metadata = EXCLUDED.metadata,
                                updated_at = NOW()
                        """), {
                    'id': report.id,
                    'tool_type': report.tool_type.value,
                    'domain': report.domain,
                    'report_date': report.report_date,
                    'upload_date': report.upload_date,
                    'pingcastle_global_score': report.global_score or 0,
                    'high_score': report.high_score or 0,
                    'medium_score': report.medium_score or 0,
                    'low_score': report.low_score or 0,
                    'stale_objects_score': report.stale_objects_score or 0,
                    'privileged_accounts_score': report.privileged_accounts_score or 0,
                    'trusts_score': report.trusts_score or 0,
                    'anomalies_score': report.anomalies_score or 0,
                    'domain_sid': report.domain_sid,
                    'domain_functional_level': report.domain_functional_level,
                    'forest_functional_level': report.forest_functional_level,
                    'maturity_level': report.maturity_level,
                    'dc_count': report.dc_count or 0,
                    'user_count': report.user_count or 0,
                    'computer_count': report.computer_count or 0,
                    'original_file': report.original_file,
                    'html_file': report.html_file,
                    'metadata': json.dumps(report.metadata)
                })
                    except Exception as e:
                        if "pingcastle_global_score" in str(e):
                            # Fallback to old column name if migration not run
                            session.execute(text("""
                                INSERT INTO reports (
                                    id, tool_type, domain, report_date, upload_date,
                                    pingcastle_global_score, high_score, medium_score, low_score,
                                    stale_objects_score, privileged_accounts_score,
                                    trusts_score, anomalies_score, domain_sid,
                                    domain_functional_level, forest_functional_level,
                                    maturity_level, dc_count, user_count, computer_count,
                                    original_file, html_file, metadata
                                ) VALUES (
                                    :id, :tool_type, :domain, :report_date, :upload_date,
                                    :pingcastle_global_score, :high_score, :medium_score, :low_score,
                                    :stale_objects_score, :privileged_accounts_score,
                                    :trusts_score, :anomalies_score, :domain_sid,
                                    :domain_functional_level, :forest_functional_level,
                                    :maturity_level, :dc_count, :user_count, :computer_count,
                                    :original_file, :html_file, :metadata
                                )
                                ON CONFLICT (id) DO UPDATE SET
                                    upload_date = EXCLUDED.upload_date,
                                    html_file = EXCLUDED.html_file,
                                    metadata = EXCLUDED.metadata,
                                    updated_at = NOW()
                            """), {
                                'id': report.id,
                                'tool_type': report.tool_type.value,
                                'domain': report.domain,
                                'report_date': report.report_date,
                                'upload_date': report.upload_date,
                                'pingcastle_global_score': report.global_score or 0,
                                'high_score': report.high_score or 0,
                                'medium_score': report.medium_score or 0,
                                'low_score': report.low_score or 0,
                                'stale_objects_score': report.stale_objects_score or 0,
                                'privileged_accounts_score': report.privileged_accounts_score or 0,
                                'trusts_score': report.trusts_score or 0,
                                'anomalies_score': report.anomalies_score or 0,
                                'domain_sid': report.domain_sid,
                                'domain_functional_level': report.domain_functional_level,
                                'forest_functional_level': report.forest_functional_level,
                                'maturity_level': report.maturity_level,
                                'dc_count': report.dc_count or 0,
                                'user_count': report.user_count or 0,
                                'computer_count': report.computer_count or 0,
                                'original_file': report.original_file,
                                'html_file': report.html_file,
                                'metadata': json.dumps(report.metadata)
                            })
                        else:
                            raise

                # Save findings and calculate stats for KPIs
                findings_stats = {'total': 0, 'high': 0, 'medium': 0, 'low': 0}
                for finding in report.findings:
                    self._save_finding(session, finding)
                    self._save_risk_to_catalog(session, finding)
                    # Count findings by severity for KPIs
                    findings_stats['total'] += 1
                    severity = finding.severity.lower() if finding.severity else 'medium'
                    if severity == 'high':
                        findings_stats['high'] += 1
                    elif severity == 'medium':
                        findings_stats['medium'] += 1
                    elif severity == 'low':
                        findings_stats['low'] += 1

                session.commit()
                logging.info(f"Saved report {report.id} with {len(report.findings)} findings")
                
                # Save KPIs for dashboard performance (after commit to ensure report exists)
                try:
                    self._save_report_kpis_internal(report, findings_stats)
                except Exception as kpi_error:
                    # Log but don't fail the report save if KPI save fails
                    logging.warning(f"Failed to save KPIs for report {report.id}: {kpi_error}")
                
                return report.id

            except Exception as e:
                session.rollback()
                logging.error(f"Failed to save report: {e}")
                raise
    
    def _save_report_kpis_internal(self, report: Report, findings_stats: Dict) -> None:
        """Internal method to save KPIs within the save_report transaction context."""
        with self._get_session() as session:
            try:
                session.execute(text("""
                    INSERT INTO reports_kpis (
                        report_id, tool_type, domain, report_date,
                        global_score, stale_objects_score, privileged_accounts_score,
                        trusts_score, anomalies_score,
                        user_count, computer_count, dc_count,
                        total_findings, high_severity_findings, 
                        medium_severity_findings, low_severity_findings
                    ) VALUES (
                        :report_id, :tool_type, :domain, :report_date,
                        :global_score, :stale_objects_score, :privileged_accounts_score,
                        :trusts_score, :anomalies_score,
                        :user_count, :computer_count, :dc_count,
                        :total_findings, :high_severity_findings,
                        :medium_severity_findings, :low_severity_findings
                    )
                    ON CONFLICT (report_id) DO UPDATE SET
                        tool_type = EXCLUDED.tool_type,
                        domain = EXCLUDED.domain,
                        report_date = EXCLUDED.report_date,
                        global_score = EXCLUDED.global_score,
                        stale_objects_score = EXCLUDED.stale_objects_score,
                        privileged_accounts_score = EXCLUDED.privileged_accounts_score,
                        trusts_score = EXCLUDED.trusts_score,
                        anomalies_score = EXCLUDED.anomalies_score,
                        user_count = EXCLUDED.user_count,
                        computer_count = EXCLUDED.computer_count,
                        dc_count = EXCLUDED.dc_count,
                        total_findings = EXCLUDED.total_findings,
                        high_severity_findings = EXCLUDED.high_severity_findings,
                        medium_severity_findings = EXCLUDED.medium_severity_findings,
                        low_severity_findings = EXCLUDED.low_severity_findings,
                        updated_at = NOW()
                """), {
                    'report_id': report.id,
                    'tool_type': report.tool_type.value,
                    'domain': report.domain,
                    'report_date': report.report_date,
                    'global_score': report.global_score or 0,
                    'stale_objects_score': report.stale_objects_score or 0,
                    'privileged_accounts_score': report.privileged_accounts_score or 0,
                    'trusts_score': report.trusts_score or 0,
                    'anomalies_score': report.anomalies_score or 0,
                    'user_count': report.user_count or 0,
                    'computer_count': report.computer_count or 0,
                    'dc_count': report.dc_count or 0,
                    'total_findings': findings_stats.get('total', 0),
                    'high_severity_findings': findings_stats.get('high', 0),
                    'medium_severity_findings': findings_stats.get('medium', 0),
                    'low_severity_findings': findings_stats.get('low', 0)
                })
                session.commit()
                logging.info(f"Saved KPIs for report {report.id}")
            except Exception as e:
                # Table might not exist if migration hasn't run
                if "reports_kpis" in str(e) and "does not exist" in str(e):
                    logging.warning("reports_kpis table does not exist yet - skipping KPI save")
                else:
                    raise

    def _save_finding(self, session: Session, finding: Finding):
        """Save a finding to the database."""
        session.execute(text("""
            INSERT INTO findings (
                id, report_id, tool_type, category, name, score,
                severity, description, recommendation, status, metadata
            ) VALUES (
                :id, :report_id, :tool_type, :category, :name, :score,
                :severity, :description, :recommendation, :status, :metadata
            )
            ON CONFLICT (id) DO UPDATE SET
                score = EXCLUDED.score,
                severity = EXCLUDED.severity,
                description = EXCLUDED.description,
                recommendation = EXCLUDED.recommendation,
                status = EXCLUDED.status,
                metadata = EXCLUDED.metadata,
                updated_at = NOW()
        """), {
            'id': finding.id,
            'report_id': finding.report_id,
            'tool_type': finding.tool_type.value,
            'category': finding.category,
            'name': finding.name,
            'score': finding.score,
            'severity': finding.severity,
            'description': finding.description,
            'recommendation': finding.recommendation,
            'status': finding.status.value,
            'metadata': json.dumps(finding.metadata)
        })

    def _save_risk_to_catalog(self, session: Session, finding: Finding):
        """Save risk to the master catalog."""
        session.execute(text("""
            INSERT INTO risks (tool_type, category, name, description, recommendation, severity)
            VALUES (:tool_type, :category, :name, :description, :recommendation, :severity)
            ON CONFLICT (tool_type, category, name) DO UPDATE SET
                description = EXCLUDED.description,
                recommendation = EXCLUDED.recommendation,
                severity = EXCLUDED.severity,
                updated_at = NOW()
        """), {
            'tool_type': finding.tool_type.value,
            'category': finding.category,
            'name': finding.name,
            'description': finding.description,
            'recommendation': finding.recommendation,
            'severity': finding.severity
        })

    def _ensure_risk_in_catalog(self, session: Session, tool_type: SecurityToolType, category: str, name: str):
        """Ensure a risk exists in the catalog, creating it if necessary."""
        # Check if risk exists
        result = session.execute(text("""
            SELECT id FROM risks 
            WHERE tool_type = :tool_type AND category = :category AND name = :name
        """), {
            'tool_type': tool_type.value,
            'category': category,
            'name': name
        }).fetchone()
        
        if not result:
            # Risk doesn't exist, create a basic entry
            logging.warning(f"Risk not found in catalog, creating basic entry: {tool_type.value}/{category}/{name}")
            session.execute(text("""
                INSERT INTO risks (tool_type, category, name, description, recommendation, severity)
                VALUES (:tool_type, :category, :name, :description, :recommendation, :severity)
            """), {
                'tool_type': tool_type.value,
                'category': category,
                'name': name,
                'description': f'Auto-generated risk entry for {name}',
                'recommendation': 'Review this finding and determine appropriate action',
                'severity': 'medium'
            })
            logging.info(f"Created missing risk in catalog: {tool_type.value}/{category}/{name}")

    def update_report_html(self, report_id: str, html_file: str):
        """Update the HTML file path for a report."""
        with self._get_session() as session:
            session.execute(text("""
                UPDATE reports SET html_file = :html_file, updated_at = NOW()
                WHERE id = :report_id
            """), {'html_file': html_file, 'report_id': report_id})
            session.commit()

    def get_report(self, report_id: str) -> Report:
        """Get a single report with all its findings."""
        with self._get_session() as session:
            # Get report - try with new column name first, fallback to old
            try:
                result = session.execute(text("""
                    SELECT id, tool_type, domain, report_date, upload_date,
                           pingcastle_global_score, high_score, medium_score, low_score,
                       stale_objects_score, privileged_accounts_score,
                       trusts_score, anomalies_score, domain_sid,
                       domain_functional_level, forest_functional_level,
                       maturity_level, dc_count, user_count, computer_count,
                       original_file, html_file, metadata
                FROM reports WHERE id = :report_id
            """), {'report_id': report_id}).fetchone()
            except Exception as e:
                if "pingcastle_global_score" in str(e):
                    # Fallback to old column name
                    result = session.execute(text("""
                        SELECT id, tool_type, domain, report_date, upload_date,
                               pingcastle_global_score, high_score, medium_score, low_score,
                               stale_objects_score, privileged_accounts_score,
                               trusts_score, anomalies_score, domain_sid,
                               domain_functional_level, forest_functional_level,
                               maturity_level, dc_count, user_count, computer_count,
                               original_file, html_file, metadata
                        FROM reports WHERE id = :report_id
                    """), {'report_id': report_id}).fetchone()
                else:
                    raise

            if not result:
                raise ValueError(f"Report {report_id} not found")

            # Get findings
            findings_result = session.execute(text("""
                SELECT id, report_id, tool_type, category, name, score,
                       severity, description, recommendation, status, metadata
                FROM findings WHERE report_id = :report_id
                ORDER BY category, name
            """), {'report_id': report_id}).fetchall()

        findings = [
            Finding(
                id=str(f.id),
                report_id=str(f.report_id),
                tool_type=SecurityToolType(f.tool_type),
                category=f.category,
                name=f.name,
                score=f.score,
                severity=f.severity,
                description=f.description or "",
                recommendation=f.recommendation or "",
                status=FindingStatus(f.status),
                metadata=json.loads(f.metadata) if isinstance(f.metadata, str) and f.metadata else (f.metadata if isinstance(f.metadata, dict) else {})
            )
            for f in findings_result
        ]

        return Report(
            id=str(result.id),
            tool_type=SecurityToolType(result.tool_type),
            domain=result.domain,
            report_date=result.report_date,
            upload_date=result.upload_date,
            global_score=result.pingcastle_global_score,
            high_score=result.high_score,
            medium_score=result.medium_score,
            low_score=result.low_score,
            stale_objects_score=result.stale_objects_score,
            privileged_accounts_score=result.privileged_accounts_score,
            trusts_score=result.trusts_score,
            anomalies_score=result.anomalies_score,
            domain_sid=result.domain_sid,
            domain_functional_level=result.domain_functional_level,
            forest_functional_level=result.forest_functional_level,
            maturity_level=result.maturity_level,
            dc_count=result.dc_count,
            user_count=result.user_count,
            computer_count=result.computer_count,
            original_file=result.original_file,
            html_file=result.html_file,
            metadata=result.metadata if result.metadata else {},
            findings=findings
        )

    def get_all_reports_summary(self) -> List[ReportSummary]:
        """Get summary of all reports."""
        with self._get_session() as session:
            # Try with new column name first, fallback to old if migration not run
            try:
                results = session.execute(text("""
                SELECT r.id, r.tool_type, r.domain, r.report_date, r.upload_date,
                       r.pingcastle_global_score, r.high_score, r.medium_score, r.low_score,
                       r.stale_objects_score, r.privileged_accounts_score,
                       r.trusts_score, r.anomalies_score, r.domain_sid,
                       r.domain_functional_level, r.forest_functional_level,
                       r.maturity_level, r.dc_count, r.user_count, r.computer_count,
                       r.original_file, r.html_file,
                       COUNT(f.id) as total_findings,
                       COUNT(CASE WHEN f.severity = 'high' THEN 1 END) as high_severity_findings,
                       COUNT(CASE WHEN f.severity = 'medium' THEN 1 END) as medium_severity_findings,
                       COUNT(CASE WHEN f.severity = 'low' THEN 1 END) as low_severity_findings
                FROM reports r
                LEFT JOIN findings f ON r.id = f.report_id
                GROUP BY r.id, r.tool_type, r.domain, r.report_date, r.upload_date,
                         r.pingcastle_global_score, r.high_score, r.medium_score, r.low_score,
                         r.stale_objects_score, r.privileged_accounts_score,
                         r.trusts_score, r.anomalies_score, r.domain_sid,
                         r.domain_functional_level, r.forest_functional_level,
                         r.maturity_level, r.dc_count, r.user_count, r.computer_count,
                         r.original_file, r.html_file
                ORDER BY r.report_date DESC
            """)).fetchall()
            except Exception as e:
                if "pingcastle_global_score" in str(e):
                    # Fallback to old column name if migration not run
                    results = session.execute(text("""
                        SELECT r.id, r.tool_type, r.domain, r.report_date, r.upload_date,
                               r.pingcastle_global_score, r.high_score, r.medium_score, r.low_score,
                               r.stale_objects_score, r.privileged_accounts_score,
                               r.trusts_score, r.anomalies_score, r.domain_sid,
                               r.domain_functional_level, r.forest_functional_level,
                               r.maturity_level, r.dc_count, r.user_count, r.computer_count,
                               r.original_file, r.html_file,
                               COUNT(f.id) as total_findings,
                               COUNT(CASE WHEN f.severity = 'high' THEN 1 END) as high_severity_findings,
                               COUNT(CASE WHEN f.severity = 'medium' THEN 1 END) as medium_severity_findings,
                               COUNT(CASE WHEN f.severity = 'low' THEN 1 END) as low_severity_findings
                        FROM reports r
                        LEFT JOIN findings f ON r.id = f.report_id
                        GROUP BY r.id, r.tool_type, r.domain, r.report_date, r.upload_date,
                                 r.pingcastle_global_score, r.high_score, r.medium_score, r.low_score,
                                 r.stale_objects_score, r.privileged_accounts_score,
                                 r.trusts_score, r.anomalies_score, r.domain_sid,
                                 r.domain_functional_level, r.forest_functional_level,
                                 r.maturity_level, r.dc_count, r.user_count, r.computer_count,
                                 r.original_file, r.html_file
                        ORDER BY r.report_date DESC
                    """)).fetchall()
                else:
                    raise

            return [
                ReportSummary(
                    id=str(r.id),
                    tool_type=SecurityToolType(r.tool_type),
                    domain=r.domain,
                    report_date=r.report_date,
                    upload_date=r.upload_date,
                    global_score=r.pingcastle_global_score,
                    high_score=r.high_score,
                    medium_score=r.medium_score,
                    low_score=r.low_score,
                    stale_objects_score=r.stale_objects_score,
                    privileged_accounts_score=r.privileged_accounts_score,
                    trusts_score=r.trusts_score,
                    anomalies_score=r.anomalies_score,
                    domain_sid=r.domain_sid,
                    domain_functional_level=r.domain_functional_level,
                    forest_functional_level=r.forest_functional_level,
                    maturity_level=r.maturity_level,
                    dc_count=r.dc_count,
                    user_count=r.user_count,
                    computer_count=r.computer_count,
                    original_file=r.original_file,
                    html_file=r.html_file,
                    total_findings=r.total_findings,
                    high_severity_findings=r.high_severity_findings,
                    medium_severity_findings=r.medium_severity_findings,
                    low_severity_findings=r.low_severity_findings
                )
                for r in results
            ]

    def get_score_history(self) -> List[Dict]:
        """Get historical score data for charting."""
        with self._get_session() as session:
            results = session.execute(text("""
                SELECT report_date, tool_type, 
                       stale_objects_score, privileged_accounts_score,
                       trusts_score, anomalies_score
                FROM reports
                WHERE tool_type = 'pingcastle'
                ORDER BY report_date
            """)).fetchall()

            return [
                {
                    "date": r.report_date.isoformat(),
                    "staleObjects": r.stale_objects_score,
                    "privilegedAccounts": r.privileged_accounts_score,
                    "trusts": r.trusts_score,
                    "anomalies": r.anomalies_score,
                }
                for r in results
            ]

    def get_recurring_findings(self) -> List[Dict]:
        """Get recurring findings with frequency and latest status."""
        with self._get_session() as session:
            results = session.execute(text("""
                WITH latest_report AS (
                    SELECT id FROM reports WHERE tool_type = 'pingcastle' ORDER BY report_date DESC LIMIT 1
                )
                SELECT 
                    f.tool_type,
                    f.category, 
                    f.name, 
                    r.description, 
                    COUNT(*) as count, 
                    AVG(f.score) as avg_score,
                    r.severity,
                    CASE WHEN EXISTS (
                        SELECT 1 
                        FROM findings lf 
                        JOIN latest_report ON lf.report_id = latest_report.id
                        WHERE lf.tool_type = f.tool_type 
                          AND lf.category = f.category 
                          AND lf.name = f.name
                    ) THEN true ELSE false END as in_latest
                FROM findings f
                LEFT JOIN risks r ON f.tool_type = r.tool_type 
                                  AND f.category = r.category 
                                  AND f.name = r.name
                GROUP BY f.tool_type, f.category, f.name, r.description, r.severity
                ORDER BY count DESC
            """)).fetchall()

            return [
                {
                    "toolType": r.tool_type,
                    "category": r.category,
                    "name": r.name,
                    "description": r.description or "",
                    "count": r.count,
                    "avg_score": round(r.avg_score, 1) if r.avg_score else 0,
                    "severity": r.severity or "medium",
                    "inLatest": r.in_latest
                }
                for r in results
            ]

    def get_all_findings(
        self, 
        domain: Optional[str] = None, 
        category: Optional[str] = None,
        tool_type: Optional[str] = None,
        include_accepted: bool = True
    ) -> List[Dict]:
        """Get all findings with optional filtering and acceptance status."""
        with self._get_session() as session:
            # Build the query dynamically
            query = """
                SELECT 
                    f.id,
                    f.report_id,
                    f.tool_type,
                    f.category,
                    f.name,
                    f.score,
                    f.description,
                    f.severity,
                    r.domain,
                    r.report_date,
                    ar.id as accepted_id,
                    ar.reason as accepted_reason,
                    ar.accepted_by,
                    ar.accepted_at,
                    ar.expires_at
                FROM findings f
                JOIN reports r ON f.report_id = r.id
                LEFT JOIN accepted_risks ar ON 
                    f.tool_type = ar.tool_type AND 
                    f.category = ar.category AND 
                    f.name = ar.name
                WHERE 1=1
            """
            params = {}
            
            if domain:
                query += " AND r.domain = :domain"
                params['domain'] = domain
            
            if category:
                query += " AND f.category = :category"
                params['category'] = category
            
            if tool_type:
                query += " AND f.tool_type = :tool_type"
                params['tool_type'] = tool_type
            
            if not include_accepted:
                query += " AND ar.id IS NULL"
            
            query += " ORDER BY f.score DESC, r.report_date DESC"
            
            results = session.execute(text(query), params).fetchall()
            
            return [
                {
                    "id": str(row.id),
                    "report_id": str(row.report_id),
                    "tool_type": row.tool_type,
                    "category": row.category,
                    "name": row.name,
                    "score": row.score,
                    "description": row.description or "",
                    "severity": row.severity,
                    "domain": row.domain,
                    "report_date": row.report_date.isoformat() if row.report_date else None,
                    "is_accepted": row.accepted_id is not None,
                    "accepted_reason": row.accepted_reason,
                    "accepted_by": row.accepted_by,
                    "accepted_at": row.accepted_at.isoformat() if row.accepted_at else None,
                    "expires_at": row.expires_at.isoformat() if row.expires_at else None
                }
                for row in results
            ]
    
    def get_findings_by_report(self, report_id: str) -> List[Dict]:
        """Get all findings for a specific report with acceptance status."""
        with self._get_session() as session:
            results = session.execute(text("""
                SELECT 
                    f.id,
                    f.report_id,
                    f.tool_type,
                    f.category,
                    f.name,
                    f.score,
                    f.description,
                    f.severity,
                    ar.id as accepted_id,
                    ar.reason as accepted_reason,
                    ar.accepted_by,
                    ar.accepted_at,
                    ar.expires_at
                FROM findings f
                LEFT JOIN accepted_risks ar ON 
                    f.tool_type = ar.tool_type AND 
                    f.category = ar.category AND 
                    f.name = ar.name
                WHERE f.report_id = :report_id
                ORDER BY f.score DESC
            """), {'report_id': report_id}).fetchall()
            
            return [
                {
                    "id": str(row.id),
                    "report_id": str(row.report_id),
                    "tool_type": row.tool_type,
                    "category": row.category,
                    "name": row.name,
                    "score": row.score,
                    "description": row.description or "",
                    "severity": row.severity,
                    "is_accepted": row.accepted_id is not None,
                    "accepted_reason": row.accepted_reason,
                    "accepted_by": row.accepted_by,
                    "accepted_at": row.accepted_at.isoformat() if row.accepted_at else None,
                    "expires_at": row.expires_at.isoformat() if row.expires_at else None
                }
                for row in results
            ]

    # Accepted Risks Management
    def add_accepted_risk(self, tool_type: SecurityToolType, category: str, name: str, 
                         reason: str = None, accepted_by: str = None):
        """Add an accepted risk."""
        with self._get_session() as session:
            try:
                # First, ensure the risk exists in the catalog
                self._ensure_risk_in_catalog(session, tool_type, category, name)
                
                # Then add to accepted risks
                session.execute(text("""
                    INSERT INTO accepted_risks (tool_type, category, name, reason, accepted_by)
                    VALUES (:tool_type, :category, :name, :reason, :accepted_by)
                    ON CONFLICT (tool_type, category, name) DO UPDATE SET
                        reason = EXCLUDED.reason,
                        accepted_by = EXCLUDED.accepted_by,
                        accepted_at = NOW()
                """), {
                    'tool_type': tool_type.value,
                    'category': category,
                    'name': name,
                    'reason': reason,
                    'accepted_by': accepted_by
                })
                session.commit()
                logging.info(f"Successfully added accepted risk: {tool_type.value}/{category}/{name}")
            except Exception as e:
                session.rollback()
                logging.error(f"Failed to add accepted risk {tool_type.value}/{category}/{name}: {e}")
                raise

    def remove_accepted_risk(self, tool_type: SecurityToolType, category: str, name: str):
        """Remove an accepted risk."""
        with self._get_session() as session:
            session.execute(text("""
                DELETE FROM accepted_risks 
                WHERE tool_type = :tool_type AND category = :category AND name = :name
            """), {
                'tool_type': tool_type.value,
                'category': category,
                'name': name
            })
            session.commit()

    def get_accepted_risks(self) -> List[AcceptedRisk]:
        """Get all accepted risks."""
        with self._get_session() as session:
            results = session.execute(text("""
                SELECT tool_type, category, name, reason, accepted_by, accepted_at, expires_at
                FROM accepted_risks
                ORDER BY tool_type, category, name
            """)).fetchall()

            return [
                AcceptedRisk(
                    tool_type=SecurityToolType(r.tool_type),
                    category=r.category,
                    name=r.name,
                    reason=r.reason,
                    accepted_by=r.accepted_by,
                    accepted_at=r.accepted_at,
                    expires_at=r.expires_at
                )
                for r in results
            ]

    def get_unaccepted_findings(self, findings: List[Finding]) -> List[Finding]:
        """Filter findings to only include unaccepted ones."""
        if not findings:
            return []

        with self._get_session() as session:
            # Get all accepted risks for the tool types in the findings
            tool_types = list(set(f.tool_type.value for f in findings))
            placeholders = ','.join([f':tool_type_{i}' for i in range(len(tool_types))])
            params = {f'tool_type_{i}': tool_type for i, tool_type in enumerate(tool_types)}

            results = session.execute(text(f"""
                SELECT tool_type, category, name
                FROM accepted_risks
                WHERE tool_type IN ({placeholders})
                  AND (expires_at IS NULL OR expires_at > NOW())
            """), params).fetchall()

            accepted = {(r.tool_type, r.category, r.name) for r in results}
            
            return [
                f for f in findings 
                if (f.tool_type.value, f.category, f.name) not in accepted
            ]

    # Settings Management
    def get_settings(self) -> Settings:
        """Get application settings."""
        with self._get_session() as session:
            results = session.execute(text("""
                SELECT key, value FROM settings
                WHERE key IN ('webhook_url', 'alert_message', 'retention_days', 'auto_accept_low_severity')
            """)).fetchall()

            settings_dict = {r.key: r.value for r in results}
            
            return Settings(
                webhook_url=settings_dict.get('webhook_url', ''),
                alert_message=settings_dict.get('alert_message', ''),
                retention_days=int(settings_dict.get('retention_days', 365)),
                auto_accept_low_severity=settings_dict.get('auto_accept_low_severity', 'false').lower() == 'true'
            )

    def update_settings(self, webhook_url: str, alert_message: str, 
                       retention_days: int = None, auto_accept_low_severity: bool = None):
        """Update application settings."""
        with self._get_session() as session:
            # Update webhook_url and alert_message
            session.execute(text("""
                INSERT INTO settings (key, value) VALUES ('webhook_url', :webhook_url)
                ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()
            """), {'webhook_url': webhook_url})

            session.execute(text("""
                INSERT INTO settings (key, value) VALUES ('alert_message', :alert_message)
                ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()
            """), {'alert_message': alert_message})

            if retention_days is not None:
                session.execute(text("""
                    INSERT INTO settings (key, value) VALUES ('retention_days', :retention_days)
                    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()
                """), {'retention_days': str(retention_days)})

            if auto_accept_low_severity is not None:
                session.execute(text("""
                    INSERT INTO settings (key, value) VALUES ('auto_accept_low_severity', :auto_accept_low_severity)
                    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()
                """), {'auto_accept_low_severity': str(auto_accept_low_severity).lower()})

            session.commit()

    # Group Management
    def get_monitored_groups(self) -> List[MonitoredGroup]:
        """Get all monitored groups."""
        with self._get_session() as session:
            results = session.execute(text("""
                SELECT id, group_name, group_sid, domain, description, is_active, alert_on_changes
                FROM monitored_groups
                WHERE is_active = true
                ORDER BY domain, group_name
            """)).fetchall()

            return [
                MonitoredGroup(
                    id=str(r.id),
                    group_name=r.group_name,
                    group_sid=r.group_sid,
                    domain=r.domain,
                    description=r.description,
                    is_active=r.is_active,
                    alert_on_changes=r.alert_on_changes
                )
                for r in results
            ]

    def add_monitored_group(self, group: MonitoredGroup) -> str:
        """Add a group to monitoring."""
        group_id = str(uuid4())
        with self._get_session() as session:
            session.execute(text("""
                INSERT INTO monitored_groups (id, group_name, group_sid, domain, description, is_active, alert_on_changes)
                VALUES (:id, :group_name, :group_sid, :domain, :description, :is_active, :alert_on_changes)
            """), {
                'id': group_id,
                'group_name': group.group_name,
                'group_sid': group.group_sid,
                'domain': group.domain,
                'description': group.description,
                'is_active': group.is_active,
                'alert_on_changes': group.alert_on_changes
            })
            session.commit()
            return group_id

    def save_group_memberships(self, report_id: str, memberships: List[GroupMembership]):
        """Save group membership data for a report."""
        with self._get_session() as session:
            for membership in memberships:
                session.execute(text("""
                    INSERT INTO group_memberships (
                        id, report_id, group_id, member_name, member_sid, member_type, is_direct_member
                    ) VALUES (
                        :id, :report_id, :group_id, :member_name, :member_sid, :member_type, :is_direct_member
                    )
                    ON CONFLICT (report_id, group_id, member_sid) DO NOTHING
                """), {
                    'id': str(uuid4()),
                    'report_id': report_id,
                    'group_id': membership.group_id,
                    'member_name': membership.member_name,
                    'member_sid': membership.member_sid,
                    'member_type': membership.member_type.value,
                    'is_direct_member': membership.is_direct_member
                })
            session.commit()

    def clear_all_data(self):
        """Clear all data from the database (for testing/reset)."""
        with self._get_session() as session:
            # Clear in order to respect foreign key constraints
            session.execute(text("DELETE FROM group_memberships"))
            session.execute(text("DELETE FROM accepted_risks"))
            session.execute(text("DELETE FROM findings"))
            session.execute(text("DELETE FROM reports"))
            session.execute(text("DELETE FROM monitored_groups WHERE group_name NOT IN ('Domain Admins', 'Enterprise Admins', 'Schema Admins', 'Administrators', 'Account Operators', 'Backup Operators', 'Server Operators', 'Print Operators')"))
            session.execute(text("DELETE FROM agents"))
            session.commit()
            logging.info("Database cleared successfully")

    def clear_reports_only(self):
        """Clear only reports and findings data, preserving settings, accepted risks, and agents."""
        with self._get_session() as session:
            # Clear in order to respect foreign key constraints
            session.execute(text("DELETE FROM group_memberships"))
            session.execute(text("DELETE FROM findings"))
            session.execute(text("DELETE FROM reports"))
            session.commit()
            logging.info("Reports and findings cleared successfully")

    def clear_domain_data(self, domain: str) -> Dict:
        """Clear all data for a specific domain."""
        with self._get_session() as session:
            # Get counts before deletion for reporting
            report_count = session.execute(
                text("SELECT COUNT(*) FROM reports WHERE domain = :domain"),
                {'domain': domain}
            ).scalar() or 0
            
            # Get report IDs for this domain
            report_ids = [r[0] for r in session.execute(
                text("SELECT id FROM reports WHERE domain = :domain"),
                {'domain': domain}
            ).fetchall()]
            
            findings_count = 0
            memberships_count = 0
            
            if report_ids:
                # Delete findings for these reports
                findings_count = session.execute(
                    text("DELETE FROM findings WHERE report_id = ANY(:report_ids)"),
                    {'report_ids': report_ids}
                ).rowcount or 0
                
                # Delete group memberships for these reports
                memberships_count = session.execute(
                    text("DELETE FROM group_memberships WHERE report_id = ANY(:report_ids)"),
                    {'report_ids': report_ids}
                ).rowcount or 0
            
            # Delete accepted group members for this domain
            accepted_members_count = session.execute(
                text("DELETE FROM accepted_group_members WHERE domain = :domain"),
                {'domain': domain}
            ).rowcount or 0
            
            # Delete monitored groups for this domain (except defaults)
            monitored_groups_count = session.execute(
                text("""
                    DELETE FROM monitored_groups 
                    WHERE domain = :domain 
                    AND group_name NOT IN ('Domain Admins', 'Enterprise Admins', 'Schema Admins', 
                                          'Administrators', 'Account Operators', 'Backup Operators', 
                                          'Server Operators', 'Print Operators')
                """),
                {'domain': domain}
            ).rowcount or 0
            
            # Delete risk data for this domain
            risk_assessments_count = session.execute(
                text("DELETE FROM domain_risk_assessments WHERE domain = :domain"),
                {'domain': domain}
            ).rowcount or 0
            
            global_risk_count = session.execute(
                text("DELETE FROM global_risk_scores WHERE domain = :domain"),
                {'domain': domain}
            ).rowcount or 0
            
            # Delete reports for this domain
            session.execute(
                text("DELETE FROM reports WHERE domain = :domain"),
                {'domain': domain}
            )
            
            session.commit()
            
            result = {
                'domain': domain,
                'reports_deleted': report_count,
                'findings_deleted': findings_count,
                'memberships_deleted': memberships_count,
                'accepted_members_deleted': accepted_members_count,
                'monitored_groups_deleted': monitored_groups_count,
                'risk_assessments_deleted': risk_assessments_count,
                'global_risk_deleted': global_risk_count
            }
            
            logging.info(f"Domain data cleared for {domain}: {result}")
            return result

    def get_data_summary(self) -> List[Dict]:
        """Get data summary per domain for management UI."""
        with self._get_session() as session:
            results = session.execute(text("""
                SELECT 
                    r.domain,
                    COUNT(DISTINCT r.id) as report_count,
                    COUNT(DISTINCT f.id) as finding_count,
                    COUNT(DISTINCT gm.id) as membership_count,
                    MAX(r.report_date) as latest_report,
                    MIN(r.report_date) as oldest_report
                FROM reports r
                LEFT JOIN findings f ON r.id = f.report_id
                LEFT JOIN group_memberships gm ON r.id = gm.report_id
                GROUP BY r.domain
                ORDER BY r.domain
            """)).fetchall()
            
            return [
                {
                    'domain': r.domain,
                    'report_count': r.report_count,
                    'finding_count': r.finding_count,
                    'membership_count': r.membership_count,
                    'latest_report': r.latest_report.isoformat() if r.latest_report else None,
                    'oldest_report': r.oldest_report.isoformat() if r.oldest_report else None
                }
                for r in results
            ]

    def log_alert(self, message: str):
        """Log an alert message."""
        logging.info(f"Alert: {message}")

    # Accepted Group Members Management
    def get_accepted_group_members(self, domain: str = None, group_name: str = None) -> List:
        """Get accepted group members with optional filtering."""
        with self._get_session() as session:
            try:
                query = "SELECT id, group_name, member_name, member_sid, domain, reason, accepted_by, accepted_at, expires_at FROM accepted_group_members WHERE 1=1"
                params = {}
                
                if domain:
                    query += " AND domain = :domain"
                    params['domain'] = domain
                if group_name:
                    query += " AND group_name = :group_name"
                    params['group_name'] = group_name
                    
                query += " ORDER BY accepted_at DESC"
                
                results = session.execute(text(query), params).fetchall()
                
                from server.models import AcceptedGroupMember
                return [
                    AcceptedGroupMember(
                        id=str(r.id),
                        group_name=r.group_name,
                        member_name=r.member_name,
                        member_sid=r.member_sid,
                        domain=r.domain,
                        reason=r.reason,
                        accepted_by=r.accepted_by,
                        accepted_at=r.accepted_at,
                        expires_at=r.expires_at
                    )
                    for r in results
                ]
            except Exception as e:
                if "accepted_group_members" in str(e) and "does not exist" in str(e):
                    logging.warning("accepted_group_members table does not exist - returning empty list. Run migration_002_add_group_member_tables.sql")
                    return []
                raise

    def add_accepted_group_member(self, member) -> str:
        """Add an accepted group member."""
        with self._get_session() as session:
            try:
                member_id = str(uuid4())
                session.execute(text("""
                    INSERT INTO accepted_group_members (
                        id, group_name, member_name, member_sid, domain, reason, accepted_by
                    ) VALUES (
                        :id, :group_name, :member_name, :member_sid, :domain, :reason, :accepted_by
                    )
                    ON CONFLICT (domain, group_name, member_name) DO UPDATE SET
                        reason = EXCLUDED.reason,
                        accepted_by = EXCLUDED.accepted_by,
                        accepted_at = NOW(),
                        updated_at = NOW()
                """), {
                    'id': member_id,
                    'group_name': member.group_name,
                    'member_name': member.member_name,
                    'member_sid': member.member_sid,
                    'domain': member.domain,
                    'reason': member.reason,
                    'accepted_by': member.accepted_by
                })
                session.commit()
                return member_id
            except Exception as e:
                if "accepted_group_members" in str(e) and "does not exist" in str(e):
                    logging.warning("accepted_group_members table does not exist - cannot add member. Run migration_002_add_group_member_tables.sql")
                    return ""
                raise

    def remove_accepted_group_member(self, domain: str, group_name: str, member_name: str):
        """Remove an accepted group member."""
        with self._get_session() as session:
            try:
                session.execute(text("""
                    DELETE FROM accepted_group_members 
                    WHERE domain = :domain AND group_name = :group_name AND member_name = :member_name
                """), {
                    'domain': domain,
                    'group_name': group_name,
                    'member_name': member_name
                })
                session.commit()
            except Exception as e:
                if "accepted_group_members" in str(e) and "does not exist" in str(e):
                    logging.warning("accepted_group_members table does not exist - cannot remove member. Run migration_002_add_group_member_tables.sql")
                    return
                raise

    # Group Risk Configuration Management
    def get_group_risk_configs(self, domain: str = None) -> List:
        """Get group risk configurations."""
        with self._get_session() as session:
            try:
                query = "SELECT id, group_name, domain, base_risk_score, max_acceptable_members, alert_threshold, description FROM group_risk_configs WHERE 1=1"
                params = {}
                
                if domain:
                    query += " AND domain = :domain"
                    params['domain'] = domain
                    
                query += " ORDER BY group_name"
                
                results = session.execute(text(query), params).fetchall()
                
                from server.models import GroupRiskConfig
                return [
                    GroupRiskConfig(
                        id=str(r.id),
                        group_name=r.group_name,
                        domain=r.domain,
                        base_risk_score=r.base_risk_score,
                        max_acceptable_members=r.max_acceptable_members,
                        alert_threshold=r.alert_threshold,
                        description=r.description
                    )
                    for r in results
                ]
            except Exception as e:
                if "group_risk_configs" in str(e) and "does not exist" in str(e):
                    logging.warning("group_risk_configs table does not exist - returning empty list. Run migration_002_add_group_member_tables.sql")
                    return []
                raise

    def save_group_risk_config(self, config) -> str:
        """Save a group risk configuration."""
        with self._get_session() as session:
            try:
                config_id = str(uuid4())
                session.execute(text("""
                    INSERT INTO group_risk_configs (
                        id, group_name, domain, base_risk_score, max_acceptable_members, alert_threshold, description
                    ) VALUES (
                        :id, :group_name, :domain, :base_risk_score, :max_acceptable_members, :alert_threshold, :description
                    )
                    ON CONFLICT (domain, group_name) DO UPDATE SET
                        base_risk_score = EXCLUDED.base_risk_score,
                        max_acceptable_members = EXCLUDED.max_acceptable_members,
                        alert_threshold = EXCLUDED.alert_threshold,
                        description = EXCLUDED.description,
                        updated_at = NOW()
                """), {
                    'id': config_id,
                    'group_name': config.group_name,
                    'domain': config.domain,
                    'base_risk_score': config.base_risk_score,
                    'max_acceptable_members': config.max_acceptable_members,
                    'alert_threshold': config.alert_threshold,
                    'description': config.description
                })
                session.commit()
                return config_id
            except Exception as e:
                if "group_risk_configs" in str(e) and "does not exist" in str(e):
                    logging.warning("group_risk_configs table does not exist - cannot save config. Run migration_002_add_group_member_tables.sql")
                    return ""
                raise

    def get_grouped_findings(
        self, 
        domain: Optional[str] = None, 
        category: Optional[str] = None,
        tool_type: Optional[str] = None,
        include_accepted: bool = True
    ) -> List[Dict]:
        """Get findings grouped by (tool_type, category, name) with occurrence counts and latest report presence.
        
        Returns aggregated findings where identical findings from multiple reports
        are grouped together with:
        - occurrence_count: How many times this finding appeared across reports
        - in_latest_report: Whether this finding is present in the most recent report
        - first_seen: Date when this finding was first observed
        - last_seen: Date when this finding was most recently observed
        - domains: List of domains where this finding was observed
        """
        with self._get_session() as session:
            # Build the base query with proper grouping and aggregation
            query = """
                WITH latest_report AS (
                    SELECT id, report_date
                    FROM reports 
                    WHERE tool_type = :base_tool_type
                    ORDER BY report_date DESC 
                    LIMIT 1
                ),
                grouped_findings AS (
                    SELECT 
                        f.tool_type,
                        f.category,
                        f.name,
                        MAX(f.description) as description,
                        MAX(f.recommendation) as recommendation,
                        MAX(f.severity) as severity,
                        MAX(f.score) as max_score,
                        MIN(f.score) as min_score,
                        AVG(f.score) as avg_score,
                        COUNT(*) as occurrence_count,
                        MIN(r.report_date) as first_seen,
                        MAX(r.report_date) as last_seen,
                        array_agg(DISTINCT r.domain) as domains,
                        array_agg(DISTINCT r.id) as report_ids,
                        CASE WHEN EXISTS (
                            SELECT 1 
                            FROM findings lf 
                            JOIN latest_report lr ON lf.report_id = lr.id
                            WHERE lf.tool_type = f.tool_type 
                              AND lf.category = f.category 
                              AND lf.name = f.name
                        ) THEN true ELSE false END as in_latest_report
                    FROM findings f
                    JOIN reports r ON f.report_id = r.id
                    WHERE 1=1
            """
            
            params = {'base_tool_type': tool_type or 'pingcastle'}
            
            if domain:
                query += " AND r.domain = :domain"
                params['domain'] = domain
            
            if category:
                query += " AND f.category = :category"
                params['category'] = category
            
            if tool_type:
                query += " AND f.tool_type = :tool_type"
                params['tool_type'] = tool_type
            
            query += """
                    GROUP BY f.tool_type, f.category, f.name
                )
                SELECT 
                    gf.*,
                    ar.id as accepted_id,
                    ar.reason as accepted_reason,
                    ar.accepted_by,
                    ar.accepted_at,
                    ar.expires_at
                FROM grouped_findings gf
                LEFT JOIN accepted_risks ar ON 
                    gf.tool_type = ar.tool_type AND 
                    gf.category = ar.category AND 
                    gf.name = ar.name
            """
            
            if not include_accepted:
                query += " WHERE ar.id IS NULL"
            
            query += " ORDER BY gf.in_latest_report DESC, gf.occurrence_count DESC, gf.max_score DESC"
            
            results = session.execute(text(query), params).fetchall()
            
            return [
                {
                    "tool_type": row.tool_type,
                    "category": row.category,
                    "name": row.name,
                    "description": row.description or "",
                    "recommendation": row.recommendation or "",
                    "severity": row.severity,
                    "max_score": row.max_score,
                    "min_score": row.min_score,
                    "avg_score": round(float(row.avg_score), 1) if row.avg_score else 0,
                    "occurrence_count": row.occurrence_count,
                    "first_seen": row.first_seen.isoformat() if row.first_seen else None,
                    "last_seen": row.last_seen.isoformat() if row.last_seen else None,
                    "domains": list(row.domains) if row.domains else [],
                    "report_ids": [str(rid) for rid in row.report_ids] if row.report_ids else [],
                    "in_latest_report": row.in_latest_report,
                    "is_accepted": row.accepted_id is not None,
                    "accepted_reason": row.accepted_reason,
                    "accepted_by": row.accepted_by,
                    "accepted_at": row.accepted_at.isoformat() if row.accepted_at else None,
                    "expires_at": row.expires_at.isoformat() if row.expires_at else None
                }
                for row in results
            ]

    def get_grouped_findings_summary(
        self, 
        domain: Optional[str] = None,
        tool_type: Optional[str] = None
    ) -> Dict:
        """Get a summary of grouped findings by category."""
        grouped = self.get_grouped_findings(domain=domain, tool_type=tool_type or "pingcastle")
        
        # Count by category
        categories = {
            "PrivilegedAccounts": {"total": 0, "accepted": 0, "total_score": 0, "in_latest": 0},
            "StaleObjects": {"total": 0, "accepted": 0, "total_score": 0, "in_latest": 0},
            "Trusts": {"total": 0, "accepted": 0, "total_score": 0, "in_latest": 0},
            "Anomalies": {"total": 0, "accepted": 0, "total_score": 0, "in_latest": 0},
        }
        
        for finding in grouped:
            cat = finding.get("category", "")
            if cat in categories:
                categories[cat]["total"] += 1
                categories[cat]["total_score"] += finding.get("max_score", 0)
                if finding.get("is_accepted"):
                    categories[cat]["accepted"] += 1
                if finding.get("in_latest_report"):
                    categories[cat]["in_latest"] += 1
        
        total_in_latest = sum(1 for f in grouped if f.get("in_latest_report"))
        
        return {
            "categories": categories,
            "total_unique_findings": len(grouped),
            "total_accepted": sum(1 for f in grouped if f.get("is_accepted")),
            "total_in_latest": total_in_latest,
            "total_score": sum(f.get("max_score", 0) for f in grouped)
        }

    # ==========================================================================
    # Optimized Domain Queries - Fast domain retrieval without loading reports
    # ==========================================================================
    
    def get_domains(self) -> List[str]:
        """
        Get list of unique domains efficiently.
        Returns just domain names without loading full reports.
        """
        with self._get_session() as session:
            try:
                results = session.execute(text("""
                    SELECT DISTINCT domain 
                    FROM reports 
                    ORDER BY domain
                """)).fetchall()
                return [r.domain for r in results]
            except Exception as e:
                logging.error(f"Failed to get domains: {e}")
                return []

    def get_domains_with_stats(self) -> List[Dict]:
        """
        Get domains with basic statistics efficiently.
        Returns domain info without loading full report data.
        """
        with self._get_session() as session:
            try:
                results = session.execute(text("""
                    SELECT 
                        domain,
                        COUNT(*) as report_count,
                        MAX(report_date) as latest_report_date,
                        MIN(report_date) as first_report_date
                    FROM reports
                    GROUP BY domain
                    ORDER BY MAX(report_date) DESC
                """)).fetchall()
                
                return [
                    {
                        'domain': r.domain,
                        'report_count': r.report_count,
                        'latest_report_date': r.latest_report_date.isoformat() if r.latest_report_date else None,
                        'first_report_date': r.first_report_date.isoformat() if r.first_report_date else None
                    }
                    for r in results
                ]
            except Exception as e:
                logging.error(f"Failed to get domains with stats: {e}")
                return []

    def get_latest_report(
        self,
        domain: Optional[str] = None,
        tool_type: Optional[str] = None
    ) -> Optional[Dict]:
        """
        Get the most recent report efficiently.
        Optionally filtered by domain and/or tool type.
        """
        with self._get_session() as session:
            try:
                where_clauses = ["1=1"]
                params = {}
                
                if domain:
                    where_clauses.append("r.domain = :domain")
                    params['domain'] = domain
                
                if tool_type:
                    where_clauses.append("r.tool_type = :tool_type")
                    params['tool_type'] = tool_type
                
                where_sql = " AND ".join(where_clauses)
                
                result = session.execute(text(f"""
                    SELECT 
                        r.id, r.tool_type, r.domain, r.report_date, r.upload_date,
                        r.pingcastle_global_score as global_score,
                        r.domain_sid, r.original_file, r.html_file,
                        r.pingcastle_stale_objects_score,
                        r.pingcastle_trust_score,
                        r.pingcastle_privileged_score,
                        r.pingcastle_anomaly_score,
                        COUNT(f.id) as total_findings,
                        COUNT(f.id) FILTER (WHERE f.severity = 'high') as high_severity_findings,
                        COUNT(f.id) FILTER (WHERE f.severity = 'medium') as medium_severity_findings,
                        COUNT(f.id) FILTER (WHERE f.severity = 'low') as low_severity_findings
                    FROM reports r
                    LEFT JOIN findings f ON r.id = f.report_id
                    WHERE {where_sql}
                    GROUP BY r.id, r.tool_type, r.domain, r.report_date, r.upload_date,
                             r.pingcastle_global_score, r.domain_sid, r.original_file, r.html_file,
                             r.pingcastle_stale_objects_score, r.pingcastle_trust_score,
                             r.pingcastle_privileged_score, r.pingcastle_anomaly_score
                    ORDER BY r.report_date DESC
                    LIMIT 1
                """), params).fetchone()
                
                if not result:
                    return None
                
                return {
                    'id': str(result.id),
                    'tool_type': result.tool_type,
                    'domain': result.domain,
                    'report_date': result.report_date.isoformat(),
                    'upload_date': result.upload_date.isoformat() if result.upload_date else None,
                    'global_score': result.global_score or 0,
                    'domain_sid': result.domain_sid,
                    'original_file': result.original_file,
                    'html_file': result.html_file,
                    'stale_objects_score': result.pingcastle_stale_objects_score,
                    'trust_score': result.pingcastle_trust_score,
                    'privileged_score': result.pingcastle_privileged_score,
                    'anomaly_score': result.pingcastle_anomaly_score,
                    'total_findings': result.total_findings,
                    'high_severity_findings': result.high_severity_findings,
                    'medium_severity_findings': result.medium_severity_findings,
                    'low_severity_findings': result.low_severity_findings
                }
                
            except Exception as e:
                logging.error(f"Failed to get latest report: {e}")
                return None

    def get_reports_paginated(
        self, 
        page: int = 1, 
        page_size: int = 20,
        domain: Optional[str] = None,
        tool_type: Optional[str] = None,
        sort_by: str = 'report_date',
        sort_order: str = 'desc'
    ) -> Dict:
        """
        Get paginated report summaries efficiently.
        Returns light-weight summaries for listing pages.
        """
        with self._get_session() as session:
            try:
                # Calculate offset
                offset = (page - 1) * page_size
                
                # Build query with optional filters
                where_clauses = ["1=1"]
                params = {'limit': page_size, 'offset': offset}
                
                if domain:
                    where_clauses.append("r.domain = :domain")
                    params['domain'] = domain
                
                if tool_type:
                    where_clauses.append("r.tool_type = :tool_type")
                    params['tool_type'] = tool_type
                
                where_sql = " AND ".join(where_clauses)
                
                # Validate sort column
                valid_sort_columns = ['report_date', 'domain', 'tool_type', 'pingcastle_global_score']
                if sort_by not in valid_sort_columns:
                    sort_by = 'report_date'
                
                sort_direction = 'DESC' if sort_order.lower() == 'desc' else 'ASC'
                
                # Get total count
                count_result = session.execute(text(f"""
                    SELECT COUNT(*) FROM reports r WHERE {where_sql}
                """), params).scalar()
                
                # Get paginated results
                results = session.execute(text(f"""
                    SELECT 
                        r.id, r.tool_type, r.domain, r.report_date, r.upload_date,
                        r.pingcastle_global_score as global_score,
                        r.domain_sid, r.html_file,
                        COUNT(f.id) as total_findings,
                        COUNT(f.id) FILTER (WHERE f.severity = 'high') as high_severity_findings,
                        COUNT(f.id) FILTER (WHERE f.severity = 'medium') as medium_severity_findings,
                        COUNT(f.id) FILTER (WHERE f.severity = 'low') as low_severity_findings
                    FROM reports r
                    LEFT JOIN findings f ON r.id = f.report_id
                    WHERE {where_sql}
                    GROUP BY r.id, r.tool_type, r.domain, r.report_date, r.upload_date,
                             r.pingcastle_global_score, r.domain_sid, r.html_file
                    ORDER BY r.{sort_by} {sort_direction}
                    LIMIT :limit OFFSET :offset
                """), params).fetchall()
                
                return {
                    'page': page,
                    'page_size': page_size,
                    'total_count': count_result,
                    'total_pages': (count_result + page_size - 1) // page_size,
                    'reports': [
                        {
                            'id': str(r.id),
                            'tool_type': r.tool_type,
                            'domain': r.domain,
                            'report_date': r.report_date.isoformat(),
                            'upload_date': r.upload_date.isoformat() if r.upload_date else None,
                            'global_score': r.global_score or 0,
                            'domain_sid': r.domain_sid,
                            'html_file': r.html_file,
                            'total_findings': r.total_findings,
                            'high_severity_findings': r.high_severity_findings,
                            'medium_severity_findings': r.medium_severity_findings,
                            'low_severity_findings': r.low_severity_findings
                        }
                        for r in results
                    ]
                }
                
            except Exception as e:
                logging.error(f"Failed to get paginated reports: {e}")
                return {
                    'page': page,
                    'page_size': page_size,
                    'total_count': 0,
                    'total_pages': 0,
                    'reports': []
                }

    # ==========================================================================
    # Reports KPIs - Pre-aggregated metrics for dashboard performance
    # ==========================================================================
    
    def save_report_kpis(self, report: Report, findings_stats: Dict = None) -> str:
        """
        Save or update KPIs for a report. 
        Called automatically after saving a report.
        
        Args:
            report: The Report object
            findings_stats: Optional pre-computed findings statistics
            
        Returns:
            KPI record ID
        """
        with self._get_session() as session:
            try:
                # Calculate findings stats if not provided
                if findings_stats is None:
                    result = session.execute(text("""
                        SELECT 
                            COUNT(*) as total,
                            COUNT(*) FILTER (WHERE severity = 'high') as high,
                            COUNT(*) FILTER (WHERE severity = 'medium') as medium,
                            COUNT(*) FILTER (WHERE severity = 'low') as low
                        FROM findings 
                        WHERE report_id = :report_id
                    """), {'report_id': report.id}).fetchone()
                    
                    findings_stats = {
                        'total': result.total if result else 0,
                        'high': result.high if result else 0,
                        'medium': result.medium if result else 0,
                        'low': result.low if result else 0
                    }
                
                # Insert or update KPIs
                result = session.execute(text("""
                    INSERT INTO reports_kpis (
                        report_id, tool_type, domain, report_date,
                        global_score, stale_objects_score, privileged_accounts_score,
                        trusts_score, anomalies_score,
                        user_count, computer_count, dc_count,
                        total_findings, high_severity_findings, 
                        medium_severity_findings, low_severity_findings
                    ) VALUES (
                        :report_id, :tool_type, :domain, :report_date,
                        :global_score, :stale_objects_score, :privileged_accounts_score,
                        :trusts_score, :anomalies_score,
                        :user_count, :computer_count, :dc_count,
                        :total_findings, :high_severity_findings,
                        :medium_severity_findings, :low_severity_findings
                    )
                    ON CONFLICT (report_id) DO UPDATE SET
                        tool_type = EXCLUDED.tool_type,
                        domain = EXCLUDED.domain,
                        report_date = EXCLUDED.report_date,
                        global_score = EXCLUDED.global_score,
                        stale_objects_score = EXCLUDED.stale_objects_score,
                        privileged_accounts_score = EXCLUDED.privileged_accounts_score,
                        trusts_score = EXCLUDED.trusts_score,
                        anomalies_score = EXCLUDED.anomalies_score,
                        user_count = EXCLUDED.user_count,
                        computer_count = EXCLUDED.computer_count,
                        dc_count = EXCLUDED.dc_count,
                        total_findings = EXCLUDED.total_findings,
                        high_severity_findings = EXCLUDED.high_severity_findings,
                        medium_severity_findings = EXCLUDED.medium_severity_findings,
                        low_severity_findings = EXCLUDED.low_severity_findings,
                        updated_at = NOW()
                    RETURNING id
                """), {
                    'report_id': report.id,
                    'tool_type': report.tool_type.value,
                    'domain': report.domain,
                    'report_date': report.report_date,
                    'global_score': report.global_score or 0,
                    'stale_objects_score': report.stale_objects_score or 0,
                    'privileged_accounts_score': report.privileged_accounts_score or 0,
                    'trusts_score': report.trusts_score or 0,
                    'anomalies_score': report.anomalies_score or 0,
                    'user_count': report.user_count or 0,
                    'computer_count': report.computer_count or 0,
                    'dc_count': report.dc_count or 0,
                    'total_findings': findings_stats.get('total', 0),
                    'high_severity_findings': findings_stats.get('high', 0),
                    'medium_severity_findings': findings_stats.get('medium', 0),
                    'low_severity_findings': findings_stats.get('low', 0)
                })
                
                kpi_id = str(result.scalar())
                session.commit()
                logging.info(f"Saved KPIs for report {report.id}")
                return kpi_id
                
            except Exception as e:
                session.rollback()
                logging.error(f"Failed to save report KPIs: {e}")
                raise

    def update_report_kpis_group_metrics(
        self, 
        report_id: str,
        total_groups: int,
        total_members: int,
        accepted_members: int,
        unaccepted_members: int,
        risk_score: float = 0.0
    ) -> None:
        """
        Update group-related KPIs for a report.
        Called after processing domain group data.
        
        Args:
            report_id: Report ID to update
            total_groups: Total number of groups
            total_members: Total group members across all groups
            accepted_members: Number of accepted members
            unaccepted_members: Number of unaccepted members
            risk_score: Domain group risk score
        """
        with self._get_session() as session:
            try:
                session.execute(text("""
                    UPDATE reports_kpis SET
                        total_groups = :total_groups,
                        total_group_members = :total_members,
                        accepted_group_members = :accepted_members,
                        unaccepted_group_members = :unaccepted_members,
                        domain_group_risk_score = :risk_score,
                        updated_at = NOW()
                    WHERE report_id = :report_id
                """), {
                    'report_id': report_id,
                    'total_groups': total_groups,
                    'total_members': total_members,
                    'accepted_members': accepted_members,
                    'unaccepted_members': unaccepted_members,
                    'risk_score': risk_score
                })
                session.commit()
                logging.info(f"Updated group KPIs for report {report_id}")
                
            except Exception as e:
                session.rollback()
                logging.error(f"Failed to update group KPIs: {e}")
                raise

    def get_dashboard_kpis(self, domain: Optional[str] = None) -> Dict:
        """
        Get dashboard KPIs optimized for fast loading.
        
        Uses the composite view v_dashboard_composite which fetches:
        - PingCastle scores from the latest PingCastle report
        - Domain Group metrics from the latest domain_analysis report
        - Merged infrastructure data from whichever has it
        
        This prevents PingCastle scores from being overwritten when
        a domain_analysis report is uploaded after a PingCastle report.
        
        Args:
            domain: Optional domain filter. If None, returns KPIs for latest domain.
            
        Returns:
            Dictionary with dashboard KPI data
        """
        with self._get_session() as session:
            try:
                # Try using the composite view first (migration_008)
                return self._get_dashboard_kpis_composite(session, domain)
            except Exception as e:
                logging.warning(f"Composite view query failed, using fallback: {e}")
                # Fallback to old method if composite view doesn't exist
                return self._get_dashboard_kpis_legacy(session, domain)
    
    def _get_dashboard_kpis_composite(self, session, domain: Optional[str] = None) -> Dict:
        """
        Get dashboard KPIs using the composite view.
        
        This view properly separates PingCastle scores from domain_analysis metrics,
        ensuring that uploading a domain_analysis report doesn't overwrite PingCastle scores.
        """
        if domain:
            query = text("""
                SELECT 
                    dc.domain,
                    dc.pingcastle_global_score,
                    dc.stale_objects_score,
                    dc.privileged_accounts_score,
                    dc.trusts_score,
                    dc.anomalies_score,
                    dc.pingcastle_report_date,
                    dc.pingcastle_report_id,
                    dc.total_groups,
                    dc.total_group_members,
                    dc.accepted_group_members,
                    dc.unaccepted_group_members,
                    dc.domain_group_risk_score,
                    dc.domain_analysis_report_date,
                    dc.total_findings,
                    dc.high_severity_findings,
                    dc.medium_severity_findings,
                    dc.low_severity_findings,
                    dc.user_count,
                    dc.computer_count,
                    dc.dc_count,
                    dc.latest_report_date,
                    dc.data_sources,
                    -- Get domain metadata from the PingCastle report if available
                    r.domain_sid,
                    r.domain_functional_level,
                    r.forest_functional_level,
                    r.maturity_level
                FROM v_dashboard_composite dc
                LEFT JOIN reports r ON dc.pingcastle_report_id = r.id
                WHERE dc.domain = :domain
            """)
            result = session.execute(query, {'domain': domain}).fetchone()
        else:
            # Get latest domain based on most recent report
            query = text("""
                SELECT 
                    dc.domain,
                    dc.pingcastle_global_score,
                    dc.stale_objects_score,
                    dc.privileged_accounts_score,
                    dc.trusts_score,
                    dc.anomalies_score,
                    dc.pingcastle_report_date,
                    dc.pingcastle_report_id,
                    dc.total_groups,
                    dc.total_group_members,
                    dc.accepted_group_members,
                    dc.unaccepted_group_members,
                    dc.domain_group_risk_score,
                    dc.domain_analysis_report_date,
                    dc.total_findings,
                    dc.high_severity_findings,
                    dc.medium_severity_findings,
                    dc.low_severity_findings,
                    dc.user_count,
                    dc.computer_count,
                    dc.dc_count,
                    dc.latest_report_date,
                    dc.data_sources,
                    r.domain_sid,
                    r.domain_functional_level,
                    r.forest_functional_level,
                    r.maturity_level
                FROM v_dashboard_composite dc
                LEFT JOIN reports r ON dc.pingcastle_report_id = r.id
                ORDER BY dc.latest_report_date DESC NULLS LAST
                LIMIT 1
            """)
            result = session.execute(query).fetchone()
        
        if not result:
            return {
                'status': 'no_data',
                'message': 'No reports found'
            }
        
        return {
            'status': 'ok',
            'kpis': {
                'domain': result.domain,
                'report_date': result.latest_report_date.isoformat() if result.latest_report_date else None,
                'domain_sid': result.domain_sid,
                'domain_functional_level': result.domain_functional_level,
                'forest_functional_level': result.forest_functional_level,
                'maturity_level': result.maturity_level,
                # PingCastle scores (from PingCastle report only)
                'global_score': result.pingcastle_global_score or 0,
                'stale_objects_score': result.stale_objects_score or 0,
                'privileged_accounts_score': result.privileged_accounts_score or 0,
                'trusts_score': result.trusts_score or 0,
                'anomalies_score': result.anomalies_score or 0,
                'pingcastle_report_date': result.pingcastle_report_date.isoformat() if result.pingcastle_report_date else None,
                # Domain Group metrics (from domain_analysis report only)
                'total_groups': result.total_groups or 0,
                'total_group_members': result.total_group_members or 0,
                'accepted_group_members': result.accepted_group_members or 0,
                'unaccepted_group_members': result.unaccepted_group_members or 0,
                'domain_group_risk_score': float(result.domain_group_risk_score) if result.domain_group_risk_score else 0.0,
                'domain_analysis_report_date': result.domain_analysis_report_date.isoformat() if result.domain_analysis_report_date else None,
                # Findings (from PingCastle)
                'total_findings': result.total_findings or 0,
                'high_severity_findings': result.high_severity_findings or 0,
                'medium_severity_findings': result.medium_severity_findings or 0,
                'low_severity_findings': result.low_severity_findings or 0,
                # Infrastructure metrics (merged)
                'user_count': result.user_count or 0,
                'computer_count': result.computer_count or 0,
                'dc_count': result.dc_count or 0,
                # Metadata
                'data_sources': result.data_sources
            }
        }
    
    def _get_dashboard_kpis_legacy(self, session, domain: Optional[str] = None) -> Dict:
        """
        Legacy method for dashboard KPIs (before composite view).
        Used as fallback if v_dashboard_composite doesn't exist.
        """
        try:
            if domain:
                query = text("""
                    SELECT 
                        rk.id,
                        rk.report_id,
                        rk.tool_type,
                        rk.domain,
                        rk.report_date,
                        rk.global_score,
                        rk.stale_objects_score,
                        rk.privileged_accounts_score,
                        rk.trusts_score,
                        rk.anomalies_score,
                        rk.user_count,
                        rk.computer_count,
                        rk.dc_count,
                        rk.total_findings,
                        rk.high_severity_findings,
                        rk.medium_severity_findings,
                        rk.low_severity_findings,
                        rk.total_groups,
                        rk.total_group_members,
                        rk.accepted_group_members,
                        rk.unaccepted_group_members,
                        rk.domain_group_risk_score,
                        r.domain_sid,
                        r.domain_functional_level,
                        r.forest_functional_level,
                        r.maturity_level
                    FROM reports_kpis rk
                    JOIN reports r ON rk.report_id = r.id
                    WHERE rk.domain = :domain
                    ORDER BY rk.report_date DESC
                    LIMIT 1
                """)
                result = session.execute(query, {'domain': domain}).fetchone()
            else:
                query = text("""
                    SELECT 
                        rk.id,
                        rk.report_id,
                        rk.tool_type,
                        rk.domain,
                        rk.report_date,
                        rk.global_score,
                        rk.stale_objects_score,
                        rk.privileged_accounts_score,
                        rk.trusts_score,
                        rk.anomalies_score,
                        rk.user_count,
                        rk.computer_count,
                        rk.dc_count,
                        rk.total_findings,
                        rk.high_severity_findings,
                        rk.medium_severity_findings,
                        rk.low_severity_findings,
                        rk.total_groups,
                        rk.total_group_members,
                        rk.accepted_group_members,
                        rk.unaccepted_group_members,
                        rk.domain_group_risk_score,
                        r.domain_sid,
                        r.domain_functional_level,
                        r.forest_functional_level,
                        r.maturity_level
                    FROM reports_kpis rk
                    JOIN reports r ON rk.report_id = r.id
                    ORDER BY rk.report_date DESC
                    LIMIT 1
                """)
                result = session.execute(query).fetchone()
            
            if not result:
                return {
                    'status': 'no_data',
                    'message': 'No reports found'
                }
            
            return {
                'status': 'ok',
                'kpis': {
                    'id': str(result.id),
                    'report_id': str(result.report_id),
                    'tool_type': result.tool_type,
                    'domain': result.domain,
                    'report_date': result.report_date.isoformat(),
                    'domain_sid': result.domain_sid,
                    'domain_functional_level': result.domain_functional_level,
                    'forest_functional_level': result.forest_functional_level,
                    'maturity_level': result.maturity_level,
                    'global_score': result.global_score,
                    'stale_objects_score': result.stale_objects_score,
                    'privileged_accounts_score': result.privileged_accounts_score,
                    'trusts_score': result.trusts_score,
                    'anomalies_score': result.anomalies_score,
                    'user_count': result.user_count,
                    'computer_count': result.computer_count,
                    'dc_count': result.dc_count,
                    'total_findings': result.total_findings,
                    'high_severity_findings': result.high_severity_findings,
                    'medium_severity_findings': result.medium_severity_findings,
                    'low_severity_findings': result.low_severity_findings,
                    'total_groups': result.total_groups,
                    'total_group_members': result.total_group_members,
                    'accepted_group_members': result.accepted_group_members,
                    'unaccepted_group_members': result.unaccepted_group_members,
                    'domain_group_risk_score': float(result.domain_group_risk_score) if result.domain_group_risk_score else 0.0
                }
            }
            
        except Exception as e:
            logging.error(f"Legacy dashboard KPIs failed: {e}")
            return self._get_fallback_dashboard_kpis(session, domain)

    def _get_fallback_dashboard_kpis(self, session, domain: Optional[str] = None) -> Dict:
        """Fallback method if reports_kpis table doesn't exist yet."""
        try:
            if domain:
                query = text("""
                    SELECT r.*, 
                           COUNT(f.id) as total_findings,
                           COUNT(f.id) FILTER (WHERE f.severity = 'high') as high_severity_findings,
                           COUNT(f.id) FILTER (WHERE f.severity = 'medium') as medium_severity_findings,
                           COUNT(f.id) FILTER (WHERE f.severity = 'low') as low_severity_findings
                    FROM reports r
                    LEFT JOIN findings f ON r.id = f.report_id
                    WHERE r.domain = :domain
                    GROUP BY r.id
                    ORDER BY r.report_date DESC
                    LIMIT 1
                """)
                result = session.execute(query, {'domain': domain}).fetchone()
            else:
                query = text("""
                    SELECT r.*, 
                           COUNT(f.id) as total_findings,
                           COUNT(f.id) FILTER (WHERE f.severity = 'high') as high_severity_findings,
                           COUNT(f.id) FILTER (WHERE f.severity = 'medium') as medium_severity_findings,
                           COUNT(f.id) FILTER (WHERE f.severity = 'low') as low_severity_findings
                    FROM reports r
                    LEFT JOIN findings f ON r.id = f.report_id
                    GROUP BY r.id
                    ORDER BY r.report_date DESC
                    LIMIT 1
                """)
                result = session.execute(query).fetchone()
            
            if not result:
                return {'status': 'no_data', 'message': 'No reports found'}
            
            return {
                'status': 'ok',
                'fallback': True,
                'kpis': {
                    'report_id': str(result.id),
                    'tool_type': result.tool_type,
                    'domain': result.domain,
                    'report_date': result.report_date.isoformat(),
                    'domain_sid': result.domain_sid,
                    'global_score': result.pingcastle_global_score or 0,
                    'stale_objects_score': result.stale_objects_score or 0,
                    'privileged_accounts_score': result.privileged_accounts_score or 0,
                    'trusts_score': result.trusts_score or 0,
                    'anomalies_score': result.anomalies_score or 0,
                    'user_count': result.user_count or 0,
                    'computer_count': result.computer_count or 0,
                    'dc_count': result.dc_count or 0,
                    'total_findings': result.total_findings or 0,
                    'high_severity_findings': result.high_severity_findings or 0,
                    'medium_severity_findings': result.medium_severity_findings or 0,
                    'low_severity_findings': result.low_severity_findings or 0,
                    'total_groups': 0,
                    'total_group_members': 0,
                    'accepted_group_members': 0,
                    'unaccepted_group_members': 0,
                    'domain_group_risk_score': 0.0
                }
            }
        except Exception as e:
            logging.error(f"Fallback dashboard KPIs also failed: {e}")
            return {'status': 'error', 'message': str(e)}

    def get_dashboard_kpis_history(
        self, 
        domain: str, 
        limit: int = 10,
        tool_type: Optional[str] = None
    ) -> List[Dict]:
        """
        Get historical KPIs for trend charts.
        
        Defaults to PingCastle reports only since the dashboard trend charts
        show PingCastle-specific scores (global_score, stale_objects, etc.)
        
        Args:
            domain: Domain to get history for
            limit: Maximum number of historical points
            tool_type: Filter by tool type. If None, defaults to 'pingcastle'
                       since the dashboard charts show PingCastle-specific scores.
            
        Returns:
            List of historical KPI data points
        """
        with self._get_session() as session:
            try:
                # IMPORTANT: Default to 'pingcastle' when tool_type is None
                # This ensures dashboard trend charts only show PingCastle scores
                # and are not affected by domain_analysis report uploads
                effective_tool_type = tool_type if tool_type is not None else 'pingcastle'
                
                query = text("""
                    SELECT 
                        report_date,
                        global_score,
                        stale_objects_score,
                        privileged_accounts_score,
                        trusts_score,
                        anomalies_score,
                        unaccepted_group_members,
                        total_findings,
                        domain_group_risk_score
                    FROM reports_kpis
                    WHERE domain = :domain
                    AND tool_type = :tool_type
                    ORDER BY report_date DESC
                    LIMIT :limit
                """)
                
                params = {
                    'domain': domain, 
                    'limit': limit,
                    'tool_type': effective_tool_type
                }
                
                results = session.execute(query, params).fetchall()
                
                # Return in chronological order (oldest first)
                return [
                    {
                        'date': r.report_date.isoformat(),
                        'global_score': r.global_score,
                        'stale_objects_score': r.stale_objects_score,
                        'privileged_accounts_score': r.privileged_accounts_score,
                        'trusts_score': r.trusts_score,
                        'anomalies_score': r.anomalies_score,
                        'unaccepted_group_members': r.unaccepted_group_members,
                        'total_findings': r.total_findings,
                        'domain_group_risk_score': float(r.domain_group_risk_score) if r.domain_group_risk_score else 0.0
                    }
                    for r in reversed(results)
                ]
                
            except Exception as e:
                logging.error(f"Failed to get KPI history: {e}")
                # Fallback to reports table
                return self._get_fallback_kpi_history(session, domain, limit)

    def _get_fallback_kpi_history(self, session, domain: str, limit: int = 10) -> List[Dict]:
        """Fallback method for KPI history if reports_kpis doesn't exist."""
        try:
            query = text("""
                SELECT 
                    report_date,
                    pingcastle_global_score as global_score,
                    stale_objects_score,
                    privileged_accounts_score,
                    trusts_score,
                    anomalies_score
                FROM reports
                WHERE domain = :domain AND tool_type = 'pingcastle'
                ORDER BY report_date DESC
                LIMIT :limit
            """)
            
            results = session.execute(query, {'domain': domain, 'limit': limit}).fetchall()
            
            return [
                {
                    'date': r.report_date.isoformat(),
                    'global_score': r.global_score or 0,
                    'stale_objects_score': r.stale_objects_score or 0,
                    'privileged_accounts_score': r.privileged_accounts_score or 0,
                    'trusts_score': r.trusts_score or 0,
                    'anomalies_score': r.anomalies_score or 0,
                    'unaccepted_group_members': 0,
                    'total_findings': 0,
                    'domain_group_risk_score': 0.0
                }
                for r in reversed(results)
            ]
        except Exception as e:
            logging.error(f"Fallback KPI history also failed: {e}")
            return []

    def get_all_domains_latest_kpis(self) -> List[Dict]:
        """
        Get latest KPIs for all domains.
        Useful for multi-domain dashboard overview.
        
        Returns:
            List of latest KPIs per domain
        """
        with self._get_session() as session:
            try:
                query = text("""
                    SELECT DISTINCT ON (domain)
                        rk.domain,
                        rk.report_id,
                        rk.report_date,
                        rk.tool_type,
                        rk.global_score,
                        rk.total_findings,
                        rk.high_severity_findings,
                        rk.unaccepted_group_members,
                        rk.domain_group_risk_score,
                        r.domain_sid
                    FROM reports_kpis rk
                    JOIN reports r ON rk.report_id = r.id
                    ORDER BY domain, report_date DESC
                """)
                
                results = session.execute(query).fetchall()
                
                return [
                    {
                        'domain': r.domain,
                        'report_id': str(r.report_id),
                        'report_date': r.report_date.isoformat(),
                        'tool_type': r.tool_type,
                        'global_score': r.global_score,
                        'total_findings': r.total_findings,
                        'high_severity_findings': r.high_severity_findings,
                        'unaccepted_group_members': r.unaccepted_group_members,
                        'domain_group_risk_score': float(r.domain_group_risk_score) if r.domain_group_risk_score else 0.0,
                        'domain_sid': r.domain_sid
                    }
                    for r in results
                ]
                
            except Exception as e:
                logging.error(f"Failed to get all domains KPIs: {e}")
                return []

    # =========================================================================
    # Fast Endpoints - Using Materialized Views for Performance
    # =========================================================================

    def get_dashboard_summary_fast(self) -> Dict:
        """
        Get dashboard summary from materialized view for ultra-fast loading.
        Falls back to regular query if materialized view doesn't exist.
        
        Returns:
            Dictionary with dashboard summary for all domains
        """
        with self._get_session() as session:
            try:
                # Try materialized view first
                results = session.execute(text("""
                    SELECT 
                        domain,
                        tool_type,
                        latest_report_date,
                        report_count,
                        latest_global_score,
                        latest_total_findings,
                        latest_high_severity,
                        latest_medium_severity,
                        latest_low_severity,
                        latest_unaccepted_members,
                        total_groups,
                        total_group_members,
                        user_count,
                        computer_count,
                        dc_count,
                        stale_objects_score,
                        privileged_accounts_score,
                        trusts_score,
                        anomalies_score,
                        domain_group_risk_score
                    FROM mv_dashboard_summary
                    ORDER BY domain, tool_type
                """)).fetchall()
                
                return {
                    "status": "ok",
                    "source": "materialized_view",
                    "domains": [
                        {
                            'domain': r.domain,
                            'tool_type': r.tool_type,
                            'latest_report_date': r.latest_report_date.isoformat() if r.latest_report_date else None,
                            'report_count': r.report_count,
                            'latest_global_score': r.latest_global_score or 0,
                            'latest_total_findings': r.latest_total_findings or 0,
                            'latest_high_severity': r.latest_high_severity or 0,
                            'latest_medium_severity': r.latest_medium_severity or 0,
                            'latest_low_severity': r.latest_low_severity or 0,
                            'latest_unaccepted_members': r.latest_unaccepted_members or 0,
                            'total_groups': r.total_groups or 0,
                            'total_group_members': r.total_group_members or 0,
                            'user_count': r.user_count or 0,
                            'computer_count': r.computer_count or 0,
                            'dc_count': r.dc_count or 0,
                            'stale_objects_score': r.stale_objects_score or 0,
                            'privileged_accounts_score': r.privileged_accounts_score or 0,
                            'trusts_score': r.trusts_score or 0,
                            'anomalies_score': r.anomalies_score or 0,
                            'domain_group_risk_score': float(r.domain_group_risk_score) if r.domain_group_risk_score else 0.0
                        }
                        for r in results
                    ]
                }
            except Exception as e:
                # Fallback if materialized view doesn't exist
                logging.warning(f"Materialized view not available, using fallback: {e}")
                return {
                    "status": "ok",
                    "source": "fallback",
                    "domains": self.get_all_domains_latest_kpis()
                }

    def get_grouped_findings_from_mv(
        self,
        domain: Optional[str] = None,
        category: Optional[str] = None,
        tool_type: Optional[str] = 'pingcastle',
        in_latest_only: bool = False,
        include_accepted: bool = True,
        page: int = 1,
        page_size: int = 50
    ) -> Dict:
        """
        Get grouped findings from materialized view with pagination.
        Much faster than runtime aggregation for Risk Catalog.

        Args:
            domain: Optional filter by domain
            category: Optional filter by category
            tool_type: Filter by tool type (default: 'pingcastle')
                       This ensures PingCastle tab only shows PingCastle findings.
            in_latest_only: Only show findings in the latest report
            include_accepted: Include accepted findings
            page: Page number (1-indexed)
            page_size: Number of items per page

        Returns:
            Paginated grouped findings with metadata
        """
        with self._get_session() as session:
            try:
                # Build query dynamically
                where_clauses = ["1=1"]
                params = {}

                # IMPORTANT: Filter by tool_type to ensure proper data separation
                # PingCastle tab should only show PingCastle findings
                if tool_type:
                    where_clauses.append("tool_type = :tool_type")
                    params['tool_type'] = tool_type

                if domain:
                    where_clauses.append(":domain = ANY(domains)")
                    params['domain'] = domain

                if category and category != 'all':
                    where_clauses.append("category = :category")
                    params['category'] = category

                if in_latest_only:
                    where_clauses.append("in_latest_report = true")

                if not include_accepted:
                    where_clauses.append("is_accepted = false")
                
                where_sql = " AND ".join(where_clauses)
                
                # Get total count
                count_query = text(f"""
                    SELECT COUNT(*) FROM mv_grouped_findings WHERE {where_sql}
                """)
                total = session.execute(count_query, params).scalar() or 0
                
                # Get paginated results
                query = text(f"""
                    SELECT 
                        tool_type,
                        category,
                        name,
                        max_score,
                        avg_score,
                        occurrence_count,
                        first_seen,
                        last_seen,
                        domains,
                        in_latest_report,
                        is_accepted,
                        accepted_reason,
                        accepted_by,
                        accepted_at,
                        expires_at,
                        description,
                        recommendation,
                        severity
                    FROM mv_grouped_findings 
                    WHERE {where_sql}
                    ORDER BY max_score DESC, occurrence_count DESC
                    LIMIT :limit OFFSET :offset
                """)
                params['limit'] = page_size
                params['offset'] = (page - 1) * page_size
                
                results = session.execute(query, params).fetchall()
                
                return {
                    "status": "ok",
                    "source": "materialized_view",
                    "page": page,
                    "page_size": page_size,
                    "total_count": total,
                    "total_pages": (total + page_size - 1) // page_size if page_size > 0 else 0,
                    "findings": [
                        {
                            'tool_type': r.tool_type,
                            'category': r.category,
                            'name': r.name,
                            'max_score': r.max_score,
                            'avg_score': float(r.avg_score) if r.avg_score else 0,
                            'occurrence_count': r.occurrence_count,
                            'first_seen': r.first_seen.isoformat() if r.first_seen else None,
                            'last_seen': r.last_seen.isoformat() if r.last_seen else None,
                            'domains': r.domains or [],
                            'in_latest_report': r.in_latest_report,
                            'is_accepted': r.is_accepted,
                            'accepted_reason': r.accepted_reason,
                            'accepted_by': r.accepted_by,
                            'accepted_at': r.accepted_at.isoformat() if r.accepted_at else None,
                            'expires_at': r.expires_at.isoformat() if r.expires_at else None,
                            'description': r.description or '',
                            'recommendation': r.recommendation or '',
                            'severity': r.severity or 'medium'
                        }
                        for r in results
                    ]
                }
            except Exception as e:
                logging.warning(f"Materialized view query failed, using fallback: {e}")
                # Fallback to regular grouped findings
                # Use the tool_type parameter (defaults to 'pingcastle')
                findings = self.get_grouped_findings(
                    domain=domain,
                    category=category if category != 'all' else None,
                    tool_type=tool_type or 'pingcastle',
                    include_accepted=include_accepted
                )
                # Apply in_latest filter if needed
                if in_latest_only:
                    findings = [f for f in findings if f.get('in_latest_report')]
                
                # Paginate manually
                total = len(findings)
                start = (page - 1) * page_size
                end = start + page_size
                
                return {
                    "status": "ok",
                    "source": "fallback",
                    "page": page,
                    "page_size": page_size,
                    "total_count": total,
                    "total_pages": (total + page_size - 1) // page_size if page_size > 0 else 0,
                    "findings": findings[start:end]
                }

    def get_grouped_findings_summary_fast(
        self,
        tool_type: Optional[str] = 'pingcastle'
    ) -> Dict:
        """
        Get grouped findings summary from materialized view.
        Used for category tabs in Risk Catalog.

        Args:
            tool_type: Filter by tool type (default: 'pingcastle')
                       Ensures PingCastle tab shows PingCastle-only counts.

        Returns:
            Summary statistics by category
        """
        with self._get_session() as session:
            try:
                query = text("""
                    SELECT 
                        tool_type,
                        category,
                        total_findings,
                        in_latest_count,
                        accepted_count,
                        unaccepted_count,
                        total_score
                    FROM mv_grouped_findings_summary
                    WHERE (:tool_type IS NULL OR tool_type = :tool_type)
                    ORDER BY tool_type, category
                """)
                
                results = session.execute(query, {'tool_type': tool_type}).fetchall()
                
                # Build response by category
                categories = {}
                totals = {'total': 0, 'in_latest': 0, 'accepted': 0, 'unaccepted': 0, 'score': 0}
                
                for r in results:
                    if r.category == 'all':
                        totals = {
                            'total': r.total_findings,
                            'in_latest': r.in_latest_count,
                            'accepted': r.accepted_count,
                            'unaccepted': r.unaccepted_count,
                            'score': r.total_score
                        }
                    else:
                        categories[r.category] = {
                            'total': r.total_findings,
                            'in_latest': r.in_latest_count,
                            'accepted': r.accepted_count,
                            'unaccepted': r.unaccepted_count,
                            'score': r.total_score
                        }
                
                return {
                    "status": "ok",
                    "source": "materialized_view",
                    "total_unique_findings": totals['total'],
                    "total_in_latest": totals['in_latest'],
                    "total_accepted": totals['accepted'],
                    "total_unaccepted": totals['unaccepted'],
                    "total_score": totals['score'],
                    "categories": categories
                }
            except Exception as e:
                logging.warning(f"Summary materialized view failed: {e}")
                # Return empty summary
                return {
                    "status": "ok",
                    "source": "fallback",
                    "total_unique_findings": 0,
                    "total_in_latest": 0,
                    "total_accepted": 0,
                    "total_unaccepted": 0,
                    "total_score": 0,
                    "categories": {}
                }

    def get_domain_groups_fast(self, domain: str) -> List[Dict]:
        """
        Get domain groups using pre-calculated view for fast loading.
        
        Args:
            domain: Domain to get groups for
            
        Returns:
            List of group information with acceptance status
        """
        with self._get_session() as session:
            try:
                # First get summary from view
                summary = session.execute(text("""
                    SELECT 
                        report_id,
                        domain,
                        report_date,
                        total_groups,
                        total_group_members,
                        accepted_group_members,
                        unaccepted_group_members,
                        domain_group_risk_score
                    FROM v_domain_group_summary
                    WHERE domain = :domain
                """), {'domain': domain}).fetchone()
                
                if not summary:
                    return []
                
                # Get individual group details from findings metadata
                groups = session.execute(text("""
                    SELECT 
                        f.metadata->>'group_name' as group_name,
                        (f.metadata->>'member_count')::int as total_members,
                        f.score as risk_score,
                        (
                            SELECT COUNT(*) 
                            FROM accepted_group_members agm 
                            WHERE agm.domain = :domain 
                              AND agm.group_name = f.metadata->>'group_name'
                        ) as accepted_members
                    FROM findings f
                    WHERE f.report_id = :report_id
                      AND f.category = 'DonScanner'
                      AND f.name LIKE 'Group_%'
                    ORDER BY f.score DESC
                """), {'domain': domain, 'report_id': str(summary.report_id)}).fetchall()
                
                return [
                    {
                        'group_name': g.group_name,
                        'total_members': g.total_members or 0,
                        'accepted_members': g.accepted_members or 0,
                        'unaccepted_members': (g.total_members or 0) - (g.accepted_members or 0),
                        'risk_score': g.risk_score or 0,
                        'severity': 'high' if (g.risk_score or 0) > 50 else 'medium' if (g.risk_score or 0) > 25 else 'low',
                        'last_updated': summary.report_date.isoformat() if summary.report_date else None
                    }
                    for g in groups if g.group_name
                ]
            except Exception as e:
                logging.warning(f"Fast domain groups query failed: {e}")
                # Fallback to regular method (imported at call time to avoid circular import)
                return []

    def refresh_materialized_views(self):
        """
        Refresh all performance materialized views.
        Should be called after report uploads.
        """
        with self._get_session() as session:
            try:
                session.execute(text("SELECT refresh_performance_views()"))
                session.commit()
                logging.info("Successfully refreshed performance materialized views")
            except Exception as e:
                session.rollback()
                logging.warning(f"Failed to refresh materialized views: {e}")
