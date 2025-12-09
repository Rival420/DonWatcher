"""
Upload Service - Reusable upload logic for file and API uploads.

This module provides a centralized service for processing report uploads,
whether they come from file uploads (UI) or programmatic API calls.
"""

import logging
from datetime import datetime
from pathlib import Path
from typing import Optional, List, Dict, Any, Tuple
from uuid import uuid4

from server.models import (
    Report, Finding, SecurityToolType, FindingStatus,
    APIUploadRequest, APIUploadResponse, APIFindingInput, APIGroupData,
    GroupMembership, MemberType
)
from server.storage_postgres import PostgresReportStorage


class UploadService:
    """
    Service class for handling report uploads.
    
    Provides methods for:
    - Processing API-based JSON uploads
    - Validating upload data
    - Creating reports and findings
    - Triggering alerts
    - Handling group memberships
    """
    
    def __init__(self, storage: PostgresReportStorage):
        self.storage = storage
        self.logger = logging.getLogger(__name__)
    
    async def process_api_upload(
        self,
        request: APIUploadRequest
    ) -> APIUploadResponse:
        """
        Process a programmatic API upload request.
        
        Args:
            request: The API upload request containing report data
            
        Returns:
            APIUploadResponse with upload results
        """
        try:
            # Generate report ID
            report_id = str(uuid4())
            report_date = request.report_date or datetime.utcnow()
            
            # Create findings from the request
            findings = self._create_findings_from_request(report_id, request)
            
            # Process group data if provided (for domain_analysis)
            groups_processed = 0
            if request.groups and request.tool_type in [
                SecurityToolType.DOMAIN_ANALYSIS, 
                SecurityToolType.DOMAIN_GROUP_MEMBERS
            ]:
                group_findings = self._create_group_findings(report_id, request)
                findings.extend(group_findings)
                groups_processed = len(request.groups)
            
            # Build the report object
            report = self._build_report(report_id, report_date, request, findings)
            
            # Save to database
            saved_report_id = self.storage.save_report(report)
            
            # Handle group memberships for domain analysis reports
            if request.tool_type == SecurityToolType.DOMAIN_ANALYSIS and request.groups:
                memberships = self._extract_memberships_from_groups(report, request.groups)
                if memberships:
                    self.storage.save_group_memberships(saved_report_id, memberships)
                
                # Trigger risk calculation
                await self._update_risk_scores(request.domain)
            
            # Send alert if configured
            alert_sent = False
            if request.send_alert:
                alert_sent = await self._send_alert_if_needed(report)
            
            return APIUploadResponse(
                status="success",
                report_id=saved_report_id,
                tool_type=request.tool_type,
                domain=request.domain,
                findings_count=len(findings),
                groups_processed=groups_processed,
                message=f"Successfully uploaded {request.tool_type.value} report with {len(findings)} findings",
                alert_sent=alert_sent,
                details={
                    "report_date": report_date.isoformat(),
                    "upload_date": datetime.utcnow().isoformat()
                }
            )
            
        except Exception as e:
            self.logger.exception(f"Failed to process API upload: {e}")
            raise
    
    def _create_findings_from_request(
        self,
        report_id: str,
        request: APIUploadRequest
    ) -> List[Finding]:
        """Create Finding objects from API request findings data."""
        findings = []
        
        for finding_input in request.findings:
            finding = Finding(
                id=str(uuid4()),
                report_id=report_id,
                tool_type=request.tool_type,
                category=finding_input.category,
                name=finding_input.name,
                score=finding_input.score,
                severity=finding_input.severity,
                description=finding_input.description,
                recommendation=finding_input.recommendation,
                status=FindingStatus.NEW,
                metadata=finding_input.metadata
            )
            findings.append(finding)
        
        return findings
    
    def _create_group_findings(
        self,
        report_id: str,
        request: APIUploadRequest
    ) -> List[Finding]:
        """Create findings from group membership data."""
        findings = []
        
        for group_data in request.groups:
            member_count = len(group_data.members)
            
            # Process members into the expected format
            processed_members = []
            for member in group_data.members:
                processed_members.append({
                    'name': member.name,
                    'samaccountname': member.samaccountname or '',
                    'sid': member.sid or '',
                    'type': member.type,
                    'enabled': member.enabled
                })
            
            finding = Finding(
                id=str(uuid4()),
                report_id=report_id,
                tool_type=SecurityToolType.DOMAIN_ANALYSIS,
                category="DonScanner",
                name=f"Group_{group_data.group_name}_Members",
                score=self._calculate_group_risk_score(group_data.group_name, member_count),
                severity=self._determine_group_severity(group_data.group_name, member_count),
                description=f"Group '{group_data.group_name}' has {member_count} members",
                recommendation=f"Review membership of privileged group '{group_data.group_name}'. Accept authorized members and investigate unaccepted ones.",
                status=FindingStatus.NEW,
                metadata={
                    'group_name': group_data.group_name,
                    'member_count': member_count,
                    'members': processed_members,
                    'group_sid': group_data.group_sid or '',
                    'group_type': group_data.group_type,
                    'upload_method': 'api'
                }
            )
            findings.append(finding)
        
        return findings
    
    def _build_report(
        self,
        report_id: str,
        report_date: datetime,
        request: APIUploadRequest,
        findings: List[Finding]
    ) -> Report:
        """Build a Report object from API request data."""
        # Extract domain metadata if provided
        domain_metadata = request.domain_metadata or type('obj', (object,), {
            'domain_sid': None,
            'domain_functional_level': None,
            'forest_functional_level': None,
            'maturity_level': None,
            'dc_count': None,
            'user_count': None,
            'computer_count': None
        })()
        
        # Extract PingCastle scores if provided
        pc_scores = request.pingcastle_scores or type('obj', (object,), {
            'global_score': None,
            'stale_objects_score': 0,
            'privileged_accounts_score': 0,
            'trusts_score': 0,
            'anomalies_score': 0
        })()
        
        # Calculate global score from category scores if not provided
        global_score = pc_scores.global_score
        if global_score is None and request.tool_type == SecurityToolType.PINGCASTLE:
            global_score = (
                (pc_scores.stale_objects_score or 0) +
                (pc_scores.privileged_accounts_score or 0) +
                (pc_scores.trusts_score or 0) +
                (pc_scores.anomalies_score or 0)
            )
        
        # Build metadata
        metadata = request.metadata.copy()
        metadata['upload_method'] = 'api'
        metadata['api_version'] = '1.0'
        
        return Report(
            id=report_id,
            tool_type=request.tool_type,
            domain=request.domain,
            report_date=report_date,
            upload_date=datetime.utcnow(),
            global_score=global_score,
            stale_objects_score=pc_scores.stale_objects_score,
            privileged_accounts_score=pc_scores.privileged_accounts_score,
            trusts_score=pc_scores.trusts_score,
            anomalies_score=pc_scores.anomalies_score,
            domain_sid=domain_metadata.domain_sid,
            domain_functional_level=domain_metadata.domain_functional_level,
            forest_functional_level=domain_metadata.forest_functional_level,
            maturity_level=domain_metadata.maturity_level,
            dc_count=domain_metadata.dc_count,
            user_count=domain_metadata.user_count,
            computer_count=domain_metadata.computer_count,
            metadata=metadata,
            findings=findings
        )
    
    def _extract_memberships_from_groups(
        self,
        report: Report,
        groups: List[APIGroupData]
    ) -> List[GroupMembership]:
        """Extract group membership records from API group data."""
        memberships = []
        
        for group_data in groups:
            # Look up or create monitored group
            monitored_groups = self.storage.get_monitored_groups()
            group_id = None
            
            for monitored_group in monitored_groups:
                if monitored_group.group_name == group_data.group_name:
                    group_id = monitored_group.id
                    break
            
            # Create monitored group if not exists
            if not group_id:
                from server.models import MonitoredGroup
                new_group = MonitoredGroup(
                    group_name=group_data.group_name,
                    domain=report.domain,
                    description=f"Auto-created from API upload for {group_data.group_name}",
                    is_active=True,
                    alert_on_changes=True
                )
                group_id = self.storage.add_monitored_group(new_group)
            
            # Create membership records
            for member in group_data.members:
                member_type_str = member.type.lower()
                if member_type_str == 'computer':
                    member_type = MemberType.COMPUTER
                elif member_type_str == 'group':
                    member_type = MemberType.GROUP
                else:
                    member_type = MemberType.USER
                
                membership = GroupMembership(
                    report_id=report.id,
                    group_id=group_id,
                    member_name=member.name,
                    member_sid=member.sid or '',
                    member_type=member_type,
                    is_direct_member=True
                )
                memberships.append(membership)
        
        return memberships
    
    async def _update_risk_scores(self, domain: str) -> None:
        """Update risk scores after group data upload."""
        try:
            from server.risk_service import get_risk_service
            risk_service = get_risk_service(self.storage)
            await risk_service.calculate_and_store_global_risk(domain)
            self.logger.info(f"Updated risk scores for domain {domain} after API upload")
        except Exception as e:
            self.logger.warning(f"Failed to update risk scores after upload: {e}")
    
    async def _send_alert_if_needed(self, report: Report) -> bool:
        """Send alert for unaccepted findings if webhook is configured."""
        try:
            unaccepted = self.storage.get_unaccepted_findings(report.findings)
            if unaccepted:
                settings = self.storage.get_settings()
                if settings.webhook_url:
                    from server.alerter import Alerter
                    alerter = Alerter(self.storage)
                    alerter.send_alert(settings, report, unaccepted)
                    return True
        except Exception as e:
            self.logger.warning(f"Failed to send alert: {e}")
        return False
    
    def _calculate_group_risk_score(self, group_name: str, member_count: int) -> int:
        """Calculate risk score based on group type and member count."""
        high_risk_groups = ['Domain Admins', 'Enterprise Admins', 'Schema Admins']
        medium_risk_groups = ['Administrators', 'Account Operators', 'Backup Operators']
        
        base_score = 0
        if group_name in high_risk_groups:
            base_score = 15
        elif group_name in medium_risk_groups:
            base_score = 10
        else:
            base_score = 5
        
        if member_count > 10:
            base_score += 10
        elif member_count > 5:
            base_score += 5
        elif member_count > 1:
            base_score += 2
        
        return min(base_score, 50)
    
    def _determine_group_severity(self, group_name: str, member_count: int) -> str:
        """Determine severity based on group type and member count."""
        high_risk_groups = ['Domain Admins', 'Enterprise Admins', 'Schema Admins']
        
        if group_name in high_risk_groups and member_count > 5:
            return "high"
        elif group_name in high_risk_groups or member_count > 10:
            return "medium"
        else:
            return "low"


def get_upload_service(storage: PostgresReportStorage) -> UploadService:
    """Factory function to get an UploadService instance."""
    return UploadService(storage)
