/**
 * @license
 * Copyright 2025 BrowserOS
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import type { Database } from 'bun:sqlite'
import { mkdir, writeFile } from 'node:fs/promises'
import { basename, join } from 'node:path'
import type {
  ArtifactPolicy,
  BudgetPolicy,
  ContextPolicy,
  RunProfile,
} from '@browseros/shared/schemas/runtime'
import { getRunArtifactsDir } from './browseros-dir'

export type RunStatus = 'running' | 'completed' | 'failed' | 'aborted'
export type RunStage = 'planner' | 'executor' | 'verifier'

export interface RunRecord {
  id: string
  conversationId: string
  profile: RunProfile
  status: RunStatus
  stage: RunStage | null
  provider: string
  model: string
  resumedFromRunId?: string
  requestMessage: string
  budgetPolicy?: BudgetPolicy | null
  artifactPolicy?: ArtifactPolicy | null
  contextPolicy?: ContextPolicy | null
  routingPolicy?: Record<string, unknown> | null
  browserContext?: Record<string, unknown> | null
  verificationSummary?: string | null
  errorText?: string | null
  createdAt: string
  updatedAt: string
}

export interface RunEventRecord {
  id: number
  runId: string
  type: string
  stage: string | null
  title: string
  detail: string | null
  data: Record<string, unknown> | null
  createdAt: string
}

export interface RunCheckpointRecord {
  id: string
  runId: string
  label: string
  stage: string | null
  status: string
  data: Record<string, unknown> | null
  createdAt: string
}

export interface RunArtifactRecord {
  id: string
  runId: string
  kind: string
  name: string
  filePath: string
  mimeType: string | null
  previewText: string | null
  byteSize: number
  createdAt: string
}

export interface ContextPacketRecord {
  id: string
  runId: string
  conversationId: string
  packetType: string
  packetKey: string
  summary: string
  data: Record<string, unknown> | null
  createdAt: string
}

export interface BudgetStatsRecord {
  runId: string
  requestChars: number
  browserContextChars: number
  availableSkillsCount: number
  availableSkillsChars: number
  selectedSkillsCount: number
  selectedSkillsChars: number
  contextPacketsCount: number
  artifactCount: number
  externalizedChars: number
  toolCallCount: number
  sourceCount: number
  assistantOutputChars: number
  estimatedInputTokens: number
  estimatedOutputTokens: number
  updatedAt: string
}

interface BeginRunInput {
  id: string
  conversationId: string
  profile: RunProfile
  provider: string
  model: string
  requestMessage: string
  resumedFromRunId?: string
  budgetPolicy?: BudgetPolicy
  artifactPolicy?: ArtifactPolicy
  contextPolicy?: ContextPolicy
  browserContext?: Record<string, unknown>
}

interface SaveArtifactInput {
  id?: string
  runId: string
  kind: string
  name: string
  content: string
  mimeType?: string
  previewText?: string
}

interface AddContextPacketInput {
  id?: string
  runId: string
  conversationId: string
  packetType: string
  packetKey: string
  summary: string
  data?: Record<string, unknown>
}

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

function cleanFileName(name: string): string {
  return (
    basename(name).replace(/[^\w.-]+/g, '-').replace(/^-+|-+$/g, '') ||
    'artifact'
  )
}

function inferExtension(mimeType?: string): string {
  if (!mimeType) return '.txt'
  if (mimeType.includes('json')) return '.json'
  if (mimeType.includes('markdown')) return '.md'
  if (mimeType.includes('html')) return '.html'
  if (mimeType.startsWith('image/png')) return '.png.txt'
  if (mimeType.startsWith('image/jpeg')) return '.jpg.txt'
  return '.txt'
}

export class RunStore {
  constructor(private db: Database) {}

  beginRun(input: BeginRunInput): void {
    this.db.query(
      `INSERT OR REPLACE INTO runs (
        id, conversation_id, profile, status, stage, provider, model,
        resumed_from_run_id, request_message, budget_policy_json,
        artifact_policy_json, context_policy_json, browser_context_json,
        updated_at
      ) VALUES (?, ?, ?, 'running', 'planner', ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
    ).run(
      input.id,
      input.conversationId,
      input.profile,
      input.provider,
      input.model,
      input.resumedFromRunId ?? null,
      input.requestMessage,
      toJson(input.budgetPolicy),
      toJson(input.artifactPolicy),
      toJson(input.contextPolicy),
      toJson(input.browserContext),
    )

    this.addEvent(input.id, {
      type: 'run.started',
      stage: 'planner',
      title: `Run started (${input.profile})`,
      detail: input.requestMessage,
      data: {
        provider: input.provider,
        model: input.model,
        resumedFromRunId: input.resumedFromRunId ?? null,
      },
    })

    this.addCheckpoint(input.id, {
      label: 'Run started',
      stage: 'planner',
      status: 'ready',
      data: {
        profile: input.profile,
        provider: input.provider,
        model: input.model,
      },
    })
  }

  updateStage(
    runId: string,
    stage: RunStage,
    title: string,
    detail?: string,
    data?: Record<string, unknown>,
  ): void {
    this.db
      .query(`UPDATE runs SET stage = ?, updated_at = datetime('now') WHERE id = ?`)
      .run(stage, runId)
    this.addEvent(runId, {
      type: 'run.stage',
      stage,
      title,
      detail,
      data,
    })
    this.addCheckpoint(runId, {
      label: title,
      stage,
      status: 'completed',
      data,
    })
  }

  recordRoutingPolicy(
    runId: string,
    profile: RunProfile,
    strategy: string,
    stageModels: Record<string, unknown>,
  ): void {
    const id = crypto.randomUUID()
    this.db
      .query(
        `INSERT OR REPLACE INTO routing_policies (
          id, run_id, strategy, profile, stage_models_json, updated_at
        ) VALUES (?, ?, ?, ?, ?, datetime('now'))`,
      )
      .run(id, runId, strategy, profile, JSON.stringify(stageModels))

    this.db
      .query(
        `UPDATE runs SET routing_policy_json = ?, updated_at = datetime('now') WHERE id = ?`,
      )
      .run(JSON.stringify({ strategy, profile, stageModels }), runId)

    this.addEvent(runId, {
      type: 'run.routing',
      stage: 'planner',
      title: 'Routing policy resolved',
      data: { strategy, profile, stageModels },
    })
  }

  addEvent(
    runId: string,
    event: {
      type: string
      stage?: string
      title: string
      detail?: string
      data?: Record<string, unknown>
    },
  ): void {
    this.db
      .query(
        `INSERT INTO run_events (run_id, type, stage, title, detail, data_json)
         VALUES (?, ?, ?, ?, ?, ?)`,
      )
      .run(
        runId,
        event.type,
        event.stage ?? null,
        event.title,
        event.detail ?? null,
        toJson(event.data),
      )
    this.db
      .query(`UPDATE runs SET updated_at = datetime('now') WHERE id = ?`)
      .run(runId)
  }

  addCheckpoint(
    runId: string,
    checkpoint: {
      id?: string
      label: string
      stage?: string
      status: string
      data?: Record<string, unknown>
    },
  ): RunCheckpointRecord {
    const checkpointId = checkpoint.id ?? crypto.randomUUID()
    this.db
      .query(
        `INSERT OR REPLACE INTO run_checkpoints (
          id, run_id, label, stage, status, data_json
        ) VALUES (?, ?, ?, ?, ?, ?)`,
      )
      .run(
        checkpointId,
        runId,
        checkpoint.label,
        checkpoint.stage ?? null,
        checkpoint.status,
        toJson(checkpoint.data),
      )
    this.db
      .query(`UPDATE runs SET updated_at = datetime('now') WHERE id = ?`)
      .run(runId)

    return {
      id: checkpointId,
      runId,
      label: checkpoint.label,
      stage: checkpoint.stage ?? null,
      status: checkpoint.status,
      data: checkpoint.data ?? null,
      createdAt: new Date().toISOString(),
    }
  }

  async saveArtifact(input: SaveArtifactInput): Promise<RunArtifactRecord> {
    const artifactId = input.id ?? crypto.randomUUID()
    const safeName = cleanFileName(input.name)
    const artifactsDir = getRunArtifactsDir(input.runId)
    await mkdir(artifactsDir, { recursive: true })

    const fileName = `${safeName}-${artifactId}${inferExtension(input.mimeType)}`
    const filePath = join(artifactsDir, fileName)
    await writeFile(filePath, input.content, 'utf-8')

    const byteSize = Buffer.byteLength(input.content, 'utf-8')

    this.db
      .query(
        `INSERT OR REPLACE INTO run_artifacts (
          id, run_id, kind, name, file_path, mime_type, preview_text, byte_size
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        artifactId,
        input.runId,
        input.kind,
        input.name,
        filePath,
        input.mimeType ?? null,
        input.previewText ?? null,
        byteSize,
      )

    this.addEvent(input.runId, {
      type: 'run.artifact',
      stage: 'executor',
      title: `Artifact saved: ${input.name}`,
      data: {
        artifactId,
        kind: input.kind,
        filePath,
        byteSize,
      },
    })

    return {
      id: artifactId,
      runId: input.runId,
      kind: input.kind,
      name: input.name,
      filePath,
      mimeType: input.mimeType ?? null,
      previewText: input.previewText ?? null,
      byteSize,
      createdAt: new Date().toISOString(),
    }
  }

  addContextPacket(input: AddContextPacketInput): ContextPacketRecord {
    const packetId = input.id ?? crypto.randomUUID()
    this.db
      .query(
        `INSERT OR REPLACE INTO context_packets (
          id, run_id, conversation_id, packet_type, packet_key, summary, data_json
        ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        packetId,
        input.runId,
        input.conversationId,
        input.packetType,
        input.packetKey,
        input.summary,
        toJson(input.data),
      )

    this.addEvent(input.runId, {
      type: 'run.context',
      stage: 'planner',
      title: `Context packet cached: ${input.packetType}`,
      detail: input.summary,
      data: {
        packetId,
        packetKey: input.packetKey,
      },
    })

    return {
      id: packetId,
      runId: input.runId,
      conversationId: input.conversationId,
      packetType: input.packetType,
      packetKey: input.packetKey,
      summary: input.summary,
      data: input.data ?? null,
      createdAt: new Date().toISOString(),
    }
  }

  finishRun(params: {
    runId: string
    status: RunStatus
    stage?: RunStage
    verificationSummary?: string
    errorText?: string
  }): void {
    this.db
      .query(
        `UPDATE runs
         SET status = ?, stage = ?, verification_summary = ?, error_text = ?, updated_at = datetime('now')
         WHERE id = ?`,
      )
      .run(
        params.status,
        params.stage ?? 'verifier',
        params.verificationSummary ?? null,
        params.errorText ?? null,
        params.runId,
      )

    this.addEvent(params.runId, {
      type: `run.${params.status}`,
      stage: params.stage ?? 'verifier',
      title: `Run ${params.status}`,
      detail: params.errorText ?? params.verificationSummary,
    })
    this.addCheckpoint(params.runId, {
      label: `Run ${params.status}`,
      stage: params.stage ?? 'verifier',
      status: params.status,
      data: {
        verificationSummary: params.verificationSummary ?? null,
        errorText: params.errorText ?? null,
      },
    })
  }

  listRuns(params?: {
    limit?: number
    conversationId?: string
  }): RunRecord[] {
    const limit = params?.limit ?? 20
    const conversationId = params?.conversationId
    const rows = conversationId
      ? (this.db
          .query(
            `SELECT * FROM runs
             WHERE conversation_id = ?
             ORDER BY created_at DESC
             LIMIT ?`,
          )
          .all(conversationId, limit) as Record<string, unknown>[])
      : (this.db
          .query(`SELECT * FROM runs ORDER BY created_at DESC LIMIT ?`)
          .all(limit) as Record<string, unknown>[])
    return rows.map((row) => this.mapRun(row))
  }

  getRun(runId: string): RunRecord | null {
    const row = this.db
      .query(`SELECT * FROM runs WHERE id = ? LIMIT 1`)
      .get(runId) as Record<string, unknown> | null
    return row ? this.mapRun(row) : null
  }

  getRunEvents(runId: string): RunEventRecord[] {
    const rows = this.db
      .query(`SELECT * FROM run_events WHERE run_id = ? ORDER BY id ASC`)
      .all(runId) as Record<string, unknown>[]
    return rows.map((row) => ({
      id: Number(row.id),
      runId: String(row.run_id),
      type: String(row.type),
      stage: typeof row.stage === 'string' ? row.stage : null,
      title: String(row.title),
      detail: typeof row.detail === 'string' ? row.detail : null,
      data: fromJson<Record<string, unknown>>(row.data_json),
      createdAt: toIso(row.created_at),
    }))
  }

  getRunCheckpoints(runId: string): RunCheckpointRecord[] {
    const rows = this.db
      .query(
        `SELECT * FROM run_checkpoints WHERE run_id = ? ORDER BY created_at ASC`,
      )
      .all(runId) as Record<string, unknown>[]
    return rows.map((row) => ({
      id: String(row.id),
      runId: String(row.run_id),
      label: String(row.label),
      stage: typeof row.stage === 'string' ? row.stage : null,
      status: String(row.status),
      data: fromJson<Record<string, unknown>>(row.data_json),
      createdAt: toIso(row.created_at),
    }))
  }

  getRunArtifacts(runId: string): RunArtifactRecord[] {
    const rows = this.db
      .query(`SELECT * FROM run_artifacts WHERE run_id = ? ORDER BY created_at ASC`)
      .all(runId) as Record<string, unknown>[]
    return rows.map((row) => ({
      id: String(row.id),
      runId: String(row.run_id),
      kind: String(row.kind),
      name: String(row.name),
      filePath: String(row.file_path),
      mimeType: typeof row.mime_type === 'string' ? row.mime_type : null,
      previewText:
        typeof row.preview_text === 'string' ? row.preview_text : null,
      byteSize: Number(row.byte_size),
      createdAt: toIso(row.created_at),
    }))
  }

  saveBudgetStats(
    runId: string,
    stats: Omit<BudgetStatsRecord, 'runId' | 'updatedAt'>,
  ): BudgetStatsRecord {
    this.db
      .query(
        `INSERT OR REPLACE INTO budget_stats (
          run_id,
          request_chars,
          browser_context_chars,
          available_skills_count,
          available_skills_chars,
          selected_skills_count,
          selected_skills_chars,
          context_packets_count,
          artifact_count,
          externalized_chars,
          tool_call_count,
          source_count,
          assistant_output_chars,
          estimated_input_tokens,
          estimated_output_tokens,
          updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
      )
      .run(
        runId,
        stats.requestChars,
        stats.browserContextChars,
        stats.availableSkillsCount,
        stats.availableSkillsChars,
        stats.selectedSkillsCount,
        stats.selectedSkillsChars,
        stats.contextPacketsCount,
        stats.artifactCount,
        stats.externalizedChars,
        stats.toolCallCount,
        stats.sourceCount,
        stats.assistantOutputChars,
        stats.estimatedInputTokens,
        stats.estimatedOutputTokens,
      )
    this.db
      .query(`UPDATE runs SET updated_at = datetime('now') WHERE id = ?`)
      .run(runId)

    return {
      runId,
      ...stats,
      updatedAt: new Date().toISOString(),
    }
  }

  getBudgetStats(runId: string): BudgetStatsRecord | null {
    const row = this.db
      .query(`SELECT * FROM budget_stats WHERE run_id = ? LIMIT 1`)
      .get(runId) as Record<string, unknown> | null
    if (!row) return null
    return {
      runId: String(row.run_id),
      requestChars: Number(row.request_chars),
      browserContextChars: Number(row.browser_context_chars),
      availableSkillsCount: Number(row.available_skills_count),
      availableSkillsChars: Number(row.available_skills_chars),
      selectedSkillsCount: Number(row.selected_skills_count),
      selectedSkillsChars: Number(row.selected_skills_chars),
      contextPacketsCount: Number(row.context_packets_count),
      artifactCount: Number(row.artifact_count),
      externalizedChars: Number(row.externalized_chars),
      toolCallCount: Number(row.tool_call_count),
      sourceCount: Number(row.source_count),
      assistantOutputChars: Number(row.assistant_output_chars),
      estimatedInputTokens: Number(row.estimated_input_tokens),
      estimatedOutputTokens: Number(row.estimated_output_tokens),
      updatedAt: toIso(row.updated_at),
    }
  }

  getContextPackets(params: {
    runId?: string
    conversationId?: string
    limit?: number
  }): ContextPacketRecord[] {
    const limit = params.limit ?? 20
    const rows = params.runId
      ? (this.db
          .query(
            `SELECT * FROM context_packets
             WHERE run_id = ?
             ORDER BY created_at DESC
             LIMIT ?`,
          )
          .all(params.runId, limit) as Record<string, unknown>[])
      : params.conversationId
        ? (this.db
            .query(
              `SELECT * FROM context_packets
               WHERE conversation_id = ?
               ORDER BY created_at DESC
               LIMIT ?`,
            )
            .all(params.conversationId, limit) as Record<string, unknown>[])
        : (this.db
            .query(
              `SELECT * FROM context_packets
               ORDER BY created_at DESC
               LIMIT ?`,
            )
            .all(limit) as Record<string, unknown>[])
    return rows.map((row) => ({
      id: String(row.id),
      runId: String(row.run_id),
      conversationId: String(row.conversation_id),
      packetType: String(row.packet_type),
      packetKey: String(row.packet_key),
      summary: String(row.summary),
      data: fromJson<Record<string, unknown>>(row.data_json),
      createdAt: toIso(row.created_at),
    }))
  }

  private mapRun(row: Record<string, unknown>): RunRecord {
    return {
      id: String(row.id),
      conversationId: String(row.conversation_id),
      profile: row.profile as RunProfile,
      status: row.status as RunStatus,
      stage: typeof row.stage === 'string' ? (row.stage as RunStage) : null,
      provider: String(row.provider),
      model: String(row.model),
      resumedFromRunId:
        typeof row.resumed_from_run_id === 'string'
          ? row.resumed_from_run_id
          : undefined,
      requestMessage: String(row.request_message),
      budgetPolicy: fromJson<BudgetPolicy>(row.budget_policy_json),
      artifactPolicy: fromJson<ArtifactPolicy>(row.artifact_policy_json),
      contextPolicy: fromJson<ContextPolicy>(row.context_policy_json),
      routingPolicy: fromJson<Record<string, unknown>>(row.routing_policy_json),
      browserContext: fromJson<Record<string, unknown>>(row.browser_context_json),
      verificationSummary:
        typeof row.verification_summary === 'string'
          ? row.verification_summary
          : null,
      errorText: typeof row.error_text === 'string' ? row.error_text : null,
      createdAt: toIso(row.created_at),
      updatedAt: toIso(row.updated_at),
    }
  }
}
