import { describe, it, expect, vi } from 'vitest'
import { EventProcessor } from '@/lib/events/EventProcessor'
import { EventBus } from '@/lib/events/EventBus'

describe('EventProcessor', () => {
  it('should emit debug messages when debug mode is enabled', () => {
    const eventBus = new EventBus({ debugMode: true })
    const eventProcessor = new EventProcessor(eventBus)
    
    // Spy on emitDebug method
    const emitDebugSpy = vi.spyOn(eventBus, 'emitDebug')
    
    // Call debug method
    eventProcessor.debug('Test debug message', { someData: 'test' })
    
    // Verify emitDebug was called with correct arguments
    expect(emitDebugSpy).toHaveBeenCalledWith(
      'Test debug message',
      { someData: 'test' },
      'BrowserAgent'
    )
  })

  it('should not emit debug messages when debug mode is disabled', () => {
    const eventBus = new EventBus({ debugMode: false })
    const eventProcessor = new EventProcessor(eventBus)
    
    // Create a listener to verify no events are emitted
    const debugListener = vi.fn()
    eventBus.onStreamEvent('debug.message', debugListener)
    
    // Call debug method
    eventProcessor.debug('Test debug message', { someData: 'test' })
    
    // Verify no debug events were emitted
    expect(debugListener).not.toHaveBeenCalled()
  })
})