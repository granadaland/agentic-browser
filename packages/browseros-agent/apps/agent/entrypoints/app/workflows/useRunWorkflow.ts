import { useChat } from '@ai-sdk/react'
import { DefaultChatTransport } from 'ai'
import { compact } from 'es-toolkit/array'
import { useEffect, useRef, useState } from 'react'
import { useChatRefs } from '@/entrypoints/sidepanel/index/useChatRefs'
import { useAgentServerUrl } from '@/lib/browseros/useBrowserOSProviders'
import {
  WORKFLOW_RUN_COMPLETED_EVENT,
  WORKFLOW_RUN_RETRIED_EVENT,
  WORKFLOW_RUN_STOPPED_EVENT,
} from '@/lib/constants/analyticsEvents'
import { track } from '@/lib/metrics/track'
import { workflowStorage, type Workflow } from '@/lib/workflows/workflowStorage'

type WorkflowMessageMetadata = {
  window?: chrome.windows.Window
}

export const useRunWorkflow = () => {
  const [isRunning, setIsRunning] = useState(false)
  const [runningWorkflowName, setRunningWorkflowName] = useState<string>('')
  const [wasCancelled, setWasCancelled] = useState(false)
  const codeIdRef = useRef<string | undefined>(undefined)
  const activeWorkflowRef = useRef<Workflow | null>(null)
  const workflowRunIdRef = useRef<string | null>(null)

  const { baseUrl: agentServerUrl } = useAgentServerUrl()

  const {
    selectedLlmProviderRef,
    enabledMcpServersRef,
    enabledCustomServersRef,
    personalizationRef,
  } = useChatRefs()

  const agentUrlRef = useRef(agentServerUrl)

  useEffect(() => {
    agentUrlRef.current = agentServerUrl
  }, [agentServerUrl])

  const { sendMessage, stop, status, messages, setMessages, error } = useChat({
    transport: new DefaultChatTransport({
      prepareSendMessagesRequest: async ({ messages }) => {
        const lastMessage = messages[messages.length - 1]
        const metadata = lastMessage.metadata as
          | WorkflowMessageMetadata
          | undefined
        const provider = selectedLlmProviderRef.current
        const enabledMcpServers = enabledMcpServersRef.current
        const customMcpServers = enabledCustomServersRef.current

        return {
          api: `${agentUrlRef.current}/graph/${codeIdRef.current}/run`,
          body: {
            provider: provider?.type,
            providerType: provider?.type,
            providerName: provider?.name,
            model: provider?.modelId ?? 'browseros',
            contextWindowSize: provider?.contextWindow,
            temperature: provider?.temperature,
            resourceName: provider?.resourceName,
            accessKeyId: provider?.accessKeyId,
            secretAccessKey: provider?.secretAccessKey,
            region: provider?.region,
            sessionToken: provider?.sessionToken,
            apiKey: provider?.apiKey,
            baseUrl: provider?.baseUrl,
            browserContext: {
              windowId: metadata?.window?.id,
              activeTab: metadata?.window?.tabs?.[0],
              enabledMcpServers: compact(enabledMcpServers),
              customMcpServers,
            },
            userSystemPrompt: personalizationRef.current,
            supportsImages: provider?.supportsImages,
          },
        }
      },
    }),
  })

  const previousStatus = useRef(status)
  useEffect(() => {
    const wasProcessing =
      previousStatus.current === 'streaming' ||
      previousStatus.current === 'submitted'
    const justFinished =
      wasProcessing && (status === 'ready' || status === 'error')

    if (justFinished && isRunning) {
      const workflowRunStatus = wasCancelled
        ? 'cancelled'
        : status === 'error'
          ? 'failed'
          : 'completed'
      void updateWorkflowRunRecord(workflowRunStatus)
      track(WORKFLOW_RUN_COMPLETED_EVENT, {
        status: wasCancelled
          ? 'cancelled'
          : status === 'error'
            ? 'failed'
            : 'completed',
      })
    }
    previousStatus.current = status
  }, [status, isRunning, wasCancelled])

  const createWorkflowRunRecord = async () => {
    if (!agentUrlRef.current || !activeWorkflowRef.current?.definitionId) {
      workflowRunIdRef.current = null
      return
    }

    try {
      const response = await fetch(
        `${agentUrlRef.current}/workflows/${activeWorkflowRef.current.definitionId}/runs`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            sourceWorkflowId: activeWorkflowRef.current.id,
            runProfile: activeWorkflowRef.current.runProfile,
            request: {
              codeId: activeWorkflowRef.current.codeId,
              workflowName: activeWorkflowRef.current.workflowName,
            },
          }),
        },
      )
      if (!response.ok) {
        workflowRunIdRef.current = null
        return
      }

      const data = (await response.json()) as { run?: { id: string } }
      workflowRunIdRef.current = data.run?.id ?? null
      await reflectWorkflowRunLocally('running')
    } catch {
      workflowRunIdRef.current = null
    }
  }

  const reflectWorkflowRunLocally = async (nextStatus: string) => {
    if (!activeWorkflowRef.current) return

    const current = (await workflowStorage.getValue()) ?? []
    const updatedAt = new Date().toISOString()
    await workflowStorage.setValue(
      current.map((workflow) =>
        workflow.id === activeWorkflowRef.current?.id
          ? {
              ...workflow,
              lastRunAt: updatedAt,
              latestRunStatus: nextStatus,
              latestRunUpdatedAt: updatedAt,
            }
          : workflow,
      ),
    )
  }

  const updateWorkflowRunRecord = async (
    nextStatus: 'completed' | 'failed' | 'cancelled',
  ) => {
    await reflectWorkflowRunLocally(nextStatus)
    if (!agentUrlRef.current || !workflowRunIdRef.current) return

    try {
      await fetch(`${agentUrlRef.current}/workflows/runs/${workflowRunIdRef.current}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          status: nextStatus,
          result: {
            messageCount: messages.length,
            wasCancelled,
            error: error?.message,
          },
        }),
      })
    } catch {
      // keep workflow runs local-first when server persistence is unavailable
    }
  }

  const startWorkflowRun = async () => {
    setMessages([])
    setWasCancelled(false)
    await createWorkflowRunRecord()

    const backgroundWindow = await chrome.windows.create({
      url: 'chrome://newtab',
      focused: true,
      type: 'normal',
    })

    sendMessage({
      text: 'Run the workflow.',
      metadata: {
        window: backgroundWindow,
      },
    })
  }

  const runWorkflow = async (workflow: Workflow) => {
    activeWorkflowRef.current = workflow
    codeIdRef.current = workflow.codeId
    setRunningWorkflowName(workflow.workflowName)
    setIsRunning(true)
    await startWorkflowRun()
  }

  const stopRun = () => {
    track(WORKFLOW_RUN_STOPPED_EVENT)
    setWasCancelled(true)
    stop()
  }

  const retry = async () => {
    track(WORKFLOW_RUN_RETRIED_EVENT)
    await startWorkflowRun()
  }

  const closeDialog = () => {
    setIsRunning(false)
    setRunningWorkflowName('')
    setWasCancelled(false)
    setMessages([])
    workflowRunIdRef.current = null
    activeWorkflowRef.current = null
  }

  return {
    isRunning,
    runningWorkflowName,
    messages,
    status,
    wasCancelled,
    error,
    runWorkflow,
    stopRun,
    retry,
    closeDialog,
  }
}
