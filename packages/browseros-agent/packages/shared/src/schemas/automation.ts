/**
 * @license
 * Copyright 2025 BrowserOS
 * SPDX-License-Identifier: AGPL-3.0-or-later
 *
 * Shared BrowserOS 2 automation schemas.
 */

import { z } from 'zod'
import { RunProfileSchema } from './runtime'

export const WorkflowNodeTypeSchema = z.enum([
  'start',
  'end',
  'nav',
  'act',
  'extract',
  'verify',
  'decision',
  'loop',
  'fork',
  'join',
])

export const WorkflowNodeSchema = z.object({
  id: z.string(),
  type: WorkflowNodeTypeSchema,
  data: z.object({
    label: z.string(),
  }),
})

export const WorkflowEdgeSchema = z.object({
  id: z.string(),
  source: z.string(),
  target: z.string(),
})

export const WorkflowGraphSchema = z.object({
  nodes: z.array(WorkflowNodeSchema),
  edges: z.array(WorkflowEdgeSchema),
})

export type WorkflowGraph = z.infer<typeof WorkflowGraphSchema>

export const LocalWorkflowIRStepTypeSchema = z.enum([
  'nav',
  'act',
  'extract',
  'verify',
])

export const LocalWorkflowIRStepSchema = z.object({
  id: z.string(),
  type: LocalWorkflowIRStepTypeSchema,
  label: z.string(),
})

export const LocalWorkflowIRSchema = z.object({
  version: z.literal(1),
  mode: z.literal('linear'),
  supported: z.boolean(),
  reason: z.string().optional(),
  steps: z.array(LocalWorkflowIRStepSchema),
})

export type LocalWorkflowIR = z.infer<typeof LocalWorkflowIRSchema>

export const WorkflowSourceSchema = z.enum([
  'local',
  'extension',
  'template',
  'imported',
])

export const WorkflowRunStatusSchema = z.enum([
  'queued',
  'running',
  'completed',
  'failed',
  'cancelled',
])

export const WorkflowDefinitionSchema = z.object({
  id: z.string().uuid(),
  legacyWorkflowId: z.string().optional(),
  codeId: z.string().optional(),
  version: z.number().int().positive(),
  name: z.string(),
  description: z.string().nullable().optional(),
  source: WorkflowSourceSchema,
  runProfile: RunProfileSchema.default('do'),
  graph: WorkflowGraphSchema.nullable().optional(),
  ir: LocalWorkflowIRSchema.nullable().optional(),
  runCount: z.number().int().nonnegative().optional(),
  latestRunId: z.string().uuid().optional(),
  latestRunStatus: WorkflowRunStatusSchema.optional(),
  latestRunUpdatedAt: z.string().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
})

export type WorkflowDefinition = z.infer<typeof WorkflowDefinitionSchema>

export const UpsertWorkflowDefinitionSchema = z.object({
  id: z.string().uuid().optional(),
  legacyWorkflowId: z.string().optional(),
  codeId: z.string().min(1).optional(),
  name: z.string().min(1),
  description: z.string().optional(),
  source: WorkflowSourceSchema.default('extension'),
  runProfile: RunProfileSchema.default('do'),
  graph: WorkflowGraphSchema.nullable().optional(),
  ir: LocalWorkflowIRSchema.nullable().optional(),
})

export type UpsertWorkflowDefinition = z.infer<
  typeof UpsertWorkflowDefinitionSchema
>

export const WorkflowRunSchema = z.object({
  id: z.string().uuid(),
  workflowDefinitionId: z.string().uuid(),
  sourceWorkflowId: z.string().optional(),
  runProfile: RunProfileSchema,
  status: WorkflowRunStatusSchema,
  request: z.record(z.string(), z.unknown()).nullable().optional(),
  result: z.record(z.string(), z.unknown()).nullable().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
})

export type WorkflowRun = z.infer<typeof WorkflowRunSchema>

export const CreateWorkflowRunSchema = z.object({
  sourceWorkflowId: z.string().optional(),
  runProfile: RunProfileSchema.default('do'),
  request: z.record(z.string(), z.unknown()).optional(),
})

export type CreateWorkflowRun = z.infer<typeof CreateWorkflowRunSchema>

export const UpdateWorkflowRunSchema = z.object({
  status: WorkflowRunStatusSchema,
  result: z.record(z.string(), z.unknown()).optional(),
})

export type UpdateWorkflowRun = z.infer<typeof UpdateWorkflowRunSchema>

export const WatcherScheduleTypeSchema = z.enum(['daily', 'hourly', 'minutes'])

export const WatcherScheduleSchema = z.object({
  type: WatcherScheduleTypeSchema,
  time: z.string().optional(),
  interval: z.number().int().positive().optional(),
})

export type WatcherSchedule = z.infer<typeof WatcherScheduleSchema>

export const WatcherTriggerSchema = z.object({
  type: z.enum(['schedule', 'page', 'content']).default('schedule'),
  urlPattern: z.string().optional(),
  textPattern: z.string().optional(),
})

export type WatcherTrigger = z.infer<typeof WatcherTriggerSchema>

export const WatcherNotificationPolicySchema = z.object({
  mode: z.enum(['silent', 'inbox', 'system']).default('inbox'),
})

export type WatcherNotificationPolicy = z.infer<
  typeof WatcherNotificationPolicySchema
>

export const WatcherRetryPolicySchema = z.object({
  maxRetries: z.number().int().min(0).default(2),
  backoffMinutes: z.number().int().positive().default(15),
})

export type WatcherRetryPolicy = z.infer<typeof WatcherRetryPolicySchema>

export const WatcherStatusSchema = z.enum([
  'idle',
  'running',
  'paused',
  'error',
])

export const WatcherDefinitionSchema = z.object({
  id: z.string().uuid(),
  legacyJobId: z.string().optional(),
  version: z.number().int().positive(),
  name: z.string(),
  description: z.string().nullable().optional(),
  query: z.string(),
  runProfile: RunProfileSchema.default('watch'),
  schedule: WatcherScheduleSchema,
  trigger: WatcherTriggerSchema.optional(),
  notificationPolicy: WatcherNotificationPolicySchema.optional(),
  retryPolicy: WatcherRetryPolicySchema.optional(),
  enabled: z.boolean(),
  status: WatcherStatusSchema.default('idle'),
  lastRunAt: z.string().optional(),
  latestRunId: z.string().uuid().optional(),
  latestRunStatus: z.enum(['running', 'completed', 'failed', 'cancelled']).optional(),
  latestRunUpdatedAt: z.string().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
})

export type WatcherDefinition = z.infer<typeof WatcherDefinitionSchema>

export const UpsertWatcherDefinitionSchema = z.object({
  id: z.string().uuid().optional(),
  legacyJobId: z.string().optional(),
  name: z.string().min(1),
  description: z.string().optional(),
  query: z.string().min(1),
  runProfile: RunProfileSchema.default('watch'),
  schedule: WatcherScheduleSchema,
  trigger: WatcherTriggerSchema.optional(),
  notificationPolicy: WatcherNotificationPolicySchema.optional(),
  retryPolicy: WatcherRetryPolicySchema.optional(),
  enabled: z.boolean().default(true),
  lastRunAt: z.string().optional(),
})

export type UpsertWatcherDefinition = z.infer<
  typeof UpsertWatcherDefinitionSchema
>

export const WatcherRunStatusSchema = z.enum([
  'running',
  'completed',
  'failed',
  'cancelled',
])

export const WatcherRunSchema = z.object({
  id: z.string().uuid(),
  watcherId: z.string().uuid(),
  legacyRunId: z.string().optional(),
  linkedRunId: z.string().uuid().optional(),
  status: WatcherRunStatusSchema,
  result: z.string().nullable().optional(),
  finalResult: z.string().nullable().optional(),
  executionLog: z.string().nullable().optional(),
  toolCalls: z.array(z.record(z.string(), z.unknown())).optional(),
  error: z.string().nullable().optional(),
  startedAt: z.string(),
  completedAt: z.string().nullable().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
})

export type WatcherRun = z.infer<typeof WatcherRunSchema>

export const UpsertWatcherRunSchema = z.object({
  id: z.string().uuid().optional(),
  watcherId: z.string().uuid(),
  legacyRunId: z.string().optional(),
  linkedRunId: z.string().uuid().optional(),
  status: WatcherRunStatusSchema,
  result: z.string().optional(),
  finalResult: z.string().optional(),
  executionLog: z.string().optional(),
  toolCalls: z.array(z.record(z.string(), z.unknown())).optional(),
  error: z.string().optional(),
  startedAt: z.string(),
  completedAt: z.string().optional(),
})

export type UpsertWatcherRun = z.infer<typeof UpsertWatcherRunSchema>
