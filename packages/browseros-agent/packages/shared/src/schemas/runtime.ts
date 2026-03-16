/**
 * @license
 * Copyright 2025 BrowserOS
 * SPDX-License-Identifier: AGPL-3.0-or-later
 *
 * Shared runtime configuration schemas for BrowserOS 2.
 */

import { z } from 'zod'

export const RunProfileSchema = z.enum([
  'ask',
  'do',
  'research',
  'build',
  'watch',
])

export type RunProfile = z.infer<typeof RunProfileSchema>

export const BudgetStrategySchema = z.enum([
  'balanced',
  'speed',
  'quality',
  'efficiency',
])

export type BudgetStrategy = z.infer<typeof BudgetStrategySchema>

export const BudgetPolicySchema = z.object({
  strategy: BudgetStrategySchema.default('balanced'),
  maxInputTokens: z.number().int().positive().optional(),
  maxOutputTokens: z.number().int().positive().optional(),
  plannerModel: z.string().min(1).optional(),
  executorModel: z.string().min(1).optional(),
  verifierModel: z.string().min(1).optional(),
})

export type BudgetPolicy = z.infer<typeof BudgetPolicySchema>

export const ArtifactModeSchema = z.enum(['off', 'inline', 'auto'])

export type ArtifactMode = z.infer<typeof ArtifactModeSchema>

export const ArtifactPolicySchema = z.object({
  mode: ArtifactModeSchema.default('auto'),
  inlineMaxChars: z.number().int().positive().default(2_000),
  captureToolOutputs: z.boolean().default(true),
  captureFiles: z.boolean().default(true),
})

export type ArtifactPolicy = z.infer<typeof ArtifactPolicySchema>

export const ContextModeSchema = z.enum(['compact', 'balanced', 'rich'])

export type ContextMode = z.infer<typeof ContextModeSchema>

export const ContextPolicySchema = z.object({
  mode: ContextModeSchema.default('balanced'),
  reuseContextPackets: z.boolean().default(true),
  cachePageDigests: z.boolean().default(true),
  maxPackets: z.number().int().positive().default(6),
})

export type ContextPolicy = z.infer<typeof ContextPolicySchema>

