/**
 * @license
 * Copyright 2025 BrowserOS
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */
import type { Database } from 'bun:sqlite'

// id is the conversation_id - using it as PK ensures same conversation is only counted once
const RATE_LIMITER_TABLE = `
CREATE TABLE IF NOT EXISTS rate_limiter (
  id TEXT PRIMARY KEY,
  browseros_id TEXT NOT NULL,
  provider TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
)`

const IDENTITY_TABLE = `
CREATE TABLE IF NOT EXISTS identity (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  browseros_id TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
)`

const RUNS_TABLE = `
CREATE TABLE IF NOT EXISTS runs (
  id TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL,
  profile TEXT NOT NULL,
  status TEXT NOT NULL,
  stage TEXT,
  provider TEXT NOT NULL,
  model TEXT NOT NULL,
  resumed_from_run_id TEXT,
  request_message TEXT NOT NULL,
  budget_policy_json TEXT,
  artifact_policy_json TEXT,
  context_policy_json TEXT,
  routing_policy_json TEXT,
  browser_context_json TEXT,
  verification_summary TEXT,
  error_text TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
)`

const RUNS_CONVERSATION_INDEX = `
CREATE INDEX IF NOT EXISTS idx_runs_conversation_created_at
ON runs(conversation_id, created_at DESC)
`

const RUN_EVENTS_TABLE = `
CREATE TABLE IF NOT EXISTS run_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  run_id TEXT NOT NULL,
  type TEXT NOT NULL,
  stage TEXT,
  title TEXT NOT NULL,
  detail TEXT,
  data_json TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (run_id) REFERENCES runs(id) ON DELETE CASCADE
)`

const RUN_EVENTS_INDEX = `
CREATE INDEX IF NOT EXISTS idx_run_events_run_id_created_at
ON run_events(run_id, created_at ASC)
`

const RUN_CHECKPOINTS_TABLE = `
CREATE TABLE IF NOT EXISTS run_checkpoints (
  id TEXT PRIMARY KEY,
  run_id TEXT NOT NULL,
  label TEXT NOT NULL,
  stage TEXT,
  status TEXT NOT NULL,
  data_json TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (run_id) REFERENCES runs(id) ON DELETE CASCADE
)`

const RUN_CHECKPOINTS_INDEX = `
CREATE INDEX IF NOT EXISTS idx_run_checkpoints_run_id_created_at
ON run_checkpoints(run_id, created_at ASC)
`

const RUN_ARTIFACTS_TABLE = `
CREATE TABLE IF NOT EXISTS run_artifacts (
  id TEXT PRIMARY KEY,
  run_id TEXT NOT NULL,
  kind TEXT NOT NULL,
  name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  mime_type TEXT,
  preview_text TEXT,
  byte_size INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (run_id) REFERENCES runs(id) ON DELETE CASCADE
)`

const RUN_ARTIFACTS_INDEX = `
CREATE INDEX IF NOT EXISTS idx_run_artifacts_run_id_created_at
ON run_artifacts(run_id, created_at ASC)
`

const CONTEXT_PACKETS_TABLE = `
CREATE TABLE IF NOT EXISTS context_packets (
  id TEXT PRIMARY KEY,
  run_id TEXT NOT NULL,
  conversation_id TEXT NOT NULL,
  packet_type TEXT NOT NULL,
  packet_key TEXT NOT NULL,
  summary TEXT NOT NULL,
  data_json TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (run_id) REFERENCES runs(id) ON DELETE CASCADE
)`

const CONTEXT_PACKETS_INDEX = `
CREATE INDEX IF NOT EXISTS idx_context_packets_conversation_created_at
ON context_packets(conversation_id, created_at DESC)
`

const ROUTING_POLICIES_TABLE = `
CREATE TABLE IF NOT EXISTS routing_policies (
  id TEXT PRIMARY KEY,
  run_id TEXT NOT NULL,
  strategy TEXT NOT NULL,
  profile TEXT NOT NULL,
  stage_models_json TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (run_id) REFERENCES runs(id) ON DELETE CASCADE
)`

const BUDGET_STATS_TABLE = `
CREATE TABLE IF NOT EXISTS budget_stats (
  run_id TEXT PRIMARY KEY,
  request_chars INTEGER NOT NULL DEFAULT 0,
  browser_context_chars INTEGER NOT NULL DEFAULT 0,
  available_skills_count INTEGER NOT NULL DEFAULT 0,
  available_skills_chars INTEGER NOT NULL DEFAULT 0,
  selected_skills_count INTEGER NOT NULL DEFAULT 0,
  selected_skills_chars INTEGER NOT NULL DEFAULT 0,
  context_packets_count INTEGER NOT NULL DEFAULT 0,
  artifact_count INTEGER NOT NULL DEFAULT 0,
  externalized_chars INTEGER NOT NULL DEFAULT 0,
  tool_call_count INTEGER NOT NULL DEFAULT 0,
  source_count INTEGER NOT NULL DEFAULT 0,
  assistant_output_chars INTEGER NOT NULL DEFAULT 0,
  estimated_input_tokens INTEGER NOT NULL DEFAULT 0,
  estimated_output_tokens INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (run_id) REFERENCES runs(id) ON DELETE CASCADE
)`

const WORKFLOW_DEFINITIONS_TABLE = `
CREATE TABLE IF NOT EXISTS workflow_definitions (
  id TEXT PRIMARY KEY,
  legacy_workflow_id TEXT,
  code_id TEXT,
  version INTEGER NOT NULL DEFAULT 1,
  name TEXT NOT NULL,
  description TEXT,
  source TEXT NOT NULL DEFAULT 'local',
  run_profile TEXT NOT NULL DEFAULT 'do',
  graph_json TEXT,
  ir_json TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
)`

const WORKFLOW_RUNS_TABLE = `
CREATE TABLE IF NOT EXISTS workflow_runs (
  id TEXT PRIMARY KEY,
  workflow_definition_id TEXT NOT NULL,
  source_workflow_id TEXT,
  run_profile TEXT NOT NULL DEFAULT 'do',
  status TEXT NOT NULL,
  request_json TEXT,
  result_json TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (workflow_definition_id) REFERENCES workflow_definitions(id) ON DELETE CASCADE
)`

const WORKFLOW_RUNS_INDEX = `
CREATE INDEX IF NOT EXISTS idx_workflow_runs_definition_created_at
ON workflow_runs(workflow_definition_id, created_at DESC)
`

const WATCHERS_TABLE = `
CREATE TABLE IF NOT EXISTS watchers (
  id TEXT PRIMARY KEY,
  legacy_job_id TEXT,
  version INTEGER NOT NULL DEFAULT 1,
  name TEXT NOT NULL,
  description TEXT,
  query TEXT NOT NULL,
  run_profile TEXT NOT NULL DEFAULT 'watch',
  schedule_json TEXT NOT NULL,
  trigger_json TEXT,
  notification_policy_json TEXT,
  retry_policy_json TEXT,
  enabled INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'idle',
  last_run_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
)`

const WATCHERS_INDEX = `
CREATE INDEX IF NOT EXISTS idx_watchers_updated_at
ON watchers(updated_at DESC)
`

const WATCHER_RUNS_TABLE = `
CREATE TABLE IF NOT EXISTS watcher_runs (
  id TEXT PRIMARY KEY,
  watcher_id TEXT NOT NULL,
  legacy_run_id TEXT,
  linked_run_id TEXT,
  status TEXT NOT NULL,
  result_text TEXT,
  final_result_text TEXT,
  execution_log TEXT,
  tool_calls_json TEXT,
  error_text TEXT,
  started_at TEXT NOT NULL,
  completed_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (watcher_id) REFERENCES watchers(id) ON DELETE CASCADE
)`

const WATCHER_RUNS_INDEX = `
CREATE INDEX IF NOT EXISTS idx_watcher_runs_watcher_created_at
ON watcher_runs(watcher_id, created_at DESC)
`

function hasColumn(db: Database, table: string, column: string): boolean {
  const rows = db
    .query(`PRAGMA table_info(${table})`)
    .all() as Array<Record<string, unknown>>
  return rows.some((row) => row.name === column)
}

function ensureColumn(
  db: Database,
  table: string,
  column: string,
  definition: string,
): void {
  if (!hasColumn(db, table, column)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`)
  }
}

export function initSchema(db: Database): void {
  db.exec(RATE_LIMITER_TABLE)
  db.exec(IDENTITY_TABLE)
  db.exec(RUNS_TABLE)
  db.exec(RUNS_CONVERSATION_INDEX)
  db.exec(RUN_EVENTS_TABLE)
  db.exec(RUN_EVENTS_INDEX)
  db.exec(RUN_CHECKPOINTS_TABLE)
  db.exec(RUN_CHECKPOINTS_INDEX)
  db.exec(RUN_ARTIFACTS_TABLE)
  db.exec(RUN_ARTIFACTS_INDEX)
  db.exec(CONTEXT_PACKETS_TABLE)
  db.exec(CONTEXT_PACKETS_INDEX)
  db.exec(ROUTING_POLICIES_TABLE)
  db.exec(BUDGET_STATS_TABLE)
  db.exec(WORKFLOW_DEFINITIONS_TABLE)
  db.exec(WORKFLOW_RUNS_TABLE)
  db.exec(WORKFLOW_RUNS_INDEX)
  db.exec(WATCHERS_TABLE)
  db.exec(WATCHERS_INDEX)
  db.exec(WATCHER_RUNS_TABLE)
  db.exec(WATCHER_RUNS_INDEX)

  ensureColumn(db, 'workflow_definitions', 'code_id', 'TEXT')
  ensureColumn(db, 'workflow_definitions', 'description', 'TEXT')
  ensureColumn(
    db,
    'workflow_definitions',
    'run_profile',
    "TEXT NOT NULL DEFAULT 'do'",
  )
}
