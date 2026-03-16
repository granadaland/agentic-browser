import type {
  LocalWorkflowIR,
  WorkflowGraph,
} from '@browseros/shared/schemas/automation'
import type { RunProfile } from '@browseros/shared/schemas/runtime'
import { storage } from '@wxt-dev/storage'
import { useEffect, useState } from 'react'
import { getAgentServerUrl } from '@/lib/browseros/helpers'

type LegacyWorkflow = {
  id: string
  codeId: string
  workflowName: string
}

export interface Workflow {
  id: string
  definitionId?: string
  codeId: string
  workflowName: string
  description?: string
  graph?: WorkflowGraph | null
  ir?: LocalWorkflowIR | null
  runProfile: RunProfile
  version: number
  source: 'legacy' | 'workflow2'
  createdAt: string
  updatedAt: string
  lastRunAt?: string
  runCount?: number
  latestRunStatus?: string
  latestRunUpdatedAt?: string
}

type WorkflowRecord = Workflow | LegacyWorkflow

type ServerWorkflow = {
  id: string
  codeId?: string
  version?: number
  name: string
  description?: string | null
  graph?: WorkflowGraph | null
  ir?: LocalWorkflowIR | null
  runProfile?: RunProfile
  runCount?: number
  latestRunStatus?: string
  latestRunUpdatedAt?: string
  createdAt?: string
  updatedAt?: string
}

const nowIso = () => new Date().toISOString()

function buildLocalWorkflowIR(graph?: WorkflowGraph | null): LocalWorkflowIR | null {
  if (!graph) return null
  if (graph.nodes.length === 0) {
    return {
      version: 1,
      mode: 'linear',
      supported: false,
      reason: 'Workflow graph is empty',
      steps: [],
    }
  }

  const nodes = new Map(graph.nodes.map((node) => [node.id, node]))
  const outgoing = new Map<string, string[]>()

  for (const edge of graph.edges) {
    const targets = outgoing.get(edge.source) ?? []
    targets.push(edge.target)
    outgoing.set(edge.source, targets)
  }

  const startNode =
    graph.nodes.find((node) => node.type === 'start') ?? graph.nodes[0]

  if (!startNode) {
    return {
      version: 1,
      mode: 'linear',
      supported: false,
      reason: 'Workflow graph has no start node',
      steps: [],
    }
  }

  const steps: LocalWorkflowIR['steps'] = []
  const visited = new Set<string>()
  let currentNodeId: string | undefined = startNode.id

  while (currentNodeId) {
    if (visited.has(currentNodeId)) {
      return {
        version: 1,
        mode: 'linear',
        supported: false,
        reason: 'Workflow graph contains a loop and cannot run locally yet',
        steps,
      }
    }
    visited.add(currentNodeId)

    const node = nodes.get(currentNodeId)
    if (!node) {
      return {
        version: 1,
        mode: 'linear',
        supported: false,
        reason: `Workflow node ${currentNodeId} could not be resolved`,
        steps,
      }
    }

    if (
      node.type === 'decision' ||
      node.type === 'loop' ||
      node.type === 'fork' ||
      node.type === 'join'
    ) {
      return {
        version: 1,
        mode: 'linear',
        supported: false,
        reason: `Node type "${node.type}" still requires the advanced executor`,
        steps,
      }
    }

    if (node.type !== 'start' && node.type !== 'end') {
      steps.push({
        id: node.id,
        type: node.type as LocalWorkflowIR['steps'][number]['type'],
        label: node.data.label.trim().replace(/\s+/g, ' '),
      })
    }

    if (node.type === 'end') break

    const nextTargets = outgoing.get(node.id) ?? []
    if (nextTargets.length > 1) {
      return {
        version: 1,
        mode: 'linear',
        supported: false,
        reason: `Node "${node.data.label}" branches to multiple paths`,
        steps,
      }
    }

    currentNodeId = nextTargets[0]
  }

  return {
    version: 1,
    mode: 'linear',
    supported: true,
    steps,
  }
}

function normalizeWorkflow(record: WorkflowRecord): Workflow {
  const now = nowIso()
  return {
    id: record.id,
    definitionId: 'definitionId' in record ? record.definitionId : undefined,
    codeId: record.codeId,
    workflowName: record.workflowName,
    description: 'description' in record ? record.description : undefined,
    graph: 'graph' in record ? record.graph : undefined,
    ir:
      'ir' in record
        ? (record.ir ?? buildLocalWorkflowIR(record.graph))
        : buildLocalWorkflowIR('graph' in record ? record.graph : undefined),
    runProfile:
      'runProfile' in record && record.runProfile ? record.runProfile : 'do',
    version: 'version' in record && record.version ? record.version : 1,
    source:
      'source' in record && record.source ? record.source : 'legacy',
    createdAt:
      'createdAt' in record && record.createdAt ? record.createdAt : now,
    updatedAt:
      'updatedAt' in record && record.updatedAt ? record.updatedAt : now,
    lastRunAt: 'lastRunAt' in record ? record.lastRunAt : undefined,
    runCount: 'runCount' in record ? record.runCount : undefined,
    latestRunStatus:
      'latestRunStatus' in record ? record.latestRunStatus : undefined,
    latestRunUpdatedAt:
      'latestRunUpdatedAt' in record ? record.latestRunUpdatedAt : undefined,
  }
}

function normalizeWorkflows(records: WorkflowRecord[] | undefined): Workflow[] {
  return (records ?? []).map(normalizeWorkflow)
}

function withServerFields(
  workflow: Workflow,
  serverWorkflow: ServerWorkflow,
): Workflow {
  return {
    ...workflow,
    definitionId: serverWorkflow.id,
    codeId: serverWorkflow.codeId ?? workflow.codeId,
    workflowName: serverWorkflow.name,
    description: serverWorkflow.description ?? workflow.description,
    graph: serverWorkflow.graph ?? workflow.graph,
    ir: serverWorkflow.ir ?? workflow.ir ?? buildLocalWorkflowIR(serverWorkflow.graph ?? workflow.graph),
    runProfile: serverWorkflow.runProfile ?? workflow.runProfile,
    version: serverWorkflow.version ?? workflow.version,
    source: workflow.source === 'legacy' ? 'workflow2' : workflow.source,
    runCount: serverWorkflow.runCount ?? workflow.runCount,
    latestRunStatus: serverWorkflow.latestRunStatus ?? workflow.latestRunStatus,
    latestRunUpdatedAt:
      serverWorkflow.latestRunUpdatedAt ?? workflow.latestRunUpdatedAt,
    createdAt: serverWorkflow.createdAt ?? workflow.createdAt,
    updatedAt: serverWorkflow.updatedAt ?? workflow.updatedAt,
  }
}

async function syncWorkflowToServer(
  workflow: Workflow,
): Promise<Workflow | null> {
  try {
    const baseUrl = await getAgentServerUrl()
    const response = await fetch(`${baseUrl}/workflows`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        id: workflow.definitionId,
        legacyWorkflowId: workflow.id,
        codeId: workflow.codeId,
        name: workflow.workflowName,
        description: workflow.description,
        graph: workflow.graph,
        ir: workflow.ir ?? buildLocalWorkflowIR(workflow.graph),
        source: workflow.source === 'legacy' ? 'extension' : 'local',
        runProfile: workflow.runProfile,
      }),
    })

    if (!response.ok) return null
    const data = (await response.json()) as { workflow?: ServerWorkflow }
    if (!data.workflow) return null
    return withServerFields(workflow, data.workflow)
  } catch {
    return null
  }
}

async function deleteWorkflowFromServer(workflow: Workflow): Promise<void> {
  try {
    const baseUrl = await getAgentServerUrl()
    const target = workflow.definitionId
      ? `${baseUrl}/workflows/${workflow.definitionId}`
      : `${baseUrl}/workflows/legacy/${workflow.id}`
    await fetch(target, { method: 'DELETE' })
  } catch {
    // ignore sync failures for local-first behavior
  }
}

export const workflowStorage = storage.defineItem<Workflow[]>(`local:workflows`, {
  fallback: [],
})

export function useWorkflows() {
  const [workflows, setWorkflows] = useState<Workflow[]>([])

  useEffect(() => {
    const initialize = async () => {
      const current = normalizeWorkflows(await workflowStorage.getValue())
      setWorkflows(current)
      await workflowStorage.setValue(current)

      const unsynced = current.filter((workflow) => !workflow.definitionId)
      if (unsynced.length === 0) return

      let next = current
      let changed = false
      for (const workflow of unsynced) {
        const synced = await syncWorkflowToServer(workflow)
        if (!synced) continue
        next = next.map((item) => (item.id === workflow.id ? synced : item))
        changed = true
      }

      if (changed) {
        await workflowStorage.setValue(next)
        setWorkflows(next)
      }
    }

    initialize()

    const unwatch = workflowStorage.watch((newValue) => {
      setWorkflows(normalizeWorkflows(newValue))
    })
    return unwatch
  }, [])

  const addWorkflow = async (
    workflow: {
      codeId: string
      workflowName: string
      description?: string
      graph?: WorkflowGraph | null
      runProfile?: RunProfile
    },
  ) => {
    const now = nowIso()
    const newWorkflow: Workflow = {
      id: crypto.randomUUID(),
      codeId: workflow.codeId,
      workflowName: workflow.workflowName,
      description: workflow.description,
      graph: workflow.graph,
      ir: buildLocalWorkflowIR(workflow.graph),
      runProfile: workflow.runProfile ?? 'do',
      version: 1,
      source: 'workflow2',
      createdAt: now,
      updatedAt: now,
    }
    const current = normalizeWorkflows(await workflowStorage.getValue())
    const optimistic = [...current, newWorkflow]
    await workflowStorage.setValue(optimistic)

    const synced = await syncWorkflowToServer(newWorkflow)
    if (!synced) return newWorkflow

    const next = optimistic.map((workflowItem) =>
      workflowItem.id === newWorkflow.id ? synced : workflowItem,
    )
    await workflowStorage.setValue(next)
    return synced
  }

  const removeWorkflow = async (id: string) => {
    const current = normalizeWorkflows(await workflowStorage.getValue())
    const workflow = current.find((item) => item.id === id)
    await workflowStorage.setValue(current.filter((item) => item.id !== id))
    if (workflow) {
      await deleteWorkflowFromServer(workflow)
    }
  }

  const editWorkflow = async (
    id: string,
    updates: Partial<
      Pick<
        Workflow,
        | 'codeId'
        | 'workflowName'
        | 'description'
        | 'graph'
        | 'ir'
        | 'runProfile'
        | 'lastRunAt'
        | 'runCount'
        | 'latestRunStatus'
        | 'latestRunUpdatedAt'
        | 'definitionId'
        | 'version'
      >
    >,
  ) => {
    const current = normalizeWorkflows(await workflowStorage.getValue())
    const next = current.map((workflow) =>
      workflow.id === id
        ? {
            ...workflow,
            ...updates,
            ir:
              updates.graph !== undefined
                ? buildLocalWorkflowIR(updates.graph ?? null)
                : (updates.ir ?? workflow.ir),
            updatedAt: nowIso(),
          }
        : workflow,
    )
    await workflowStorage.setValue(next)

    const updatedWorkflow = next.find((workflow) => workflow.id === id)
    if (!updatedWorkflow) return

    const shouldSync =
      updates.codeId !== undefined ||
      updates.workflowName !== undefined ||
      updates.description !== undefined ||
      updates.graph !== undefined ||
      updates.ir !== undefined ||
      updates.runProfile !== undefined ||
      !updatedWorkflow.definitionId

    if (!shouldSync) return

    const synced = await syncWorkflowToServer(updatedWorkflow)
    if (!synced) return

    const merged = next.map((workflow) =>
      workflow.id === id ? synced : workflow,
    )
    await workflowStorage.setValue(merged)
  }

  return { workflows, addWorkflow, removeWorkflow, editWorkflow }
}
