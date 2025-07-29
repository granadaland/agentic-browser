import { MessageType } from '@/lib/types/messaging'
import { PortName } from '@/lib/runtime/PortMessaging'
import { isDevelopmentMode } from '@/config'
import { z } from 'zod'

/**
 * Log level type
 */
export const LogLevelSchema = z.enum(['info', 'error', 'warning'])
export type LogLevel = z.infer<typeof LogLevelSchema>

/**
 * Log message schema
 */
export const LogMessageSchema = z.object({
  source: z.string(),
  message: z.string(),
  level: LogLevelSchema,
  timestamp: z.string()
})

export type LogMessage = z.infer<typeof LogMessageSchema>

/**
 * Options for initializing the logging utility
 */
interface LogUtilityOptions {
  readonly debugMode?: boolean
}

/**
 * Centralized logging utility that supports both port and one-time messaging
 * Routes logs to options page when in development mode
 */
export class Logging {
  private static connectedPorts = new Map<string, chrome.runtime.Port>()
  private static debugMode = false
  
  /**
   * Initialize the logging utility
   * @param options - Configuration options
   */
  public static initialize(options: LogUtilityOptions = {}): void {
    this.debugMode = options.debugMode || false
  }
  
  /**
   * Register a connected port
   * @param name - Port name
   * @param port - Connected port
   */
  public static registerPort(name: string, port: chrome.runtime.Port): void {
    this.connectedPorts.set(name, port)
  }
  
  /**
   * Unregister a port
   * @param name - Port name
   */
  public static unregisterPort(name: string): void {
    this.connectedPorts.delete(name)
  }
  
  /**
   * Log a message
   * @param source - Source component name
   * @param message - Message content
   * @param level - Log level
   */
  public static log(source: string, message: string, level: LogLevel = 'info'): void {
    if (!this.debugMode && level === 'info') return
    
    const prefix = `[${source}]`
    
    // Console logging
    switch (level) {
      case 'error':
        console.error(`${prefix} ${message}`)
        break
      case 'warning':
        console.warn(`${prefix} ${message}`)
        break
      default:
        console.log(`${prefix} ${message}`)
    }
    
    // Prepare log message
    const logMessage: LogMessage = {
      source,
      message,
      level,
      timestamp: new Date().toISOString()
    }
    
    // Try to send via port messaging first
    let sentViaPort = false
    
    // In development mode, send to options page
    if (isDevelopmentMode()) {
      // Look for options page port
      const optionsPort = this.connectedPorts.get(PortName.OPTIONS_TO_BACKGROUND)
      
      if (optionsPort) {
        try {
          // Check if port is still connected by accessing a property
          // Chrome will throw if the port is disconnected
          const isConnected = optionsPort.name !== undefined
          
          if (isConnected) {
            optionsPort.postMessage({
              type: MessageType.LOG,
              payload: logMessage
            })
            sentViaPort = true
          } else {
            // Port is stale, remove it
            this.unregisterPort(PortName.OPTIONS_TO_BACKGROUND)
          }
        } catch (error) {
          // Port is disconnected or stale, remove it and log the issue
          this.unregisterPort(PortName.OPTIONS_TO_BACKGROUND)
          
          // Only log port errors for non-heartbeat messages to avoid spam
          if (level !== 'info' || !message.includes('heartbeat')) {
            console.warn(`Failed to send log to options page: ${error instanceof Error ? error.message : String(error)}`)
          }
        }
      }
    }
    
    // Fall back to one-time messaging if port messaging failed
    if (!sentViaPort && typeof chrome !== 'undefined' && chrome.runtime) {
      chrome.runtime.sendMessage({
        type: MessageType.LOG,
        payload: logMessage
      }).catch((_error: Error) => {
        // It's OK if this fails too, just means no UI is open
        // We've already logged to the console above
      })
    }
  }
}
