"""
Feature module - Manage feature-to-file mappings
"""

import click
import yaml
from pathlib import Path
from typing import Dict, List, Optional
from context import BuildContext
from modules.dev_cli.utils import get_commit_changed_files
from utils import log_info, log_error, log_success, log_warning


@click.group(name='feature')
def feature_group():
    """Manage feature-to-file mappings"""
    pass


@feature_group.command(name='add')
@click.argument('feature_name')
@click.argument('commit')
@click.option('--description', '-d', help='Description of the feature')
@click.pass_context
def add_feature(ctx, feature_name, commit, description):
    """Add files from a commit to a feature

    \b
    Examples:
      dev feature add llm-chat HEAD
      dev feature add my-feature abc123 -d "My new feature"
    """
    # Get chromium source from parent context
    chromium_src = ctx.parent.obj.get('chromium_src')

    # Create build context
    from dev import create_build_context
    build_ctx = create_build_context(chromium_src)

    if not build_ctx:
        return

    if add_feature_from_commit(build_ctx, feature_name, commit, description):
        log_success(f"Feature '{feature_name}' updated successfully")
    else:
        log_error(f"Failed to update feature '{feature_name}'")
        ctx.exit(1)


@feature_group.command(name='list')
@click.pass_context
def list_features(ctx):
    """List all features

    \b
    Example:
      dev feature list
    """
    # For listing, we don't need a valid chromium source
    # Just create a minimal BuildContext
    try:
        from context import BuildContext
        build_ctx = BuildContext(
            root_dir=Path.cwd(),
            chromium_src=Path.cwd(),  # Dummy value, not used
            architecture="",
            build_type="debug"
        )
    except:
        # If BuildContext fails, work directly with paths
        build_ctx = None

    features = load_features_yaml(build_ctx)

    if not features:
        log_warning("No features defined")
        log_info("Use 'dev feature add' to create features")
        return

    click.echo("\n" + click.style("Features:", fg='green', bold=True))
    click.echo("-" * 60)

    total_files = 0
    for name, data in features.items():
        files = data.get('files', [])
        file_count = len(files)
        total_files += file_count
        description = data.get('description', 'No description')

        click.echo(f"  {click.style(name, fg='cyan', bold=True)} ({file_count} files)")
        click.echo(f"    {description}")

    click.echo("-" * 60)
    click.echo(f"Total: {len(features)} features, {total_files} file assignments")


@feature_group.command(name='show')
@click.argument('feature_name')
@click.option('--check-patches', is_flag=True, help='Check if patch files exist')
@click.pass_context
def show_feature(ctx, feature_name, check_patches):
    """Show details of a specific feature

    \b
    Examples:
      dev feature show llm-chat
      dev feature show my-feature --check-patches
    """
    # For showing features, we don't need chromium source
    try:
        from context import BuildContext
        build_ctx = BuildContext(
            root_dir=Path.cwd(),
            chromium_src=Path.cwd(),  # Dummy value, not used
            architecture="",
            build_type="debug"
        )
    except:
        build_ctx = None

    if not build_ctx:
        return

    features = load_features_yaml(build_ctx)

    if feature_name not in features:
        log_error(f"Feature '{feature_name}' not found")
        log_info("Available features:")
        for name in features.keys():
            log_info(f"  - {name}")
        ctx.exit(1)

    feature_data = features[feature_name]
    files = feature_data.get('files', [])
    description = feature_data.get('description', 'No description')

    click.echo("\n" + click.style(f"Feature: {feature_name}", fg='green', bold=True))
    click.echo(f"Description: {description}")
    click.echo(f"Files ({len(files)}):")

    if check_patches:
        patches_dir = build_ctx.get_dev_patches_dir()
        for file_path in files:
            patch_path = build_ctx.get_patch_path_for_file(file_path)
            if patch_path.exists():
                click.echo(f"  ✓ {file_path}")
            else:
                click.echo(f"  ✗ {file_path} (patch missing)")
    else:
        for file_path in files:
            click.echo(f"  • {file_path}")


@feature_group.command(name='remove')
@click.argument('feature_name')
@click.option('--force', '-f', is_flag=True, help='Remove without confirmation')
@click.pass_context
def remove_feature(ctx, feature_name, force):
    """Remove a feature

    \b
    Examples:
      dev feature remove old-feature
      dev feature remove old-feature --force
    """
    # For removing features, we don't need chromium source
    try:
        from context import BuildContext
        build_ctx = BuildContext(
            root_dir=Path.cwd(),
            chromium_src=Path.cwd(),  # Dummy value, not used
            architecture="",
            build_type="debug"
        )
    except:
        build_ctx = None

    if not build_ctx:
        return

    features = load_features_yaml(build_ctx)

    if feature_name not in features:
        log_error(f"Feature '{feature_name}' not found")
        ctx.exit(1)

    if not force:
        feature_data = features[feature_name]
        file_count = len(feature_data.get('files', []))
        if not click.confirm(f"Remove feature '{feature_name}' with {file_count} files?"):
            log_info("Cancelled")
            return

    del features[feature_name]
    save_features_yaml(build_ctx, features)
    log_success(f"Removed feature '{feature_name}'")


@feature_group.command(name='generate-patch')
@click.argument('feature_name')
@click.option('--output', '-o', type=click.Path(), help='Output file path')
@click.pass_context
def generate_patch(ctx, feature_name, output):
    """Generate combined patch for a feature

    \b
    Examples:
      dev feature generate-patch llm-chat
      dev feature generate-patch my-feature -o my-feature.patch
    """
    # Get chromium source from parent context
    chromium_src = ctx.parent.obj.get('chromium_src')

    # Create build context
    from dev import create_build_context
    build_ctx = create_build_context(chromium_src)

    if not build_ctx:
        return

    features = load_features_yaml(build_ctx)

    if feature_name not in features:
        log_error(f"Feature '{feature_name}' not found")
        ctx.exit(1)

    # Generate combined patch
    combined_patch = generate_feature_patch(build_ctx, feature_name, features[feature_name])

    if not combined_patch:
        log_error("Failed to generate patch")
        ctx.exit(1)

    # Write to output or stdout
    if output:
        output_path = Path(output)
        try:
            output_path.write_text(combined_patch)
            log_success(f"Generated patch: {output_path}")
        except Exception as e:
            log_error(f"Failed to write patch: {e}")
            ctx.exit(1)
    else:
        click.echo(combined_patch)


def load_features_yaml(ctx: BuildContext) -> Dict:
    """Load features.yaml file"""
    features_path = ctx.get_features_yaml_path()

    if not features_path.exists():
        return {}

    try:
        with open(features_path, 'r') as f:
            data = yaml.safe_load(f) or {}
    except Exception as e:
        log_error(f"Failed to load features file: {e}")
        return {}

    return data.get('features', {})


def save_features_yaml(ctx: BuildContext, features: Dict) -> None:
    """Save features to YAML file"""
    features_path = ctx.get_features_yaml_path()

    data = {
        'version': '1.0',
        'features': features
    }

    try:
        with open(features_path, 'w') as f:
            yaml.dump(data, f, default_flow_style=False, sort_keys=False)
    except Exception as e:
        log_error(f"Failed to save features file: {e}")
        raise


def add_feature_from_commit(ctx: BuildContext, feature_name: str,
                           commit_hash: str, description: Optional[str] = None) -> bool:
    """Add files from a commit to a feature"""

    # Step 1: Get changed files
    changed_files = get_commit_changed_files(commit_hash, ctx.chromium_src)

    if not changed_files:
        log_warning(f"No files changed in commit {commit_hash}")
        return True

    # Step 2: Load features
    features = load_features_yaml(ctx)

    # Step 3-4: Update feature
    if feature_name in features:
        existing_files = set(features[feature_name].get('files', []))
        new_files = set(changed_files) - existing_files

        if new_files:
            features[feature_name]['files'] = list(existing_files | set(changed_files))
            log_info(f"Added {len(new_files)} new files to '{feature_name}'")

            # Update description if provided
            if description:
                features[feature_name]['description'] = description
        else:
            log_info(f"All files already in '{feature_name}'")
    else:
        # Create new feature
        features[feature_name] = {
            'description': description or f"Feature added from commit {commit_hash}",
            'files': changed_files
        }
        log_info(f"Created new feature '{feature_name}' with {len(changed_files)} files")

    # Step 5: Save
    save_features_yaml(ctx, features)
    return True


def generate_feature_patch(ctx: BuildContext, feature_name: str,
                          feature_data: Dict) -> Optional[str]:
    """Generate combined patch for a feature"""

    file_list = feature_data.get('files', [])

    if not file_list:
        log_warning(f"Feature '{feature_name}' has no files")
        return None

    patches = []
    missing_files = []

    for file_path in file_list:
        patch_path = ctx.get_patch_path_for_file(file_path)

        if not patch_path.exists():
            missing_files.append(file_path)
            continue

        try:
            patch_content = patch_path.read_text()
            patches.append(patch_content)
        except Exception as e:
            log_error(f"Failed to read patch {patch_path}: {e}")
            missing_files.append(file_path)

    if missing_files:
        log_warning(f"Missing patches for {len(missing_files)} files:")
        for file_path in missing_files[:5]:  # Show first 5
            log_warning(f"  - {file_path}")
        if len(missing_files) > 5:
            log_warning(f"  ... and {len(missing_files) - 5} more")

    if not patches:
        log_error("No patches found")
        return None

    # Combine patches with separator comments
    combined = []
    combined.append(f"# Combined patch for feature: {feature_name}")
    combined.append(f"# Description: {feature_data.get('description', 'No description')}")
    combined.append(f"# Files: {len(file_list)}")
    combined.append("")

    for patch in patches:
        combined.append(patch)
        if not patch.endswith('\n'):
            combined.append("")

    return '\n'.join(combined)