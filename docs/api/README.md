# API Documentation

This directory contains comprehensive API documentation for the DonWatcher platform.

## Overview

DonWatcher provides RESTful APIs for managing security reports, group memberships, and risk assessments across multiple security tools.

## Base URL
```
http://localhost:8080/api
```

## Authentication
Currently using session-based authentication. Future versions will support API keys and OAuth2.

## API Endpoints

### Core Reports API
- `GET /api/reports` - List all security reports
- `GET /api/reports/{id}` - Get specific report details
- `POST /upload` - Upload new security report
- `POST /upload/multiple` - Upload multiple reports

### Domain Group Management API (Phase 1)
- `GET /api/domain_groups/{domain}` - Get groups with acceptance status
- `GET /api/domain_groups/{domain}/{group_name}/members` - Get detailed member list
- `POST /api/domain_groups/members/accept` - Accept group member
- `DELETE /api/domain_groups/members/accept` - Remove member acceptance
- `GET /api/domain_groups/unaccepted` - Get all unaccepted members

### Risk Management API
- `GET /api/accepted_risks` - List accepted risks
- `POST /api/accepted_risks` - Accept a risk
- `DELETE /api/accepted_risks` - Remove risk acceptance

### Group Configuration API
- `GET /api/monitored_groups` - List monitored groups
- `POST /api/monitored_groups` - Add monitored group
- `GET /api/group_risk_configs` - Get group risk configurations
- `POST /api/group_risk_configs` - Update group risk configuration

### Analysis API
- `GET /analysis/scores` - Historical score data for charts
- `GET /analysis/frequency` - Recurring findings analysis

### System API
- `GET /api/debug/status` - System health and status

## Response Formats

All API responses use JSON format with consistent structure:

### Success Response
```json
{
  "status": "success",
  "data": { ... },
  "message": "Operation completed successfully"
}
```

### Error Response
```json
{
  "status": "error", 
  "error": "Error description",
  "code": "ERROR_CODE"
}
```

## Data Models

### Security Tool Types
- `pingcastle` - PingCastle AD assessment reports
- `locksmith` - Locksmith certificate analysis
- `domain_analysis` - Legacy domain analysis format
- `domain_group_members` - New domain group scanner format
- `custom` - Custom security tools

### Finding Status
- `new` - Newly discovered finding
- `accepted` - Risk accepted by organization
- `resolved` - Finding has been resolved
- `false_positive` - Finding marked as false positive

### Member Types
- `user` - Domain user account
- `computer` - Computer account
- `group` - Security group

## Rate Limiting
- 1000 requests per hour per IP
- 100 upload requests per hour per IP
- Bulk operations limited to 500 items per request

## Error Codes

| Code | Description |
|------|-------------|
| 400 | Bad Request - Invalid request format |
| 401 | Unauthorized - Authentication required |
| 403 | Forbidden - Insufficient permissions |
| 404 | Not Found - Resource not found |
| 413 | Payload Too Large - File size exceeds limit |
| 429 | Too Many Requests - Rate limit exceeded |
| 500 | Internal Server Error - Server error |

## Examples

See individual endpoint documentation files for detailed examples and request/response formats.

## SDK and Client Libraries

Currently supported:
- Python SDK (planned)
- PowerShell Module (in development)
- JavaScript/TypeScript SDK (planned)

## Changelog

### Phase 1 (Current)
- Added domain group management endpoints
- Enhanced member data with type and status
- Acceptance workflow API
- Risk calculation based on unaccepted members

### Previous Versions
- Core report management API
- PingCastle integration
- Risk acceptance workflow
- Multi-tool support
