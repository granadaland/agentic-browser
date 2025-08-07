import { useEffect, useRef, useCallback } from 'react'
import { MessageType } from '@/lib/types/messaging'
import { useSidePanelPortMessaging } from '@/sidepanel/hooks'
import { useChatStore } from '../stores/chatStore'

export function useMessageHandler() {
  const { addMessage, updateMessage, setProcessing, setError, markMessageAsExecuting, markMessageAsCompleting, setExecutingMessageRemoving } = useChatStore()
  const { addMessageListener, removeMessageListener } = useSidePanelPortMessaging()
  
  // Track streaming messages by ID for updates
  const streamingMessages = useRef<Map<string, { messageId: string, content: string }>>(new Map())
  
  // Create stable callback functions
  const handleStreamUpdate = useCallback((payload: any) => {
    const { details } = payload
    
    if (!details?.messageType) return
    
    // Mark any existing executing messages as completing when new messages are added
    const markExecutingAsCompleting = () => {
      const state = useChatStore.getState()
      const executingMessages = state.messages.filter(msg => msg.metadata?.isExecuting && !msg.metadata?.isCompleting)
      if (executingMessages.length > 0) {
        setExecutingMessageRemoving(true)
        executingMessages.forEach(msg => {
          markMessageAsCompleting(msg.id)
        })
        // Reset the flag after animation
        setTimeout(() => setExecutingMessageRemoving(false), 600)
      }
    }
    
    switch (details.messageType) {
      case 'SystemMessage': {
        if (details.content) {
          const isExecuting = details.content.includes('executing') || details.content.includes('Executing')
          const isTodoTable = details.content.includes('| # | Status | Task |')
          const category = details.data?.category as string | undefined
          
          // Mark existing executing messages as completing
          if (!isExecuting) {
            markExecutingAsCompleting()
          }
          
          // Handle todo table messages - replace the most recent one instead of adding new
          if (isTodoTable) {
            const currentMessages = useChatStore.getState().messages
            const lastTodoMessage = currentMessages.slice().reverse().find(msg => 
              msg.role === 'system' && msg.content.includes('| # | Status | Task |')
            )
            
            if (lastTodoMessage) {
              // Update the existing todo message
              updateMessage(lastTodoMessage.id, details.content)
            } else {
              // No existing todo message, add new one
              addMessage({
                role: 'system',
                content: details.content
              })
            }
          } else {
            // Regular system message
            addMessage({
              role: 'system',
              content: details.content,
              metadata: isExecuting ? { isExecuting: true } : (category ? { isStartup: category === 'startup' } : undefined)
            })
            
            // If this is an executing message, mark it as executing
            if (isExecuting) {
              const lastMessage = useChatStore.getState().messages.slice(-1)[0]
              if (lastMessage) {
                markMessageAsExecuting(lastMessage.id)
              }
            }
          }
        }
        break
      }

      case 'ToolStart': {
        // Mark existing executing messages as completing
        markExecutingAsCompleting()
        
        // Add executing message for tool start
        if (details.toolName && details.toolArgs?.description) {
          const executingMessage = `executing - ${details.toolArgs.description}`
          
          // Check if there's already a system message with similar content that we should replace
          const currentMessages = useChatStore.getState().messages
          const lastSystemMessage = currentMessages.slice().reverse().find(msg => 
            msg.role === 'system' && 
            !msg.metadata?.isExecuting &&
            (msg.content === details.toolArgs.description || 
             msg.content.includes(details.toolArgs.description) ||
             details.toolArgs.description.includes(msg.content))
          )
          
          if (lastSystemMessage) {
            // Update the existing message to be executing
            updateMessage(lastSystemMessage.id, executingMessage)
            markMessageAsExecuting(lastSystemMessage.id)
          } else {
            // Add new executing message
            addMessage({
              role: 'system',
              content: executingMessage,
              metadata: { 
                isExecuting: true,
                toolName: details.toolName 
              }
            })
            
            // Mark this message as executing
            const lastMessage = useChatStore.getState().messages.slice(-1)[0]
            if (lastMessage) {
              markMessageAsExecuting(lastMessage.id)
            }
          }
        }
        break
      }

      case 'ToolEnd': {
        // Mark existing executing messages as completing - they will be removed
        markExecutingAsCompleting()
        break
      }

      case 'ThinkingMessage': {
        // Mark existing executing messages as completing
        markExecutingAsCompleting()
        
        // Add thinking message
        if (details.content) {
          addMessage({
            role: 'system',
            content: `executing - ${details.content}`,
            metadata: { 
              isExecuting: true
            }
          })
          
          // Mark this message as executing
          const lastMessage = useChatStore.getState().messages.slice(-1)[0]
          if (lastMessage) {
            markMessageAsExecuting(lastMessage.id)
          }
        }
        break
      }
      
      case 'NewSegment': {
        // Mark existing executing messages as completing
        markExecutingAsCompleting()
        
        // Start a new streaming message
        const messageId = details.messageId || `stream-${Date.now()}`
        const message = {
          role: 'assistant' as const,
          content: ''  // Start with empty content
        }
        
        addMessage(message)
        
        // Track this streaming message
        const lastMessage = useChatStore.getState().messages.slice(-1)[0]
        if (lastMessage) {
          streamingMessages.current.set(messageId, {
            messageId: lastMessage.id,
            content: ''
          })
        }
        break
      }
      
      case 'StreamingChunk': {
        // Update streaming message
        if (details.messageId && details.content) {
          const streaming = streamingMessages.current.get(details.messageId)
          if (streaming) {
            streaming.content += details.content
            updateMessage(streaming.messageId, streaming.content)
          }
        }
        break
      }
      
      case 'FinalizeSegment': {
        // Complete the streaming message
        if (details.messageId) {
          const streaming = streamingMessages.current.get(details.messageId)
          if (streaming) {
            const finalContent = details.content || streaming.content
            if (finalContent) {
              updateMessage(streaming.messageId, finalContent)
            }
            streamingMessages.current.delete(details.messageId)
          }
        }
        break
      }
      
      case 'ToolResult': {
        // Mark existing executing messages as completing
        markExecutingAsCompleting()
        
        // Filter out TODO-related messages that shouldn't be shown to the user
        if (details.content && (
          details.content.includes('Completed TODO:') ||
          details.content.includes('Skipped TODO:') ||
          details.content.includes('Went back to TODO:') ||
          details.content.includes('Added') && details.content.includes('TODOs') ||
          details.content.includes('Replaced all TODOs')
        )) {
          // Don't add these messages - they're internal status updates
          break
        }
        
        // Add tool result as assistant message
        if (details.content) {
          addMessage({
            role: 'assistant',
            content: details.content,
            metadata: {
              toolName: details.toolName
            }
          })
        }
        break
      }
      
      case 'ErrorMessage': {
        // Mark existing executing messages as completing
        markExecutingAsCompleting()
        
        // Handle error
        const errorMessage = details.error || details.content || 'An error occurred'
        addMessage({
          role: 'system',
          content: errorMessage,
          metadata: { error: true }
        })
        setError(errorMessage)
        setProcessing(false)
        break
      }
      
      case 'TaskResult': {
        // Mark existing executing messages as completing
        markExecutingAsCompleting()
        
        // Task completed
        setProcessing(false)
        if (details.content) {
          addMessage({
            role: 'system',
            content: details.content
          })
        }
        break
      }
      
      case 'CancelMessage': {
        // Mark existing executing messages as completing
        markExecutingAsCompleting()
        
        // Task cancelled
        setProcessing(false)
        if (details.content) {
          addMessage({
            role: 'system',
            content: details.content
          })
        }
        break
      }
      
      // Skip other message types for now (ThinkingMessage, DebugMessage, etc.)
      // We can add them later if needed
    }
  }, [addMessage, updateMessage, setProcessing, setError, markMessageAsExecuting, markMessageAsCompleting, setExecutingMessageRemoving])
  
        // Handle workflow status updates
  const handleWorkflowStatus = useCallback((payload: any) => {
    if (payload.status === 'completed' || payload.status === 'failed' || payload.cancelled) {
      setProcessing(false)
      
      // Mark any executing messages as completing
      const state = useChatStore.getState()
      const executingMessages = state.messages.filter(msg => msg.metadata?.isExecuting && !msg.metadata?.isCompleting)
      if (executingMessages.length > 0) {
        setExecutingMessageRemoving(true)
        executingMessages.forEach(msg => {
          markMessageAsCompleting(msg.id)
        })
        // Reset the flag after animation
        setTimeout(() => setExecutingMessageRemoving(false), 600)
      }
      
      if (payload.error && !payload.cancelled) {
        setError(payload.error)
        addMessage({
          role: 'system',
          content: payload.error,
          metadata: { error: true }
        })
      }
    }
  }, [addMessage, setProcessing, setError, markMessageAsCompleting, setExecutingMessageRemoving])
  
  useEffect(() => {
    // Register listeners
    addMessageListener(MessageType.AGENT_STREAM_UPDATE, handleStreamUpdate)
    addMessageListener(MessageType.WORKFLOW_STATUS, handleWorkflowStatus)
    
    // Cleanup
    return () => {
      removeMessageListener(MessageType.AGENT_STREAM_UPDATE, handleStreamUpdate)
      removeMessageListener(MessageType.WORKFLOW_STATUS, handleWorkflowStatus)
      streamingMessages.current.clear()
    }
  }, [addMessageListener, removeMessageListener, handleStreamUpdate, handleWorkflowStatus])
}