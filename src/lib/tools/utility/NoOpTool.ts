import { z } from 'zod';
import { NxtscapeTool } from '../base/NxtscapeTool';
import { ToolConfig } from '../base/ToolConfig';
import { ExecutionContext } from '@/lib/runtime/ExecutionContext';

/**
 * Schema for no-op tool input
 */
export const NoOpInputSchema = z.object({
  reason: z.string().optional()  // Optional reason for skipping the action
});

export type NoOpInput = z.infer<typeof NoOpInputSchema>;

/**
 * Schema for no-op tool output
 */
export const NoOpOutputSchema = z.object({
  success: z.boolean(),  // Always true for no-op
  action: z.literal('skipped'),  // Always "skipped"
  reason: z.string().optional(),  // The reason provided (if any)
  message: z.string()  // Human-readable message
});

export type NoOpOutput = z.infer<typeof NoOpOutputSchema>;

/**
 * Tool for skipping unnecessary actions
 */
export class NoOpTool extends NxtscapeTool<NoOpInput, NoOpOutput> {
  constructor(executionContext: ExecutionContext) {
    const config: ToolConfig<NoOpInput, NoOpOutput> = {
      name: 'noop',
      description: 'Skip an action when it is unnecessary, redundant, or already completed. Use this when an instruction does not require any action.',
      category: 'control',
      version: '1.0.0',
      inputSchema: NoOpInputSchema,
      outputSchema: NoOpOutputSchema,
      examples: [
        {
          description: 'Skip an action without a reason',
          input: {},
          output: {
            success: true,
            action: 'skipped',
            message: 'Action skipped (no operation performed).'
          }
        },
        {
          description: 'Skip an action with a reason',
          input: { reason: 'Page is already loaded' },
          output: {
            success: true,
            action: 'skipped',
            reason: 'Page is already loaded',
            message: 'Action skipped (no operation performed). Reason: Page is already loaded'
          }
        }
      ],
      streamingConfig: {
        displayName: 'No Operation',
        icon: '⏭️',
        progressMessage: 'Skipping action...'
      }
    };

    super(config, executionContext);
  }

  /**
   * Override: Format no-op result for display
   * Returns clear action skip information
   */
  FormatResultForUI(output: NoOpOutput): string {
    if (output.reason) {
      return `⏭️ Skipped action - ${output.reason}`;
    }
    
    return `⏭️ Skipped unnecessary action`;
  }

  /**
   * Generate contextual progress message for no-op
   * @param args - Tool arguments
   * @returns Progress message
   */
  getProgressMessage(args: NoOpInput): string {
    return args.reason ? `Skipping action: ${args.reason}` : 'Skipping unnecessary action...';
  }

  protected async execute(input: NoOpInput): Promise<NoOpOutput> {
    const reasonMessage = input.reason ? ` Reason: ${input.reason}` : '';
    
    return {
      success: true,
      action: 'skipped',
      reason: input.reason,
      message: `Action skipped (no operation performed).${reasonMessage}`
    };
  }
} 
