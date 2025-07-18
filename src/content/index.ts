import { MessageType, ClickMessage, ContentReadyMessage, IntentBubblesShowMessage, IntentBubbleClickedMessage } from '@/lib/types/messaging'
import { Logging } from '@/lib/utils/Logging'

/**
 * Content script for the ParallelManus extension
 * Runs in the context of web pages
 */

// Flag for debug mode
const DEBUG_MODE = true

// Initialize LogUtility
Logging.initialize({ debugMode: DEBUG_MODE })

/**
 * Log messages using the centralized LogUtility
 * @param message - Message to log
 * @param level - Log level
 */
function debugLog(message: string, level: 'info' | 'error' | 'warning' = 'info'): void {
  Logging.log('Content', message, level)
}

/**
 * Initialize the content script
 */
function initialize(): void {
  debugLog('Content script initialized')
  
  // Register message listener
  chrome.runtime.onMessage.addListener(handleMessage)
  
  // Notify the background script that the content script is ready
  try {
    chrome.runtime.sendMessage({
      type: MessageType.CONTENT_READY,
      payload: {
        url: window.location.href,
        title: document.title
      }
    }).catch((error: Error) => {
      debugLog(`Failed to send ready message: ${error.message}`, 'error')
    })
  } catch (error) {
    debugLog(`Failed to send ready message: ${error instanceof Error ? error.message : String(error)}`, 'error')
  }
}

/**
 * Handle messages from the extension
 * @param message - The message received
 * @param sender - Information about the sender
 * @param sendResponse - Function to send a response
 * @returns Whether the response will be sent asynchronously
 */
function handleMessage(
  message: Record<string, unknown>,
  sender: chrome.runtime.MessageSender,
  sendResponse: (response?: unknown) => void
): boolean {
  debugLog(`Message received: ${JSON.stringify(message)}`)
  
  try {
    // Type assertions for better type safety
    if (typeof message.type !== 'string') {
      throw new Error('Message type must be a string')
    }
    
    const type = message.type as MessageType
    const payload = message.payload
    
    switch (type) {
      case MessageType.CLICK:
        // Type checking for click payload
        if (payload && typeof payload === 'object' && 'selector' in payload && typeof (payload as any).selector === 'string') {
          handleClick(payload as ClickMessage['payload'], sendResponse)
        } else {
          throw new Error('Invalid click payload: missing or invalid selector')
        }
        return false
        
      case MessageType.EXTRACT:
        // For v0, we're not implementing extraction yet
        debugLog('Extraction functionality requested but not implemented in v0', 'warning')
        sendResponse({ error: 'Extraction not implemented in v0' })
        return false
        
      case MessageType.INTENT_BUBBLES_SHOW:
        // Type checking for intent bubbles payload
        if (payload && typeof payload === 'object' && 'intents' in payload && Array.isArray((payload as any).intents)) {
          showIntentBubbles(payload as IntentBubblesShowMessage['payload'])
          sendResponse({ success: true })
        } else {
          throw new Error('Invalid intent bubbles payload: missing or invalid intents array')
        }
        return false
        
      default:
        debugLog(`Unknown message type: ${type}`, 'warning')
        sendResponse({ error: `Unknown message type: ${type}` })
        return false
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    debugLog(`Error handling message: ${errorMessage}`, 'error')
    sendResponse({ error: errorMessage })
    return false
  }
}

/**
 * Handle click operations
 * @param payload - The click payload
 * @param sendResponse - Function to send a response
 */
function handleClick(
  payload: ClickMessage['payload'],
  sendResponse: (response?: unknown) => void
): void {
  try {
    const { selector } = payload
    debugLog(`Attempting to click element: ${selector}`)
    
    // Find the element to click
    const element = document.querySelector(selector)
    
    if (!element) {
      const error = `Element not found: ${selector}`
      debugLog(error, 'error')
      sendResponse({ error })
      return
    }
    
    // Scroll the element into view
    element.scrollIntoView({ behavior: 'smooth', block: 'center' })
    
    // Slight delay to complete the scroll
    setTimeout(() => {
      try {
        // Click the element
        if (element instanceof HTMLElement) {
          element.click()
          debugLog(`Clicked element: ${selector}`)
          sendResponse({ success: true })
        } else {
          const error = `Element is not clickable: ${selector}`
          debugLog(error, 'error')
          sendResponse({ error })
        }
      } catch (clickError) {
        const errorMessage = clickError instanceof Error ? clickError.message : String(clickError)
        debugLog(`Click operation failed: ${errorMessage}`, 'error')
        sendResponse({ error: errorMessage })
      }
    }, 300)
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    debugLog(`Click operation failed: ${errorMessage}`, 'error')
    sendResponse({ error: errorMessage })
  }
}

/**
 * Simple intent bubbles UI management
 */
let bubblesContainer: HTMLElement | null = null
let shadowRoot: ShadowRoot | null = null

/**
 * Show intent bubbles on the page
 */
function showIntentBubbles(payload: IntentBubblesShowMessage['payload']): void {
  try {
    debugLog(`Showing intent bubbles: ${JSON.stringify(payload.intents)}`)
    
    // Remove existing bubbles
    hideIntentBubbles()
    
    // Create shadow DOM container
    const host = document.createElement('div')
    host.id = 'nxtscape-intent-bubbles-host'
    shadowRoot = host.attachShadow({ mode: 'closed' })
    
    // Create container
    bubblesContainer = document.createElement('div')
    bubblesContainer.className = 'intent-bubbles-container'
    
    // Add styles
    const style = document.createElement('style')
    style.textContent = `
      .intent-bubbles-container {
        position: fixed;
        bottom: 20px;
        left: 50%;
        transform: translateX(-50%);
        z-index: 999999;
        display: flex;
        flex-direction: row;
        gap: 12px;
        justify-content: center;
        align-items: center;
        pointer-events: none;
      }
      
      .intent-bubble {
        background: rgba(30, 30, 30, 0.75);
        backdrop-filter: blur(12px);
        -webkit-backdrop-filter: blur(12px);
        border: 1px solid rgba(255, 255, 255, 0.1);
        color: rgba(255, 255, 255, 0.95);
        padding: 10px 20px;
        border-radius: 24px;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        font-size: 14px;
        font-weight: 500;
        cursor: pointer;
        pointer-events: auto;
        box-shadow: 0 4px 24px rgba(0, 0, 0, 0.2), 
                    0 1px 2px rgba(0, 0, 0, 0.1),
                    inset 0 0 0 1px rgba(255, 255, 255, 0.05);
        transition: all 0.3s ease;
        animation: slideUp 0.4s ease-out;
        white-space: nowrap;
        text-shadow: 0 1px 3px rgba(0, 0, 0, 0.4);
      }
      
      .intent-bubble:hover {
        transform: translateY(-3px);
        background: rgba(40, 40, 40, 0.85);
        box-shadow: 0 6px 30px rgba(0, 0, 0, 0.25),
                    0 2px 4px rgba(0, 0, 0, 0.1),
                    inset 0 0 0 1px rgba(255, 255, 255, 0.1);
        border-color: rgba(255, 255, 255, 0.15);
      }
      
      @keyframes slideUp {
        from {
          opacity: 0;
          transform: translateY(20px);
        }
        to {
          opacity: 1;
          transform: translateY(0);
        }
      }
      
      @supports not (backdrop-filter: blur(12px)) {
        .intent-bubble {
          background: rgba(30, 30, 30, 0.95);
          border: 1px solid rgba(255, 255, 255, 0.2);
        }
        
        .intent-bubble:hover {
          background: rgba(20, 20, 20, 0.98);
        }
      }
    `
    
    shadowRoot.appendChild(style)
    shadowRoot.appendChild(bubblesContainer)
    
    // Create bubbles (max 3)
    const intentsToShow = payload.intents.slice(0, 3)
    intentsToShow.forEach((intent) => {
      const bubble = document.createElement('div')
      bubble.className = 'intent-bubble'
      bubble.textContent = intent
      bubble.addEventListener('click', () => handleBubbleClick(intent))
      bubblesContainer!.appendChild(bubble)
    })
    
    // Add to page
    document.body.appendChild(host)
    
    // Auto-hide after 30 seconds
    setTimeout(() => hideIntentBubbles(), 30000)
    
  } catch (error) {
    debugLog(`Failed to show intent bubbles: ${error instanceof Error ? error.message : String(error)}`, 'error')
  }
}

/**
 * Hide intent bubbles
 */
function hideIntentBubbles(): void {
  const host = document.getElementById('nxtscape-intent-bubbles-host')
  if (host) {
    host.remove()
  }
  bubblesContainer = null
  shadowRoot = null
}

/**
 * Handle intent bubble click
 */
function handleBubbleClick(intent: string): void {
  debugLog(`Intent bubble clicked: ${intent}`)
  
  // Send message to background
  chrome.runtime.sendMessage({
    type: MessageType.INTENT_BUBBLE_CLICKED,
    payload: { intent }
  }).catch((error: Error) => {
    debugLog(`Failed to send bubble click message: ${error.message}`, 'error')
  })
  
  // Hide bubbles after click
  hideIntentBubbles()
}

// Clean up on page navigation
window.addEventListener('beforeunload', () => {
  hideIntentBubbles()
})

// Initialize the content script
initialize()
