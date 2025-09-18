"""
Extract module - Extract patches from git commits
"""

import click
from pathlib import Path
from typing import Optional, List
from context import BuildContext
from modules.dev_cli.utils import (
    run_git_command, validate_commit_exists, parse_diff_output,
    write_patch_file, create_deletion_marker, log_extraction_summary,
    get_commit_changed_files
)
from utils import log_info, log_error, log_success, log_warning


@click.group(name='extract')
def extract_group():
    """Extract patches from git commits"""
    pass


@extract_group.command(name='commit')
@click.argument('commit')
@click.option('--verbose', '-v', is_flag=True, help='Show detailed output')
@click.pass_context
def extract_commit(ctx, commit, verbose):
    """Extract patches from a single commit

    \b
    Examples:
      dev extract commit HEAD
      dev extract commit abc123
      dev extract commit HEAD~1
    """
    # Get chromium source from parent context
    chromium_src = ctx.parent.obj.get('chromium_src')

    # Create build context
    from dev import create_build_context
    build_ctx = create_build_context(chromium_src)

    if not build_ctx:
        return

    log_info(f"Extracting patches from commit: {commit}")

    if extract_single_commit(build_ctx, commit, verbose):
        log_success(f"Successfully extracted patches from {commit}")
    else:
        log_error(f"Failed to extract patches from {commit}")
        ctx.exit(1)


@extract_group.command(name='range')
@click.argument('base_commit')
@click.argument('head_commit')
@click.option('--verbose', '-v', is_flag=True, help='Show detailed output')
@click.pass_context
def extract_range(ctx, base_commit, head_commit, verbose):
    """Extract patches from a range of commits

    \b
    Examples:
      dev extract range main HEAD
      dev extract range HEAD~5 HEAD
      dev extract range chromium-base HEAD
    """
    # Get chromium source from parent context
    chromium_src = ctx.parent.obj.get('chromium_src')

    # Create build context
    from dev import create_build_context
    build_ctx = create_build_context(chromium_src)

    if not build_ctx:
        return

    log_info(f"Extracting patches from range: {base_commit}..{head_commit}")

    if extract_commit_range(build_ctx, base_commit, head_commit, verbose):
        log_success(f"Successfully extracted patches from {base_commit}..{head_commit}")
    else:
        log_error(f"Failed to extract patches from range")
        ctx.exit(1)


def extract_single_commit(ctx: BuildContext, commit_hash: str,
                         verbose: bool = False) -> bool:
    """Implementation of single commit extraction"""

    # Step 1: Validate commit
    if not validate_commit_exists(commit_hash, ctx.chromium_src):
        return False

    # Step 2: Get diff
    result = run_git_command(
        ['git', 'diff', f'{commit_hash}^..{commit_hash}'],
        cwd=ctx.chromium_src
    )

    if result.returncode != 0:
        log_error(f"Failed to get diff for commit {commit_hash}")
        if result.stderr:
            log_error(f"Error: {result.stderr}")
        return False

    # Step 3: Parse diff into file patches
    file_patches = parse_diff_output(result.stdout)

    if not file_patches:
        log_warning("No changes found in commit")
        return True

    # Step 4: Write individual patches
    success_count = 0
    fail_count = 0

    for file_path, patch_content in file_patches.items():
        if verbose:
            log_info(f"Processing: {file_path}")

        if patch_content is None:
            # File was deleted
            if create_deletion_marker(ctx, file_path):
                success_count += 1
            else:
                fail_count += 1
        else:
            # Normal patch
            if write_patch_file(ctx, file_path, patch_content):
                success_count += 1
            else:
                fail_count += 1

    # Step 5: Log summary
    log_extraction_summary(file_patches)

    if fail_count > 0:
        log_warning(f"Failed to extract {fail_count} patches")

    return fail_count == 0


def extract_commit_range(ctx: BuildContext, base_commit: str,
                        head_commit: str, verbose: bool = False) -> bool:
    """Implementation of commit range extraction"""

    # Step 1: Validate commits
    if not validate_commit_exists(base_commit, ctx.chromium_src):
        return False
    if not validate_commit_exists(head_commit, ctx.chromium_src):
        return False

    # Step 2: Get cumulative diff
    result = run_git_command(
        ['git', 'diff', f'{base_commit}..{head_commit}'],
        cwd=ctx.chromium_src
    )

    if result.returncode != 0:
        log_error(f"Failed to get diff for range {base_commit}..{head_commit}")
        if result.stderr:
            log_error(f"Error: {result.stderr}")
        return False

    # Step 3-5: Process diff
    file_patches = parse_diff_output(result.stdout)

    if not file_patches:
        log_warning("No changes found in commit range")
        return True

    success_count = 0
    fail_count = 0

    for file_path, patch_content in file_patches.items():
        if verbose:
            log_info(f"Processing: {file_path}")

        if patch_content is None:
            # File was deleted
            if create_deletion_marker(ctx, file_path):
                success_count += 1
            else:
                fail_count += 1
        else:
            # Normal patch
            if write_patch_file(ctx, file_path, patch_content):
                success_count += 1
            else:
                fail_count += 1

    # Step 6: Log summary
    log_extraction_summary(file_patches)

    if fail_count > 0:
        log_warning(f"Failed to extract {fail_count} patches")

    return fail_count == 0