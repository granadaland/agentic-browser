/**
 * @license
 * Copyright 2025 BrowserOS
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import { mkdir, utimes } from 'node:fs/promises'
import path from 'node:path'
import type { BrowserContext } from '@browseros/shared/schemas/browser-context'
import {
  ArtifactPolicySchema,
  BudgetPolicySchema,
  ContextPolicySchema,
} from '@browseros/shared/schemas/runtime'
import { createAgentUIStreamResponse, type UIMessage } from 'ai'
import { AiSdkAgent } from '../../agent/ai-sdk-agent'
import { formatUserMessage } from '../../agent/format-message'
import { resolveRoutingPolicy } from '../../agent/provider-capabilities'
import {
  resolveRunProfile,
  shouldUseChatMode,
  shouldUseScheduledWindow,
} from '../../agent/run-profile'
import type { SessionStore } from '../../agent/session-store'
import type { ResolvedAgentConfig } from '../../agent/types'
import type { Browser } from '../../browser/browser'
import { getSessionsDir, getSkillsDir } from '../../lib/browseros-dir'
import type { KlavisClient } from '../../lib/clients/klavis/klavis-client'
import { getDb } from '../../lib/db'
import { resolveLLMConfig } from '../../lib/clients/llm/config'
import { logger } from '../../lib/logger'
import { RunStore } from '../../lib/run-store'
import { loadSkills } from '../../skills/loader'
import { selectSkillsForTask } from '../../skills/ranking'
import type { ToolRegistry } from '../../tools/tool-registry'
import { tapUIMessageStreamResponse } from '../utils/observe-ui-message-stream'
import type { ChatRequest } from '../types'
import { RunTracker } from './run-tracker'

export interface ChatServiceDeps {
  sessionStore: SessionStore
  klavisClient: KlavisClient
  browser: Browser
  registry: ToolRegistry
  browserosId?: string
}

export class ChatService {
  private readonly runStore = new RunStore(getDb())

  constructor(private deps: ChatServiceDeps) {}

  async processMessage(
    request: ChatRequest,
    abortSignal: AbortSignal,
  ): Promise<Response> {
    const { sessionStore } = this.deps
    const runProfile = resolveRunProfile(request)
    const budgetPolicy = BudgetPolicySchema.parse(request.budgetPolicy ?? {})
    const artifactPolicy = ArtifactPolicySchema.parse(
      request.artifactPolicy ?? {},
    )
    const contextPolicy = ContextPolicySchema.parse(request.contextPolicy ?? {})
    const chatMode = shouldUseChatMode(runProfile, request.mode)
    const isScheduledTask = shouldUseScheduledWindow(
      runProfile,
      request.isScheduledTask,
    )

    const [llmConfig, skills, workingDir] = await Promise.all([
      resolveLLMConfig(request, this.deps.browserosId),
      loadSkills(getSkillsDir()),
      this.resolveSessionDir(request),
    ])

    const selectedSkills = selectSkillsForTask(skills, request.message, runProfile)
    const routingPolicy = resolveRoutingPolicy({
      provider: llmConfig.provider,
      model: llmConfig.model,
      supportsImages: request.supportsImages,
      runProfile,
      budgetPolicy,
    })
    const executionModel =
      budgetPolicy.executorModel ??
      (runProfile === 'ask' || runProfile === 'research'
        ? routingPolicy.stageModels.executor
        : llmConfig.model)

    const agentConfig: ResolvedAgentConfig = {
      conversationId: request.conversationId,
      provider: llmConfig.provider,
      model: executionModel,
      apiKey: llmConfig.apiKey,
      baseUrl: llmConfig.baseUrl,
      upstreamProvider: llmConfig.upstreamProvider,
      resourceName: llmConfig.resourceName,
      region: llmConfig.region,
      accessKeyId: llmConfig.accessKeyId,
      secretAccessKey: llmConfig.secretAccessKey,
      sessionToken: llmConfig.sessionToken,
      contextWindowSize: request.contextWindowSize,
      userSystemPrompt: request.userSystemPrompt,
      workingDir,
      supportsImages: request.supportsImages,
      chatMode,
      isScheduledTask,
      declinedApps: request.declinedApps,
      runProfile,
      initialUserMessage: request.message,
      budgetPolicy,
      artifactPolicy,
      contextPolicy,
      resumeRunId: request.resumeRunId,
    }

    const tracker = new RunTracker({
      runStore: this.runStore,
      runId: crypto.randomUUID(),
      conversationId: request.conversationId,
      requestMessage: request.message,
      runProfile,
      provider: llmConfig.provider,
      model: executionModel,
      browserContext: request.browserContext,
      resumedFromRunId: request.resumeRunId,
      budgetPolicy,
      artifactPolicy,
      contextPolicy,
      routingPolicy,
      availableSkills: skills,
      selectedSkills,
    })
    tracker.start()

    try {
      let session = sessionStore.get(request.conversationId)
      let isNewSession = false
      const mcpServerKey = this.buildMcpServerKey(request.browserContext)

      if (session && session.mcpServerKey !== mcpServerKey) {
        logger.info('MCP servers changed mid-conversation, rebuilding session', {
          conversationId: request.conversationId,
          previous: session.mcpServerKey,
          current: mcpServerKey,
        })

        const previousMessages = session.agent.messages
        const previousHiddenWindowId = session.hiddenWindowId
        await session.agent.dispose()
        sessionStore.remove(request.conversationId)

        const browserContext = await this.resolvePageIds(request.browserContext)
        const agent = await AiSdkAgent.create({
          resolvedConfig: agentConfig,
          browser: this.deps.browser,
          registry: this.deps.registry,
          browserContext,
          klavisClient: this.deps.klavisClient,
          browserosId: this.deps.browserosId,
        })

        session = {
          agent,
          browserContext,
          hiddenWindowId: previousHiddenWindowId,
          mcpServerKey,
        }
        session.agent.messages = previousMessages
        sessionStore.set(request.conversationId, session)

        tracker.addCheckpoint(
          'Session rebuilt after MCP server change',
          'planner',
          'completed',
          {
            hiddenWindowId: previousHiddenWindowId ?? null,
          },
        )
      }

      if (!session) {
        isNewSession = true
        let hiddenWindowId: number | undefined
        let browserContext = await this.resolvePageIds(request.browserContext)

        if (isScheduledTask) {
          try {
            const win = await this.deps.browser.createWindow({ hidden: true })
            hiddenWindowId = win.windowId
            const pageId = await this.deps.browser.newPage('about:blank', {
              windowId: hiddenWindowId,
            })
            browserContext = {
              ...browserContext,
              windowId: hiddenWindowId,
              activeTab: {
                id: pageId,
                pageId,
                url: 'about:blank',
                title: 'Scheduled Task',
              },
            }
            logger.info('Created hidden window for scheduled task', {
              conversationId: request.conversationId,
              windowId: hiddenWindowId,
              pageId,
            })
            tracker.addCheckpoint(
              'Background watch window created',
              'planner',
              'completed',
              {
                windowId: hiddenWindowId,
                pageId,
              },
            )
          } catch (error) {
            logger.warn('Failed to create hidden window, using default', {
              error: error instanceof Error ? error.message : String(error),
            })
          }
        }

        const agent = await AiSdkAgent.create({
          resolvedConfig: agentConfig,
          browser: this.deps.browser,
          registry: this.deps.registry,
          browserContext,
          klavisClient: this.deps.klavisClient,
          browserosId: this.deps.browserosId,
        })

        session = { agent, hiddenWindowId, browserContext, mcpServerKey }
        sessionStore.set(request.conversationId, session)

        tracker.addCheckpoint(
          'Agent session created',
          'planner',
          'completed',
          {
            hiddenWindowId: hiddenWindowId ?? null,
            isScheduledTask,
            chatMode,
          },
        )
      }

      if (!session) {
        throw new Error('Failed to initialize agent session')
      }

      if (isNewSession && request.previousConversation?.length) {
        for (const msg of request.previousConversation) {
          session.agent.messages.push({
            id: crypto.randomUUID(),
            role: msg.role === 'assistant' ? 'assistant' : 'user',
            parts: [{ type: 'text', text: msg.content }],
          })
        }
        logger.info('Injected previous conversation history', {
          conversationId: request.conversationId,
          messageCount: request.previousConversation.length,
        })
      }

      const activeSession = session

      const resumeContext = request.resumeRunId
        ? this.buildResumeContext(request.resumeRunId)
        : null
      if (resumeContext) {
        tracker.addResumePacket(resumeContext.summary, resumeContext.data)
      }

      const messageContext = isScheduledTask
        ? (activeSession.browserContext ?? request.browserContext)
        : request.browserContext
      // Scheduled tasks already have correct internal pageIds from browser.newPage();
      // calling resolvePageIds would pass those to resolveTabIds (which expects Chrome
      // tab IDs), corrupting them back to undefined.
      const resolvedMessageContext = isScheduledTask
        ? messageContext
        : await this.resolvePageIds(messageContext)
      const messageWithResumeContext = resumeContext
        ? `${resumeContext.prompt}\n\n${request.message}`
        : request.message
      const userContent = formatUserMessage(
        messageWithResumeContext,
        resolvedMessageContext,
      )
      activeSession.agent.appendUserMessage(userContent)

      const response = await createAgentUIStreamResponse({
        agent: activeSession.agent.toolLoopAgent,
        uiMessages: activeSession.agent.messages,
        abortSignal,
        onFinish: async ({ messages }: { messages: UIMessage[] }) => {
          activeSession.agent.messages = messages
          await tracker.finalize(messages)
          logger.info('Agent execution complete', {
            conversationId: request.conversationId,
            totalMessages: messages.length,
            runProfile,
          })

          if (activeSession.hiddenWindowId) {
            const windowId = activeSession.hiddenWindowId
            activeSession.hiddenWindowId = undefined
            this.closeHiddenWindow(windowId, request.conversationId)
          }
        },
      })

      return tapUIMessageStreamResponse(response, async (event) => {
        await tracker.observeEvent(event)
      })
    } catch (error) {
      tracker.failBeforeStream(error)
      throw error
    }
  }

  async deleteSession(
    conversationId: string,
  ): Promise<{ deleted: boolean; sessionCount: number }> {
    const session = this.deps.sessionStore.get(conversationId)
    if (session?.hiddenWindowId) {
      const windowId = session.hiddenWindowId
      session.hiddenWindowId = undefined
      this.closeHiddenWindow(windowId, conversationId)
    }
    const deleted = await this.deps.sessionStore.delete(conversationId)
    return { deleted, sessionCount: this.deps.sessionStore.count() }
  }

  // Browser context arrives with Chrome tab IDs, but tools expect internal page IDs.
  // Resolve the mapping upfront so the agent's first navigation doesn't fail.
  private async resolvePageIds(
    browserContext?: BrowserContext,
  ): Promise<BrowserContext | undefined> {
    if (!browserContext) return undefined

    const tabIdSet = new Set<number>()
    if (browserContext.activeTab) tabIdSet.add(browserContext.activeTab.id)
    if (browserContext.selectedTabs) {
      for (const tab of browserContext.selectedTabs) tabIdSet.add(tab.id)
    }
    if (browserContext.tabs) {
      for (const tab of browserContext.tabs) tabIdSet.add(tab.id)
    }

    if (tabIdSet.size === 0) return browserContext

    const tabToPage = await this.deps.browser.resolveTabIds([...tabIdSet])

    const addPageId = (tab: { id: number; url?: string; title?: string }) => {
      const pageId = tabToPage.get(tab.id)
      if (pageId === undefined) {
        logger.warn('Could not resolve page ID for tab', { tabId: tab.id })
      }
      return { ...tab, pageId }
    }

    logger.debug('Resolved tab IDs to page IDs', {
      mapping: Object.fromEntries(tabToPage),
    })

    return {
      ...browserContext,
      activeTab: browserContext.activeTab
        ? addPageId(browserContext.activeTab)
        : undefined,
      selectedTabs: browserContext.selectedTabs?.map(addPageId),
      tabs: browserContext.tabs?.map(addPageId),
    }
  }

  private closeHiddenWindow(windowId: number, conversationId: string): void {
    this.deps.browser.closeWindow(windowId).catch((error) => {
      logger.warn('Failed to close hidden window', {
        windowId,
        conversationId,
        error: error instanceof Error ? error.message : String(error),
      })
    })
  }

  private buildMcpServerKey(browserContext?: BrowserContext): string {
    const managed = browserContext?.enabledMcpServers?.slice().sort() ?? []
    const custom =
      browserContext?.customMcpServers?.map((s) => s.url).sort() ?? []
    return [...managed, ...custom].join(',')
  }

  private async resolveSessionDir(request: ChatRequest): Promise<string> {
    const dir = request.userWorkingDir
      ? request.userWorkingDir
      : path.join(getSessionsDir(), request.conversationId)
    await mkdir(dir, { recursive: true })
    if (!request.userWorkingDir) {
      const now = new Date()
      await utimes(dir, now, now).catch(() => {})
    }
    return dir
  }

  private buildResumeContext(resumeRunId: string): {
    prompt: string
    summary: string
    data: Record<string, unknown>
  } | null {
    const run = this.runStore.getRun(resumeRunId)
    if (!run) return null

    const contextPackets = this.runStore
      .getContextPackets({ runId: resumeRunId, limit: 4 })
      .map((packet) => `- [${packet.packetType}] ${packet.summary}`)
    const artifacts = this.runStore
      .getRunArtifacts(resumeRunId)
      .slice(-2)
      .map((artifact) => `- ${artifact.name}: ${artifact.previewText ?? artifact.filePath}`)

    const sections = [
      `Previous run ${resumeRunId} (${run.status})`,
      contextPackets.length > 0
        ? `Context packets:\n${contextPackets.join('\n')}`
        : '',
      artifacts.length > 0 ? `Artifacts:\n${artifacts.join('\n')}` : '',
    ].filter(Boolean)

    if (sections.length === 0) return null

    return {
      prompt: `## Resumed Run Context\n${sections.join('\n\n')}`,
      summary: sections.join(' | '),
      data: {
        resumedFromRunId: resumeRunId,
        contextPackets: contextPackets.length,
        artifacts: artifacts.length,
      },
    }
  }
}
