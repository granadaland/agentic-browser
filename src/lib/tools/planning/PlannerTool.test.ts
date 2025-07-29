import { describe, it, expect, vi } from 'vitest'
import { createPlannerTool } from './PlannerTool'
import { ExecutionContext } from '@/lib/runtime/ExecutionContext'
import { MessageManager } from '@/lib/runtime/MessageManager'
import { BrowserContext } from '@/lib/browser/BrowserContext'
import { EventBus } from '@/lib/events'

describe('PlannerTool', () => {
  it('tests that planner tool can be created with required dependencies', () => {
    // Setup minimal execution context
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
    
    const tool = createPlannerTool(executionContext)
    
    expect(tool).toBeDefined()
    expect(tool.name).toBe('planner_tool')
    expect(tool.description).toBeDefined()
    expect(typeof tool.func).toBe('function')
  })

  it('tests that errors are handled gracefully', async () => {
    // Create execution context with failing LLM
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
    
    // Override getLLM to throw error
    executionContext.getLLM = vi.fn().mockRejectedValue(new Error('LLM connection failed'))
    
    const tool = createPlannerTool(executionContext)
    const result = await tool.func({ task: 'Test task', max_steps: 3 })
    const parsedResult = JSON.parse(result)
    
    expect(parsedResult.ok).toBe(false)
    expect(parsedResult.output).toContain('Planning failed')
    expect(parsedResult.output).toContain('LLM connection failed')
  })

})
