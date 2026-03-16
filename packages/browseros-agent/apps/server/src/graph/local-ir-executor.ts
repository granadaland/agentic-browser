/**
 * @license
 * Copyright 2025 BrowserOS
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import { Agent, type LLMConfig, type UIMessageStreamEvent } from '@browseros-ai/agent-sdk'
import type { BrowserContext } from '@browseros/shared/schemas/browser-context'
import type {
  LocalWorkflowIR,
  WorkflowGraph,
} from '@browseros/shared/schemas/automation'
import { z } from 'zod'

type SupportedNodeType = 'nav' | 'act' | 'extract' | 'verify'

interface CompiledWorkflowStep {
  id: string
  type: SupportedNodeType
  label: string
}

export interface LocalWorkflowExecutorOptions {
  serverUrl: string
  llmConfig?: LLMConfig
  browserContext?: BrowserContext
  ir?: LocalWorkflowIR | null
  onProgress: (event: UIMessageStreamEvent) => void
  signal?: AbortSignal
}

export interface LocalWorkflowExecutorResult {
  success: boolean
  reason?: string
  result?: {
    executedSteps: Array<{
      id: string
      type: SupportedNodeType
      label: string
      output?: unknown
    }>
  }
}

function normalizeLabel(label: string): string {
  return label.trim().replace(/\s+/g, ' ')
}

function extractUrl(label: string): string | null {
  const normalized = label.trim()
  const explicitUrlMatch = normalized.match(
    /(https?:\/\/[^\s)]+|www\.[^\s)]+|[a-z0-9-]+\.[a-z]{2,}(?:\/[^\s)]*)?)/i,
  )
  if (!explicitUrlMatch?.[0]) return null

  const value = explicitUrlMatch[0]
  if (value.startsWith('http://') || value.startsWith('https://')) return value
  if (value.startsWith('www.')) return `https://${value}`
  if (/^[a-z0-9-]+\.[a-z]{2,}/i.test(value)) {
    return `https://${value}`
  }

  return null
}

export function buildLocalWorkflowIR(graph: WorkflowGraph): LocalWorkflowIR {
  if (graph.nodes.length === 0) {
    return {
      version: 1,
      mode: 'linear',
      supported: false,
      reason: 'Workflow graph is empty',
      steps: [],
    }
  }

  const nodes = new Map(graph.nodes.map((node) => [node.id, node]))
  const outgoing = new Map<string, string[]>()

  for (const edge of graph.edges) {
    const targets = outgoing.get(edge.source) ?? []
    targets.push(edge.target)
    outgoing.set(edge.source, targets)
  }

  const startNode =
    graph.nodes.find((node) => node.type === 'start') ?? graph.nodes[0]

  if (!startNode) {
    return {
      version: 1,
      mode: 'linear',
      supported: false,
      reason: 'Workflow graph has no start node',
      steps: [],
    }
  }

  const steps: CompiledWorkflowStep[] = []
  const visited = new Set<string>()
  let currentNodeId: string | undefined = startNode.id

  while (currentNodeId) {
    if (visited.has(currentNodeId)) {
      return {
        version: 1,
        mode: 'linear',
        supported: false,
        reason: 'Workflow graph contains a loop and cannot run locally yet',
        steps,
      }
    }
    visited.add(currentNodeId)

    const node = nodes.get(currentNodeId)
    if (!node) {
      return {
        version: 1,
        mode: 'linear',
        supported: false,
        reason: `Workflow node ${currentNodeId} could not be resolved`,
        steps,
      }
    }

    if (
      node.type === 'decision' ||
      node.type === 'loop' ||
      node.type === 'fork' ||
      node.type === 'join'
    ) {
      return {
        version: 1,
        mode: 'linear',
        supported: false,
        reason: `Node type "${node.type}" still requires the advanced executor`,
        steps,
      }
    }

    if (node.type !== 'start' && node.type !== 'end') {
      steps.push({
        id: node.id,
        type: node.type as SupportedNodeType,
        label: normalizeLabel(node.data.label),
      })
    }

    if (node.type === 'end') break

    const nextTargets = outgoing.get(node.id) ?? []
    if (nextTargets.length > 1) {
      return {
        version: 1,
        mode: 'linear',
        supported: false,
        reason: `Node "${node.data.label}" branches to multiple paths`,
        steps,
      }
    }

    currentNodeId = nextTargets[0]
  }

  return {
    version: 1,
    mode: 'linear',
    supported: true,
    steps,
  }
}

function emitText(
  onProgress: (event: UIMessageStreamEvent) => void,
  id: string,
  delta: string,
): void {
  onProgress({
    type: 'text-delta',
    id,
    delta,
  })
}

function summarizeUnknown(value: unknown): string {
  if (typeof value === 'string') return value
  try {
    const json = JSON.stringify(value, null, 2)
    return json.length > 320 ? `${json.slice(0, 317)}...` : json
  } catch {
    return String(value)
  }
}

export function canExecuteWorkflowGraphLocally(
  graph: WorkflowGraph,
  ir?: LocalWorkflowIR | null,
): {
  supported: boolean
  reason?: string
} {
  const compiled = ir ?? buildLocalWorkflowIR(graph)
  return {
    supported: compiled.supported,
    reason: compiled.reason,
  }
}

export async function executeWorkflowGraphLocally(
  graph: WorkflowGraph,
  options: LocalWorkflowExecutorOptions,
): Promise<LocalWorkflowExecutorResult> {
  const compiled = options.ir ?? buildLocalWorkflowIR(graph)
  if (!compiled.supported) {
    return {
      success: false,
      reason: compiled.reason,
    }
  }

  const streamId = 'workflow-local-ir'
  const executedSteps: Array<{
    id: string
    type: SupportedNodeType
    label: string
    output?: unknown
  }> = []

  options.onProgress({ type: 'text-start', id: streamId })
  emitText(
    options.onProgress,
    streamId,
    `Running ${compiled.steps.length} workflow steps with the local IR executor.\n`,
  )

  const finishWithFailure = (
    reason: string | undefined,
    steps: Array<{
      id: string
      type: SupportedNodeType
      label: string
      output?: unknown
    }>,
  ): LocalWorkflowExecutorResult => {
    options.onProgress({ type: 'text-end', id: streamId })
    return {
      success: false,
      reason,
      result: { executedSteps: steps },
    }
  }

  try {
    await using agent = new Agent({
      url: options.serverUrl,
      llm: options.llmConfig,
      browserContext: options.browserContext,
      onProgress: options.onProgress,
      signal: options.signal,
      stateful: true,
    })

    for (let index = 0; index < compiled.steps.length; index += 1) {
      const step = compiled.steps[index]
      emitText(
        options.onProgress,
        streamId,
        `Step ${index + 1}/${compiled.steps.length}: ${step.label}\n`,
      )

      if (step.type === 'nav') {
        const url = extractUrl(step.label)
        if (url) {
          const result = await agent.nav(url)
          executedSteps.push({ ...step, output: result })
          continue
        }

        const result = await agent.act(step.label, { maxRetries: 1 })
        if (!result.success) {
          return finishWithFailure(`Navigation step failed: ${step.label}`, [
            ...executedSteps,
            { ...step, output: result },
          ])
        }
        executedSteps.push({ ...step, output: result })
        continue
      }

      if (step.type === 'act') {
        const result = await agent.act(step.label, { maxRetries: 1 })
        if (!result.success) {
          return finishWithFailure(`Action step failed: ${step.label}`, [
            ...executedSteps,
            { ...step, output: result },
          ])
        }
        executedSteps.push({ ...step, output: result })
        continue
      }

      if (step.type === 'extract') {
        const result = await agent.extract(step.label, {
          schema: z.object({}).catchall(z.unknown()),
        })
        emitText(
          options.onProgress,
          streamId,
          `Extracted data: ${summarizeUnknown(result.data)}\n`,
        )
        executedSteps.push({ ...step, output: result.data })
        continue
      }

      if (step.type === 'verify') {
        const result = await agent.verify(step.label)
        executedSteps.push({ ...step, output: result })
        if (!result.success) {
          return finishWithFailure(result.reason, executedSteps)
        }
      }
    }

    emitText(
      options.onProgress,
      streamId,
      'Local workflow execution complete.\n',
    )
    options.onProgress({ type: 'text-end', id: streamId })

    return {
      success: true,
      result: {
        executedSteps,
      },
    }
  } catch (error) {
    options.onProgress({ type: 'text-end', id: streamId })
    return {
      success: false,
      reason: error instanceof Error ? error.message : String(error),
      result: {
        executedSteps,
      },
    }
  }
}
