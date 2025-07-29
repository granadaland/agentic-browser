import { z } from 'zod';
import { NxtscapeTool } from '../base/NxtscapeTool';
import { ToolConfig } from '../base/ToolConfig';
import { ExecutionContext } from '@/lib/runtime/ExecutionContext';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import { Logging } from '@/lib/utils/Logging';
import { withFlexibleStructuredOutput } from '@/lib/llm/utils/structuredOutput';

/**
 * Schema for todo list manager tool input
 */
export const TodoListManagerInputSchema = z.object({
  completedStep: z.string().describe('Description of the step that was just completed or skipped'),
  status: z.enum(['completed', 'skipped', 'failed']).describe('Status of the completed step'),
  reason: z.string().optional().describe('Optional reason for skipping or failing the step')
});

export type TodoListManagerInput = z.infer<typeof TodoListManagerInputSchema>;

/**
 * Schema for todo list manager tool output
 */
export const TodoListManagerOutputSchema = z.object({
  success: z.boolean(),  // Whether the plan was successfully updated
  updatedPlan: z.array(z.string()),  // The updated plan with checkboxes
  message: z.string()  // Human-readable status message
});

export type TodoListManagerOutput = z.infer<typeof TodoListManagerOutputSchema>;

/**
 * Tool for managing todo list (plan) progress using LLM to mark completed steps
 */
export class TodoListManagerTool extends NxtscapeTool<TodoListManagerInput, TodoListManagerOutput> {
  constructor(executionContext: ExecutionContext) {
    const config: ToolConfig<TodoListManagerInput, TodoListManagerOutput> = {
      name: 'todo_list_manager',
      description: 'Manage the todo list (plan) by marking steps as completed, skipped, or failed. Uses LLM to intelligently update the plan based on what was completed. Can update multiple related steps at once.',
      category: 'control',
      version: '1.0.0',
      inputSchema: TodoListManagerInputSchema,
      outputSchema: TodoListManagerOutputSchema,
      examples: [
        {
          description: 'Mark a step as completed',
          input: {
            completedStep: 'Navigate to example.com',
            status: 'completed'
          },
          output: {
            success: true,
            updatedPlan: [
              '- [x] Navigate to example.com',
              '- [ ] Click on the login button',
              '- [ ] Enter username and password'
            ],
            message: 'Plan updated: marked step as completed'
          }
        },
        {
          description: 'Mark a step as skipped with reason',
          input: {
            completedStep: 'Click accept cookies button',
            status: 'skipped',
            reason: 'No cookie banner appeared on the page'
          },
          output: {
            success: true,
            updatedPlan: [
              '- [x] Navigate to example.com',
              '- [~] Click accept cookies button (skipped: No cookie banner appeared)',
              '- [ ] Click on the login button'
            ],
            message: 'Plan updated: marked step as skipped'
          }
        },
        {
          description: 'Mark multiple related steps as completed',
          input: {
            completedStep: 'Successfully navigated to the website and logged in with credentials',
            status: 'completed'
          },
          output: {
            success: true,
            updatedPlan: [
              '- [x] Navigate to example.com',
              '- [x] Click on the login button',
              '- [x] Enter username and password',
              '- [ ] Submit the form'
            ],
            message: 'Plan updated: marked multiple steps as completed'
          }
        }
      ],
      streamingConfig: {
        displayName: 'Todo List Manager',
        icon: '✅',
        progressMessage: 'Updating plan progress...'
      }
    };

    super(config, executionContext);
  }

  /**
   * Override: Generate contextual display message based on arguments
   */
  getProgressMessage(args: TodoListManagerInput): string {
    try {
      // Note: args should already be parsed by StreamEventProcessor

      const status = args?.status;
      const step = args?.completedStep;

      if (status === 'completed' && step) {
        return `Marking completed: "${step}"`;
      } else if (status === 'skipped' && step) {
        return `Marking skipped: "${step}"`;
      } else if (status === 'failed' && step) {
        return `Marking failed: "${step}"`;
      }

      return 'Updating plan progress...';
    } catch {
      return 'Updating plan progress...';
    }
  }

  /**
   * Override: Format result for display
   */
  FormatResultForUI(output: TodoListManagerOutput): string {
    if (!output.success) {
      return `❌ ${output.message}`;
    }
    
    // Calculate stats
    const completedCount = output.updatedPlan.filter(step => step.includes('[x]')).length;
    const skippedCount = output.updatedPlan.filter(step => step.includes('[~]')).length;
    const failedCount = output.updatedPlan.filter(step => step.includes('[!]')).length;
    const totalCount = output.updatedPlan.length;
    const pendingCount = totalCount - completedCount - skippedCount - failedCount;
    
    // Build the display
    let display = `📋 Todo List (${completedCount}/${totalCount} completed`;
    if (skippedCount > 0) display += `, ${skippedCount} skipped`;
    if (failedCount > 0) display += `, ${failedCount} failed`;
    display += `):\n`;
    
    // Add the todo list items
    display += output.updatedPlan.join('\n');
    
    return display;
  }

  protected async execute(input: TodoListManagerInput): Promise<TodoListManagerOutput> {
    try {
      // Get the current plan from message history
      const currentPlan = this.executionContext.messageManager.getPreviousPlan();
      
      if (!currentPlan || currentPlan.length === 0) {
        return {
          success: false,
          updatedPlan: [],
          message: 'No plan found to update'
        };
      }

      // Use LLM to update the plan based on the completed step
      const updatedPlan = await this.updatePlanWithLLM(
        currentPlan,
        input.completedStep,
        input.status,
        input.reason
      );

      // Update the plan in the message manager
      this.executionContext.messageManager.updatePlanMessage(updatedPlan);

      return {
        success: true,
        updatedPlan: updatedPlan,
        message: `Plan updated: marked step(s) as ${input.status}`
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      return {
        success: false,
        updatedPlan: [],
        message: `Failed to update plan: ${errorMessage}`
      };
    }
  }

  /**
   * Update plan using LLM with structured output
   */
  private async updatePlanWithLLM(
    currentPlan: string[],
    completedStep: string,
    status: 'completed' | 'skipped' | 'failed',
    reason?: string
  ): Promise<string[]> {
    // Get LLM with low temperature for consistency
    const llm = await this.getLLM({ temperature: 0.1 });

    // Define the output schema
    const updatePlanSchema = z.object({
      updatedPlan: z.array(z.string()).describe('The updated plan with checkbox markers'),
      reasoning: z.string().describe('Brief explanation of which steps were matched and updated')
    });

    // Create LLM with structured output using flexible schema handling
    const structuredLLM = await withFlexibleStructuredOutput(llm, updatePlanSchema);

    // Build system prompt
    const systemPrompt = `You are an expert at tracking task progress. Your job is to update a plan by marking steps as completed, skipped, or failed.

**PLAN FORMAT:**
- Uncompleted steps: "- [ ] Step description"
- Completed steps: "- [x] Step description"
- Skipped steps: "- [~] Step description (skipped: reason)"
- Failed steps: "- [!] Step description (failed: reason)"

**YOUR TASK:**
1. Find the step(s) in the plan that match the completed step description
2. Update the matching step(s) with the appropriate marker
3. Keep all other steps unchanged
4. If a reason is provided for skipped/failed steps, append it in parentheses

**IMPORTANT RULES:**
- Match steps based on semantic meaning, not exact text match
- You may update MULTIPLE steps if the completion logically applies to several steps
- For example: "Navigated to the site and logged in" could mark both navigation and login steps as complete
- Preserve the exact text of all other steps
- Maintain the original order of steps
- If the step description doesn't match any plan step, return the plan unchanged`;

    // Build user prompt
    const statusMarkers = {
      'completed': '[x]',
      'skipped': '[~]',
      'failed': '[!]'
    };

    let userPrompt = `Current plan:\n`;
    currentPlan.forEach((step, index) => {
      userPrompt += `${index + 1}. ${step}\n`;
    });
    
    userPrompt += `\nCompleted step: "${completedStep}"\n`;
    userPrompt += `Status: ${status}\n`;
    
    if (reason) {
      userPrompt += `Reason: ${reason}\n`;
    }
    
    userPrompt += `\nPlease update the plan by marking the matching step(s) as ${status} with ${statusMarkers[status]}. You may update multiple steps if they are logically related to the completed action.`;

    try {
      // Get structured response from LLM
      const result = await structuredLLM.invoke([
        new SystemMessage(systemPrompt),
        new HumanMessage(userPrompt)
      ]);

      Logging.log('TodoListManagerTool', `Updated plan: ${result.reasoning}`);

      return result.updatedPlan;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error(`LLM update failed: ${errorMessage}`);
    }
  }
}
