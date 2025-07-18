// New consolidated session tools
export * from './SessionManagementTool';
export * from './SessionExecutionTool';

// Factory functions
import { SessionManagementTool } from './SessionManagementTool';
import { SessionExecutionTool } from './SessionExecutionTool';
import { ExecutionContext } from '@/lib/runtime/ExecutionContext';

export function createSessionManagementTool(executionContext: ExecutionContext) {
  return new SessionManagementTool(executionContext).getLangChainTool();
}

export function createSessionExecutionTool(executionContext: ExecutionContext) {
  return new SessionExecutionTool(executionContext).getLangChainTool();
} 