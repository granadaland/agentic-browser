import { describe, it, expect, beforeEach } from 'vitest'
import { PubSub } from './PubSub'
import { ExecutionStatus } from './types'

describe('PubSub', () => {
  let pubsub: PubSub

  beforeEach(() => {
    // Get fresh instance (singleton, but can clear buffer)
    pubsub = PubSub.getInstance()
    pubsub.clearBuffer()
  })

  it('tests that execution status can be published', () => {
    const status: ExecutionStatus = {
      executionId: 'exec_123',
      status: 'running',
      ts: Date.now()
    }
    
    // This should not throw
    pubsub.publishExecutionStatus(status)
    
    // Verify it's in the buffer
    const buffer = pubsub.getBuffer()
    expect(buffer.length).toBe(1)
    expect(buffer[0].type).toBe('execution-status')
    expect(buffer[0].payload).toEqual(status)
  })

  it('tests that subscribers receive execution status events', () => {
    let receivedEvent: any = null
    
    // Subscribe to events
    const subscription = pubsub.subscribe((event) => {
      receivedEvent = event
    })

    // Publish execution status
    const status: ExecutionStatus = {
      executionId: 'exec_456',
      status: 'cancelled',
      ts: Date.now()
    }
    pubsub.publishExecutionStatus(status)

    // Verify subscriber received the event
    expect(receivedEvent).not.toBeNull()
    expect(receivedEvent.type).toBe('execution-status')
    expect(receivedEvent.payload.executionId).toBe('exec_456')
    expect(receivedEvent.payload.status).toBe('cancelled')

    // Clean up
    subscription.unsubscribe()
  })

  it('tests that generateId creates unique IDs', () => {
    const id1 = PubSub.generateId('exec')
    const id2 = PubSub.generateId('exec')
    
    expect(id1).toContain('exec_')
    expect(id2).toContain('exec_')
    expect(id1).not.toBe(id2)
  })
})