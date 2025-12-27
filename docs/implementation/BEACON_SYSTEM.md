# 🎯 DonWatcher Beacon System

## Overview

The DonWatcher Beacon System is a C2-like (Command & Control) agent management infrastructure designed for **blue team** security operations. It allows security teams to deploy lightweight agents on remote systems to execute security scans and collect data.

**This is NOT a malicious tool** - it's designed for authorized security operations on systems you own/manage.

## Architecture

```
┌─────────────────────────────┐      ┌────────────────────────────────┐
│   DonWatcher Frontend       │      │     DonWatcher Backend         │
│   (Operator Console)        │──────│     (Command & Control)        │
│                             │      │                                │
│  ┌───────────────────────┐  │      │  ┌────────────────────────┐    │
│  │ 🟢 Beacons Dashboard  │  │      │  │ /api/beacons/*         │    │
│  │ 📋 Job Queue          │  │      │  │ /api/beacons/checkin   │    │
│  │ 📤 Task Beacons       │  │      │  │ /api/beacons/download  │    │
│  │ 📊 Results Viewer     │  │      │  └────────────────────────┘    │
│  └───────────────────────┘  │      │                                │
└─────────────────────────────┘      └──────────────┬─────────────────┘
                                                    │
                                                    │ HTTPS (Beacon Protocol)
                                                    │ Sleep + Jitter
                                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                         Target Systems                                  │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐             │
│  │ 🖥️ BEACON-01 │    │ 🖥️ BEACON-02 │    │ 🖥️ BEACON-03 │             │
│  │ WORKSTATION  │    │ DC01         │    │ FILESERVER   │             │
│  └──────────────┘    └──────────────┘    └──────────────┘             │
└────────────────────────────────────────────────────────────────────────┘
```

## Components

### 1. Backend API (`server/routers/beacons.py`)

**Beacon Protocol Endpoints:**
- `POST /api/beacons/checkin` - Beacon check-in (register/update, get jobs)
- `POST /api/beacons/result` - Submit job execution results

**Management Endpoints:**
- `GET /api/beacons/` - List all beacons
- `GET /api/beacons/stats` - Dashboard statistics
- `GET /api/beacons/{beacon_id}` - Get specific beacon
- `PATCH /api/beacons/{beacon_id}` - Update beacon config
- `DELETE /api/beacons/{beacon_id}` - Kill beacon

**Job Management:**
- `POST /api/beacons/jobs` - Create new job
- `POST /api/beacons/jobs/bulk` - Create jobs for multiple beacons
- `GET /api/beacons/jobs/all` - List all jobs
- `GET /api/beacons/{beacon_id}/jobs` - List beacon's jobs
- `GET /api/beacons/jobs/{job_id}` - Get job with results
- `DELETE /api/beacons/jobs/{job_id}` - Cancel pending job

**Templates & Download:**
- `GET /api/beacons/templates/all` - List task templates
- `POST /api/beacons/templates` - Create template
- `GET /api/beacons/download` - Download beacon package

### 2. Beacon Agent (`client/beacon/beacon.py`)

A standalone Python agent that:
- Generates unique beacon ID from machine characteristics
- Beacons home at configurable intervals with jitter
- Receives and executes jobs from the C2 server
- Supports built-in security scans (domain groups, vulnerabilities)
- Executes custom PowerShell/shell commands
- Auto-uploads scan results to DonWatcher

**Usage:**
```bash
# Basic usage
python beacon.py --server http://donwatcher:8080

# With config file
python beacon.py --config beacon.json

# Single check-in (testing)
python beacon.py --server http://donwatcher:8080 --once
```

### 3. Frontend UI (`frontend/src/pages/Beacons.tsx`)

A C2-style management interface with:
- Real-time beacon status (active/dormant/dead indicators)
- Task templates for common operations
- Custom command execution
- Job output viewer with syntax highlighting
- Activity logging
- Dark terminal aesthetic

### 4. Database Schema (`migrations/migration_013_add_beacon_system.sql`)

Tables:
- `beacons` - Registered beacon agents
- `beacon_jobs` - Job queue
- `beacon_job_results` - Detailed job results
- `beacon_activity_log` - Audit trail
- `beacon_task_templates` - Pre-built tasks

Views:
- `v_beacon_dashboard` - Dashboard with computed status

## Job Types

| Job Type | Description | Auto-Upload |
|----------|-------------|-------------|
| `domain_scan` | Scan AD privileged groups | ✅ Yes |
| `vulnerability_scan` | Collect Outpost24 data | ✅ Yes |
| `powershell` | Execute PowerShell code | ❌ No |
| `shell` | Execute shell command | ❌ No |

## Beacon Status

| Status | Description | Computed From |
|--------|-------------|---------------|
| 🟢 Active | Recently checked in | last_seen < 5 minutes |
| 🟡 Dormant | Not seen for a while | last_seen < 30 minutes |
| 🔴 Dead | Not seen for too long | last_seen > 30 minutes |
| ⚫ Killed | Manually terminated | Set by operator |

## Security Considerations

⚠️ **Important Security Notes:**

1. **Authorization Required**: Only deploy beacons on systems you own/manage
2. **Use HTTPS**: Always use HTTPS in production environments
3. **Protect Credentials**: Secure API tokens and configuration files
4. **Audit Logging**: All beacon activity is logged for accountability
5. **Network Security**: Ensure proper firewall rules for beacon traffic

## Deployment

### Server Setup

1. Run the migration:
```bash
# The migration runs automatically on startup
# Or manually apply:
psql $DATABASE_URL < migrations/migration_013_add_beacon_system.sql
```

2. Restart DonWatcher backend to load the beacon router

### Beacon Deployment

1. Download beacon package from DonWatcher UI or API:
```bash
curl -o beacon.zip "http://donwatcher:8080/api/beacons/download?server_url=http://donwatcher:8080"
```

2. Extract and run on target system:
```bash
unzip beacon.zip
cd DonWatcher-Beacon
pip install -r requirements.txt
python beacon.py --config beacon.json
```

### Tasking Beacons

1. Navigate to Beacons page in DonWatcher UI
2. Click "TASK" on a beacon
3. Select a task template or enter custom command
4. Click "EXECUTE"
5. View results in the Jobs panel

## API Examples

### Check-in (Beacon → Server)
```json
POST /api/beacons/checkin
{
    "beacon_id": "BEACON-A1B2C3D4E5F6G7H8",
    "hostname": "WORKSTATION01",
    "internal_ip": "192.168.1.100",
    "os_info": "Windows 10 Pro",
    "username": "john.doe",
    "domain": "CORP"
}
```

### Create Job (Operator → Server)
```json
POST /api/beacons/jobs
{
    "beacon_id": "BEACON-A1B2C3D4E5F6G7H8",
    "job_type": "domain_scan",
    "parameters": {"auto_upload": true},
    "priority": 5
}
```

### Submit Result (Beacon → Server)
```json
POST /api/beacons/result
{
    "job_id": "uuid-here",
    "beacon_id": "BEACON-A1B2C3D4E5F6G7H8",
    "status": "completed",
    "output": "{\"domain\": \"CORP.LOCAL\", ...}",
    "exit_code": 0
}
```

## Future Enhancements

- [ ] Encrypted beacon communication
- [ ] Beacon groups and targeting
- [ ] Scheduled/recurring jobs
- [ ] File upload/download capabilities
- [ ] Interactive shell mode
- [ ] Multi-stage job workflows
- [ ] Beacon self-update mechanism

