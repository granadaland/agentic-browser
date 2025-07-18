import { z } from 'zod';
import { NxtscapeTool } from '../base/NxtscapeTool';
import { ToolConfig } from '../base/ToolConfig';
import { ExecutionContext } from '@/lib/runtime/ExecutionContext';

/**
 * Schema for wait tool input
 */
export const WaitInputSchema = z.object({
  seconds: z.number().min(0.5).max(10),  // Seconds to wait (0.5-10)
  reason: z.string().optional()  // Optional reason for waiting
});

export type WaitInput = z.infer<typeof WaitInputSchema>;

/**
 * Schema for wait tool output
 */
export const WaitOutputSchema = z.object({
  success: z.boolean(),  // Always true unless there's an error
  message: z.string(),  // Human-readable message
  secondsWaited: z.number(),  // Actual seconds waited
  reason: z.string().optional()  // The provided reason
});

export type WaitOutput = z.infer<typeof WaitOutputSchema>;

/**
 * Tool for waiting/pausing execution
 */
export class WaitTool extends NxtscapeTool<WaitInput, WaitOutput> {
  constructor(executionContext: ExecutionContext) {
    const config: ToolConfig<WaitInput, WaitOutput> = {
      name: 'wait',
      description: 'Wait for a specified number of seconds. Use this when you need to wait for page content to load, animations to complete, or between actions. Pass seconds (0.5-10) and optionally a reason for waiting.',
      category: 'control',
      version: '1.0.0',
      inputSchema: WaitInputSchema,
      outputSchema: WaitOutputSchema,
      examples: [
        {
          description: 'Wait for page to load',
          input: { 
            seconds: 1,
            reason: 'Waiting for page content to fully load'
          },
          output: {
            success: true,
            message: 'Waited 1 second',
            secondsWaited: 1,
            reason: 'Waiting for page content to fully load'
          }
        },
        {
          description: 'Quick wait between actions',
          input: { 
            seconds: 0.5,
            reason: 'Brief pause before clicking next button'
          },
          output: {
            success: true,
            message: 'Waited 0.5 seconds',
            secondsWaited: 0.5,
            reason: 'Brief pause before clicking next button'
          }
        },
        {
          description: 'Wait without reason',
          input: { 
            seconds: 3
          },
          output: {
            success: true,
            message: 'Waited 3 seconds',
            secondsWaited: 3
          }
        }
      ],
      streamingConfig: {
        displayName: 'Wait',
        icon: '⏱️',
        progressMessage: 'Waiting...'
      }
    };

    super(config, executionContext);
  }

  /**
   * Override: Generate contextual display message
   */
  getProgressMessage(args: WaitInput): string {
    try {
      // Note: args should already be parsed by StreamEventProcessor

      const seconds = args?.seconds || 1;
      const reason = args?.reason;

      if (reason) {
        return `${reason} (${seconds}s)`;
      }
      return `Waiting ${seconds} seconds`;
    } catch {
      return 'Waiting...';
    }
  }

  /**
   * Override: Format wait result for display
   */
  FormatResultForUI(output: WaitOutput): string {
    if (!output.success) {
      return `❌ ${output.message}`;
    }

    if (output.reason) {
      return `⏱️ Waited ${output.secondsWaited}s - ${output.reason}`;
    }
    return `⏱️ Waited ${output.secondsWaited} seconds`;
  }

  protected async execute(input: WaitInput): Promise<WaitOutput> {
    const seconds = input.seconds || 1;
    
    try {
      // Validate wait time
      if (seconds < 0.5 || seconds > 10) {
        return {
          success: false,
          message: `Wait time must be between 0.5 and 10 seconds (got ${seconds})`,
          secondsWaited: 0
        };
      }

      // Perform the wait
      await new Promise(resolve => setTimeout(resolve, seconds * 1000));
      
      return {
        success: true,
        message: `Waited ${seconds} seconds`,
        secondsWaited: seconds,
        reason: input.reason
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        success: false,
        message: `Wait failed: ${errorMessage}`,
        secondsWaited: 0
      };
    }
  }
} 
