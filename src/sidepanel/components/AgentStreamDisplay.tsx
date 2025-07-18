import React from 'react'
import { AgentStreamUpdateMessage } from '@/lib/types/messaging'
import styles from '../styles/components/AgentStreamDisplay.module.scss'
import { cn } from '@/sidepanel/lib/utils'

interface AgentStreamDisplayProps {
  updates: AgentStreamUpdateMessage['payload'][]
  className?: string
}

/**
 * Component to display agent streaming updates in a clean, visual format.
 * Shows the agent's thinking process and tool executions step by step.
 */
export function AgentStreamDisplay({ updates, className }: AgentStreamDisplayProps): JSX.Element {
  if (updates.length === 0) {
    return (
      <div className={cn(styles.emptyState, className)}>
        <p>Agent activity will appear here...</p>
      </div>
    )
  }

  return (
    <div className={cn(styles.container, className)}>
      {updates.map((update, index) => (
        <div 
          key={`${update.step}-${index}`} 
          className={cn(styles.update, styles[`update--${update.status}`])}
        >
          <div className={styles.updateHeader}>
            <span className={styles.stepNumber}>Step {update.step}</span>
            <span className={styles.statusIcon}>
              {getStatusIcon(update.status)}
            </span>
          </div>
          
          <div className={styles.updateContent}>
            <div className={styles.action}>{update.action}</div>
            
            {/* Show errors if any */}
            {update.details.error && (
              <div className={styles.error}>
                <span className={styles.text}>{update.details.error}</span>
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}

/**
 * Get emoji icon for status
 */
function getStatusIcon(status: AgentStreamUpdateMessage['payload']['status']): string {
  switch (status) {
    case 'thinking':
      return '🤔'
    case 'executing':
      return '⚡'
    case 'completed':
      return '✅'
    case 'error':
      return '❌'
    default:
      return '⏳'
  }
}

/**
 * Format tool arguments for display
 */
function formatToolArgs(args: any): string {
  if (typeof args === 'string') {
    return args
  }
  
  // For objects, show key-value pairs in a readable format
  if (typeof args === 'object' && args !== null) {
    const entries = Object.entries(args)
      .filter(([_, value]) => value !== undefined && value !== null)
      .map(([key, value]) => {
        if (typeof value === 'string' && value.length > 50) {
          return `${key}: "${value.substring(0, 50)}..."`
        }
        return `${key}: ${JSON.stringify(value)}`
      })
    
    return entries.join(', ')
  }
  
  return JSON.stringify(args)
} 