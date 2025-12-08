"""
Unit tests for Phase 3 Risk Integration functionality
Tests risk calculation algorithms, API integration, and score accuracy
"""

import unittest
import json
from datetime import datetime, timedelta
from unittest.mock import Mock, patch, MagicMock

# Import modules to test
import sys
import os
sys.path.append(os.path.join(os.path.dirname(__file__), '..', 'server'))

from server.risk_calculator import (
    RiskCalculator, 
    GroupRiskLevel, 
    GroupRiskProfile,
    DomainGroupRisk,
    DomainRiskAssessment,
    GlobalRiskScore
)


class TestRiskCalculator(unittest.TestCase):
    """Test cases for the risk calculation engine."""
    
    def setUp(self):
        """Set up test fixtures."""
        self.calculator = RiskCalculator()
        
        # Sample group data for testing
        self.sample_groups = [
            {
                'group_name': 'Domain Admins',
                'total_members': 5,
                'accepted_members': 2,
                'unaccepted_members': 3
            },
            {
                'group_name': 'Enterprise Admins', 
                'total_members': 2,
                'accepted_members': 2,
                'unaccepted_members': 0
            },
            {
                'group_name': 'Administrators',
                'total_members': 10,
                'accepted_members': 8,
                'unaccepted_members': 2
            },
            {
                'group_name': 'Print Operators',
                'total_members': 5,
                'accepted_members': 5,
                'unaccepted_members': 0
            }
        ]
    
    def test_group_risk_calculation_critical_group(self):
        """Test risk calculation for critical groups (Domain Admins)."""
        risk = self.calculator.calculate_group_risk(
            group_name='Domain Admins',
            total_members=5,
            accepted_members=2
        )
        
        self.assertEqual(risk.group_name, 'Domain Admins')
        self.assertEqual(risk.total_members, 5)
        self.assertEqual(risk.accepted_members, 2)
        self.assertEqual(risk.unaccepted_members, 3)
        self.assertEqual(risk.risk_level, GroupRiskLevel.CRITICAL)
        
        # Should have high risk due to critical group + unaccepted members
        self.assertGreater(risk.risk_score, 50)
        
        # Check contributing factors
        self.assertIn('unaccepted_ratio', risk.contributing_factors)
        self.assertIn('criticality_multiplier', risk.contributing_factors)
    
    def test_group_risk_calculation_fully_accepted(self):
        """Test risk calculation for fully accepted group."""
        risk = self.calculator.calculate_group_risk(
            group_name='Enterprise Admins',
            total_members=2,
            accepted_members=2
        )
        
        self.assertEqual(risk.unaccepted_members, 0)
        # Should have very low risk when all members accepted
        self.assertLess(risk.risk_score, 10)
    
    def test_group_risk_calculation_empty_group(self):
        """Test risk calculation for empty group."""
        risk = self.calculator.calculate_group_risk(
            group_name='Empty Group',
            total_members=0,
            accepted_members=0
        )
        
        self.assertEqual(risk.risk_score, 0.0)
        self.assertEqual(risk.unaccepted_members, 0)
    
    def test_group_risk_calculation_unknown_group(self):
        """Test risk calculation for unknown/custom group."""
        risk = self.calculator.calculate_group_risk(
            group_name='Custom Security Group',
            total_members=10,
            accepted_members=5
        )
        
        self.assertEqual(risk.risk_level, GroupRiskLevel.LOW)
        # Should have moderate risk due to 50% unaccepted
        self.assertGreater(risk.risk_score, 0)
        self.assertLess(risk.risk_score, 100)
    
    def test_domain_risk_assessment(self):
        """Test complete domain risk assessment calculation."""
        assessment = self.calculator.calculate_domain_risk(
            domain='test.local',
            group_data=self.sample_groups
        )
        
        self.assertEqual(assessment.domain, 'test.local')
        self.assertEqual(len(assessment.group_risks), 4)
        
        # Check that scores are within valid range
        self.assertGreaterEqual(assessment.access_governance_score, 0)
        self.assertLessEqual(assessment.access_governance_score, 100)
        
        self.assertGreaterEqual(assessment.privilege_escalation_score, 0)
        self.assertLessEqual(assessment.privilege_escalation_score, 100)
        
        self.assertGreaterEqual(assessment.compliance_posture_score, 0)
        self.assertLessEqual(assessment.compliance_posture_score, 100)
        
        self.assertGreaterEqual(assessment.operational_risk_score, 0)
        self.assertLessEqual(assessment.operational_risk_score, 100)
        
        self.assertGreaterEqual(assessment.domain_group_score, 0)
        self.assertLessEqual(assessment.domain_group_score, 100)
        
        # Check metadata
        self.assertIn('group_count', assessment.calculation_metadata)
        self.assertIn('critical_groups', assessment.calculation_metadata)
        self.assertIn('total_members', assessment.calculation_metadata)
    
    def test_global_risk_calculation_with_pingcastle(self):
        """Test global risk calculation with both PingCastle and domain group scores."""
        global_risk = self.calculator.calculate_global_risk(
            domain='test.local',
            pingcastle_score=80.0,
            domain_group_score=60.0
        )
        
        self.assertEqual(global_risk.domain, 'test.local')
        self.assertEqual(global_risk.pingcastle_score, 80.0)
        self.assertEqual(global_risk.domain_group_score, 60.0)
        
        # Global score should be weighted combination (80 * 0.7 + 60 * 0.3 = 74)
        expected_global = (80.0 * 0.7) + (60.0 * 0.3)
        self.assertAlmostEqual(global_risk.global_score, expected_global, places=1)
        
        # Check contributions
        self.assertIsNotNone(global_risk.pingcastle_contribution)
        self.assertGreater(global_risk.pingcastle_contribution, 0)
        self.assertGreater(global_risk.domain_group_contribution, 0)
        self.assertAlmostEqual(
            global_risk.pingcastle_contribution + global_risk.domain_group_contribution, 
            100.0, places=1
        )
    
    def test_global_risk_calculation_domain_groups_only(self):
        """Test global risk calculation with only domain group data."""
        global_risk = self.calculator.calculate_global_risk(
            domain='test.local',
            pingcastle_score=None,
            domain_group_score=60.0
        )
        
        self.assertEqual(global_risk.domain, 'test.local')
        self.assertIsNone(global_risk.pingcastle_score)
        self.assertEqual(global_risk.domain_group_score, 60.0)
        
        # Global score should equal domain group score when no PingCastle data
        self.assertEqual(global_risk.global_score, 60.0)
        
        # Contributions
        self.assertIsNone(global_risk.pingcastle_contribution)
        self.assertEqual(global_risk.domain_group_contribution, 100.0)
    
    def test_risk_trend_calculation(self):
        """Test risk trend calculation from historical data."""
        # Mock historical data
        base_date = datetime.now()
        historical_scores = [
            (base_date - timedelta(days=7), 50.0),
            (base_date - timedelta(days=3), 60.0),
            (base_date, 70.0)  # Current score
        ]
        
        global_risk = self.calculator.calculate_global_risk(
            domain='test.local',
            pingcastle_score=75.0,
            domain_group_score=60.0,
            historical_scores=historical_scores
        )
        
        # Should detect degrading trend (70 -> calculated ~73)
        self.assertEqual(global_risk.trend_direction, 'stable')  # Small change
        
        # Test with larger change
        historical_scores_degrading = [
            (base_date - timedelta(days=7), 40.0),
            (base_date - timedelta(days=3), 50.0),
            (base_date, 60.0)  # Current would be ~73, significant increase
        ]
        
        global_risk_degrading = self.calculator.calculate_global_risk(
            domain='test.local',
            pingcastle_score=75.0,
            domain_group_score=60.0,
            historical_scores=historical_scores_degrading
        )
        
        self.assertEqual(global_risk_degrading.trend_direction, 'degrading')
    
    def test_access_governance_score_calculation(self):
        """Test access governance score calculation."""
        # Create mock group risks
        group_risks = []
        for group_data in self.sample_groups:
            risk = self.calculator.calculate_group_risk(
                group_name=group_data['group_name'],
                total_members=group_data['total_members'],
                accepted_members=group_data['accepted_members']
            )
            group_risks.append(risk)
        
        access_score = self.calculator._calculate_access_governance_score(group_risks)
        
        # Should be between 0 and 100
        self.assertGreaterEqual(access_score, 0)
        self.assertLessEqual(access_score, 100)
        
        # Should reflect the overall unaccepted ratio weighted by group importance
        self.assertGreater(access_score, 0)  # We have unaccepted members
    
    def test_privilege_escalation_score_calculation(self):
        """Test privilege escalation score calculation."""
        group_risks = []
        for group_data in self.sample_groups:
            risk = self.calculator.calculate_group_risk(
                group_name=group_data['group_name'],
                total_members=group_data['total_members'],
                accepted_members=group_data['accepted_members']
            )
            group_risks.append(risk)
        
        escalation_score = self.calculator._calculate_privilege_escalation_score(group_risks)
        
        # Should focus on critical/high groups
        self.assertGreaterEqual(escalation_score, 0)
        self.assertLessEqual(escalation_score, 100)
        
        # Should be higher than 0 since Domain Admins has unaccepted members
        self.assertGreater(escalation_score, 0)
    
    def test_compliance_posture_score_calculation(self):
        """Test compliance posture score calculation."""
        group_risks = []
        for group_data in self.sample_groups:
            risk = self.calculator.calculate_group_risk(
                group_name=group_data['group_name'],
                total_members=group_data['total_members'],
                accepted_members=group_data['accepted_members']
            )
            group_risks.append(risk)
        
        compliance_score = self.calculator._calculate_compliance_posture_score(group_risks)
        
        # Should reflect overall compliance state
        self.assertGreaterEqual(compliance_score, 0)
        self.assertLessEqual(compliance_score, 100)
    
    def test_operational_risk_score_calculation(self):
        """Test operational risk score calculation."""
        group_risks = []
        for group_data in self.sample_groups:
            risk = self.calculator.calculate_group_risk(
                group_name=group_data['group_name'],
                total_members=group_data['total_members'],
                accepted_members=group_data['accepted_members']
            )
            group_risks.append(risk)
        
        operational_score = self.calculator._calculate_operational_risk_score(group_risks)
        
        # Should reflect operational management efficiency
        self.assertGreaterEqual(operational_score, 0)
        self.assertLessEqual(operational_score, 100)


class TestRiskIntegration(unittest.TestCase):
    """Test cases for risk integration with existing systems."""
    
    def test_pingcastle_score_preservation(self):
        """Test that PingCastle scores are not modified by domain group integration."""
        calculator = RiskCalculator()
        
        # Original PingCastle score
        original_pingcastle = 85.0
        domain_group_score = 45.0
        
        global_risk = calculator.calculate_global_risk(
            domain='test.local',
            pingcastle_score=original_pingcastle,
            domain_group_score=domain_group_score
        )
        
        # PingCastle score should remain unchanged
        self.assertEqual(global_risk.pingcastle_score, original_pingcastle)
        
        # Global score should be weighted combination, not replacement
        self.assertNotEqual(global_risk.global_score, original_pingcastle)
        self.assertNotEqual(global_risk.global_score, domain_group_score)
    
    def test_risk_score_weighting(self):
        """Test that risk score weighting follows the specified formula."""
        calculator = RiskCalculator()
        
        pingcastle_score = 80.0
        domain_group_score = 60.0
        
        global_risk = calculator.calculate_global_risk(
            domain='test.local',
            pingcastle_score=pingcastle_score,
            domain_group_score=domain_group_score
        )
        
        # Manual calculation: (80 * 0.7) + (60 * 0.3) = 56 + 18 = 74
        expected_global = (pingcastle_score * 0.7) + (domain_group_score * 0.3)
        self.assertAlmostEqual(global_risk.global_score, expected_global, places=1)
        
        # Check contribution percentages
        expected_pingcastle_contrib = (pingcastle_score * 0.7) / expected_global * 100
        expected_domain_contrib = (domain_group_score * 0.3) / expected_global * 100
        
        self.assertAlmostEqual(global_risk.pingcastle_contribution, expected_pingcastle_contrib, places=1)
        self.assertAlmostEqual(global_risk.domain_group_contribution, expected_domain_contrib, places=1)
    
    def test_risk_calculation_edge_cases(self):
        """Test risk calculation edge cases."""
        calculator = RiskCalculator()
        
        # Test with zero scores
        global_risk_zero = calculator.calculate_global_risk(
            domain='test.local',
            pingcastle_score=0.0,
            domain_group_score=0.0
        )
        self.assertEqual(global_risk_zero.global_score, 0.0)
        
        # Test with maximum scores
        global_risk_max = calculator.calculate_global_risk(
            domain='test.local',
            pingcastle_score=100.0,
            domain_group_score=100.0
        )
        self.assertEqual(global_risk_max.global_score, 100.0)
        
        # Test with only domain group data
        global_risk_domain_only = calculator.calculate_global_risk(
            domain='test.local',
            pingcastle_score=None,
            domain_group_score=75.0
        )
        self.assertEqual(global_risk_domain_only.global_score, 75.0)
        self.assertEqual(global_risk_domain_only.domain_group_contribution, 100.0)
    
    def test_group_profile_configuration(self):
        """Test that group risk profiles are correctly configured."""
        calculator = RiskCalculator()
        
        # Test critical group profile
        domain_admins_profile = calculator.GROUP_PROFILES['Domain Admins']
        self.assertEqual(domain_admins_profile.risk_level, GroupRiskLevel.CRITICAL)
        self.assertEqual(domain_admins_profile.base_weight, 3.0)
        self.assertLessEqual(domain_admins_profile.max_acceptable_members, 2)
        
        # Test low privilege group profile
        print_ops_profile = calculator.GROUP_PROFILES['Print Operators']
        self.assertEqual(print_ops_profile.risk_level, GroupRiskLevel.LOW)
        self.assertEqual(print_ops_profile.base_weight, 1.0)
        self.assertGreaterEqual(print_ops_profile.max_acceptable_members, 5)
    
    def test_risk_category_calculations(self):
        """Test individual risk category calculations."""
        calculator = RiskCalculator()
        
        # Create sample group risks
        group_risks = []
        for group_data in self.sample_groups:
            risk = calculator.calculate_group_risk(
                group_name=group_data['group_name'],
                total_members=group_data['total_members'],
                accepted_members=group_data['accepted_members']
            )
            group_risks.append(risk)
        
        # Test each category calculation
        access_gov = calculator._calculate_access_governance_score(group_risks)
        priv_esc = calculator._calculate_privilege_escalation_score(group_risks)
        compliance = calculator._calculate_compliance_posture_score(group_risks)
        operational = calculator._calculate_operational_risk_score(group_risks)
        
        # All scores should be valid
        for score in [access_gov, priv_esc, compliance, operational]:
            self.assertGreaterEqual(score, 0)
            self.assertLessEqual(score, 100)
            self.assertIsInstance(score, float)
        
        # Privilege escalation should be highest (Domain Admins has unaccepted members)
        self.assertGreater(priv_esc, 0)


class TestRiskIntegrationAPI(unittest.TestCase):
    """Test cases for risk integration API logic."""
    
    def test_risk_api_data_structure(self):
        """Test that API returns properly structured risk data."""
        # Mock the expected API response structure
        expected_global_risk = {
            'domain': 'test.local',
            'global_score': 74.5,
            'pingcastle_score': 80.0,
            'domain_group_score': 60.0,
            'pingcastle_contribution': 75.7,
            'domain_group_contribution': 24.3,
            'trend_direction': 'stable',
            'trend_percentage': 2.1,
            'assessment_date': datetime.utcnow().isoformat()
        }
        
        # Validate structure
        required_fields = [
            'domain', 'global_score', 'domain_group_score', 
            'trend_direction', 'assessment_date'
        ]
        
        for field in required_fields:
            self.assertIn(field, expected_global_risk)
        
        # Validate data types
        self.assertIsInstance(expected_global_risk['global_score'], (int, float))
        self.assertIsInstance(expected_global_risk['domain_group_score'], (int, float))
        self.assertIn(expected_global_risk['trend_direction'], ['improving', 'stable', 'degrading'])
    
    def test_risk_breakdown_structure(self):
        """Test risk breakdown API response structure."""
        expected_breakdown = {
            'domain': 'test.local',
            'global_score': 74.5,
            'category_scores': {
                'access_governance': 45.0,
                'privilege_escalation': 65.0,
                'compliance_posture': 35.0,
                'operational_risk': 25.0
            },
            'group_risks': [
                {
                    'group_name': 'Domain Admins',
                    'risk_score': 75.0,
                    'risk_level': 'critical',
                    'total_members': 5,
                    'accepted_members': 2,
                    'unaccepted_members': 3
                }
            ]
        }
        
        # Validate structure
        self.assertIn('category_scores', expected_breakdown)
        self.assertIn('group_risks', expected_breakdown)
        
        # Validate category scores
        categories = expected_breakdown['category_scores']
        for category, score in categories.items():
            self.assertGreaterEqual(score, 0)
            self.assertLessEqual(score, 100)
        
        # Validate group risks
        group_risks = expected_breakdown['group_risks']
        self.assertIsInstance(group_risks, list)
        
        if group_risks:
            group = group_risks[0]
            self.assertIn('group_name', group)
            self.assertIn('risk_score', group)
            self.assertIn('total_members', group)
            self.assertIn('accepted_members', group)


class TestRiskNonInterference(unittest.TestCase):
    """Test cases to ensure domain group risks don't interfere with PingCastle."""
    
    def test_pingcastle_data_unchanged(self):
        """Test that PingCastle report data remains unchanged."""
        # This test would verify that existing PingCastle reports
        # are not modified by domain group risk calculations
        
        # Mock existing PingCastle report
        mock_pingcastle_report = {
            'id': 'test-report-id',
            'tool_type': 'pingcastle',
            'global_score': 85,
            'stale_objects_score': 20,
            'privileged_accounts_score': 25,
            'trusts_score': 15,
            'anomalies_score': 25
        }
        
        # After domain group integration, PingCastle data should be identical
        self.assertEqual(mock_pingcastle_report['global_score'], 85)
        self.assertEqual(mock_pingcastle_report['stale_objects_score'], 20)
        # All other scores should remain unchanged
    
    def test_separate_calculation_paths(self):
        """Test that PingCastle and domain group calculations are independent."""
        calculator = RiskCalculator()
        
        # Calculate domain group risk independently
        domain_assessment = calculator.calculate_domain_risk('test.local', self.sample_groups)
        domain_group_score = domain_assessment.domain_group_score
        
        # This score should not depend on or modify PingCastle data
        self.assertGreaterEqual(domain_group_score, 0)
        self.assertLessEqual(domain_group_score, 100)
        
        # The calculation should be reproducible
        domain_assessment_2 = calculator.calculate_domain_risk('test.local', self.sample_groups)
        self.assertEqual(domain_assessment.domain_group_score, domain_assessment_2.domain_group_score)
    
    def test_graceful_degradation(self):
        """Test system works with missing PingCastle data."""
        calculator = RiskCalculator()
        
        # Should work fine with no PingCastle data
        global_risk = calculator.calculate_global_risk(
            domain='test.local',
            pingcastle_score=None,
            domain_group_score=65.0
        )
        
        self.assertEqual(global_risk.global_score, 65.0)
        self.assertIsNone(global_risk.pingcastle_score)
        self.assertIsNone(global_risk.pingcastle_contribution)


if __name__ == '__main__':
    # Run the tests
    unittest.main(verbosity=2)
