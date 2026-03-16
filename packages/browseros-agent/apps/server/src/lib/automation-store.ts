/**
 * @license
 * Copyright 2025 BrowserOS
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import type { Database } from 'bun:sqlite'
import type {
  CreateWorkflowRun,
  LocalWorkflowIR,
  UpsertWatcherDefinition,
  UpsertWatcherRun,
  UpsertWorkflowDefinition,
  UpdateWorkflowRun,
  WatcherDefinition,
  WatcherNotificationPolicy,
  WatcherRetryPolicy,
  WatcherRun,
  WatcherSchedule,
  WatcherTrigger,
  WorkflowDefinition,
  WorkflowGraph,
  WorkflowRun,
} from '@browseros/shared/schemas/automation'

function toJson(value: unknown): string | null {
  if (value === undefined) return null
  return JSON.stringify(value)
}

function fromJson<T>(value: unknown): T | null {
  if (typeof value !== 'string' || !value) return null
  try {
    return JSON.parse(value) as T
  } catch {
    return null
  }
}

function toIso(value: unknown): string {
  return typeof value === 'string' ? value : new Date().toISOString()
}

function asOptionalString(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined
}

function asNullableString(value: unknown): string | null {
  return typeof value === 'string' ? value : null
}

function asBoolean(value: unknown): boolean {
  return value === 1 || value === true
}

function hasWorkflowChanged(
  existing: WorkflowDefinition,
  input: UpsertWorkflowDefinition,
): boolean {
  return (
    existing.name !== input.name ||
    (existing.description ?? null) !== (input.description ?? null) ||
    existing.source !== input.source ||
    existing.runProfile !== input.runProfile ||
    (existing.codeId ?? null) !== (input.codeId ?? null) ||
    JSON.stringify(existing.graph ?? null) !== JSON.stringify(input.graph ?? null) ||
    JSON.stringify(existing.ir ?? null) !== JSON.stringify(input.ir ?? null)
  )
}

function hasWatcherChanged(
  existing: WatcherDefinition,
  input: UpsertWatcherDefinition,
): boolean {
  return (
    existing.name !== input.name ||
    (existing.description ?? null) !== (input.description ?? null) ||
    existing.query !== input.query ||
    existing.runProfile !== input.runProfile ||
    existing.enabled !== input.enabled ||
    JSON.stringify(existing.schedule) !== JSON.stringify(input.schedule) ||
    JSON.stringify(existing.trigger ?? null) !==
      JSON.stringify(input.trigger ?? null) ||
    JSON.stringify(existing.notificationPolicy ?? null) !==
      JSON.stringify(input.notificationPolicy ?? null) ||
    JSON.stringify(existing.retryPolicy ?? null) !==
      JSON.stringify(input.retryPolicy ?? null) ||
    (existing.lastRunAt ?? null) !== (input.lastRunAt ?? null)
  )
}

export class AutomationStore {
  constructor(private db: Database) {}

  listWorkflowDefinitions(): WorkflowDefinition[] {
    const rows = this.db
      .query(
        `SELECT
          wd.*,
          (
            SELECT COUNT(*)
            FROM workflow_runs wr_count
            WHERE wr_count.workflow_definition_id = wd.id
          ) AS run_count,
          wr_latest.id AS latest_run_id,
          wr_latest.status AS latest_run_status,
          wr_latest.updated_at AS latest_run_updated_at
        FROM workflow_definitions wd
        LEFT JOIN workflow_runs wr_latest
          ON wr_latest.id = (
            SELECT wr_inner.id
            FROM workflow_runs wr_inner
            WHERE wr_inner.workflow_definition_id = wd.id
            ORDER BY wr_inner.updated_at DESC, wr_inner.created_at DESC
            LIMIT 1
          )
        ORDER BY wd.updated_at DESC`,
      )
      .all() as Array<Record<string, unknown>>

    return rows.map((row) => this.mapWorkflowDefinition(row))
  }

  getWorkflowDefinition(id: string): WorkflowDefinition | null {
    const row = this.db
      .query(
        `SELECT
          wd.*,
          (
            SELECT COUNT(*)
            FROM workflow_runs wr_count
            WHERE wr_count.workflow_definition_id = wd.id
          ) AS run_count,
          wr_latest.id AS latest_run_id,
          wr_latest.status AS latest_run_status,
          wr_latest.updated_at AS latest_run_updated_at
        FROM workflow_definitions wd
        LEFT JOIN workflow_runs wr_latest
          ON wr_latest.id = (
            SELECT wr_inner.id
            FROM workflow_runs wr_inner
            WHERE wr_inner.workflow_definition_id = wd.id
            ORDER BY wr_inner.updated_at DESC, wr_inner.created_at DESC
            LIMIT 1
          )
        WHERE wd.id = ?
        LIMIT 1`,
      )
      .get(id) as Record<string, unknown> | null

    return row ? this.mapWorkflowDefinition(row) : null
  }

  getWorkflowDefinitionByLegacyId(
    legacyWorkflowId: string,
  ): WorkflowDefinition | null {
    const row = this.db
      .query(
        `SELECT
          wd.*,
          (
            SELECT COUNT(*)
            FROM workflow_runs wr_count
            WHERE wr_count.workflow_definition_id = wd.id
          ) AS run_count,
          wr_latest.id AS latest_run_id,
          wr_latest.status AS latest_run_status,
          wr_latest.updated_at AS latest_run_updated_at
        FROM workflow_definitions wd
        LEFT JOIN workflow_runs wr_latest
          ON wr_latest.id = (
            SELECT wr_inner.id
            FROM workflow_runs wr_inner
            WHERE wr_inner.workflow_definition_id = wd.id
            ORDER BY wr_inner.updated_at DESC, wr_inner.created_at DESC
            LIMIT 1
          )
        WHERE wd.legacy_workflow_id = ?
        LIMIT 1`,
      )
      .get(legacyWorkflowId) as Record<string, unknown> | null

    return row ? this.mapWorkflowDefinition(row) : null
  }

  getWorkflowDefinitionByCodeId(codeId: string): WorkflowDefinition | null {
    const row = this.db
      .query(
        `SELECT
          wd.*,
          (
            SELECT COUNT(*)
            FROM workflow_runs wr_count
            WHERE wr_count.workflow_definition_id = wd.id
          ) AS run_count,
          wr_latest.id AS latest_run_id,
          wr_latest.status AS latest_run_status,
          wr_latest.updated_at AS latest_run_updated_at
        FROM workflow_definitions wd
        LEFT JOIN workflow_runs wr_latest
          ON wr_latest.id = (
            SELECT wr_inner.id
            FROM workflow_runs wr_inner
            WHERE wr_inner.workflow_definition_id = wd.id
            ORDER BY wr_inner.updated_at DESC, wr_inner.created_at DESC
            LIMIT 1
          )
        WHERE wd.code_id = ?
        LIMIT 1`,
      )
      .get(codeId) as Record<string, unknown> | null

    return row ? this.mapWorkflowDefinition(row) : null
  }

  upsertWorkflowDefinition(
    input: UpsertWorkflowDefinition,
  ): WorkflowDefinition {
    const existing =
      (input.id ? this.getWorkflowDefinition(input.id) : null) ??
      (input.legacyWorkflowId
        ? this.getWorkflowDefinitionByLegacyId(input.legacyWorkflowId)
        : null)

    const id = existing?.id ?? input.id ?? crypto.randomUUID()
    const version = existing
      ? hasWorkflowChanged(existing, input)
        ? existing.version + 1
        : existing.version
      : 1

    this.db
      .query(
        `INSERT OR REPLACE INTO workflow_definitions (
          id,
          legacy_workflow_id,
          code_id,
          version,
          name,
          description,
          source,
          run_profile,
          graph_json,
          ir_json,
          created_at,
          updated_at
        ) VALUES (
          ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
          COALESCE((SELECT created_at FROM workflow_definitions WHERE id = ?), datetime('now')),
          datetime('now')
        )`,
      )
      .run(
        id,
        input.legacyWorkflowId ?? existing?.legacyWorkflowId ?? null,
        input.codeId ?? existing?.codeId ?? null,
        version,
        input.name,
        input.description ?? existing?.description ?? null,
        input.source,
        input.runProfile,
        toJson(input.graph ?? existing?.graph ?? null),
        toJson(input.ir ?? existing?.ir ?? null),
        id,
      )

    return this.getWorkflowDefinition(id) as WorkflowDefinition
  }

  deleteWorkflowDefinition(id: string): boolean {
    const before = this.getWorkflowDefinition(id)
    if (!before) return false
    this.db.query(`DELETE FROM workflow_definitions WHERE id = ?`).run(id)
    return true
  }

  deleteWorkflowDefinitionByLegacyId(legacyWorkflowId: string): boolean {
    const before = this.getWorkflowDefinitionByLegacyId(legacyWorkflowId)
    if (!before) return false
    this.db
      .query(`DELETE FROM workflow_definitions WHERE legacy_workflow_id = ?`)
      .run(legacyWorkflowId)
    return true
  }

  listWorkflowRuns(workflowDefinitionId: string): WorkflowRun[] {
    const rows = this.db
      .query(
        `SELECT *
         FROM workflow_runs
         WHERE workflow_definition_id = ?
         ORDER BY updated_at DESC, created_at DESC`,
      )
      .all(workflowDefinitionId) as Array<Record<string, unknown>>

    return rows.map((row) => this.mapWorkflowRun(row))
  }

  createWorkflowRun(
    workflowDefinitionId: string,
    input: CreateWorkflowRun,
  ): WorkflowRun {
    const id = crypto.randomUUID()
    this.db
      .query(
        `INSERT INTO workflow_runs (
          id,
          workflow_definition_id,
          source_workflow_id,
          run_profile,
          status,
          request_json,
          result_json,
          created_at,
          updated_at
        ) VALUES (?, ?, ?, ?, 'running', ?, NULL, datetime('now'), datetime('now'))`,
      )
      .run(
        id,
        workflowDefinitionId,
        input.sourceWorkflowId ?? null,
        input.runProfile,
        toJson(input.request),
      )
    this.db
      .query(
        `UPDATE workflow_definitions SET updated_at = datetime('now') WHERE id = ?`,
      )
      .run(workflowDefinitionId)

    return this.getWorkflowRun(id) as WorkflowRun
  }

  getWorkflowRun(id: string): WorkflowRun | null {
    const row = this.db
      .query(`SELECT * FROM workflow_runs WHERE id = ? LIMIT 1`)
      .get(id) as Record<string, unknown> | null
    return row ? this.mapWorkflowRun(row) : null
  }

  updateWorkflowRun(id: string, input: UpdateWorkflowRun): WorkflowRun | null {
    const existing = this.getWorkflowRun(id)
    if (!existing) return null

    this.db
      .query(
        `UPDATE workflow_runs
         SET status = ?, result_json = ?, updated_at = datetime('now')
         WHERE id = ?`,
      )
      .run(input.status, toJson(input.result), id)
    this.db
      .query(
        `UPDATE workflow_definitions SET updated_at = datetime('now') WHERE id = ?`,
      )
      .run(existing.workflowDefinitionId)

    return this.getWorkflowRun(id)
  }

  listWatchers(): WatcherDefinition[] {
    const rows = this.db
      .query(
        `SELECT
          w.*,
          wr_latest.id AS latest_run_id,
          wr_latest.status AS latest_run_status,
          wr_latest.updated_at AS latest_run_updated_at
        FROM watchers w
        LEFT JOIN watcher_runs wr_latest
          ON wr_latest.id = (
            SELECT wr_inner.id
            FROM watcher_runs wr_inner
            WHERE wr_inner.watcher_id = w.id
            ORDER BY wr_inner.updated_at DESC, wr_inner.created_at DESC
            LIMIT 1
          )
        ORDER BY w.updated_at DESC`,
      )
      .all() as Array<Record<string, unknown>>

    return rows.map((row) => this.mapWatcherDefinition(row))
  }

  getWatcher(id: string): WatcherDefinition | null {
    const row = this.db
      .query(
        `SELECT
          w.*,
          wr_latest.id AS latest_run_id,
          wr_latest.status AS latest_run_status,
          wr_latest.updated_at AS latest_run_updated_at
        FROM watchers w
        LEFT JOIN watcher_runs wr_latest
          ON wr_latest.id = (
            SELECT wr_inner.id
            FROM watcher_runs wr_inner
            WHERE wr_inner.watcher_id = w.id
            ORDER BY wr_inner.updated_at DESC, wr_inner.created_at DESC
            LIMIT 1
          )
        WHERE w.id = ?
        LIMIT 1`,
      )
      .get(id) as Record<string, unknown> | null

    return row ? this.mapWatcherDefinition(row) : null
  }

  getWatcherByLegacyId(legacyJobId: string): WatcherDefinition | null {
    const row = this.db
      .query(
        `SELECT
          w.*,
          wr_latest.id AS latest_run_id,
          wr_latest.status AS latest_run_status,
          wr_latest.updated_at AS latest_run_updated_at
        FROM watchers w
        LEFT JOIN watcher_runs wr_latest
          ON wr_latest.id = (
            SELECT wr_inner.id
            FROM watcher_runs wr_inner
            WHERE wr_inner.watcher_id = w.id
            ORDER BY wr_inner.updated_at DESC, wr_inner.created_at DESC
            LIMIT 1
          )
        WHERE w.legacy_job_id = ?
        LIMIT 1`,
      )
      .get(legacyJobId) as Record<string, unknown> | null

    return row ? this.mapWatcherDefinition(row) : null
  }

  upsertWatcher(input: UpsertWatcherDefinition): WatcherDefinition {
    const existing =
      (input.id ? this.getWatcher(input.id) : null) ??
      (input.legacyJobId ? this.getWatcherByLegacyId(input.legacyJobId) : null)

    const id = existing?.id ?? input.id ?? crypto.randomUUID()
    const version = existing
      ? hasWatcherChanged(existing, input)
        ? existing.version + 1
        : existing.version
      : 1

    this.db
      .query(
        `INSERT OR REPLACE INTO watchers (
          id,
          legacy_job_id,
          version,
          name,
          description,
          query,
          run_profile,
          schedule_json,
          trigger_json,
          notification_policy_json,
          retry_policy_json,
          enabled,
          status,
          last_run_at,
          created_at,
          updated_at
        ) VALUES (
          ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
          ?,
          COALESCE((SELECT created_at FROM watchers WHERE id = ?), datetime('now')),
          datetime('now')
        )`,
      )
      .run(
        id,
        input.legacyJobId ?? existing?.legacyJobId ?? null,
        version,
        input.name,
        input.description ?? existing?.description ?? null,
        input.query,
        input.runProfile,
        toJson(input.schedule),
        toJson(input.trigger ?? existing?.trigger ?? null),
        toJson(input.notificationPolicy ?? existing?.notificationPolicy ?? null),
        toJson(input.retryPolicy ?? existing?.retryPolicy ?? null),
        input.enabled ? 1 : 0,
        existing?.status ?? 'idle',
        input.lastRunAt ?? existing?.lastRunAt ?? null,
        id,
      )

    return this.getWatcher(id) as WatcherDefinition
  }

  deleteWatcher(id: string): boolean {
    const before = this.getWatcher(id)
    if (!before) return false
    this.db.query(`DELETE FROM watchers WHERE id = ?`).run(id)
    return true
  }

  deleteWatcherByLegacyId(legacyJobId: string): boolean {
    const before = this.getWatcherByLegacyId(legacyJobId)
    if (!before) return false
    this.db.query(`DELETE FROM watchers WHERE legacy_job_id = ?`).run(legacyJobId)
    return true
  }

  listWatcherRuns(watcherId: string): WatcherRun[] {
    const rows = this.db
      .query(
        `SELECT *
         FROM watcher_runs
         WHERE watcher_id = ?
         ORDER BY updated_at DESC, created_at DESC`,
      )
      .all(watcherId) as Array<Record<string, unknown>>

    return rows.map((row) => this.mapWatcherRun(row))
  }

  upsertWatcherRun(input: UpsertWatcherRun): WatcherRun {
    const existing =
      (input.id ? this.getWatcherRun(input.id) : null) ??
      (input.legacyRunId ? this.getWatcherRunByLegacyId(input.legacyRunId) : null)
    const id = existing?.id ?? input.id ?? crypto.randomUUID()

    this.db
      .query(
        `INSERT OR REPLACE INTO watcher_runs (
          id,
          watcher_id,
          legacy_run_id,
          linked_run_id,
          status,
          result_text,
          final_result_text,
          execution_log,
          tool_calls_json,
          error_text,
          started_at,
          completed_at,
          created_at,
          updated_at
        ) VALUES (
          ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
          COALESCE((SELECT created_at FROM watcher_runs WHERE id = ?), datetime('now')),
          datetime('now')
        )`,
      )
      .run(
        id,
        input.watcherId,
        input.legacyRunId ?? existing?.legacyRunId ?? null,
        input.linkedRunId ?? existing?.linkedRunId ?? null,
        input.status,
        input.result ?? existing?.result ?? null,
        input.finalResult ?? existing?.finalResult ?? null,
        input.executionLog ?? existing?.executionLog ?? null,
        toJson(input.toolCalls ?? existing?.toolCalls ?? null),
        input.error ?? existing?.error ?? null,
        input.startedAt,
        input.completedAt ?? existing?.completedAt ?? null,
        id,
      )
    this.db
      .query(
        `UPDATE watchers
         SET last_run_at = ?, status = ?, updated_at = datetime('now')
         WHERE id = ?`,
      )
      .run(
        input.completedAt ?? input.startedAt,
        input.status === 'running'
          ? 'running'
          : input.status === 'failed'
            ? 'error'
            : 'idle',
        input.watcherId,
      )

    return this.getWatcherRun(id) as WatcherRun
  }

  getWatcherRun(id: string): WatcherRun | null {
    const row = this.db
      .query(`SELECT * FROM watcher_runs WHERE id = ? LIMIT 1`)
      .get(id) as Record<string, unknown> | null
    return row ? this.mapWatcherRun(row) : null
  }

  getWatcherRunByLegacyId(legacyRunId: string): WatcherRun | null {
    const row = this.db
      .query(`SELECT * FROM watcher_runs WHERE legacy_run_id = ? LIMIT 1`)
      .get(legacyRunId) as Record<string, unknown> | null
    return row ? this.mapWatcherRun(row) : null
  }

  private mapWorkflowDefinition(row: Record<string, unknown>): WorkflowDefinition {
    return {
      id: String(row.id),
      legacyWorkflowId: asOptionalString(row.legacy_workflow_id),
      codeId: asOptionalString(row.code_id),
      version: Number(row.version),
      name: String(row.name),
      description: asNullableString(row.description),
      source: String(row.source) as WorkflowDefinition['source'],
      runProfile: String(row.run_profile) as WorkflowDefinition['runProfile'],
      graph: fromJson<WorkflowGraph>(row.graph_json),
      ir: fromJson<LocalWorkflowIR>(row.ir_json),
      runCount: Number(row.run_count ?? 0),
      latestRunId: asOptionalString(row.latest_run_id),
      latestRunStatus: asOptionalString(
        row.latest_run_status,
      ) as WorkflowDefinition['latestRunStatus'],
      latestRunUpdatedAt: asOptionalString(row.latest_run_updated_at),
      createdAt: toIso(row.created_at),
      updatedAt: toIso(row.updated_at),
    }
  }

  private mapWorkflowRun(row: Record<string, unknown>): WorkflowRun {
    return {
      id: String(row.id),
      workflowDefinitionId: String(row.workflow_definition_id),
      sourceWorkflowId: asOptionalString(row.source_workflow_id),
      runProfile: String(row.run_profile) as WorkflowRun['runProfile'],
      status: String(row.status) as WorkflowRun['status'],
      request: fromJson<Record<string, unknown>>(row.request_json),
      result: fromJson<Record<string, unknown>>(row.result_json),
      createdAt: toIso(row.created_at),
      updatedAt: toIso(row.updated_at),
    }
  }

  private mapWatcherDefinition(row: Record<string, unknown>): WatcherDefinition {
    return {
      id: String(row.id),
      legacyJobId: asOptionalString(row.legacy_job_id),
      version: Number(row.version),
      name: String(row.name),
      description: asNullableString(row.description),
      query: String(row.query),
      runProfile: String(row.run_profile) as WatcherDefinition['runProfile'],
      schedule:
        fromJson<WatcherSchedule>(row.schedule_json) ?? {
          type: 'daily',
        },
      trigger: fromJson<WatcherTrigger>(row.trigger_json) ?? undefined,
      notificationPolicy:
        fromJson<WatcherNotificationPolicy>(row.notification_policy_json) ??
        undefined,
      retryPolicy:
        fromJson<WatcherRetryPolicy>(row.retry_policy_json) ?? undefined,
      enabled: asBoolean(row.enabled),
      status: String(row.status) as WatcherDefinition['status'],
      lastRunAt: asOptionalString(row.last_run_at),
      latestRunId: asOptionalString(row.latest_run_id),
      latestRunStatus: asOptionalString(
        row.latest_run_status,
      ) as WatcherDefinition['latestRunStatus'],
      latestRunUpdatedAt: asOptionalString(row.latest_run_updated_at),
      createdAt: toIso(row.created_at),
      updatedAt: toIso(row.updated_at),
    }
  }

  private mapWatcherRun(row: Record<string, unknown>): WatcherRun {
    return {
      id: String(row.id),
      watcherId: String(row.watcher_id),
      legacyRunId: asOptionalString(row.legacy_run_id),
      linkedRunId: asOptionalString(row.linked_run_id),
      status: String(row.status) as WatcherRun['status'],
      result: asNullableString(row.result_text),
      finalResult: asNullableString(row.final_result_text),
      executionLog: asNullableString(row.execution_log),
      toolCalls:
        fromJson<Array<Record<string, unknown>>>(row.tool_calls_json) ?? undefined,
      error: asNullableString(row.error_text),
      startedAt: toIso(row.started_at),
      completedAt: asNullableString(row.completed_at),
      createdAt: toIso(row.created_at),
      updatedAt: toIso(row.updated_at),
    }
  }
}
