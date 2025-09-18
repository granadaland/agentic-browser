"""
Shared utilities for Dev CLI operations
"""

import subprocess
import sys
import time
import click
from pathlib import Path
from typing import Optional, List, Dict, Tuple
from context import BuildContext
from utils import log_info, log_error, log_success, log_warning


def run_git_command(cmd: List[str], cwd: Path,
                   capture: bool = True, check: bool = False) -> subprocess.CompletedProcess:
    """Run a git command and return the result"""
    try:
        result = subprocess.run(
            cmd,
            cwd=cwd,
            capture_output=capture,
            text=True,
            check=check
        )
        return result
    except subprocess.CalledProcessError as e:
        log_error(f"Git command failed: {' '.join(cmd)}")
        if e.stderr:
            log_error(f"Error: {e.stderr}")
        if check:
            raise
        return e


def validate_commit_exists(commit_hash: str, chromium_src: Path) -> bool:
    """Validate that a commit exists in the repository"""
    result = run_git_command(
        ['git', 'rev-parse', '--verify', f'{commit_hash}^{{commit}}'],
        cwd=chromium_src
    )

    if result.returncode != 0:
        log_error(f"Commit '{commit_hash}' not found in repository")
        return False
    return True


def get_commit_changed_files(commit_hash: str, chromium_src: Path) -> List[str]:
    """Get list of files changed in a commit"""
    result = run_git_command(
        ['git', 'diff-tree', '--no-commit-id', '--name-only', '-r', commit_hash],
        cwd=chromium_src
    )

    if result.returncode != 0:
        log_error(f"Failed to get changed files for commit {commit_hash}")
        return []

    files = [f.strip() for f in result.stdout.strip().split('\n') if f.strip()]
    return files


def parse_diff_output(diff_output: str) -> Dict[str, Optional[str]]:
    """
    Parse git diff output into individual file patches.

    Returns:
        Dict mapping file path to patch content.
        None value indicates file was deleted.
    """
    patches = {}
    current_file = None
    current_patch = []

    for line in diff_output.splitlines():
        if line.startswith('diff --git'):
            # Save previous patch if exists
            if current_file and current_patch:
                patches[current_file] = '\n'.join(current_patch)

            # Parse new file path
            parts = line.split()
            if len(parts) >= 3:
                # Extract file path from a/path or b/path format
                current_file = parts[2][2:] if parts[2].startswith('a/') else parts[2]
                current_patch = [line]
            else:
                log_warning(f"Could not parse diff line: {line}")
                current_file = None
                current_patch = []

        elif line.startswith('deleted file'):
            if current_file:
                patches[current_file] = None  # Mark as deleted

        elif current_file:
            current_patch.append(line)

    # Save last patch
    if current_file:
        if current_patch:
            patches[current_file] = '\n'.join(current_patch)
        elif current_file not in patches:
            patches[current_file] = None

    return patches


def write_patch_file(ctx: BuildContext, file_path: str, patch_content: str) -> bool:
    """
    Write a patch file to chromium_src directory structure.
    """
    # Construct output path
    output_path = ctx.get_patch_path_for_file(file_path)

    # Create directory structure
    output_path.parent.mkdir(parents=True, exist_ok=True)

    # Write patch content
    try:
        output_path.write_text(patch_content)
        log_success(f"  Written: {output_path}")
        return True
    except Exception as e:
        log_error(f"  Failed to write {output_path}: {e}")
        return False


def create_deletion_marker(ctx: BuildContext, file_path: str) -> bool:
    """
    Create a marker file for deleted files.
    """
    marker_path = ctx.get_dev_patches_dir() / file_path
    marker_path = marker_path.with_suffix(marker_path.suffix + '.deleted')

    marker_path.parent.mkdir(parents=True, exist_ok=True)

    try:
        marker_path.write_text(f"File deleted in patch\n")
        log_warning(f"  Marked deleted: {marker_path}")
        return True
    except Exception as e:
        log_error(f"  Failed to create deletion marker: {e}")
        return False


def apply_single_patch(patch_path: Path, chromium_src: Path,
                      interactive: bool = True) -> Tuple[bool, str]:
    """
    Apply a single patch file to chromium source.

    Returns:
        Tuple of (success, message)
    """
    if not patch_path.exists():
        return False, f"Patch file not found: {patch_path}"

    # Try standard apply
    result = run_git_command(
        ['git', 'apply', '-p1', str(patch_path)],
        cwd=chromium_src
    )

    if result.returncode == 0:
        return True, f"Applied: {patch_path.name}"

    # Try 3-way merge
    result = run_git_command(
        ['git', 'apply', '-p1', '--3way', str(patch_path)],
        cwd=chromium_src
    )

    if result.returncode == 0:
        return True, f"Applied (3-way): {patch_path.name}"

    # Handle conflict
    if interactive:
        return handle_patch_conflict(patch_path, chromium_src, result.stderr)
    else:
        return False, f"Failed: {patch_path.name} - {result.stderr}"


def handle_patch_conflict(patch_path: Path, chromium_src: Path,
                         error_msg: str = "") -> Tuple[bool, str]:
    """Handle patch conflict interactively"""
    click.echo(f"\n{click.style('CONFLICT:', fg='red', bold=True)} {patch_path}")

    if error_msg:
        click.echo(f"Error: {error_msg}")

    click.echo("\nOptions:")
    click.echo("  1) Fix manually and continue")
    click.echo("  2) Skip this patch")
    click.echo("  3) Abort all remaining patches")

    while True:
        choice = click.prompt("Enter choice (1-3)", type=str)

        if choice == "1":
            click.prompt("Fix the conflicts and press Enter to continue")
            return True, f"Manually fixed: {patch_path.name}"
        elif choice == "2":
            return True, f"Skipped: {patch_path.name}"
        elif choice == "3":
            return False, "Aborted by user"
        else:
            click.echo("Invalid choice. Please enter 1, 2, or 3.")


def create_git_commit(chromium_src: Path, message: str) -> bool:
    """Create a git commit with the given message"""
    # Stage all changes
    result = run_git_command(
        ['git', 'add', '-A'],
        cwd=chromium_src
    )

    if result.returncode != 0:
        log_error("Failed to stage changes")
        return False

    # Create commit
    result = run_git_command(
        ['git', 'commit', '-m', message],
        cwd=chromium_src
    )

    if result.returncode != 0:
        if "nothing to commit" in result.stdout:
            log_warning("Nothing to commit")
        else:
            log_error(f"Failed to create commit: {result.stderr}")
        return False

    log_success(f"Created commit: {message}")
    return True


def prompt_yes_no(question: str, default: bool = False) -> bool:
    """Prompt user for yes/no question"""
    default_str = "Y/n" if default else "y/N"
    result = click.prompt(f"{question} [{default_str}]",
                         type=str, default="y" if default else "n")
    return result.lower() in ('y', 'yes')


def safe_operation(operation_func, *args, **kwargs):
    """
    Wrapper for safe execution with rollback capability.
    """
    backup_created = False
    backup_branch = None

    # Get chromium_src from kwargs or BuildContext
    chromium_src = kwargs.get('chromium_src')
    if not chromium_src and len(args) > 0 and isinstance(args[0], BuildContext):
        chromium_src = args[0].chromium_src

    try:
        # Create backup if modifying files
        if kwargs.get('create_backup', False) and chromium_src:
            # Get current branch
            result = run_git_command(
                ['git', 'rev-parse', '--abbrev-ref', 'HEAD'],
                cwd=chromium_src
            )
            current_branch = result.stdout.strip()

            # Create backup branch
            backup_branch = f"dev-cli-backup-{int(time.time())}"
            result = run_git_command(
                ['git', 'checkout', '-b', backup_branch],
                cwd=chromium_src
            )

            if result.returncode == 0:
                backup_created = True
                log_info(f"Created backup branch: {backup_branch}")

        # Execute operation
        result = operation_func(*args, **kwargs)

        # Clean up backup on success
        if backup_created and chromium_src:
            # Switch back to original branch
            run_git_command(
                ['git', 'checkout', current_branch],
                cwd=chromium_src
            )
            # Delete backup branch
            run_git_command(
                ['git', 'branch', '-D', backup_branch],
                cwd=chromium_src
            )

        return result

    except Exception as e:
        log_error(f"Error: {e}")

        if backup_created and chromium_src:
            if prompt_yes_no("Restore from backup?"):
                # Restore from backup
                run_git_command(
                    ['git', 'checkout', backup_branch],
                    cwd=chromium_src
                )
                log_success(f"Restored from backup branch: {backup_branch}")

        raise


def log_extraction_summary(file_patches: Dict[str, Optional[str]]):
    """Log a summary of extracted patches"""
    total = len(file_patches)
    new_files = sum(1 for p in file_patches.values() if p and '/dev/null' in p)
    deleted_files = sum(1 for p in file_patches.values() if p is None)
    modified_files = total - new_files - deleted_files

    click.echo("\n" + click.style("Extraction Summary", fg='green', bold=True))
    click.echo("-" * 40)
    click.echo(f"Total files:    {total}")
    click.echo(f"Modified:       {modified_files}")
    click.echo(f"New files:      {new_files}")
    click.echo(f"Deleted files:  {deleted_files}")
    click.echo("-" * 40)


def log_apply_summary(results: List[Tuple[str, bool, str]]):
    """Log a summary of applied patches

    Args:
        results: List of (file_path, success, message) tuples
    """
    total = len(results)
    successful = sum(1 for _, success, _ in results if success)
    failed = total - successful

    click.echo("\n" + click.style("Apply Summary", fg='green' if failed == 0 else 'yellow', bold=True))
    click.echo("-" * 40)
    click.echo(f"Total patches:  {total}")
    click.echo(f"Successful:     {successful}")
    click.echo(f"Failed:         {failed}")
    click.echo("-" * 40)

    if failed > 0:
        click.echo("\nFailed patches:")
        for file_path, success, message in results:
            if not success:
                click.echo(f"  ✗ {file_path}: {message}")