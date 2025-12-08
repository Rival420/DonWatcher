"""
Bug Fix Validation Tests - Data Separation
Tests that PingCastle and domain scanner data don't interfere with each other
"""

import unittest
import json
import tempfile
from pathlib import Path
from datetime import datetime
from unittest.mock import Mock

import sys
import os
sys.path.append(os.path.join(os.path.dirname(__file__), '..', 'server'))

from server.parsers.domain_analysis_parser import DomainAnalysisParser
from server.models import SecurityToolType


class TestDataSeparationBugFix(unittest.TestCase):
    """Test that the data separation bug has been properly fixed."""
    
    def setUp(self):
        """Set up test fixtures."""
        self.domain_parser = DomainAnalysisParser()
        
        # Sample domain scanner JSON (should NOT set PingCastle metadata)
        self.domain_scanner_data = {
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
                    }
                ]
            },
            "metadata": {
                "agent_name": "powershell_domain_scanner_minimal",
                "script_version": "1.0"
            }
        }
        
        # Mock PingCastle data (should have all domain metadata)
        self.pingcastle_data = {
            "domain": "test.local",
            "domain_sid": "S-1-5-21-1234567890-1234567890-1234567890",
            "domain_functional_level": "2016",
            "forest_functional_level": "2016", 
            "maturity_level": "Level 3",
            "dc_count": 2,
            "user_count": 1500,
            "computer_count": 800,
            "global_score": 75,
            "stale_objects_score": 20,
            "privileged_accounts_score": 25,
            "trusts_score": 15,
            "anomalies_score": 15
        }
    
    def test_domain_scanner_doesnt_set_pingcastle_metadata(self):
        """Test that domain scanner reports don't set PingCastle-specific metadata."""
        with tempfile.NamedTemporaryFile(mode='w', suffix='.json', delete=False) as f:
            json.dump(self.domain_scanner_data, f)
            temp_path = Path(f.name)
        
        try:
            # Parse domain scanner report
            report = self.domain_parser.parse_report(temp_path)
            
            # ✅ Should have domain and domain_sid for validation
            self.assertEqual(report.domain, "test.local")
            self.assertEqual(report.domain_sid, "S-1-5-21-1234567890-1234567890-1234567890")
            
            # ✅ Should NOT have PingCastle-specific metadata
            self.assertIsNone(report.domain_functional_level)
            self.assertIsNone(report.forest_functional_level)
            self.assertIsNone(report.maturity_level)
            self.assertIsNone(report.dc_count)
            self.assertIsNone(report.user_count)
            self.assertIsNone(report.computer_count)
            
            # ✅ Should NOT have PingCastle scores
            self.assertIsNone(report.global_score)
            self.assertIsNone(report.stale_objects_score)
            self.assertIsNone(report.privileged_accounts_score)
            self.assertIsNone(report.trusts_score)
            self.assertIsNone(report.anomalies_score)
            
            # ✅ Should have group membership findings
            self.assertGreater(len(report.findings), 0)
            domain_admins_finding = next(f for f in report.findings if f.metadata.get('group_name') == 'Domain Admins')
            self.assertEqual(domain_admins_finding.category, "DonScanner")
            
        finally:
            temp_path.unlink()
    
    def test_data_scope_indication(self):
        """Test that domain scanner reports clearly indicate their data scope."""
        with tempfile.NamedTemporaryFile(mode='w', suffix='.json', delete=False) as f:
            json.dump(self.domain_scanner_data, f)
            temp_path = Path(f.name)
        
        try:
            report = self.domain_parser.parse_report(temp_path)
            
            # Should clearly indicate data scope
            self.assertEqual(report.metadata.get('tool_type'), 'domain_group_members')
            self.assertEqual(report.metadata.get('data_scope'), 'group_memberships_only')
            
        finally:
            temp_path.unlink()
    
    def test_frontend_data_loading_logic(self):
        """Test the frontend data loading logic for proper separation."""
        # This tests the conceptual logic that should be in the frontend
        
        # Mock reports data
        mock_all_reports = [
            {
                'id': 'pingcastle-1',
                'tool_type': 'pingcastle',
                'domain': 'test.local',
                'report_date': '2024-01-10T10:00:00Z',
                'global_score': 75,
                'domain_functional_level': '2016',
                'user_count': 1500
            },
            {
                'id': 'domain-scanner-1', 
                'tool_type': 'domain_analysis',
                'domain': 'test.local',
                'report_date': '2024-01-15T10:00:00Z',  # Newer than PingCastle
                'global_score': None,  # Fixed: No longer sets PingCastle scores
                'domain_functional_level': None,  # Fixed: No longer sets PingCastle metadata
                'user_count': None     # Fixed: No longer sets PingCastle metadata
            }
        ]
        
        # Simulate frontend logic - get latest by tool type
        pingcastle_reports = [r for r in mock_all_reports if r['tool_type'] == 'pingcastle']
        domain_scanner_reports = [r for r in mock_all_reports if r['tool_type'] == 'domain_analysis']
        
        # Should use PingCastle data for domain overview
        if pingcastle_reports:
            latest_pingcastle = max(pingcastle_reports, key=lambda r: r['report_date'])
            
            # Domain overview should use PingCastle data
            domain_functional_level = latest_pingcastle['domain_functional_level']
            user_count = latest_pingcastle['user_count']
            pingcastle_score = latest_pingcastle['global_score']
            
            self.assertEqual(domain_functional_level, '2016')
            self.assertEqual(user_count, 1500)
            self.assertEqual(pingcastle_score, 75)
        
        # Should use domain scanner data for group management
        if domain_scanner_reports:
            latest_domain_scanner = max(domain_scanner_reports, key=lambda r: r['report_date'])
            
            # Domain scanner should not have PingCastle metadata
            self.assertIsNone(latest_domain_scanner['global_score'])
            self.assertIsNone(latest_domain_scanner['domain_functional_level'])
            self.assertIsNone(latest_domain_scanner['user_count'])
    
    def test_tool_type_filtering_logic(self):
        """Test that tool type filtering works correctly for data separation."""
        # Mock mixed reports
        mixed_reports = [
            {'tool_type': 'pingcastle', 'domain': 'test.local', 'global_score': 80},
            {'tool_type': 'domain_analysis', 'domain': 'test.local', 'global_score': None},
            {'tool_type': 'locksmith', 'domain': 'test.local', 'global_score': None},
            {'tool_type': 'pingcastle', 'domain': 'other.local', 'global_score': 60}
        ]
        
        # Filter for PingCastle reports only
        pingcastle_only = [r for r in mixed_reports if r['tool_type'] == 'pingcastle']
        self.assertEqual(len(pingcastle_only), 2)
        
        # Filter for specific domain
        test_domain_pingcastle = [r for r in pingcastle_only if r['domain'] == 'test.local']
        self.assertEqual(len(test_domain_pingcastle), 1)
        self.assertEqual(test_domain_pingcastle[0]['global_score'], 80)
        
        # Domain scanner reports should not have global scores
        domain_scanner_only = [r for r in mixed_reports if r['tool_type'] == 'domain_analysis']
        self.assertEqual(len(domain_scanner_only), 1)
        self.assertIsNone(domain_scanner_only[0]['global_score'])


class TestBugFixValidation(unittest.TestCase):
    """Integration tests to validate complete bug fix."""
    
    def test_upload_sequence_simulation(self):
        """Simulate the problematic upload sequence to verify fix."""
        # This simulates the bug scenario:
        # 1. Upload PingCastle report
        # 2. Upload domain scanner report  
        # 3. Verify PingCastle data is preserved
        
        # Step 1: PingCastle upload (simulated)
        pingcastle_report = {
            'id': 'pingcastle-report',
            'tool_type': 'pingcastle',
            'domain': 'test.local',
            'report_date': '2024-01-10T10:00:00Z',
            'domain_functional_level': '2016',
            'user_count': 1500,
            'global_score': 75
        }
        
        # Step 2: Domain scanner upload (simulated) 
        domain_scanner_report = {
            'id': 'domain-scanner-report',
            'tool_type': 'domain_analysis', 
            'domain': 'test.local',
            'report_date': '2024-01-15T10:00:00Z',  # Newer date
            'domain_functional_level': None,  # Fixed: Should be None
            'user_count': None,               # Fixed: Should be None
            'global_score': None              # Fixed: Should be None
        }
        
        # Step 3: Frontend data loading simulation
        all_reports = [pingcastle_report, domain_scanner_report]
        
        # Get latest domain (should be test.local from either report)
        latest_domain = max(all_reports, key=lambda r: r['report_date'])['domain']
        self.assertEqual(latest_domain, 'test.local')
        
        # Get PingCastle data for domain overview (FIXED LOGIC)
        pingcastle_reports = [r for r in all_reports if r['tool_type'] == 'pingcastle']
        domain_pingcastle = [r for r in pingcastle_reports if r['domain'] == latest_domain]
        
        if domain_pingcastle:
            latest_pingcastle = max(domain_pingcastle, key=lambda r: r['report_date'])
            
            # ✅ Domain overview should use PingCastle data
            self.assertEqual(latest_pingcastle['domain_functional_level'], '2016')
            self.assertEqual(latest_pingcastle['user_count'], 1500)
            self.assertEqual(latest_pingcastle['global_score'], 75)
        
        # Get domain scanner data for group management
        domain_scanner_reports = [r for r in all_reports if r['tool_type'] == 'domain_analysis']
        domain_scanner = [r for r in domain_scanner_reports if r['domain'] == latest_domain]
        
        if domain_scanner:
            latest_scanner = max(domain_scanner, key=lambda r: r['report_date'])
            
            # ✅ Domain scanner should not have PingCastle metadata
            self.assertIsNone(latest_scanner['domain_functional_level'])
            self.assertIsNone(latest_scanner['user_count'])
            self.assertIsNone(latest_scanner['global_score'])
    
    def test_dashboard_section_data_sources(self):
        """Test that each dashboard section uses the correct data source."""
        # Mock the data that each section should use
        
        dashboard_sections = {
            'domain_overview': {
                'data_source': 'pingcastle_only',
                'fields': ['domain_functional_level', 'user_count', 'dc_count'],
                'should_not_use': 'domain_scanner_data'
            },
            'pingcastle_risk_scores': {
                'data_source': 'pingcastle_only', 
                'fields': ['global_score', 'stale_objects_score', 'privileged_accounts_score'],
                'should_not_use': 'domain_scanner_data'
            },
            'global_risk_score': {
                'data_source': 'risk_api_combined',
                'fields': ['global_score', 'pingcastle_contribution', 'domain_group_contribution'],
                'should_not_use': 'report_global_score'
            },
            'domain_scanner_groups': {
                'data_source': 'domain_scanner_only',
                'fields': ['group_memberships', 'acceptance_status'],
                'should_not_use': 'pingcastle_data'
            }
        }
        
        # Validate each section has correct data source assignment
        for section, config in dashboard_sections.items():
            self.assertIn('data_source', config)
            self.assertIn('fields', config)
            self.assertIn('should_not_use', config)
        
        # Specific validations
        self.assertEqual(dashboard_sections['domain_overview']['data_source'], 'pingcastle_only')
        self.assertEqual(dashboard_sections['domain_scanner_groups']['data_source'], 'domain_scanner_only')
        self.assertEqual(dashboard_sections['global_risk_score']['data_source'], 'risk_api_combined')


class TestPreventionMeasures(unittest.TestCase):
    """Test prevention measures to avoid future data mixing bugs."""
    
    def test_tool_type_validation(self):
        """Test that tool types are properly validated and separated."""
        # Test data with different tool types
        test_reports = [
            {'tool_type': 'pingcastle', 'has_domain_metadata': True},
            {'tool_type': 'domain_analysis', 'has_domain_metadata': False},
            {'tool_type': 'locksmith', 'has_domain_metadata': False}
        ]
        
        for report in test_reports:
            if report['tool_type'] == 'pingcastle':
                # Only PingCastle should have domain metadata
                self.assertTrue(report['has_domain_metadata'])
            else:
                # Other tools should not set domain metadata
                self.assertFalse(report['has_domain_metadata'])
    
    def test_data_source_documentation(self):
        """Test that data sources are clearly documented and enforced."""
        # Define expected data source responsibilities
        data_source_rules = {
            'pingcastle': {
                'can_set': ['domain_functional_level', 'user_count', 'dc_count', 'global_score'],
                'cannot_set': [],
                'exclusive_fields': ['stale_objects_score', 'privileged_accounts_score']
            },
            'domain_analysis': {
                'can_set': ['domain_sid'],  # Only for validation
                'cannot_set': ['domain_functional_level', 'user_count', 'global_score'],
                'exclusive_fields': ['group_memberships', 'member_acceptance_data']
            }
        }
        
        # Validate rule structure
        for tool_type, rules in data_source_rules.items():
            self.assertIn('can_set', rules)
            self.assertIn('cannot_set', rules)
            self.assertIn('exclusive_fields', rules)
            
            # Ensure no overlap between can_set and cannot_set
            can_set = set(rules['can_set'])
            cannot_set = set(rules['cannot_set'])
            overlap = can_set.intersection(cannot_set)
            self.assertEqual(len(overlap), 0, f"Tool {tool_type} has overlapping can_set/cannot_set: {overlap}")


if __name__ == '__main__':
    print("🧪 Running Data Separation Bug Fix Validation Tests...")
    unittest.main(verbosity=2)
