import { BaseAgent, AgentOptions, AgentInput } from './BaseAgent';
import { ToolRegistry } from '@/lib/tools/base/ToolRegistry';
import { RunnableConfig } from '@langchain/core/runnables';
import { z } from 'zod';
import { HumanMessage, SystemMessage, BaseMessage } from '@langchain/core/messages';
import { PlannerToolPrompt } from '@/lib/prompts/PlannerToolPrompt';
import { withFlexibleStructuredOutput } from '@/lib/llm/utils/structuredOutput';
import { profileStart, profileEnd, profileAsync } from '@/lib/utils/Profiler';

// Planner output schema
export const PlannerOutputSchema = z.object({
  plan: z.array(z.string()),  // Array of next steps to take
  reasoning: z.string(),  // Reasoning behind the plan
  complexity: z.enum(['low', 'medium', 'high']),  // Task complexity assessment
  estimated_steps: z.number(),  // Estimated number of steps
  requires_interaction: z.boolean(),  // Whether this requires browser interaction
  confidence: z.enum(['high', 'medium', 'low'])  // Confidence in the plan
});

export type PlannerOutput = z.infer<typeof PlannerOutputSchema>;

/**
 * Agent specialized for planning web automation tasks.
 * Uses LLM reasoning to analyze tasks and create structured plans.
 */
export class PlannerAgent extends BaseAgent {
  private promptGenerator!: PlannerToolPrompt;
  
  /**
   * Get the agent name for logging
   */
  protected getAgentName(): string {
    return 'PlannerAgent';
  }
  
  /**
   * Create tool registry - PlannerAgent doesn't use tools
   */
  protected createToolRegistry(): ToolRegistry {
    return new ToolRegistry();  // Empty registry - no tools needed
  }
  
  /**
   * Get the default system prompt for planning
   */
  protected generateSystemPrompt(): string {
    // Use the prompt generator to create the system prompt
    return this.promptGenerator.generateSystemPrompt(5);  // Default to 5 steps
  }
  
  /**
   * Get the system prompt for follow-up planning
   */
  protected generateFollowUpSystemPrompt(): string {
    // Use the prompt generator to create the follow-up system prompt
    return this.promptGenerator.generateSystemPrompt(5, true);  // Default to 5 steps with follow-up context
  }
  
  
  /**
   * Initialize the agent - called once before first execute
   */
  public async initialize(): Promise<void> {
    await profileAsync('PlannerAgent.initialize', async () => {
      // Initialize prompt generator BEFORE calling parent
      this.promptGenerator = new PlannerToolPrompt();
      
      // Now parent can safely call generateSystemPrompt()
      await super.initialize();
    });
  }

  /**
   * Execute planning using the planner tool - handles instruction enhancement and execution
   * @param input - Agent input containing instruction and context
   * @param callbacks - Optional streaming callbacks
   * @param config - Optional configuration for LangGraph web compatibility
   * @returns Promise resolving to planner output
   */
  protected async executeAgent(
    input: AgentInput,
    config?: RunnableConfig
  ): Promise<PlannerOutput> {
    profileStart('PlannerAgent.executeAgent');
    const startTime = Date.now();
    
    try {
      await this.ensureInitialized();
    
    // Detect if this is a follow-up task
    const isFollowUp = input.context?.previousPlan !== undefined && 
                      input.context.previousPlan !== null;
    
    // Debug: Log planning context
    this.log('📋 Planning context', 'info', {
      task: input.instruction,
      isFollowUp,
      hasValidationFeedback: !!input.context?.validationResult,
      previousPlanLength: (input.context?.previousPlan as string[])?.length || 0
    });
    
    // Generate system prompt based on follow-up status
    const systemPrompt = isFollowUp ? 
      this.generateFollowUpSystemPrompt() : 
      this.generateSystemPrompt();
    
    // 1. Add system prompt to message history at position 0 (agent-specific)
    this.executionContext.messageManager.addSystemMessage(systemPrompt, 0);
    this.systemPromptAdded = true;
    
    // Enhance instruction with browser context
    profileStart('PlannerAgent.enhanceInstruction');
    const enhancedInstruction = await this.enhanceInstructionWithContext(input.instruction);
    profileEnd('PlannerAgent.enhanceInstruction');
    
    // Send progress update via EventBus
    this.currentEventBus?.emitSystemMessage(isFollowUp ? '📝 Creating follow-up task plan' : '📝 Creating task plan', 'info', this.getAgentName());
    
    try {
      // Get message history without browser state
      const messages = this.executionContext.messageManager.getMessagesWithoutBrowserState();
      
      // Get detailed browser state
      profileStart('PlannerAgent.getBrowserState');
      const browserStateDescription = await this.browserContext.getBrowserStateString();
      const fullBrowserState = await this.browserContext.getBrowserState();
      profileEnd('PlannerAgent.getBrowserState');
      
      // Extract validation feedback if replanning after validation failure
      const validationResult = input.context?.validationResult as any;
      const validationFeedback = validationResult?.suggestions?.join(', ') || 
                                validationResult?.reasoning || '';
      
      // Extract previous plan from context (for follow-up tasks)
      const previousPlan = input.context?.previousPlan as string[] | undefined;
      
      // Debug: Log validation context if present
      if (validationResult) {
        this.log('🔄 Replanning after validation', 'info', {
          validationPassed: validationResult.is_valid,
          suggestions: validationResult.suggestions,
          confidence: validationResult.confidence
        });
      }
      
      // Generate plan using LLM with follow-up awareness
      profileStart('PlannerAgent.generatePlanWithLLM');
      const plan = await this.generatePlanWithLLM(
        messages,
        5,  // Default to 5 steps
        enhancedInstruction,
        browserStateDescription,
        validationFeedback,
        previousPlan,
        isFollowUp,
        fullBrowserState.screenshot  // Pass screenshot if available
      );
      profileEnd('PlannerAgent.generatePlanWithLLM');
    
    // Add the plan to message manager for conversation history
    if (this.executionContext.messageManager && plan.plan.length > 0) {
      this.executionContext.messageManager.addPlanMessage(plan.plan);
    }
    
    // Debug: Log generated plan
    const executionTime = Date.now() - startTime;
    this.log('📦 Plan generated', 'info', {
      stepCount: plan.plan.length,
      complexity: plan.complexity,
      confidence: plan.confidence,
      requiresInteraction: plan.requires_interaction,
      plan: plan.plan,
      executionTime
    });
      
      profileEnd('PlannerAgent.executeAgent');
      return plan;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      profileEnd('PlannerAgent.executeAgent');
      
      return {
        plan: [],
        reasoning: `Planning failed: ${errorMessage}`,
        complexity: 'high' as const,
        estimated_steps: 0,
        requires_interaction: false,
        confidence: 'low' as const
      };
    } finally {
      // 2. Remove system prompt after execution
      if (this.systemPromptAdded) {
        this.executionContext.messageManager.removeSystemMessage();
        this.systemPromptAdded = false;
        
        // Debug log handled by base log method
      }
    }
    } catch (error) {
      // This outer catch should never be reached, but just in case
      profileEnd('PlannerAgent.executeAgent');
      throw error;
    }
  }
  
  
  /**
   * Generate plan using LLM with structured output
   */
  private async generatePlanWithLLM(
    messages: BaseMessage[],
    steps: number,
    task: string,
    browserStateDescription?: string,
    validationFeedback?: string,
    previousPlan?: string[],
    isFollowUp: boolean = false,
    screenshot?: string | null
  ): Promise<PlannerOutput> {
    // Define the output schema for structured response - matching PlannerOutputSchema
    const planSchema = z.object({
      plan: z.array(z.string()).describe(`Array of exactly ${steps} next steps`),
      reasoning: z.string().describe('Reasoning behind the plan'),
      complexity: z.enum(['low', 'medium', 'high']).describe('Task complexity assessment'),
      estimated_steps: z.number().describe('Estimated number of steps'),
      requires_interaction: z.boolean().describe('Whether this requires browser interaction'),
      confidence: z.enum(['high', 'medium', 'low']).describe('Confidence in the plan')
    });

    // Get LLM using base agent method (respects user settings)
    profileStart('PlannerAgent.setupLLM');
    const llm = await this.getLLM();
    
    // Create LLM with structured output using flexible schema handling
    const structuredLLM = await withFlexibleStructuredOutput(llm, planSchema);
    profileEnd('PlannerAgent.setupLLM');

    // Build system prompt using prompt generator with follow-up awareness
    const systemPrompt = this.promptGenerator.generateSystemPrompt(steps, isFollowUp);

    // Build user prompt with conversation history
    let conversationHistory = 'CONVERSATION HISTORY:\n';
    
    // Format messages for context
    messages.forEach((msg, index) => {
      const role = msg._getType() === 'human' ? 'User' : 'Assistant';
      const content = typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content);
      conversationHistory += `\n[${index + 1}] ${role}: ${content}\n`;
    });

    // Note: Previous plan is now handled in generateUserPrompt when isFollowUp is true

    // Generate user prompt using prompt generator with follow-up context
    const userPrompt = this.promptGenerator.generateUserPrompt(
      conversationHistory,
      browserStateDescription || '',
      task,
      steps,
      validationFeedback,
      isFollowUp,
      previousPlan
    );

    try {
      // Debug: Log LLM invocation
      this.log('🤖 Invoking LLM for planning', 'info', {
        requestedSteps: steps,
        isFollowUp,
        hasValidationFeedback: !!validationFeedback,
        hasScreenshot: !!screenshot,
        promptLength: userPrompt.length
      });
      
      // Create message based on screenshot availability
      let userMessage: HumanMessage;
      if (screenshot) {
        // Create multi-modal message with text and screenshot
        userMessage = new HumanMessage({
          content: [
            { type: 'text', text: userPrompt },
            {
              type: 'image_url',
              image_url: { url: `data:image/jpeg;base64,${screenshot}` }
            }
          ]
        });
      } else {
        // Text-only message
        userMessage = new HumanMessage(userPrompt);
      }
      
      // Get structured response from LLM
      profileStart('PlannerAgent.llmInvoke');
      const result = await structuredLLM.invoke([
        new SystemMessage(systemPrompt),
        userMessage
      ]);
      profileEnd('PlannerAgent.llmInvoke');

      // Ensure we don't exceed the requested number of steps
      if (result.plan.length > steps) {
        result.plan = result.plan.slice(0, steps);
        
        // Debug: Log truncation
        this.log('✏️ Plan truncated', 'info', {
          originalLength: result.plan.length,
          truncatedTo: steps
        });
      }
      
      return result as PlannerOutput;
    } catch (error) {
      // Fallback if LLM fails
      return {
        plan: [task],
        reasoning: `Planning failed: ${error instanceof Error ? error.message : String(error)}`,
        complexity: 'high' as const,
        estimated_steps: 0,
        requires_interaction: false,
        confidence: 'low' as const
      };
    }
  }
  
}
