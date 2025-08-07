import { describe, it, expect } from 'vitest'
import { ExecutionState, ExecutionStateManager } from './ExecutionStateManager'

describe('ExecutionStateManager', () => {
  it('tests that the state manager can be created with initial IDLE state', () => {
    const manager = new ExecutionStateManager()
    expect(manager.getState()).toBe(ExecutionState.IDLE)
  })

  it('tests that valid state transitions are allowed', () => {
    const manager = new ExecutionStateManager()
    
    // IDLE -> STARTING is valid
    manager.setState(ExecutionState.STARTING)
    expect(manager.getState()).toBe(ExecutionState.STARTING)
    
    // STARTING -> RUNNING is valid
    manager.setState(ExecutionState.RUNNING)
    expect(manager.getState()).toBe(ExecutionState.RUNNING)
    
    // RUNNING -> COMPLETED is valid
    manager.setState(ExecutionState.COMPLETED)
    expect(manager.getState()).toBe(ExecutionState.COMPLETED)
  })

  it('tests that invalid state transitions are rejected', () => {
    const manager = new ExecutionStateManager()
    
    // IDLE -> RUNNING is invalid (must go through STARTING)
    manager.setState(ExecutionState.RUNNING)
    expect(manager.getState()).toBe(ExecutionState.IDLE) // Should remain IDLE
    
    // IDLE -> STARTING, then STARTING -> COMPLETED is invalid
    manager.setState(ExecutionState.STARTING)
    manager.setState(ExecutionState.COMPLETED)
    expect(manager.getState()).toBe(ExecutionState.STARTING) // Should remain STARTING
  })

  it('tests that abort flow works correctly', () => {
    const manager = new ExecutionStateManager()
    
    // Start a task
    manager.setState(ExecutionState.STARTING)
    manager.setState(ExecutionState.RUNNING)
    
    // Abort the task
    manager.setState(ExecutionState.ABORTING)
    expect(manager.getState()).toBe(ExecutionState.ABORTING)
    
    // Complete the abort
    manager.setState(ExecutionState.ABORTED)
    expect(manager.getState()).toBe(ExecutionState.ABORTED)
  })
})