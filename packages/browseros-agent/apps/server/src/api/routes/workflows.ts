import {
  CreateWorkflowRunSchema,
  UpdateWorkflowRunSchema,
  UpsertWorkflowDefinitionSchema,
} from '@browseros/shared/schemas/automation'
import { zValidator } from '@hono/zod-validator'
import { Hono } from 'hono'
import { z } from 'zod'
import { getDb } from '../../lib/db'
import { AutomationStore } from '../../lib/automation-store'

const WorkflowIdParamSchema = z.object({
  workflowId: z.string().uuid(),
})

const WorkflowRunIdParamSchema = z.object({
  workflowRunId: z.string().uuid(),
})

const LegacyWorkflowIdParamSchema = z.object({
  legacyWorkflowId: z.string().min(1),
})

export function createWorkflowRoutes() {
  const automationStore = new AutomationStore(getDb())

  return new Hono()
    .get('/', (c) => {
      return c.json({ workflows: automationStore.listWorkflowDefinitions() })
    })
    .post('/', zValidator('json', UpsertWorkflowDefinitionSchema), (c) => {
      const workflow = automationStore.upsertWorkflowDefinition(
        c.req.valid('json'),
      )
      return c.json({ workflow })
    })
    .get(
      '/:workflowId',
      zValidator('param', WorkflowIdParamSchema),
      (c) => {
        const { workflowId } = c.req.valid('param')
        const workflow = automationStore.getWorkflowDefinition(workflowId)
        if (!workflow) return c.json({ error: 'Workflow not found' }, 404)

        return c.json({
          workflow,
          runs: automationStore.listWorkflowRuns(workflowId),
        })
      },
    )
    .put(
      '/:workflowId',
      zValidator('param', WorkflowIdParamSchema),
      zValidator('json', UpsertWorkflowDefinitionSchema.omit({ id: true })),
      (c) => {
        const { workflowId } = c.req.valid('param')
        const workflow = automationStore.upsertWorkflowDefinition({
          ...c.req.valid('json'),
          id: workflowId,
        })
        return c.json({ workflow })
      },
    )
    .delete(
      '/:workflowId',
      zValidator('param', WorkflowIdParamSchema),
      (c) => {
        const { workflowId } = c.req.valid('param')
        const deleted = automationStore.deleteWorkflowDefinition(workflowId)
        if (!deleted) return c.json({ error: 'Workflow not found' }, 404)
        return c.json({ success: true })
      },
    )
    .delete(
      '/legacy/:legacyWorkflowId',
      zValidator('param', LegacyWorkflowIdParamSchema),
      (c) => {
        const { legacyWorkflowId } = c.req.valid('param')
        const deleted =
          automationStore.deleteWorkflowDefinitionByLegacyId(legacyWorkflowId)
        if (!deleted) return c.json({ error: 'Workflow not found' }, 404)
        return c.json({ success: true })
      },
    )
    .get(
      '/:workflowId/runs',
      zValidator('param', WorkflowIdParamSchema),
      (c) => {
        const { workflowId } = c.req.valid('param')
        return c.json({ runs: automationStore.listWorkflowRuns(workflowId) })
      },
    )
    .post(
      '/:workflowId/runs',
      zValidator('param', WorkflowIdParamSchema),
      zValidator('json', CreateWorkflowRunSchema),
      (c) => {
        const { workflowId } = c.req.valid('param')
        const workflow = automationStore.getWorkflowDefinition(workflowId)
        if (!workflow) return c.json({ error: 'Workflow not found' }, 404)

        const run = automationStore.createWorkflowRun(
          workflowId,
          c.req.valid('json'),
        )
        return c.json({ run })
      },
    )
    .get(
      '/runs/:workflowRunId',
      zValidator('param', WorkflowRunIdParamSchema),
      (c) => {
        const { workflowRunId } = c.req.valid('param')
        const run = automationStore.getWorkflowRun(workflowRunId)
        if (!run) return c.json({ error: 'Workflow run not found' }, 404)
        return c.json({ run })
      },
    )
    .put(
      '/runs/:workflowRunId',
      zValidator('param', WorkflowRunIdParamSchema),
      zValidator('json', UpdateWorkflowRunSchema),
      (c) => {
        const { workflowRunId } = c.req.valid('param')
        const run = automationStore.updateWorkflowRun(
          workflowRunId,
          c.req.valid('json'),
        )
        if (!run) return c.json({ error: 'Workflow run not found' }, 404)
        return c.json({ run })
      },
    )
}
