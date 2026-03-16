import { Activity, Boxes, Clock3, RefreshCw } from 'lucide-react'
import { type FC, useEffect, useMemo, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { type RoutingPolicySummary, useRuns } from './useRuns'

function formatDate(value?: string | null): string {
  if (!value) return 'Unknown'
  return new Date(value).toLocaleString()
}

function formatBytes(byteSize: number): string {
  if (byteSize < 1024) return `${byteSize} B`
  if (byteSize < 1024 * 1024) return `${Math.round(byteSize / 102.4) / 10} KB`
  return `${Math.round(byteSize / 1024 / 102.4) / 10} MB`
}

function formatChars(charCount: number): string {
  if (charCount < 1_000) return `${charCount}`
  if (charCount < 1_000_000) return `${Math.round(charCount / 100) / 10}k`
  return `${Math.round(charCount / 100_000) / 10}m`
}

function describeRoutingPolicy(
  policy?: RoutingPolicySummary | null,
): string {
  const capabilities = policy?.capabilities ?? policy?.stageModels.capabilities
  if (!policy) return 'Routing metadata unavailable.'
  if (!capabilities) {
    return `${policy.profile} profile is using ${policy.strategy} routing across planner, executor, verifier, and recovery stages.`
  }

  return `${policy.profile} profile is using ${policy.strategy} routing because ${capabilities.provider}/${capabilities.model} is ${capabilities.costTier} cost, ${capabilities.latencyTier} latency, ${capabilities.contextTier} context, and ${capabilities.toolCallReliability} for tool use.`
}

function getStatusBadgeVariant(status: string):
  | 'default'
  | 'secondary'
  | 'destructive'
  | 'outline' {
  if (status === 'completed') return 'default'
  if (status === 'failed') return 'destructive'
  if (status === 'running') return 'secondary'
  return 'outline'
}

export const RunsPage: FC = () => {
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null)
  const { runs, replay, baseUrl, isLoading, isReplayLoading, error, refetch } =
    useRuns(selectedRunId)

  useEffect(() => {
    if (!selectedRunId && runs.length > 0) {
      setSelectedRunId(runs[0]?.id ?? null)
    }
  }, [runs, selectedRunId])

  const stats = useMemo(() => {
    return {
      total: runs.length,
      completed: runs.filter((run) => run.status === 'completed').length,
      failed: runs.filter((run) => run.status === 'failed').length,
      active: runs.filter((run) => run.status === 'running').length,
    }
  }, [runs])

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[var(--accent-orange)]/10">
              <Activity className="h-6 w-6 text-[var(--accent-orange)]" />
            </div>
            <div>
              <h2 className="font-semibold text-xl">Runs</h2>
              <p className="text-muted-foreground text-sm">
                Inspect planner, executor, verifier, checkpoints, and artifacts.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Badge variant="outline">{stats.total} total</Badge>
                <Badge variant="default">{stats.completed} completed</Badge>
                <Badge variant="secondary">{stats.active} active</Badge>
                <Badge variant="destructive">{stats.failed} failed</Badge>
              </div>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
            Refresh
          </Button>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-destructive text-sm">
          {error.message}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[320px_minmax(0,1fr)]">
        <div className="rounded-xl border border-border bg-card p-3 shadow-sm">
          <div className="mb-2 flex items-center justify-between px-2 py-1">
            <span className="font-medium text-sm">Recent Runs</span>
            {isLoading && (
              <span className="text-muted-foreground text-xs">Loading...</span>
            )}
          </div>

          <div className="space-y-2">
            {runs.length === 0 ? (
              <div className="rounded-lg border border-dashed border-border px-4 py-8 text-center text-muted-foreground text-sm">
                No runs recorded yet.
              </div>
            ) : (
              runs.map((run) => (
                <button
                  key={run.id}
                  type="button"
                  onClick={() => setSelectedRunId(run.id)}
                  className={cn(
                    'w-full rounded-lg border p-3 text-left transition-colors hover:border-[var(--accent-orange)]/50 hover:bg-muted/30',
                    selectedRunId === run.id
                      ? 'border-[var(--accent-orange)]/50 bg-[var(--accent-orange)]/5'
                      : 'border-border',
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <Badge
                      variant={getStatusBadgeVariant(run.status)}
                      className="capitalize"
                    >
                      {run.status}
                    </Badge>
                    <span className="text-muted-foreground text-xs uppercase">
                      {run.profile}
                    </span>
                  </div>
                  <p className="mt-2 line-clamp-3 font-medium text-sm">
                    {run.requestMessage}
                  </p>
                  <div className="mt-2 flex items-center justify-between text-muted-foreground text-xs">
                    <span>{run.provider}</span>
                    <span>{formatDate(run.updatedAt)}</span>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>

        <div className="space-y-4">
          {!replay || !selectedRunId ? (
            <div className="rounded-xl border border-border bg-card p-8 text-center text-muted-foreground shadow-sm">
              Select a run to inspect its timeline and artifacts.
            </div>
          ) : (
            <>
              <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge
                        variant={getStatusBadgeVariant(replay.run.status)}
                        className="capitalize"
                      >
                        {replay.run.status}
                      </Badge>
                      <Badge variant="outline" className="capitalize">
                        {replay.run.profile}
                      </Badge>
                      <Badge variant="outline">{replay.run.provider}</Badge>
                      <Badge variant="outline">{replay.run.model}</Badge>
                      {replay.routingPolicy?.strategy && (
                        <Badge variant="secondary" className="capitalize">
                          {replay.routingPolicy.strategy}
                        </Badge>
                      )}
                    </div>
                    <p className="mt-3 text-sm">{replay.run.requestMessage}</p>
                  </div>
                  <div className="text-muted-foreground text-xs">
                    {isReplayLoading ? 'Refreshing detail...' : formatDate(replay.run.updatedAt)}
                  </div>
                </div>

                <div className="mt-4 grid gap-3 sm:grid-cols-3">
                  <div className="rounded-lg border border-border/70 bg-muted/20 p-3">
                    <div className="flex items-center gap-2 text-muted-foreground text-xs uppercase">
                      <Clock3 className="h-3.5 w-3.5" />
                      Timeline
                    </div>
                    <div className="mt-2 font-semibold text-lg">
                      {replay.events.length}
                    </div>
                    <div className="text-muted-foreground text-xs">events</div>
                  </div>
                  <div className="rounded-lg border border-border/70 bg-muted/20 p-3">
                    <div className="flex items-center gap-2 text-muted-foreground text-xs uppercase">
                      <Boxes className="h-3.5 w-3.5" />
                      Context
                    </div>
                    <div className="mt-2 font-semibold text-lg">
                      {replay.contextPackets.length}
                    </div>
                    <div className="text-muted-foreground text-xs">packets</div>
                  </div>
                  <div className="rounded-lg border border-border/70 bg-muted/20 p-3">
                    <div className="flex items-center gap-2 text-muted-foreground text-xs uppercase">
                      <Activity className="h-3.5 w-3.5" />
                      Token Budget
                    </div>
                    <div className="mt-2 font-semibold text-lg">
                      {replay.budgetStats
                        ? replay.budgetStats.estimatedInputTokens +
                          replay.budgetStats.estimatedOutputTokens
                        : 0}
                    </div>
                    <div className="text-muted-foreground text-xs">est. tokens</div>
                  </div>
                </div>
              </div>

              <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
                <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
                  <div className="mb-4 flex items-center justify-between">
                    <h3 className="font-semibold text-base">Timeline</h3>
                    <span className="text-muted-foreground text-xs">
                      {replay.checkpoints.length} checkpoints
                    </span>
                  </div>
                  <div className="space-y-3">
                    {replay.events.map((event) => (
                      <div
                        key={`${event.id}-${event.createdAt}`}
                        className="rounded-lg border border-border/70 p-3"
                      >
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant="outline">{event.type}</Badge>
                          {event.stage && (
                            <Badge variant="secondary" className="capitalize">
                              {event.stage}
                            </Badge>
                          )}
                          <span className="text-muted-foreground text-xs">
                            {formatDate(event.createdAt)}
                          </span>
                        </div>
                        <div className="mt-2 font-medium text-sm">
                          {event.title}
                        </div>
                        {event.detail && (
                          <p className="mt-1 text-muted-foreground text-sm">
                            {event.detail}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                <div className="space-y-4">
                  {replay.routingPolicy && (
                    <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
                      <h3 className="font-semibold text-base">Routing</h3>
                      <div className="mt-3 space-y-3">
                        <p className="rounded-lg border border-border/70 bg-muted/20 p-3 text-sm">
                          {describeRoutingPolicy(replay.routingPolicy)}
                        </p>
                        <div className="grid gap-2 text-sm">
                          <div className="flex items-center justify-between">
                            <span className="text-muted-foreground">Profile</span>
                            <span className="capitalize">
                              {replay.routingPolicy.profile}
                            </span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-muted-foreground">Strategy</span>
                            <span className="capitalize">
                              {replay.routingPolicy.strategy}
                            </span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-muted-foreground">Planner</span>
                            <span>{replay.routingPolicy.stageModels.planner}</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-muted-foreground">Executor</span>
                            <span>{replay.routingPolicy.stageModels.executor}</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-muted-foreground">Verifier</span>
                            <span>{replay.routingPolicy.stageModels.verifier}</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-muted-foreground">Recovery</span>
                            <span>{replay.routingPolicy.stageModels.recovery}</span>
                          </div>
                        </div>

                        {(
                          replay.routingPolicy.capabilities ??
                          replay.routingPolicy.stageModels.capabilities
                        ) && (
                          <div className="rounded-lg border border-border/70 p-3 text-sm">
                            <div className="mb-2 font-medium">
                              Provider capabilities
                            </div>
                            <div className="space-y-2">
                              <div className="flex items-center justify-between">
                                <span className="text-muted-foreground">
                                  Cost tier
                                </span>
                                <span className="capitalize">
                                  {(
                                    replay.routingPolicy.capabilities ??
                                    replay.routingPolicy.stageModels.capabilities
                                  )?.costTier}
                                </span>
                              </div>
                              <div className="flex items-center justify-between">
                                <span className="text-muted-foreground">
                                  Latency tier
                                </span>
                                <span className="capitalize">
                                  {(
                                    replay.routingPolicy.capabilities ??
                                    replay.routingPolicy.stageModels.capabilities
                                  )?.latencyTier}
                                </span>
                              </div>
                              <div className="flex items-center justify-between">
                                <span className="text-muted-foreground">
                                  Context tier
                                </span>
                                <span className="capitalize">
                                  {(
                                    replay.routingPolicy.capabilities ??
                                    replay.routingPolicy.stageModels.capabilities
                                  )?.contextTier}
                                </span>
                              </div>
                              <div className="flex items-center justify-between">
                                <span className="text-muted-foreground">
                                  Tool reliability
                                </span>
                                <span className="capitalize">
                                  {(
                                    replay.routingPolicy.capabilities ??
                                    replay.routingPolicy.stageModels.capabilities
                                  )?.toolCallReliability}
                                </span>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
                    <h3 className="font-semibold text-base">Artifacts</h3>
                    <div className="mt-3 space-y-3">
                      {replay.artifacts.length === 0 ? (
                        <p className="text-muted-foreground text-sm">
                          No artifacts captured for this run.
                        </p>
                      ) : (
                        replay.artifacts.map((artifact) => (
                          <a
                            key={artifact.id}
                            href={
                              baseUrl
                                ? `${baseUrl}/runs/${replay.run.id}/artifacts/${artifact.id}`
                                : undefined
                            }
                            target="_blank"
                            rel="noreferrer"
                            className="block rounded-lg border border-border/70 p-3 transition-colors hover:border-[var(--accent-orange)]/50 hover:bg-muted/30"
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-medium text-sm">
                                {artifact.name}
                              </span>
                              <Badge variant="outline">{artifact.kind}</Badge>
                            </div>
                            <p className="mt-1 line-clamp-3 text-muted-foreground text-xs">
                              {artifact.previewText ?? artifact.filePath}
                            </p>
                            <div className="mt-2 text-muted-foreground text-xs">
                              {formatBytes(artifact.byteSize)}
                            </div>
                          </a>
                        ))
                      )}
                    </div>
                  </div>

                  <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
                    <h3 className="font-semibold text-base">Context Cache</h3>
                    <div className="mt-3 space-y-3">
                      {replay.contextPackets.length === 0 ? (
                        <p className="text-muted-foreground text-sm">
                          No cached context packets yet.
                        </p>
                      ) : (
                        replay.contextPackets.map((packet) => (
                          <div
                            key={packet.id}
                            className="rounded-lg border border-border/70 p-3"
                          >
                            <div className="flex items-center justify-between gap-2">
                              <Badge variant="secondary">
                                {packet.packetType}
                              </Badge>
                              <span className="text-muted-foreground text-xs">
                                {formatDate(packet.createdAt)}
                              </span>
                            </div>
                            <p className="mt-2 text-sm">{packet.summary}</p>
                            <div className="mt-1 text-muted-foreground text-xs">
                              {packet.packetKey}
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  {replay.budgetStats && (
                    <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
                      <h3 className="font-semibold text-base">Budget Stats</h3>
                      <div className="mt-3 space-y-2 text-sm">
                        <div className="flex items-center justify-between">
                          <span className="text-muted-foreground">
                            Request chars
                          </span>
                          <span>{formatChars(replay.budgetStats.requestChars)}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-muted-foreground">
                            Browser context chars
                          </span>
                          <span>
                            {formatChars(replay.budgetStats.browserContextChars)}
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-muted-foreground">
                            Available skills
                          </span>
                          <span>
                            {replay.budgetStats.availableSkillsCount} (
                            {formatChars(replay.budgetStats.availableSkillsChars)})
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-muted-foreground">
                            Input tokens
                          </span>
                          <span>{replay.budgetStats.estimatedInputTokens}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-muted-foreground">
                            Output tokens
                          </span>
                          <span>{replay.budgetStats.estimatedOutputTokens}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-muted-foreground">
                            Tool calls
                          </span>
                          <span>{replay.budgetStats.toolCallCount}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-muted-foreground">
                            Selected skills
                          </span>
                          <span>
                            {replay.budgetStats.selectedSkillsCount} (
                            {formatChars(replay.budgetStats.selectedSkillsChars)})
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-muted-foreground">
                            Cached packets
                          </span>
                          <span>{replay.budgetStats.contextPacketsCount}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-muted-foreground">Artifacts</span>
                          <span>{replay.budgetStats.artifactCount}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-muted-foreground">
                            Externalized chars
                          </span>
                          <span>
                            {formatChars(replay.budgetStats.externalizedChars)}
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-muted-foreground">Sources</span>
                          <span>{replay.budgetStats.sourceCount}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-muted-foreground">
                            Assistant chars
                          </span>
                          <span>
                            {formatChars(replay.budgetStats.assistantOutputChars)}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
