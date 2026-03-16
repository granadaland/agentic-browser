/**
 * @license
 * Copyright 2025 BrowserOS
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import type { RunProfile } from '@browseros/shared/schemas/runtime'
import type { SkillMeta } from './types'

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9]+/g)
    .filter((token) => token.length >= 3)
}

function scoreSkill(skill: SkillMeta, queryTokens: Set<string>): number {
  const haystack = tokenize(`${skill.name} ${skill.description}`)
  let score = 0

  for (const token of haystack) {
    if (queryTokens.has(token)) score += 1
  }

  const normalizedName = skill.name.toLowerCase()
  for (const token of queryTokens) {
    if (normalizedName.includes(token)) score += 2
  }

  return score
}

export function selectSkillsForTask(
  skills: SkillMeta[],
  task: string,
  runProfile: RunProfile,
): SkillMeta[] {
  if (skills.length <= 6) return skills

  const limitByProfile: Record<RunProfile, number> = {
    ask: 3,
    do: 5,
    research: 4,
    build: 6,
    watch: 4,
  }

  const queryTokens = new Set(tokenize(task))
  if (queryTokens.size === 0) {
    return skills.slice(0, limitByProfile[runProfile])
  }

  const ranked = skills
    .map((skill) => ({ skill, score: scoreSkill(skill, queryTokens) }))
    .sort((a, b) => b.score - a.score || a.skill.name.localeCompare(b.skill.name))

  const winners = ranked
    .filter((entry) => entry.score > 0)
    .slice(0, limitByProfile[runProfile])
    .map((entry) => entry.skill)

  if (winners.length > 0) return winners
  return skills.slice(0, Math.min(2, skills.length))
}

export function estimateSkillsCatalogChars(skills: SkillMeta[]): number {
  return skills.reduce(
    (total, skill) =>
      total + skill.name.length + skill.description.length + skill.location.length,
    0,
  )
}
