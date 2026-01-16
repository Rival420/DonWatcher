"""
Beacon Management Router - C2-like agent management API endpoints.

This module provides the command and control infrastructure for managing
remote beacon agents that execute security scanning jobs.

Features:
- Beacon registration and check-in
- Job creation and result collection
- **Server-side beacon compilation** - Downloads ready-to-run .exe files
- Scheduled jobs and templates
"""

import json
import logging
import os
import zipfile
import io
from datetime import datetime, timedelta
from pathlib import Path
from typing import List, Optional, Dict, Any
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, Request, Query, BackgroundTasks
from fastapi.responses import StreamingResponse, Response
from sqlalchemy import text
from pydantic import BaseModel

from server.models import (
    Beacon, BeaconJob, BeaconJobCreate, BeaconJobResult,
    BeaconCheckinRequest, BeaconCheckinResponse,
    TaskTemplate, BeaconActivityLog, BeaconDashboardStats,
    JobStatus, JobType, BeaconStatus, BulkJobCreate
)
from server.storage_postgres import PostgresReportStorage, get_storage
from server.beacon_compiler import (
    compile_beacon, 
    check_compiler_available, 
    get_compiler_status,
    BeaconCompilerError
)

router = APIRouter(prefix="/api/beacons", tags=["beacons"])
logger = logging.getLogger("beacons")


# =============================================================================
# Request/Response Models for Beacon Download
# =============================================================================

class BeaconDownloadConfig(BaseModel):
    """Configuration for beacon download/compilation."""
    server_url: Optional[str] = None  # Auto-detected if not provided
    sleep_interval: int = 60
    jitter_percent: int = 10
    verify_ssl: bool = True
    debug: bool = False
    output_name: str = "DonWatcher-Beacon"


class CompilerStatusResponse(BaseModel):
    """Status of the beacon compiler service."""
    status: str
    compiler: str
    compiler_version: Optional[str]
    go_installed: bool
    can_compile_windows: bool
    can_cross_compile: bool
    cache: Dict[str, Any]
    supported_targets: List[str]


# =============================================================================
# Beacon Download Endpoints - Get beacon agent as source or compiled executable
# =============================================================================

@router.get("/compiler/status", response_model=CompilerStatusResponse)
async def get_beacon_compiler_status():
    """
    Get the status of the server-side beacon compiler.
    
    Returns whether Go is available for cross-platform compilation.
    """
    return get_compiler_status()


@router.get("/download")
async def download_beacon(
    request: Request,
    server_url: Optional[str] = Query(None, description="Backend API URL (auto-detected if not provided)"),
    sleep: int = Query(60, description="Sleep interval in seconds"),
    jitter: int = Query(10, description="Jitter percentage"),
    verify_ssl: bool = Query(True, description="Verify SSL certificates (disable for self-signed certs)"),
    format: str = Query("zip", description="Download format: 'zip' for source, 'exe' for compiled executable")
):
    """
    Download the beacon agent package (Go version v2.0).
    
    **Formats:**
    - `exe` - **Compiled executable** - Ready to run Windows EXE with service support!
    - `zip` - Go source package for local builds or customization
    
    The executable format uses **Go cross-compilation** - works from any server OS!
    Configuration is embedded via ldflags. Includes Windows service support.
    
    **Features:**
    - Cross-compile Windows EXE from Linux server ✓
    - Install as Windows service (kardianos/service)
    - Single binary - no dependencies needed
    
    **Configurable values:**
    - Server URL (backend API, usually port 8080)
    - Sleep interval (default: 60 seconds)  
    - Jitter percentage (default: 10%)
    - SSL verification (default: enabled)
    
    The ZIP package includes:
    - main.go - The Go beacon agent source
    - go.mod - Go module file
    - build.bat/build.sh - Build scripts for Windows/Linux
    - PowerShell scripts for DonWatcher scans
    """
    try:
        # Find beacon files (Go version)
        project_root = Path(__file__).parent.parent.parent
        beacon_go_dir = project_root / "client" / "beacon-go"
        
        if not beacon_go_dir.exists():
            raise HTTPException(status_code=500, detail="Go beacon source not found on server")
        
        # Auto-detect server URL from request if not provided
        if not server_url:
            scheme = request.headers.get("X-Forwarded-Proto", request.url.scheme)
            host = request.headers.get("X-Forwarded-Host", request.headers.get("Host", request.url.netloc))
            # Use port 8080 for backend API
            if ":" not in host:
                host = f"{host}:8080"
            server_url = f"{scheme}://{host}"
            logger.info(f"Auto-detected server URL: {server_url}")
        
        # =========================================================================
        # COMPILED EXECUTABLE - Server-side Go cross-compilation
        # =========================================================================
        if format == "exe":
            # Check if Go compiler is available
            if not check_compiler_available():
                raise HTTPException(
                    status_code=503, 
                    detail="Server-side compilation not available. Go compiler not installed on server. "
                           "Download the 'zip' format and compile locally, or ask your admin to install Go."
                )
            
            try:
                logger.info(f"Compiling beacon executable for {server_url} (verify_ssl={verify_ssl})")
                
                # Compile the beacon with embedded configuration
                binary_data, filename = await compile_beacon(
                    server_url=server_url,
                    sleep_interval=sleep,
                    jitter_percent=jitter,
                    verify_ssl=verify_ssl,
                    debug=False,
                    output_name="DonWatcher-Beacon",
                    target_os="windows"
                )
                
                logger.info(f"Beacon compiled successfully: {filename} ({len(binary_data)} bytes)")
                
                return Response(
                    content=binary_data,
                    media_type="application/octet-stream",
                    headers={
                        "Content-Disposition": f"attachment; filename={filename}",
                        "Content-Length": str(len(binary_data)),
                        "X-Beacon-Config": json.dumps({
                            "server_url": server_url,
                            "sleep_interval": sleep,
                            "jitter_percent": jitter,
                            "verify_ssl": verify_ssl
                        })
                    }
                )
                
            except BeaconCompilerError as e:
                logger.error(f"Beacon compilation failed: {e}")
                raise HTTPException(
                    status_code=500, 
                    detail=f"Compilation failed: {str(e)}"
                )
        
        # =========================================================================
        # SOURCE PACKAGE - ZIP with Go source (v2.0)
        # =========================================================================
        # Create ZIP in memory
        zip_buffer = io.BytesIO()
        
        # Go beacon source directory
        beacon_go_dir = project_root / "client" / "beacon-go"
        
        with zipfile.ZipFile(zip_buffer, 'w', zipfile.ZIP_DEFLATED) as zip_file:
            # Add Go source files
            if beacon_go_dir.exists():
                # main.go - The beacon agent
                main_go = beacon_go_dir / "main.go"
                if main_go.exists():
                    zip_file.write(main_go, "DonWatcher-Beacon/main.go")
                
                # go.mod - Go module file
                go_mod = beacon_go_dir / "go.mod"
                if go_mod.exists():
                    zip_file.write(go_mod, "DonWatcher-Beacon/go.mod")
                
                # go.sum - Go module checksums (required for builds!)
                go_sum = beacon_go_dir / "go.sum"
                if go_sum.exists():
                    zip_file.write(go_sum, "DonWatcher-Beacon/go.sum")
                
                # README.md
                readme = beacon_go_dir / "README.md"
                if readme.exists():
                    zip_file.write(readme, "DonWatcher-Beacon/README.md")
            
            # Add PowerShell scripts from client folder
            ps_scripts = [
                "DonWatcher-DomainScanner.ps1",
                "DonWatcher-VulnerabilityScanner.ps1",
                "DonWatcher-Config.json"
            ]
            client_dir = project_root / "client"
            for script in ps_scripts:
                script_path = client_dir / script
                if script_path.exists():
                    zip_file.write(script_path, f"DonWatcher-Beacon/{script}")
            
            # Create config.json with user settings
            config = {
                "server_url": server_url,
                "sleep_interval": sleep,
                "jitter_percent": jitter,
                "verify_ssl": verify_ssl,
                "debug": False,
            }
            config_json = json.dumps(config, indent=2)
            zip_file.writestr("DonWatcher-Beacon/config.json", config_json)
            
            ssl_note = "" if verify_ssl else " (SSL verify: OFF)"
            verify_ssl_str = "true" if verify_ssl else "false"
            
            # Build script for Windows using Go
            build_bat = f"""@echo off
echo ==========================================
echo  DonWatcher Beacon - Go Build (Windows)
echo ==========================================
echo.
echo Configuration:
echo   Server: {server_url}
echo   Sleep: {sleep}s, Jitter: {jitter}%{ssl_note}
echo.

REM Check for Go
where go >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo [!] Go not found. Please install Go from https://go.dev/dl/
    pause
    exit /b 1
)

echo [*] Resolving dependencies...
go mod tidy

echo [*] Downloading dependencies...
go mod download

echo [*] Building DonWatcher-Beacon.exe...
go build -ldflags "-X main.ServerURL={server_url} -X main.SleepInterval={sleep} -X main.JitterPercent={jitter} -X main.VerifySSL={verify_ssl_str} -s -w -H=windowsgui" -o DonWatcher-Beacon.exe .

if %ERRORLEVEL% EQU 0 (
    echo.
    echo [+] Build successful! Created DonWatcher-Beacon.exe
    echo.
    echo Usage:
    echo   DonWatcher-Beacon.exe run       - Run interactively
    echo   DonWatcher-Beacon.exe install   - Install as Windows service
    echo   DonWatcher-Beacon.exe start     - Start the service
) else (
    echo [!] Build failed
)
pause
"""
            zip_file.writestr("DonWatcher-Beacon/build.bat", build_bat)
            
            # Build script for Linux/macOS using Go
            build_sh = f"""#!/bin/bash
echo "=========================================="
echo " DonWatcher Beacon - Go Build"
echo "=========================================="
echo
echo "Configuration:"
echo "  Server: {server_url}"
echo "  Sleep: {sleep}s, Jitter: {jitter}%"
echo

# Check for Go
if ! command -v go &> /dev/null; then
    echo "[!] Go not found. Please install Go from https://go.dev/dl/"
    exit 1
fi

echo "[*] Resolving dependencies..."
go mod tidy

echo "[*] Downloading dependencies..."
go mod download

echo "[*] Building for current platform..."
go build -ldflags "-X main.ServerURL={server_url} -X main.SleepInterval={sleep} -X main.JitterPercent={jitter} -X main.VerifySSL={verify_ssl_str} -s -w" -o donwatcher-beacon .

if [ $? -eq 0 ]; then
    echo
    echo "[+] Build successful! Created donwatcher-beacon"
    chmod +x donwatcher-beacon
    echo
    echo "Usage:"
    echo "  ./donwatcher-beacon run       - Run interactively"
    echo "  ./donwatcher-beacon install   - Install as service"
    echo "  ./donwatcher-beacon start     - Start the service"
else
    echo "[!] Build failed"
fi
"""
            zip_file.writestr("DonWatcher-Beacon/build.sh", build_sh)
            
            # Cross-compile script for building Windows EXE from Linux/macOS
            cross_compile_sh = f"""#!/bin/bash
echo "=========================================="
echo " DonWatcher Beacon - Cross-Compile for Windows"
echo "=========================================="
echo
echo "Building Windows EXE from $(uname -s)..."
echo

# Check for Go
if ! command -v go &> /dev/null; then
    echo "[!] Go not found. Please install Go from https://go.dev/dl/"
    exit 1
fi

echo "[*] Resolving dependencies..."
go mod tidy

echo "[*] Downloading dependencies..."
go mod download

echo "[*] Cross-compiling for Windows amd64..."
GOOS=windows GOARCH=amd64 CGO_ENABLED=0 go build \\
    -ldflags "-X main.ServerURL={server_url} -X main.SleepInterval={sleep} -X main.JitterPercent={jitter} -X main.VerifySSL={verify_ssl_str} -s -w -H=windowsgui" \\
    -o DonWatcher-Beacon.exe .

if [ $? -eq 0 ]; then
    echo
    echo "[+] Cross-compile successful!"
    echo "[+] Created: DonWatcher-Beacon.exe"
    ls -lh DonWatcher-Beacon.exe
    echo
    echo "Copy this file to your Windows systems and run:"
    echo "  DonWatcher-Beacon.exe install   - Install as service"
    echo "  DonWatcher-Beacon.exe start     - Start the service"
else
    echo "[!] Build failed"
fi
"""
            zip_file.writestr("DonWatcher-Beacon/cross-compile-windows.sh", cross_compile_sh)
            
            # PowerShell build script for Windows (one-click)
            build_ps1 = f'''#Requires -Version 5.1
<#
.SYNOPSIS
    One-click Go build script for DonWatcher Beacon
    
.DESCRIPTION
    Builds a Windows executable with embedded configuration using Go.
    Supports Windows service installation!
    
.NOTES
    Configuration is pre-embedded:
    - Server: {server_url}
    - Sleep: {sleep}s, Jitter: {jitter}%
    - SSL Verify: {str(verify_ssl).lower()}
#>

$ErrorActionPreference = "Stop"
$ProgressPreference = "SilentlyContinue"

Write-Host ""
Write-Host "============================================" -ForegroundColor Green
Write-Host "  DonWatcher Beacon - Go Builder" -ForegroundColor Green  
Write-Host "============================================" -ForegroundColor Green
Write-Host ""
Write-Host "Configuration:" -ForegroundColor Cyan
Write-Host "  Server URL: {server_url}"
Write-Host "  Sleep: {sleep}s, Jitter: {jitter}%"
Write-Host "  SSL Verify: {str(verify_ssl).lower()}"
Write-Host ""

# Check for Go
Write-Host "[*] Checking for Go..." -ForegroundColor Yellow
try {{
    $goVersion = & go version 2>&1
    if ($LASTEXITCODE -eq 0) {{
        Write-Host "[+] Found: $goVersion" -ForegroundColor Green
    }} else {{
        throw "Go not found"
    }}
}} catch {{
    Write-Host "[!] Go not found!" -ForegroundColor Red
    Write-Host ""
    Write-Host "Please install Go from https://go.dev/dl/" -ForegroundColor Yellow
    Write-Host ""
    Read-Host "Press Enter to exit"
    exit 1
}}

# Resolve and download dependencies
Write-Host ""
Write-Host "[*] Resolving dependencies..." -ForegroundColor Yellow
& go mod tidy
if ($LASTEXITCODE -ne 0) {{
    Write-Host "[!] Warning: go mod tidy failed, trying download anyway..." -ForegroundColor Yellow
}}

Write-Host "[*] Downloading dependencies..." -ForegroundColor Yellow
& go mod download
if ($LASTEXITCODE -ne 0) {{
    Write-Host "[!] Failed to download dependencies" -ForegroundColor Red
    Read-Host "Press Enter to exit"
    exit 1
}}
Write-Host "[+] Dependencies downloaded" -ForegroundColor Green

# Build the executable
Write-Host ""
Write-Host "[*] Building DonWatcher-Beacon.exe..." -ForegroundColor Yellow
Write-Host "    This may take a minute..." -ForegroundColor Gray

$ldflags = "-X main.ServerURL={server_url} -X main.SleepInterval={sleep} -X main.JitterPercent={jitter} -X main.VerifySSL={verify_ssl_str} -s -w -H=windowsgui"

& go build -ldflags $ldflags -o DonWatcher-Beacon.exe .

if ($LASTEXITCODE -ne 0) {{
    Write-Host ""
    Write-Host "[!] Build failed!" -ForegroundColor Red
    Read-Host "Press Enter to exit"
    exit 1
}}

# Verify output
$exePath = Join-Path $PSScriptRoot "DonWatcher-Beacon.exe"
if (Test-Path $exePath) {{
    $size = (Get-Item $exePath).Length / 1MB
    Write-Host ""
    Write-Host "============================================" -ForegroundColor Green
    Write-Host "  BUILD SUCCESSFUL!" -ForegroundColor Green
    Write-Host "============================================" -ForegroundColor Green
    Write-Host ""
    Write-Host "Output: DonWatcher-Beacon.exe ($([math]::Round($size, 1)) MB)" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Usage:" -ForegroundColor Yellow
    Write-Host "  .\\DonWatcher-Beacon.exe run       - Run interactively"
    Write-Host "  .\\DonWatcher-Beacon.exe install   - Install as Windows service"
    Write-Host "  .\\DonWatcher-Beacon.exe start     - Start the service"
    Write-Host "  .\\DonWatcher-Beacon.exe status    - Check service status"
    Write-Host ""
}} else {{
    Write-Host "[!] Build completed but executable not found" -ForegroundColor Red
}}

Read-Host "Press Enter to exit"
'''
            zip_file.writestr("DonWatcher-Beacon/build-beacon.ps1", build_ps1)
        
        # Prepare response
        zip_buffer.seek(0)
        
        return StreamingResponse(
            zip_buffer,
            media_type="application/zip",
            headers={
                "Content-Disposition": "attachment; filename=DonWatcher-Beacon.zip"
            }
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.exception(f"Failed to create beacon package: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to create package: {e}")




# =============================================================================
# Beacon Check-in Endpoints (Used by beacon agents)
# =============================================================================

@router.post("/checkin", response_model=BeaconCheckinResponse)
async def beacon_checkin(
    checkin: BeaconCheckinRequest,
    request: Request,
    storage: PostgresReportStorage = Depends(get_storage)
):
    """
    Beacon check-in endpoint.
    
    Called by beacon agents to:
    1. Register themselves (first check-in)
    2. Update their status (subsequent check-ins)
    3. Receive pending jobs
    
    This is the main communication endpoint between beacons and the C2 server.
    """
    try:
        # Get external IP from request
        external_ip = request.client.host if request.client else None
        
        with storage.get_connection() as conn:
            # Update or insert beacon using the stored function
            result = conn.execute(
                text("""
                    SELECT update_beacon_checkin(
                        :beacon_id, :hostname, :internal_ip, :external_ip,
                        :os_info, :username, :domain, :process_name,
                        :process_id, :architecture, :beacon_version
                    ) as beacon_uuid
                """),
                {
                    "beacon_id": checkin.beacon_id,
                    "hostname": checkin.hostname,
                    "internal_ip": checkin.internal_ip,
                    "external_ip": external_ip,
                    "os_info": checkin.os_info,
                    "username": checkin.username,
                    "domain": checkin.domain,
                    "process_name": checkin.process_name,
                    "process_id": checkin.process_id,
                    "architecture": checkin.architecture,
                    "beacon_version": checkin.beacon_version
                }
            )
            beacon_uuid = result.scalar()
            
            # Log the check-in
            conn.execute(
                text("""
                    INSERT INTO beacon_activity_log (beacon_id, activity_type, details, ip_address)
                    VALUES (:beacon_id, 'checkin', :details, :ip_address)
                """),
                {
                    "beacon_id": checkin.beacon_id,
                    "details": '{"hostname": "' + checkin.hostname + '"}',
                    "ip_address": external_ip
                }
            )
            
            # Get beacon configuration
            config = conn.execute(
                text("SELECT sleep_interval, jitter_percent FROM beacons WHERE beacon_id = :beacon_id"),
                {"beacon_id": checkin.beacon_id}
            ).fetchone()
            
            # Get pending jobs
            jobs_result = conn.execute(
                text("""
                    UPDATE beacon_jobs
                    SET status = 'sent', sent_at = NOW()
                    WHERE beacon_id = :beacon_id 
                    AND status = 'pending'
                    RETURNING id, job_type, command, parameters, priority, notes
                """),
                {"beacon_id": checkin.beacon_id}
            )
            
            jobs = []
            for row in jobs_result:
                jobs.append({
                    "id": str(row.id),
                    "job_type": row.job_type,
                    "command": row.command,
                    "parameters": row.parameters or {},
                    "priority": row.priority,
                    "notes": row.notes
                })
            
            conn.commit()
            
            logger.info(f"Beacon check-in: {checkin.beacon_id} ({checkin.hostname}) - {len(jobs)} jobs queued")
            
            return BeaconCheckinResponse(
                status="ok",
                beacon_uuid=str(beacon_uuid),
                sleep_interval=config.sleep_interval if config else 60,
                jitter_percent=config.jitter_percent if config else 10,
                jobs=jobs
            )
            
    except Exception as e:
        logger.exception(f"Beacon check-in failed: {e}")
        raise HTTPException(status_code=500, detail=f"Check-in failed: {e}")


@router.post("/result")
async def submit_job_result(
    result: BeaconJobResult,
    request: Request,
    storage: PostgresReportStorage = Depends(get_storage)
):
    """
    Submit job execution results.
    
    Called by beacon agents after executing a job to report results.
    """
    try:
        with storage.get_connection() as conn:
            # Update job status and results
            conn.execute(
                text("""
                    UPDATE beacon_jobs
                    SET status = :status,
                        result_output = :output,
                        result_error = :error,
                        exit_code = :exit_code,
                        started_at = :started_at,
                        completed_at = :completed_at
                    WHERE id = :job_id AND beacon_id = :beacon_id
                """),
                {
                    "job_id": result.job_id,
                    "beacon_id": result.beacon_id,
                    "status": result.status.value,
                    "output": result.output,
                    "error": result.error,
                    "exit_code": result.exit_code,
                    "started_at": result.started_at,
                    "completed_at": result.completed_at or datetime.utcnow()
                }
            )
            
            # Store detailed result
            conn.execute(
                text("""
                    INSERT INTO beacon_job_results (job_id, beacon_id, output_type, output_data, output_size)
                    VALUES (:job_id, :beacon_id, 'text', :output_data, :output_size)
                """),
                {
                    "job_id": result.job_id,
                    "beacon_id": result.beacon_id,
                    "output_data": result.output,
                    "output_size": len(result.output) if result.output else 0
                }
            )
            
            # Log the result
            conn.execute(
                text("""
                    INSERT INTO beacon_activity_log (beacon_id, activity_type, details, ip_address)
                    VALUES (:beacon_id, 'job_completed', :details, :ip_address)
                """),
                {
                    "beacon_id": result.beacon_id,
                    "details": f'{{"job_id": "{result.job_id}", "status": "{result.status.value}", "exit_code": {result.exit_code or 0}}}',
                    "ip_address": request.client.host if request.client else None
                }
            )
            
            conn.commit()
            
            logger.info(f"Job result received: {result.job_id} - {result.status.value}")
            
            return {"status": "ok", "job_id": result.job_id}
            
    except Exception as e:
        logger.exception(f"Failed to submit job result: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to submit result: {e}")


# =============================================================================
# Beacon Management Endpoints (Used by operators via UI)
# =============================================================================

@router.get("/", response_model=List[Beacon])
async def list_beacons(
    status: Optional[str] = None,
    domain: Optional[str] = None,
    storage: PostgresReportStorage = Depends(get_storage)
):
    """Get all beacons with optional filtering."""
    try:
        with storage.get_connection() as conn:
            query = "SELECT * FROM v_beacon_dashboard WHERE 1=1"
            params = {}
            
            if status:
                query += " AND computed_status = :status"
                params["status"] = status
            
            if domain:
                query += " AND domain = :domain"
                params["domain"] = domain
            
            query += " ORDER BY last_seen DESC"
            
            result = conn.execute(text(query), params)
            
            beacons = []
            for row in result:
                beacons.append(Beacon(
                    id=str(row.id),
                    beacon_id=row.beacon_id,
                    hostname=row.hostname,
                    internal_ip=row.internal_ip,
                    external_ip=row.external_ip,
                    os_info=row.os_info,
                    username=row.username,
                    domain=row.domain,
                    status=BeaconStatus(row.status),
                    computed_status=row.computed_status,
                    last_seen=row.last_seen,
                    first_seen=row.first_seen,
                    check_in_count=row.check_in_count,
                    sleep_interval=row.sleep_interval,
                    jitter_percent=row.jitter_percent,
                    tags=row.tags or [],
                    notes=row.notes,
                    pending_jobs=row.pending_jobs or 0,
                    completed_jobs=row.completed_jobs or 0,
                    failed_jobs=row.failed_jobs or 0,
                    last_job_time=row.last_job_time
                ))
            
            return beacons
            
    except Exception as e:
        logger.exception(f"Failed to list beacons: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to list beacons: {e}")


@router.get("/stats", response_model=BeaconDashboardStats)
async def get_beacon_stats(storage: PostgresReportStorage = Depends(get_storage)):
    """Get beacon dashboard statistics."""
    try:
        with storage.get_connection() as conn:
            # Get beacon counts by computed status
            beacon_stats = conn.execute(text("""
                SELECT 
                    COUNT(*) as total,
                    COUNT(*) FILTER (WHERE computed_status = 'active') as active,
                    COUNT(*) FILTER (WHERE computed_status = 'dormant') as dormant,
                    COUNT(*) FILTER (WHERE computed_status = 'dead') as dead
                FROM v_beacon_dashboard
            """)).fetchone()
            
            # Get job statistics
            job_stats = conn.execute(text("""
                SELECT
                    COUNT(*) FILTER (WHERE status = 'pending') as pending,
                    COUNT(*) FILTER (WHERE status = 'running' OR status = 'sent') as running,
                    COUNT(*) FILTER (WHERE status = 'completed' AND completed_at > NOW() - INTERVAL '24 hours') as completed_24h,
                    COUNT(*) FILTER (WHERE status = 'failed' AND completed_at > NOW() - INTERVAL '24 hours') as failed_24h
                FROM beacon_jobs
            """)).fetchone()
            
            return BeaconDashboardStats(
                total_beacons=beacon_stats.total or 0,
                active_beacons=beacon_stats.active or 0,
                dormant_beacons=beacon_stats.dormant or 0,
                dead_beacons=beacon_stats.dead or 0,
                pending_jobs=job_stats.pending or 0,
                running_jobs=job_stats.running or 0,
                completed_jobs_24h=job_stats.completed_24h or 0,
                failed_jobs_24h=job_stats.failed_24h or 0
            )
            
    except Exception as e:
        logger.exception(f"Failed to get beacon stats: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to get stats: {e}")


@router.get("/{beacon_id}", response_model=Beacon)
async def get_beacon(beacon_id: str, storage: PostgresReportStorage = Depends(get_storage)):
    """Get a specific beacon by ID."""
    try:
        with storage.get_connection() as conn:
            result = conn.execute(
                text("SELECT * FROM v_beacon_dashboard WHERE beacon_id = :beacon_id"),
                {"beacon_id": beacon_id}
            ).fetchone()
            
            if not result:
                raise HTTPException(status_code=404, detail="Beacon not found")
            
            return Beacon(
                id=str(result.id),
                beacon_id=result.beacon_id,
                hostname=result.hostname,
                internal_ip=result.internal_ip,
                external_ip=result.external_ip,
                os_info=result.os_info,
                username=result.username,
                domain=result.domain,
                status=BeaconStatus(result.status),
                computed_status=result.computed_status,
                last_seen=result.last_seen,
                first_seen=result.first_seen,
                check_in_count=result.check_in_count,
                sleep_interval=result.sleep_interval,
                jitter_percent=result.jitter_percent,
                tags=result.tags or [],
                notes=result.notes,
                pending_jobs=result.pending_jobs or 0,
                completed_jobs=result.completed_jobs or 0,
                failed_jobs=result.failed_jobs or 0,
                last_job_time=result.last_job_time
            )
            
    except HTTPException:
        raise
    except Exception as e:
        logger.exception(f"Failed to get beacon: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to get beacon: {e}")


@router.patch("/{beacon_id}")
async def update_beacon(
    beacon_id: str,
    updates: Dict[str, Any],
    storage: PostgresReportStorage = Depends(get_storage)
):
    """Update beacon configuration (sleep interval, jitter, tags, notes, status)."""
    try:
        allowed_fields = {"sleep_interval", "jitter_percent", "tags", "notes", "status"}
        filtered_updates = {k: v for k, v in updates.items() if k in allowed_fields}
        
        if not filtered_updates:
            raise HTTPException(status_code=400, detail="No valid fields to update")
        
        with storage.get_connection() as conn:
            set_clauses = []
            params = {"beacon_id": beacon_id}
            
            for field, value in filtered_updates.items():
                set_clauses.append(f"{field} = :{field}")
                params[field] = value
            
            set_clauses.append("updated_at = NOW()")
            
            query = f"UPDATE beacons SET {', '.join(set_clauses)} WHERE beacon_id = :beacon_id"
            result = conn.execute(text(query), params)
            conn.commit()
            
            if result.rowcount == 0:
                raise HTTPException(status_code=404, detail="Beacon not found")
            
            logger.info(f"Beacon {beacon_id} updated: {filtered_updates}")
            
            return {"status": "ok", "beacon_id": beacon_id, "updates": filtered_updates}
            
    except HTTPException:
        raise
    except Exception as e:
        logger.exception(f"Failed to update beacon: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to update beacon: {e}")


@router.delete("/{beacon_id}")
async def kill_beacon(beacon_id: str, storage: PostgresReportStorage = Depends(get_storage)):
    """Mark a beacon as killed (soft delete)."""
    try:
        with storage.get_connection() as conn:
            result = conn.execute(
                text("UPDATE beacons SET status = 'killed', updated_at = NOW() WHERE beacon_id = :beacon_id"),
                {"beacon_id": beacon_id}
            )
            conn.commit()
            
            if result.rowcount == 0:
                raise HTTPException(status_code=404, detail="Beacon not found")
            
            logger.info(f"Beacon {beacon_id} marked as killed")
            
            return {"status": "ok", "beacon_id": beacon_id, "action": "killed"}
            
    except HTTPException:
        raise
    except Exception as e:
        logger.exception(f"Failed to kill beacon: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to kill beacon: {e}")


# =============================================================================
# Job Management Endpoints
# =============================================================================

@router.post("/jobs", response_model=BeaconJob)
async def create_job(
    job: BeaconJobCreate,
    storage: PostgresReportStorage = Depends(get_storage)
):
    """Create a new job for a beacon."""
    try:
        with storage.get_connection() as conn:
            # Verify beacon exists
            beacon = conn.execute(
                text("SELECT beacon_id FROM beacons WHERE beacon_id = :beacon_id"),
                {"beacon_id": job.beacon_id}
            ).fetchone()
            
            if not beacon:
                raise HTTPException(status_code=404, detail="Beacon not found")
            
            # Create job
            result = conn.execute(
                text("""
                    INSERT INTO beacon_jobs (beacon_id, job_type, command, parameters, priority, notes, created_by)
                    VALUES (:beacon_id, :job_type, :command, :parameters, :priority, :notes, 'operator')
                    RETURNING id, created_at
                """),
                {
                    "beacon_id": job.beacon_id,
                    "job_type": job.job_type.value,
                    "command": job.command,
                    "parameters": str(job.parameters) if job.parameters else "{}",
                    "priority": job.priority,
                    "notes": job.notes
                }
            )
            row = result.fetchone()
            conn.commit()
            
            logger.info(f"Job created: {row.id} for beacon {job.beacon_id}")
            
            return BeaconJob(
                id=str(row.id),
                beacon_id=job.beacon_id,
                job_type=job.job_type,
                command=job.command,
                parameters=job.parameters,
                priority=job.priority,
                notes=job.notes,
                status=JobStatus.PENDING,
                created_at=row.created_at
            )
            
    except HTTPException:
        raise
    except Exception as e:
        logger.exception(f"Failed to create job: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to create job: {e}")


@router.post("/jobs/bulk")
async def create_bulk_jobs(
    bulk_job: BulkJobCreate,
    storage: PostgresReportStorage = Depends(get_storage)
):
    """Create jobs for multiple beacons at once."""
    try:
        results = []
        
        with storage.get_connection() as conn:
            for beacon_id in bulk_job.beacon_ids:
                # Verify beacon exists
                beacon = conn.execute(
                    text("SELECT beacon_id FROM beacons WHERE beacon_id = :beacon_id"),
                    {"beacon_id": beacon_id}
                ).fetchone()
                
                if not beacon:
                    results.append({"beacon_id": beacon_id, "status": "error", "error": "Beacon not found"})
                    continue
                
                # Create job
                result = conn.execute(
                    text("""
                        INSERT INTO beacon_jobs (beacon_id, job_type, command, parameters, priority, notes, created_by)
                        VALUES (:beacon_id, :job_type, :command, :parameters, :priority, :notes, 'operator')
                        RETURNING id
                    """),
                    {
                        "beacon_id": beacon_id,
                        "job_type": bulk_job.job_type.value,
                        "command": bulk_job.command,
                        "parameters": str(bulk_job.parameters) if bulk_job.parameters else "{}",
                        "priority": bulk_job.priority,
                        "notes": bulk_job.notes
                    }
                )
                row = result.fetchone()
                results.append({"beacon_id": beacon_id, "status": "ok", "job_id": str(row.id)})
            
            conn.commit()
        
        success_count = sum(1 for r in results if r["status"] == "ok")
        logger.info(f"Bulk job created: {success_count}/{len(bulk_job.beacon_ids)} beacons")
        
        return {
            "status": "ok",
            "total": len(bulk_job.beacon_ids),
            "success": success_count,
            "failed": len(bulk_job.beacon_ids) - success_count,
            "results": results
        }
        
    except Exception as e:
        logger.exception(f"Failed to create bulk jobs: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to create bulk jobs: {e}")


@router.get("/jobs/all", response_model=List[BeaconJob])
async def list_all_jobs(
    status: Optional[str] = None,
    limit: int = 100,
    storage: PostgresReportStorage = Depends(get_storage)
):
    """Get all jobs across all beacons."""
    try:
        with storage.get_connection() as conn:
            query = """
                SELECT j.*, b.hostname
                FROM beacon_jobs j
                JOIN beacons b ON j.beacon_id = b.beacon_id
                WHERE 1=1
            """
            params = {"limit": limit}
            
            if status:
                query += " AND j.status = :status"
                params["status"] = status
            
            query += " ORDER BY j.created_at DESC LIMIT :limit"
            
            result = conn.execute(text(query), params)
            
            jobs = []
            for row in result:
                jobs.append(BeaconJob(
                    id=str(row.id),
                    beacon_id=row.beacon_id,
                    job_type=JobType(row.job_type),
                    command=row.command,
                    parameters=row.parameters or {},
                    status=JobStatus(row.status),
                    priority=row.priority,
                    created_at=row.created_at,
                    sent_at=row.sent_at,
                    started_at=row.started_at,
                    completed_at=row.completed_at,
                    result_output=row.result_output,
                    result_error=row.result_error,
                    exit_code=row.exit_code,
                    notes=row.notes
                ))
            
            return jobs
            
    except Exception as e:
        logger.exception(f"Failed to list jobs: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to list jobs: {e}")


@router.get("/{beacon_id}/jobs", response_model=List[BeaconJob])
async def list_beacon_jobs(
    beacon_id: str,
    status: Optional[str] = None,
    limit: int = 50,
    storage: PostgresReportStorage = Depends(get_storage)
):
    """Get all jobs for a specific beacon."""
    try:
        with storage.get_connection() as conn:
            query = "SELECT * FROM beacon_jobs WHERE beacon_id = :beacon_id"
            params = {"beacon_id": beacon_id, "limit": limit}
            
            if status:
                query += " AND status = :status"
                params["status"] = status
            
            query += " ORDER BY created_at DESC LIMIT :limit"
            
            result = conn.execute(text(query), params)
            
            jobs = []
            for row in result:
                jobs.append(BeaconJob(
                    id=str(row.id),
                    beacon_id=row.beacon_id,
                    job_type=JobType(row.job_type),
                    command=row.command,
                    parameters=row.parameters or {},
                    status=JobStatus(row.status),
                    priority=row.priority,
                    created_at=row.created_at,
                    sent_at=row.sent_at,
                    started_at=row.started_at,
                    completed_at=row.completed_at,
                    result_output=row.result_output,
                    result_error=row.result_error,
                    exit_code=row.exit_code,
                    notes=row.notes
                ))
            
            return jobs
            
    except Exception as e:
        logger.exception(f"Failed to list beacon jobs: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to list jobs: {e}")


@router.get("/jobs/{job_id}")
async def get_job(job_id: str, storage: PostgresReportStorage = Depends(get_storage)):
    """Get a specific job with full details including results."""
    try:
        with storage.get_connection() as conn:
            job = conn.execute(
                text("""
                    SELECT j.*, b.hostname
                    FROM beacon_jobs j
                    JOIN beacons b ON j.beacon_id = b.beacon_id
                    WHERE j.id = :job_id
                """),
                {"job_id": job_id}
            ).fetchone()
            
            if not job:
                raise HTTPException(status_code=404, detail="Job not found")
            
            # Get detailed results
            results = conn.execute(
                text("SELECT * FROM beacon_job_results WHERE job_id = :job_id ORDER BY received_at DESC"),
                {"job_id": job_id}
            ).fetchall()
            
            return {
                "job": {
                    "id": str(job.id),
                    "beacon_id": job.beacon_id,
                    "hostname": job.hostname,
                    "job_type": job.job_type,
                    "command": job.command,
                    "parameters": job.parameters,
                    "status": job.status,
                    "priority": job.priority,
                    "created_at": job.created_at.isoformat() if job.created_at else None,
                    "sent_at": job.sent_at.isoformat() if job.sent_at else None,
                    "started_at": job.started_at.isoformat() if job.started_at else None,
                    "completed_at": job.completed_at.isoformat() if job.completed_at else None,
                    "result_output": job.result_output,
                    "result_error": job.result_error,
                    "exit_code": job.exit_code,
                    "notes": job.notes
                },
                "results": [
                    {
                        "id": str(r.id),
                        "output_type": r.output_type,
                        "output_data": r.output_data,
                        "output_size": r.output_size,
                        "received_at": r.received_at.isoformat() if r.received_at else None
                    }
                    for r in results
                ]
            }
            
    except HTTPException:
        raise
    except Exception as e:
        logger.exception(f"Failed to get job: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to get job: {e}")


@router.delete("/jobs/{job_id}")
async def cancel_job(job_id: str, storage: PostgresReportStorage = Depends(get_storage)):
    """Cancel a pending job."""
    try:
        with storage.get_connection() as conn:
            result = conn.execute(
                text("""
                    UPDATE beacon_jobs 
                    SET status = 'cancelled' 
                    WHERE id = :job_id AND status = 'pending'
                """),
                {"job_id": job_id}
            )
            conn.commit()
            
            if result.rowcount == 0:
                raise HTTPException(status_code=400, detail="Job not found or not in pending state")
            
            logger.info(f"Job {job_id} cancelled")
            
            return {"status": "ok", "job_id": job_id, "action": "cancelled"}
            
    except HTTPException:
        raise
    except Exception as e:
        logger.exception(f"Failed to cancel job: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to cancel job: {e}")


# =============================================================================
# Task Templates Endpoints
# =============================================================================

@router.get("/templates/all", response_model=List[TaskTemplate])
async def list_task_templates(storage: PostgresReportStorage = Depends(get_storage)):
    """Get all available task templates."""
    try:
        with storage.get_connection() as conn:
            result = conn.execute(text("SELECT * FROM beacon_task_templates ORDER BY name"))
            
            templates = []
            for row in result:
                templates.append(TaskTemplate(
                    id=str(row.id),
                    name=row.name,
                    description=row.description,
                    job_type=JobType(row.job_type),
                    command=row.command,
                    parameters=row.parameters or {},
                    icon=row.icon,
                    is_dangerous=row.is_dangerous
                ))
            
            return templates
            
    except Exception as e:
        logger.exception(f"Failed to list templates: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to list templates: {e}")


@router.post("/templates")
async def create_task_template(
    template: TaskTemplate,
    storage: PostgresReportStorage = Depends(get_storage)
):
    """Create a new task template."""
    try:
        with storage.get_connection() as conn:
            result = conn.execute(
                text("""
                    INSERT INTO beacon_task_templates (name, description, job_type, command, parameters, icon, is_dangerous)
                    VALUES (:name, :description, :job_type, :command, :parameters, :icon, :is_dangerous)
                    RETURNING id
                """),
                {
                    "name": template.name,
                    "description": template.description,
                    "job_type": template.job_type.value,
                    "command": template.command,
                    "parameters": str(template.parameters) if template.parameters else "{}",
                    "icon": template.icon,
                    "is_dangerous": template.is_dangerous
                }
            )
            template_id = result.scalar()
            conn.commit()
            
            logger.info(f"Task template created: {template.name}")
            
            return {"status": "ok", "template_id": str(template_id)}
            
    except Exception as e:
        logger.exception(f"Failed to create template: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to create template: {e}")


# =============================================================================
# Activity Log Endpoints
# =============================================================================

@router.get("/{beacon_id}/activity", response_model=List[BeaconActivityLog])
async def get_beacon_activity(
    beacon_id: str,
    limit: int = 100,
    storage: PostgresReportStorage = Depends(get_storage)
):
    """Get activity log for a specific beacon."""
    try:
        with storage.get_connection() as conn:
            result = conn.execute(
                text("""
                    SELECT * FROM beacon_activity_log 
                    WHERE beacon_id = :beacon_id 
                    ORDER BY created_at DESC 
                    LIMIT :limit
                """),
                {"beacon_id": beacon_id, "limit": limit}
            )
            
            activities = []
            for row in result:
                activities.append(BeaconActivityLog(
                    id=str(row.id),
                    beacon_id=row.beacon_id,
                    activity_type=row.activity_type,
                    details=row.details or {},
                    ip_address=row.ip_address,
                    created_at=row.created_at
                ))
            
            return activities
            
    except Exception as e:
        logger.exception(f"Failed to get beacon activity: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to get activity: {e}")


@router.get("/activity/all")
async def get_all_activity(
    limit: int = 100,
    storage: PostgresReportStorage = Depends(get_storage)
):
    """Get global activity log."""
    try:
        with storage.get_connection() as conn:
            result = conn.execute(
                text("""
                    SELECT a.*, b.hostname
                    FROM beacon_activity_log a
                    LEFT JOIN beacons b ON a.beacon_id = b.beacon_id
                    ORDER BY a.created_at DESC 
                    LIMIT :limit
                """),
                {"limit": limit}
            )
            
            activities = []
            for row in result:
                activities.append({
                    "id": str(row.id),
                    "beacon_id": row.beacon_id,
                    "hostname": row.hostname,
                    "activity_type": row.activity_type,
                    "details": row.details or {},
                    "ip_address": row.ip_address,
                    "created_at": row.created_at.isoformat() if row.created_at else None
                })
            
            return {"activities": activities}
            
    except Exception as e:
        logger.exception(f"Failed to get activity: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to get activity: {e}")


# =============================================================================
# Scheduled Jobs Endpoints
# =============================================================================

@router.get("/schedules/all")
async def list_scheduled_jobs(
    storage: PostgresReportStorage = Depends(get_storage)
):
    """Get all scheduled jobs."""
    try:
        with storage.get_connection() as conn:
            result = conn.execute(text("""
                SELECT * FROM v_scheduled_jobs_dashboard
                ORDER BY next_run_at ASC NULLS LAST
            """))
            
            schedules = []
            for row in result:
                schedules.append({
                    "id": str(row.id),
                    "name": row.name,
                    "description": row.description,
                    "beacon_id": row.beacon_id,
                    "target_filter": row.target_filter or {},
                    "job_type": row.job_type,
                    "schedule_type": row.schedule_type,
                    "schedule_value": row.schedule_value,
                    "next_run_at": row.next_run_at.isoformat() if row.next_run_at else None,
                    "last_run_at": row.last_run_at.isoformat() if row.last_run_at else None,
                    "is_enabled": row.is_enabled,
                    "run_count": row.run_count,
                    "last_run_status": row.last_run_status,
                    "created_by": row.created_by,
                    "created_at": row.created_at.isoformat() if row.created_at else None,
                    "target_hostname": row.target_hostname,
                    "total_jobs_created": row.total_jobs_created,
                    "successful_runs": row.successful_runs
                })
            
            return {"schedules": schedules}
            
    except Exception as e:
        logger.exception(f"Failed to list schedules: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to list schedules: {e}")


@router.post("/schedules")
async def create_scheduled_job(
    request: Request,
    storage: PostgresReportStorage = Depends(get_storage)
):
    """Create a new scheduled job."""
    try:
        data = await request.json()
        
        # Calculate initial next_run_at based on schedule_type
        schedule_type = data.get("schedule_type", "once")
        next_run = None
        
        if schedule_type == "once":
            # Run in 1 minute for one-time jobs
            next_run = datetime.now() + timedelta(minutes=1)
        elif schedule_type == "hourly":
            next_run = datetime.now() + timedelta(hours=1)
        elif schedule_type == "daily":
            next_run = datetime.now() + timedelta(days=1)
        elif schedule_type == "weekly":
            next_run = datetime.now() + timedelta(weeks=1)
        
        with storage.get_connection() as conn:
            result = conn.execute(
                text("""
                    INSERT INTO beacon_scheduled_jobs 
                    (name, description, beacon_id, target_filter, job_type, command, parameters, 
                     schedule_type, schedule_value, next_run_at, created_by)
                    VALUES (:name, :description, :beacon_id, :target_filter, :job_type, :command, 
                            :parameters, :schedule_type, :schedule_value, :next_run_at, :created_by)
                    RETURNING id
                """),
                {
                    "name": data.get("name"),
                    "description": data.get("description"),
                    "beacon_id": data.get("beacon_id"),  # None = all beacons
                    "target_filter": json.dumps(data.get("target_filter", {})),
                    "job_type": data.get("job_type"),
                    "command": data.get("command"),
                    "parameters": json.dumps(data.get("parameters", {})),
                    "schedule_type": schedule_type,
                    "schedule_value": data.get("schedule_value"),
                    "next_run_at": next_run,
                    "created_by": "api"
                }
            )
            schedule_id = result.scalar()
            conn.commit()
            
            logger.info(f"Created scheduled job: {data.get('name')} ({schedule_id})")
            
            return {"status": "ok", "schedule_id": str(schedule_id)}
            
    except Exception as e:
        logger.exception(f"Failed to create schedule: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to create schedule: {e}")


@router.patch("/schedules/{schedule_id}")
async def update_scheduled_job(
    schedule_id: str,
    request: Request,
    storage: PostgresReportStorage = Depends(get_storage)
):
    """Update a scheduled job (enable/disable, update schedule)."""
    try:
        data = await request.json()
        
        with storage.get_connection() as conn:
            # Build dynamic update
            updates = []
            params = {"schedule_id": schedule_id}
            
            if "is_enabled" in data:
                updates.append("is_enabled = :is_enabled")
                params["is_enabled"] = data["is_enabled"]
            
            if "schedule_type" in data:
                updates.append("schedule_type = :schedule_type")
                params["schedule_type"] = data["schedule_type"]
            
            if "schedule_value" in data:
                updates.append("schedule_value = :schedule_value")
                params["schedule_value"] = data["schedule_value"]
            
            if "name" in data:
                updates.append("name = :name")
                params["name"] = data["name"]
            
            if updates:
                updates.append("updated_at = NOW()")
                conn.execute(
                    text(f"UPDATE beacon_scheduled_jobs SET {', '.join(updates)} WHERE id = :schedule_id"),
                    params
                )
                conn.commit()
            
            return {"status": "ok", "schedule_id": schedule_id}
            
    except Exception as e:
        logger.exception(f"Failed to update schedule: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to update schedule: {e}")


@router.delete("/schedules/{schedule_id}")
async def delete_scheduled_job(
    schedule_id: str,
    storage: PostgresReportStorage = Depends(get_storage)
):
    """Delete a scheduled job."""
    try:
        with storage.get_connection() as conn:
            conn.execute(
                text("DELETE FROM beacon_scheduled_jobs WHERE id = :schedule_id"),
                {"schedule_id": schedule_id}
            )
            conn.commit()
            
            return {"status": "ok", "action": "deleted", "schedule_id": schedule_id}
            
    except Exception as e:
        logger.exception(f"Failed to delete schedule: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to delete schedule: {e}")


@router.post("/schedules/{schedule_id}/run")
async def run_scheduled_job_now(
    schedule_id: str,
    storage: PostgresReportStorage = Depends(get_storage)
):
    """Manually trigger a scheduled job to run now."""
    try:
        with storage.get_connection() as conn:
            # Get the schedule
            schedule = conn.execute(
                text("SELECT * FROM beacon_scheduled_jobs WHERE id = :schedule_id"),
                {"schedule_id": schedule_id}
            ).fetchone()
            
            if not schedule:
                raise HTTPException(status_code=404, detail="Schedule not found")
            
            # Get target beacons
            if schedule.beacon_id:
                # Specific beacon
                beacon_ids = [schedule.beacon_id]
            else:
                # All active beacons
                result = conn.execute(
                    text("SELECT beacon_id FROM v_beacon_dashboard WHERE computed_status = 'active'")
                )
                beacon_ids = [row.beacon_id for row in result]
            
            # Create jobs for each beacon
            jobs_created = 0
            for beacon_id in beacon_ids:
                conn.execute(
                    text("""
                        INSERT INTO beacon_jobs (beacon_id, job_type, command, parameters, schedule_id, created_by)
                        VALUES (:beacon_id, :job_type, :command, :parameters, :schedule_id, 'scheduler')
                    """),
                    {
                        "beacon_id": beacon_id,
                        "job_type": schedule.job_type,
                        "command": schedule.command,
                        "parameters": json.dumps(schedule.parameters or {}),
                        "schedule_id": schedule_id
                    }
                )
                jobs_created += 1
            
            # Update schedule
            conn.execute(
                text("""
                    UPDATE beacon_scheduled_jobs 
                    SET last_run_at = NOW(), 
                        run_count = run_count + 1,
                        next_run_at = calculate_next_run(schedule_type, schedule_value, NOW())
                    WHERE id = :schedule_id
                """),
                {"schedule_id": schedule_id}
            )
            
            conn.commit()
            
            return {
                "status": "ok",
                "schedule_id": schedule_id,
                "jobs_created": jobs_created,
                "beacon_ids": beacon_ids
            }
            
    except HTTPException:
        raise
    except Exception as e:
        logger.exception(f"Failed to run schedule: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to run schedule: {e}")
