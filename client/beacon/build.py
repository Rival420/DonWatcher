#!/usr/bin/env python3
"""
DonWatcher Beacon Build Script

Compiles the beacon agent into a standalone Windows executable with
embedded configuration. No Python installation required on target.

Usage:
    python build.py --server https://donwatcher.company.com:8080 --output beacon.exe

Requirements:
    - PyInstaller: pip install pyinstaller
    - For Windows cross-compilation on Linux: wine + PyInstaller in wine

Author: DonWatcher Security Team
"""

import argparse
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path


def embed_config(source_code: str, config: dict) -> str:
    """Embed configuration into the beacon source code."""
    config_json = json.dumps(config)
    # Replace the EMBEDDED_CONFIG placeholder
    pattern = r'EMBEDDED_CONFIG = None  # <<<EMBED_CONFIG_HERE>>>'
    replacement = f'EMBEDDED_CONFIG = {repr(config_json)}  # Embedded at build time'
    
    if pattern not in source_code:
        print("[!] Warning: Config placeholder not found in source")
        return source_code
    
    return source_code.replace(pattern, replacement)


def build_executable(
    server_url: str,
    output_path: str = "beacon.exe",
    sleep_interval: int = 60,
    jitter_percent: int = 10,
    debug: bool = False,
    one_file: bool = True,
    icon_path: str = None
):
    """Build the beacon executable with embedded configuration."""
    
    # Get paths
    script_dir = Path(__file__).parent
    beacon_source = script_dir / "beacon.py"
    
    if not beacon_source.exists():
        print(f"[!] Error: beacon.py not found at {beacon_source}")
        sys.exit(1)
    
    # Read source
    print(f"[*] Reading beacon source from {beacon_source}")
    with open(beacon_source, "r", encoding="utf-8") as f:
        source_code = f.read()
    
    # Create embedded config
    config = {
        "server_url": server_url,
        "sleep_interval": sleep_interval,
        "jitter_percent": jitter_percent,
        "verify_ssl": True,
        "debug": debug,
        "auto_upload": True
    }
    
    print(f"[*] Embedding configuration:")
    print(f"    Server URL: {server_url}")
    print(f"    Sleep: {sleep_interval}s, Jitter: {jitter_percent}%")
    
    # Embed config
    modified_source = embed_config(source_code, config)
    
    # Create temp directory for build
    with tempfile.TemporaryDirectory() as temp_dir:
        temp_beacon = Path(temp_dir) / "beacon.py"
        
        # Write modified source
        with open(temp_beacon, "w", encoding="utf-8") as f:
            f.write(modified_source)
        
        # Build PyInstaller command
        cmd = [
            sys.executable, "-m", "PyInstaller",
            "--clean",
            "--noconfirm",
            "--name", Path(output_path).stem,
            "--distpath", str(Path(output_path).parent or "."),
            "--workpath", str(Path(temp_dir) / "build"),
            "--specpath", temp_dir,
        ]
        
        if one_file:
            cmd.append("--onefile")
        
        # Add icon if provided
        if icon_path and Path(icon_path).exists():
            cmd.extend(["--icon", icon_path])
        
        # Hide console window on Windows
        cmd.append("--noconsole")
        
        # Add hidden imports that might be needed
        cmd.extend([
            "--hidden-import", "requests",
            "--hidden-import", "urllib.request",
        ])
        
        # Add source file
        cmd.append(str(temp_beacon))
        
        print(f"[*] Running PyInstaller...")
        print(f"    Command: {' '.join(cmd)}")
        
        try:
            result = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                cwd=temp_dir
            )
            
            if result.returncode != 0:
                print(f"[!] PyInstaller failed:")
                print(result.stderr)
                sys.exit(1)
            
            print(f"[+] Build successful!")
            print(f"[+] Output: {output_path}")
            
        except FileNotFoundError:
            print("[!] PyInstaller not found. Install with: pip install pyinstaller")
            sys.exit(1)


def main():
    parser = argparse.ArgumentParser(
        description="Build DonWatcher Beacon executable",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
    # Build with default settings
    python build.py --server https://donwatcher.example.com:8080

    # Build with custom sleep interval
    python build.py --server https://donwatcher.example.com:8080 --sleep 300 --jitter 20

    # Build with custom output name
    python build.py --server https://donwatcher.example.com:8080 --output DonWatcher-Agent.exe
        """
    )
    
    parser.add_argument(
        "--server", "-s",
        required=True,
        help="DonWatcher server URL (e.g., https://donwatcher.example.com:8080)"
    )
    parser.add_argument(
        "--output", "-o",
        default="beacon.exe",
        help="Output executable path (default: beacon.exe)"
    )
    parser.add_argument(
        "--sleep",
        type=int,
        default=60,
        help="Beacon sleep interval in seconds (default: 60)"
    )
    parser.add_argument(
        "--jitter",
        type=int,
        default=10,
        help="Jitter percentage (default: 10)"
    )
    parser.add_argument(
        "--debug",
        action="store_true",
        help="Enable debug mode in beacon"
    )
    parser.add_argument(
        "--icon",
        help="Path to .ico file for executable icon"
    )
    parser.add_argument(
        "--folder",
        action="store_true",
        help="Create folder instead of single file (--onedir mode)"
    )
    
    args = parser.parse_args()
    
    build_executable(
        server_url=args.server,
        output_path=args.output,
        sleep_interval=args.sleep,
        jitter_percent=args.jitter,
        debug=args.debug,
        one_file=not args.folder,
        icon_path=args.icon
    )


if __name__ == "__main__":
    main()

