/**
 * @license
 * Copyright 2025 BrowserOS
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import type { RunProfile } from '@browseros/shared/schemas/runtime'

type LegacyMode = 'chat' | 'agent'

interface RunProfileInput {
  runProfile?: RunProfile
  mode?: LegacyMode
  isScheduledTask?: boolean
}

export function resolveRunProfile(input: RunProfileInput): RunProfile {
  if (input.runProfile) return input.runProfile
  if (input.isScheduledTask) return 'watch'
  if (input.mode === 'chat') return 'ask'
  return 'do'
}

export function isReadOnlyRunProfile(runProfile: RunProfile): boolean {
  return runProfile === 'ask' || runProfile === 'research'
}

export function shouldUseChatMode(
  runProfile: RunProfile,
  legacyMode?: LegacyMode,
): boolean {
  return legacyMode === 'chat' || runProfile === 'ask'
}

export function shouldUseScheduledWindow(
  runProfile: RunProfile,
  isScheduledTask?: boolean,
): boolean {
  return isScheduledTask === true || runProfile === 'watch'
}
