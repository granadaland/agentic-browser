/**
 * @license
 * Copyright 2025 BrowserOS
 */

import { describe, expect, it } from 'bun:test'
import type { WorkflowGraph } from '@browseros/shared/schemas/automation'
import {
  buildLocalWorkflowIR,
  canExecuteWorkflowGraphLocally,
} from '../../src/graph/local-ir-executor'

describe('local workflow IR executor', () => {
  it('builds a supported linear IR for simple graphs', () => {
    const graph: WorkflowGraph = {
      nodes: [
        { id: 'start', type: 'start', data: { label: 'Start' } },
        { id: 'nav', type: 'nav', data: { label: 'Open browseros.ai' } },
        { id: 'act', type: 'act', data: { label: 'Click sign in' } },
        { id: 'verify', type: 'verify', data: { label: 'Confirm page loaded' } },
        { id: 'end', type: 'end', data: { label: 'Done' } },
      ],
      edges: [
        { id: 'e1', source: 'start', target: 'nav' },
        { id: 'e2', source: 'nav', target: 'act' },
        { id: 'e3', source: 'act', target: 'verify' },
        { id: 'e4', source: 'verify', target: 'end' },
      ],
    }

    const ir = buildLocalWorkflowIR(graph)

    expect(ir.supported).toBe(true)
    expect(ir.steps).toEqual([
      { id: 'nav', type: 'nav', label: 'Open browseros.ai' },
      { id: 'act', type: 'act', label: 'Click sign in' },
      { id: 'verify', type: 'verify', label: 'Confirm page loaded' },
    ])
    expect(canExecuteWorkflowGraphLocally(graph)).toEqual({
      supported: true,
      reason: undefined,
    })
  })

  it('rejects branching graphs for the local executor', () => {
    const graph: WorkflowGraph = {
      nodes: [
        { id: 'start', type: 'start', data: { label: 'Start' } },
        { id: 'act', type: 'act', data: { label: 'Collect data' } },
        { id: 'verify-a', type: 'verify', data: { label: 'Verify A' } },
        { id: 'verify-b', type: 'verify', data: { label: 'Verify B' } },
        { id: 'end', type: 'end', data: { label: 'Done' } },
      ],
      edges: [
        { id: 'e1', source: 'start', target: 'act' },
        { id: 'e2', source: 'act', target: 'verify-a' },
        { id: 'e3', source: 'act', target: 'verify-b' },
        { id: 'e4', source: 'verify-a', target: 'end' },
        { id: 'e5', source: 'verify-b', target: 'end' },
      ],
    }

    const ir = buildLocalWorkflowIR(graph)

    expect(ir.supported).toBe(false)
    expect(ir.reason).toContain('branches to multiple paths')
    expect(canExecuteWorkflowGraphLocally(graph)).toEqual({
      supported: false,
      reason: ir.reason,
    })
  })
})
