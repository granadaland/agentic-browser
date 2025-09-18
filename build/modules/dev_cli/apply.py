"""
Apply module - Apply patches to Chromium source

Simple and straightforward patch application with minimal error handling.
"""

import click
import yaml
from pathlib import Path
from typing import List, Tuple
from context import BuildContext
from modules.dev_cli.utils import run_git_command, GitError
from utils import log_info, log_error, log_success, log_warning


@click.group(name='apply')
def apply_group():
    """Apply patches to Chromium source"""
    pass


@apply_group.command(name='all')
@click.option('--commit-each', is_flag=True, help='Create git commit after each patch')
@click.option('--dry-run', is_flag=True, help='Test patches without applying')
@click.pass_context
def apply_all(ctx, commit_each, dry_run):
    """Apply all patches from chromium_src/

    \b
    Examples:
      dev apply all
      dev apply all --commit-each
      dev apply all --dry-run
    """
    chromium_src = ctx.parent.obj.get('chromium_src')

    from dev import create_build_context
    build_ctx = create_build_context(chromium_src)
    if not build_ctx:
        return

    patches_dir = build_ctx.get_dev_patches_dir()
    if not patches_dir.exists():
        log_error(f"Patches directory does not exist: {patches_dir}")
        ctx.exit(1)

    # Find all patch files (excluding special markers)
    patch_files = sorted([
        p for p in patches_dir.rglob("*.patch")
        if not p.name.endswith('.deleted') and not p.name.endswith('.binary')
    ])

    if not patch_files:
        log_warning("No patch files found")
        return

    log_info(f"Found {len(patch_files)} patches")

    if dry_run:
        log_info("DRY RUN - No changes will be made")

    applied = 0
    failed = []

    for patch_path in patch_files:
        rel_path = patch_path.relative_to(patches_dir)

        if dry_run:
            # Just check if patch would apply
            result = run_git_command(
                ['git', 'apply', '--check', '-p1', str(patch_path)],
                cwd=build_ctx.chromium_src
            )
            if result.returncode == 0:
                log_success(f"  ✓ Would apply: {rel_path}")
                applied += 1
            else:
                log_error(f"  ✗ Would fail: {rel_path}")
                failed.append(str(rel_path))
        else:
            # Actually apply the patch
            result = run_git_command(
                ['git', 'apply', '-p1', str(patch_path)],
                cwd=build_ctx.chromium_src
            )

            if result.returncode == 0:
                log_success(f"  ✓ Applied: {rel_path}")
                applied += 1

                if commit_each:
                    # Create commit
                    run_git_command(['git', 'add', '-A'], cwd=build_ctx.chromium_src)
                    run_git_command(
                        ['git', 'commit', '-m', f'Apply patch: {rel_path.stem}'],
                        cwd=build_ctx.chromium_src
                    )
            else:
                log_error(f"  ✗ Failed: {rel_path}")
                log_error(f"    {result.stderr}")
                failed.append(str(rel_path))

    # Summary
    log_info(f"\nSummary: {applied} applied, {len(failed)} failed")

    if failed:
        log_error("Failed patches:")
        for p in failed:
            log_error(f"  - {p}")
        ctx.exit(1)


@apply_group.command(name='feature')
@click.argument('feature_name')
@click.option('--commit-each', is_flag=True, help='Create git commit after each patch')
@click.option('--dry-run', is_flag=True, help='Test patches without applying')
@click.pass_context
def apply_feature(ctx, feature_name, commit_each, dry_run):
    """Apply patches for a specific feature

    \b
    Examples:
      dev apply feature llm-chat
      dev apply feature my-feature --commit-each
    """
    chromium_src = ctx.parent.obj.get('chromium_src')

    from dev import create_build_context
    build_ctx = create_build_context(chromium_src)
    if not build_ctx:
        return

    # Load features.yaml
    features_path = build_ctx.get_features_yaml_path()
    if not features_path.exists():
        log_error(f"No features.yaml found")
        ctx.exit(1)

    with open(features_path) as f:
        data = yaml.safe_load(f)

    features = data.get('features', {})

    if feature_name not in features:
        log_error(f"Feature '{feature_name}' not found")
        log_info("Available features:")
        for name in features:
            log_info(f"  - {name}")
        ctx.exit(1)

    file_list = features[feature_name].get('files', [])

    if not file_list:
        log_warning(f"Feature '{feature_name}' has no files")
        return

    log_info(f"Applying patches for feature '{feature_name}' ({len(file_list)} files)")

    if dry_run:
        log_info("DRY RUN - No changes will be made")

    applied = 0
    failed = []

    for file_path in file_list:
        patch_path = build_ctx.get_patch_path_for_file(file_path)

        if not patch_path.exists():
            log_warning(f"  Patch not found: {file_path}")
            failed.append(file_path)
            continue

        if dry_run:
            result = run_git_command(
                ['git', 'apply', '--check', '-p1', str(patch_path)],
                cwd=build_ctx.chromium_src
            )
            if result.returncode == 0:
                log_success(f"  ✓ Would apply: {file_path}")
                applied += 1
            else:
                log_error(f"  ✗ Would fail: {file_path}")
                failed.append(file_path)
        else:
            result = run_git_command(
                ['git', 'apply', '-p1', str(patch_path)],
                cwd=build_ctx.chromium_src
            )

            if result.returncode == 0:
                log_success(f"  ✓ Applied: {file_path}")
                applied += 1

                if commit_each:
                    run_git_command(['git', 'add', '-A'], cwd=build_ctx.chromium_src)
                    run_git_command(
                        ['git', 'commit', '-m', f'Apply {feature_name}: {Path(file_path).name}'],
                        cwd=build_ctx.chromium_src
                    )
            else:
                log_error(f"  ✗ Failed: {file_path}")
                failed.append(file_path)

    # Summary
    log_info(f"\nSummary: {applied} applied, {len(failed)} failed")

    if failed:
        log_error("Failed patches:")
        for p in failed:
            log_error(f"  - {p}")
        ctx.exit(1)