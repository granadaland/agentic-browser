"""
Apply module - Apply patches to Chromium source
"""

import click
import yaml
from pathlib import Path
from typing import List, Tuple
from context import BuildContext
from modules.dev_cli.utils import (
    apply_single_patch, create_git_commit, log_apply_summary,
    run_git_command
)
from utils import log_info, log_error, log_success, log_warning


@click.group(name='apply')
def apply_group():
    """Apply patches to Chromium source"""
    pass


@apply_group.command(name='all')
@click.option('--commit-each', is_flag=True, help='Create git commit after each patch')
@click.option('--dry-run', is_flag=True, help='Test patches without applying')
@click.option('--continue-on-error', is_flag=True, help='Continue applying patches even if some fail')
@click.pass_context
def apply_all(ctx, commit_each, dry_run, continue_on_error):
    """Apply all patches from chromium_src/

    \b
    Examples:
      dev apply all
      dev apply all --commit-each
      dev apply all --dry-run
    """
    # Get chromium source from parent context
    chromium_src = ctx.parent.obj.get('chromium_src')

    # Create build context
    from dev import create_build_context
    build_ctx = create_build_context(chromium_src)

    if not build_ctx:
        return

    if dry_run:
        log_info("Running in dry-run mode - no changes will be made")

    success = apply_all_patches(build_ctx, commit_each, dry_run, continue_on_error)

    if not success and not continue_on_error:
        ctx.exit(1)


@apply_group.command(name='feature')
@click.argument('feature_name')
@click.option('--commit-each', is_flag=True, help='Create git commit after each patch')
@click.option('--dry-run', is_flag=True, help='Test patches without applying')
@click.option('--continue-on-error', is_flag=True, help='Continue applying patches even if some fail')
@click.pass_context
def apply_feature(ctx, feature_name, commit_each, dry_run, continue_on_error):
    """Apply patches for a specific feature

    \b
    Examples:
      dev apply feature llm-chat
      dev apply feature my-feature --commit-each
    """
    # Get chromium source from parent context
    chromium_src = ctx.parent.obj.get('chromium_src')

    # Create build context
    from dev import create_build_context
    build_ctx = create_build_context(chromium_src)

    if not build_ctx:
        return

    if dry_run:
        log_info("Running in dry-run mode - no changes will be made")

    success = apply_feature_patches(build_ctx, feature_name, commit_each,
                                   dry_run, continue_on_error)

    if not success and not continue_on_error:
        ctx.exit(1)


def apply_all_patches(ctx: BuildContext, commit_each: bool = False,
                     dry_run: bool = False,
                     continue_on_error: bool = False) -> bool:
    """Apply all patches from chromium_src/ directory"""

    # Step 1: Validate chromium_src is a git repository
    result = run_git_command(
        ['git', 'rev-parse', '--is-inside-work-tree'],
        cwd=ctx.chromium_src
    )

    if result.returncode != 0:
        log_error(f"Directory is not a git repository: {ctx.chromium_src}")
        return False

    # Step 3: Recursively find all .patch files
    patches_dir = ctx.get_dev_patches_dir()

    if not patches_dir.exists():
        log_warning(f"Patches directory does not exist: {patches_dir}")
        return True

    patch_files = sorted(patches_dir.rglob("*.patch"))

    if not patch_files:
        log_warning("No patch files found")
        return True

    log_info(f"Found {len(patch_files)} patch files")

    # Step 4: Sort patches alphabetically (already done above)
    # Step 5: Apply each patch
    results: List[Tuple[str, bool, str]] = []

    for patch_path in patch_files:
        # Get relative path for display
        rel_path = patch_path.relative_to(patches_dir)

        if dry_run:
            # In dry-run mode, just check if patch would apply
            result = run_git_command(
                ['git', 'apply', '--check', '-p1', str(patch_path)],
                cwd=ctx.chromium_src
            )

            if result.returncode == 0:
                log_success(f"  ✓ Would apply: {rel_path}")
                results.append((str(rel_path), True, "Would apply cleanly"))
            else:
                log_warning(f"  ✗ Would fail: {rel_path}")
                results.append((str(rel_path), False, "Would fail to apply"))
        else:
            # Actually apply the patch
            success, message = apply_single_patch(
                patch_path,
                ctx.chromium_src,
                interactive=ctx.dev_config.interactive if hasattr(ctx, 'dev_config') else True
            )

            if success:
                log_success(f"  ✓ {message}")
                results.append((str(rel_path), True, message))

                if commit_each:
                    # Create commit for this patch
                    commit_msg = f"Apply patch: {rel_path.stem}"
                    create_git_commit(ctx.chromium_src, commit_msg)
            else:
                log_error(f"  ✗ {message}")
                results.append((str(rel_path), False, message))

                if not continue_on_error and "Aborted" in message:
                    log_error("Aborted by user")
                    break

    # Step 6: Report summary
    log_apply_summary(results)

    failed_count = sum(1 for _, success, _ in results if not success)
    return failed_count == 0 or continue_on_error


def apply_feature_patches(ctx: BuildContext, feature_name: str,
                         commit_each: bool = False, dry_run: bool = False,
                         continue_on_error: bool = False) -> bool:
    """Apply patches for a specific feature"""

    # Step 1: Load features.yaml
    features_path = ctx.get_features_yaml_path()

    if not features_path.exists():
        log_error(f"Features file not found: {features_path}")
        log_info("Use 'dev feature add' to create features")
        return False

    try:
        with open(features_path, 'r') as f:
            data = yaml.safe_load(f)
    except Exception as e:
        log_error(f"Failed to load features file: {e}")
        return False

    features = data.get('features', {})

    # Step 2: Validate feature exists
    if feature_name not in features:
        log_error(f"Feature '{feature_name}' not found")
        log_info("Available features:")
        for name in features.keys():
            log_info(f"  - {name}")
        return False

    # Step 3: Get list of files
    feature_data = features[feature_name]
    file_list = feature_data.get('files', [])

    if not file_list:
        log_warning(f"Feature '{feature_name}' has no files")
        return True

    log_info(f"Applying {len(file_list)} patches for feature '{feature_name}'")

    # Step 4-5: Apply patches
    results: List[Tuple[str, bool, str]] = []

    for file_path in file_list:
        # Construct patch file path
        patch_path = ctx.get_patch_path_for_file(file_path)

        if not patch_path.exists():
            log_warning(f"  Patch not found: {patch_path}")
            results.append((file_path, False, "Patch file not found"))
            if not continue_on_error:
                break
            continue

        if dry_run:
            # In dry-run mode, just check if patch would apply
            result = run_git_command(
                ['git', 'apply', '--check', '-p1', str(patch_path)],
                cwd=ctx.chromium_src
            )

            if result.returncode == 0:
                log_success(f"  ✓ Would apply: {file_path}")
                results.append((file_path, True, "Would apply cleanly"))
            else:
                log_warning(f"  ✗ Would fail: {file_path}")
                results.append((file_path, False, "Would fail to apply"))
        else:
            # Actually apply the patch
            success, message = apply_single_patch(
                patch_path,
                ctx.chromium_src,
                interactive=ctx.dev_config.interactive if hasattr(ctx, 'dev_config') else True
            )

            if success:
                log_success(f"  ✓ {message}")
                results.append((file_path, True, message))

                if commit_each:
                    # Create commit for this patch
                    commit_msg = f"Apply {feature_name}: {Path(file_path).name}"
                    create_git_commit(ctx.chromium_src, commit_msg)
            else:
                log_error(f"  ✗ {message}")
                results.append((file_path, False, message))

                if not continue_on_error and "Aborted" in message:
                    log_error("Aborted by user")
                    break

    # Step 6: Report
    log_apply_summary(results)

    failed_count = sum(1 for _, success, _ in results if not success)
    return failed_count == 0 or continue_on_error