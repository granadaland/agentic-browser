import { describe, it, expect, vi } from 'vitest'
import { ScrollTool } from './ScrollTool'
import { ExecutionContext } from '@/lib/runtime/ExecutionContext'
import { MessageManager } from '@/lib/runtime/MessageManager'
import { BrowserContext } from '@/lib/browser/BrowserContext'
import { EventBus, EventProcessor } from '@/lib/events'

describe('ScrollTool', () => {
  // Unit Test 1: Tool creation
  it('tests that scroll tool can be created', () => {
    const executionContext = new ExecutionContext({
      browserContext: new BrowserContext(),
      messageManager: new MessageManager(),
      abortController: new AbortController(),
      debugMode: false,
      eventBus: new EventBus(),
      eventProcessor: new EventProcessor(new EventBus())
    })
    
    const tool = new ScrollTool(executionContext)
    expect(tool).toBeDefined()
  })

  // Unit Test 2: Input validation
  it('tests that scroll_to_element validates index requirement', async () => {
    const executionContext = new ExecutionContext({
      browserContext: new BrowserContext(),
      messageManager: new MessageManager(),
      abortController: new AbortController(),
      debugMode: false,
      eventBus: new EventBus(),
      eventProcessor: new EventProcessor(new EventBus())
    })
    
    const tool = new ScrollTool(executionContext)
    const result = await tool.execute({
      operationType: 'scroll_to_element'
    })
    
    expect(result.ok).toBe(false)
    expect(result.output).toBe('scroll_to_element operation requires index parameter')
  })

  // Unit Test 3: Scroll operations
  it('tests that scroll operations execute correctly', async () => {
    const browserContext = new BrowserContext()
    const executionContext = new ExecutionContext({
      browserContext,
      messageManager: new MessageManager(),
      abortController: new AbortController(),
      debugMode: false,
      eventBus: new EventBus(),
      eventProcessor: new EventProcessor(new EventBus())
    })
    
    // Mock page with scroll methods
    const mockPage = {
      scrollDown: vi.fn().mockResolvedValue(undefined),
      scrollUp: vi.fn().mockResolvedValue(undefined),
      getElementByIndex: vi.fn().mockResolvedValue({ nodeId: 42, tag: 'button', text: 'Submit' }),
      scrollToElement: vi.fn().mockResolvedValue(true)
    }
    vi.spyOn(browserContext, 'getCurrentPage').mockResolvedValue(mockPage as any)
    
    const tool = new ScrollTool(executionContext)
    
    // Test scroll down (always 1 viewport)
    let result = await tool.execute({ operationType: 'scroll_down' })
    expect(result.ok).toBe(true)
    expect(mockPage.scrollDown).toHaveBeenCalledWith(1)
    
    // Test scroll up (always 1 viewport)
    result = await tool.execute({ operationType: 'scroll_up' })
    expect(result.ok).toBe(true)
    expect(mockPage.scrollUp).toHaveBeenCalledWith(1)
    
    // Test scroll to element
    result = await tool.execute({ operationType: 'scroll_to_element', index: 42 })
    expect(result.ok).toBe(true)
    expect(mockPage.scrollToElement).toHaveBeenCalledWith(42)
  })

  // Unit Test 4: Handle element not found
  it('tests that element not found is handled for scroll_to_element', async () => {
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
    
    const tool = new ScrollTool(executionContext)
    const result = await tool.execute({
      operationType: 'scroll_to_element',
      index: 999
    })
    
    expect(result.ok).toBe(false)
    expect(result.output).toBe('Element with index 999 not found')
  })
})