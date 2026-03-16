import { zValidator } from '@hono/zod-validator'
import { Hono } from 'hono'
import { z } from 'zod'
import { getDb } from '../../lib/db'
import { RunStore } from '../../lib/run-store'

const ListRunsQuerySchema = z.object({
  conversationId: z.string().uuid().optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
})

const RunIdParamSchema = z.object({
  runId: z.string().uuid(),
})

const ArtifactParamsSchema = z.object({
  runId: z.string().uuid(),
  artifactId: z.string().uuid(),
})

export function createRunsRoutes() {
  const runStore = new RunStore(getDb())

  return new Hono()
    .get('/', zValidator('query', ListRunsQuerySchema), async (c) => {
      const query = c.req.valid('query')
      const runs = runStore.listRuns({
        limit: query.limit,
        conversationId: query.conversationId,
      })
      return c.json({ runs })
    })
    .get('/:runId', zValidator('param', RunIdParamSchema), async (c) => {
      const { runId } = c.req.valid('param')
      const run = runStore.getRun(runId)
      if (!run) return c.json({ error: 'Run not found' }, 404)
      return c.json({ run })
    })
    .get('/:runId/timeline', zValidator('param', RunIdParamSchema), async (c) => {
      const { runId } = c.req.valid('param')
      const run = runStore.getRun(runId)
      if (!run) return c.json({ error: 'Run not found' }, 404)
      return c.json({
        run,
        events: runStore.getRunEvents(runId),
        checkpoints: runStore.getRunCheckpoints(runId),
      })
    })
    .get('/:runId/replay', zValidator('param', RunIdParamSchema), async (c) => {
      const { runId } = c.req.valid('param')
      const run = runStore.getRun(runId)
      if (!run) return c.json({ error: 'Run not found' }, 404)
      return c.json({
        run,
        events: runStore.getRunEvents(runId),
        checkpoints: runStore.getRunCheckpoints(runId),
        artifacts: runStore.getRunArtifacts(runId),
        contextPackets: runStore.getContextPackets({ runId, limit: 50 }),
        budgetStats: runStore.getBudgetStats(runId),
      })
    })
    .get('/:runId/events', zValidator('param', RunIdParamSchema), async (c) => {
      const { runId } = c.req.valid('param')
      return c.json({ events: runStore.getRunEvents(runId) })
    })
    .get(
      '/:runId/checkpoints',
      zValidator('param', RunIdParamSchema),
      async (c) => {
        const { runId } = c.req.valid('param')
        return c.json({ checkpoints: runStore.getRunCheckpoints(runId) })
      },
    )
    .get('/:runId/artifacts', zValidator('param', RunIdParamSchema), async (c) => {
      const { runId } = c.req.valid('param')
      return c.json({ artifacts: runStore.getRunArtifacts(runId) })
    })
    .get(
      '/:runId/artifacts/:artifactId',
      zValidator('param', ArtifactParamsSchema),
      async (c) => {
        const { runId, artifactId } = c.req.valid('param')
        const artifact = runStore
          .getRunArtifacts(runId)
          .find((item) => item.id === artifactId)
        if (!artifact) return c.json({ error: 'Artifact not found' }, 404)
        return new Response(Bun.file(artifact.filePath), {
          headers: {
            'Content-Type': artifact.mimeType ?? 'text/plain; charset=utf-8',
          },
        })
      },
    )
    .get('/:runId/context', zValidator('param', RunIdParamSchema), async (c) => {
      const { runId } = c.req.valid('param')
      return c.json({ contextPackets: runStore.getContextPackets({ runId, limit: 50 }) })
    })
    .get('/:runId/metrics', zValidator('param', RunIdParamSchema), async (c) => {
      const { runId } = c.req.valid('param')
      const run = runStore.getRun(runId)
      if (!run) return c.json({ error: 'Run not found' }, 404)
      return c.json({
        routingPolicy: run.routingPolicy,
        budgetStats: runStore.getBudgetStats(runId),
      })
    })
}
