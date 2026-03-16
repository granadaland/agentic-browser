/**
 * @license
 * Copyright 2025 BrowserOS
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import type { BrowserContext } from '@browseros/shared/schemas/browser-context'
import type {
  ArtifactPolicy,
  BudgetPolicy,
  ContextPolicy,
  RunProfile,
} from '@browseros/shared/schemas/runtime'
import type { UIMessageStreamEvent } from '@browseros/shared/schemas/ui-stream'
import type { UIMessage } from 'ai'
import type { RoutingPolicySummary } from '../../agent/provider-capabilities'
import { formatBrowserContext } from '../../agent/format-message'
import { logger } from '../../lib/logger'
import {
  RunStore,
  type BudgetStatsRecord,
  type RunStatus,
} from '../../lib/run-store'
import type { SkillMeta } from '../../skills/types'

interface RunTrackerConfig {
  runStore: RunStore
  runId: string
  conversationId: string
  requestMessage: string
  runProfile: RunProfile
  provider: string
  model: string
  browserContext?: BrowserContext
  resumedFromRunId?: string
  budgetPolicy?: BudgetPolicy
  artifactPolicy?: ArtifactPolicy
  contextPolicy?: ContextPolicy
  routingPolicy: RoutingPolicySummary
  availableSkills: SkillMeta[]
  selectedSkills: SkillMeta[]
}

function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4)
}

function stringifyValue(value: unknown): string {
  if (typeof value === 'string') return value
  try {
    return JSON.stringify(value, null, 2)
  } catch {
    return String(value)
  }
}

function summarizeText(text: string, maxChars = 280): string {
  if (text.length <= maxChars) return text
  return `${text.slice(0, Math.max(0, maxChars - 3))}...`
}

function extractLastAssistantText(messages: UIMessage[]): string {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index]
    if (message.role !== 'assistant') continue

    const text = message.parts
      .filter(
        (
          part,
        ): part is {
          type: 'text'
          text: string
        } =>
          part.type === 'text' &&
          'text' in part &&
          typeof part.text === 'string',
      )
      .map((part) => part.text)
      .join('')
      .trim()

    if (text) return text
  }

  return ''
}

export class RunTracker {
  private readonly toolCalls = new Map<string, string>()
  private readonly stats: Omit<BudgetStatsRecord, 'runId' | 'updatedAt'>
  private finalized = false

  constructor(private config: RunTrackerConfig) {
    this.stats = {
      requestChars: this.config.requestMessage.length,
      browserContextChars: formatBrowserContext(this.config.browserContext)
        .length,
      availableSkillsCount: this.config.availableSkills.length,
      availableSkillsChars: this.config.availableSkills.reduce(
        (total, skill) =>
          total +
          skill.name.length +
          skill.description.length +
          skill.location.length,
        0,
      ),
      selectedSkillsCount: this.config.selectedSkills.length,
      selectedSkillsChars: this.config.selectedSkills.reduce(
        (total, skill) =>
          total +
          skill.name.length +
          skill.description.length +
          skill.location.length,
        0,
      ),
      contextPacketsCount: 0,
      artifactCount: 0,
      externalizedChars: 0,
      toolCallCount: 0,
      sourceCount: 0,
      assistantOutputChars: 0,
      estimatedInputTokens: estimateTokens(this.config.requestMessage),
      estimatedOutputTokens: 0,
    }
  }

  start(): void {
    this.config.runStore.beginRun({
      id: this.config.runId,
      conversationId: this.config.conversationId,
      profile: this.config.runProfile,
      provider: this.config.provider,
      model: this.config.model,
      requestMessage: this.config.requestMessage,
      resumedFromRunId: this.config.resumedFromRunId,
      budgetPolicy: this.config.budgetPolicy,
      artifactPolicy: this.config.artifactPolicy,
      contextPolicy: this.config.contextPolicy,
      browserContext:
        this.config.browserContext as Record<string, unknown> | undefined,
    })

    this.config.runStore.recordRoutingPolicy(
      this.config.runId,
      this.config.runProfile,
      this.config.routingPolicy.strategy,
      {
        ...this.config.routingPolicy.stageModels,
        capabilities: this.config.routingPolicy.capabilities,
      },
    )

    this.config.runStore.addEvent(this.config.runId, {
      type: 'run.profile',
      stage: 'planner',
      title: `Run profile resolved: ${this.config.runProfile}`,
      data: {
        resumedFromRunId: this.config.resumedFromRunId ?? null,
        selectedSkills: this.config.selectedSkills.map((skill) => skill.name),
      },
    })

    if (
      this.config.browserContext &&
      this.config.contextPolicy?.reuseContextPackets !== false
    ) {
      const summary = summarizeText(
        formatBrowserContext(this.config.browserContext).trim(),
        400,
      )
      this.config.runStore.addContextPacket({
        runId: this.config.runId,
        conversationId: this.config.conversationId,
        packetType: 'browser-context',
        packetKey: `browser-context:${this.config.conversationId}`,
        summary,
        data: this.config.browserContext as Record<string, unknown>,
      })
      this.stats.contextPacketsCount += 1
    }

    this.flushBudgetStats()
  }

  addCheckpoint(
    label: string,
    stage: 'planner' | 'executor' | 'verifier',
    status: string,
    data?: Record<string, unknown>,
  ): void {
    this.config.runStore.addCheckpoint(this.config.runId, {
      label,
      stage,
      status,
      data,
    })
  }

  addResumePacket(summary: string, data?: Record<string, unknown>): void {
    if (this.config.contextPolicy?.reuseContextPackets === false) return

    this.config.runStore.addContextPacket({
      runId: this.config.runId,
      conversationId: this.config.conversationId,
      packetType: 'resume-context',
      packetKey: `resume:${this.config.runId}`,
      summary,
      data,
    })
    this.stats.contextPacketsCount += 1
  }

  async observeEvent(event: UIMessageStreamEvent): Promise<void> {
    switch (event.type) {
      case 'start-step':
        this.config.runStore.updateStage(
          this.config.runId,
          'executor',
          'Executor step started',
        )
        return
      case 'finish-step':
        this.config.runStore.addEvent(this.config.runId, {
          type: 'run.step.completed',
          stage: 'executor',
          title: 'Executor step finished',
        })
        return
      case 'tool-input-start':
        this.toolCalls.set(event.toolCallId, event.toolName)
        this.stats.toolCallCount += 1
        this.config.runStore.addEvent(this.config.runId, {
          type: 'tool.input.start',
          stage: 'executor',
          title: `Tool started: ${event.toolName}`,
          data: {
            toolCallId: event.toolCallId,
          },
        })
        return
      case 'tool-input-available':
        this.toolCalls.set(event.toolCallId, event.toolName)
        this.config.runStore.addEvent(this.config.runId, {
          type: 'tool.input.available',
          stage: 'executor',
          title: `Tool input ready: ${event.toolName}`,
          detail: summarizeText(stringifyValue(event.input), 240),
          data: {
            toolCallId: event.toolCallId,
          },
        })
        return
      case 'tool-input-error':
        this.config.runStore.addEvent(this.config.runId, {
          type: 'tool.input.error',
          stage: 'executor',
          title: 'Tool input error',
          detail: event.errorText,
          data: {
            toolCallId: event.toolCallId,
          },
        })
        return
      case 'tool-output-available':
        await this.handleToolOutput(event.toolCallId, event.output)
        return
      case 'tool-output-error':
        this.config.runStore.addEvent(this.config.runId, {
          type: 'tool.output.error',
          stage: 'executor',
          title: 'Tool output error',
          detail: event.errorText,
          data: {
            toolCallId: event.toolCallId,
            toolName: this.toolCalls.get(event.toolCallId) ?? null,
          },
        })
        return
      case 'source-url':
        this.stats.sourceCount += 1
        this.config.runStore.addEvent(this.config.runId, {
          type: 'source.url',
          stage: 'verifier',
          title: 'Source captured',
          detail: event.title ?? event.url,
          data: {
            sourceId: event.sourceId,
            url: event.url,
          },
        })
        return
      case 'file':
        await this.handleFileEvent(event.url, event.mediaType)
        return
      case 'error':
        this.config.runStore.addEvent(this.config.runId, {
          type: 'run.stream.error',
          stage: 'verifier',
          title: 'Run stream error',
          detail: event.errorText,
        })
        this.finish('failed', event.errorText)
        return
      case 'abort':
        this.finish('aborted', 'Run aborted by client')
        return
      case 'finish':
        this.config.runStore.updateStage(
          this.config.runId,
          'verifier',
          'Verifier finished',
          `Finish reason: ${event.finishReason}`,
          {
            finishReason: event.finishReason,
            messageMetadata:
              (event.messageMetadata as Record<string, unknown> | undefined) ??
              null,
          },
        )
        return
      default:
        return
    }
  }

  async finalize(messages: UIMessage[]): Promise<void> {
    if (this.finalized) return

    const finalText = extractLastAssistantText(messages)
    if (finalText) {
      this.stats.assistantOutputChars = finalText.length
      this.stats.estimatedOutputTokens = estimateTokens(finalText)

      if (
        this.config.artifactPolicy?.mode === 'auto' &&
        this.config.artifactPolicy?.captureFiles !== false &&
        finalText.length > (this.config.artifactPolicy?.inlineMaxChars ?? 2_000)
      ) {
        await this.config.runStore.saveArtifact({
          runId: this.config.runId,
          kind: 'assistant-response',
          name: 'assistant-response',
          content: finalText,
          mimeType: 'text/plain',
          previewText: summarizeText(finalText, 240),
        })
        this.stats.artifactCount += 1
        this.stats.externalizedChars += finalText.length
      }
    }

    this.finish(
      'completed',
      finalText ? summarizeText(finalText, 240) : 'Run completed',
    )
  }

  failBeforeStream(error: unknown): void {
    const errorText = error instanceof Error ? error.message : String(error)
    this.finish('failed', errorText)
  }

  private finish(status: RunStatus, detail?: string): void {
    if (this.finalized) return
    this.finalized = true
    this.flushBudgetStats()
    this.config.runStore.finishRun({
      runId: this.config.runId,
      status,
      stage: 'verifier',
      verificationSummary: status === 'completed' ? detail : undefined,
      errorText: status === 'completed' ? undefined : detail,
    })
  }

  private flushBudgetStats(): void {
    this.config.runStore.saveBudgetStats(this.config.runId, this.stats)
  }

  private async handleToolOutput(
    toolCallId: string,
    output: unknown,
  ): Promise<void> {
    const toolName = this.toolCalls.get(toolCallId) ?? 'unknown-tool'
    const outputText = stringifyValue(output)
    const previewText = summarizeText(outputText, 240)

    this.config.runStore.addEvent(this.config.runId, {
      type: 'tool.output.available',
      stage: 'executor',
      title: `Tool output: ${toolName}`,
      detail: previewText,
      data: {
        toolCallId,
      },
    })

    if (
      this.config.contextPolicy?.reuseContextPackets !== false &&
      this.stats.contextPacketsCount <
        (this.config.contextPolicy?.maxPackets ?? 6)
    ) {
      this.config.runStore.addContextPacket({
        runId: this.config.runId,
        conversationId: this.config.conversationId,
        packetType: 'tool-output',
        packetKey: `${toolName}:${toolCallId}`,
        summary: previewText,
        data:
          outputText.length <= 2_000
            ? ({ toolName, output } as Record<string, unknown>)
            : ({ toolName, previewText } as Record<string, unknown>),
      })
      this.stats.contextPacketsCount += 1
    }

    if (
      this.config.artifactPolicy?.mode === 'off' ||
      this.config.artifactPolicy?.mode === 'inline' ||
      this.config.artifactPolicy?.captureToolOutputs === false
    ) {
      return
    }

    const inlineLimit = this.config.artifactPolicy?.inlineMaxChars ?? 2_000
    if (outputText.length <= inlineLimit) {
      return
    }

    await this.config.runStore.saveArtifact({
      runId: this.config.runId,
      kind: 'tool-output',
      name: `${toolName}-${toolCallId}`,
      content: outputText,
      mimeType: 'application/json',
      previewText,
    })
    this.stats.artifactCount += 1
    this.stats.externalizedChars += outputText.length
  }

  private async handleFileEvent(url: string, mediaType: string): Promise<void> {
    const content = JSON.stringify({ url, mediaType }, null, 2)

    try {
      await this.config.runStore.saveArtifact({
        runId: this.config.runId,
        kind: 'file',
        name: 'generated-file',
        content,
        mimeType: 'application/json',
        previewText: summarizeText(content, 200),
      })
      this.stats.artifactCount += 1
      this.stats.externalizedChars += content.length
    } catch (error) {
      logger.warn('Failed to persist file event artifact', {
        runId: this.config.runId,
        error: error instanceof Error ? error.message : String(error),
      })
    }
  }
}
