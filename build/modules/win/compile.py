#!/usr/bin/env python3
"""
Windows-specific compile wrapper for Nxtscape
Run this on native Windows after preparing source in WSL
"""

import os
import sys
import subprocess
from pathlib import Path

# Add build directory to path (go up two levels from modules/win to build)
build_dir = Path(__file__).parent.parent.parent
sys.path.insert(0, str(build_dir))

# Now import the modules - utils.py will handle Windows compatibility automatically
from modules.compile import build
from context import BuildContext
from utils import log_info, log_error, log_success

def main():
    # Configuration - adjust these paths for your system
    root_dir = build_dir.parent  # Go up from build to project root
    chromium_src = Path("C:/src/chromium")
    
    # Verify paths exist
    if not root_dir.exists():
        log_error(f"Root directory not found: {root_dir}")
        sys.exit(1)
        
    if not chromium_src.exists():
        log_error(f"Chromium source not found: {chromium_src}")
        log_info("Please provide the correct path to chromium source")
        sys.exit(1)
    
    # Check for autoninja
    try:
        subprocess.run(["where", "autoninja"], check=True, capture_output=True)
    except subprocess.CalledProcessError:
        log_error("autoninja not found in PATH")
        log_info("Make sure depot_tools is in your PATH")
        log_info("See: https://chromium.googlesource.com/chromium/tools/depot_tools.git")
        sys.exit(1)
    
    log_info("🚀 Nxtscape Windows Build System")
    log_info("=" * 50)
    log_info(f"📍 Root: {root_dir}")
    log_info(f"📍 Chromium: {chromium_src}")
    
    # Create context
    ctx = BuildContext(
        root_dir=root_dir,
        chromium_src=chromium_src,
        architecture="x64",  # Windows x64
        build_type="debug"   # Change to "release" for release builds
    )
    
    # Override app names for Windows
    ctx.CHROMIUM_APP_NAME = "chrome.exe"
    ctx.NXTSCAPE_APP_NAME = "BrowserOS.exe"
    
    # Ensure output directory uses Windows path
    ctx.out_dir = f"out\\Default_{ctx.architecture}"
    
    log_info(f"📍 Output directory: {ctx.chromium_src / ctx.out_dir}")
    log_info(f"📍 Architecture: {ctx.architecture}")
    log_info(f"📍 Build type: {ctx.build_type}")
    
    # Check if output directory exists
    out_path = ctx.chromium_src / ctx.out_dir
    if not out_path.exists():
        log_error(f"Output directory does not exist: {out_path}")
        log_info("Run 'gn gen' first to create the output directory")
        sys.exit(1)
    
    # Run the build
    try:
        build(ctx)
        log_success("Build completed successfully!")
    except Exception as e:
        log_error(f"Build failed: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()