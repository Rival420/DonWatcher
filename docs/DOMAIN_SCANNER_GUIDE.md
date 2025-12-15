# DonWatcher Domain Scanner Guide

## Overview

The DonWatcher Domain Scanner (`client/DonWatcher-DomainScanner.ps1`) is a PowerShell script that collects privileged Active Directory group memberships and uploads them directly to the DonWatcher API for monitoring and compliance tracking.

## Features

| Feature | Description |
|---------|-------------|
| **Direct API Upload** | Uses dedicated `/api/upload/domain-groups` endpoint - no file handling |
| **Focused Collection** | Scans only configured privileged groups |
| **Member Details** | Collects name, SAMAccountName, SID, type, and enabled status |
| **Domain SID Verification** | Optional enforcement to ensure correct domain targeting |
| **JSON Configuration** | Easy customization via config file |
| **Scheduled Task Ready** | Clean exit codes for automation (0=success, 1=failure) |
| **Minimal Footprint** | Only requires ActiveDirectory PowerShell module |

## Data Flow

```
┌─────────────────────┐    ┌────────────────────────┐    ┌─────────────────┐
│  PowerShell Script  │───▶│  POST /api/upload/     │───▶│  Upload Service │
│  Collects Groups    │    │  domain-groups (JSON)  │    │  (Direct DB)    │
└─────────────────────┘    └────────────────────────┘    └────────┬────────┘
                                                                  │
                                                                  ▼
┌─────────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│  Dashboard          │◀───│  /api/domain_    │◀───│  PostgreSQL     │
│  Privileged Groups  │    │  groups/{domain} │    │  Database       │
└─────────────────────┘    └──────────────────┘    └─────────────────┘
```

### Why Direct API?

The v3.0 scanner uses the dedicated JSON API instead of file uploads:
- **No encoding issues** - Direct JSON over HTTP, no UTF-8 BOM problems
- **No temp files** - Cleaner, faster, more reliable
- **Better validation** - Server validates schema upfront with clear errors
- **Explicit contract** - API knows exactly what to expect

## Prerequisites

1. **Windows PowerShell 5.1+** or **PowerShell Core 6+**
2. **Active Directory PowerShell module** (RSAT-AD-PowerShell)
3. **Domain-joined machine** with read access to AD
4. **Network connectivity** to DonWatcher server

### Installing RSAT-AD-PowerShell

```powershell
# Windows Server
Install-WindowsFeature RSAT-AD-PowerShell

# Windows 10/11
Add-WindowsCapability -Online -Name Rsat.ActiveDirectory.DS-LDS.Tools~~~~0.0.1.0
```

## Configuration

### Config File Location

The script looks for `DonWatcher-Config.json` in the same directory as the script. If not found, it creates a default config file.

### Configuration Options

```json
{
  "DonWatcherUrl": "http://donwatcher-server:8080",
  "PrivilegedGroups": [
    "Domain Admins",
    "Enterprise Admins",
    "Schema Admins",
    "Administrators",
    "Account Operators",
    "Backup Operators",
    "Server Operators",
    "Print Operators"
  ],
  "TimeoutSeconds": 120
}
```

| Option | Type | Description |
|--------|------|-------------|
| `DonWatcherUrl` | String | URL of your DonWatcher server |
| `PrivilegedGroups` | Array | List of AD groups to scan |
| `TimeoutSeconds` | Integer | HTTP timeout for uploads (default: 120) |
| `ExpectedDomainSID` | String | (Optional) Domain SID for verification |

### Domain SID Verification

To ensure the script only runs against the intended domain, add the expected domain SID to the config:

```json
{
  "DonWatcherUrl": "http://donwatcher:8080",
  "PrivilegedGroups": ["Domain Admins", "Enterprise Admins"],
  "TimeoutSeconds": 120,
  "ExpectedDomainSID": "S-1-5-21-1234567890-1234567890-1234567890"
}
```

**To find your domain SID:**
```powershell
(Get-ADDomain).DomainSID.Value
```

If the actual domain SID doesn't match the expected value, the script aborts with an error.

## Usage

### Basic Execution

```powershell
# Using config file (recommended)
.\DonWatcher-DomainScanner.ps1

# Override URL via parameter
.\DonWatcher-DomainScanner.ps1 -DonWatcherUrl "http://donwatcher:8080"

# Use custom config file
.\DonWatcher-DomainScanner.ps1 -ConfigFile "C:\Scripts\custom-config.json"

# Verbose output for debugging
.\DonWatcher-DomainScanner.ps1 -Verbose
```

### Test Connection Only

```powershell
.\DonWatcher-DomainScanner.ps1 -TestConnection
```

This validates connectivity to DonWatcher without performing a scan.

### Exit Codes

| Code | Meaning |
|------|---------|
| 0 | Success - scan completed and uploaded |
| 1 | Failure - prerequisites, connection, SID mismatch, or upload failed |

## Scheduled Task Setup

### PowerShell Method

```powershell
# Create the scheduled task
$Action = New-ScheduledTaskAction -Execute "PowerShell.exe" `
    -Argument "-ExecutionPolicy Bypass -NonInteractive -File C:\Scripts\DonWatcher-DomainScanner.ps1"

$Trigger = New-ScheduledTaskTrigger -Daily -At "02:00AM"

$Principal = New-ScheduledTaskPrincipal `
    -UserId "DOMAIN\ServiceAccount" `
    -LogonType Password `
    -RunLevel Highest

$Settings = New-ScheduledTaskSettingsSet `
    -ExecutionTimeLimit (New-TimeSpan -Hours 1) `
    -RestartCount 3 `
    -RestartInterval (New-TimeSpan -Minutes 5)

Register-ScheduledTask `
    -TaskName "DonWatcher Domain Scan" `
    -Action $Action `
    -Trigger $Trigger `
    -Principal $Principal `
    -Settings $Settings `
    -Description "Scans privileged AD groups and uploads to DonWatcher"
```

### Service Account Requirements

The service account running the scheduled task needs:
- **Read access** to Active Directory (member of Domain Users is sufficient)
- **Network access** to DonWatcher server on configured port
- **Log on as a batch job** right on the machine

## Output Format

The script generates JSON in the `domain_group_members` format:

```json
{
  "tool_type": "domain_group_members",
  "domain": "corp.example.com",
  "domain_sid": "S-1-5-21-1234567890-1234567890-1234567890",
  "report_date": "2024-12-15T02:00:00.000Z",
  "groups": {
    "Domain Admins": [
      {
        "name": "Administrator",
        "samaccountname": "Administrator",
        "sid": "S-1-5-21-1234567890-1234567890-1234567890-500",
        "type": "user",
        "enabled": true
      },
      {
        "name": "John Admin",
        "samaccountname": "john.admin",
        "sid": "S-1-5-21-1234567890-1234567890-1234567890-1001",
        "type": "user",
        "enabled": true
      }
    ],
    "Enterprise Admins": [
      {
        "name": "Administrator",
        "samaccountname": "Administrator",
        "sid": "S-1-5-21-1234567890-1234567890-1234567890-500",
        "type": "user",
        "enabled": true
      }
    ]
  },
  "metadata": {
    "agent_name": "donwatcher_domain_scanner",
    "collection_method": "powershell_ad",
    "script_version": "2.0",
    "collected_by": "CORP\\service.account",
    "machine_name": "CORP-MGMT01"
  }
}
```

### Member Types

| Type | Description |
|------|-------------|
| `user` | User account |
| `computer` | Computer account (e.g., domain controllers) |
| `group` | Nested group (resolved recursively) |

### Enabled Status

| Value | Meaning |
|-------|---------|
| `true` | Account is enabled |
| `false` | Account is disabled |
| `null` | Not applicable (e.g., groups) |

## GUI Representation

After the script uploads data, DonWatcher displays:

### Dashboard - Privileged Groups Section

Each scanned group appears as a tile showing:
- **Group name**
- **Total members** count
- **Unaccepted members** count (highlighted in red if > 0)
- **Risk score** badge (based on unaccepted member count)

### Member Management

Click "Manage Members" on any group tile to:
- View all members with their details
- Accept authorized members
- Deny/flag unauthorized members
- Bulk accept/deny operations

### Risk Calculation

Risk scores are calculated based on unaccepted members:
- All members accepted → Risk score: 0
- Unaccepted members → Risk increases based on group criticality

## Troubleshooting

### Common Issues

#### "Active Directory module not available"
```powershell
# Install the module
Install-WindowsFeature RSAT-AD-PowerShell  # Server
# or
Add-WindowsCapability -Online -Name Rsat.ActiveDirectory.DS-LDS.Tools~~~~0.0.1.0  # Windows 10/11
```

#### "This machine is not domain-joined"
The script must run on a domain-joined machine. Verify with:
```powershell
(Get-WmiObject Win32_ComputerSystem).Domain
```

#### "Cannot connect to DonWatcher"
1. Verify the URL is correct in config
2. Check firewall rules allow outbound HTTP/HTTPS
3. Test with: `Invoke-RestMethod -Uri "http://donwatcher:8080/api/debug/status"`

#### "Domain SID mismatch"
1. Verify `ExpectedDomainSID` in config matches your domain
2. Get actual SID: `(Get-ADDomain).DomainSID.Value`
3. Update config or remove the check if not needed

#### "Upload failed"
1. Check DonWatcher backend logs: `docker compose logs backend`
2. Verify JSON format is valid
3. Check for network issues or timeouts

### Verbose Mode

For detailed debugging output:
```powershell
.\DonWatcher-DomainScanner.ps1 -Verbose
```

### Manual Testing

Test the upload endpoint manually:
```powershell
$testData = @{
    tool_type = "domain_group_members"
    domain = "test.local"
    domain_sid = "S-1-5-21-000000000-000000000-000000000"
    report_date = (Get-Date -Format "yyyy-MM-ddTHH:mm:ss.fffZ")
    groups = @{
        "Test Group" = @(
            @{ name = "Test User"; samaccountname = "testuser"; sid = "S-1-5-21-000000000-000000000-000000000-1001"; type = "user"; enabled = $true }
        )
    }
    metadata = @{ agent_name = "test" }
} | ConvertTo-Json -Depth 10

# Save and upload
$testData | Out-File -FilePath "test.json" -Encoding UTF8
# Then upload via the web UI or curl
```

## API Endpoints Used

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/debug/status` | GET | Connection test, server health |
| `/api/upload/domain-groups` | POST | Upload group membership data (JSON) |

### API Request Format

```http
POST /api/upload/domain-groups?domain=corp.example.com
Content-Type: application/json

{
  "groups": [
    {
      "group_name": "Domain Admins",
      "members": [
        {"name": "Admin", "samaccountname": "admin", "sid": "S-1-5-...", "type": "user", "enabled": true}
      ]
    }
  ],
  "domain_metadata": {
    "domain_sid": "S-1-5-21-..."
  }
}
```

### API Response

```json
{
  "status": "success",
  "report_id": "uuid-here",
  "tool_type": "domain_analysis",
  "domain": "corp.example.com",
  "findings_count": 8,
  "groups_processed": 8,
  "message": "Successfully uploaded domain_analysis report"
}
```

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 3.0 | 2024-12 | Direct API upload, removed file handling |
| 2.0 | 2024-12 | Rewrite - minimal and focused |
| 1.0 | 2024-01 | Initial version (file-based upload) |

## Related Documentation

- [API Reference - Domain Groups](api/domain-groups.md)
- [User Guide - Domain Groups](USER_GUIDE_DOMAIN_GROUPS.md)
- [Technical Overview](Technical_Overview.md)

