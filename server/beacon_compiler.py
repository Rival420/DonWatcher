"""
Beacon Compiler Service v2.0 (Go Edition)

Server-side cross-compilation of beacon agents into standalone executables
with embedded configuration. Uses Go for true cross-compilation!

Key Features:
- Cross-compile Windows EXE from Linux server ✓
- No PyInstaller needed - uses Go's native cross-compilation
- Configuration embedded via -ldflags at build time
- kardianos/service support for Windows service installation

Requirements:
    Go 1.21+ installed on server

Author: DonWatcher Security Team
"""

import hashlib
import json
import logging
import os
import subprocess
import tempfile
import threading
from datetime import datetime, timedelta
from pathlib import Path
from typing import Dict, Any, Optional, Tuple
import asyncio
from concurrent.futures import ThreadPoolExecutor

logger = logging.getLogger("beacon_compiler")

# Thread pool for background compilation
_compile_executor = ThreadPoolExecutor(max_workers=2, thread_name_prefix="beacon_compiler")

# Simple in-memory cache for compiled beacons
_beacon_cache: Dict[str, Dict[str, Any]] = {}
_cache_lock = threading.Lock()
CACHE_TTL = timedelta(hours=2)
MAX_CACHE_SIZE = 20


class BeaconCompilerError(Exception):
    """Raised when beacon compilation fails."""
    pass


def _get_cache_key(config: Dict[str, Any], target_os: str) -> str:
    """Generate a cache key from configuration and target OS."""
    key_data = json.dumps({
        "server_url": config.get("server_url", ""),
        "sleep_interval": config.get("sleep_interval", 60),
        "jitter_percent": config.get("jitter_percent", 10),
        "verify_ssl": config.get("verify_ssl", True),
        "debug": config.get("debug", False),
        "target_os": target_os,
    }, sort_keys=True)
    return hashlib.sha256(key_data.encode()).hexdigest()[:16]


def _check_cache(cache_key: str) -> Optional[bytes]:
    """Check if a compiled beacon is in cache."""
    with _cache_lock:
        if cache_key in _beacon_cache:
            entry = _beacon_cache[cache_key]
            if datetime.now() < entry["expires_at"]:
                logger.info(f"Cache hit for beacon {cache_key}")
                return entry["binary"]
            else:
                del _beacon_cache[cache_key]
    return None


def _add_to_cache(cache_key: str, binary: bytes):
    """Add a compiled beacon to cache."""
    with _cache_lock:
        if len(_beacon_cache) >= MAX_CACHE_SIZE:
            oldest_key = min(_beacon_cache.keys(), 
                           key=lambda k: _beacon_cache[k]["created_at"])
            del _beacon_cache[oldest_key]
        
        _beacon_cache[cache_key] = {
            "binary": binary,
            "created_at": datetime.now(),
            "expires_at": datetime.now() + CACHE_TTL
        }
        logger.info(f"Added beacon {cache_key} to cache ({len(binary)} bytes)")


def check_go_available() -> bool:
    """Check if Go compiler is installed and available."""
    try:
        result = subprocess.run(
            ["go", "version"],
            capture_output=True,
            text=True,
            timeout=10
        )
        if result.returncode == 0:
            logger.debug(f"Go available: {result.stdout.strip()}")
            return True
        return False
    except (subprocess.TimeoutExpired, FileNotFoundError):
        return False


def get_go_version() -> Optional[str]:
    """Get the installed Go version."""
    try:
        result = subprocess.run(
            ["go", "version"],
            capture_output=True,
            text=True,
            timeout=10
        )
        if result.returncode == 0:
            # Parse "go version go1.21.0 linux/amd64"
            parts = result.stdout.strip().split()
            if len(parts) >= 3:
                return parts[2]  # "go1.21.0"
        return None
    except (subprocess.TimeoutExpired, FileNotFoundError):
        return None


def _compile_beacon_go(
    server_url: str,
    sleep_interval: int = 60,
    jitter_percent: int = 10,
    verify_ssl: bool = True,
    debug: bool = False,
    output_name: str = "DonWatcher-Beacon",
    target_os: str = "windows",
    target_arch: str = "amd64"
) -> Tuple[bytes, str]:
    """
    Compile the Go beacon with embedded configuration using cross-compilation.
    
    This is the magic of Go - we can compile Windows executables from Linux!
    
    Args:
        server_url: The DonWatcher server URL to embed
        sleep_interval: Beacon sleep interval in seconds  
        jitter_percent: Jitter percentage
        verify_ssl: Whether to verify SSL certificates
        debug: Enable debug mode
        output_name: Name for the output executable
        target_os: Target OS (windows, linux, darwin)
        target_arch: Target architecture (amd64, arm64)
    
    Returns:
        Tuple of (binary_data, filename)
    """
    config = {
        "server_url": server_url,
        "sleep_interval": sleep_interval,
        "jitter_percent": jitter_percent,
        "verify_ssl": verify_ssl,
        "debug": debug,
    }
    
    # Check cache
    cache_key = _get_cache_key(config, f"{target_os}_{target_arch}")
    cached = _check_cache(cache_key)
    if cached:
        extension = ".exe" if target_os == "windows" else ""
        return cached, f"{output_name}{extension}"
    
    # Find Go beacon source
    project_root = Path(__file__).parent.parent
    beacon_go_dir = project_root / "client" / "beacon-go"
    
    if not beacon_go_dir.exists():
        raise BeaconCompilerError(f"Go beacon source not found at {beacon_go_dir}")
    
    main_go = beacon_go_dir / "main.go"
    if not main_go.exists():
        raise BeaconCompilerError(f"main.go not found at {main_go}")
    
    logger.info(f"Cross-compiling Go beacon for {target_os}/{target_arch}")
    logger.info(f"Config: server={server_url}, sleep={sleep_interval}s, jitter={jitter_percent}%")
    
    # Create temp directory for build output
    with tempfile.TemporaryDirectory(prefix="beacon_go_build_") as temp_dir:
        # Determine output filename
        extension = ".exe" if target_os == "windows" else ""
        output_filename = f"{output_name}{extension}"
        output_path = Path(temp_dir) / output_filename
        
        # Build ldflags for embedding configuration
        ldflags = [
            f"-X main.ServerURL={server_url}",
            f"-X main.SleepInterval={sleep_interval}",
            f"-X main.JitterPercent={jitter_percent}",
            f"-X main.VerifySSL={'true' if verify_ssl else 'false'}",
            f"-X main.DebugMode={'true' if debug else 'false'}",
            f"-X main.Version=2.0.0",
        ]
        
        # Add Windows-specific flags to hide console and strip symbols
        if target_os == "windows":
            ldflags.append("-H=windowsgui")  # Hide console window
        
        # Strip debug symbols for smaller binary
        ldflags.extend(["-s", "-w"])
        
        ldflags_str = " ".join(ldflags)
        
        # Build environment for cross-compilation
        env = os.environ.copy()
        env["GOOS"] = target_os
        env["GOARCH"] = target_arch
        env["CGO_ENABLED"] = "0"  # Disable CGO for static binary
        
        # Go build command
        cmd = [
            "go", "build",
            "-ldflags", ldflags_str,
            "-o", str(output_path),
            "."
        ]
        
        logger.info(f"Running: GOOS={target_os} GOARCH={target_arch} go build ...")
        
        try:
            # First, run go mod tidy to generate/update go.sum
            tidy_result = subprocess.run(
                ["go", "mod", "tidy"],
                capture_output=True,
                text=True,
                timeout=120,
                cwd=str(beacon_go_dir),
                env=env
            )
            
            if tidy_result.returncode != 0:
                logger.warning(f"go mod tidy warning: {tidy_result.stderr}")
            
            # Download dependencies
            dep_result = subprocess.run(
                ["go", "mod", "download"],
                capture_output=True,
                text=True,
                timeout=120,
                cwd=str(beacon_go_dir),
                env=env
            )
            
            if dep_result.returncode != 0:
                logger.warning(f"go mod download warning: {dep_result.stderr}")
            
            # Build the binary
            result = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                timeout=180,  # 3 minute timeout
                cwd=str(beacon_go_dir),
                env=env
            )
            
            if result.returncode != 0:
                error_msg = result.stderr or result.stdout or "Unknown error"
                logger.error(f"Go build failed: {error_msg}")
                raise BeaconCompilerError(f"Compilation failed: {error_msg[:500]}")
            
            # Check output exists
            if not output_path.exists():
                raise BeaconCompilerError("Compiled binary not found after build")
            
            # Read the binary
            with open(output_path, "rb") as f:
                binary_data = f.read()
            
            size_mb = len(binary_data) / (1024 * 1024)
            logger.info(f"Successfully compiled Go beacon: {output_filename} ({size_mb:.1f} MB)")
            
            # Cache it
            _add_to_cache(cache_key, binary_data)
            
            return binary_data, output_filename
            
        except subprocess.TimeoutExpired:
            raise BeaconCompilerError("Compilation timed out after 3 minutes")
        except FileNotFoundError:
            raise BeaconCompilerError("Go compiler not found. Please install Go 1.21+")


def _compile_beacon_sync(
    server_url: str,
    sleep_interval: int = 60,
    jitter_percent: int = 10,
    verify_ssl: bool = True,
    debug: bool = False,
    output_name: str = "DonWatcher-Beacon",
    target_os: str = "windows"
) -> Tuple[bytes, str]:
    """
    Synchronously compile the beacon into an executable.
    Uses Go cross-compilation for proper Windows EXE from Linux!
    
    Returns:
        Tuple of (binary_data, filename)
    """
    return _compile_beacon_go(
        server_url=server_url,
        sleep_interval=sleep_interval,
        jitter_percent=jitter_percent,
        verify_ssl=verify_ssl,
        debug=debug,
        output_name=output_name,
        target_os=target_os,
        target_arch="amd64"  # Default to 64-bit
    )


async def compile_beacon(
    server_url: str,
    sleep_interval: int = 60,
    jitter_percent: int = 10,
    verify_ssl: bool = True,
    debug: bool = False,
    output_name: str = "DonWatcher-Beacon",
    target_os: str = "windows"
) -> Tuple[bytes, str]:
    """
    Asynchronously compile the beacon into an executable.
    
    Uses Go cross-compilation - can build Windows EXE from Linux!
    
    Args:
        server_url: The DonWatcher server URL to embed
        sleep_interval: Beacon sleep interval in seconds
        jitter_percent: Jitter percentage for sleep randomization
        verify_ssl: Whether to verify SSL certificates
        debug: Enable debug mode in beacon
        output_name: Name for the output executable (without extension)
        target_os: Target OS ("windows", "linux", "darwin")
    
    Returns:
        Tuple of (binary_data, filename)
    
    Raises:
        BeaconCompilerError: If compilation fails
    """
    loop = asyncio.get_event_loop()
    return await loop.run_in_executor(
        _compile_executor,
        _compile_beacon_sync,
        server_url,
        sleep_interval,
        jitter_percent,
        verify_ssl,
        debug,
        output_name,
        target_os
    )


def check_compiler_available() -> bool:
    """Check if the beacon compiler is available (Go installed)."""
    return check_go_available()


def get_compiler_status() -> Dict[str, Any]:
    """Get the status of the beacon compiler service."""
    go_available = check_go_available()
    go_version = get_go_version() if go_available else None
    
    with _cache_lock:
        cache_info = {
            "cached_beacons": len(_beacon_cache),
            "max_cache_size": MAX_CACHE_SIZE,
            "cache_ttl_hours": CACHE_TTL.total_seconds() / 3600
        }
    
    # Go can cross-compile to ANY platform!
    supported_targets = ["windows", "linux", "darwin"] if go_available else []
    
    return {
        "status": "ready" if go_available else "unavailable",
        "compiler": "go",
        "compiler_version": go_version,
        "go_installed": go_available,
        "can_compile_windows": go_available,
        "can_cross_compile": go_available,
        "cache": cache_info,
        "supported_targets": supported_targets
    }


def clear_cache():
    """Clear the beacon cache."""
    with _cache_lock:
        count = len(_beacon_cache)
        _beacon_cache.clear()
        logger.info(f"Cleared {count} cached beacons")
    return count


# Quick test
if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    
    print("Beacon Compiler Status (Go Edition):")
    status = get_compiler_status()
    print(json.dumps(status, indent=2))
    
    if status["go_installed"]:
        print("\nTest cross-compilation (Linux -> Windows)...")
        try:
            binary, filename = _compile_beacon_sync(
                server_url="http://localhost:8080",
                sleep_interval=60,
                jitter_percent=10,
                target_os="windows"
            )
            size_mb = len(binary) / (1024 * 1024)
            print(f"Success! Created {filename} ({size_mb:.1f} MB)")
        except BeaconCompilerError as e:
            print(f"Failed: {e}")
    else:
        print("\n⚠️  Go not installed. Please install Go 1.21+")
        print("   Ubuntu/Debian: sudo apt install golang-go")
        print("   Or download from: https://go.dev/dl/")
