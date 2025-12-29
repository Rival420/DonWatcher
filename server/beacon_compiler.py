"""
Beacon Compiler Service

Server-side compilation of beacon agents into standalone executables
with embedded configuration. No Python installation required on target.

This service uses PyInstaller to create Windows .exe files (or Linux/Mac binaries)
that can be downloaded ready-to-run with all configuration baked in.

Requirements:
    pip install pyinstaller requests

Author: DonWatcher Security Team
"""

import hashlib
import json
import logging
import os
import shutil
import subprocess
import sys
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
CACHE_TTL = timedelta(hours=1)
MAX_CACHE_SIZE = 10


class BeaconCompilerError(Exception):
    """Raised when beacon compilation fails."""
    pass


def _get_cache_key(config: Dict[str, Any]) -> str:
    """Generate a cache key from configuration."""
    # Include all config values that affect the binary
    key_data = json.dumps({
        "server_url": config.get("server_url", ""),
        "sleep_interval": config.get("sleep_interval", 60),
        "jitter_percent": config.get("jitter_percent", 10),
        "verify_ssl": config.get("verify_ssl", True),
        "debug": config.get("debug", False),
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
                # Expired, remove from cache
                del _beacon_cache[cache_key]
    return None


def _add_to_cache(cache_key: str, binary: bytes):
    """Add a compiled beacon to cache."""
    with _cache_lock:
        # Clean up old entries if cache is full
        if len(_beacon_cache) >= MAX_CACHE_SIZE:
            oldest_key = min(_beacon_cache.keys(), 
                           key=lambda k: _beacon_cache[k]["created_at"])
            del _beacon_cache[oldest_key]
        
        _beacon_cache[cache_key] = {
            "binary": binary,
            "created_at": datetime.now(),
            "expires_at": datetime.now() + CACHE_TTL
        }
        logger.info(f"Added beacon {cache_key} to cache")


def _embed_config_in_source(source_code: str, config: Dict[str, Any]) -> str:
    """Embed configuration into the beacon source code."""
    config_json = json.dumps(config)
    # Replace the EMBEDDED_CONFIG placeholder
    pattern = 'EMBEDDED_CONFIG = None  # <<<EMBED_CONFIG_HERE>>>'
    replacement = f'EMBEDDED_CONFIG = {repr(config_json)}  # Embedded at build time'
    
    if pattern not in source_code:
        logger.warning("Config placeholder not found in beacon source")
        return source_code
    
    return source_code.replace(pattern, replacement)


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
    
    Returns:
        Tuple of (binary_data, filename)
    """
    # Build config
    config = {
        "server_url": server_url,
        "sleep_interval": sleep_interval,
        "jitter_percent": jitter_percent,
        "verify_ssl": verify_ssl,
        "debug": debug,
        "auto_upload": True
    }
    
    # Check cache first
    cache_key = _get_cache_key(config)
    cached = _check_cache(cache_key)
    if cached:
        extension = ".exe" if target_os == "windows" else ""
        return cached, f"{output_name}{extension}"
    
    # Find beacon source
    project_root = Path(__file__).parent.parent
    beacon_source_path = project_root / "client" / "beacon" / "beacon.py"
    
    if not beacon_source_path.exists():
        raise BeaconCompilerError(f"Beacon source not found at {beacon_source_path}")
    
    logger.info(f"Compiling beacon for {server_url} (sleep={sleep_interval}s, jitter={jitter_percent}%)")
    
    # Read and modify source
    with open(beacon_source_path, "r", encoding="utf-8") as f:
        source_code = f.read()
    
    modified_source = _embed_config_in_source(source_code, config)
    
    # Create temp directory for build
    with tempfile.TemporaryDirectory(prefix="beacon_build_") as temp_dir:
        temp_beacon = Path(temp_dir) / "beacon.py"
        dist_dir = Path(temp_dir) / "dist"
        build_dir = Path(temp_dir) / "build"
        
        # Write modified source
        with open(temp_beacon, "w", encoding="utf-8") as f:
            f.write(modified_source)
        
        # Determine output extension
        if target_os == "windows":
            extension = ".exe"
        else:
            extension = ""
        
        output_filename = f"{output_name}{extension}"
        
        # Build PyInstaller command
        cmd = [
            sys.executable, "-m", "PyInstaller",
            "--clean",
            "--noconfirm",
            "--onefile",
            "--name", output_name,
            "--distpath", str(dist_dir),
            "--workpath", str(build_dir),
            "--specpath", temp_dir,
        ]
        
        # Hide console window on Windows
        if target_os == "windows":
            cmd.append("--noconsole")
        
        # Add hidden imports
        cmd.extend([
            "--hidden-import", "requests",
            "--hidden-import", "urllib.request",
            "--hidden-import", "json",
            "--hidden-import", "socket",
            "--hidden-import", "platform",
            "--hidden-import", "subprocess",
        ])
        
        # Add source file
        cmd.append(str(temp_beacon))
        
        logger.info(f"Running PyInstaller: {' '.join(cmd[:5])}...")
        
        try:
            result = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                timeout=300,  # 5 minute timeout
                cwd=temp_dir
            )
            
            if result.returncode != 0:
                logger.error(f"PyInstaller failed: {result.stderr}")
                raise BeaconCompilerError(f"Compilation failed: {result.stderr[:500]}")
            
            # Find the output binary
            output_path = dist_dir / output_filename
            
            if not output_path.exists():
                # Try without extension
                output_path = dist_dir / output_name
                if not output_path.exists():
                    raise BeaconCompilerError("Compiled binary not found in output directory")
            
            # Read the binary
            with open(output_path, "rb") as f:
                binary_data = f.read()
            
            logger.info(f"Successfully compiled beacon: {len(binary_data)} bytes")
            
            # Add to cache
            _add_to_cache(cache_key, binary_data)
            
            return binary_data, output_filename
            
        except subprocess.TimeoutExpired:
            raise BeaconCompilerError("Compilation timed out after 5 minutes")
        except FileNotFoundError:
            raise BeaconCompilerError("PyInstaller not installed. Run: pip install pyinstaller")


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
    
    Args:
        server_url: The DonWatcher server URL to embed
        sleep_interval: Beacon sleep interval in seconds
        jitter_percent: Jitter percentage for sleep randomization
        verify_ssl: Whether to verify SSL certificates
        debug: Enable debug mode in beacon
        output_name: Name for the output executable (without extension)
        target_os: Target OS ("windows", "linux", "macos")
    
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


def check_pyinstaller_available() -> bool:
    """Check if PyInstaller is installed and available."""
    try:
        result = subprocess.run(
            [sys.executable, "-m", "PyInstaller", "--version"],
            capture_output=True,
            text=True,
            timeout=10
        )
        return result.returncode == 0
    except (subprocess.TimeoutExpired, FileNotFoundError):
        return False


def get_compiler_status() -> Dict[str, Any]:
    """Get the status of the beacon compiler service."""
    pyinstaller_available = check_pyinstaller_available()
    
    with _cache_lock:
        cache_info = {
            "cached_beacons": len(_beacon_cache),
            "max_cache_size": MAX_CACHE_SIZE,
            "cache_ttl_hours": CACHE_TTL.total_seconds() / 3600
        }
    
    return {
        "status": "ready" if pyinstaller_available else "unavailable",
        "pyinstaller_installed": pyinstaller_available,
        "cache": cache_info,
        "supported_targets": ["windows", "linux", "macos"] if pyinstaller_available else []
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
    
    print("Beacon Compiler Status:")
    status = get_compiler_status()
    print(json.dumps(status, indent=2))
    
    if status["pyinstaller_installed"]:
        print("\nTest compilation...")
        try:
            binary, filename = _compile_beacon_sync(
                server_url="http://localhost:8080",
                sleep_interval=60,
                jitter_percent=10
            )
            print(f"Success! Created {filename} ({len(binary)} bytes)")
        except BeaconCompilerError as e:
            print(f"Failed: {e}")

