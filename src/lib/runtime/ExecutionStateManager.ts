/**
 * Execution state enum representing all possible states of task execution
 */
export enum ExecutionState {
  IDLE = 'idle',           // No task running
  STARTING = 'starting',   // Task submitted, initializing
  RUNNING = 'running',     // Agent actively executing
  ABORTING = 'aborting',   // Abort requested, waiting for completion
  COMPLETED = 'completed', // Task finished successfully
  ABORTED = 'aborted',     // Task cancelled successfully
  ERROR = 'error'          // Task failed with error
}

/**
 * Manages execution state transitions and broadcasts state changes
 */
export class ExecutionStateManager {
  private state: ExecutionState = ExecutionState.IDLE
  private listeners: Set<(state: ExecutionState) => void> = new Set()

  /**
   * Get current execution state
   */
  getState(): ExecutionState {
    return this.state
  }

  /**
   * Set new execution state with validation
   */
  setState(newState: ExecutionState): void {
    // Validate state transition
    if (!this.isValidTransition(this.state, newState)) {
      console.warn(`[ExecutionStateManager] Invalid state transition: ${this.state} -> ${newState}`)
      return
    }

    const oldState = this.state
    this.state = newState
    
    console.log(`[ExecutionStateManager] State transition: ${oldState} -> ${newState}`)
    
    // Notify all listeners
    this.notifyListeners(newState)
    
    // Broadcast to UI components
    this.broadcastToUI(newState)
  }

  /**
   * Check if a state transition is valid
   */
  private isValidTransition(from: ExecutionState, to: ExecutionState): boolean {
    // Define valid state transitions
    const validTransitions: Record<ExecutionState, ExecutionState[]> = {
      [ExecutionState.IDLE]: [ExecutionState.STARTING],
      [ExecutionState.STARTING]: [ExecutionState.RUNNING, ExecutionState.ERROR, ExecutionState.ABORTING],
      [ExecutionState.RUNNING]: [ExecutionState.COMPLETED, ExecutionState.ERROR, ExecutionState.ABORTING],
      [ExecutionState.ABORTING]: [ExecutionState.ABORTED],
      [ExecutionState.COMPLETED]: [ExecutionState.IDLE, ExecutionState.STARTING],
      [ExecutionState.ABORTED]: [ExecutionState.IDLE, ExecutionState.STARTING],
      [ExecutionState.ERROR]: [ExecutionState.IDLE, ExecutionState.STARTING]
    }

    return validTransitions[from]?.includes(to) ?? false
  }

  /**
   * Broadcast state change to UI via Chrome runtime messaging
   */
  private broadcastToUI(state: ExecutionState): void {
    try {
      // Only broadcast if we're in a Chrome extension environment
      if (typeof chrome !== 'undefined' && chrome.runtime) {
        chrome.runtime.sendMessage({
          type: 'EXECUTION_STATE_CHANGED',
          state: state,
          timestamp: Date.now()
        }).catch(() => {
          // Ignore errors when no listeners are present
        })
      }
    } catch (error) {
      // Silently handle cases where chrome API is not available
    }
  }

  /**
   * Notify local listeners of state change
   */
  private notifyListeners(state: ExecutionState): void {
    this.listeners.forEach(listener => {
      try {
        listener(state)
      } catch (error) {
        console.error('[ExecutionStateManager] Error in state listener:', error)
      }
    })
  }

  /**
   * Subscribe to state changes
   * @returns Unsubscribe function
   */
  onStateChange(listener: (state: ExecutionState) => void): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  /**
   * Reset state to IDLE
   */
  reset(): void {
    this.setState(ExecutionState.IDLE)
  }

  /**
   * Check if currently in a cancellable state
   */
  isCancellable(): boolean {
    return this.state === ExecutionState.STARTING || 
           this.state === ExecutionState.RUNNING
  }

  /**
   * Check if currently executing (not idle, completed, aborted, or error)
   */
  isExecuting(): boolean {
    return this.state === ExecutionState.STARTING || 
           this.state === ExecutionState.RUNNING ||
           this.state === ExecutionState.ABORTING
  }
}