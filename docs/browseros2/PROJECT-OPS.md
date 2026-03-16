# BrowserOS 2 Project Ops

Last updated: 2026-03-17

## North Star

Build BrowserOS 2 as a local-first `Agent Browser` that can plan, operate, verify, delegate to worker agents, integrate with browser-native and cloud tools, and execute meaningful work safely with strong observability and controlled autonomy.

## Guiding Principles

- Local-first plus: core flows work locally, remote is optional.
- Safe autonomy: powerful by default, unrestricted only with explicit user consent and guardrails.
- Artifact-first execution: large outputs become retrievable artifacts, not bloated prompt context.
- Measured progress: roadmap claims must match code, verification, and real status.
- Bottleneck-first delivery: remove blockers before adding surface area.

## Progress Snapshot

- Backend/runtime foundation: `45-55%`
- Workflow and watcher platform: `55-65%`
- Product UX maturity: `25-35%`
- Token optimization strategy: `35-45%`
- Security, governance, compliance, permissioning: `20-30%`
- Full BrowserOS 2 vision overall: `20-30%`

## Phase Status

### Phase 1: Runtime Foundation
Status: `in progress`, high completion

Delivered:
- `runProfile`, `budgetPolicy`, `artifactPolicy`, `contextPolicy`, `resumeRunId`
- persisted run timeline, artifacts, context packets, routing policy, budget stats
- planner/executor/verifier runtime direction with compatibility fallback
- adaptive routing metadata and better skill selection

Remaining:
- strengthen recovery behavior and checkpoint restore flow
- finish cost/routing inspection surfaces end to end

### Phase 2: Workflow, Watchers, Observability
Status: `in progress`, medium-high completion

Delivered:
- Workflow 2 persistence and run history
- watcher definitions and watcher run persistence
- local workflow IR executor for linear graphs
- run timeline and replay foundations
- hardened agent typecheck pipeline split by scope

Remaining:
- richer watcher triggers
- stronger replay UI detail
- complete workflow runtime beyond linear mode

### Phase 3: Workflow Runtime Completion
Status: `next critical phase`

Target:
- branch and condition support
- loops, fork/join handling
- graph-to-IR compiler that is stable and inspectable
- workflow debugger and execution trace

### Phase 4: Integrations Layer
Status: `planned`

Target:
- Gmail, Drive, Docs, Sheets
- social platform operator flows where allowed
- AI generation platform connectors
- safer auth, token vaulting, and scoped access

### Phase 5: Multi-Agent Ops
Status: `planned`

Target:
- supervisor agent
- worker agents for research, execution, verification, writing, scheduling, risk
- delegated task model with approvals and auditability

### Phase 6: Context OS and Token Efficiency
Status: `planned`

Target:
- hierarchical memory
- page cache and workspace memory reuse
- artifact retrieval on demand
- stronger budget accounting and prompt compaction

### Phase 7: Safety, Permissioning, Governance
Status: `planned`, must grow alongside integrations

Target:
- approval policies
- permission scopes by tool and agent role
- audit trails and action replay
- security hardening for powerful local and VPS deployments

### Phase 8: Productization and VPS Readiness
Status: `planned`

Target:
- stable templates and starter packs
- deployment guidance for isolated runners and VPS setups
- operational health metrics
- clear user-facing controls and disclaimers

## Active Task List

### Current critical path

- [ ] Extend local workflow IR executor to support branching and conditions.
- [ ] Add richer watcher triggers such as selector-based and content-diff checks.
- [ ] Deepen run replay with routing reasons, budget stats, and failure analysis.
- [ ] Build integration scaffolding for Google Workspace and selected browser tools.
- [ ] Introduce capability-level permissioning and approval policies.

### Near-term reliability work

- [ ] Finish resumable checkpoint restore semantics.
- [ ] Add stronger run recovery and retry categorization.
- [ ] Add end-to-end validation for watcher reliability.
- [ ] Add benchmark tasks to measure completion rate and token cost improvements.

### Strategic later tasks

- [ ] Build multi-agent supervisor and worker delegation model.
- [ ] Add integration packs for social, research, and content workflows.
- [ ] Define VPS runner topology and secret isolation model.
- [ ] Add governance and compliance surfaces for sensitive capabilities.

## Minimum Beta Checklist

BrowserOS 2 can move from `alpha internal` to `beta siap pakai` only when the items below are complete enough for limited external users to succeed without constant developer intervention.

### 1. Core runtime reliability

- [ ] Planner, executor, and verifier flow is stable for normal runs.
- [ ] Resume and checkpoint restore works for interrupted runs.
- [ ] Run failures are categorized clearly enough to support recovery and debugging.
- [ ] At least one reproducible benchmark set exists for regression checking.

Exit criteria:
- common agent tasks complete consistently across repeated runs
- interrupted runs do not require full restart in the common case

### 2. Workflow execution

- [ ] Local workflow IR supports branching and conditions.
- [ ] Linear and branched workflows can run without falling back unpredictably.
- [ ] Workflow run history, logs, and replay are readable by operators.
- [ ] At least a small starter set of workflow templates is usable end to end.

Exit criteria:
- a non-trivial workflow can be created, saved, replayed, and rerun successfully

### 3. Watcher reliability

- [ ] Watchers support richer triggers such as selector or content-diff checks.
- [ ] Watcher retries and backoff are stable.
- [ ] Duplicate or noisy watcher firing is reduced enough for real use.
- [ ] Watcher run results are inspectable in the UI.

Exit criteria:
- a watcher can monitor a real page over time without excessive false triggers

### 4. Integrations baseline

- [ ] Google Workspace baseline exists for Gmail, Drive, Docs, or Sheets in at least a limited useful form.
- [ ] Authentication flow is stable and uses scoped access.
- [ ] Browser-native tool usage and integration-backed usage can coexist cleanly.
- [ ] At least one AI generation platform connector is proven end to end.

Exit criteria:
- users can complete a small but real cross-tool workflow without manual backend intervention

### 5. Safety and permissioning

- [ ] Capability-level permissions exist for sensitive actions.
- [ ] Approval flow exists for destructive, publish, payment, or other high-risk actions.
- [ ] Audit trail and run replay capture what the agent did and why.
- [ ] Default behavior is constrained enough for limited beta users.

Exit criteria:
- beta users can inspect actions and stop risky behavior without developer help

### 6. Product UX baseline

- [ ] Command-center style entry points are understandable enough for `ask`, `do`, `research`, `build`, and `watch`.
- [ ] Run timeline and replay expose routing reasons, budget stats, and major failures.
- [ ] Empty states, loading states, and recovery states are clear enough for non-developers.
- [ ] Core user flows do not require repo knowledge to operate.

Exit criteria:
- a motivated beta user can use the product without constant walkthroughs from the team

### 7. Token and cost visibility

- [ ] Budget stats are surfaced clearly per run.
- [ ] Routing reasons are visible enough to explain model choices.
- [ ] Large tool outputs are artifact-first in common flows.
- [ ] At least one token-efficiency benchmark is tracked over time.

Exit criteria:
- the team can explain where cost is going and whether BrowserOS 2 is improving

### 8. Beta operations

- [ ] Basic deployment or installation path is repeatable.
- [ ] Error reporting and support triage path is defined.
- [ ] Beta template library exists for a few high-value jobs.
- [ ] Known limitations are documented honestly.

Exit criteria:
- the team can onboard a limited beta cohort and support them without chaos

## Beta Gate

Do not call BrowserOS 2 `beta siap pakai` until all of these are true:

- critical-path tasks for workflow runtime, watcher reliability, replay, integrations, and permissioning are no longer in a fragile state
- at least one integration-backed workflow and one browser-native workflow are both successful end to end
- run inspection is good enough to debug failures without digging through raw internals every time
- beta users can recover from common issues using the product surfaces that exist
- the team has a short known-limitations list instead of hidden breakage

## Beta Delivery Sprints

### Sprint 1: Runtime and Workflow Reliability

Primary goal:
- remove the biggest alpha blockers in execution reliability and workflow capability

Must ship:
- [ ] Extend local workflow IR executor to support branching and conditions.
- [ ] Improve checkpoint restore and resumable run behavior for common interruption cases.
- [ ] Add clearer failure categories in run timeline and replay.
- [ ] Expose routing reasons and budget stats more clearly in replay surfaces.
- [ ] Add a small benchmark suite for repeated regression checks.

Nice to have:
- [ ] First pass on workflow debugger or execution trace improvements.
- [ ] Reduce prompt bloat further through artifact-first handling in common flows.

Sprint 1 exit criteria:
- non-trivial workflows with branches can run successfully
- interrupted runs commonly resume without full restart
- developers can debug common failures using product surfaces instead of raw internals

### Sprint 2: Watchers, Integrations, and Safety Baseline

Primary goal:
- make BrowserOS 2 useful for real tasks across pages and tools while staying controlled

Must ship:
- [ ] Add richer watcher triggers such as selector-based checks and content-diff checks.
- [ ] Stabilize watcher retry, backoff, and duplicate suppression behavior.
- [ ] Deliver at least one useful Google Workspace integration baseline.
- [ ] Introduce capability-level permissioning for sensitive tools and actions.
- [ ] Add approval flow for destructive, publish, or other high-risk actions.
- [ ] Ensure audit trail and replay capture action intent and major outcomes.

Nice to have:
- [ ] Add a second integration target beyond Google Workspace.
- [ ] Add starter templates for watcher-based monitoring and scheduled work.

Sprint 2 exit criteria:
- a watcher can monitor a real page over time with acceptable noise
- a user can complete one real cross-tool workflow end to end
- risky actions are no longer unconstrained by default

### Sprint 3: Beta UX, Templates, and Operations

Primary goal:
- make the system understandable and supportable for limited external beta users

Must ship:
- [ ] Polish command-center style entry points for `ask`, `do`, `research`, `build`, and `watch`.
- [ ] Improve empty, loading, recovery, and error states for core flows.
- [ ] Ship a small beta template library for high-value tasks.
- [ ] Define repeatable install or deployment path for the beta cohort.
- [ ] Document known limitations and support workflow clearly.
- [ ] Add at least one token-efficiency trend metric the team can track over time.

Nice to have:
- [ ] Add early Deep Research workflow polish.
- [ ] Add onboarding or guided setup for first-time beta users.

Sprint 3 exit criteria:
- a motivated beta user can onboard and complete core flows without constant team guidance
- the team can support a small beta group without operational chaos
- BrowserOS 2 meets the beta gate above with known limitations documented honestly

## Known Bottlenecks

- Workflow runtime still falls back for advanced graph patterns.
- Watcher triggers are not yet rich enough for high-confidence automation.
- Product UX does not yet expose the full BrowserOS 2 power cleanly.
- Security, permissioning, and approval surfaces lag behind capability growth.
- Integrations are still narrower than the long-term agent-operator vision.

## Feature Intake Protocol

When a new feature request arrives:

1. Map it to one of these workstreams: `runtime`, `workflow`, `watcher`, `integration`, `multi-agent`, `token`, `safety`, `product`, `ops`.
2. Decide whether it belongs to the current critical path.
3. If yes, implement the smallest useful slice.
4. If not, document it in the appropriate phase before or alongside implementation.
5. Update this file after meaningful progress.

## Definition of Done

A major BrowserOS 2 task is only considered done when:

- code is implemented
- verification is run or the verification gap is stated clearly
- compatibility impact is understood
- this document reflects the new status

## Recent Changes

- Added BrowserOS 2 project operations skill to `.claude/skills/browseros2-project-ops/`.
- Added this project tracking document as the roadmap and status source of truth.
- Hardened `@browseros/agent` typecheck pipeline into smaller scoped checks to avoid monolithic OOM failures.
- Landed Workflow 2 persistence, watcher persistence, and local IR linear execution foundations in prior implementation work.
- Added a minimum beta-readiness checklist and beta gate criteria.
- Broke beta-readiness work into Sprint 1, Sprint 2, and Sprint 3 delivery phases.
