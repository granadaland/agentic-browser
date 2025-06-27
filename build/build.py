#!/usr/bin/env python3
"""
Main build orchestrator for Nxtscape Browser
"""

import sys
import time
import click
from pathlib import Path
from typing import Optional

# Import shared components
from context import BuildContext
from utils import load_config, log_info, log_warning, log_error, log_success

# Import modules
from modules.clean import clean
from modules.git import setup_git, setup_sparkle
from modules.patches import apply_patches
from modules.resources import copy_resources
from modules.configure import configure
from modules.compile import build
from modules.sign import sign
from modules.package import package
from modules.slack import (
    notify_build_started,
    notify_build_step,
    notify_build_success,
    notify_build_failure,
    notify_build_interrupted
)


def build_main(
    config_file: Optional[Path] = None,
    clean_flag: bool = False,
    git_setup_flag: bool = False,
    apply_patches_flag: bool = False,
    sign_flag: bool = False,
    package_flag: bool = False,
    build_flag: bool = False,
    arch: str = "arm64",
    build_type: str = "debug",
    chromium_src_dir: Optional[Path] = None,
    slack_notifications: bool = False,
):
    """Main build orchestration"""
    log_info("🚀 Nxtscape Build System")
    log_info("=" * 50)

    # Setup context
    root_dir = Path(__file__).parent.parent

    # Determine chromium source directory
    if chromium_src_dir and chromium_src_dir.exists():
        chromium_src = chromium_src_dir
        log_info(f"📁 Using provided Chromium source: {chromium_src}")
    else:
        chromium_src = root_dir / "chromium_src"
        if chromium_src_dir:
            log_warning(f"Provided path does not exist: {chromium_src_dir}")
            log_info(f"📁 Using default: {chromium_src}")

    # Load config if provided
    config = None
    gn_flags_file = None
    if config_file:
        config = load_config(config_file)
        log_info(f"📄 Loaded config from: {config_file}")

        # Override parameters from config
        if "build" in config:
            build_type = config["build"].get("type", build_type)
            arch = config["build"].get("architecture", arch)

        if "steps" in config:
            clean_flag = config["steps"].get("clean", clean_flag)
            git_setup_flag = config["steps"].get("git_setup", git_setup_flag)
            apply_patches_flag = config["steps"].get(
                "apply_patches", apply_patches_flag
            )
            build_flag = config["steps"].get("build", build_flag)
            sign_flag = config["steps"].get("sign", sign_flag)
            package_flag = config["steps"].get("package", package_flag)
        
        # Override slack notifications from config if not explicitly set via CLI
        if "notifications" in config:
            slack_notifications = config["notifications"].get("slack", slack_notifications)

        if "gn_flags" in config and "file" in config["gn_flags"]:
            gn_flags_file = Path(config["gn_flags"]["file"])

        # Check if chromium_src is specified in config
        if "paths" in config and "chromium_src" in config["paths"]:
            config_chromium_src = Path(config["paths"]["chromium_src"])
            if config_chromium_src.exists():
                chromium_src = config_chromium_src
                log_info(f"📁 Using Chromium source from config: {chromium_src}")

    ctx = BuildContext(
        root_dir=root_dir,
        chromium_src=chromium_src,
        architecture=arch,
        build_type=build_type,
        apply_patches=apply_patches_flag,
        sign_package=sign_flag,
        package=package_flag,
        build=build_flag,
    )

    log_info(f"📍 Root: {ctx.root_dir}")
    log_info(f"📍 Chromium source: {ctx.chromium_src}")
    log_info(f"📍 Chromium: {ctx.chromium_version}")
    log_info(f"📍 Nxtscape: {ctx.nxtscape_version}")
    log_info(f"📍 Architecture: {ctx.architecture}")
    log_info(f"📍 Build type: {ctx.build_type}")
    
    # Notify build started (if enabled)
    if slack_notifications:
        notify_build_started(ctx.build_type, ctx.architecture)

    # Run build steps
    try:
        if clean_flag:
            clean(ctx)
            if slack_notifications:
                notify_build_step("Completed cleaning build artifacts")

        if git_setup_flag:
            setup_git(ctx)
            if slack_notifications:
                notify_build_step("Completed Git setup and Chromium source")

        if apply_patches_flag:
            setup_sparkle(ctx)
            apply_patches(ctx)
            copy_resources(ctx)
            if slack_notifications:
                notify_build_step("Completed applying patches and copying resources")

        if build_flag:
            configure(ctx, gn_flags_file)
            build(ctx)
            if slack_notifications:
                notify_build_step("Completed configuring and building Nxtscape")

        if sign_flag:
            sign(ctx)
            if slack_notifications:
                notify_build_step("Completed signing and notarizing application")
        if package_flag:
            package(ctx)
            if slack_notifications:
                notify_build_step("Completed creating DMG package")

        # Summary
        elapsed = time.time() - ctx.start_time
        mins = int(elapsed / 60)
        secs = int(elapsed % 60)

        log_info("\n" + "=" * 50)
        log_success(f"Build completed in {mins}m {secs}s")
        log_info("=" * 50)
        
        # Notify build success (if enabled)
        if slack_notifications:
            notify_build_success(mins, secs)

    except KeyboardInterrupt:
        log_warning("\nBuild interrupted")
        if slack_notifications:
            notify_build_interrupted()
        sys.exit(130)
    except Exception as e:
        log_error(f"\nBuild failed: {e}")
        if slack_notifications:
            notify_build_failure(str(e))
        sys.exit(1)


@click.command()
@click.option(
    "--config",
    "-c",
    type=click.Path(exists=True, path_type=Path),
    help="Load configuration from YAML file",
)
@click.option("--clean", "-C", is_flag=True, default=False, help="Clean before build")
@click.option("--git-setup", "-g", is_flag=True, default=False, help="Git setup")
@click.option("--apply-patches", "-p", is_flag=True, default=False, help="Apply patches")
@click.option("--sign", "-s", is_flag=True, default=False, help="Sign and notarize the app")
@click.option(
    "--arch", "-a", 
    type=click.Choice(["arm64", "x64"]), 
    default="arm64", 
    help="Architecture"
)
@click.option(
    "--build-type", "-t",
    type=click.Choice(["debug", "release"]),
    default="debug",
    help="Build type",
)
@click.option("--package", "-P", is_flag=True, default=False, help="Create DMG package")
@click.option("--build", "-b", is_flag=True, default=False, help="Build")
@click.option(
    "--chromium-src", "-S",
    type=click.Path(exists=False, path_type=Path),
    help="Path to Chromium source directory",
)
@click.option(
    "--slack-notifications", "-n",
    is_flag=True,
    default=False,
    help="Enable Slack notifications"
)
def main(
    config, clean, git_setup, apply_patches, sign, arch, build_type, package, build, chromium_src, slack_notifications
):
    """Simple build system for Nxtscape Browser"""
    build_main(
        config_file=config,
        clean_flag=clean,
        git_setup_flag=git_setup,
        apply_patches_flag=apply_patches,
        sign_flag=sign,
        package_flag=package,
        build_flag=build,
        arch=arch,
        build_type=build_type,
        chromium_src_dir=chromium_src,
        slack_notifications=slack_notifications,
    )


if __name__ == "__main__":
    main()

