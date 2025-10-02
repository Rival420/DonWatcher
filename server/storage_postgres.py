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
                        'metadata': report.metadata
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
                    'pingcastle_global_score': report.pingcastle_global_score or 0,
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
                                    global_score, high_score, medium_score, low_score,
                                    stale_objects_score, privileged_accounts_score,
                                    trusts_score, anomalies_score, domain_sid,
                                    domain_functional_level, forest_functional_level,
                                    maturity_level, dc_count, user_count, computer_count,
                                    original_file, html_file, metadata
                                ) VALUES (
                                    :id, :tool_type, :domain, :report_date, :upload_date,
                                    :global_score, :high_score, :medium_score, :low_score,
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
                                'global_score': report.pingcastle_global_score or 0,
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

                # Save findings
                for finding in report.findings:
                    self._save_finding(session, finding)
                    self._save_risk_to_catalog(session, finding)

                session.commit()
                logging.info(f"Saved report {report.id} with {len(report.findings)} findings")
                return report.id

            except Exception as e:
                session.rollback()
                logging.error(f"Failed to save report: {e}")
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
                               global_score, high_score, medium_score, low_score,
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
            pingcastle_global_score=getattr(result, 'pingcastle_global_score', None) or getattr(result, 'global_score', 0),
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
            metadata=json.loads(result.metadata) if result.metadata else {},
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
                               r.global_score, r.high_score, r.medium_score, r.low_score,
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
                                 r.global_score, r.high_score, r.medium_score, r.low_score,
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
                    pingcastle_global_score=getattr(r, 'pingcastle_global_score', None) or getattr(r, 'global_score', 0),
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
                    SELECT id FROM reports ORDER BY report_date DESC LIMIT 1
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

    # Accepted Risks Management
    def add_accepted_risk(self, tool_type: SecurityToolType, category: str, name: str, 
                         reason: str = None, accepted_by: str = None):
        """Add an accepted risk."""
        with self._get_session() as session:
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
                    id=r.id,
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

    def log_alert(self, message: str):
        """Log an alert message."""
        logging.info(f"Alert: {message}")
