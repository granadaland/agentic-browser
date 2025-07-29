import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createValidatorTool } from './ValidatorTool'
import { MessageManager } from '@/lib/runtime/MessageManager'

describe('ValidatorTool', () => {
  let mockExecutionContext: any
  let mockMessageManager: MessageManager
  let mockBrowserContext: any
  let mockLLM: any

  beforeEach(() => {
    // Create mock instances
    mockMessageManager = new MessageManager()
    
    // Mock browser context methods
    mockBrowserContext = {
      getBrowserStateString: vi.fn().mockResolvedValue(
        'Current URL: https://example.com\nPage title: Example Page\nClickable elements: [1] Submit button'
      )
    }
    
    // Mock LLM with structured output
    mockLLM = {
      withStructuredOutput: vi.fn().mockReturnValue({
        invoke: vi.fn().mockResolvedValue({
          isComplete: true,  // Add isComplete field
          reasoning: 'Task completed successfully. The submit button was clicked and confirmation page is displayed.',
          confidence: 'high',
          suggestions: []
        })
      })
    }
    
    // Create mock execution context
    mockExecutionContext = {
      getLLM: vi.fn().mockResolvedValue(mockLLM),
      messageManager: mockMessageManager,
      browserContext: mockBrowserContext
    }
    
    // Add some message history
    mockMessageManager.addHuman('Submit the form')
    mockMessageManager.addAI('I will submit the form for you')
  })

  it('tests that the tool can be created with required dependencies', () => {
    const tool = createValidatorTool(mockExecutionContext)
    
    expect(tool).toBeDefined()
    expect(tool.name).toBe('validator_tool')
    expect(tool.description).toBe('Validate if the task has been completed based on current browser state')
  })

  it('tests that the tool handles LLM errors gracefully', async () => {
    // Mock LLM to throw error
    mockLLM.withStructuredOutput.mockReturnValue({
      invoke: vi.fn().mockRejectedValue(new Error('LLM service unavailable'))
    })
    
    const tool = createValidatorTool(mockExecutionContext)
    const result = await tool.func({ task: 'Submit the form' })
    const parsedResult = JSON.parse(result)
    
    expect(parsedResult.ok).toBe(false)
    expect(parsedResult.output).toContain('Validation failed: LLM service unavailable')
  })

  it('tests that the tool returns isComplete field in output', async () => {
    const tool = createValidatorTool(mockExecutionContext)
    const result = await tool.func({ task: 'Submit the form' })
    const parsedResult = JSON.parse(result)
    
    expect(parsedResult.ok).toBe(true)
    
    const validationData = JSON.parse(parsedResult.output)
    expect(validationData).toHaveProperty('isComplete')
    expect(validationData.isComplete).toBe(true)  // Based on our mock
    expect(validationData).toHaveProperty('reasoning')
    expect(validationData).toHaveProperty('confidence')
    expect(validationData).toHaveProperty('suggestions')
  })

  it('tests that validation considers browser state and message history', async () => {
    const tool = createValidatorTool(mockExecutionContext)
    
    await tool.func({ task: 'Navigate to checkout page' })
    
    // Verify browser state was retrieved
    expect(mockBrowserContext.getBrowserStateString).toHaveBeenCalled()
    
    // Verify LLM was called with structured output
    expect(mockLLM.withStructuredOutput).toHaveBeenCalled()
    
    // Verify invoke was called with system and human messages
    const invokeCall = mockLLM.withStructuredOutput().invoke
    expect(invokeCall).toHaveBeenCalled()
    
    const messages = invokeCall.mock.calls[0][0]
    expect(messages).toHaveLength(2)
    expect(messages[0]._getType()).toBe('system')
    expect(messages[1]._getType()).toBe('human')
    
    // Verify the human message contains the message history from MessageManager
    const humanMessage = messages[1]
    const humanMessageContent = humanMessage.content as string
    
    // Check that message history was included (from lines 41-42 in setup)
    expect(humanMessageContent).toContain('Submit the form')
    expect(humanMessageContent).toContain('I will submit the form for you')
    
    // Also verify it contains the browser state
    expect(humanMessageContent).toContain('https://example.com')
    expect(humanMessageContent).toContain('Example Page')
  })
})

describe('ValidatorTool Integration Test', () => {
  const hasApiKey = process.env.LITELLM_API_KEY && process.env.LITELLM_API_KEY !== 'nokey'
  
  it.skipIf(!hasApiKey)(
    'tests that ordering task is not complete when only in cart',
    async () => {
      // Import required modules for integration test
      const { ExecutionContext } = await import('@/lib/runtime/ExecutionContext')
      const { MessageManager } = await import('@/lib/runtime/MessageManager')
      const { BrowserContext } = await import('@/lib/browser/BrowserContext')
      const { EventBus } = await import('@/lib/events')
      
      // Setup
      const messageManager = new MessageManager()
      const browserContext = new BrowserContext()
      const abortController = new AbortController()
      const eventBus = new EventBus()
      
      const executionContext = new ExecutionContext({
        browserContext,
        messageManager,
        abortController,
        debugMode: false,
        eventBus
      })
      
      // Mock Amazon cart page state
      const getBrowserStateStringSpy = vi.spyOn(browserContext, 'getBrowserStateString').mockResolvedValue(`
Current URL: https://www.amazon.com/gp/cart/view.html
Page title: Amazon.com Shopping Cart

Page content:
Shopping Cart
Your Amazon Cart is not empty

Colgate Total Whitening Toothpaste, 4.8 oz
Price: $4.99
Quantity: 1
Subtotal: $4.99

Cart subtotal (1 item): $4.99

Clickable elements:
[1] Proceed to checkout
[2] Delete item
[3] Save for later
[4] Change quantity
[5] Continue shopping

Typeable elements:
[1] Quantity input field
[2] Gift message textbox
      `)
      
      // Add execution history showing navigation to cart
      messageManager.addHuman('Order toothpaste from Amazon')
      messageManager.addAI('I will help you order toothpaste from Amazon')
      messageManager.addTool(JSON.stringify({
        ok: true,
        output: 'Navigated to Amazon.com'
      }), 'nav_1')
      messageManager.addAI('Searching for toothpaste')
      messageManager.addTool(JSON.stringify({
        ok: true,
        output: 'Searched for "toothpaste" - found Colgate Total Whitening'
      }), 'search_1')
      messageManager.addAI('Adding toothpaste to cart')
      messageManager.addTool(JSON.stringify({
        ok: true,
        output: 'Added Colgate Total Whitening Toothpaste to cart'
      }), 'click_1')
      
      // Create validator tool and test
      const validatorTool = createValidatorTool(executionContext)
      
      const result = await validatorTool.func({
        task: 'Order toothpaste from Amazon'
      })
      
      const parsedResult = JSON.parse(result)
      expect(parsedResult.ok).toBe(true)
      
      const validationData = JSON.parse(parsedResult.output)
      
      // Should NOT be complete - item is in cart but not ordered
      expect(validationData.isComplete).toBe(false)
      expect(validationData.suggestions.length).toBeGreaterThan(0)
      
      // Should suggest proceeding to checkout
      const suggestsCheckout = validationData.suggestions.some((s: string) => 
        s.toLowerCase().includes('checkout') || 
        s.toLowerCase().includes('proceed')
      )
      expect(suggestsCheckout).toBe(true)
      
      console.log('✅ Integration test passed - ValidatorTool correctly identifies incomplete order')
      console.log('Validation result:', {
        isComplete: validationData.isComplete,
        reasoning: validationData.reasoning,
        confidence: validationData.confidence,
        suggestions: validationData.suggestions
      })
      
      // Cleanup
      getBrowserStateStringSpy.mockRestore()
    },
    30000
  )
})