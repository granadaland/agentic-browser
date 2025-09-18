# Dev CLI Design Document

## 1. Overview

### 1.1 Purpose
The Dev CLI is a patch management system for Chromium development that acts like git but specifically for managing patches against the Chromium codebase. It enables developers to:
- Extract patches from git commits in a Chromium repository
- Store patches as individual file diffs
- Track which files belong to which features
- Apply patches to new Chromium versions with conflict resolution
- Manage the upgrade process when moving to newer Chromium versions

### 1.2 Key Design Principles
- **Simplicity**: Mirror git's command structure and workflow
- **Transparency**: Store patches as readable diff files
- **Flexibility**: Support both individual file and feature-based operations
- **Robustness**: Handle conflicts gracefully during Chromium upgrades

## 2. Architecture

### 2.1 Directory Structure
```
nxtscape/
├── build/
│   ├── dev.py                          # Main CLI entry point
│   ├── context.py                      # Shared BuildContext (used by both build.py and dev.py)
│   └── modules/
│       └── dev_cli/                    # Dev CLI modules
│           ├── __init__.py
│           ├── extract.py              # Extract commands (extract, extract-range)
│           ├── apply.py                # Apply commands (apply --all, apply --feature)
│           ├── feature.py              # Feature management (add, list, show, generate-patch)
│           └── utils.py                # Shared utilities (diff parsing, git commands)
├── chromium_src/                       # Individual file patches (mirrors Chromium structure)
│   ├── chrome/
│   │   ├── app/
│   │   │   └── chrome_command_ids.h.patch
│   │   └── browser/
│   │       └── ui/
│   │           ├── ui_features.h.patch
│   │           └── views/
│   │               └── side_panel/
│   │                   └── third_party_llm/
│   │                       ├── third_party_llm_panel_coordinator.cc.patch
│   │                       └── third_party_llm_view.cc.patch  # New file (diff against /dev/null)
│   └── ...
├── features.yaml                       # Feature to file mapping
└── patches/                            # Legacy patches directory (existing)
    └── browseros/
        └── llm-chat.patch              # Combined patch for reference
```

### 2.2 Module Structure

Each module in `build/modules/dev_cli/` is self-contained and registers its own Click commands:

#### 2.2.1 Module Organization
- **extract.py**: Handles extracting patches from git commits
- **apply.py**: Handles applying patches with conflict resolution
- **feature.py**: Manages feature-to-file mappings
- **utils.py**: Shared utilities for git operations, diff parsing, etc.

#### 2.2.2 BuildContext Integration
The Dev CLI reuses the existing `BuildContext` from `build/context.py` with additional methods:

```python
# In context.py - extended for dev CLI
class BuildContext:
    # ... existing code ...

    def get_dev_patches_dir(self) -> Path:
        """Get individual patches directory (chromium_src/)"""
        return join_paths(self.root_dir, "chromium_src")

    def get_features_yaml_path(self) -> Path:
        """Get features.yaml file path"""
        return join_paths(self.root_dir, "features.yaml")

    def get_patch_path_for_file(self, file_path: str) -> Path:
        """Convert a chromium file path to patch file path"""
        return join_paths(self.get_dev_patches_dir(), f"{file_path}.patch")
```

### 2.2 File Formats

#### 2.2.1 Patch Files (.patch)
Standard unified diff format (git diff output):
```diff
--- a/chrome/app/chrome_command_ids.h
+++ b/chrome/app/chrome_command_ids.h
@@ -290,6 +290,8 @@
 #define IDC_SHOW_HISTORY_SIDE_PANEL     40293
 #define IDC_OPEN_GLIC                   40294
 #define IDC_FIND_EXTENSIONS  40295
+#define IDC_SHOW_THIRD_PARTY_LLM_SIDE_PANEL  40296
+#define IDC_CYCLE_THIRD_PARTY_LLM_PROVIDER  40297
```

New files use /dev/null as the source:
```diff
--- /dev/null
+++ b/chrome/browser/ui/views/side_panel/third_party_llm/third_party_llm_view.cc
@@ -0,0 +1,11 @@
+// Copyright 2024 The Chromium Authors
+// ... file contents ...
```

#### 2.2.2 Features YAML
```yaml
version: 1.0
features:
  llm-chat:
    description: "LLM chat integration in side panel"
    files:
      - chrome/app/chrome_command_ids.h
      - chrome/browser/ui/ui_features.h
      - chrome/browser/ui/views/side_panel/third_party_llm/third_party_llm_panel_coordinator.cc
      - chrome/browser/ui/views/side_panel/third_party_llm/third_party_llm_view.cc

  another-feature:
    description: "Another feature description"
    files:
      - chrome/app/chrome_command_ids.h  # Note: can be in multiple features
      - chrome/browser/some_other_file.cc
```

## 3. Implementation Structure

### 3.1 Main Entry Point (build/dev.py)

The main entry point uses Click's group mechanism to register subcommands from modules:

```python
#!/usr/bin/env python3
"""Dev CLI for Chromium patch management"""

import click
from pathlib import Path
from context import BuildContext
from modules.dev_cli import extract, apply, feature
from utils import log_info, log_error

@click.group()
@click.option('--chromium-src', '-S', type=click.Path(exists=True, path_type=Path),
              help='Path to Chromium source directory')
@click.pass_context
def cli(ctx, chromium_src):
    """Dev CLI - Chromium patch management tool"""
    # Store chromium_src in context for subcommands
    ctx.ensure_object(dict)
    ctx.obj['chromium_src'] = chromium_src or None

# Register subcommand groups from modules
cli.add_command(extract.extract_group)
cli.add_command(apply.apply_group)
cli.add_command(feature.feature_group)

if __name__ == '__main__':
    cli()
```

### 3.2 Module Implementation Examples

#### 3.2.1 Extract Module (build/modules/dev_cli/extract.py)

```python
import click
from pathlib import Path
from context import BuildContext
from modules.dev_cli.utils import run_git_command, parse_diff_output
from utils import log_info, log_error, log_success

@click.group(name='extract')
def extract_group():
    """Extract patches from git commits"""
    pass

@extract_group.command(name='commit')
@click.argument('commit')
@click.pass_context
def extract_commit(ctx, commit):
    """Extract patches from a single commit"""
    chromium_src = ctx.obj.get('chromium_src')
    if not chromium_src:
        log_error("--chromium-src is required")
        return

    # Create BuildContext
    build_ctx = BuildContext(
        root_dir=Path.cwd(),
        chromium_src=chromium_src,
        architecture="",  # Not needed for patch operations
        build_type="debug"  # Not needed for patch operations
    )

    if extract_single_commit(build_ctx, commit):
        log_success(f"Successfully extracted patches from {commit}")
    else:
        log_error(f"Failed to extract patches from {commit}")

@extract_group.command(name='range')
@click.argument('base_commit')
@click.argument('head_commit')
@click.pass_context
def extract_range(ctx, base_commit, head_commit):
    """Extract patches from a range of commits"""
    # Similar implementation...

def extract_single_commit(ctx: BuildContext, commit_hash: str) -> bool:
    """Implementation of single commit extraction"""
    # Implementation as detailed in section 4
    pass
```

#### 3.2.2 Apply Module (build/modules/dev_cli/apply.py)

```python
import click
from pathlib import Path
from context import BuildContext
from modules.dev_cli.utils import apply_single_patch
from utils import log_info, log_error, log_success

@click.group(name='apply')
def apply_group():
    """Apply patches to Chromium source"""
    pass

@apply_group.command(name='all')
@click.option('--commit-each', is_flag=True, help='Create git commit after each patch')
@click.option('--dry-run', is_flag=True, help='Test patches without applying')
@click.pass_context
def apply_all(ctx, commit_each, dry_run):
    """Apply all patches from chromium_src/"""
    chromium_src = ctx.obj.get('chromium_src')
    if not chromium_src:
        log_error("--chromium-src is required")
        return

    build_ctx = BuildContext(
        root_dir=Path.cwd(),
        chromium_src=chromium_src,
        architecture="",
        build_type="debug"
    )

    apply_all_patches(build_ctx, commit_each, dry_run)

@apply_group.command(name='feature')
@click.argument('feature_name')
@click.option('--commit-each', is_flag=True, help='Create git commit after each patch')
@click.option('--dry-run', is_flag=True, help='Test patches without applying')
@click.pass_context
def apply_feature(ctx, feature_name, commit_each, dry_run):
    """Apply patches for a specific feature"""
    # Implementation...
```

#### 3.2.3 Feature Module (build/modules/dev_cli/feature.py)

```python
import click
import yaml
from pathlib import Path
from context import BuildContext
from utils import log_info, log_error, log_success

@click.group(name='feature')
def feature_group():
    """Manage feature-to-file mappings"""
    pass

@feature_group.command(name='add')
@click.argument('feature_name')
@click.argument('commit')
@click.pass_context
def add_feature(ctx, feature_name, commit):
    """Add files from a commit to a feature"""
    # Implementation...

@feature_group.command(name='list')
@click.pass_context
def list_features(ctx):
    """List all features"""
    build_ctx = BuildContext(
        root_dir=Path.cwd(),
        chromium_src=Path.cwd(),  # Not used for listing
        architecture="",
        build_type="debug"
    )

    features = load_features_yaml(build_ctx)
    for name, data in features.items():
        file_count = len(data.get('files', []))
        description = data.get('description', 'No description')
        log_info(f"  {name} ({file_count} files) - {description}")

@feature_group.command(name='show')
@click.argument('feature_name')
@click.pass_context
def show_feature(ctx, feature_name):
    """Show details of a specific feature"""
    # Implementation...
```

## 4. Command Specifications

### 4.1 Extract Commands

#### 4.1.1 `extract commit` - Extract patches from a single commit
```bash
dev-cli --chromium-src <path> extract commit <commit-hash>
# or
dev-cli extract commit <commit-hash>  # if chromium-src is in config
```

**Implementation Steps:**
1. Validate commit exists in the repository
2. Get diff for the commit: `git diff <commit>^..<commit>`
3. Parse diff output to identify changed files
4. For each changed file:
   - Extract the file path relative to chromium src
   - Detect if file is new (doesn't exist in parent commit) or modified
   - Create directory structure in `chromium_src/` mirroring the file path
   - Write individual patch file with `.patch` extension
5. Log summary of extracted patches

**Code Structure:**
```python
def extract_single_commit(commit_hash: str, chromium_src: Path) -> bool:
    # Step 1: Validate commit
    if not validate_commit_exists(commit_hash, chromium_src):
        return False

    # Step 2: Get diff
    diff_output = run_git_command(['git', 'diff', f'{commit_hash}^..{commit_hash}'],
                                  cwd=chromium_src)

    # Step 3: Parse diff into file patches
    file_patches = parse_diff_output(diff_output)

    # Step 4: Write individual patches
    for file_path, patch_content in file_patches.items():
        write_patch_file(file_path, patch_content)

    # Step 5: Log summary
    log_extraction_summary(file_patches)
    return True
```

#### 4.1.2 `extract range` - Extract patches from a range of commits
```bash
dev-cli --chromium-src <path> extract range <base-commit> <head-commit>
```

**Implementation Steps:**
1. Validate both commits exist
2. Get cumulative diff: `git diff <base>..<head>`
3. Parse diff to identify all changed files
4. For each file:
   - Detect if new or modified (check if exists at base commit)
   - Create/update patch file in `chromium_src/`
5. Handle file deletions (create `.deleted` marker files)
6. Log summary with statistics

**Code Structure:**
```python
def extract_commit_range(base_commit: str, head_commit: str, chromium_src: Path) -> bool:
    # Step 1: Validate commits
    if not validate_commit_exists(base_commit, chromium_src):
        return False
    if not validate_commit_exists(head_commit, chromium_src):
        return False

    # Step 2: Get cumulative diff
    diff_output = run_git_command(['git', 'diff', f'{base_commit}..{head_commit}'],
                                  cwd=chromium_src)

    # Step 3-5: Process diff
    file_patches = parse_diff_output(diff_output)

    for file_path, patch_content in file_patches.items():
        if patch_content is None:  # File was deleted
            create_deletion_marker(file_path)
        else:
            write_patch_file(file_path, patch_content)

    # Step 6: Log summary
    log_extraction_summary(file_patches)
    return True
```

### 4.2 Apply Commands

#### 4.2.1 `apply all` - Apply all patches
```bash
dev-cli --chromium-src <path> apply all [--commit-each] [--dry-run]
```

**Implementation Steps:**
1. Validate chromium_src is a git repository
2. If `--dry-run`, check which patches would apply cleanly
3. Recursively find all `.patch` files in `chromium_src/` directory
4. Sort patches alphabetically by path (deterministic order)
5. For each patch:
   - Apply using `git apply -p1 <patch>`
   - If conflict, handle based on conflict resolution flow
   - If `--commit-each`, create git commit after successful application
6. Report summary of applied/failed patches

**Conflict Resolution Flow:**
```python
def handle_patch_conflict(patch_path: Path, chromium_src: Path) -> bool:
    print(f"CONFLICT: {patch_path}")
    print("Options:")
    print("  1) Fix manually and continue")
    print("  2) Skip this patch")
    print("  3) Abort all remaining patches")

    while True:
        choice = input("Enter choice (1-3): ")
        if choice == "1":
            input("Fix the conflicts and press Enter to continue...")
            return True  # Continue with next patch
        elif choice == "2":
            print(f"Skipping {patch_path}")
            return True  # Skip but continue
        elif choice == "3":
            return False  # Abort
```

#### 4.2.2 `apply feature` - Apply patches for a specific feature
```bash
dev-cli --chromium-src <path> apply feature <feature-name> [--commit-each] [--dry-run]
```

**Implementation Steps:**
1. Load `features.yaml` file
2. Validate feature exists in the YAML
3. Get list of files for the feature
4. For each file in the feature:
   - Construct patch file path in `chromium_src/`
   - Apply patch using same logic as `apply --all`
5. Handle conflicts with same resolution flow
6. Report feature-specific summary

**Code Structure:**
```python
def apply_feature_patches(feature_name: str, chromium_src: Path,
                         commit_each: bool = False) -> bool:
    # Step 1-2: Load and validate
    features = load_features_yaml()
    if feature_name not in features:
        print(f"Feature '{feature_name}' not found")
        return False

    # Step 3: Get file list
    file_list = features[feature_name]['files']

    # Step 4-5: Apply patches
    success_count = 0
    fail_count = 0

    for file_path in file_list:
        patch_path = construct_patch_path(file_path)
        if apply_single_patch(patch_path, chromium_src):
            success_count += 1
            if commit_each:
                create_git_commit(f"Apply {feature_name}: {file_path}")
        else:
            fail_count += 1

    # Step 6: Report
    print(f"Feature '{feature_name}': {success_count} applied, {fail_count} failed")
    return fail_count == 0
```

### 4.3 Feature Management Commands

#### 4.3.1 `feature add` - Add files from a commit to a feature
```bash
dev-cli --chromium-src <path> feature add <feature-name> <commit-hash>
```

**Implementation Steps:**
1. Get list of files changed in the commit
2. Load or create `features.yaml`
3. Add/update feature entry with file list
4. Detect duplicates and warn
5. Save updated YAML

**Code Structure:**
```python
def add_feature_from_commit(feature_name: str, commit_hash: str,
                           chromium_src: Path) -> bool:
    # Step 1: Get changed files
    changed_files = get_commit_changed_files(commit_hash, chromium_src)

    # Step 2: Load features
    features = load_features_yaml()

    # Step 3-4: Update feature
    if feature_name in features:
        existing_files = set(features[feature_name]['files'])
        new_files = set(changed_files) - existing_files
        if new_files:
            features[feature_name]['files'].extend(new_files)
            print(f"Added {len(new_files)} new files to '{feature_name}'")
        else:
            print(f"All files already in '{feature_name}'")
    else:
        features[feature_name] = {
            'description': f"Feature added from commit {commit_hash}",
            'files': changed_files
        }
        print(f"Created new feature '{feature_name}' with {len(changed_files)} files")

    # Step 5: Save
    save_features_yaml(features)
    return True
```

#### 4.3.2 `feature list` - List all features
```bash
dev-cli feature list
```

**Implementation Steps:**
1. Load `features.yaml`
2. Display formatted list of features with file counts
3. Show features sorted alphabetically

**Output Example:**
```
Features:
  llm-chat (4 files) - LLM chat integration in side panel
  another-feature (2 files) - Another feature description

Total: 2 features, 6 unique files
```

#### 4.3.3 `feature show` - Show details of a feature
```bash
dev-cli feature show <feature-name>
```

**Implementation Steps:**
1. Load `features.yaml`
2. Validate feature exists
3. Display feature details and file list
4. Check patch status for each file

**Output Example:**
```
Feature: llm-chat
Description: LLM chat integration in side panel
Files (4):
  ✓ chrome/app/chrome_command_ids.h
  ✓ chrome/browser/ui/ui_features.h
  ✗ chrome/browser/ui/views/side_panel/third_party_llm/third_party_llm_panel_coordinator.cc (patch missing)
  ✓ chrome/browser/ui/views/side_panel/third_party_llm/third_party_llm_view.cc
```

#### 4.3.4 `feature generate-patch` - Generate combined patch for a feature
```bash
dev-cli feature generate-patch <feature-name> [--output <path>]
```

**Implementation Steps:**
1. Load feature file list from YAML
2. Concatenate all individual patches in order
3. Generate unified patch header
4. Write to output file or stdout

## 4. Core Modules Implementation

### 4.1 Diff Parser Module
```python
# modules/diff_parser.py

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
            if current_file:
                patches[current_file] = '\n'.join(current_patch)

            # Parse new file path
            parts = line.split()
            current_file = parts[2][2:] if parts[2].startswith('a/') else parts[2]
            current_patch = [line]

        elif line.startswith('deleted file'):
            patches[current_file] = None  # Mark as deleted

        elif current_file:
            current_patch.append(line)

    # Save last patch
    if current_file:
        patches[current_file] = '\n'.join(current_patch) if current_patch else None

    return patches
```

### 4.2 Patch Writer Module
```python
# modules/patch_writer.py

def write_patch_file(file_path: str, patch_content: str) -> bool:
    """
    Write a patch file to chromium_src directory structure.
    """
    # Construct output path
    output_path = Path('chromium_src') / file_path
    output_path = output_path.with_suffix(output_path.suffix + '.patch')

    # Create directory structure
    output_path.parent.mkdir(parents=True, exist_ok=True)

    # Write patch content
    output_path.write_text(patch_content)

    print(f"  Written: {output_path}")
    return True

def create_deletion_marker(file_path: str) -> bool:
    """
    Create a marker file for deleted files.
    """
    marker_path = Path('chromium_src') / file_path
    marker_path = marker_path.with_suffix(marker_path.suffix + '.deleted')

    marker_path.parent.mkdir(parents=True, exist_ok=True)
    marker_path.write_text(f"File deleted in patch\n")

    print(f"  Marked deleted: {marker_path}")
    return True
```

### 4.3 Patch Application Module
```python
# modules/patch_apply.py

def apply_single_patch(patch_path: Path, chromium_src: Path,
                       interactive: bool = True) -> bool:
    """
    Apply a single patch file to chromium source.
    """
    if not patch_path.exists():
        print(f"Patch file not found: {patch_path}")
        return False

    # Try standard apply
    cmd = ['git', 'apply', '-p1', str(patch_path)]
    result = run_command(cmd, cwd=chromium_src, capture=True)

    if result.returncode == 0:
        print(f"  ✓ Applied: {patch_path.name}")
        return True

    # Try 3-way merge
    cmd.append('--3way')
    result = run_command(cmd, cwd=chromium_src, capture=True)

    if result.returncode == 0:
        print(f"  ✓ Applied (3-way): {patch_path.name}")
        return True

    # Handle conflict
    if interactive:
        return handle_patch_conflict(patch_path, chromium_src)
    else:
        print(f"  ✗ Failed: {patch_path.name}")
        return False
```

### 4.4 Feature Manager Module
```python
# modules/feature_manager.py

def load_features_yaml() -> Dict:
    """Load features.yaml file."""
    features_path = Path('features.yaml')
    if not features_path.exists():
        return {'version': '1.0', 'features': {}}

    with open(features_path) as f:
        data = yaml.safe_load(f)

    return data.get('features', {})

def save_features_yaml(features: Dict) -> None:
    """Save features to YAML file."""
    features_path = Path('features.yaml')

    data = {
        'version': '1.0',
        'features': features
    }

    with open(features_path, 'w') as f:
        yaml.dump(data, f, default_flow_style=False, sort_keys=False)
```

## 5. Error Handling

### 5.1 Common Error Scenarios

1. **Invalid Chromium Source Path**
   - Check if path exists and is a git repository
   - Check for presence of chromium markers (BUILD.gn, chrome/ directory)

2. **Git Command Failures**
   - Wrap all git commands in try-except
   - Provide clear error messages with git stderr output
   - Suggest fixes (e.g., "commit not found, check if you're in the right branch")

3. **Patch Conflicts**
   - Detect via git apply return code
   - Offer interactive resolution
   - Allow skipping problematic patches

4. **File Permission Issues**
   - Check write permissions before operations
   - Provide clear error messages about permission requirements

5. **Malformed YAML**
   - Validate YAML structure on load
   - Provide line numbers for syntax errors
   - Create backup before modifying

### 5.2 Error Recovery
```python
def safe_operation(operation_func, *args, **kwargs):
    """
    Wrapper for safe execution with rollback capability.
    """
    backup_created = False
    try:
        # Create backup if modifying files
        if kwargs.get('create_backup', True):
            create_backup()
            backup_created = True

        # Execute operation
        result = operation_func(*args, **kwargs)

        # Clean up backup on success
        if backup_created:
            cleanup_backup()

        return result

    except Exception as e:
        print(f"Error: {e}")

        if backup_created:
            if prompt_yes_no("Restore from backup?"):
                restore_backup()

        raise
```

## 6. Configuration

### 6.1 CLI Configuration File (.dev-cli.yaml)
```yaml
# Optional configuration file
defaults:
  chromium_src: /path/to/chromium/src
  auto_commit: false
  interactive: true

aliases:
  # Short aliases for common operations
  up: "extract-range HEAD~1 HEAD"
  fix: "apply --all --commit-each"
```

### 6.2 Environment Variables
```bash
DEV_CLI_CHROMIUM_SRC=/path/to/chromium/src
DEV_CLI_AUTO_COMMIT=true
DEV_CLI_INTERACTIVE=false
```

## 7. Testing Strategy

### 7.1 Unit Tests
- Test diff parsing with various git diff outputs
- Test patch file writing and directory creation
- Test YAML loading/saving
- Test conflict detection

### 7.2 Integration Tests
- Create test repository with known commits
- Test extract commands with various commit scenarios
- Test apply commands with clean and conflicting patches
- Test feature management operations

### 7.3 End-to-End Tests
- Full workflow: extract → apply → fix conflicts → re-extract
- Chromium version upgrade simulation
- Multi-feature patch management

## 8. Implementation Phases

### Phase 1: Core Infrastructure (Foundation)
1. Create main CLI entry point with argument parsing
2. Implement configuration loading (CLI args, config file, env vars)
3. Create basic project structure and modules
4. Implement logging and error handling framework

### Phase 2: Extract Commands
1. Implement git command execution wrapper
2. Create diff parser module
3. Implement `extract` command for single commits
4. Implement `extract-range` command for commit ranges
5. Add patch file writer with directory structure creation

### Phase 3: Apply Commands
1. Implement patch discovery (finding .patch files)
2. Create patch application logic with git apply
3. Add conflict detection and resolution flow
4. Implement `apply --all` command
5. Add `--commit-each` support
6. Implement `--dry-run` mode

### Phase 4: Feature Management
1. Create YAML file handler for features.yaml
2. Implement `feature add` command
3. Implement `feature list` command
4. Implement `feature show` command
5. Add `apply --feature` command
6. Implement `feature generate-patch` command

### Phase 5: Polish and Optimization
1. Add progress bars for long operations
2. Implement caching for repeated operations
3. Add verbose and quiet modes
4. Create comprehensive help documentation
5. Add shell completion scripts

## 9. CLI Usage Examples

### 9.1 Initial Setup
```bash
# Set chromium source path (can also be in config)
export CHROMIUM_SRC=~/chromium/src

# Extract patches from existing work
dev-cli --chromium-src $CHROMIUM_SRC extract range chromium-base HEAD

# Create feature from recent commit
dev-cli --chromium-src $CHROMIUM_SRC feature add llm-chat HEAD~1
```

### 9.2 Daily Development
```bash
# Make changes in chromium repo, commit them
cd ~/chromium/src
git add -A
git commit -m "Fix: Updated LLM chat UI"

# Extract the changes to patches
dev-cli --chromium-src . extract commit HEAD

# Or update patches from a range
dev-cli --chromium-src . extract range main HEAD
```

### 9.3 Chromium Upgrade Workflow
```bash
# Check what will apply cleanly
dev-cli --chromium-src $CHROMIUM_SRC apply all --dry-run

# Apply all patches with commit tracking
dev-cli --chromium-src $CHROMIUM_SRC apply all --commit-each

# If conflicts occur:
# 1. Fix conflicts in chromium/src
# 2. Press Enter to continue applying remaining patches
# 3. Build and test
# 4. Extract all changes to update patches

dev-cli --chromium-src $CHROMIUM_SRC extract range chromium-base HEAD
```

### 9.4 Feature-based Operations
```bash
# Apply only LLM chat feature
dev-cli --chromium-src $CHROMIUM_SRC apply feature llm-chat

# See what's in a feature
dev-cli feature show llm-chat

# Generate combined patch for sharing
dev-cli feature generate-patch llm-chat --output llm-chat-combined.patch
```

## 10. Future Enhancements (Not in MVP)

1. **Patch Dependencies**: Track which patches depend on others
2. **Automatic Conflict Resolution**: Use AI/heuristics for simple conflicts
3. **Patch Versioning**: Track patch history across Chromium versions
4. **Collaboration Features**: Share patches via git/cloud
5. **Build Integration**: Trigger builds after successful patch application
6. **Patch Validation**: Pre-check if patches will build before applying
7. **Bisect Support**: Find which patch broke the build
8. **Patch Statistics**: Track success rates across versions

## 11. Success Criteria

The dev CLI will be considered successful when:
1. Developers can extract patches from any git commit or range
2. Patches can be applied to clean Chromium with clear conflict resolution
3. Features can be tracked and managed independently
4. The Chromium upgrade process is streamlined and predictable
5. The tool requires minimal manual intervention for common operations
6. Error messages are clear and actionable
7. The tool is faster than manual patch management

## 12. Non-Goals

The following are explicitly NOT goals for this tool:
1. Managing chromium source code fetching/syncing (use depot_tools)
2. Building chromium (use existing build system)
3. Managing git branches (use git directly)
4. Automatic merge conflict resolution (manual resolution required)
5. Patch optimization or combination (maintain 1:1 file mapping)