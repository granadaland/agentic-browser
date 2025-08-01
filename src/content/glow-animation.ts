/**
 * Glow animation content script
 * Provides visual feedback during agent execution
 */

(() => {
  const GLOW_OVERLAY_ID = 'nxtscape-glow-overlay'
  const GLOW_STYLES_ID = 'nxtscape-glow-styles'
  const GLOW_INITIALIZED_KEY = 'nxtscape-glow-initialized'
  
  // Check if already initialized to prevent duplicate listeners
  if ((window as any)[GLOW_INITIALIZED_KEY]) {
    console.log('[Nxtscape] Glow animation already initialized')
    return
  }
  (window as any)[GLOW_INITIALIZED_KEY] = true
  
  /**
   * Create and inject glow animation styles
   */
  function injectStyles(): void {
    if (document.getElementById(GLOW_STYLES_ID)) {
      return
    }
    
    const style = document.createElement('style')
    style.id = GLOW_STYLES_ID
    style.textContent = `
      @keyframes nxtscape-glow-pulse {
        0% {
          box-shadow: 
            inset 0 0 120px 60px transparent,
            inset 0 0 100px 50px rgba(251, 102, 24, 0.1),
            inset 0 0 80px 40px rgba(251, 102, 24, 0.2),
            inset 0 0 60px 30px rgba(251, 102, 24, 0.3);
        }
        50% {
          box-shadow: 
            inset 0 0 150px 80px transparent,
            inset 0 0 130px 70px rgba(251, 102, 24, 0.15),
            inset 0 0 110px 60px rgba(251, 102, 24, 0.3),
            inset 0 0 90px 50px rgba(251, 102, 24, 0.4);
        }
        100% {
          box-shadow: 
            inset 0 0 120px 60px transparent,
            inset 0 0 100px 50px rgba(251, 102, 24, 0.1),
            inset 0 0 80px 40px rgba(251, 102, 24, 0.2),
            inset 0 0 60px 30px rgba(251, 102, 24, 0.3);
        }
      }
      
      #${GLOW_OVERLAY_ID} {
        position: fixed !important;
        top: 0 !important;
        left: 0 !important;
        width: 100% !important;
        height: 100% !important;
        pointer-events: none !important;
        z-index: 2147483647 !important;
        animation: nxtscape-glow-pulse 3s ease-in-out infinite !important;
      }
    `
    document.head.appendChild(style)
  }
  
  /**
   * Start glow animation
   */
  function startGlow(): void {
    // Remove existing overlay if present
    stopGlow()
    
    // Inject styles
    injectStyles()
    
    // Create overlay
    const overlay = document.createElement('div')
    overlay.id = GLOW_OVERLAY_ID
    document.body.appendChild(overlay)
    
    console.log('[Nxtscape] Glow animation started')
  }
  
  /**
   * Stop glow animation
   */
  function stopGlow(): void {
    const overlay = document.getElementById(GLOW_OVERLAY_ID)
    if (overlay) {
      overlay.remove()
      console.log('[Nxtscape] Glow animation stopped')
    }
  }
  
  /**
   * Message listener
   */
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.source !== 'GlowAnimationService') {
      return
    }
    
    switch (request.action) {
      case 'startGlow':
        startGlow()
        sendResponse({ success: true })
        break
        
      case 'stopGlow':
        stopGlow()
        sendResponse({ success: true })
        break
        
      default:
        sendResponse({ success: false, error: 'Unknown action' })
    }
    
    return true  // Keep message channel open for async response
  })
  
  // Clean up on page unload
  window.addEventListener('beforeunload', stopGlow)
  
  // Also clean up on visibility change (tab switch)
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      stopGlow()
    }
  })
  
  // Start glow immediately if we're being re-injected after navigation
  // The service will send a start message right after injection
})()