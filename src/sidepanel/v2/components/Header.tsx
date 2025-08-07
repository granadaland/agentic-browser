import React, { memo, useState, useEffect } from 'react'
import { Button } from '@/sidepanel/components/ui/button'
import { useSidePanelPortMessaging } from '@/sidepanel/hooks'
import { MessageType } from '@/lib/types/messaging'
import { useChatStore } from '../stores/chatStore'
import { useAnalytics } from '../hooks/useAnalytics'
import { SettingsModal } from './SettingsModal'
import { HelpSection } from './HelpSection'
import { HelpIcon, SettingsIcon, PauseIcon, ResetIcon } from './ui/Icons'

interface HeaderProps {
  onReset: () => void
  showReset: boolean
  isProcessing: boolean
}

/**
 * Header component for the sidepanel
 * Displays title, connection status, and action buttons (pause/reset)
 * Memoized to prevent unnecessary re-renders
 */
export const Header = memo(function Header({ onReset, showReset, isProcessing }: HeaderProps) {
  const { sendMessage, connected } = useSidePanelPortMessaging()
  const { setProcessing } = useChatStore()
  const { trackClick } = useAnalytics()
  const [showSettings, setShowSettings] = useState(false)
  const [showHelp, setShowHelp] = useState(false)
  const [isDarkMode, setIsDarkMode] = useState(false)

  // Check current theme on mount and listen for changes
  useEffect(() => {
    const checkTheme = () => {
      const isDark = document.documentElement.classList.contains('dark')
      setIsDarkMode(isDark)
    }

    // Check initial theme
    checkTheme()

    // Listen for theme changes
    const observer = new MutationObserver(checkTheme)
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class']
    })

    return () => observer.disconnect()
  }, [])
  
  const handleCancel = () => {
    trackClick('pause_task')
    sendMessage(MessageType.CANCEL_TASK, {
      reason: 'User clicked pause button',
      source: 'sidepanel'
    })
    setProcessing(false)
  }
  
  const handleReset = () => {
    trackClick('reset_conversation')
    // Send reset message to background
    sendMessage(MessageType.RESET_CONVERSATION, {
      source: 'sidepanel'
    })
    
    // Clear local state
    onReset()
  }

  const handleSettingsClick = () => {
    trackClick('open_settings')
    setShowSettings(true)
  }

  const handleHelpClick = () => {
    trackClick('open_help')
    setShowHelp(true)
  }

  return (
    <>
      <header 
        className="flex items-center justify-between px-4 py-1 bg-gradient-to-r from-background via-background to-background/95 border-b border-border/50"
        role="banner"
      >

        <a href="https://www.browseros.com/" target="_blank" rel="noopener noreferrer" className="block">
          <div className="flex items-center px-1 py-.8 rounded-lg bg-[hsl(var(--card))] cursor-pointer hover:opacity-90 transition">
            {/* Brand */}
            <div className="flex items-center gap-3">
              <div>
                <img
                  src={isDarkMode ? "/assets/product_logo_name_22_white.png" : "/assets/product_logo_name_22_2x.png"}
                  alt="BrowserOS"
                  style={{ height: '24px', width: 'auto' }}
                />
              </div>
            </div>
            {/* Connection status indicator */}
            <div
              className="flex items-center"
              role="status"
              aria-label={`Connection status: ${connected ? 'Connected' : 'Disconnected'}`}
            >
              <div
                className={`w-2 h-2 rounded-full ${connected ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`}
                aria-hidden="true"
              />
            </div>
          </div>
        </a>
        
        <nav className="flex items-center gap-2" role="navigation" aria-label="Chat controls">
          {/* Help button */}
          <Button
            onClick={handleHelpClick}
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0 hover:bg-brand/5 hover:text-brand transition-all duration-300"
            aria-label="Open help"
          >
            <HelpIcon />
          </Button>

          {/* Settings button */}
          <Button
            onClick={handleSettingsClick}
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0 hover:bg-brand/5 hover:text-brand transition-all duration-300"
            aria-label="Open settings"
          >
            <SettingsIcon />
          </Button>

          {isProcessing && (
            <Button
              onClick={handleCancel}
              variant="outline"
              size="sm"
              className="text-xs border-brand/30 hover:border-brand hover:bg-brand/5 transition-all duration-300"
              aria-label="Pause current task"
            >
              <PauseIcon />
              Pause
            </Button>
          )}
          
          {showReset && !isProcessing && (
            <Button
              onClick={handleReset}
              variant="ghost"
              size="sm"
              className="text-xs hover:bg-brand/5 hover:text-brand transition-all duration-300"
              aria-label="Reset conversation"
            >
              <ResetIcon />
              Reset
            </Button>
          )}
        </nav>

        {/* Settings Modal */}
        <SettingsModal 
          isOpen={showSettings}
          onClose={() => setShowSettings(false)}
        />
      </header>

      {/* Help Section */}
      <HelpSection 
        isOpen={showHelp}
        onClose={() => setShowHelp(false)}
      />
    </>
  )
})