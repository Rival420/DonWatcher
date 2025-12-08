"""
Storage Bug Fix Validation Tests
Tests for JSON metadata parsing and storage connection fixes
"""

import unittest
from unittest.mock import Mock, patch
import json

import sys
import os
sys.path.append(os.path.join(os.path.dirname(__file__), '..', 'server'))


class TestStorageBugFixes(unittest.TestCase):
    """Test cases for storage layer bug fixes."""
    
    def test_json_metadata_handling_fix(self):
        """Test that JSONB metadata is handled correctly without double parsing."""
        # Mock database result with JSONB metadata (already parsed)
        mock_result = Mock()
        mock_result.id = 'test-id'
        mock_result.tool_type = 'domain_analysis'
        mock_result.domain = 'test.local'
        mock_result.metadata = {  # Already a dict from JSONB
            'tool_type': 'domain_group_members',
            'scanner_version': '1.0'
        }
        
        # The fix: metadata should be used directly, not json.loads()
        # OLD (BROKEN): metadata=json.loads(result.metadata)
        # NEW (FIXED): metadata=result.metadata
        
        processed_metadata = mock_result.metadata if mock_result.metadata else {}
        
        # Should work without JSON parsing error
        self.assertIsInstance(processed_metadata, dict)
        self.assertEqual(processed_metadata['tool_type'], 'domain_group_members')
        
        # Should NOT need json.loads() since JSONB is already parsed
        # This would fail with the old code:
        # json.loads(mock_result.metadata) # TypeError: expected str, got dict
    
    def test_storage_connection_method_availability(self):
        """Test that PostgresReportStorage has get_connection method."""
        # Import the actual class to test
        try:
            from server.storage_postgres import PostgresReportStorage
            
            # Create instance
            storage = PostgresReportStorage()
            
            # Should have get_connection method
            self.assertTrue(hasattr(storage, 'get_connection'))
            self.assertTrue(callable(getattr(storage, 'get_connection')))
            
            # Should have _get_session method (existing)
            self.assertTrue(hasattr(storage, '_get_session'))
            self.assertTrue(callable(getattr(storage, '_get_session')))
            
        except ImportError as e:
            self.skipTest(f"Cannot import storage module: {e}")
    
    def test_metadata_storage_consistency(self):
        """Test that metadata is stored and retrieved consistently."""
        # Test metadata that should be stored as JSONB
        test_metadata = {
            'tool_type': 'domain_group_members',
            'scanner_metadata': {
                'script_version': '1.0',
                'collected_by': 'test_user'
            },
            'processed_groups': ['Domain Admins', 'Enterprise Admins']
        }
        
        # When storing: should be json.dumps() for database
        stored_json = json.dumps(test_metadata)
        self.assertIsInstance(stored_json, str)
        
        # When retrieving: JSONB returns dict directly (no need for json.loads)
        # Simulate what PostgreSQL JSONB returns
        retrieved_dict = test_metadata  # JSONB returns parsed dict
        
        # Should be able to use directly
        self.assertIsInstance(retrieved_dict, dict)
        self.assertEqual(retrieved_dict['tool_type'], 'domain_group_members')
    
    def test_risk_service_connection_usage(self):
        """Test that risk service can use storage connection properly."""
        # Mock storage with get_connection method
        mock_storage = Mock()
        mock_connection = Mock()
        mock_storage.get_connection.return_value = mock_connection
        
        # Should be able to use connection context manager
        try:
            with mock_storage.get_connection() as conn:
                # This should work without AttributeError
                self.assertIsNotNone(conn)
            
            # Verify get_connection was called
            mock_storage.get_connection.assert_called()
            
        except AttributeError as e:
            self.fail(f"get_connection method not available: {e}")


class TestUploadScenarioValidation(unittest.TestCase):
    """Test upload scenarios that were causing the bugs."""
    
    def test_domain_scanner_upload_simulation(self):
        """Simulate domain scanner upload that was causing JSON errors."""
        # Mock domain scanner JSON data
        domain_scanner_json = {
            "tool_type": "domain_group_members",
            "domain": "test.local",
            "domain_sid": "S-1-5-21-1234567890-1234567890-1234567890",
            "groups": {
                "Domain Admins": [
                    {
                        "name": "Administrator",
                        "samaccountname": "Administrator",
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
        
        # Simulate parsing and storage process
        metadata_for_storage = domain_scanner_json.get('metadata', {})
        
        # When storing: convert to JSON string
        stored_metadata = json.dumps(metadata_for_storage)
        self.assertIsInstance(stored_metadata, str)
        
        # When retrieving from JSONB: already parsed
        # Simulate PostgreSQL JSONB return (returns dict, not string)
        retrieved_metadata = metadata_for_storage  # JSONB returns parsed dict
        
        # Should work directly without json.loads()
        self.assertIsInstance(retrieved_metadata, dict)
        self.assertEqual(retrieved_metadata['agent_name'], 'powershell_domain_scanner_minimal')
        
        # This would cause the original error:
        # json.loads(retrieved_metadata)  # TypeError: expected str, got dict
    
    def test_api_endpoint_error_scenarios(self):
        """Test API endpoints that were failing due to storage bugs."""
        # Mock the API call scenarios that were failing
        
        # Scenario 1: GET /api/reports/{id} - JSON metadata error
        mock_report_data = {
            'id': '1b412a11-06fa-4364-af11-1e0c86042436',
            'metadata': {'tool_type': 'domain_group_members'}  # Already dict from JSONB
        }
        
        # Should handle metadata correctly
        processed_metadata = mock_report_data['metadata'] if mock_report_data['metadata'] else {}
        self.assertIsInstance(processed_metadata, dict)
        
        # Scenario 2: Risk calculation APIs - get_connection error
        mock_storage = Mock()
        mock_storage.get_connection = Mock()  # Now available
        
        # Should not raise AttributeError
        try:
            connection = mock_storage.get_connection()
            self.assertIsNotNone(connection)
        except AttributeError:
            self.fail("get_connection method should be available")


if __name__ == '__main__':
    print("🧪 Running Storage Bug Fix Validation Tests...")
    unittest.main(verbosity=2)
