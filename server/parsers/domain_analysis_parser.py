from server.models import Report, Finding, SecurityToolType, GroupMembership, MemberType
from server.parsers.base_parser import BaseSecurityParser
from uuid import uuid4
from datetime import datetime
from pathlib import Path
from typing import List, Dict, Any
import json
import logging

class DomainAnalysisParser(BaseSecurityParser):
    """Parser for domain analysis reports (JSON format)."""
    
    @property
    def tool_type(self) -> SecurityToolType:
        return SecurityToolType.DOMAIN_ANALYSIS
    
    @property
    def supported_extensions(self) -> List[str]:
        return ['.json']
    
    def can_parse(self, file_path: Path) -> bool:
        """Check if this is a domain analysis JSON file."""
        if not self.validate_file(file_path):
            return False
        
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                data = json.load(f)
            
            # Check for domain analysis specific structure
            return (isinstance(data, dict) and 
                   ('domain' in data or 'domain_info' in data) and
                   ('groups' in data or 'privileged_groups' in data))
        except Exception:
            return False
    
    def parse_report(self, file_path: Path) -> Report:
        """Parse domain analysis JSON file."""
        with open(file_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
        
        # Extract basic information
        domain = data.get('domain', data.get('domain_info', {}).get('name', 'Unknown'))
        report_date_str = data.get('scan_date', data.get('timestamp', datetime.utcnow().isoformat()))
        
        try:
            if 'T' in report_date_str:
                report_date = datetime.fromisoformat(report_date_str.replace('Z', '+00:00'))
            else:
                report_date = datetime.strptime(report_date_str, '%Y-%m-%d')
        except ValueError:
            report_date = datetime.utcnow()
        
        # Generate report ID
        report_id = str(uuid4())
        
        # Extract domain metadata
        domain_info = data.get('domain_info', {})
        domain_sid = domain_info.get('sid', '')
        domain_functional_level = domain_info.get('functional_level', '')
        forest_functional_level = domain_info.get('forest_functional_level', '')
        dc_count = domain_info.get('domain_controllers_count', 0)
        user_count = domain_info.get('users_count', 0)
        computer_count = domain_info.get('computers_count', 0)
        
        findings = []
        
        # Process privileged groups
        groups_data = data.get('groups', data.get('privileged_groups', {}))
        for group_name, group_info in groups_data.items():
            members = group_info.get('members', [])
            
            # Create finding for group membership
            if members:
                finding = Finding(
                    id=str(uuid4()),
                    report_id=report_id,
                    tool_type=SecurityToolType.DOMAIN_ANALYSIS,
                    category="PrivilegedAccounts",
                    name=f"Group_{group_name}_Members",
                    score=self._calculate_group_risk_score(group_name, len(members)),
                    severity=self._determine_group_severity(group_name, len(members)),
                    description=f"Group '{group_name}' has {len(members)} members",
                    recommendation=f"Review membership of privileged group '{group_name}'",
                    metadata={
                        'group_name': group_name,
                        'member_count': len(members),
                        'members': members,
                        'group_sid': group_info.get('sid', ''),
                        'group_type': group_info.get('type', 'security')
                    }
                )
                findings.append(finding)
        
        # Process security findings
        security_findings = data.get('security_findings', data.get('findings', []))
        for finding_data in security_findings:
            finding = Finding(
                id=str(uuid4()),
                report_id=report_id,
                tool_type=SecurityToolType.DOMAIN_ANALYSIS,
                category=finding_data.get('category', 'General'),
                name=finding_data.get('name', 'Unknown_Finding'),
                score=finding_data.get('score', 0),
                severity=finding_data.get('severity', 'medium'),
                description=finding_data.get('description', ''),
                recommendation=finding_data.get('recommendation', ''),
                metadata=finding_data.get('metadata', {})
            )
            findings.append(finding)
        
        return Report(
            id=report_id,
            tool_type=SecurityToolType.DOMAIN_ANALYSIS,
            domain=domain,
            domain_sid=domain_sid,
            domain_functional_level=domain_functional_level,
            forest_functional_level=forest_functional_level,
            dc_count=dc_count,
            user_count=user_count,
            computer_count=computer_count,
            report_date=report_date,
            upload_date=datetime.utcnow(),
            metadata=data.get('metadata', {}),
            findings=findings,
            original_file=str(file_path)
        )
    
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
        
        # Increase score based on member count
        if member_count > 10:
            base_score += 10
        elif member_count > 5:
            base_score += 5
        elif member_count > 1:
            base_score += 2
        
        return min(base_score, 50)  # Cap at 50
    
    def _determine_group_severity(self, group_name: str, member_count: int) -> str:
        """Determine severity based on group type and member count."""
        high_risk_groups = ['Domain Admins', 'Enterprise Admins', 'Schema Admins']
        
        if group_name in high_risk_groups and member_count > 5:
            return "high"
        elif group_name in high_risk_groups or member_count > 10:
            return "medium"
        else:
            return "low"
    
    def extract_group_memberships(self, report: Report) -> List[GroupMembership]:
        """Extract group membership data from the report."""
        memberships = []
        
        for finding in report.findings:
            if finding.category == "PrivilegedAccounts" and finding.name.startswith("Group_"):
                group_name = finding.metadata.get('group_name', '')
                members = finding.metadata.get('members', [])
                
                # This would need to be matched with monitored groups from the database
                # For now, we'll create a placeholder group_id
                group_id = str(uuid4())  # In real implementation, lookup from monitored_groups
                
                for member in members:
                    membership = GroupMembership(
                        report_id=report.id,
                        group_id=group_id,
                        member_name=member.get('name', '') if isinstance(member, dict) else str(member),
                        member_sid=member.get('sid', '') if isinstance(member, dict) else '',
                        member_type=MemberType.USER,  # Could be enhanced to detect type
                        is_direct_member=True
                    )
                    memberships.append(membership)
        
        return memberships
