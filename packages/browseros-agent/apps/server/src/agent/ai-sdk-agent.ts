import type { LanguageModelV3 } from '@ai-sdk/provider'
import { AGENT_LIMITS } from '@browseros/shared/constants/limits'
import type { BrowserContext } from '@browseros/shared/schemas/browser-context'
import {
  type LanguageModel,
  type ModelMessage,
  stepCountIs,
  type ToolSet,
  ToolLoopAgent,
  type UIMessage,
  wrapLanguageModel,
} from 'ai'
import type { Browser } from '../browser/browser'
import { getSkillsDir } from '../lib/browseros-dir'
import type { KlavisClient } from '../lib/clients/klavis/klavis-client'
import { logger } from '../lib/logger'
import { isSoulBootstrap, readSoul } from '../lib/soul'
import { buildSkillsCatalog } from '../skills/catalog'
import { loadSkills } from '../skills/loader'
import { selectSkillsForTask } from '../skills/ranking'
import { buildFilesystemToolSet } from '../tools/filesystem/build-toolset'
import { buildMemoryToolSet } from '../tools/memory/build-toolset'
import type { ToolRegistry } from '../tools/tool-registry'
import { CHAT_MODE_ALLOWED_TOOLS } from './chat-mode'
import { createCompactionPrepareStep, type StepWithUsage } from './compaction'
import { createContextOverflowMiddleware } from './context-overflow-middleware'
import { buildMcpServerSpecs, createMcpClients } from './mcp-builder'
import {
  getMessageNormalizationOptions,
  normalizeMessagesForModel,
} from './message-normalization'
import { buildSystemPrompt } from './prompt'
import { createLanguageModel } from './provider-factory'
import { isReadOnlyRunProfile } from './run-profile'
import { buildBrowserToolSet } from './tool-adapter'
import type { ResolvedAgentConfig } from './types'

export interface AiSdkAgentConfig {
  resolvedConfig: ResolvedAgentConfig
  browser: Browser
  registry: ToolRegistry
  browserContext?: BrowserContext
  klavisClient?: KlavisClient
  browserosId?: string
}

const READ_ONLY_FILESYSTEM_TOOLS = new Set([
  'filesystem_read',
  'filesystem_grep',
  'filesystem_find',
  'filesystem_ls',
])

const READ_ONLY_MEMORY_TOOLS = new Set([
  'memory_search',
  'memory_read_core',
  'soul_read',
])

function filterToolSet<T extends Record<string, unknown>>(
  tools: T,
  allowedTools: Set<string>,
): T {
  return Object.fromEntries(
    Object.entries(tools).filter(([name]) => allowedTools.has(name)),
  ) as T
}

function omitToolSet<T extends Record<string, unknown>>(
  tools: T,
  blockedTools: Set<string>,
): T {
  return Object.fromEntries(
    Object.entries(tools).filter(([name]) => !blockedTools.has(name)),
  ) as T
}

export class AiSdkAgent {
  private constructor(
    private _agent: ToolLoopAgent,
    private _messages: UIMessage[],
    private _mcpClients: Array<{ close(): Promise<void> }>,
    private conversationId: string,
  ) {}

  static async create(config: AiSdkAgentConfig): Promise<AiSdkAgent> {
    const contextWindow =
      config.resolvedConfig.contextWindowSize ??
      AGENT_LIMITS.DEFAULT_CONTEXT_WINDOW

    // Build language model with overflow protection middleware
    const rawModel = createLanguageModel(config.resolvedConfig)
    const isV3Model =
      typeof rawModel === 'object' &&
      rawModel !== null &&
      'specificationVersion' in rawModel &&
      rawModel.specificationVersion === 'v3'
    const model = isV3Model
      ? wrapLanguageModel({
          model: rawModel as LanguageModelV3,
          middleware: createContextOverflowMiddleware(contextWindow),
        })
      : rawModel

    // Build browser tools from the unified tool registry
    const allBrowserTools = buildBrowserToolSet(
      config.registry,
      config.browser,
      config.resolvedConfig.workingDir,
    )
    const browserTools =
      config.resolvedConfig.chatMode ||
      isReadOnlyRunProfile(config.resolvedConfig.runProfile)
      ? Object.fromEntries(
          Object.entries(allBrowserTools).filter(([name]) =>
            CHAT_MODE_ALLOWED_TOOLS.has(name),
          ),
        )
      : allBrowserTools
    if (
      config.resolvedConfig.chatMode ||
      isReadOnlyRunProfile(config.resolvedConfig.runProfile)
    ) {
      logger.info('Read-only browser tools enabled', {
        runProfile: config.resolvedConfig.runProfile,
        allowedTools: Array.from(CHAT_MODE_ALLOWED_TOOLS),
      })
    }

    // Build external MCP server specs (Klavis, custom) and connect clients
    const specs = await buildMcpServerSpecs({
      browserContext: config.browserContext,
      klavisClient: config.klavisClient,
      browserosId: config.browserosId,
    })
    const { clients, tools: externalMcpTools } = await createMcpClients(specs)

    // Add filesystem tools (Pi coding agent) and narrow them for research runs.
    const allFilesystemTools = buildFilesystemToolSet(
      config.resolvedConfig.workingDir,
    )
    const filesystemTools = config.resolvedConfig.chatMode
      ? {}
      : config.resolvedConfig.runProfile === 'research'
        ? filterToolSet(allFilesystemTools, READ_ONLY_FILESYSTEM_TOOLS)
        : allFilesystemTools
    const allMemoryTools = buildMemoryToolSet()
    const memoryTools = config.resolvedConfig.chatMode
      ? {}
      : config.resolvedConfig.runProfile === 'research'
        ? filterToolSet(allMemoryTools, READ_ONLY_MEMORY_TOOLS)
        : allMemoryTools
    let tools: ToolSet = {
      ...browserTools,
      ...externalMcpTools,
      ...filesystemTools,
      ...memoryTools,
    }

    if (
      config.resolvedConfig.isScheduledTask ||
      config.resolvedConfig.chatMode
    ) {
      tools = omitToolSet(
        tools,
        new Set(['suggest_schedule', 'suggest_app_connection']),
      )
    }

    // Build system prompt with optional section exclusions
    const excludeSections: string[] = []
    if (config.resolvedConfig.isScheduledTask) {
      excludeSections.push('tab-grouping')
    }
    if (
      config.resolvedConfig.isScheduledTask ||
      config.resolvedConfig.chatMode
    ) {
      excludeSections.push('nudges')
    }
    const soulContent = await readSoul()
    const isBootstrap = await isSoulBootstrap()

    // Load only the highest-signal skills for this run profile.
    const skills = await loadSkills(getSkillsDir())
    const selectedSkills = selectSkillsForTask(
      skills,
      config.resolvedConfig.initialUserMessage,
      config.resolvedConfig.runProfile,
    )
    const skillsCatalog =
      selectedSkills.length > 0 ? buildSkillsCatalog(selectedSkills) : undefined

    const instructions = buildSystemPrompt({
      userSystemPrompt: config.resolvedConfig.userSystemPrompt,
      exclude: excludeSections,
      isScheduledTask: config.resolvedConfig.isScheduledTask,
      scheduledTaskWindowId: config.browserContext?.windowId,
      workspaceDir: config.resolvedConfig.workingDir,
      soulContent,
      isSoulBootstrap: isBootstrap,
      chatMode: config.resolvedConfig.chatMode,
      connectedApps: config.browserContext?.enabledMcpServers,
      declinedApps: config.resolvedConfig.declinedApps,
      skillsCatalog,
      runProfile: config.resolvedConfig.runProfile,
    })

    // Configure compaction for context window management
    const compactionPrepareStep = createCompactionPrepareStep({
      contextWindow,
    })
    const normalizationOptions = getMessageNormalizationOptions(
      config.resolvedConfig,
    )
    const prepareStep = async (options: {
      messages: ModelMessage[]
      steps: ReadonlyArray<StepWithUsage>
      model: LanguageModel
      experimental_context: unknown
    }) =>
      compactionPrepareStep({
        ...options,
        messages: normalizeMessagesForModel(
          options.messages,
          normalizationOptions,
        ),
      })

    // Create the ToolLoopAgent
    const agent = new ToolLoopAgent({
      model,
      instructions,
      tools,
      stopWhen: [stepCountIs(AGENT_LIMITS.MAX_TURNS)],
      prepareStep,
    })

    logger.info('Agent session created (v2)', {
      conversationId: config.resolvedConfig.conversationId,
      provider: config.resolvedConfig.provider,
      model: config.resolvedConfig.model,
      runProfile: config.resolvedConfig.runProfile,
      selectedSkillCount: selectedSkills.length,
      toolCount: Object.keys(tools).length,
    })

    return new AiSdkAgent(
      agent,
      [],
      clients,
      config.resolvedConfig.conversationId,
    )
  }

  get toolLoopAgent(): ToolLoopAgent {
    return this._agent
  }

  get messages(): UIMessage[] {
    return this._messages
  }

  set messages(msgs: UIMessage[]) {
    this._messages = msgs
  }

  appendUserMessage(content: string): void {
    this._messages.push({
      id: crypto.randomUUID(),
      role: 'user',
      parts: [{ type: 'text', text: content }],
    })
  }

  async dispose(): Promise<void> {
    for (const client of this._mcpClients) {
      await client.close().catch(() => {})
    }
    logger.info('Agent disposed', { conversationId: this.conversationId })
  }
}
