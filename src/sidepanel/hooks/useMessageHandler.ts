import { useEffect, useCallback } from 'react'
import { MessageType } from '@/lib/types/messaging'
import { useSidePanelPortMessaging } from '@/sidepanel/hooks'
import { useChatStore, type PubSubMessage } from '../stores/chatStore'

export function useMessageHandler() {
  const { upsertMessage, setProcessing, setError } = useChatStore()
  const { addMessageListener, removeMessageListener } = useSidePanelPortMessaging()

  const handleStreamUpdate = useCallback((payload: any) => {
    // Check if this is a PubSub event
    if (payload?.action === 'PUBSUB_EVENT' && payload?.details?.type === 'message') {
      const message = payload.details.payload as PubSubMessage
      
      // Filter out thinking messages, only show narration messages
      if (message.role === 'thinking') {
        return 
      }
      
      upsertMessage(message)
    }
  }, [upsertMessage])
  
  // Handle workflow status updates
  const handleWorkflowStatus = useCallback((payload: any) => {
    if (payload.status === 'completed' || payload.status === 'failed' || payload.cancelled) {
      setProcessing(false)
      
      if (payload.error && !payload.cancelled) {
        setError(payload.error)
        // Create error message via PubSub format
        upsertMessage({
          msgId: `error_${Date.now()}`,
          content: payload.error,
          role: 'error',
          ts: Date.now()
        })
      }
    }
  }, [upsertMessage, setProcessing, setError])
  
  useEffect(() => {
    // Register listeners
    addMessageListener(MessageType.AGENT_STREAM_UPDATE, handleStreamUpdate)
    addMessageListener(MessageType.WORKFLOW_STATUS, handleWorkflowStatus)
    
    // Cleanup
    return () => {
      removeMessageListener(MessageType.AGENT_STREAM_UPDATE, handleStreamUpdate)
      removeMessageListener(MessageType.WORKFLOW_STATUS, handleWorkflowStatus)
    }
  }, [addMessageListener, removeMessageListener, handleStreamUpdate, handleWorkflowStatus])
}
