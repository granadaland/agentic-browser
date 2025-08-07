import React, { useState, useEffect } from 'react'
import { Button } from '@/sidepanel/components/ui/button'
import { Slider } from './ui/slider'
import { cn } from '@/sidepanel/lib/utils'
import { z } from 'zod'
import { XIcon, SunIcon, MoonIcon } from './ui/Icons'
import { useSettingsStore } from '@/sidepanel/v2/stores/settingsStore'
import { useSidePanelPortMessaging } from '@/sidepanel/hooks/useSidePanelPortMessaging'
import { MessageType } from '@/lib/types/messaging'

const DISCORD_URL = 'https://discord.com/invite/YKwjt5vuKr'

// Define the props schema with Zod
const SettingsModalPropsSchema = z.object({
  isOpen: z.boolean(),  // Whether the modal is open
  onClose: z.function().args().returns(z.void())  // Function to close the modal
})

// Infer the type from the schema
type SettingsModalProps = z.infer<typeof SettingsModalPropsSchema>

export function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
  const { fontSize, isDarkMode, setFontSize, setDarkMode } = useSettingsStore()
  const [glowEnabled, setGlowEnabled] = useState<boolean>(true)
  const { sendMessage } = useSidePanelPortMessaging()

  // Toggle dark mode
  const toggleDarkMode = () => {
    setDarkMode(!isDarkMode)
  }

  // Close modal when clicking outside
  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose()
    }
  }

  // Close modal on escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
      }
    }

    if (isOpen) {
      document.addEventListener('keydown', handleEscape)
      return () => document.removeEventListener('keydown', handleEscape)
    }
  }, [isOpen, onClose])

  // Load persisted glow setting
  useEffect(() => {
    const GLOW_ENABLED_KEY = 'nxtscape-glow-enabled'
    try {
      chrome.storage?.local?.get(GLOW_ENABLED_KEY, (result) => {
        if (result && Object.prototype.hasOwnProperty.call(result, GLOW_ENABLED_KEY)) {
          setGlowEnabled(result[GLOW_ENABLED_KEY] !== false)
        } else {
          setGlowEnabled(true)
        }
      })
    } catch (_e) {
      setGlowEnabled(true)
    }
  }, [])

  // Toggle glow
  const toggleGlow = () => {
    const GLOW_ENABLED_KEY = 'nxtscape-glow-enabled'
    const next = !glowEnabled
    setGlowEnabled(next)
    try {
      chrome.storage?.local?.set({ [GLOW_ENABLED_KEY]: next })
    } catch (_e) {
      // ignore
    }

    // Apply immediately on current active tab for instant feedback
    try {
      chrome.tabs?.query({ active: true, currentWindow: true }, (tabs) => {
        const tabId = tabs && tabs[0] && tabs[0].id
        if (typeof tabId === 'number') {
          if (next) {
            sendMessage(MessageType.GLOW_START, { tabId })
          } else {
            sendMessage(MessageType.GLOW_STOP, { tabId })
          }
        }
      })
    } catch (_e) {
      // ignore
    }
  }

  if (!isOpen) return null

  return (
    <div 
      className="fixed inset-0 z-[999] flex items-start justify-center bg-black/50 backdrop-blur-sm overflow-y-auto py-4"
      onClick={handleBackdropClick}
      role="dialog"
      aria-modal="true"
      aria-labelledby="settings-modal-title"
    >
      <div className="bg-background border border-border rounded-2xl shadow-2xl p-6 w-full max-w-md mx-4 mt-4 mb-4 animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h2 id="settings-modal-title" className="text-lg font-semibold text-foreground">
            Settings
          </h2>
          <Button
            onClick={onClose}
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0 hover:bg-muted"
            aria-label="Close settings"
          >
            <XIcon />
          </Button>
        </div>

        {/* Settings content */}
        <div className="space-y-6">
          {/* Theme toggle */}
          <div className="space-y-3">
            <h3 className="text-sm font-medium text-foreground">Appearance</h3>
            <div className="flex items-center justify-between p-4 rounded-xl bg-muted/50 border border-border/50">
              <div className="flex items-center gap-2">
                <div className="w-5 h-5 rounded-full bg-gradient-to-br from-brand to-brand/80 flex items-center justify-center">
                  {isDarkMode ? <MoonIcon /> : <SunIcon />}
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">Dark Mode</p>
                  <p className="text-xs text-muted-foreground">Switch between light and dark themes</p>
                </div>
              </div>
              <Button
                onClick={toggleDarkMode}
                variant="outline"
                size="sm"
                className={`h-8 px-3 rounded-lg transition-all duration-200 ${
                  isDarkMode 
                    ? 'bg-brand text-white border-brand hover:bg-brand/90' 
                    : 'bg-background border-border hover:bg-muted'
                }`}
                aria-label={`${isDarkMode ? 'Disable' : 'Enable'} dark mode`}
              >
                {isDarkMode ? 'On' : 'Off'}
              </Button>
            </div>

            {/* Page Glow */}
            <div className="flex items-center justify-between px-4 py-2 rounded-xl border border-border/50 bg-muted/30">
              <p className="text-xs text-muted-foreground">Page glow during actions</p>
              <Button
                onClick={toggleGlow}
                variant="ghost"
                size="sm"
                className={`h-7 px-2 text-xs ${glowEnabled ? 'text-foreground' : 'text-muted-foreground'}`}
                aria-label={`${glowEnabled ? 'Disable' : 'Enable'} page glow`}
              >
                {glowEnabled ? 'On' : 'Off'}
              </Button>
            </div>
          </div>

          

          {/* Font Size */}
          <div className="space-y-3">
            <h3 className="text-sm font-medium text-foreground">Typography</h3>
            <div className="p-4 rounded-xl bg-muted/50 border border-border/50 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-foreground">Font Size</p>
                  <p className="text-xs text-muted-foreground">Adjust the text size across the app</p>
                </div>
                <div className="text-sm font-mono text-muted-foreground min-w-[3rem] text-right">
                  {fontSize}px
                </div>
              </div>
              <Slider
                value={fontSize}
                min={13}
                max={21}
                step={1}
                onChange={setFontSize}
                aria-label="Font size"
                className="mt-2"
              />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Small</span>
                <span>Large</span>
              </div>
            </div>
          </div>

          {/* More settings can be added here */}
          <div className="space-y-3">
            <h3 className="text-sm font-medium text-foreground">About</h3>
            <div className="p-4 rounded-xl bg-muted/50 border border-border/50">
              <p className="text-sm text-muted-foreground">
                BrowserOS Agentic Assistant v1.0.0
              </p>
              <div className="mt-3 flex items-center justify-between gap-3">
                <p className="text-sm text-foreground">Have feedback or ideas? We'd love to hear from you.</p>
                <a
                  href={DISCORD_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Open Discord to leave feedback"
                >
                  <Button size="sm" variant="outline" className="rounded-lg">
                    Join Discord
                  </Button>
                </a>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end mt-6 pt-4 border-t border-border/50">
        </div>
      </div>
    </div>
  )
} 