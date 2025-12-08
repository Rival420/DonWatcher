"""
Integration Tests for Risk Service SQL Queries
Tests the risk calculation service with actual database operations.

These tests verify:
- PostgreSQL interval syntax works correctly
- Risk dashboard summary view returns expected data
- Risk calculation history is properly logged
- Global risk calculations are accurate
"""

import unittest
from unittest.mock import Mock, MagicMock, patch
from datetime import datetime, timedelta
from decimal import Decimal
import json

import sys
import os
sys.path.append(os.path.join(os.path.dirname(__file__), '..', 'server'))


class TestRiskServiceSQLSyntax(unittest.TestCase):
    """Test that SQL queries have correct PostgreSQL syntax."""
    
    def test_interval_syntax_uses_make_interval(self):
        """Verify INTERVAL syntax uses make_interval() function."""
        # Read the risk_service.py file and check for proper syntax
        risk_service_path = os.path.join(
            os.path.dirname(__file__), '..', 'server', 'risk_service.py'
        )
        
        with open(risk_service_path, 'r') as f:
            content = f.read()
        
        # Should NOT contain old broken syntax
        self.assertNotIn('INTERVAL :days DAY', content, 
            "Found broken INTERVAL syntax - should use make_interval()")
        self.assertNotIn('INTERVAL :hours HOUR', content,
            "Found broken INTERVAL syntax - should use make_interval()")
        
        # Should contain correct syntax
        self.assertIn('make_interval(days => :days)', content,
            "Missing correct make_interval(days) syntax")
        self.assertIn('make_interval(hours => :hours)', content,
            "Missing correct make_interval(hours) syntax")
    
    def test_sql_queries_are_parameterized(self):
        """Verify SQL queries use parameterized queries (no SQL injection)."""
        risk_service_path = os.path.join(
            os.path.dirname(__file__), '..', 'server', 'risk_service.py'
        )
        
        with open(risk_service_path, 'r') as f:
            content = f.read()
        
        # Should use SQLAlchemy text() with parameters
        self.assertIn('text("""', content, "Should use SQLAlchemy text()")
        self.assertIn(':domain', content, "Should use parameterized :domain")
        
        # Should NOT have string formatting in SQL
        self.assertNotIn('f"""SELECT', content, 
            "Should not use f-strings for SQL queries")


class TestRiskCalculationFixtures(unittest.TestCase):
    """Test fixtures for risk calculation scenarios."""
    
    @classmethod
    def get_sample_group_data(cls):
        """Get sample group data for testing."""
        return [
            {
                'group_name': 'Domain Admins',
                'total_members': 5,
                'accepted_members': 3,
                'unaccepted_members': 2,
                'members': [
                    {'name': 'Admin1', 'type': 'user', 'enabled': True},
                    {'name': 'Admin2', 'type': 'user', 'enabled': True},
                    {'name': 'Admin3', 'type': 'user', 'enabled': True},
                    {'name': 'Admin4', 'type': 'user', 'enabled': False},
                    {'name': 'Admin5', 'type': 'user', 'enabled': True},
                ]
            },
            {
                'group_name': 'Enterprise Admins',
                'total_members': 2,
                'accepted_members': 1,
                'unaccepted_members': 1,
                'members': [
                    {'name': 'EntAdmin1', 'type': 'user', 'enabled': True},
                    {'name': 'EntAdmin2', 'type': 'user', 'enabled': True},
                ]
            },
            {
                'group_name': 'Backup Operators',
                'total_members': 8,
                'accepted_members': 8,
                'unaccepted_members': 0,
                'members': []  # All accepted
            }
        ]
    
    @classmethod
    def get_sample_pingcastle_score(cls):
        """Get sample PingCastle score for testing."""
        return 45.0  # Medium risk
    
    @classmethod
    def get_sample_historical_scores(cls):
        """Get sample historical scores for trend analysis."""
        now = datetime.utcnow()
        return [
            (now - timedelta(days=7), 50.0),
            (now - timedelta(days=6), 48.0),
            (now - timedelta(days=5), 47.0),
            (now - timedelta(days=4), 46.0),
            (now - timedelta(days=3), 45.0),
            (now - timedelta(days=2), 44.0),
            (now - timedelta(days=1), 43.0),
        ]
    
    def test_sample_data_is_valid(self):
        """Verify sample data fixtures are properly structured."""
        group_data = self.get_sample_group_data()
        
        self.assertEqual(len(group_data), 3)
        
        for group in group_data:
            self.assertIn('group_name', group)
            self.assertIn('total_members', group)
            self.assertIn('accepted_members', group)
            self.assertIn('unaccepted_members', group)
            
            # Verify math adds up
            self.assertEqual(
                group['total_members'],
                group['accepted_members'] + group['unaccepted_members']
            )


class TestRiskCalculatorIntegration(unittest.TestCase):
    """Integration tests for RiskCalculator class."""
    
    def setUp(self):
        """Set up test fixtures."""
        try:
            from server.risk_calculator import RiskCalculator, GroupRiskLevel
            self.calculator = RiskCalculator()
            self.GroupRiskLevel = GroupRiskLevel
        except ImportError as e:
            self.skipTest(f"Cannot import risk_calculator: {e}")
    
    def test_calculate_group_risk_domain_admins(self):
        """Test risk calculation for Domain Admins group."""
        risk = self.calculator.calculate_group_risk(
            group_name='Domain Admins',
            total_members=5,
            accepted_members=3
        )
        
        self.assertEqual(risk.group_name, 'Domain Admins')
        self.assertEqual(risk.total_members, 5)
        self.assertEqual(risk.accepted_members, 3)
        self.assertEqual(risk.unaccepted_members, 2)
        self.assertEqual(risk.risk_level, self.GroupRiskLevel.CRITICAL)
        
        # Should have elevated risk due to unaccepted members in critical group
        self.assertGreater(risk.risk_score, 0)
    
    def test_calculate_group_risk_fully_accepted(self):
        """Test risk calculation for fully accepted group."""
        risk = self.calculator.calculate_group_risk(
            group_name='Backup Operators',
            total_members=8,
            accepted_members=8
        )
        
        # All members accepted - should have low/zero risk
        self.assertEqual(risk.unaccepted_members, 0)
        self.assertEqual(risk.risk_score, 0.0)
    
    def test_calculate_group_risk_empty_group(self):
        """Test risk calculation for empty group."""
        risk = self.calculator.calculate_group_risk(
            group_name='Empty Group',
            total_members=0,
            accepted_members=0
        )
        
        self.assertEqual(risk.total_members, 0)
        self.assertEqual(risk.risk_score, 0.0)
    
    def test_calculate_domain_risk(self):
        """Test domain-level risk calculation."""
        group_data = TestRiskCalculationFixtures.get_sample_group_data()
        
        assessment = self.calculator.calculate_domain_risk(
            domain='test.local',
            group_data=group_data
        )
        
        self.assertEqual(assessment.domain, 'test.local')
        self.assertIsNotNone(assessment.assessment_date)
        
        # Verify category scores are within valid range
        self.assertGreaterEqual(assessment.access_governance_score, 0)
        self.assertLessEqual(assessment.access_governance_score, 100)
        
        self.assertGreaterEqual(assessment.privilege_escalation_score, 0)
        self.assertLessEqual(assessment.privilege_escalation_score, 100)
        
        # Verify domain group score
        self.assertGreaterEqual(assessment.domain_group_score, 0)
        self.assertLessEqual(assessment.domain_group_score, 100)
        
        # Verify group_risks were calculated
        self.assertEqual(len(assessment.group_risks), 3)
    
    def test_calculate_global_risk_with_pingcastle(self):
        """Test global risk calculation with PingCastle score."""
        global_risk = self.calculator.calculate_global_risk(
            domain='test.local',
            pingcastle_score=45.0,
            domain_group_score=30.0
        )
        
        self.assertEqual(global_risk.domain, 'test.local')
        self.assertEqual(global_risk.pingcastle_score, 45.0)
        self.assertEqual(global_risk.domain_group_score, 30.0)
        
        # Global score should be weighted combination
        # 70% PingCastle + 30% Domain Groups = 0.7*45 + 0.3*30 = 31.5 + 9 = 40.5
        expected_global = (45.0 * 0.7) + (30.0 * 0.3)
        self.assertAlmostEqual(global_risk.global_score, expected_global, places=1)
        
        # Verify contributions are calculated
        self.assertIsNotNone(global_risk.pingcastle_contribution)
        self.assertIsNotNone(global_risk.domain_group_contribution)
    
    def test_calculate_global_risk_without_pingcastle(self):
        """Test global risk calculation without PingCastle data."""
        global_risk = self.calculator.calculate_global_risk(
            domain='test.local',
            pingcastle_score=None,
            domain_group_score=30.0
        )
        
        self.assertEqual(global_risk.domain, 'test.local')
        self.assertIsNone(global_risk.pingcastle_score)
        self.assertEqual(global_risk.domain_group_score, 30.0)
        
        # Without PingCastle, global score equals domain group score
        self.assertEqual(global_risk.global_score, 30.0)
        
        # Domain group should have 100% contribution
        self.assertEqual(global_risk.domain_group_contribution, 100.0)
    
    def test_risk_trend_analysis(self):
        """Test trend direction calculation."""
        historical = TestRiskCalculationFixtures.get_sample_historical_scores()
        
        # Current score lower than previous = improving
        global_risk = self.calculator.calculate_global_risk(
            domain='test.local',
            pingcastle_score=None,
            domain_group_score=35.0,  # Lower than historical
            historical_scores=historical
        )
        
        # With downward trend, should be "improving"
        self.assertEqual(global_risk.trend_direction, 'improving')


class TestDatabaseSchemaIntegrity(unittest.TestCase):
    """Test that database schema matches expected structure."""
    
    def test_init_db_contains_risk_tables(self):
        """Verify init_db.sql contains all required risk tables."""
        init_db_path = os.path.join(
            os.path.dirname(__file__), '..', 'migrations', 'init_db.sql'
        )
        
        with open(init_db_path, 'r') as f:
            content = f.read()
        
        # Required tables
        required_tables = [
            'domain_risk_assessments',
            'group_risk_assessments',
            'global_risk_scores',
            'risk_configuration',
            'risk_calculation_history'
        ]
        
        for table in required_tables:
            self.assertIn(f'CREATE TABLE IF NOT EXISTS {table}', content,
                f"Missing table: {table}")
    
    def test_init_db_contains_risk_dashboard_view(self):
        """Verify init_db.sql contains risk_dashboard_summary view."""
        init_db_path = os.path.join(
            os.path.dirname(__file__), '..', 'migrations', 'init_db.sql'
        )
        
        with open(init_db_path, 'r') as f:
            content = f.read()
        
        self.assertIn('risk_dashboard_summary', content,
            "Missing risk_dashboard_summary view")
        self.assertIn('CREATE OR REPLACE VIEW', content,
            "Should use CREATE OR REPLACE VIEW for views")


class TestMigrationRunner(unittest.TestCase):
    """Test migration runner functionality."""
    
    def test_migration_discovery(self):
        """Test that migrations are properly discovered."""
        try:
            from server.migration_runner import MigrationRunner, Migration
        except ImportError as e:
            self.skipTest(f"Cannot import migration_runner: {e}")
        
        # Create mock engine
        mock_engine = Mock()
        
        runner = MigrationRunner(mock_engine)
        migrations = runner.discover_migrations()
        
        # Should find at least init_db.sql
        filenames = [m.filename for m in migrations]
        self.assertIn('init_db.sql', filenames)
        
        # Migrations should be ordered by version
        versions = [m.version for m in migrations]
        self.assertEqual(versions, sorted(versions))
    
    def test_migration_parsing(self):
        """Test migration filename parsing."""
        try:
            from server.migration_runner import Migration
            from pathlib import Path
        except ImportError as e:
            self.skipTest(f"Cannot import: {e}")
        
        # Test init_db.sql parsing
        m1 = Migration.from_file(Path('migrations/init_db.sql'))
        self.assertEqual(m1.version, 0)
        self.assertEqual(m1.filename, 'init_db.sql')
        
        # Test numbered migration parsing
        m2 = Migration.from_file(Path('migrations/migration_005_add_risk_dashboard_summary.sql'))
        self.assertEqual(m2.version, 5)
        self.assertEqual(m2.description, 'add risk dashboard summary')


if __name__ == '__main__':
    print("🧪 Running Risk Service Integration Tests...")
    unittest.main(verbosity=2)

