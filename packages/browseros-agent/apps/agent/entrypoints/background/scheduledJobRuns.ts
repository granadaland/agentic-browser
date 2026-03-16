import { onScheduleMessage } from '@/lib/messaging/schedules/scheduleMessages'
import { createAlarmFromJob } from '@/lib/schedules/createAlarmFromJob'
import { getChatServerResponse } from '@/lib/schedules/getChatServerResponse'
import {
  scheduledJobRunStorage,
  scheduledJobStorage,
} from '@/lib/schedules/scheduleStorage'
import type { ScheduledJob, ScheduledJobRun } from '@/lib/schedules/scheduleTypes'
import { syncWatcherRun } from '@/lib/schedules/watcherSync'

const MAX_RUNS_PER_JOB = 15
const STALE_TIMEOUT_MS = 10 * 60 * 1000 // 10 minutes
const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000
const ALARM_PREFIX = 'scheduled-job-'

const runAbortControllers = new Map<string, AbortController>()
const lastTriggerSignatureByJob = new Map<string, string>()

interface TriggeredBrowserContext {
  windowId?: number
  activeTab?: {
    id?: number
    url?: string
    title?: string
  }
}

interface PageSnapshot {
  tabId: number
  windowId?: number
  url?: string
  title?: string
  text?: string
}

function normalizeMatchValue(value?: string): string {
  return value?.trim().toLowerCase() ?? ''
}

function containsPattern(haystack: string, pattern?: string): boolean {
  if (!pattern?.trim()) return true
  return haystack.includes(normalizeMatchValue(pattern))
}

function buildMatchExcerpt(haystack: string, pattern?: string): string {
  if (!haystack) return ''

  const normalizedPattern = normalizeMatchValue(pattern)
  if (!normalizedPattern) {
    return haystack.slice(0, 160)
  }

  const matchIndex = haystack.indexOf(normalizedPattern)
  if (matchIndex === -1) {
    return haystack.slice(0, 160)
  }

  const start = Math.max(0, matchIndex - 48)
  const end = Math.min(
    haystack.length,
    matchIndex + normalizedPattern.length + 48,
  )
  return haystack.slice(start, end)
}

function isHttpPage(url?: string): boolean {
  return Boolean(url?.startsWith('http://') || url?.startsWith('https://'))
}

export const scheduledJobRuns = async () => {
  const getPageSnapshot = async (
    tab: chrome.tabs.Tab,
  ): Promise<PageSnapshot | null> => {
    if (!tab.id || !isHttpPage(tab.url)) return null

    try {
      const response = (await chrome.tabs.sendMessage(tab.id, {
        type: 'browseros-watcher-snapshot',
      })) as {
        url?: string
        title?: string
        text?: string
      }

      return {
        tabId: tab.id,
        windowId: tab.windowId,
        url: response?.url ?? tab.url,
        title: response?.title ?? tab.title,
        text: response?.text,
      }
    } catch {
      return {
        tabId: tab.id,
        windowId: tab.windowId,
        url: tab.url,
        title: tab.title,
      }
    }
  }

  const matchesTriggeredJob = (job: ScheduledJob, snapshot: PageSnapshot) => {
    const triggerType = job.triggerType ?? 'schedule'
    if (triggerType === 'schedule') return false

    const pageValue = normalizeMatchValue(
      [snapshot.url, snapshot.title].filter(Boolean).join(' '),
    )
    const contentValue = normalizeMatchValue(
      [snapshot.title, snapshot.text].filter(Boolean).join(' '),
    )

    const urlMatch = containsPattern(pageValue, job.triggerUrlPattern)
    const textMatch = containsPattern(contentValue, job.triggerTextPattern)

    if (triggerType === 'page') {
      return urlMatch && textMatch
    }

    return urlMatch && Boolean(job.triggerTextPattern?.trim()) && textMatch
  }

  const buildTriggerSignature = (job: ScheduledJob, snapshot: PageSnapshot) =>
    (() => {
      const pageValue = normalizeMatchValue(
        [snapshot.url, snapshot.title].filter(Boolean).join(' '),
      )
      const contentValue = normalizeMatchValue(
        [snapshot.title, snapshot.text].filter(Boolean).join(' '),
      )

      return [
        snapshot.tabId,
        snapshot.url ?? '',
        snapshot.title ?? '',
        normalizeMatchValue(job.triggerUrlPattern),
        buildMatchExcerpt(pageValue, job.triggerUrlPattern),
        normalizeMatchValue(job.triggerTextPattern),
        buildMatchExcerpt(contentValue, job.triggerTextPattern),
      ].join('::')
    })()

  const hasRunningRun = async (jobId: string) => {
    const runs = (await scheduledJobRunStorage.getValue()) ?? []
    return runs.some((run) => run.jobId === jobId && run.status === 'running')
  }

  const cleanupStaleJobRuns = async () => {
    const current = (await scheduledJobRunStorage.getValue()) ?? []
    const now = Date.now()

    const updated = current.map((run) => {
      if (run.status !== 'running') return run

      const startedAt = new Date(run.startedAt).getTime()
      if (now - startedAt > STALE_TIMEOUT_MS) {
        return {
          ...run,
          status: 'failed' as const,
          completedAt: new Date().toISOString(),
          result: 'Job timed out!',
        }
      }
      return run
    })

    await scheduledJobRunStorage.setValue(updated)
  }

  const syncAlarmState = async () => {
    const jobs = (await scheduledJobStorage.getValue()) ?? []
    const scheduledJobs = jobs.filter(
      (each) => each.enabled && (each.triggerType ?? 'schedule') === 'schedule',
    )
    const scheduledJobIds = new Set(scheduledJobs.map((job) => job.id))
    const alarms = await chrome.alarms.getAll()

    for (const alarm of alarms) {
      if (!alarm.name.startsWith(ALARM_PREFIX)) continue
      const jobId = alarm.name.replace(ALARM_PREFIX, '')
      if (!scheduledJobIds.has(jobId)) {
        await chrome.alarms.clear(alarm.name)
      }
    }

    for (const jobId of Array.from(lastTriggerSignatureByJob.keys())) {
      const job = jobs.find((each) => each.id === jobId)
      if (!job || !job.enabled || (job.triggerType ?? 'schedule') === 'schedule') {
        lastTriggerSignatureByJob.delete(jobId)
      }
    }

    for (let i = 0; i < scheduledJobs.length; i++) {
      const job = scheduledJobs[i]
      const alarmName = `${ALARM_PREFIX}${job.id}`
      const existingAlarm = await chrome.alarms.get(alarmName)

      if (!existingAlarm) {
        await createAlarmFromJob(job)
      }
    }
  }

  const createJobRun = async (
    jobId: string,
    status: ScheduledJobRun['status'],
  ): Promise<ScheduledJobRun> => {
    const jobRun: ScheduledJobRun = {
      id: crypto.randomUUID(),
      jobId,
      startedAt: new Date().toISOString(),
      status,
    }

    const current = (await scheduledJobRunStorage.getValue()) ?? []
    const otherJobRuns = current.filter((r) => r.jobId !== jobId)
    const thisJobRuns = current
      .filter((r) => r.jobId === jobId)
      .sort(
        (a, b) =>
          new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime(),
      )
      .slice(0, MAX_RUNS_PER_JOB - 1)

    await scheduledJobRunStorage.setValue([
      ...otherJobRuns,
      ...thisJobRuns,
      jobRun,
    ])
    return jobRun
  }

  const updateJobRun = async (
    runId: string,
    updates: Partial<Omit<ScheduledJobRun, 'id' | 'jobId' | 'startedAt'>>,
  ) => {
    const current = (await scheduledJobRunStorage.getValue()) ?? []
    const next = current.map((r) => (r.id === runId ? { ...r, ...updates } : r))
    await scheduledJobRunStorage.setValue(next)
    return next.find((r) => r.id === runId)
  }

  const updateJobLastRunAt = async (jobId: string) => {
    const current = (await scheduledJobStorage.getValue()) ?? []
    await scheduledJobStorage.setValue(
      current.map((j) =>
        j.id === jobId ? { ...j, lastRunAt: new Date().toISOString() } : j,
      ),
    )
  }

  const executeScheduledJob = async (
    jobId: string,
    browserContext?: TriggeredBrowserContext,
  ): Promise<void> => {
    const job = (await scheduledJobStorage.getValue()).find(
      (each) => each.id === jobId,
    )

    if (!job) {
      throw new Error(`Job not found: ${jobId}`)
    }

    const jobRun = await createJobRun(jobId, 'running')
    await syncWatcherRun(job, jobRun)
    const abortController = new AbortController()
    runAbortControllers.set(jobRun.id, abortController)

    try {
      const response = await getChatServerResponse({
        message: job.query,
        signal: abortController.signal,
        windowId: browserContext?.windowId,
        activeTab: browserContext?.activeTab,
      })

      const updatedRun = await updateJobRun(jobRun.id, {
        status: 'completed',
        completedAt: new Date().toISOString(),
        result: response.text,
        finalResult: response.finalResult,
        executionLog: response.executionLog,
        toolCalls: response.toolCalls,
      })
      if (updatedRun) {
        await syncWatcherRun(job, updatedRun)
      }
    } catch (e) {
      const isCancelled = abortController.signal.aborted
      const errorMessage = isCancelled
        ? 'Cancelled by user'
        : e instanceof Error
          ? e.message
          : String(e)
      const updatedRun = await updateJobRun(jobRun.id, {
        status: 'failed',
        completedAt: new Date().toISOString(),
        result: errorMessage,
        error: errorMessage,
      })
      if (updatedRun) {
        await syncWatcherRun(job, updatedRun)
      }
    } finally {
      runAbortControllers.delete(jobRun.id)
      await updateJobLastRunAt(jobId)
    }
  }

  const evaluateTriggeredJobsForTab = async (tab: chrome.tabs.Tab) => {
    const snapshot = await getPageSnapshot(tab)
    if (!snapshot) return

    const jobs = ((await scheduledJobStorage.getValue()) ?? []).filter(
      (job) => job.enabled && (job.triggerType ?? 'schedule') !== 'schedule',
    )

    for (const job of jobs) {
      if (!matchesTriggeredJob(job, snapshot)) {
        lastTriggerSignatureByJob.delete(job.id)
        continue
      }
      if (await hasRunningRun(job.id)) continue

      const signature = buildTriggerSignature(job, snapshot)
      if (lastTriggerSignatureByJob.get(job.id) === signature) continue

      lastTriggerSignatureByJob.set(job.id, signature)
      await executeScheduledJob(job.id, {
        windowId: snapshot.windowId,
        activeTab: {
          id: snapshot.tabId,
          url: snapshot.url,
          title: snapshot.title,
        },
      })
    }
  }

  let runningMissedJobs = false

  // biome-ignore lint/complexity/noExcessiveCognitiveComplexity: TODO(dani) refactor to reduce complexity
  const runMissedJobs = async () => {
    if (runningMissedJobs) return
    runningMissedJobs = true

    try {
      const jobs = (await scheduledJobStorage.getValue()).filter(
        (j) => j.enabled && (j.triggerType ?? 'schedule') === 'schedule',
      )
      const runs = (await scheduledJobRunStorage.getValue()) ?? []
      const now = Date.now()
      const cutoff = now - TWENTY_FOUR_HOURS_MS

      for (const job of jobs) {
        const hasRecentRun = runs.some(
          (r) => r.jobId === job.id && new Date(r.startedAt).getTime() > cutoff,
        )
        if (hasRecentRun) continue

        const hasRunningRun = runs.some(
          (r) => r.jobId === job.id && r.status === 'running',
        )
        if (hasRunningRun) continue

        if (job.scheduleType === 'daily' && job.scheduleTime) {
          const [hours, minutes] = job.scheduleTime.split(':').map(Number)
          const scheduledToday = new Date()
          scheduledToday.setHours(hours, minutes, 0, 0)
          if (now < scheduledToday.getTime()) continue
        }

        if (
          (job.scheduleType === 'hourly' || job.scheduleType === 'minutes') &&
          job.scheduleInterval
        ) {
          const intervalMs =
            job.scheduleType === 'hourly'
              ? job.scheduleInterval * 60 * 60 * 1000
              : job.scheduleInterval * 60 * 1000
          const createdAt = new Date(job.createdAt).getTime()
          if (now - createdAt < intervalMs) continue
        }

        await executeScheduledJob(job.id)
      }
    } finally {
      runningMissedJobs = false
    }
  }

  chrome.alarms.onAlarm.addListener(async (alarm) => {
    if (!alarm.name.startsWith(ALARM_PREFIX)) return
    const jobId = alarm.name.replace(ALARM_PREFIX, '')
    await executeScheduledJob(jobId)
  })

  chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
    if (tabId == null) return
    if (!isHttpPage(tab.url)) return
    const becameReady = changeInfo.status === 'complete'
    const contentChanged =
      typeof changeInfo.url === 'string' || typeof changeInfo.title === 'string'

    if (!becameReady && !contentChanged) return
    await evaluateTriggeredJobsForTab(tab)
  })

  chrome.tabs.onActivated.addListener(async ({ tabId }) => {
    const tab = await chrome.tabs.get(tabId).catch(() => null)
    if (!tab) return
    await evaluateTriggeredJobsForTab(tab)
  })

  onScheduleMessage('runScheduledJob', async ({ data }) => {
    try {
      await executeScheduledJob(data.jobId)
      return { success: true }
    } catch (e) {
      return {
        success: false,
        error: e instanceof Error ? e.message : String(e),
      }
    }
  })

  onScheduleMessage('cancelScheduledJobRun', async ({ data }) => {
    const controller = runAbortControllers.get(data.runId)
    if (!controller) {
      return { success: false, error: 'Run not found or already completed' }
    }
    controller.abort()
    return { success: true }
  })

  scheduledJobStorage.watch(() => {
    void syncAlarmState()
  })

  chrome.runtime.onStartup.addListener(async () => {
    await cleanupStaleJobRuns()
    await syncAlarmState()
    await runMissedJobs()
  })

  chrome.runtime.onInstalled.addListener(async () => {
    await cleanupStaleJobRuns()
    await syncAlarmState()
    await runMissedJobs()
  })
}
