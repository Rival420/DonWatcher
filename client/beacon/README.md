# 🎯 DonWatcher Beacon Agent

A lightweight C2-style agent for blue team security operations. Deploy on remote systems to execute security scans and collect data.

## Features

- **Beacon Protocol**: Phones home at configurable intervals with jitter
- **Job Queue**: Receives and executes jobs from DonWatcher server
- **Built-in Scans**: Domain group scanning, vulnerability scanning
- **Custom Commands**: Execute PowerShell or shell commands
- **Auto-Upload**: Automatically uploads scan results to DonWatcher
- **Cross-Platform**: Works on Windows (primary) and Linux/macOS (limited)

## Quick Start

### Basic Usage

```powershell
# Windows - connect to DonWatcher server
python beacon.py --server http://donwatcher:8080

# With custom sleep interval and jitter
python beacon.py --server http://donwatcher:8080 --sleep 30 --jitter 20

# Single check-in (for testing)
python beacon.py --server http://donwatcher:8080 --once

# Debug mode
python beacon.py --server http://donwatcher:8080 --debug
```

### Using Config File

Create `beacon.json`:

```json
{
    "server_url": "http://donwatcher:8080",
    "sleep_interval": 60,
    "jitter_percent": 10,
    "debug": false
}
```

Then run:

```powershell
python beacon.py --config beacon.json
```

## Command Line Options

| Option | Description |
|--------|-------------|
| `--server, -s` | DonWatcher server URL (required) |
| `--sleep, -i` | Sleep interval in seconds (default: 60) |
| `--jitter, -j` | Jitter percentage (default: 10) |
| `--config, -c` | Path to configuration file |
| `--debug, -d` | Enable debug logging |
| `--no-ssl-verify` | Disable SSL certificate verification |
| `--once` | Single check-in and exit |

## Available Job Types

### 🔍 Domain Scan (`domain_scan`)
Scans Active Directory privileged group memberships:
- Domain Admins, Enterprise Admins, Schema Admins
- Administrators, Account Operators, Backup Operators
- Server Operators, Print Operators

Results are automatically uploaded to DonWatcher.

### 🛡️ Vulnerability Scan (`vulnerability_scan`)
Collects vulnerability data from Outpost24 Outscan.

Requires API token:
- Set `OUTPOST24_TOKEN` environment variable, or
- Pass `api_token` in job parameters

### ⚡ PowerShell (`powershell`)
Execute custom PowerShell commands.

### 🖥️ Shell (`shell`)
Execute shell commands (cmd.exe on Windows, /bin/sh on Linux/macOS).

## Beacon ID

Each beacon generates a unique ID based on:
- Hostname
- MAC address
- Operating system

Format: `BEACON-XXXXXXXXXXXXXXXX`

## Security Considerations

⚠️ **This is a blue team tool designed for authorized security operations.**

- Only deploy on systems you own/manage
- Use HTTPS in production
- Protect API tokens and credentials
- Monitor beacon activity in DonWatcher

## Requirements

- Python 3.8+
- `requests` library (optional, falls back to urllib)
- Windows with Active Directory module (for domain scans)

## Installation

```powershell
# Clone or download beacon files
# Install dependencies (optional but recommended)
pip install requests

# Run
python beacon.py --server http://your-donwatcher-server:8080
```

## Building Standalone Executable

Using PyInstaller:

```powershell
pip install pyinstaller
pyinstaller --onefile --name DonWatcher-Beacon beacon.py
```

The executable will be in `dist/DonWatcher-Beacon.exe`.

## Troubleshooting

### "PowerShell not found"
- Ensure PowerShell is installed and in PATH
- On Windows: `powershell.exe` should be available
- On Linux/macOS: Install PowerShell (`pwsh`)

### "No API token provided"
- Set `OUTPOST24_TOKEN` environment variable
- Or include `api_token` in job parameters from DonWatcher UI

### Connection Refused
- Verify DonWatcher server URL
- Check firewall rules
- Ensure DonWatcher backend is running

## License

Part of the DonWatcher Security Dashboard project.

