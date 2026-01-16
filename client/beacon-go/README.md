# 🎯 DonWatcher Beacon Agent v2.0 (Go Edition)

A lightweight, high-performance C2-style agent for blue team security operations. Written in Go for easy cross-compilation and Windows service support.

## ✨ Features

- **Single Binary** - No dependencies, no runtime needed
- **Cross-Compiled** - Windows EXE built directly from Linux server
- **Windows Service** - Install as a system service using kardianos/service
- **Beacon Protocol** - Configurable check-in intervals with jitter
- **Job Execution** - PowerShell, shell commands, domain scans
- **Embedded Config** - All settings baked in at compile time

## 🚀 Quick Start

### Download from DonWatcher (Recommended)

1. Open DonWatcher → **Beacons** page
2. Click **DOWNLOAD BEACON**
3. Select **.EXE** format
4. Click **DOWNLOAD** - the server cross-compiles it for Windows!
5. Copy `DonWatcher-Beacon.exe` to your target systems

### Running the Beacon

```powershell
# Run interactively (foreground)
.\DonWatcher-Beacon.exe run

# Run with debug logging
.\DonWatcher-Beacon.exe run -debug

# Show version and embedded config
.\DonWatcher-Beacon.exe version
```

### Install as Windows Service

```powershell
# Install the service (requires Administrator)
.\DonWatcher-Beacon.exe install

# Start the service
.\DonWatcher-Beacon.exe start

# Check status
.\DonWatcher-Beacon.exe status

# Stop and remove
.\DonWatcher-Beacon.exe stop
.\DonWatcher-Beacon.exe uninstall
```

You can also use Windows Service Manager (`services.msc`) or `sc` commands:

```powershell
sc start DonWatcher-Beacon
sc stop DonWatcher-Beacon
sc query DonWatcher-Beacon
```

## 📋 Available Commands

| Command | Description |
|---------|-------------|
| `install` | Install as Windows service |
| `uninstall` | Remove Windows service |
| `start` | Start the service |
| `stop` | Stop the service |
| `restart` | Restart the service |
| `status` | Get service status |
| `run` | Run interactively (foreground) |
| `version` | Show version and config |
| `help` | Show help |

## ⚙️ Command Line Flags

Override embedded configuration:

| Flag | Description |
|------|-------------|
| `-server URL` | Override server URL |
| `-sleep N` | Override sleep interval (seconds) |
| `-jitter N` | Override jitter percentage |
| `-debug` | Enable debug logging |

Example:
```powershell
.\DonWatcher-Beacon.exe run -server http://192.168.1.100:8080 -sleep 30 -debug
```

## 🔧 Building Locally

If you want to build from source:

```bash
# Install Go 1.21+
# Clone the repo

cd client/beacon-go

# Build for Windows (from any OS!)
GOOS=windows GOARCH=amd64 go build -o DonWatcher-Beacon.exe

# Build with embedded config
GOOS=windows GOARCH=amd64 go build \
  -ldflags "-X main.ServerURL=http://myserver:8080 -X main.SleepInterval=60" \
  -o DonWatcher-Beacon.exe

# Build for Linux
GOOS=linux GOARCH=amd64 go build -o donwatcher-beacon
```

### Build Flags

| Flag | Description |
|------|-------------|
| `-X main.ServerURL=...` | Server URL |
| `-X main.SleepInterval=60` | Sleep interval in seconds |
| `-X main.JitterPercent=10` | Jitter percentage |
| `-X main.VerifySSL=true` | SSL verification |
| `-X main.DebugMode=false` | Debug mode |
| `-X main.Version=2.0.0` | Version string |

## 📡 Job Types

The beacon supports these job types from DonWatcher:

### 👥 Domain Scan (`domain_scan`)
Scans Active Directory privileged groups:
- Domain Admins, Enterprise Admins, Schema Admins
- Administrators, Account Operators
- Backup Operators, Server Operators, Print Operators

### ⚡ PowerShell (`powershell`)
Execute custom PowerShell commands.

### 💻 Shell (`shell`)
Execute shell commands (cmd.exe on Windows).

### ℹ️ System Info (`system_info`)
Return system information as JSON.

## 🔒 Security Considerations

⚠️ **This is a blue team tool for authorized security operations only.**

- Only deploy on systems you own/manage
- Use HTTPS in production
- The service runs as SYSTEM by default
- Consider using a service account with limited privileges

## 📋 Requirements

### Target System
- Windows Server 2016+ or Windows 10+
- 64-bit (amd64)
- Administrator privileges for service installation

### Build System (if building locally)
- Go 1.21+
- No other dependencies (Go compiles everything statically)

## 🐛 Troubleshooting

### "Access Denied" when installing service
Run PowerShell as Administrator.

### Service won't start
Check Windows Event Viewer → Application logs for errors.

### Can't connect to server
- Verify server URL is correct
- Check firewall rules
- Try running with `-debug` flag

### PowerShell commands fail
- Ensure PowerShell execution policy allows scripts
- Check if required modules (e.g., ActiveDirectory) are installed

## 📄 License

Part of the DonWatcher Security Dashboard project.
