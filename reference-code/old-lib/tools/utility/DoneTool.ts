import { z } from 'zod';
import { NxtscapeTool } from '../base/NxtscapeTool';
import { ToolConfig } from '../base/ToolConfig';
import { ExecutionContext } from '@/lib/runtime/ExecutionContext';

/**
 * Schema for done tool input
 */
export const DoneInputSchema = z.object({
  success: z.boolean(),  // Whether the task was completed successfully
  text: z.string().optional(),  // Optional description of what was accomplished or why it failed
  extractedContent: z.string().optional()  // Optional extracted content from the page
});

export type DoneInput = z.infer<typeof DoneInputSchema>;

/**
 * Schema for done tool output
 */
export const DoneOutputSchema = z.object({
  success: z.boolean(),  // Whether the task was completed successfully
  status: z.enum(['SUCCESS', 'FAILED']),  // Task completion status
  message: z.string(),  // Human-readable message
  text: z.string().optional(),  // The provided completion text
  extractedContent: z.string().optional(),  // Optional extracted content
  isDone: z.literal(true)  // Always true to indicate completion
});

export type DoneOutput = z.infer<typeof DoneOutputSchema>;

/**
 * Tool for marking task completion
 */
export class DoneTool extends NxtscapeTool<DoneInput, DoneOutput> {
  constructor(executionContext: ExecutionContext) {
    const config: ToolConfig<DoneInput, DoneOutput> = {
      name: 'done',
      description: 'Complete ALL assigned work. Use this ONLY when you have finished ALL steps given to you, not after individual steps. For step progress, use todo_list_manager instead. Always pass success (true if all steps completed, false if stuck) and text (BRIEF final result, no explanations).',
      category: 'control',
      version: '1.0.0',
      inputSchema: DoneInputSchema,
      outputSchema: DoneOutputSchema,
      examples: [
        {
          description: 'All steps completed successfully',
          input: { 
            success: true, 
            text: 'Logged in successfully'
          },
          output: {
            success: true,
            status: 'SUCCESS',
            message: 'Task completed successfully',
            text: 'Logged in successfully',
            isDone: true
          }
        },
        {
          description: 'Stuck or failed',
          input: { 
            success: false, 
            text: 'Login button not found'
          },
          output: {
            success: false,
            status: 'FAILED',
            message: 'Task failed',
            text: 'Login button not found',
            isDone: true
          }
        }
      ],
      streamingConfig: {
        displayName: 'Done',
        icon: '✅',
        progressMessage: 'Completing task...'
      }
    };

    super(config, executionContext);
  }

  /**
   * Override: Generate contextual display message
   */
  getProgressMessage(args: DoneInput): string {
    try {
      // Note: args should already be parsed by StreamEventProcessor

      const success = args?.success;
      return success ? 'Marking task as completed' : 'Marking task as failed';
    } catch {
      return 'Completing task...';
    }
  }

  /**
   * Override: Format done result for display
   * Returns clear task completion status
   */
  FormatResultForUI(output: DoneOutput): string {
    if (output.success) {
      return output.text
        ? `✅ Task completed: ${output.text}`
        : '✅ Task completed';
    } else {
      return output.text
        ? `❌ Task failed: ${output.text}`
        : '❌ Task failed';
    }
  }

  protected async execute(input: DoneInput): Promise<DoneOutput> {
    const status = input.success ? 'SUCCESS' : 'FAILED';
    const message = input.success ? 'Task completed successfully' : 'Task failed';
    
    return {
      success: input.success,
      status,
      message,
      text: input.text,
      extractedContent: input.extractedContent,
      isDone: true
    };
  }
} 
