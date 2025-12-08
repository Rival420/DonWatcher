# Tests

This directory contains all unit tests and test data for the DonWatcher project.

## Structure

```
tests/
├── README.md                           # This file
├── test_domain_group_parser.py         # Unit tests for domain group parser
└── test_domain_group_members.json      # Sample test data for domain group members
```

## Running Tests

### Prerequisites
```bash
pip install -r requirements.txt
```

### Run All Tests
```bash
python -m pytest tests/ -v
```

### Run Specific Test
```bash
python -m pytest tests/test_domain_group_parser.py -v
```

### Run with Coverage
```bash
python -m pytest tests/ --cov=server --cov-report=html
```

## Test Data

### test_domain_group_members.json
Sample JSON data in the new `domain_group_members` format produced by the PowerShell scanner. This file demonstrates:

- Complete group membership data structure
- Enhanced member information (name, samaccountname, sid, type, enabled)
- Multiple group types (Domain Admins, Enterprise Admins, etc.)
- Mixed member types (users, computers)
- Metadata from the scanner

## Writing New Tests

When adding new tests:

1. Follow the naming convention: `test_*.py`
2. Use descriptive test method names: `test_functionality_description`
3. Include both positive and negative test cases
4. Test edge cases and error conditions
5. Use mock objects for external dependencies

## Test Categories

### Parser Tests
- Format detection and validation
- Data transformation accuracy
- Backward compatibility
- Error handling

### API Tests
- Endpoint functionality
- Request/response validation
- Authentication and authorization
- Error responses

### Integration Tests
- End-to-end workflow validation
- Database integration
- File upload processing
- Cross-component interaction
