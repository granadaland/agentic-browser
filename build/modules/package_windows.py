#!/usr/bin/env python3
"""
Windows packaging module for Nxtscape Browser
Based on ungoogled-chromium-windows packaging approach
"""

import os
import sys
import shutil
import zipfile
from pathlib import Path
from typing import Optional, List
from context import BuildContext
from utils import run_command, log_info, log_error, log_success, log_warning, join_paths, IS_WINDOWS


def package(ctx: BuildContext) -> bool:
    """Create Windows packages (installer and portable zip)"""
    log_info("\n📦 Creating Windows packages...")
    
    # First, ensure mini_installer is built
    if not build_mini_installer(ctx):
        log_error("Failed to build mini_installer")
        return False
    
    # Create both installer and portable zip
    success = True
    
    if create_installer(ctx):
        log_success("Installer created successfully")
    else:
        log_error("Failed to create installer")
        success = False
    
    if create_portable_zip(ctx):
        log_success("Portable ZIP created successfully")
    else:
        log_error("Failed to create portable ZIP")
        success = False
    
    return success


def build_mini_installer(ctx: BuildContext) -> bool:
    """Build the mini_installer target if it doesn't exist"""
    log_info("\n🔨 Checking mini_installer build...")
    
    # Get paths
    build_output_dir = join_paths(ctx.chromium_src, ctx.out_dir)
    mini_installer_path = build_output_dir / "mini_installer.exe"
    
    if mini_installer_path.exists():
        log_info("mini_installer.exe already exists")
        return True
    
    log_info("Building mini_installer target...")
    
    # Build mini_installer using autoninja
    try:
        # Use autoninja.bat on Windows
        autoninja_cmd = "autoninja.bat" if IS_WINDOWS else "autoninja"
        
        # Build the mini_installer target
        cmd = [
            autoninja_cmd,
            "-C",
            ctx.out_dir,  # Use relative path like in compile.py
            "mini_installer"
        ]
        
        # Change to chromium_src directory before running (like compile.py does)
        import os
        old_cwd = os.getcwd()
        os.chdir(ctx.chromium_src)
        
        try:
            run_command(cmd)
        finally:
            os.chdir(old_cwd)
        
        # Verify the file was created
        if mini_installer_path.exists():
            log_success("mini_installer built successfully")
            return True
        else:
            log_error("mini_installer build completed but file not found")
            return False
            
    except Exception as e:
        log_error(f"Failed to build mini_installer: {e}")
        return False


def create_installer(ctx: BuildContext) -> bool:
    """Create Windows installer (mini_installer.exe)"""
    log_info("\n🔧 Creating Windows installer...")
    
    # Get paths
    build_output_dir = join_paths(ctx.chromium_src, ctx.out_dir)
    mini_installer_path = build_output_dir / "mini_installer.exe"
    
    if not mini_installer_path.exists():
        log_warning(f"mini_installer.exe not found at: {mini_installer_path}")
        log_info("To build the installer, run: autoninja -C out\\Default_x64 mini_installer")
        return False
    
    # Create output directory
    output_dir = ctx.get_dist_dir()
    output_dir.mkdir(parents=True, exist_ok=True)
    
    # Generate installer filename with version and architecture
    installer_name = f"{ctx.get_app_base_name()}_{ctx.get_nxtscape_chromium_version()}_{ctx.architecture}_installer.exe"
    installer_path = output_dir / installer_name
    
    # Copy mini_installer to final location
    try:
        shutil.copy2(mini_installer_path, installer_path)
        log_success(f"Installer created: {installer_name}")
        return True
    except Exception as e:
        log_error(f"Failed to create installer: {e}")
        return False


def create_portable_zip(ctx: BuildContext) -> bool:
    """Create ZIP of just the installer for easier distribution"""
    log_info("\n📦 Creating installer ZIP package...")
    
    # Get paths
    build_output_dir = join_paths(ctx.chromium_src, ctx.out_dir)
    mini_installer_path = build_output_dir / "mini_installer.exe"
    
    if not mini_installer_path.exists():
        log_warning(f"mini_installer.exe not found at: {mini_installer_path}")
        log_info("To build the installer, run: autoninja -C out\\Default_x64 mini_installer")
        return False
    
    # Create output directory
    output_dir = ctx.get_dist_dir()
    output_dir.mkdir(parents=True, exist_ok=True)
    
    # Generate ZIP filename with version and architecture
    zip_name = f"{ctx.get_app_base_name()}_{ctx.get_nxtscape_chromium_version()}_{ctx.architecture}_installer.zip"
    zip_path = output_dir / zip_name
    
    # Create ZIP file containing just the installer
    try:
        with zipfile.ZipFile(zip_path, 'w', zipfile.ZIP_DEFLATED) as zipf:
            # Add mini_installer.exe to the zip
            installer_name = f"{ctx.get_app_base_name()}_{ctx.get_nxtscape_version()}_{ctx.architecture}_installer.exe"
            zipf.write(mini_installer_path, installer_name)
            
            # Get file size for logging
            file_size = mini_installer_path.stat().st_size
            log_info(f"Added installer to ZIP ({file_size // (1024*1024)} MB)")
                    
        log_success(f"Installer ZIP created: {zip_name}")
        return True
    except Exception as e:
        log_error(f"Failed to create installer ZIP: {e}")
        return False


def sign_binaries(ctx: BuildContext, certificate_name: Optional[str] = None) -> bool:
    """Sign Windows binaries using signtool or eSigner"""
    log_info("\n🔏 Signing Windows binaries...")
    
    # Check for signing method from environment or config
    signing_method = os.environ.get('SIGNING_METHOD', 'signtool').lower()
    
    # Get paths to sign
    build_output_dir = join_paths(ctx.chromium_src, ctx.out_dir)
    
    # List of binaries to sign
    binaries_to_sign = [
        build_output_dir / "chrome.exe",
        build_output_dir / "mini_installer.exe"
    ]
    
    # Check which binaries exist
    existing_binaries = []
    for binary in binaries_to_sign:
        if binary.exists():
            existing_binaries.append(binary)
            log_info(f"Found binary to sign: {binary.name}")
        else:
            log_warning(f"Binary not found: {binary}")
    
    if not existing_binaries:
        log_error("No binaries found to sign")
        return False
    
    # Use eSigner if configured
    if signing_method == 'esigner' or os.environ.get('ESIGNER_USERNAME'):
        return sign_with_esigner(existing_binaries)
    
    # Use PFX certificate if configured
    if os.environ.get('PFX_PATH'):
        return sign_with_pfx(existing_binaries)
    
    # Otherwise use traditional certificate store signing
    if not certificate_name:
        log_warning("No certificate specified, skipping signing")
        return True
    
    return sign_with_certificate_store(existing_binaries, certificate_name)


def sign_with_esigner(binaries: List[Path]) -> bool:
    """Sign binaries using SSL.com CodeSignTool"""
    log_info("Using SSL.com CodeSignTool for signing...")
    
    # Check for CodeSignTool from environment or default locations
    codesigntool_path_str = os.environ.get('CODESIGNTOOL_PATH')
    if codesigntool_path_str:
        codesigntool_path = Path(codesigntool_path_str)
        log_info(f"Using CodeSignTool from env: {codesigntool_path}")
    else:
        # Try default locations
        codesigntool_path = Path("C:/src/BrowserOS/CodeSignTool-v1.3.2-windows/CodeSignTool.bat")
        if not codesigntool_path.exists():
            codesigntool_path = Path("CodeSignTool.bat")
    
    if not codesigntool_path.exists():
        log_error(f"CodeSignTool.bat not found at: {codesigntool_path}")
        log_error("Set CODESIGNTOOL_PATH in .env file or download from SSL.com")
        return False
    
    # Check for required environment variables
    username = os.environ.get('ESIGNER_USERNAME')
    password = os.environ.get('ESIGNER_PASSWORD') 
    totp_secret = os.environ.get('ESIGNER_TOTP_SECRET')
    credential_id = os.environ.get('ESIGNER_CREDENTIAL_ID')
    
    # Check if using TOTP secret or OTP
    use_otp = os.environ.get('ESIGNER_USE_OTP', 'false').lower() == 'true'
    
    if use_otp:
        # Prompt for OTP code
        import getpass
        otp_code = getpass.getpass("Enter your 6-digit OTP code from authenticator app: ")
        if not otp_code or len(otp_code) != 6:
            log_error("Invalid OTP code. Must be 6 digits.")
            return False
    else:
        # Use TOTP secret
        if not totp_secret:
            log_error("Missing ESIGNER_TOTP_SECRET environment variable")
            log_error("Either set ESIGNER_TOTP_SECRET or set ESIGNER_USE_OTP=true to enter OTP manually")
            return False
    
    if not all([username, password]):
        log_error("Missing required eSigner environment variables:")
        log_error("  set ESIGNER_USERNAME=your-email")
        log_error("  set ESIGNER_PASSWORD=your-password")
        log_error("  set ESIGNER_TOTP_SECRET=your-totp-secret (or set ESIGNER_USE_OTP=true)")
        log_error("  set ESIGNER_CREDENTIAL_ID=your-credential-id (optional)")
        return False
    
    all_success = True
    for binary in binaries:
        try:
            log_info(f"Signing {binary.name} with CodeSignTool...")
            
            # Build command
            cmd = [
                str(codesigntool_path),
                "sign",
                "-username", username,
                "-password", password,
                "-input_file_path", str(binary),
                "-output_dir_path", str(binary.parent),
                "-override"  # Override the input file after signing
            ]
            
            # CodeSignTool doesn't support -otp flag, only -totp_secret
            # For OTP, we need to convert it to a temporary TOTP secret
            if use_otp:
                # For manual OTP, we can't use it directly - need TOTP secret
                log_warning("Note: CodeSignTool requires TOTP secret, not OTP code")
                log_error("Please set ESIGNER_TOTP_SECRET in .env file")
                log_error("You can find it in SSL.com dashboard under eSigner settings")
                return False
            else:
                cmd.extend(["-totp_secret", totp_secret])
            
            if credential_id:
                cmd.extend(["-credential_id", credential_id])
            
            # Note: Timestamp server is configured on SSL.com side automatically
            
            run_command(cmd)
            log_success(f"{binary.name} signed successfully with CodeSignTool")
            
        except Exception as e:
            log_error(f"Failed to sign {binary.name} with CodeSignTool: {e}")
            all_success = False
    
    return all_success


def sign_with_pfx(binaries: List[Path]) -> bool:
    """Sign binaries using PFX certificate file"""
    pfx_path = os.environ.get('PFX_PATH')
    if not pfx_path or not Path(pfx_path).exists():
        log_error(f"PFX certificate not found at: {pfx_path}")
        return False
    
    log_info(f"Using PFX certificate: {pfx_path}")
    
    # Import the signing module
    from .sign_with_esigner import sign_with_local_pfx
    
    all_success = True
    for binary in binaries:
        if not sign_with_local_pfx(str(binary), pfx_path):
            all_success = False
    
    return all_success


def sign_with_certificate_store(binaries: List[Path], certificate_name: str) -> bool:
    """Sign binaries using certificate from Windows certificate store"""
    log_info(f"Using certificate from store: {certificate_name}")
    
    # Check if signtool is available
    signtool_path = shutil.which("signtool")
    if not signtool_path:
        # Try to find it in Windows SDK locations
        sdk_paths = [
            Path("C:/Program Files (x86)/Windows Kits/10/bin"),
            Path("C:/Program Files/Windows Kits/10/bin"),
        ]
        
        for sdk_path in sdk_paths:
            if sdk_path.exists():
                # Look for signtool in architecture-specific subdirectories
                for arch_dir in sdk_path.glob("*/x64"):
                    potential_signtool = arch_dir / "signtool.exe"
                    if potential_signtool.exists():
                        signtool_path = str(potential_signtool)
                        break
            if signtool_path:
                break
    
    if not signtool_path:
        log_error("signtool.exe not found. Please install Windows SDK.")
        return False
    
    # Sign each binary
    all_success = True
    for binary in binaries:
        try:
            log_info(f"Signing {binary.name}...")
            
            cmd = [
                signtool_path,
                "sign",
                "/n", certificate_name,  # Certificate name
                "/tr", "http://ts.ssl.com",  # SSL.com timestamp server for eSigner
                "/td", "sha256",  # Timestamp digest algorithm
                "/fd", "sha256",  # File digest algorithm
                str(binary)
            ]
            
            run_command(cmd)
            log_success(f"{binary.name} signed successfully")
            
            # Verify signature
            verify_cmd = [signtool_path, "verify", "/pa", str(binary)]
            run_command(verify_cmd)
            log_success(f"{binary.name} signature verified successfully")
            
        except Exception as e:
            log_error(f"Failed to sign {binary.name}: {e}")
            all_success = False
    
    return all_success


def package_universal(contexts: List[BuildContext]) -> bool:
    """Windows doesn't support universal binaries like macOS"""
    log_warning("Universal binaries are not supported on Windows")
    log_info("Consider creating separate packages for each architecture")
    return True


def get_target_cpu(build_output_dir: Path) -> str:
    """Get target CPU architecture from build configuration"""
    args_gn_path = build_output_dir / "args.gn"
    
    if not args_gn_path.exists():
        return "x64"  # Default
    
    try:
        args_gn_content = args_gn_path.read_text(encoding='utf-8')
        for cpu in ('x64', 'x86', 'arm64'):
            if f'target_cpu="{cpu}"' in args_gn_content:
                return cpu
    except Exception:
        pass
    
    return "x64"  # Default


def create_files_cfg_package(ctx: BuildContext) -> bool:
    """Create package using Chromium's FILES.cfg approach (alternative method)"""
    log_info("\n📦 Creating FILES.cfg-based package...")
    
    build_output_dir = join_paths(ctx.chromium_src, ctx.out_dir)
    files_cfg_path = ctx.chromium_src / "chrome" / "tools" / "build" / "win" / "FILES.cfg"
    
    if not files_cfg_path.exists():
        log_error(f"FILES.cfg not found at: {files_cfg_path}")
        return False
    
    # This would require implementing the filescfg module functionality
    # from ungoogled-chromium, which is quite complex
    log_warning("FILES.cfg packaging not yet implemented")
    return False
