# BrowserOS 2 Operating Rules

## Source of truth

- Primary tracking doc: `docs/browseros2/PROJECT-OPS.md`
- Use it for roadmap, phases, task list, progress, blockers, and feature intake.

## When to update the tracking doc

- A phase meaningfully advances or completes.
- A major feature request adds a new dependency or blocker.
- A new task becomes part of the critical path.
- Priorities change.
- A material implementation lands and should be reflected in progress.

## What to update

- `Progress Snapshot`
- `Phase Status`
- `Active Task List`
- `Known Bottlenecks`
- `Recent Changes`

## Feature intake rule

When the user asks for a new feature:

1. Map it to an existing phase or workstream.
2. Check whether it is a dependency, accelerator, or distraction.
3. Prefer the smallest slice that improves the critical path.
4. Document any roadmap tradeoff if the request jumps ahead.

## Anti-bottleneck rule

Prefer work that removes one of these bottlenecks:

- unstable runtime behavior
- missing workflow execution capability
- weak watcher triggers
- incomplete integrations
- missing safety, permissioning, or approval layers
- poor observability
- token inefficiency

## Delivery rule

- Keep BrowserOS 2 aligned to `Agent Browser`.
- Preserve compatibility when possible.
- Favor local-first behavior with optional remote augmentation.
- Do not inflate progress percentages without concrete code and verification.
