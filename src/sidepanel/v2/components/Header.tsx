import React, { memo, useState } from 'react'
import { Button } from '@/sidepanel/components/ui/button'
import { useSidePanelPortMessaging } from '@/sidepanel/hooks'
import { MessageType } from '@/lib/types/messaging'
import { useAnalytics } from '../hooks/useAnalytics'
import { SettingsModal } from './SettingsModal'
import { HelpSection } from './HelpSection'
import { HelpIcon, SettingsIcon, PauseIcon, ResetIcon, GitHubIcon } from './ui/Icons'

const GITHUB_REPO_URL: string = 'https://github.com/browseros-ai/BrowserOS-agent'

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
  const { trackClick } = useAnalytics()
  const [showSettings, setShowSettings] = useState(false)
  const [showHelp, setShowHelp] = useState(false)
  
  
  const handleCancel = () => {
    trackClick('pause_task')
    sendMessage(MessageType.CANCEL_TASK, {
      reason: 'User clicked pause button',
      source: 'sidepanel'
    })
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

        <div className="flex items-center gap-3">
          <Button
            onClick={() => {
              trackClick('star_github')
              window.open(GITHUB_REPO_URL, '_blank', 'noopener,noreferrer')
            }}
            variant="outline"
            size="sm"
            className="gap-2 hover:bg-brand/5 hover:text-brand transition-all duration-300"
            aria-label="Star on GitHub"
            title="Star on GitHub"
          >
            <GitHubIcon />
            GitHub
          </Button>
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