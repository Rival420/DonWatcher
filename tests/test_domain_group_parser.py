"""
Unit tests for domain group members parser functionality.
Tests the new domain_group_members format parsing and API endpoints.
"""

import unittest
import json
import tempfile
from pathlib import Path
from datetime import datetime
from unittest.mock import Mock, patch

# Import the modules to test
import sys
import os
sys.path.append(os.path.join(os.path.dirname(__file__), 'server'))

from server.parsers.domain_analysis_parser import DomainAnalysisParser
from server.models import SecurityToolType, MemberType

class TestDomainGroupMembersParser(unittest.TestCase):
    """Test cases for the enhanced domain analysis parser."""
    
    def setUp(self):
        """Set up test fixtures."""
        self.parser = DomainAnalysisParser()
        
        # Sample domain_group_members JSON data
        self.sample_data = {
            "tool_type": "domain_group_members",
            "domain": "test.local",
            "domain_sid": "S-1-5-21-1234567890-1234567890-1234567890",
            "report_date": "2024-01-15T10:30:00.000Z",
            "groups": {
                "Domain Admins": [
                    {
                        "name": "Administrator",
                        "samaccountname": "Administrator",
                        "sid": "S-1-5-21-1234567890-1234567890-1234567890-500",
                        "type": "user",
                        "enabled": True
                    },
                    {
                        "name": "john.doe",
                        "samaccountname": "john.doe", 
                        "sid": "S-1-5-21-1234567890-1234567890-1234567890-1001",
                        "type": "user",
                        "enabled": True
                    }
                ],
                "Administrators": [
                    {
                        "name": "CORP-DC01$",
                        "samaccountname": "CORP-DC01$",
                        "sid": "S-1-5-21-1234567890-1234567890-1234567890-1000", 
                        "type": "computer",
                        "enabled": True
                    }
                ],
                "Account Operators": []
            },
            "metadata": {
                "agent_name": "powershell_domain_scanner_minimal",
                "script_version": "1.0"
            }
        }
    
    def test_can_parse_domain_group_members_format(self):
        """Test that parser recognizes domain_group_members format."""
        # Create temporary JSON file
        with tempfile.NamedTemporaryFile(mode='w', suffix='.json', delete=False) as f:
            json.dump(self.sample_data, f)
            temp_path = Path(f.name)
        
        try:
            # Test parser recognition
            self.assertTrue(self.parser.can_parse(temp_path))
        finally:
            temp_path.unlink()
    
    def test_can_parse_rejects_invalid_format(self):
        """Test that parser rejects invalid formats."""
        invalid_data = {"tool_type": "invalid", "data": "test"}
        
        with tempfile.NamedTemporaryFile(mode='w', suffix='.json', delete=False) as f:
            json.dump(invalid_data, f)
            temp_path = Path(f.name)
        
        try:
            self.assertFalse(self.parser.can_parse(temp_path))
        finally:
            temp_path.unlink()
    
    def test_parse_domain_group_members_format(self):
        """Test parsing of domain_group_members format."""
        with tempfile.NamedTemporaryFile(mode='w', suffix='.json', delete=False) as f:
            json.dump(self.sample_data, f)
            temp_path = Path(f.name)
        
        try:
            # Parse the report
            report = self.parser.parse_report(temp_path)
            
            # Verify report properties
            self.assertEqual(report.tool_type, SecurityToolType.DOMAIN_ANALYSIS)
            self.assertEqual(report.domain, "test.local")
            self.assertEqual(report.domain_sid, "S-1-5-21-1234567890-1234567890-1234567890")
            
            # Verify findings were created
            self.assertEqual(len(report.findings), 2)  # Domain Admins and Administrators (Account Operators is empty)
            
            # Check Domain Admins finding
            domain_admins_finding = next(f for f in report.findings if f.metadata.get('group_name') == 'Domain Admins')
            self.assertEqual(domain_admins_finding.category, "DonScanner")
            self.assertEqual(domain_admins_finding.name, "Group_Domain Admins_Members")
            self.assertEqual(domain_admins_finding.metadata['member_count'], 2)
            self.assertEqual(len(domain_admins_finding.metadata['members']), 2)
            
            # Check member data structure
            first_member = domain_admins_finding.metadata['members'][0]
            self.assertEqual(first_member['name'], 'Administrator')
            self.assertEqual(first_member['samaccountname'], 'Administrator')
            self.assertEqual(first_member['type'], 'user')
            self.assertTrue(first_member['enabled'])
            
        finally:
            temp_path.unlink()
    
    def test_member_type_mapping(self):
        """Test that member types are correctly mapped."""
        # Test computer type
        computer_data = self.sample_data.copy()
        
        with tempfile.NamedTemporaryFile(mode='w', suffix='.json', delete=False) as f:
            json.dump(computer_data, f)
            temp_path = Path(f.name)
        
        try:
            report = self.parser.parse_report(temp_path)
            
            # Find Administrators group finding
            admin_finding = next(f for f in report.findings if f.metadata.get('group_name') == 'Administrators')
            computer_member = admin_finding.metadata['members'][0]
            
            self.assertEqual(computer_member['type'], 'computer')
            self.assertEqual(computer_member['name'], 'CORP-DC01$')
            
        finally:
            temp_path.unlink()
    
    def test_risk_score_calculation(self):
        """Test that risk scores are calculated correctly."""
        with tempfile.NamedTemporaryFile(mode='w', suffix='.json', delete=False) as f:
            json.dump(self.sample_data, f)
            temp_path = Path(f.name)
        
        try:
            report = self.parser.parse_report(temp_path)
            
            # Domain Admins should have higher risk score (high-risk group)
            domain_admins_finding = next(f for f in report.findings if f.metadata.get('group_name') == 'Domain Admins')
            self.assertGreater(domain_admins_finding.score, 0)
            
            # Check severity assignment
            self.assertIn(domain_admins_finding.severity, ['low', 'medium', 'high'])
            
        finally:
            temp_path.unlink()
    
    def test_extract_group_memberships(self):
        """Test extraction of group memberships from report."""
        with tempfile.NamedTemporaryFile(mode='w', suffix='.json', delete=False) as f:
            json.dump(self.sample_data, f)
            temp_path = Path(f.name)
        
        try:
            report = self.parser.parse_report(temp_path)
            
            # Mock storage
            mock_storage = Mock()
            mock_storage.get_monitored_groups.return_value = []
            mock_storage.add_monitored_group.return_value = "test-group-id"
            
            # Extract memberships
            memberships = self.parser.extract_group_memberships(report, mock_storage)
            
            # Should have memberships for Domain Admins (2) + Administrators (1) = 3 total
            self.assertEqual(len(memberships), 3)
            
            # Check first membership
            first_membership = memberships[0]
            self.assertEqual(first_membership.report_id, report.id)
            self.assertEqual(first_membership.group_id, "test-group-id")
            self.assertIn(first_membership.member_name, ['Administrator', 'john.doe', 'CORP-DC01$'])
            self.assertTrue(first_membership.is_direct_member)
            
        finally:
            temp_path.unlink()
    
    def test_legacy_string_member_format(self):
        """Test handling of legacy string-based member format."""
        legacy_data = self.sample_data.copy()
        legacy_data['groups']['Domain Admins'] = ['Administrator', 'john.doe']  # String format
        
        with tempfile.NamedTemporaryFile(mode='w', suffix='.json', delete=False) as f:
            json.dump(legacy_data, f)
            temp_path = Path(f.name)
        
        try:
            report = self.parser.parse_report(temp_path)
            
            # Should still parse correctly
            domain_admins_finding = next(f for f in report.findings if f.metadata.get('group_name') == 'Domain Admins')
            self.assertEqual(len(domain_admins_finding.metadata['members']), 2)
            
            # Check that string members were converted to dict format
            first_member = domain_admins_finding.metadata['members'][0]
            self.assertEqual(first_member['name'], 'Administrator')
            self.assertEqual(first_member['type'], 'user')  # Default type
            self.assertIsNone(first_member['enabled'])  # Unknown for legacy format
            
        finally:
            temp_path.unlink()
    
    def test_empty_groups_ignored(self):
        """Test that empty groups don't create findings."""
        with tempfile.NamedTemporaryFile(mode='w', suffix='.json', delete=False) as f:
            json.dump(self.sample_data, f)
            temp_path = Path(f.name)
        
        try:
            report = self.parser.parse_report(temp_path)
            
            # Should not have finding for Account Operators (empty group)
            account_operators_findings = [f for f in report.findings if f.metadata.get('group_name') == 'Account Operators']
            self.assertEqual(len(account_operators_findings), 0)
            
        finally:
            temp_path.unlink()


class TestDomainGroupAPI(unittest.TestCase):
    """Test cases for domain group management API endpoints."""
    
    @patch('server.main.PostgresReportStorage')
    def test_get_domain_groups_endpoint_logic(self, mock_storage_class):
        """Test the logic for getting domain groups with acceptance status."""
        # This would test the API endpoint logic if we had a proper test client setup
        # For now, we'll test the core logic components
        
        # Mock data
        mock_reports = [
            Mock(domain='test.local', tool_type=SecurityToolType.DOMAIN_ANALYSIS, report_date=datetime.now(), id='report1')
        ]
        
        mock_finding = Mock()
        mock_finding.category = 'DonScanner'
        mock_finding.name = 'Group_Domain Admins_Members'
        mock_finding.metadata = {
            'group_name': 'Domain Admins',
            'member_count': 3,
            'members': [
                {'name': 'user1', 'type': 'user', 'enabled': True},
                {'name': 'user2', 'type': 'user', 'enabled': True}, 
                {'name': 'user3', 'type': 'user', 'enabled': False}
            ]
        }
        mock_finding.score = 25
        
        mock_report_detail = Mock()
        mock_report_detail.findings = [mock_finding]
        
        mock_accepted_member = Mock()
        mock_accepted_member.member_name = 'user1'
        
        mock_storage = Mock()
        mock_storage.get_all_reports_summary.return_value = mock_reports
        mock_storage.get_report.return_value = mock_report_detail
        mock_storage.get_accepted_group_members.return_value = [mock_accepted_member]
        mock_storage.get_group_risk_configs.return_value = []
        
        # Test the core logic that would be in the API endpoint
        domain = 'test.local'
        reports = mock_storage.get_all_reports_summary()
        domain_reports = [r for r in reports if r.domain == domain and r.tool_type == SecurityToolType.DOMAIN_ANALYSIS]
        
        self.assertEqual(len(domain_reports), 1)
        
        latest_report = max(domain_reports, key=lambda r: r.report_date)
        report_detail = mock_storage.get_report(latest_report.id)
        
        # Process findings
        groups = []
        for finding in report_detail.findings:
            if finding.category == "DonScanner" and finding.name.startswith("Group_"):
                group_name = finding.metadata.get('group_name', '')
                total_members = finding.metadata.get('member_count', 0)
                
                accepted_members = mock_storage.get_accepted_group_members(domain, group_name)
                accepted_count = len(accepted_members)
                unaccepted_count = total_members - accepted_count
                
                groups.append({
                    'group_name': group_name,
                    'total_members': total_members,
                    'accepted_members': accepted_count,
                    'unaccepted_members': unaccepted_count
                })
        
        # Verify results
        self.assertEqual(len(groups), 1)
        group = groups[0]
        self.assertEqual(group['group_name'], 'Domain Admins')
        self.assertEqual(group['total_members'], 3)
        self.assertEqual(group['accepted_members'], 1)
        self.assertEqual(group['unaccepted_members'], 2)


if __name__ == '__main__':
    # Run the tests
    unittest.main(verbosity=2)
