import { useState, useEffect, useCallback } from 'react'
import { z } from 'zod'

// Zod schema for side panel state
const SidePanelStateSchema = z.object({
  isOpen: z.boolean(),  // Whether the side panel is open
  isCollapsed: z.boolean(),  // Whether the panel is collapsed (minimized)
  currentTab: z.enum(['tasks', 'history', 'settings']),  // Active tab
  width: z.number().min(300).max(800),  // Panel width in pixels
  hasUnreadNotifications: z.boolean(),  // Whether there are unread notifications
  lastActivity: z.date().optional()  // Last activity timestamp
})

export type SidePanelState = z.infer<typeof SidePanelStateSchema>

const DEFAULT_STATE: SidePanelState = {
  isOpen: false,
  isCollapsed: false,
  currentTab: 'tasks',
  width: 400,
  hasUnreadNotifications: false
}

/**
 * Custom hook for managing side panel state and interactions.
 * Provides state management, persistence, and utility functions.
 */
export function useSidePanelState() {
  const [state, setState] = useState<SidePanelState>(DEFAULT_STATE)

  // Load state from localStorage on mount
  useEffect(() => {
    try {
      const savedState = localStorage.getItem('nxtscape-sidepanel-state')
      if (savedState) {
        const parsed = JSON.parse(savedState)
        // Validate with Zod schema
        const validatedState = SidePanelStateSchema.parse({
          ...parsed,
          lastActivity: parsed.lastActivity ? new Date(parsed.lastActivity) : undefined
        })
        setState(validatedState)
      }
    } catch (error) {
      console.warn('Failed to load side panel state from localStorage:', error)
      // Keep default state if parsing fails
    }
  }, [])

  // Save state to localStorage whenever it changes
  useEffect(() => {
    try {
      localStorage.setItem('nxtscape-sidepanel-state', JSON.stringify(state))
    } catch (error) {
      console.warn('Failed to save side panel state to localStorage:', error)
    }
  }, [state])

  // Utility functions
  const openPanel = useCallback(() => {
    setState(prev => ({ 
      ...prev, 
      isOpen: true, 
      lastActivity: new Date(),
      hasUnreadNotifications: false 
    }))
  }, [])

  const closePanel = useCallback(() => {
    setState(prev => ({ ...prev, isOpen: false }))
  }, [])

  const togglePanel = useCallback(() => {
    setState(prev => ({ 
      ...prev, 
      isOpen: !prev.isOpen,
      lastActivity: new Date(),
      hasUnreadNotifications: prev.isOpen ? prev.hasUnreadNotifications : false
    }))
  }, [])

  const setCurrentTab = useCallback((tab: SidePanelState['currentTab']) => {
    setState(prev => ({ 
      ...prev, 
      currentTab: tab, 
      lastActivity: new Date(),
      hasUnreadNotifications: false 
    }))
  }, [])

  const markAsRead = useCallback(() => {
    setState(prev => ({ ...prev, hasUnreadNotifications: false }))
  }, [])

  const addNotification = useCallback(() => {
    setState(prev => ({ 
      ...prev, 
      hasUnreadNotifications: !prev.isOpen,
      lastActivity: new Date()
    }))
  }, [])

  return {
    state,
    isVisible: state.isOpen && !state.isCollapsed,
    openPanel,
    closePanel,
    togglePanel,
    setCurrentTab,
    markAsRead,
    addNotification
  }
} 