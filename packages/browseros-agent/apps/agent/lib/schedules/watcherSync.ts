import { getAgentServerUrl } from '@/lib/browseros/helpers'
import type { ScheduledJob, ScheduledJobRun } from './scheduleTypes'

type ServerWatcher = {
  id: string
}

async function getBaseUrl(): Promise<string | null> {
  try {
    return await getAgentServerUrl()
  } catch {
    return null
  }
}

export async function syncWatcherJob(
  job: ScheduledJob,
): Promise<ServerWatcher | null> {
  const baseUrl = await getBaseUrl()
  if (!baseUrl) return null

  try {
    const response = await fetch(`${baseUrl}/watchers`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        legacyJobId: job.id,
        name: job.name,
        query: job.query,
        runProfile: 'watch',
        schedule: {
          type: job.scheduleType,
          time: job.scheduleTime,
          interval: job.scheduleInterval,
        },
        trigger:
          job.triggerType && job.triggerType !== 'schedule'
            ? {
                type: job.triggerType,
                urlPattern: job.triggerUrlPattern,
                textPattern: job.triggerTextPattern,
              }
            : {
                type: 'schedule',
              },
        enabled: job.enabled,
        lastRunAt: job.lastRunAt,
      }),
    })

    if (!response.ok) return null
    const data = (await response.json()) as { watcher?: ServerWatcher }
    return data.watcher ?? null
  } catch {
    return null
  }
}

export async function deleteWatcherJob(jobId: string): Promise<void> {
  const baseUrl = await getBaseUrl()
  if (!baseUrl) return

  try {
    await fetch(`${baseUrl}/watchers/legacy/${jobId}`, {
      method: 'DELETE',
    })
  } catch {
    // ignore sync failures to preserve local-first behavior
  }
}

export async function syncWatcherRun(
  job: ScheduledJob,
  run: ScheduledJobRun,
): Promise<void> {
  const baseUrl = await getBaseUrl()
  if (!baseUrl) return

  const watcher = await syncWatcherJob(job)
  if (!watcher) return

  try {
    await fetch(`${baseUrl}/watchers/runs`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        watcherId: watcher.id,
        legacyRunId: run.id,
        status: run.status === 'failed' && run.error === 'Cancelled by user'
          ? 'cancelled'
          : run.status,
        result: run.result,
        finalResult: run.finalResult,
        executionLog: run.executionLog,
        toolCalls: run.toolCalls,
        error: run.error,
        startedAt: run.startedAt,
        completedAt: run.completedAt,
      }),
    })
  } catch {
    // ignore sync failures to preserve local-first behavior
  }
}
