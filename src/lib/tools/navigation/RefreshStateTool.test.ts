import { describe, it, expect, vi } from 'vitest'
import { RefreshStateTool } from './RefreshStateTool'
import { ExecutionContext } from '@/lib/runtime/ExecutionContext'
import { MessageManager } from '@/lib/runtime/MessageManager'
import { BrowserContext } from '@/lib/browser/BrowserContext'
import { EventBus, EventProcessor } from '@/lib/events'

describe('RefreshStateTool', () => {
  // Unit Test 1: Tool creation
  it('tests that refresh state tool can be created with required dependencies', () => {
    const executionContext = new ExecutionContext({
      browserContext: new BrowserContext(),
      messageManager: new MessageManager(),
      abortController: new AbortController(),
      debugMode: false,
      eventBus: new EventBus(),
      eventProcessor: new EventProcessor(new EventBus())
    })
    
    const tool = new RefreshStateTool(executionContext)
    expect(tool).toBeDefined()
  })

  // Unit Test 2: Successful refresh returns browser state
  it('tests that browser state is returned successfully', async () => {
    const browserContext = new BrowserContext()
    const executionContext = new ExecutionContext({
      browserContext,
      messageManager: new MessageManager(),
      abortController: new AbortController(),
      debugMode: false,
      eventBus: new EventBus(),
      eventProcessor: new EventProcessor(new EventBus())
    })
    
    // Mock current page
    const mockPage = {
      url: vi.fn().mockReturnValue('https://example.com')
    }
    vi.spyOn(browserContext, 'getCurrentPage').mockResolvedValue(mockPage as any)
    
    // Mock browser state
    const mockBrowserState = 'Current page: example.com\nClickable elements: [1] Submit'
    vi.spyOn(browserContext, 'getBrowserStateString').mockResolvedValue(mockBrowserState)
    
    const tool = new RefreshStateTool(executionContext)
    const result = await tool.execute({})
    
    expect(result.ok).toBe(true)
    expect(result.output).toBe(mockBrowserState)
  })

  // Unit Test 3: Handle no active page
  it('tests that no active page error is handled', async () => {
    const browserContext = new BrowserContext()
    const executionContext = new ExecutionContext({
      browserContext,
      messageManager: new MessageManager(),
      abortController: new AbortController(),
      debugMode: false,
      eventBus: new EventBus(),
      eventProcessor: new EventProcessor(new EventBus())
    })
    
    // Mock no current page
    vi.spyOn(browserContext, 'getCurrentPage').mockResolvedValue(null as any)
    
    const tool = new RefreshStateTool(executionContext)
    const result = await tool.execute({})
    
    expect(result.ok).toBe(false)
    expect(result.output).toBe('No active page to refresh state from')
  })

  // Unit Test 4: Handle browser context error
  it('tests that browser state retrieval errors are handled', async () => {
    const browserContext = new BrowserContext()
    const executionContext = new ExecutionContext({
      browserContext,
      messageManager: new MessageManager(),
      abortController: new AbortController(),
      debugMode: false,
      eventBus: new EventBus(),
      eventProcessor: new EventProcessor(new EventBus())
    })
    
    // Mock current page
    const mockPage = {
      url: vi.fn().mockReturnValue('https://example.com')
    }
    vi.spyOn(browserContext, 'getCurrentPage').mockResolvedValue(mockPage as any)
    
    // Mock browser state error
    vi.spyOn(browserContext, 'getBrowserStateString').mockRejectedValue(new Error('Failed to get browser state'))
    
    const tool = new RefreshStateTool(executionContext)
    const result = await tool.execute({})
    
    expect(result.ok).toBe(false)
    expect(result.output).toContain('Failed to refresh browser state: Failed to get browser state')
  })
})