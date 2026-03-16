import {
  UpsertWatcherDefinitionSchema,
  UpsertWatcherRunSchema,
} from '@browseros/shared/schemas/automation'
import { zValidator } from '@hono/zod-validator'
import { Hono } from 'hono'
import { z } from 'zod'
import { AutomationStore } from '../../lib/automation-store'
import { getDb } from '../../lib/db'

const WatcherIdParamSchema = z.object({
  watcherId: z.string().uuid(),
})

const LegacyWatcherIdParamSchema = z.object({
  legacyJobId: z.string().min(1),
})

const WatcherRunIdParamSchema = z.object({
  watcherRunId: z.string().uuid(),
})

export function createWatcherRoutes() {
  const automationStore = new AutomationStore(getDb())

  return new Hono()
    .get('/', (c) => {
      return c.json({ watchers: automationStore.listWatchers() })
    })
    .post('/', zValidator('json', UpsertWatcherDefinitionSchema), (c) => {
      const watcher = automationStore.upsertWatcher(c.req.valid('json'))
      return c.json({ watcher })
    })
    .get('/:watcherId', zValidator('param', WatcherIdParamSchema), (c) => {
      const { watcherId } = c.req.valid('param')
      const watcher = automationStore.getWatcher(watcherId)
      if (!watcher) return c.json({ error: 'Watcher not found' }, 404)
      return c.json({
        watcher,
        runs: automationStore.listWatcherRuns(watcherId),
      })
    })
    .put(
      '/:watcherId',
      zValidator('param', WatcherIdParamSchema),
      zValidator('json', UpsertWatcherDefinitionSchema.omit({ id: true })),
      (c) => {
        const { watcherId } = c.req.valid('param')
        const watcher = automationStore.upsertWatcher({
          ...c.req.valid('json'),
          id: watcherId,
        })
        return c.json({ watcher })
      },
    )
    .delete('/:watcherId', zValidator('param', WatcherIdParamSchema), (c) => {
      const { watcherId } = c.req.valid('param')
      const deleted = automationStore.deleteWatcher(watcherId)
      if (!deleted) return c.json({ error: 'Watcher not found' }, 404)
      return c.json({ success: true })
    })
    .delete(
      '/legacy/:legacyJobId',
      zValidator('param', LegacyWatcherIdParamSchema),
      (c) => {
        const { legacyJobId } = c.req.valid('param')
        const deleted = automationStore.deleteWatcherByLegacyId(legacyJobId)
        if (!deleted) return c.json({ error: 'Watcher not found' }, 404)
        return c.json({ success: true })
      },
    )
    .get('/:watcherId/runs', zValidator('param', WatcherIdParamSchema), (c) => {
      const { watcherId } = c.req.valid('param')
      return c.json({ runs: automationStore.listWatcherRuns(watcherId) })
    })
    .post('/runs', zValidator('json', UpsertWatcherRunSchema), (c) => {
      const input = c.req.valid('json')
      const watcher = automationStore.getWatcher(input.watcherId)
      if (!watcher) return c.json({ error: 'Watcher not found' }, 404)

      const run = automationStore.upsertWatcherRun(input)
      return c.json({ run })
    })
    .get('/runs/:watcherRunId', zValidator('param', WatcherRunIdParamSchema), (c) => {
      const { watcherRunId } = c.req.valid('param')
      const run = automationStore.getWatcherRun(watcherRunId)
      if (!run) return c.json({ error: 'Watcher run not found' }, 404)
      return c.json({ run })
    })
}
