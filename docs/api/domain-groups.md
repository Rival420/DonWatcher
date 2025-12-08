# Domain Groups API

The Domain Groups API provides endpoints for managing domain group memberships and the acceptance workflow introduced in Phase 1.

## Overview

This API allows you to:
- Retrieve group membership data from domain scanner reports
- View acceptance status of group members
- Accept or deny individual group members
- Get comprehensive views of unaccepted members across domains

## Endpoints

### Get Domain Groups

Retrieve all groups for a specific domain with member counts and acceptance status.

**Endpoint:** `GET /api/domain_groups/{domain}`

**Parameters:**
- `domain` (path) - Domain name (e.g., "corp.example.com")

**Response:**
```json
[
  {
    "group_name": "Domain Admins",
    "total_members": 3,
    "accepted_members": 1, 
    "unaccepted_members": 2,
    "risk_score": 40,
    "severity": "high",
    "last_updated": "2024-01-15T10:30:00.000Z"
  },
  {
    "group_name": "Enterprise Admins",
    "total_members": 1,
    "accepted_members": 1,
    "unaccepted_members": 0,
    "risk_score": 0,
    "severity": "low", 
    "last_updated": "2024-01-15T10:30:00.000Z"
  }
]
```

**Risk Score Calculation:**
- `0` - All members accepted
- `> 0` - Based on unaccepted members and group risk configuration
- Uses `group_risk_configs` table for base scores and thresholds

**Severity Levels:**
- `low` - Risk score 0-25
- `medium` - Risk score 26-50
- `high` - Risk score 51-100

---

### Get Group Members

Retrieve detailed member list for a specific group with acceptance status.

**Endpoint:** `GET /api/domain_groups/{domain}/{group_name}/members`

**Parameters:**
- `domain` (path) - Domain name
- `group_name` (path) - Group name (URL encoded)

**Response:**
```json
{
  "group_name": "Domain Admins",
  "domain": "corp.example.com",
  "total_members": 3,
  "accepted_members": 1,
  "members": [
    {
      "name": "Administrator",
      "samaccountname": "Administrator",
      "sid": "S-1-5-21-1234567890-1234567890-1234567890-500",
      "type": "user",
      "enabled": true,
      "is_accepted": true
    },
    {
      "name": "john.doe", 
      "samaccountname": "john.doe",
      "sid": "S-1-5-21-1234567890-1234567890-1234567890-1001",
      "type": "user",
      "enabled": true,
      "is_accepted": false
    },
    {
      "name": "service.account",
      "samaccountname": "service.account", 
      "sid": "S-1-5-21-1234567890-1234567890-1234567890-1002",
      "type": "user",
      "enabled": false,
      "is_accepted": false
    }
  ],
  "last_updated": "2024-01-15T10:30:00.000Z"
}
```

**Member Fields:**
- `name` - Display name from Active Directory
- `samaccountname` - SAM account name
- `sid` - Security identifier
- `type` - Member type: `user`, `computer`, or `group`
- `enabled` - Account enabled status (`true`, `false`, or `null` if unknown)
- `is_accepted` - Whether this member has been accepted by an administrator

---

### Accept Group Member

Accept a specific group member, marking them as authorized.

**Endpoint:** `POST /api/domain_groups/members/accept`

**Request Body:**
```json
{
  "domain": "corp.example.com",
  "group_name": "Domain Admins",
  "member_name": "john.doe",
  "member_sid": "S-1-5-21-1234567890-1234567890-1234567890-1001",
  "reason": "Authorized domain administrator",
  "accepted_by": "admin@corp.example.com",
  "expires_at": null
}
```

**Required Fields:**
- `domain` - Domain name
- `group_name` - Group name
- `member_name` - Member name to accept

**Optional Fields:**
- `member_sid` - Member SID for additional validation
- `reason` - Reason for acceptance (for audit trail)
- `accepted_by` - Who accepted this member
- `expires_at` - Expiration date for acceptance (ISO 8601 format)

**Response:**
```json
{
  "status": "ok",
  "member_id": "uuid-of-accepted-member"
}
```

---

### Remove Member Acceptance

Remove acceptance for a group member, returning them to unaccepted status.

**Endpoint:** `DELETE /api/domain_groups/members/accept`

**Request Body:**
```json
{
  "domain": "corp.example.com",
  "group_name": "Domain Admins", 
  "member_name": "john.doe"
}
```

**Required Fields:**
- `domain` - Domain name
- `group_name` - Group name
- `member_name` - Member name to remove acceptance

**Response:**
```json
{
  "status": "ok"
}
```

---

### Get Unaccepted Members

Retrieve all unaccepted members across all groups, optionally filtered by domain.

**Endpoint:** `GET /api/domain_groups/unaccepted`

**Query Parameters:**
- `domain` (optional) - Filter by specific domain

**Response:**
```json
{
  "total_unaccepted": 5,
  "members": [
    {
      "domain": "corp.example.com",
      "group_name": "Domain Admins",
      "member_name": "john.doe",
      "member_type": "user",
      "enabled": true,
      "last_seen": "2024-01-15T10:30:00.000Z"
    },
    {
      "domain": "corp.example.com", 
      "group_name": "Enterprise Admins",
      "member_name": "service.account",
      "member_type": "user",
      "enabled": false,
      "last_seen": "2024-01-15T10:30:00.000Z"
    }
  ]
}
```

**Use Cases:**
- Dashboard overview of all unaccepted members
- Compliance reporting
- Bulk acceptance workflows
- Risk assessment across domains

---

## Error Responses

### 404 Not Found
```json
{
  "detail": "No domain analysis reports found"
}
```

### 404 Group Not Found
```json
{
  "detail": "Group 'NonExistent Group' not found"
}
```

### 500 Internal Server Error
```json
{
  "detail": "Failed to get domain groups: Database connection error"
}
```

## Usage Examples

### PowerShell
```powershell
# Get domain groups
$groups = Invoke-RestMethod -Uri "http://localhost:8080/api/domain_groups/corp.example.com" -Method Get

# Accept a member
$acceptData = @{
    domain = "corp.example.com"
    group_name = "Domain Admins"
    member_name = "john.doe"
    reason = "Authorized administrator"
} | ConvertTo-Json

Invoke-RestMethod -Uri "http://localhost:8080/api/domain_groups/members/accept" -Method Post -Body $acceptData -ContentType "application/json"
```

### Python
```python
import requests

# Get group members
response = requests.get("http://localhost:8080/api/domain_groups/corp.example.com/Domain%20Admins/members")
members = response.json()

# Accept member
accept_data = {
    "domain": "corp.example.com",
    "group_name": "Domain Admins", 
    "member_name": "john.doe",
    "reason": "Authorized administrator"
}
response = requests.post("http://localhost:8080/api/domain_groups/members/accept", json=accept_data)
```

### JavaScript/Fetch
```javascript
// Get unaccepted members
fetch('/api/domain_groups/unaccepted?domain=corp.example.com')
  .then(response => response.json())
  .then(data => {
    console.log(`Total unaccepted: ${data.total_unaccepted}`);
    data.members.forEach(member => {
      console.log(`${member.group_name}: ${member.member_name}`);
    });
  });

// Accept member
fetch('/api/domain_groups/members/accept', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    domain: 'corp.example.com',
    group_name: 'Domain Admins',
    member_name: 'john.doe',
    reason: 'Authorized administrator'
  })
}).then(response => response.json());
```

## Data Sources

These endpoints consume data from:
- Domain scanner reports uploaded via `/upload` endpoint
- Reports with `tool_type: "domain_group_members"` or `tool_type: "domain_analysis"`
- Group membership data in report findings with category `"DonScanner"`

## Performance Considerations

- Results are cached using materialized views for improved performance
- Large domains (1000+ members) may have slower response times
- Use pagination for very large member lists (future enhancement)
- Bulk operations are more efficient than individual API calls

## Security Considerations

- All endpoints require authentication
- Member acceptance actions are logged for audit trails
- SID validation prevents cross-domain member confusion
- Rate limiting prevents abuse of acceptance endpoints
