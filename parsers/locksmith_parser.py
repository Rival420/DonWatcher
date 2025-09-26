from models import Report, Finding, SecurityToolType
from parsers.base_parser import BaseSecurityParser
from uuid import uuid4
from datetime import datetime
from pathlib import Path
from typing import List, Dict, Any
import json
import csv
import logging

class LocksmithParser(BaseSecurityParser):
    """Parser for Locksmith ADCS configuration reports."""
    
    @property
    def tool_type(self) -> SecurityToolType:
        return SecurityToolType.LOCKSMITH
    
    @property
    def supported_extensions(self) -> List[str]:
        return ['.json', '.csv']
    
    def can_parse(self, file_path: Path) -> bool:
        """Check if this is a Locksmith report file."""
        if not self.validate_file(file_path):
            return False
        
        try:
            if file_path.suffix.lower() == '.json':
                with open(file_path, 'r', encoding='utf-8') as f:
                    data = json.load(f)
                
                # Check for Locksmith-specific structure
                return (isinstance(data, dict) and 
                       ('locksmith' in str(data).lower() or 
                        'adcs' in str(data).lower() or
                        'certificate' in str(data).lower() or
                        any('template' in str(key).lower() for key in data.keys())))
            
            elif file_path.suffix.lower() == '.csv':
                with open(file_path, 'r', encoding='utf-8') as f:
                    reader = csv.DictReader(f)
                    headers = reader.fieldnames or []
                    
                    # Check for Locksmith CSV headers
                    locksmith_headers = ['template', 'certificate', 'ca', 'issue', 'finding']
                    return any(header.lower() in [h.lower() for h in headers] 
                              for header in locksmith_headers)
            
        except Exception:
            return False
        
        return False
    
    def parse_report(self, file_path: Path) -> Report:
        """Parse Locksmith report file."""
        if file_path.suffix.lower() == '.json':
            return self._parse_json_report(file_path)
        elif file_path.suffix.lower() == '.csv':
            return self._parse_csv_report(file_path)
        else:
            raise ValueError(f"Unsupported file format: {file_path.suffix}")
    
    def _parse_json_report(self, file_path: Path) -> Report:
        """Parse JSON format Locksmith report."""
        with open(file_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
        
        # Extract basic information
        domain = data.get('domain', data.get('forest', 'Unknown'))
        report_date_str = data.get('scan_date', data.get('timestamp', datetime.utcnow().isoformat()))
        
        try:
            if 'T' in report_date_str:
                report_date = datetime.fromisoformat(report_date_str.replace('Z', '+00:00'))
            else:
                report_date = datetime.strptime(report_date_str, '%Y-%m-%d')
        except ValueError:
            report_date = datetime.utcnow()
        
        report_id = str(uuid4())
        findings = []
        
        # Process certificate templates
        templates = data.get('certificate_templates', data.get('templates', {}))
        for template_name, template_data in templates.items():
            findings.extend(self._analyze_certificate_template(report_id, template_name, template_data))
        
        # Process certificate authorities
        cas = data.get('certificate_authorities', data.get('cas', {}))
        for ca_name, ca_data in cas.items():
            findings.extend(self._analyze_certificate_authority(report_id, ca_name, ca_data))
        
        # Process general ADCS findings
        adcs_findings = data.get('findings', data.get('issues', []))
        for finding_data in adcs_findings:
            finding = Finding(
                id=str(uuid4()),
                report_id=report_id,
                tool_type=SecurityToolType.LOCKSMITH,
                category=finding_data.get('category', 'ADCS_Configuration'),
                name=finding_data.get('name', 'Unknown_ADCS_Issue'),
                score=finding_data.get('score', self._calculate_default_score(finding_data.get('severity', 'medium'))),
                severity=finding_data.get('severity', 'medium'),
                description=finding_data.get('description', ''),
                recommendation=finding_data.get('recommendation', finding_data.get('remediation', '')),
                metadata=finding_data.get('metadata', {})
            )
            findings.append(finding)
        
        return Report(
            id=report_id,
            tool_type=SecurityToolType.LOCKSMITH,
            domain=domain,
            report_date=report_date,
            upload_date=datetime.utcnow(),
            metadata=data.get('metadata', {}),
            findings=findings,
            original_file=str(file_path)
        )
    
    def _parse_csv_report(self, file_path: Path) -> Report:
        """Parse CSV format Locksmith report."""
        findings = []
        domain = "Unknown"
        report_id = str(uuid4())
        
        with open(file_path, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            
            for row in reader:
                # Extract domain if available
                if 'domain' in row and row['domain']:
                    domain = row['domain']
                
                # Create finding from CSV row
                finding_name = row.get('finding', row.get('issue', 'Unknown_ADCS_Issue'))
                template_name = row.get('template', row.get('certificate_template', ''))
                ca_name = row.get('ca', row.get('certificate_authority', ''))
                
                description = self._build_csv_description(row)
                severity = self._determine_csv_severity(row)
                
                finding = Finding(
                    id=str(uuid4()),
                    report_id=report_id,
                    tool_type=SecurityToolType.LOCKSMITH,
                    category="ADCS_Configuration",
                    name=finding_name,
                    score=self._calculate_default_score(severity),
                    severity=severity,
                    description=description,
                    recommendation=self._generate_csv_recommendation(row),
                    metadata={
                        'template': template_name,
                        'ca': ca_name,
                        'raw_data': dict(row)
                    }
                )
                findings.append(finding)
        
        return Report(
            id=report_id,
            tool_type=SecurityToolType.LOCKSMITH,
            domain=domain,
            report_date=datetime.utcnow(),
            upload_date=datetime.utcnow(),
            findings=findings,
            original_file=str(file_path)
        )
    
    def _analyze_certificate_template(self, report_id: str, template_name: str, template_data: Dict[str, Any]) -> List[Finding]:
        """Analyze a certificate template for security issues."""
        findings = []
        
        # Check for overprivileged templates
        permissions = template_data.get('permissions', {})
        if self._is_overprivileged_template(permissions):
            finding = Finding(
                id=str(uuid4()),
                report_id=report_id,
                tool_type=SecurityToolType.LOCKSMITH,
                category="Certificate_Templates",
                name="Overprivileged_Certificate_Template",
                score=25,
                severity="high",
                description=f"Certificate template '{template_name}' has overprivileged permissions",
                recommendation=f"Review and restrict permissions for certificate template '{template_name}'",
                metadata={
                    'template_name': template_name,
                    'permissions': permissions,
                    'template_data': template_data
                }
            )
            findings.append(finding)
        
        # Check for templates allowing SAN
        if template_data.get('allows_san', False):
            finding = Finding(
                id=str(uuid4()),
                report_id=report_id,
                tool_type=SecurityToolType.LOCKSMITH,
                category="Certificate_Templates",
                name="Template_Allows_SAN",
                score=20,
                severity="high",
                description=f"Certificate template '{template_name}' allows Subject Alternative Names",
                recommendation=f"Disable SAN for certificate template '{template_name}' or restrict its use",
                metadata={
                    'template_name': template_name,
                    'template_data': template_data
                }
            )
            findings.append(finding)
        
        # Check for templates with no approval required
        if not template_data.get('requires_approval', True):
            finding = Finding(
                id=str(uuid4()),
                report_id=report_id,
                tool_type=SecurityToolType.LOCKSMITH,
                category="Certificate_Templates",
                name="Template_No_Approval_Required",
                score=15,
                severity="medium",
                description=f"Certificate template '{template_name}' does not require approval",
                recommendation=f"Enable approval requirement for certificate template '{template_name}'",
                metadata={
                    'template_name': template_name,
                    'template_data': template_data
                }
            )
            findings.append(finding)
        
        return findings
    
    def _analyze_certificate_authority(self, report_id: str, ca_name: str, ca_data: Dict[str, Any]) -> List[Finding]:
        """Analyze a certificate authority for security issues."""
        findings = []
        
        # Check CA permissions
        permissions = ca_data.get('permissions', {})
        if self._has_dangerous_ca_permissions(permissions):
            finding = Finding(
                id=str(uuid4()),
                report_id=report_id,
                tool_type=SecurityToolType.LOCKSMITH,
                category="Certificate_Authorities",
                name="Dangerous_CA_Permissions",
                score=30,
                severity="high",
                description=f"Certificate Authority '{ca_name}' has dangerous permissions",
                recommendation=f"Review and restrict permissions for Certificate Authority '{ca_name}'",
                metadata={
                    'ca_name': ca_name,
                    'permissions': permissions,
                    'ca_data': ca_data
                }
            )
            findings.append(finding)
        
        return findings
    
    def _is_overprivileged_template(self, permissions: Dict[str, Any]) -> bool:
        """Check if a template has overprivileged permissions."""
        dangerous_permissions = ['GenericAll', 'WriteDacl', 'WriteOwner', 'FullControl']
        risky_groups = ['Everyone', 'Authenticated Users', 'Domain Users']
        
        for principal, perms in permissions.items():
            if principal in risky_groups and any(perm in perms for perm in dangerous_permissions):
                return True
        
        return False
    
    def _has_dangerous_ca_permissions(self, permissions: Dict[str, Any]) -> bool:
        """Check if CA has dangerous permissions."""
        dangerous_permissions = ['ManageCA', 'ManageCertificates', 'Enroll']
        risky_groups = ['Everyone', 'Authenticated Users', 'Domain Users']
        
        for principal, perms in permissions.items():
            if principal in risky_groups and any(perm in perms for perm in dangerous_permissions):
                return True
        
        return False
    
    def _build_csv_description(self, row: Dict[str, str]) -> str:
        """Build description from CSV row data."""
        parts = []
        
        if row.get('finding'):
            parts.append(f"Issue: {row['finding']}")
        
        if row.get('template'):
            parts.append(f"Template: {row['template']}")
        
        if row.get('ca'):
            parts.append(f"CA: {row['ca']}")
        
        return "; ".join(parts) if parts else "ADCS configuration issue detected"
    
    def _determine_csv_severity(self, row: Dict[str, str]) -> str:
        """Determine severity from CSV row data."""
        if 'severity' in row:
            return row['severity'].lower()
        
        # Infer severity from finding name/description
        finding_text = (row.get('finding', '') + ' ' + row.get('description', '')).lower()
        
        if any(word in finding_text for word in ['critical', 'high', 'dangerous', 'exploit']):
            return 'high'
        elif any(word in finding_text for word in ['medium', 'moderate', 'warning']):
            return 'medium'
        else:
            return 'low'
    
    def _generate_csv_recommendation(self, row: Dict[str, str]) -> str:
        """Generate recommendation from CSV row data."""
        if 'recommendation' in row and row['recommendation']:
            return row['recommendation']
        
        if 'remediation' in row and row['remediation']:
            return row['remediation']
        
        # Generate generic recommendation
        if row.get('template'):
            return f"Review and secure certificate template '{row['template']}'"
        elif row.get('ca'):
            return f"Review and secure certificate authority '{row['ca']}'"
        else:
            return "Review and remediate ADCS configuration issue"
    
    def _calculate_default_score(self, severity: str) -> int:
        """Calculate default score based on severity."""
        severity_scores = {
            'high': 25,
            'medium': 15,
            'low': 5
        }
        return severity_scores.get(severity.lower(), 10)
