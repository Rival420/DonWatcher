# 🎯 DonWatcher Beacon Agent

A lightweight C2-style agent for blue team security operations. Deploy on remote systems to execute security scans and collect data.

## Features

- **Beacon Protocol**: Phones home at configurable intervals with jitter
- **Job Queue**: Receives and executes jobs from DonWatcher server
- **Built-in Scans**: Domain group scanning, vulnerability scanning
- **Custom Commands**: Execute PowerShell or shell commands
- **Auto-Upload**: Automatically uploads scan results to DonWatcher
- **🆕 Server-Side Compilation**: Download ready-to-run .exe directly from DonWatcher!
- **Pre-configured**: All settings embedded - just download and run

## Quick Start

### Option 1: Download Compiled Executable (Recommended) ⭐

**Zero configuration required!**

1. Open DonWatcher → Beacons page
2. Click **DOWNLOAD BEACON**
3. Select **.EXE format** (compiled executable)
4. Configure sleep interval and jitter if desired
5. Click **DOWNLOAD EXE**
6. Copy `DonWatcher-Beacon.exe` to your target systems
7. Run it - it connects automatically with all settings embedded!

The server compiles the beacon on-the-fly with PyInstaller, embedding your server URL and configuration directly into the executable.

```powershell
# Just run - no configuration needed!
.\DonWatcher-Beacon.exe
```

### Option 2: Build Locally (If Server Compilation Unavailable)

If the server doesn't have PyInstaller installed:

1. Download the **ZIP** format from DonWatcher
2. Run `compile-to-exe.bat` to build locally
3. Copy the resulting `.exe` to target systems

```batch
# On a Windows machine with Python:
compile-to-exe.bat

# Copy to target system and run:
DonWatcher-Beacon.exe
```

### Option 2: Python Script

If you have Python installed:

```powershell
# Windows - just run (config is pre-configured!)
python beacon.py

# Or with custom options
python beacon.py --server http://donwatcher:8080 --sleep 30 --jitter 20

# Single check-in (for testing)
python beacon.py --once

# Debug mode
python beacon.py --debug
```

## Building Standalone Executable

### Using the Build Script

The build script creates a standalone `.exe` with your server URL embedded:

```powershell
# Install build requirements
pip install pyinstaller requests

# Build with your server URL
python build.py --server https://your-donwatcher-server:8080

# Build with custom settings
python build.py --server https://your-donwatcher-server:8080 --sleep 300 --jitter 20 --output MyBeacon.exe
```

### Build Options

| Option | Description |
|--------|-------------|
| `--server, -s` | DonWatcher server URL (required) |
| `--output, -o` | Output executable name (default: beacon.exe) |
| `--sleep` | Sleep interval in seconds (default: 60) |
| `--jitter` | Jitter percentage (default: 10) |
| `--debug` | Enable debug mode in beacon |
| `--icon` | Custom .ico file for the executable |
| `--folder` | Create folder instead of single file |

### Using Batch Scripts

The download package includes convenient batch scripts:

- **`compile-to-exe.bat`** - Build Windows executable
- **`compile-to-binary.sh`** - Build Linux binary
- **`start-beacon.bat`** - Run with Python (Windows)
- **`start-beacon.sh`** - Run with Python (Linux/Mac)

## Configuration

### Pre-configured (Recommended)

When you download the beacon from DonWatcher, it's already configured with:
- Your server URL
- Default sleep interval (60s)
- Default jitter (10%)

Just run it - no configuration needed!

### Config File

Create `beacon.json` for custom settings:

```json
{
    "server_url": "http://donwatcher:8080",
    "sleep_interval": 60,
    "jitter_percent": 10,
    "verify_ssl": true,
    "debug": false,
    "auto_upload": true
}
```

### Command Line Options

| Option | Description |
|--------|-------------|
| `--server, -s` | DonWatcher server URL |
| `--sleep, -i` | Sleep interval in seconds |
| `--jitter, -j` | Jitter percentage |
| `--config, -c` | Path to configuration file |
| `--debug, -d` | Enable debug logging |
| `--no-ssl-verify` | Disable SSL certificate verification |
| `--once` | Single check-in and exit |

## Available Job Types

### 👥 Domain Scan (`domain_scan`)
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

### For Running as Python Script
- Python 3.8+
- `requests` library (optional, falls back to urllib)
- Windows with Active Directory module (for domain scans)

### For Building Executable
- Python 3.8+
- `pyinstaller` package
- `requests` library

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

### Executable Won't Run
- Windows may block downloaded executables
- Right-click → Properties → Unblock
- Or run from command prompt to see errors

## License

Part of the DonWatcher Security Dashboard project.
