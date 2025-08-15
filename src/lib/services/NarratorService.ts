import { ExecutionContext } from '@/lib/runtime/ExecutionContext'
import { PubSub } from '@/lib/pubsub'
import { Message, PubSubEvent, Subscription } from '@/lib/pubsub/types'
import { generateNarratorSystemPrompt, generateNarrationPrompt } from './Narrator.prompt'
import { HumanMessage, SystemMessage } from '@langchain/core/messages'
import { AbortError } from '@/lib/utils/Abortable'

/**
 * NarratorService - Runs alongside BrowserAgent to provide human-friendly narrations
 * of technical execution steps. Uses non-blocking processing to avoid impacting
 * BrowserAgent performance.
 */
export class NarratorService {
  private readonly executionContext: ExecutionContext
  private subscription?: Subscription
  private isEnabled: boolean = true
  private processedMessages = new Set<string>()  // Track processed messages to avoid duplicates
  private llmPromise?: Promise<any>  // Cached LLM instance
  private isProcessing: boolean = false  // Prevent concurrent narrations

  constructor(executionContext: ExecutionContext) {
    this.executionContext = executionContext
    this.initialize()
  }

  private initialize(): void {
    // Subscribe to PubSub events
    const pubsub = this.executionContext.getPubSub()
    
    this.subscription = pubsub.subscribe((event: PubSubEvent) => {
      // Use queueMicrotask for non-blocking processing
      queueMicrotask(() => this.handleEvent(event))
    })
  }

  private async handleEvent(event: PubSubEvent): Promise<void> {
    if (!this.isEnabled || this.isProcessing) return
    
    // Stop processing if we see an assistant message (thinking is done)
    if (event.type === 'message' && event.payload.role === 'assistant') {
      this.isEnabled = false
      return
    }
    
    // Only process message events with thinking role
    if (event.type !== 'message' || event.payload.role !== 'thinking') {
      return
    }
    
    const message = event.payload
    
    // Skip if already processed (avoid loops)
    if (this.processedMessages.has(message.msgId)) {
      return
    }
    
    // Mark as processing to prevent concurrent narrations
    this.isProcessing = true
    
    try {
      this._checkIfAborted()  // Check abort before starting
      
      // Generate narration using LLM streaming
      await this.generateNarration(message)
      this.processedMessages.add(message.msgId)
      
    } catch (error) {
      // Don't log errors for user cancellation
      if (!(error instanceof AbortError)) {
        console.error('Narrator error:', error)
      }
    } finally {
      this.isProcessing = false
    }
  }

  /**
   * Check if execution has been aborted and throw if so
   */
  private _checkIfAborted(): void {
    if (this.executionContext.abortController.signal.aborted) {
      throw new AbortError()
    }
  }

  /**
   * Generate narration for a message using LLM streaming
   */
  private async generateNarration(message: Message): Promise<void> {
    // Access available context
    const currentTask = this.executionContext.getCurrentTask()
    const todos = this.executionContext.todoStore?.getXml()
    const conversationHistory = this.executionContext.messageManager.getMessages().slice(-3).map(m => `${m._getType()}: ${m.content}`).join('\n')
    
    try {
      // Get or cache LLM instance
      if (!this.llmPromise) {
        this.llmPromise = this.executionContext.getLLM({ temperature: 0.7 })
      }
      const llm = await this.llmPromise
      
      // Build messages for narration
      const messages = [
        new SystemMessage(generateNarratorSystemPrompt()),
        new HumanMessage(generateNarrationPrompt(
          message.content,
          currentTask,
          conversationHistory,
          todos
        ))
      ]
      
      // Stream the narration
      const stream = await llm.stream(messages, {
        signal: this.executionContext.abortController.signal
      })
      
      // Create a message ID for streaming updates
      const narrationId = PubSub.generateId('narration')
      let accumulatedContent = ''
      
      for await (const chunk of stream) {
        this._checkIfAborted()
        
        if (chunk.content && typeof chunk.content === 'string') {
          accumulatedContent += chunk.content
          
          // Publish streaming narration
          this.executionContext.getPubSub().publishMessage(
            PubSub.createMessageWithId(narrationId, accumulatedContent, 'narration')
          )
        }
      }
      
      // Final narration message
      if (accumulatedContent) {
        this.executionContext.getPubSub().publishMessage(
          PubSub.createMessageWithId(narrationId, accumulatedContent, 'narration')
        )
      }
    } catch (error) {
      console.error('Failed to generate narration:', error)
    }
  }

  // Control methods
  enable(): void {
    this.isEnabled = true
  }
  
  disable(): void {
    this.isEnabled = false
  }
  
  cleanup(): void {
    this.subscription?.unsubscribe()
    this.processedMessages.clear()
  }
}
