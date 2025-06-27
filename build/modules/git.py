#!/usr/bin/env python3
"""
Git operations module for Nxtscape build system
"""

import os
import sys
import subprocess
import shutil
from pathlib import Path
from context import BuildContext
from utils import run_command, log_info, log_error, log_success


def setup_git(ctx: BuildContext) -> bool:
    """Setup git and checkout Chromium"""
    log_info(f"\n🔀 Setting up Chromium {ctx.chromium_version}...")
    
    os.chdir(ctx.chromium_src)
    
    # Fetch all tags and checkout
    log_info("📥 Fetching all tags from remote...")
    run_command(["git", "fetch", "--tags", "--force"])
    run_command(["git", "fetch", "origin", "--tags", "--force"])
    
    # Verify tag exists before checkout
    result = subprocess.run(["git", "tag", "-l", ctx.chromium_version], 
                           text=True, cwd=ctx.chromium_src)
    if ctx.chromium_version not in result.stdout:
        log_error(f"Tag {ctx.chromium_version} not found!")
        log_info("Available tags (last 10):")
        list_result = subprocess.run(["git", "tag", "-l", "--sort=-version:refname"], 
                                   text=True, cwd=ctx.chromium_src)
        for tag in list_result.stdout.strip().split('\n')[:10]:
            log_info(f"  {tag}")
        raise ValueError(f"Git tag {ctx.chromium_version} not found")
    
    log_info(f"🔀 Checking out tag: {ctx.chromium_version}")
    run_command(["git", "checkout", f"tags/{ctx.chromium_version}"])
    
    # Sync dependencies
    log_info("📥 Syncing dependencies (this may take a while)...")
    run_command(["gclient", "sync", "-D", "--no-history", "--shallow"])
    
    log_success("Git setup complete")
    return True


def setup_sparkle(ctx: BuildContext) -> bool:
    """Download and setup Sparkle framework"""
    log_info("\n✨ Setting up Sparkle framework...")
    
    sparkle_dir = ctx.get_sparkle_dir()
    
    # Clean existing
    if sparkle_dir.exists():
        shutil.rmtree(sparkle_dir)
    
    sparkle_dir.mkdir(parents=True)
    
    # Download Sparkle
    sparkle_url = ctx.get_sparkle_url()
    
    os.chdir(sparkle_dir)
    run_command(["curl", "-L", "-o", "sparkle.tar.xz", sparkle_url])
    run_command(["tar", "-xf", "sparkle.tar.xz"])
    os.remove("sparkle.tar.xz")
    
    log_success("Sparkle setup complete")
    return True
