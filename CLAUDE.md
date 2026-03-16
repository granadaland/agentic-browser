# Project Instructions

## BrowserOS 2 Project Ops

For BrowserOS 2 roadmap, planning, phase updates, or new feature requests, use the local skill at `.claude/skills/browseros2-project-ops/SKILL.md` and treat `docs/browseros2/PROJECT-OPS.md` as the project source of truth.

## Docs Image Workflow

When updating documentation that involves new screenshots or images:

1. Prompt the user to copy the image to their clipboard (Cmd+C)
2. Run: `python scripts/save_clipboard.py <target_path>`
3. Example: `python scripts/save_clipboard.py docs/images/agent-step.png`

This saves the clipboard image directly to the docs folder without manual file management.
