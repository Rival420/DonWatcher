#!/usr/bin/env python3
"""
DonWatcher Beacon Agent v1.0

A lightweight agent that beacons home to the DonWatcher C2 server,
receives jobs, executes them, and reports results.

This is designed for blue team operations - running security scans
on remote systems under your control.

Usage:
    python beacon.py --server http://donwatcher:8080 --sleep 60 --jitter 10

    Or with config file:
    python beacon.py --config beacon.json

Author: DonWatcher Security Team
"""

import argparse
import hashlib
import json
import os
import platform
import random
import socket
import subprocess
import sys
import time
import uuid
from datetime import datetime
from pathlib import Path
from typing import Dict, Any, Optional, List
from urllib.parse import urljoin

# Try to import requests, fall back to urllib if not available
try:
    import requests
    HAS_REQUESTS = True
except ImportError:
    import urllib.request
    import urllib.error
    HAS_REQUESTS = False


# =============================================================================
# Configuration
# =============================================================================

# EMBEDDED_CONFIG is replaced at build time with actual values
# This allows the compiled executable to work without any config files
# Format: JSON string or None for default
EMBEDDED_CONFIG = None  # <<<EMBED_CONFIG_HERE>>>

DEFAULT_CONFIG = {
    "server_url": "http://localhost:8080",
    "sleep_interval": 60,
    "jitter_percent": 10,
    "verify_ssl": True,
    "debug": False,
    "auto_upload": True  # Auto-upload scan results to DonWatcher
}

def get_embedded_config() -> Optional[Dict[str, Any]]:
    """Get embedded configuration if available."""
    global EMBEDDED_CONFIG
    if EMBEDDED_CONFIG is not None:
        try:
            if isinstance(EMBEDDED_CONFIG, str):
                return json.loads(EMBEDDED_CONFIG)
            return EMBEDDED_CONFIG
        except:
            pass
    return None

# Built-in PowerShell scripts (embedded for portability)
BUILTIN_SCRIPTS = {
    "domain_scan": """
#Requires -Modules ActiveDirectory
$ErrorActionPreference = "Stop"

function Get-DomainInfo {
    $domain = Get-ADDomain -ErrorAction Stop
    return @{
        DomainName = $domain.DNSRoot
        DomainSID  = $domain.DomainSID.Value
    }
}

function Get-GroupMemberships {
    param([string[]]$Groups)
    
    $result = @()
    foreach ($groupName in $Groups) {
        try {
            $adGroup = Get-ADGroup -Identity $groupName -ErrorAction SilentlyContinue
            if (-not $adGroup) { continue }
            
            $members = @()
            $groupMembers = Get-ADGroupMember -Identity $groupName -Recursive -ErrorAction SilentlyContinue
            
            foreach ($m in $groupMembers) {
                try {
                    $obj = Get-ADObject -Identity $m.DistinguishedName -Properties Name, sAMAccountName, objectSID, objectClass -ErrorAction SilentlyContinue
                    if ($obj) {
                        $members += @{
                            name = [string]$obj.Name
                            samaccountname = [string]$obj.sAMAccountName
                            sid = if ($obj.objectSID) { [string]$obj.objectSID.Value } else { "" }
                            type = [string]$obj.objectClass
                        }
                    }
                } catch { }
            }
            
            $result += @{
                group_name = $groupName
                members = $members
            }
        } catch { }
    }
    return $result
}

$privilegedGroups = @(
    "Domain Admins", "Enterprise Admins", "Schema Admins", "Administrators",
    "Account Operators", "Backup Operators", "Server Operators", "Print Operators"
)

$domainInfo = Get-DomainInfo
$groups = Get-GroupMemberships -Groups $privilegedGroups

@{
    domain = $domainInfo.DomainName
    domain_sid = $domainInfo.DomainSID
    groups = $groups
    timestamp = (Get-Date).ToString("o")
} | ConvertTo-Json -Depth 10
""",
    "system_info": """
$info = @{
    hostname = $env:COMPUTERNAME
    domain = $env:USERDOMAIN
    username = $env:USERNAME
    os = (Get-CimInstance Win32_OperatingSystem).Caption
    os_version = (Get-CimInstance Win32_OperatingSystem).Version
    architecture = $env:PROCESSOR_ARCHITECTURE
    ip_addresses = (Get-NetIPAddress -AddressFamily IPv4 | Where-Object { $_.InterfaceAlias -notmatch 'Loopback' }).IPAddress
    uptime_hours = [math]::Round(((Get-Date) - (Get-CimInstance Win32_OperatingSystem).LastBootUpTime).TotalHours, 2)
    timestamp = (Get-Date).ToString("o")
}
$info | ConvertTo-Json -Depth 5
"""
}


# =============================================================================
# Beacon Class
# =============================================================================

class DonWatcherBeacon:
    """DonWatcher Beacon Agent."""
    
    VERSION = "1.0.0"
    
    def __init__(self, config: Dict[str, Any]):
        self.config = {**DEFAULT_CONFIG, **config}
        self.server_url = self.config["server_url"].rstrip("/")
        self.sleep_interval = self.config["sleep_interval"]
        self.jitter_percent = self.config["jitter_percent"]
        self.debug = self.config.get("debug", False)
        
        # Generate unique beacon ID based on machine characteristics
        self.beacon_id = self._generate_beacon_id()
        
        # Collect system information
        self.system_info = self._collect_system_info()
        
        self._running = False
        
    def _generate_beacon_id(self) -> str:
        """Generate a unique beacon ID based on machine characteristics."""
        # Use a combination of hostname and MAC address for uniqueness
        hostname = socket.gethostname()
        
        # Try to get MAC address
        try:
            mac = uuid.getnode()
            mac_str = ':'.join(('%012x' % mac)[i:i+2] for i in range(0, 12, 2))
        except:
            mac_str = "unknown"
        
        # Create a hash-based ID
        unique_string = f"{hostname}-{mac_str}-{platform.system()}"
        beacon_id = hashlib.sha256(unique_string.encode()).hexdigest()[:16]
        
        return f"BEACON-{beacon_id.upper()}"
    
    def _collect_system_info(self) -> Dict[str, Any]:
        """Collect system information for check-in."""
        info = {
            "hostname": socket.gethostname(),
            "os_info": f"{platform.system()} {platform.release()}",
            "os_version": platform.version(),
            "architecture": platform.machine(),
            "username": os.getenv("USERNAME") or os.getenv("USER") or "unknown",
            "process_name": sys.executable,
            "process_id": os.getpid(),
            "beacon_version": self.VERSION
        }
        
        # Try to get domain (Windows)
        try:
            info["domain"] = os.environ.get("USERDOMAIN", "WORKGROUP")
        except:
            info["domain"] = "WORKGROUP"
        
        # Try to get internal IP
        try:
            s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
            s.connect(("8.8.8.8", 80))
            info["internal_ip"] = s.getsockname()[0]
            s.close()
        except:
            info["internal_ip"] = "127.0.0.1"
        
        return info
    
    def _log(self, message: str, level: str = "INFO"):
        """Log a message."""
        timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        print(f"[{timestamp}] [{level}] {message}")
    
    def _debug(self, message: str):
        """Log debug message."""
        if self.debug:
            self._log(message, "DEBUG")
    
    def _http_request(self, endpoint: str, method: str = "GET", data: Dict = None) -> Optional[Dict]:
        """Make HTTP request to C2 server."""
        url = urljoin(self.server_url, endpoint)
        
        if HAS_REQUESTS:
            try:
                if method == "POST":
                    response = requests.post(
                        url,
                        json=data,
                        timeout=30,
                        verify=self.config.get("verify_ssl", True)
                    )
                else:
                    response = requests.get(
                        url,
                        timeout=30,
                        verify=self.config.get("verify_ssl", True)
                    )
                
                response.raise_for_status()
                return response.json()
            except requests.exceptions.RequestException as e:
                self._log(f"HTTP request failed: {e}", "ERROR")
                return None
        else:
            # Fallback to urllib
            try:
                if method == "POST" and data:
                    req = urllib.request.Request(
                        url,
                        data=json.dumps(data).encode(),
                        headers={"Content-Type": "application/json"},
                        method="POST"
                    )
                else:
                    req = urllib.request.Request(url)
                
                with urllib.request.urlopen(req, timeout=30) as response:
                    return json.loads(response.read().decode())
            except (urllib.error.URLError, json.JSONDecodeError) as e:
                self._log(f"HTTP request failed: {e}", "ERROR")
                return None
    
    def checkin(self) -> Optional[Dict]:
        """Check in with C2 server and get pending jobs."""
        self._debug(f"Checking in to {self.server_url}")
        
        checkin_data = {
            "beacon_id": self.beacon_id,
            **self.system_info
        }
        
        response = self._http_request("/api/beacons/checkin", "POST", checkin_data)
        
        if response:
            # Update sleep settings from server
            if "sleep_interval" in response:
                self.sleep_interval = response["sleep_interval"]
            if "jitter_percent" in response:
                self.jitter_percent = response["jitter_percent"]
            
            self._debug(f"Check-in successful. Jobs: {len(response.get('jobs', []))}")
            
        return response
    
    def submit_result(self, job_id: str, status: str, output: str = None, 
                      error: str = None, exit_code: int = None) -> bool:
        """Submit job result to C2 server."""
        result_data = {
            "job_id": job_id,
            "beacon_id": self.beacon_id,
            "status": status,
            "output": output,
            "error": error,
            "exit_code": exit_code,
            "completed_at": datetime.utcnow().isoformat()
        }
        
        response = self._http_request("/api/beacons/result", "POST", result_data)
        return response is not None
    
    def execute_job(self, job: Dict[str, Any]) -> Dict[str, Any]:
        """Execute a job and return results."""
        job_id = job.get("id")
        job_type = job.get("job_type")
        command = job.get("command", "")
        parameters = job.get("parameters", {})
        
        self._log(f"Executing job {job_id}: {job_type}")
        
        result = {
            "status": "completed",
            "output": None,
            "error": None,
            "exit_code": 0
        }
        
        try:
            if job_type == "domain_scan":
                result = self._execute_domain_scan(parameters)
            elif job_type == "vulnerability_scan":
                result = self._execute_vulnerability_scan(parameters)
            elif job_type == "powershell":
                result = self._execute_powershell(command)
            elif job_type == "shell":
                result = self._execute_shell(command)
            else:
                result = {
                    "status": "failed",
                    "output": None,
                    "error": f"Unknown job type: {job_type}",
                    "exit_code": 1
                }
        except Exception as e:
            result = {
                "status": "failed",
                "output": None,
                "error": str(e),
                "exit_code": 1
            }
        
        return result
    
    def _execute_powershell(self, script: str) -> Dict[str, Any]:
        """Execute a PowerShell script."""
        if platform.system() != "Windows":
            # Try pwsh on non-Windows
            powershell_cmd = "pwsh"
        else:
            powershell_cmd = "powershell.exe"
        
        try:
            process = subprocess.run(
                [powershell_cmd, "-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", script],
                capture_output=True,
                text=True,
                timeout=300  # 5 minute timeout
            )
            
            return {
                "status": "completed" if process.returncode == 0 else "failed",
                "output": process.stdout,
                "error": process.stderr if process.stderr else None,
                "exit_code": process.returncode
            }
        except subprocess.TimeoutExpired:
            return {
                "status": "failed",
                "output": None,
                "error": "Command timed out after 5 minutes",
                "exit_code": -1
            }
        except FileNotFoundError:
            return {
                "status": "failed",
                "output": None,
                "error": f"PowerShell not found ({powershell_cmd})",
                "exit_code": -1
            }
    
    def _execute_shell(self, command: str) -> Dict[str, Any]:
        """Execute a shell command."""
        try:
            if platform.system() == "Windows":
                process = subprocess.run(
                    ["cmd.exe", "/c", command],
                    capture_output=True,
                    text=True,
                    timeout=300
                )
            else:
                process = subprocess.run(
                    ["/bin/sh", "-c", command],
                    capture_output=True,
                    text=True,
                    timeout=300
                )
            
            return {
                "status": "completed" if process.returncode == 0 else "failed",
                "output": process.stdout,
                "error": process.stderr if process.stderr else None,
                "exit_code": process.returncode
            }
        except subprocess.TimeoutExpired:
            return {
                "status": "failed",
                "output": None,
                "error": "Command timed out after 5 minutes",
                "exit_code": -1
            }
    
    def _execute_domain_scan(self, parameters: Dict[str, Any]) -> Dict[str, Any]:
        """Execute domain group scan."""
        script = BUILTIN_SCRIPTS["domain_scan"]
        result = self._execute_powershell(script)
        
        # If auto_upload is enabled and scan succeeded, upload to DonWatcher
        if result["status"] == "completed" and parameters.get("auto_upload", True):
            try:
                scan_data = json.loads(result["output"])
                self._upload_domain_scan(scan_data)
            except json.JSONDecodeError:
                self._debug("Failed to parse domain scan output as JSON")
        
        return result
    
    def _execute_vulnerability_scan(self, parameters: Dict[str, Any]) -> Dict[str, Any]:
        """Execute vulnerability scan (requires API token)."""
        api_token = parameters.get("api_token") or os.environ.get("OUTPOST24_TOKEN")
        
        if not api_token:
            return {
                "status": "failed",
                "output": None,
                "error": "No API token provided. Set OUTPOST24_TOKEN environment variable or pass api_token in parameters.",
                "exit_code": 1
            }
        
        # Find the vulnerability scanner script
        script_path = self._find_script("DonWatcher-VulnerabilityScanner.ps1")
        
        if script_path:
            command = f"& '{script_path}' -DonWatcherUrl '{self.server_url}' -ApiToken '{api_token}'"
            if parameters.get("domain"):
                command += f" -Domain '{parameters['domain']}'"
            return self._execute_powershell(command)
        else:
            return {
                "status": "failed",
                "output": None,
                "error": "VulnerabilityScanner script not found",
                "exit_code": 1
            }
    
    def _find_script(self, script_name: str) -> Optional[str]:
        """Find a DonWatcher script in common locations."""
        # Check common locations
        search_paths = [
            Path.cwd() / script_name,
            Path(__file__).parent / script_name,
            Path(__file__).parent.parent / script_name,
            Path.home() / "DonWatcher" / script_name,
            Path("C:/DonWatcher") / script_name,
        ]
        
        for path in search_paths:
            if path.exists():
                return str(path)
        
        return None
    
    def _upload_domain_scan(self, scan_data: Dict[str, Any]) -> bool:
        """Upload domain scan results to DonWatcher."""
        self._debug("Uploading domain scan results")
        
        upload_data = {
            "groups": scan_data.get("groups", []),
            "domain_metadata": {
                "domain_sid": scan_data.get("domain_sid", "")
            }
        }
        
        domain = scan_data.get("domain", "UNKNOWN")
        response = self._http_request(
            f"/api/upload/domain-groups?domain={domain}",
            "POST",
            upload_data
        )
        
        if response:
            self._log(f"Domain scan uploaded: {response.get('report_id', 'unknown')}")
            return True
        
        return False
    
    def _calculate_sleep_with_jitter(self) -> int:
        """Calculate sleep time with jitter."""
        jitter_range = int(self.sleep_interval * (self.jitter_percent / 100))
        jitter = random.randint(-jitter_range, jitter_range)
        return max(5, self.sleep_interval + jitter)  # Minimum 5 seconds
    
    def run(self):
        """Main beacon loop."""
        self._running = True
        
        self._log(f"DonWatcher Beacon v{self.VERSION} starting")
        self._log(f"Beacon ID: {self.beacon_id}")
        self._log(f"Server: {self.server_url}")
        self._log(f"Sleep: {self.sleep_interval}s (+/- {self.jitter_percent}% jitter)")
        self._log(f"System: {self.system_info['os_info']} ({self.system_info['architecture']})")
        self._log(f"User: {self.system_info['username']}@{self.system_info.get('domain', 'WORKGROUP')}")
        
        while self._running:
            try:
                # Check in and get jobs
                response = self.checkin()
                
                if response and response.get("jobs"):
                    for job in response["jobs"]:
                        job_id = job.get("id")
                        self._log(f"Processing job: {job_id}")
                        
                        # Execute job
                        result = self.execute_job(job)
                        
                        # Submit result
                        success = self.submit_result(
                            job_id=job_id,
                            status=result["status"],
                            output=result.get("output"),
                            error=result.get("error"),
                            exit_code=result.get("exit_code")
                        )
                        
                        if success:
                            self._log(f"Job {job_id} completed: {result['status']}")
                        else:
                            self._log(f"Failed to submit result for job {job_id}", "ERROR")
                
            except KeyboardInterrupt:
                self._log("Received interrupt signal, shutting down...")
                self._running = False
                break
            except Exception as e:
                self._log(f"Error in beacon loop: {e}", "ERROR")
            
            # Sleep with jitter
            if self._running:
                sleep_time = self._calculate_sleep_with_jitter()
                self._debug(f"Sleeping for {sleep_time} seconds")
                time.sleep(sleep_time)
        
        self._log("Beacon stopped")
    
    def stop(self):
        """Stop the beacon."""
        self._running = False


# =============================================================================
# Main Entry Point
# =============================================================================

def parse_arguments():
    """Parse command line arguments."""
    parser = argparse.ArgumentParser(
        description="DonWatcher Beacon Agent - Blue Team C2 Agent",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  %(prog)s --server http://donwatcher:8080
  %(prog)s --server https://donwatcher.local --sleep 30 --jitter 20
  %(prog)s --config beacon.json
  
Configuration file format (beacon.json):
  {
    "server_url": "http://donwatcher:8080",
    "sleep_interval": 60,
    "jitter_percent": 10,
    "debug": false
  }
        """
    )
    
    parser.add_argument(
        "--server", "-s",
        help="DonWatcher server URL (e.g., http://donwatcher:8080)"
    )
    parser.add_argument(
        "--sleep", "-i",
        type=int,
        default=60,
        help="Sleep interval in seconds (default: 60)"
    )
    parser.add_argument(
        "--jitter", "-j",
        type=int,
        default=10,
        help="Jitter percentage (default: 10)"
    )
    parser.add_argument(
        "--config", "-c",
        help="Path to configuration file"
    )
    parser.add_argument(
        "--debug", "-d",
        action="store_true",
        help="Enable debug logging"
    )
    parser.add_argument(
        "--no-ssl-verify",
        action="store_true",
        help="Disable SSL certificate verification"
    )
    parser.add_argument(
        "--once",
        action="store_true",
        help="Check in once and exit (useful for testing)"
    )
    
    return parser.parse_args()


def load_config(config_path: str) -> Dict[str, Any]:
    """Load configuration from file."""
    try:
        with open(config_path, "r") as f:
            return json.load(f)
    except (FileNotFoundError, json.JSONDecodeError) as e:
        print(f"Error loading config: {e}")
        return {}


def main():
    args = parse_arguments()
    
    # Build configuration - priority order:
    # 1. Embedded config (baked into compiled binary)
    # 2. Config file (beacon.json)
    # 3. Command line arguments
    # 4. Default config
    
    config = {}
    
    # First try embedded config (for compiled binaries)
    embedded = get_embedded_config()
    if embedded:
        config.update(embedded)
        print("[*] Using embedded configuration")
    
    # Then load from config file if specified
    if args.config:
        file_config = load_config(args.config)
        config.update(file_config)
    elif not embedded:
        # Try to auto-load beacon.json from same directory as executable
        auto_config = Path(sys.executable).parent / "beacon.json"
        if auto_config.exists():
            config.update(load_config(str(auto_config)))
            print(f"[*] Loaded config from {auto_config}")
    
    # Override with command line arguments
    if args.server:
        config["server_url"] = args.server
    if args.sleep:
        config["sleep_interval"] = args.sleep
    if args.jitter:
        config["jitter_percent"] = args.jitter
    if args.debug:
        config["debug"] = True
    if args.no_ssl_verify:
        config["verify_ssl"] = False
    
    # Validate configuration
    if not config.get("server_url"):
        print("Error: Server URL is required. Use --server or config file.")
        print("Example: python beacon.py --server http://donwatcher:8080")
        sys.exit(1)
    
    # Create and run beacon
    beacon = DonWatcherBeacon(config)
    
    if args.once:
        # Single check-in mode
        response = beacon.checkin()
        if response:
            print(f"Check-in successful. Jobs: {len(response.get('jobs', []))}")
            for job in response.get("jobs", []):
                result = beacon.execute_job(job)
                beacon.submit_result(
                    job_id=job["id"],
                    status=result["status"],
                    output=result.get("output"),
                    error=result.get("error"),
                    exit_code=result.get("exit_code")
                )
        else:
            print("Check-in failed")
            sys.exit(1)
    else:
        # Normal beacon loop
        beacon.run()


if __name__ == "__main__":
    main()

