import { z } from 'zod';
import { NxtscapeTool } from '../base/NxtscapeTool';
import { ToolConfig } from '../base/ToolConfig';
import { ExecutionContext } from '@/lib/runtime/ExecutionContext';

/**
 * Schema for terminate tool input
 */
export const TerminateInputSchema = z.object({
  success: z.boolean(),  // Whether the task was completed successfully
  reason: z.string().optional()  // Optional reason for termination
});

export type TerminateInput = z.infer<typeof TerminateInputSchema>;

/**
 * Schema for terminate tool output
 */
export const TerminateOutputSchema = z.object({
  success: z.boolean(),  // Whether the task was completed successfully
  action: z.literal('terminate'),  // Always "terminate"
  status: z.enum(['SUCCESS', 'FAILED']),  // Task completion status
  reason: z.string().optional(),  // The reason provided (if any)
  message: z.string()  // Human-readable message
});

export type TerminateOutput = z.infer<typeof TerminateOutputSchema>;

/**
 * Tool for terminating agent execution
 */
export class TerminateTool extends NxtscapeTool<TerminateInput, TerminateOutput> {
  constructor(executionContext: ExecutionContext) {
    const config: ToolConfig<TerminateInput, TerminateOutput> = {
      name: 'terminate',
      description: 'Terminate the current task. Use this when the task is complete (success: true) or when you cannot proceed further (success: false). Always provide a reason.',
      category: 'control',
      version: '1.0.0',
      inputSchema: TerminateInputSchema,
      outputSchema: TerminateOutputSchema,
      examples: [
        {
          description: 'Terminate with success',
          input: { success: true, reason: 'Task completed successfully' },
          output: {
            success: true,
            action: 'terminate',
            status: 'SUCCESS',
            reason: 'Task completed successfully',
            message: 'TASK SUCCESS - Task completed successfully'
          }
        },
        {
          description: 'Terminate with failure',
          input: { success: false, reason: 'Unable to find the required element' },
          output: {
            success: false,
            action: 'terminate',
            status: 'FAILED',
            reason: 'Unable to find the required element',
            message: 'TASK FAILED - Unable to find the required element'
          }
        }
      ],
      streamingConfig: {
        displayName: 'Terminate',
        icon: '🏁',
        progressMessage: 'Terminating task...'
      }
    };

    super(config, executionContext);
  }

  /**
   * Override: Format termination result for display
   * Returns clear task completion status
   */
  FormatResultForUI(output: TerminateOutput): string {
    if (output.status === 'SUCCESS') {
      return `🏁 Task completed successfully${output.reason ? ` - ${output.reason}` : ''}`;
    } else {
      return `💥 Task failed${output.reason ? ` - ${output.reason}` : ''}`;
    }
  }

  /**
   * Generate contextual progress message for termination
   * @param args - Tool arguments
   * @returns Progress message
   */
  getProgressMessage(args: TerminateInput): string {
    return args.success ? 'Terminating task successfully...' : 'Terminating task with failure...';
  }

  protected async execute(input: TerminateInput): Promise<TerminateOutput> {
    const status = input.success ? 'SUCCESS' : 'FAILED';
    const reasonMessage = input.reason ? ` - ${input.reason}` : '';
    
    return {
      success: input.success,
      action: 'terminate',
      status,
      reason: input.reason,
      message: `TASK ${status}${reasonMessage}`
    };
  }
} 
