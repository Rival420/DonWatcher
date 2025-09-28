# DonWatcher Client Components

This directory contains all client-side components that run on remote machines to collect and send data to the DonWatcher server.

## Structure

```
client/
├── agents/                           # Python agent framework
│   ├── __init__.py
│   ├── base_agent.py                # Base agent interface
│   └── domain_scanner_agent.py      # Domain scanning agent
├── DonWatcher-DomainScanner.ps1     # PowerShell domain scanner
└── DonWatcher-Config.json           # Configuration template
```

## PowerShell Domain Scanner

### Overview
`DonWatcher-DomainScanner.ps1` is a standalone, enterprise-ready PowerShell script for Windows domain-joined machines that:

- Collects domain and forest information
- Scans privileged group memberships
- Sends data to DonWatcher via REST API
- Supports flexible configuration and deployment

### Features
- **Configurable**: JSON-based configuration system
- **Robust**: Comprehensive error handling and logging
- **Secure**: Safe Active Directory queries with input validation
- **Flexible**: Command-line overrides and multiple deployment options
- **Enterprise-Ready**: Scheduled task and Group Policy compatible

### Prerequisites
- Windows PowerShell 5.1+ or PowerShell Core 6+
- Active Directory PowerShell module (`RSAT-AD-PowerShell`)
- Domain-joined machine with appropriate permissions
- Network connectivity to DonWatcher server

### Quick Start

```powershell
# Test connectivity
.\DonWatcher-DomainScanner.ps1 -DonWatcherUrl "http://donwatcher:8080" -TestConnection

# Run scan with default settings
.\DonWatcher-DomainScanner.ps1 -DonWatcherUrl "http://donwatcher:8080"

# Use custom configuration
.\DonWatcher-DomainScanner.ps1 -ConfigFile "prod-config.json" -Verbose
```

### Configuration (DonWatcher-Config.json)

```json
{
  "DonWatcherUrl": "http://localhost:8080",
  "PrivilegedGroups": [
    "Domain Admins",
    "Enterprise Admins",
    "Schema Admins",
    "Administrators"
  ],
  "MaxUsers": 5000,
  "MaxComputers": 5000,
  "TimeoutSeconds": 300
}
```

### Deployment Options

#### Manual Execution
```powershell
.\DonWatcher-DomainScanner.ps1 -DonWatcherUrl "http://donwatcher:8080"
```

#### Scheduled Task
```powershell
$Action = New-ScheduledTaskAction -Execute "PowerShell.exe" -Argument "-File C:\Scripts\DonWatcher-DomainScanner.ps1"
$Trigger = New-ScheduledTaskTrigger -Daily -At "02:00AM"
$Principal = New-ScheduledTaskPrincipal -UserId "DOMAIN\ServiceAccount" -LogonType Password
Register-ScheduledTask -TaskName "DonWatcher Domain Scan" -Action $Action -Trigger $Trigger -Principal $Principal
```

#### Group Policy Deployment
1. Copy script to SYSVOL share
2. Create GPO with PowerShell script execution
3. Configure appropriate security filtering
4. Test on pilot computers before full deployment

### Data Collected

- **Domain Information**: Name, SID, functional levels, DC count
- **Forest Information**: Root domain, functional level
- **User/Computer Counts**: With configurable limits for performance
- **Privileged Groups**: Configurable list of groups to monitor
- **Group Memberships**: Detailed member information with SIDs and status

### Output Format

The script generates JSON reports compatible with the DonWatcher domain analysis format, including:
- Report metadata with timestamps and collection details
- Findings for each privileged group with risk scoring
- Member details for audit trails and change tracking

## Python Agent Framework

### Overview
The `agents/` directory contains Python-based agents that can be integrated into custom applications or run as standalone services.

### Base Agent (base_agent.py)
- Abstract base class for all data collection agents
- Standardized interface for data collection and reporting
- Health monitoring and connection testing
- Error handling and status reporting

### Domain Scanner Agent (domain_scanner_agent.py)
- Python implementation of domain scanning functionality
- PowerShell integration for Active Directory queries
- Compatible with the standalone PowerShell script
- Suitable for integration into larger Python applications

### Usage
```python
from client.agents.domain_scanner_agent import DomainScannerAgent
from server.models import Agent

# Create agent configuration
config = Agent(
    name="domain_scanner",
    agent_type="domain_scanner",
    domain="company.com",
    is_active=True
)

# Initialize and run agent
agent = DomainScannerAgent(config)
report = await agent.collect_data()
```

## Security Considerations

- **Least Privilege**: Run with minimum required permissions
- **Secure Transport**: Use HTTPS for production deployments
- **Authentication**: Consider API keys or certificates for production
- **Audit Logging**: Monitor agent execution and data transmission
- **Network Segmentation**: Limit agent network access to DonWatcher only

## Troubleshooting

### Common Issues

#### PowerShell Execution Policy
```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

#### Active Directory Module Missing
```powershell
# Windows Server
Install-WindowsFeature RSAT-AD-PowerShell

# Windows 10/11
Add-WindowsCapability -Online -Name "Rsat.ActiveDirectory.DS-LDS.Tools~~~~0.0.1.0"
```

#### Network Connectivity
```powershell
Test-NetConnection -ComputerName "donwatcher.company.com" -Port 8080
```

### Logging and Diagnostics

The PowerShell script provides comprehensive logging:
- Color-coded console output
- Verbose mode for detailed diagnostics
- Error reporting with context
- Connection testing capabilities

For additional support, check the main DonWatcher documentation and debug dashboard at `/debug`.
