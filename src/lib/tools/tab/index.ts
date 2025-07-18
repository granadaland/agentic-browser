// New consolidated tab operations tool
export * from './TabOperationsTool';
export * from './GroupTabsTool';

export { GetSelectedTabsTool, GetSelectedTabsInputSchema, GetSelectedTabsOutputSchema } from './GetSelectedTabsTool';
export type { GetSelectedTabsInput, GetSelectedTabsOutput } from './GetSelectedTabsTool';

// Factory functions
import { ExecutionContext } from '@/lib/runtime/ExecutionContext';
import { TabOperationsTool } from './TabOperationsTool';
import { GroupTabsTool } from './GroupTabsTool';
import { GetSelectedTabsTool } from './GetSelectedTabsTool';

// New factory functions
export function createTabOperationsTool(executionContext: ExecutionContext) {
  return new TabOperationsTool(executionContext).getLangChainTool();
}

export function createGroupTabsTool(executionContext: ExecutionContext) {
  return new GroupTabsTool(executionContext).getLangChainTool();
}

export function createGetSelectedTabsTool(executionContext: ExecutionContext) {
  return new GetSelectedTabsTool(executionContext).getLangChainTool();
} 