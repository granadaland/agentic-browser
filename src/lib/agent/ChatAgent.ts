import { ExecutionContext } from '@/lib/runtime/ExecutionContext'
import { MessageManager } from '@/lib/runtime/MessageManager'
import { ToolManager } from '@/lib/tools/ToolManager'
import { createScreenshotTool } from '@/lib/tools/utils/ScreenshotTool'
import { createScrollTool } from '@/lib/tools/navigation/ScrollTool'
import { createRefreshStateTool } from '@/lib/tools/navigation/RefreshStateTool'
import { generateChatSystemPrompt } from './ChatAgent.prompt'
import { AIMessage, AIMessageChunk } from '@langchain/core/messages'
import { EventProcessor } from '@/lib/events/EventProcessor'
import { AbortError } from '@/lib/utils/Abortable'
import { Logging } from '@/lib/utils/Logging'

// Type definitions
interface ExtractedPageContext {
  tabs: Array<{
    id: number
    url: string
    title: string
    text: string
  }>
  isSingleTab: boolean
}

/**
 * ChatAgent - Lightweight agent for Q&A interactions with web pages
 * Optimized for sub-400ms first response through two-pass design
 */
export class ChatAgent {
  // Constants
  private static readonly MAX_TURNS = 20
  private static readonly TOOLS = ['screenshot_tool', 'scroll_tool', 'refresh_browser_state_tool']
  private static readonly DEFAULT_CHARS_PER_TAB = 6000
  
  private readonly executionContext: ExecutionContext
  private readonly toolManager: ToolManager

  constructor(executionContext: ExecutionContext) {
    this.executionContext = executionContext
    this.toolManager = new ToolManager(executionContext)
    this._registerTools()
  }

  // Getters for context components
  private get messageManager(): MessageManager {
    return this.executionContext.messageManager
  }

  private get eventEmitter(): EventProcessor {
    return this.executionContext.getEventProcessor()
  }

  /**
   * Register only the minimal tools needed for Q&A
   */
  private _registerTools(): void {
    // Only register the 3 essential tools for Q&A
    this.toolManager.register(createScreenshotTool(this.executionContext))
    this.toolManager.register(createScrollTool(this.executionContext))
    this.toolManager.register(createRefreshStateTool(this.executionContext))
    
    Logging.log('ChatAgent', `Registered ${this.toolManager.getAll().length} tools for Q&A mode`)
  }

  /**
   * Check abort signal and throw if aborted
   */
  private _checkAborted(): void {
    if (this.executionContext.abortController.signal.aborted) {
      throw new AbortError()
    }
  }

  /**
   * Main execution entry point - streamlined for Q&A
   */
  async execute(query: string): Promise<void> {
    try {
      this._checkAborted()
      
      // Extract page context once
      const pageContext = await this._extractPageContext()
      
      // Generate minimal system prompt
      const systemPrompt = generateChatSystemPrompt(pageContext)
      
      // Initialize chat with system prompt and query
      this._initializeChat(systemPrompt, query)
      
      // Pass 1: Direct streaming without tools (target <400ms)
      const startTime = performance.now()
      const pass1Message = await this._streamLLM({ tools: false })
      const elapsed = performance.now() - startTime
      
      if (elapsed > 400) {
        Logging.log('ChatAgent', `Pass 1 took ${elapsed.toFixed(0)}ms (target: <400ms)`, 'warning')
      } else {
        Logging.log('ChatAgent', `Pass 1 completed in ${elapsed.toFixed(0)}ms`, 'info')
      }
      
      // Check if Pass 1 provided a confident answer
      if (this._isConfident(pass1Message)) {
        Logging.log('ChatAgent', 'Pass 1 provided confident answer, completing')
        return
      }
      
      // TODO: Implement Pass 2 with tools (future enhancement)
      // For now, just log that Pass 2 would be needed
      Logging.log('ChatAgent', 'Pass 2 with tools would be triggered here (not implemented yet)')
      
    } catch (error) {
      if (error instanceof AbortError) {
        Logging.log('ChatAgent', 'Execution aborted by user')
        this.eventEmitter.emitCompletion('Execution cancelled')
      } else {
        const errorMessage = error instanceof Error ? error.message : String(error)
        Logging.log('ChatAgent', `Execution failed: ${errorMessage}`, 'error')
        this.eventEmitter.emitError(errorMessage)
      }
      throw error
    }
  }

  /**
   * Extract page context from selected tabs
   */
  private async _extractPageContext(): Promise<ExtractedPageContext> {
    // Get selected tab IDs from execution context
    const selectedTabIds = this.executionContext.getSelectedTabIds()
    const hasUserSelectedTabs = Boolean(selectedTabIds && selectedTabIds.length > 0)
    
    // Get browser pages
    const pages = await this.executionContext.browserContext.getPages(
      hasUserSelectedTabs && selectedTabIds ? selectedTabIds : undefined
    )
    
    if (pages.length === 0) {
      throw new Error('No tabs available for context extraction')
    }
    
    // Calculate per-tab character budget
    const perTabBudget = Math.floor(ChatAgent.DEFAULT_CHARS_PER_TAB / Math.max(1, pages.length))
    
    // Extract content from each tab
    const tabs = await Promise.all(
      pages.map(async page => {
        const textSnapshot = await page.getTextSnapshot()
        const text = textSnapshot.sections?.map((section: any) => 
          section.content || section.text || ''
        ).join('\n') || 'No content found'
        
        return {
          id: page.tabId,
          url: page.url(),
          title: await page.title(),
          text: this._smartTruncate(text, perTabBudget)
        }
      })
    )
    
    return {
      tabs,
      isSingleTab: tabs.length === 1
    }
  }

  /**
   * Smart truncation that preserves document structure
   */
  private _smartTruncate(text: string, maxLength: number): string {
    if (text.length <= maxLength) return text
    
    // Try to break at paragraph boundary
    const truncated = text.substring(0, maxLength)
    const lastNewline = truncated.lastIndexOf('\n')
    
    // If we found a newline in the last 20% of the text, use it
    if (lastNewline > maxLength * 0.8) {
      return truncated.substring(0, lastNewline)
    }
    
    return truncated
  }

  /**
   * Initialize chat session with system prompt and user query
   */
  private _initializeChat(systemPrompt: string, query: string): void {
    // Clear any previous messages
    this.messageManager.clear()
    
    // Add system prompt
    this.messageManager.addSystem(systemPrompt)
    
    // Add user query
    this.messageManager.addHuman(query)
    
    Logging.log('ChatAgent', 'Chat session initialized')
  }

  /**
   * Stream LLM response with or without tools
   */
  private async _streamLLM(opts: { tools: boolean }): Promise<AIMessage> {
    const llm = await this.executionContext.getLLM({ temperature: 0.3 })
    
    // Only bind tools in Pass 2
    const llmToUse = opts.tools && llm.bindTools
      ? llm.bindTools(this.toolManager.getAll())
      : llm
    
    // Get current messages
    const messages = this.messageManager.getMessages()
    
    // Stream the response
    const stream = await llmToUse.stream(messages)
    
    // Accumulate chunks for final message
    const chunks: AIMessageChunk[] = []
    
    // Stream directly to UI without "thinking" state
    for await (const chunk of stream) {
      this._checkAborted()
      chunks.push(chunk)
      
      // Direct streaming to UI
      if (chunk.content) {
        this.eventEmitter.emitAgentThinking(chunk.content as string)
      }
    }
    
    // Accumulate final message
    const finalMessage = this._accumulateMessage(chunks)
    
    // Add to message history
    this.messageManager.addAI(finalMessage)
    
    return finalMessage
  }

  /**
   * Accumulate message chunks into a single AIMessage
   */
  private _accumulateMessage(chunks: AIMessageChunk[]): AIMessage {
    const content = chunks
      .map(c => c.content)
      .filter(Boolean)
      .join('')
    
    const toolCalls = chunks
      .flatMap(c => c.tool_calls || [])
      .filter(tc => tc.name) // Filter out incomplete tool calls
    
    return new AIMessage({ 
      content, 
      tool_calls: toolCalls.length > 0 ? toolCalls : undefined 
    })
  }

  /**
   * Check if the response is confident enough to stop at Pass 1
   */
  private _isConfident(message: AIMessage): boolean {
    const content = (message.content as string) || ''
    
    // Check for uncertainty indicators that suggest visual/scroll needs
    const uncertainPhrases = [
      'cannot see',
      'can\'t see', 
      'need to scroll',
      'need to view',
      'unable to see',
      'not visible',
      'below the fold',
      'screenshot',
      'visual'
    ]
    
    const hasUncertainty = uncertainPhrases.some(phrase => 
      content.toLowerCase().includes(phrase)
    )
    
    // Consider confident if substantive answer without uncertainty
    return content.length > 50 && !hasUncertainty
  }
}