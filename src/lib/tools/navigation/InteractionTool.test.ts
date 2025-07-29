import { describe, it, expect, vi } from 'vitest'
import { InteractionTool } from './InteractionTool'
import { ExecutionContext } from '@/lib/runtime/ExecutionContext'
import { MessageManager } from '@/lib/runtime/MessageManager'
import { BrowserContext } from '@/lib/browser/BrowserContext'
import { EventBus, EventProcessor } from '@/lib/events'

describe('InteractionTool', () => {
  // Unit Test 1: Tool creation
  it('tests that interaction tool can be created', () => {
    const executionContext = new ExecutionContext({
      browserContext: new BrowserContext(),
      messageManager: new MessageManager(),
      abortController: new AbortController(),
      debugMode: false,
      eventBus: new EventBus(),
      eventProcessor: new EventProcessor(new EventBus())
    })
    
    const tool = new InteractionTool(executionContext)
    expect(tool).toBeDefined()
  })

  // Unit Test 2: Input validation
  it('tests that inputs are validated correctly', async () => {
    const executionContext = new ExecutionContext({
      browserContext: new BrowserContext(),
      messageManager: new MessageManager(),
      abortController: new AbortController(),
      debugMode: false,
      eventBus: new EventBus(),
      eventProcessor: new EventProcessor(new EventBus())
    })
    
    const tool = new InteractionTool(executionContext)
    
    // Test missing index for click
    let result = await tool.execute({ operationType: 'click' })
    expect(result.ok).toBe(false)
    expect(result.output).toBe('click operation requires index parameter')
    
    // Test missing text for input_text
    result = await tool.execute({ operationType: 'input_text', index: 1 })
    expect(result.ok).toBe(false)
    expect(result.output).toBe('input_text operation requires text parameter')
    
    // Test missing keys for send_keys
    result = await tool.execute({ operationType: 'send_keys' })
    expect(result.ok).toBe(false)
    expect(result.output).toBe('send_keys operation requires keys parameter')
  })

  // Unit Test 3: Handle element not found
  it('tests that element not found errors are handled', async () => {
    const browserContext = new BrowserContext()
    const executionContext = new ExecutionContext({
      browserContext,
      messageManager: new MessageManager(),
      abortController: new AbortController(),
      debugMode: false,
      eventBus: new EventBus(),
      eventProcessor: new EventProcessor(new EventBus())
    })
    
    // Mock page with no element
    const mockPage = {
      getElementByIndex: vi.fn().mockResolvedValue(null)
    }
    vi.spyOn(browserContext, 'getCurrentPage').mockResolvedValue(mockPage as any)
    
    const tool = new InteractionTool(executionContext)
    const result = await tool.execute({
      operationType: 'click',
      index: 999
    })
    
    expect(result.ok).toBe(false)
    expect(result.output).toBe('Element with index 999 not found')
  })

  // Unit Test 4: File upload detection
  it('tests that file upload elements are detected and rejected', async () => {
    const browserContext = new BrowserContext()
    const executionContext = new ExecutionContext({
      browserContext,
      messageManager: new MessageManager(),
      abortController: new AbortController(),
      debugMode: false,
      eventBus: new EventBus(),
      eventProcessor: new EventProcessor(new EventBus())
    })
    
    // Mock page with file input element
    const mockElement = { nodeId: 1, tag: 'input', attributes: { type: 'file' } }
    const mockPage = {
      getElementByIndex: vi.fn().mockResolvedValue(mockElement),
      isFileUploader: vi.fn().mockReturnValue(true)
    }
    vi.spyOn(browserContext, 'getCurrentPage').mockResolvedValue(mockPage as any)
    
    const tool = new InteractionTool(executionContext)
    const result = await tool.execute({
      operationType: 'click',
      index: 1
    })
    
    expect(result.ok).toBe(false)
    expect(result.output).toContain('file upload dialog')
  })
})