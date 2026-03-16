---
name: browseros2-project-ops
description: Keep BrowserOS 2 development aligned with the repo roadmap, task list, phase plan, and progress tracking. Use when the user asks to add, change, scope, prioritize, phase, review, or continue BrowserOS 2 features, architecture, integrations, multi-agent capabilities, workflows, watchers, token optimization, security, trading-agent guardrails, or productization. Trigger this skill before substantial BrowserOS 2 work and update the project tracking doc after meaningful changes.
---

# BrowserOS 2 Project Ops

Use this skill to keep BrowserOS 2 work smooth, phased, and consistent.

Read [references/operating-rules.md](references/operating-rules.md) first, then use the workflow below. Treat `docs/browseros2/PROJECT-OPS.md` as the source of truth for phases, progress, active tasks, bottlenecks, and feature intake.

## Workflow

### 1. Rebuild project context
- Read `docs/browseros2/PROJECT-OPS.md`.
- Identify the relevant phase, current progress band, active blockers, and dependencies for the user's request.
- If the request is net-new, map it to an existing phase first. Create a new sub-track only if the request clearly does not fit the current roadmap.

### 2. Convert the request into delivery work
- Classify the request as one of: `foundation`, `runtime`, `workflow`, `watcher`, `integration`, `multi-agent`, `safety`, `product`, or `ops`.
- Decide whether the task is:
  - a current-phase task,
  - a dependency for a current-phase task,
  - a later-phase item that should be deferred,
  - or a cross-cutting improvement that reduces bottlenecks.
- Prefer the smallest valuable slice that moves the roadmap forward without creating drift.

### 3. Execute with roadmap discipline
- Before coding, state which phase or task area the work belongs to.
- Preserve compatibility unless the roadmap explicitly calls for a breaking migration.
- Prefer work that improves one of these outcomes:
  - stronger runtime reliability,
  - lower token cost,
  - better automation coverage,
  - clearer observability,
  - tighter safety and permission boundaries.

### 4. Update project tracking after meaningful changes
- Update `docs/browseros2/PROJECT-OPS.md` when any of these happen:
  - phase completion meaningfully changes,
  - progress percentages materially move,
  - a new strategic task or blocker appears,
  - the user changes priorities,
  - a completed task should move from planned to done.
- Keep updates concise and factual. Do not invent progress.

### 5. Keep future requests aligned automatically
- For every new BrowserOS 2 feature request, re-check:
  - which phase it belongs to,
  - whether it creates a new blocker,
  - whether it affects the current critical path,
  - and whether it should update the active task list.
- If a request conflicts with the roadmap, still help, but explicitly document the tradeoff in `PROJECT-OPS.md`.

## Working rules

- Do not treat the roadmap as static. Refine it when the repo changes materially.
- Do not claim a phase is complete unless code, verification, and project tracking all support that claim.
- Do not let side quests replace the critical path without documenting the priority change.
- Prefer updating the tracking doc in the same turn as the implementation when practical.
- When the user asks for new major capabilities, connect them back to the BrowserOS 2 north star: `Agent Browser`, `multi-agent work`, `local-first plus`, `safe autonomy`.

## Key file

- Source of truth: `docs/browseros2/PROJECT-OPS.md`

## References

- [references/operating-rules.md](references/operating-rules.md)
