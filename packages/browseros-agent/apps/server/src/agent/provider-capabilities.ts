/**
 * @license
 * Copyright 2025 BrowserOS
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import type { LLMProvider } from '@browseros/shared/schemas/llm'
import type { BudgetPolicy, RunProfile } from '@browseros/shared/schemas/runtime'

type Tier = 'low' | 'medium' | 'high'
type ReliabilityTier = 'experimental' | 'standard' | 'strong'

export interface ProviderCapabilitySummary {
  provider: LLMProvider
  model: string
  supportsImages: boolean
  costTier: Tier
  latencyTier: Tier
  contextTier: Tier
  toolCallReliability: ReliabilityTier
}

export interface RoutingPolicySummary {
  strategy: string
  profile: RunProfile
  stageModels: {
    planner: string
    executor: string
    verifier: string
    recovery: string
  }
  capabilities: ProviderCapabilitySummary
}

interface RoutingInput {
  provider: LLMProvider
  model: string
  supportsImages?: boolean
  runProfile: RunProfile
  budgetPolicy?: BudgetPolicy
}

function classifyCostTier(model: string): Tier {
  const normalized = model.toLowerCase()
  if (
    normalized.includes('mini') ||
    normalized.includes('haiku') ||
    normalized.includes('flash')
  ) {
    return 'low'
  }
  if (
    normalized.includes('sonnet') ||
    normalized.includes('gpt-4.1') ||
    normalized.includes('gpt-4o')
  ) {
    return 'medium'
  }
  return 'high'
}

function classifyLatencyTier(model: string): Tier {
  const normalized = model.toLowerCase()
  if (
    normalized.includes('mini') ||
    normalized.includes('haiku') ||
    normalized.includes('flash')
  ) {
    return 'low'
  }
  if (normalized.includes('sonnet') || normalized.includes('gpt-4o')) {
    return 'medium'
  }
  return 'high'
}

function classifyContextTier(provider: LLMProvider): Tier {
  if (provider === 'google' || provider === 'anthropic') return 'high'
  if (provider === 'openai' || provider === 'browseros') return 'medium'
  return 'low'
}

function classifyReliability(provider: LLMProvider): ReliabilityTier {
  if (
    provider === 'openai' ||
    provider === 'browseros' ||
    provider === 'anthropic'
  ) {
    return 'strong'
  }
  if (provider === 'google' || provider === 'azure' || provider === 'bedrock') {
    return 'standard'
  }
  return 'experimental'
}

function deriveCheaperSibling(
  provider: LLMProvider,
  model: string,
): string | null {
  if (provider === 'openai') {
    if (model.includes('gpt-4o-mini') || model.includes('gpt-4.1-mini')) {
      return null
    }
    if (model.includes('gpt-4o')) return model.replace('gpt-4o', 'gpt-4o-mini')
    if (model.includes('gpt-4.1')) {
      return model.replace('gpt-4.1', 'gpt-4.1-mini')
    }
  }

  if (provider === 'google') {
    if (model.includes('flash')) return null
    if (model.includes('pro')) return model.replace('pro', 'flash')
  }

  if (provider === 'anthropic') {
    if (model.includes('haiku')) return null
    if (model.includes('sonnet')) return model.replace('sonnet', 'haiku')
  }

  return null
}

function deriveStrongerSibling(
  provider: LLMProvider,
  model: string,
): string | null {
  if (provider === 'openai') {
    if (model.includes('gpt-4o-mini')) {
      return model.replace('gpt-4o-mini', 'gpt-4o')
    }
    if (model.includes('gpt-4.1-mini')) {
      return model.replace('gpt-4.1-mini', 'gpt-4.1')
    }
  }

  if (provider === 'google' && model.includes('flash')) {
    return model.replace('flash', 'pro')
  }

  if (provider === 'anthropic' && model.includes('haiku')) {
    return model.replace('haiku', 'sonnet')
  }

  return null
}

export function getProviderCapabilities(
  provider: LLMProvider,
  model: string,
  supportsImages = true,
): ProviderCapabilitySummary {
  return {
    provider,
    model,
    supportsImages,
    costTier: classifyCostTier(model),
    latencyTier: classifyLatencyTier(model),
    contextTier: classifyContextTier(provider),
    toolCallReliability: classifyReliability(provider),
  }
}

export function resolveRoutingPolicy(input: RoutingInput): RoutingPolicySummary {
  const strategy = input.budgetPolicy?.strategy ?? 'balanced'
  const capabilities = getProviderCapabilities(
    input.provider,
    input.model,
    input.supportsImages,
  )

  const cheaper = deriveCheaperSibling(input.provider, input.model)
  const stronger = deriveStrongerSibling(input.provider, input.model)

  let plannerModel =
    input.budgetPolicy?.plannerModel ??
    (strategy === 'efficiency' || strategy === 'speed' ? cheaper : null) ??
    input.model
  let executorModel =
    input.budgetPolicy?.executorModel ??
    ((input.runProfile === 'ask' || input.runProfile === 'research') &&
    (strategy === 'efficiency' || strategy === 'speed')
      ? cheaper
      : null) ??
    input.model
  let verifierModel =
    input.budgetPolicy?.verifierModel ??
    (strategy === 'quality' ? stronger : cheaper) ??
    input.model
  const recoveryModel = stronger ?? input.model

  if (strategy === 'quality') {
    plannerModel = input.model
    executorModel = input.budgetPolicy?.executorModel ?? input.model
    verifierModel = input.budgetPolicy?.verifierModel ?? recoveryModel
  }

  return {
    strategy,
    profile: input.runProfile,
    stageModels: {
      planner: plannerModel,
      executor: executorModel,
      verifier: verifierModel,
      recovery: recoveryModel,
    },
    capabilities,
  }
}
