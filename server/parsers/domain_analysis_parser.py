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
            # Support both raw format and DonWatcher report format
            if isinstance(data, dict):
                # Check for new domain_group_members format (from PowerShell scanner)
                if (data.get('tool_type') == 'domain_group_members' and 
                    'domain' in data and 'groups' in data):
                    return True
                
                # Check for DonWatcher report format (from PowerShell agent)
                if (data.get('tool_type') == 'domain_analysis' and 
                    'domain' in data and 'findings' in data):
                    return True
                
                # Check for raw domain analysis format  
                if (('domain' in data or 'domain_info' in data) and
                    ('groups' in data or 'privileged_groups' in data)):
                    return True
            
            return False
        except Exception:
            return False
    
    def parse_report(self, file_path: Path) -> Report:
        """Parse domain analysis JSON file."""
        with open(file_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
        
        # Check for new domain_group_members format (from PowerShell scanner)
        if data.get('tool_type') == 'domain_group_members':
            return self._parse_domain_group_members_format(data)
        
        # Check if this is already a DonWatcher report format
        if data.get('tool_type') == 'domain_analysis' and 'findings' in data:
            return self._parse_donwatcher_format(data)
        
        # Otherwise parse as raw domain analysis format
        return self._parse_raw_format(data)
    
    def _parse_donwatcher_format(self, data: Dict[str, Any]) -> Report:
        """Parse data that's already in DonWatcher report format."""
        from server.models import Report, Finding
        
        # Convert findings data to Finding objects
        findings = []
        for finding_data in data.get('findings', []):
            # Normalize categories produced by older agents/scripts
            normalized = dict(finding_data)
            name_value = normalized.get('name', '')
            if normalized.get('category') == 'PrivilegedAccounts' and isinstance(name_value, str) and name_value.startswith('Group_'):
                normalized['category'] = 'DonScanner'
            finding = Finding(**normalized)
            findings.append(finding)
        
        # Create report object
        report_data = data.copy()
        report_data['findings'] = findings
        
        # Parse dates if they're strings
        for date_field in ['report_date', 'upload_date']:
            if date_field in report_data and isinstance(report_data[date_field], str):
                try:
                    report_data[date_field] = datetime.fromisoformat(report_data[date_field].replace('Z', '+00:00'))
                except ValueError:
                    report_data[date_field] = datetime.utcnow()
        
        return Report(**report_data)
    
    def _parse_raw_format(self, data: Dict[str, Any]) -> Report:
        """Parse raw domain analysis data format."""
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
        
        # Extract domain metadata - but don't set scores that are PingCastle specific
        domain_info = data.get('domain_info', {})
        domain_sid = domain_info.get('sid', '')
        # Note: Domain scanner should not overwrite domain functional levels, counts etc.
        # These should be preserved from PingCastle reports which have more accurate data
        
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
                    category="DonScanner",
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
            # Don't set domain functional levels, counts etc. - these should come from PingCastle
            # Domain scanner is only for group membership tracking
            report_date=report_date,
            upload_date=datetime.utcnow(),
            metadata=data.get('metadata', {}),
            findings=findings,
            original_file=str(file_path)
        )
    
    def _parse_domain_group_members_format(self, data: Dict[str, Any]) -> Report:
        """Parse new domain_group_members format from PowerShell scanner."""
        from server.models import Report, Finding
        
        # Extract basic information
        domain = data.get('domain', 'Unknown')
        domain_sid = data.get('domain_sid', '')
        report_date_str = data.get('report_date', datetime.utcnow().isoformat())
        
        # Parse report date
        try:
            if 'T' in report_date_str:
                report_date = datetime.fromisoformat(report_date_str.replace('Z', '+00:00'))
            else:
                report_date = datetime.strptime(report_date_str, '%Y-%m-%d')
        except (ValueError, TypeError):
            report_date = datetime.utcnow()
        
        # Generate report ID
        report_id = str(uuid4())
        
        findings = []
        
        # Process groups from the new format
        groups_data = data.get('groups', {})
        for group_name, members in groups_data.items():
            if not isinstance(members, list):
                continue
                
            # Create finding for group membership
            if members:
                # Enhanced member data processing
                processed_members = []
                for member in members:
                    if isinstance(member, dict):
                        processed_members.append({
                            'name': member.get('name', ''),
                            'samaccountname': member.get('samaccountname', ''),
                            'sid': member.get('sid', ''),
                            'type': member.get('type', 'user'),
                            'enabled': member.get('enabled', None)
                        })
                    else:
                        # Handle legacy string format
                        processed_members.append({
                            'name': str(member),
                            'samaccountname': '',
                            'sid': '',
                            'type': 'user',
                            'enabled': None
                        })
                
                finding = Finding(
                    id=str(uuid4()),
                    report_id=report_id,
                    tool_type=SecurityToolType.DOMAIN_ANALYSIS,
                    category="DonScanner",
                    name=f"Group_{group_name}_Members",
                    score=self._calculate_group_risk_score(group_name, len(members)),
                    severity=self._determine_group_severity(group_name, len(members)),
                    description=f"Group '{group_name}' has {len(members)} members",
                    recommendation=f"Review membership of privileged group '{group_name}'. Accept authorized members and investigate unaccepted ones.",
                    metadata={
                        'group_name': group_name,
                        'member_count': len(members),
                        'members': processed_members,
                        'group_sid': '',  # Not provided in current scanner format
                        'group_type': 'security',
                        'scanner_version': data.get('metadata', {}).get('script_version', '1.0')
                    }
                )
                findings.append(finding)
        
        return Report(
            id=report_id,
            tool_type=SecurityToolType.DOMAIN_ANALYSIS,
            domain=domain,
            domain_sid=domain_sid,  # ✅ Keep for validation
            # ✅ CRITICAL: Don't set PingCastle-specific fields for domain scanner
            domain_functional_level=None,  # Only PingCastle should set this
            forest_functional_level=None,  # Only PingCastle should set this
            maturity_level=None,           # Only PingCastle should set this
            dc_count=None,                 # Only PingCastle should set this
            user_count=None,               # Only PingCastle should set this
            computer_count=None,           # Only PingCastle should set this
            # ✅ Domain scanner specific scores should be 0/None
            global_score=None,             # Don't set PingCastle global score
            high_score=None,               # Domain scanner doesn't have these
            medium_score=None,             # Domain scanner doesn't have these
            low_score=None,                # Domain scanner doesn't have these
            stale_objects_score=None,      # Domain scanner doesn't have these
            privileged_accounts_score=None, # Domain scanner doesn't have these
            trusts_score=None,             # Domain scanner doesn't have these
            anomalies_score=None,          # Domain scanner doesn't have these
            report_date=report_date,
            upload_date=datetime.utcnow(),
            metadata={
                'tool_type': 'domain_group_members',
                'scanner_metadata': data.get('metadata', {}),
                'processed_groups': list(groups_data.keys()),
                'data_scope': 'group_memberships_only'  # Clear scope indication
            },
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
    
    def extract_group_memberships(self, report: Report, storage=None) -> List[GroupMembership]:
        """Extract group membership data from the report."""
        if not storage:
            return []  # Can't process without storage access
            
        memberships = []
        
        for finding in report.findings:
            # Accept both legacy and normalized categories
            if finding.category in ("DonScanner", "PrivilegedAccounts") and finding.name.startswith("Group_"):
                group_name = finding.metadata.get('group_name', '')
                members = finding.metadata.get('members', [])
                
                # Look up or create monitored group
                monitored_groups = storage.get_monitored_groups()
                group_id = None
                
                # Find existing monitored group by name
                for monitored_group in monitored_groups:
                    if monitored_group.group_name == group_name:
                        group_id = monitored_group.id
                        break
                
                # If group is not monitored, create it
                if not group_id:
                    from server.models import MonitoredGroup
                    new_group = MonitoredGroup(
                        group_name=group_name,
                        domain=report.domain,
                        description=f"Auto-created from domain scan for {group_name}",
                        is_active=True,
                        alert_on_changes=True
                    )
                    group_id = storage.add_monitored_group(new_group)
                
                # Create memberships for this group
                for member in members:
                    if isinstance(member, dict):
                        # Enhanced member data from new scanner
                        member_name = member.get('name', '')
                        member_sid = member.get('sid', '')
                        member_type_str = member.get('type', 'user').lower()
                        is_enabled = member.get('enabled', None)
                        
                        # Map member type string to enum
                        if member_type_str == 'computer':
                            member_type = MemberType.COMPUTER
                        elif member_type_str == 'group':
                            member_type = MemberType.GROUP
                        else:
                            member_type = MemberType.USER
                    else:
                        # Legacy string format
                        member_name = str(member)
                        member_sid = ''
                        member_type = MemberType.USER
                        is_enabled = None
                    
                    if member_name:  # Only create membership if we have a name
                        membership = GroupMembership(
                            report_id=report.id,
                            group_id=group_id,
                            member_name=member_name,
                            member_sid=member_sid,
                            member_type=member_type,
                            is_direct_member=True
                        )
                        # Note: is_enabled will be handled by the enhanced GroupMembership model
                        # after database migration is applied
                        memberships.append(membership)
        
        return memberships
