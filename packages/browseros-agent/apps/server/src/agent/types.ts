/**
 * @license
 * Copyright 2025 BrowserOS
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */
import type { LLMProvider } from '@browseros/shared/schemas/llm'
import type {
  ArtifactPolicy,
  BudgetPolicy,
  ContextPolicy,
  RunProfile,
} from '@browseros/shared/schemas/runtime'

export interface ProviderConfig {
  provider: LLMProvider
  model: string
  apiKey?: string
  baseUrl?: string
  upstreamProvider?: string
  resourceName?: string
  region?: string
  accessKeyId?: string
  secretAccessKey?: string
  sessionToken?: string
}

export interface ResolvedAgentConfig {
  conversationId: string
  provider: LLMProvider
  model: string
  apiKey?: string
  baseUrl?: string
  upstreamProvider?: string
  resourceName?: string
  region?: string
  accessKeyId?: string
  secretAccessKey?: string
  sessionToken?: string
  contextWindowSize?: number
  userSystemPrompt?: string
  workingDir: string
  /** Whether the model supports image inputs (vision). Defaults to true. */
  supportsImages?: boolean
  /** Eval mode - enables window management tools. Defaults to false. */
  evalMode?: boolean
  /** Chat mode - restricts to read-only tools (no browser automation). Defaults to false. */
  chatMode?: boolean
  /** Scheduled task mode - disables tab grouping. Defaults to false. */
  isScheduledTask?: boolean
  /** Apps the user previously declined to connect via MCP (chose "do it manually"). */
  declinedApps?: string[]
  /** BrowserOS 2 runtime profile resolved from legacy mode + explicit profile. */
  runProfile: RunProfile
  /** The user request that seeded this agent run. */
  initialUserMessage: string
  /** Optional run budget controls for adaptive routing and token discipline. */
  budgetPolicy?: BudgetPolicy
  /** Controls how large outputs are externalized into run artifacts. */
  artifactPolicy?: ArtifactPolicy
  /** Controls reuse and capture of structured context packets. */
  contextPolicy?: ContextPolicy
  /** Optional run resume source used for timeline and context carry-over. */
  resumeRunId?: string
}
