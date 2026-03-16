import { useQuery } from '@tanstack/react-query'
import { useAgentServerUrl } from '@/lib/browseros/useBrowserOSProviders'

export interface RunRecord {
  id: string
  conversationId: string
  profile: string
  status: string
  stage?: string | null
  provider: string
  model: string
  requestMessage: string
  routingPolicy?: RoutingPolicySummary | null
  verificationSummary?: string | null
  errorText?: string | null
  createdAt: string
  updatedAt: string
}

export interface RoutingPolicySummary {
  strategy: string
  profile: string
  stageModels: {
    planner: string
    executor: string
    verifier: string
    recovery: string
    capabilities?: {
      provider: string
      model: string
      supportsImages: boolean
      costTier: string
      latencyTier: string
      contextTier: string
      toolCallReliability: string
    }
  }
  capabilities?: {
    provider: string
    model: string
    supportsImages: boolean
    costTier: string
    latencyTier: string
    contextTier: string
    toolCallReliability: string
  }
}

export interface RunEventRecord {
  id: number
  type: string
  stage?: string | null
  title: string
  detail?: string | null
  createdAt: string
}

export interface RunCheckpointRecord {
  id: string
  label: string
  stage?: string | null
  status: string
  createdAt: string
}

export interface RunArtifactRecord {
  id: string
  name: string
  kind: string
  previewText?: string | null
  mimeType?: string | null
  filePath: string
  byteSize: number
  createdAt: string
}

export interface RunContextPacketRecord {
  id: string
  packetType: string
  packetKey: string
  summary: string
  createdAt: string
}

export interface RunBudgetStats {
  requestChars: number
  browserContextChars: number
  availableSkillsCount: number
  availableSkillsChars: number
  estimatedInputTokens: number
  estimatedOutputTokens: number
  selectedSkillsChars: number
  toolCallCount: number
  selectedSkillsCount: number
  contextPacketsCount: number
  artifactCount: number
  externalizedChars: number
  sourceCount: number
  assistantOutputChars: number
}

export interface RunReplayRecord {
  run: RunRecord
  events: RunEventRecord[]
  checkpoints: RunCheckpointRecord[]
  artifacts: RunArtifactRecord[]
  contextPackets: RunContextPacketRecord[]
  routingPolicy?: RoutingPolicySummary | null
  budgetStats?: RunBudgetStats | null
}

const RUNS_QUERY_KEY = 'browseros-runs'

async function fetchRuns(baseUrl: string): Promise<RunRecord[]> {
  const response = await fetch(`${baseUrl}/runs`)
  if (!response.ok) throw new Error(`HTTP ${response.status}`)
  const data = (await response.json()) as { runs: RunRecord[] }
  return data.runs ?? []
}

async function fetchReplay(
  baseUrl: string,
  runId: string,
): Promise<RunReplayRecord> {
  const [replayResponse, metricsResponse] = await Promise.all([
    fetch(`${baseUrl}/runs/${runId}/replay`),
    fetch(`${baseUrl}/runs/${runId}/metrics`),
  ])
  if (!replayResponse.ok) throw new Error(`HTTP ${replayResponse.status}`)
  if (!metricsResponse.ok) throw new Error(`HTTP ${metricsResponse.status}`)

  const replay = (await replayResponse.json()) as RunReplayRecord
  const metrics = (await metricsResponse.json()) as {
    routingPolicy?: RoutingPolicySummary | null
    budgetStats?: RunBudgetStats | null
  }

  return {
    ...replay,
    run: {
      ...replay.run,
      routingPolicy: metrics.routingPolicy ?? replay.run.routingPolicy ?? null,
    },
    routingPolicy: metrics.routingPolicy ?? replay.run.routingPolicy ?? null,
    budgetStats: metrics.budgetStats ?? replay.budgetStats ?? null,
  }
}

export function useRuns(selectedRunId?: string | null) {
  const { baseUrl, isLoading: urlLoading } = useAgentServerUrl()

  const runsQuery = useQuery<RunRecord[], Error>({
    queryKey: [RUNS_QUERY_KEY, baseUrl],
    queryFn: () => fetchRuns(baseUrl as string),
    enabled: !!baseUrl && !urlLoading,
    refetchInterval: 15_000,
  })

  const replayQuery = useQuery<RunReplayRecord, Error>({
    queryKey: [RUNS_QUERY_KEY, 'replay', baseUrl, selectedRunId],
    queryFn: () => fetchReplay(baseUrl as string, selectedRunId as string),
    enabled: !!baseUrl && !urlLoading && !!selectedRunId,
    refetchInterval: 10_000,
  })

  return {
    runs: runsQuery.data ?? [],
    replay: replayQuery.data ?? null,
    baseUrl,
    isLoading: runsQuery.isLoading || urlLoading,
    isReplayLoading: replayQuery.isFetching,
    error: runsQuery.error ?? replayQuery.error ?? null,
    refetch: async () => {
      await runsQuery.refetch()
      if (selectedRunId) {
        await replayQuery.refetch()
      }
    },
  }
}
