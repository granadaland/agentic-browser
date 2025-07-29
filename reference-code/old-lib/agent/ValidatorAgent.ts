import { z } from 'zod';
import { Logging } from '@/lib/utils/Logging';
import { RunnableConfig } from '@langchain/core/runnables';
import { profileStart, profileEnd, profileAsync } from '@/lib/utils/Profiler';

// Import base agent
import { BaseAgent, AgentOptions, AgentInput } from './BaseAgent';

// Import tool system
import { ToolRegistry } from '@/lib/tools/base';

// Import supporting types
import { ExecutionContext } from '@/lib/runtime/ExecutionContext';
import { TaskMetadata } from '@/lib/types/types';

// Import vision configuration
import { VISION_CONFIG } from '@/config/visionConfig';

// Import message types
import { HumanMessage, SystemMessage, BaseMessage } from '@langchain/core/messages';

// Import structured output utility
import { withFlexibleStructuredOutput } from '@/lib/llm/utils/structuredOutput';
import { ValidatorToolPrompt } from '@/lib/prompts/ValidatorToolPrompt';


/**
 * Configuration options for validator agent
 */
export const ValidatorAgentOptionsSchema = z.object({
  strictMode: z.boolean().optional()  // Whether to use strict validation criteria
});

export type ValidatorAgentOptions = z.infer<typeof ValidatorAgentOptionsSchema>;

/**
 * Validator output schema
 */
export const ValidatorOutputSchema = z.object({
  is_valid: z.boolean(),  // Whether the task was completed correctly
  reasoning: z.string(),  // Explanation of the validation result
  answer: z.string(),  // The final answer if task is complete, empty string otherwise
  suggestions: z.array(z.string()).optional(),  // Suggestions for improvement if not valid
  confidence: z.enum(['high', 'medium', 'low']),  // Confidence level in the validation
  needs_retry: z.boolean()  // Whether the task should be retried
});

export type ValidatorOutput = z.infer<typeof ValidatorOutputSchema>;

/**
 * Agent specialized for validating task completion.
 * Only contains the ValidatorTool and provides validation-only functionality.
 */
export class ValidatorAgent extends BaseAgent {
  private strictMode: boolean;
  private promptGenerator!: ValidatorToolPrompt;

  /**
   * Creates a new instance of ValidatorAgent
   * @param options - Configuration options for the validator agent
   */
  constructor(options: AgentOptions & ValidatorAgentOptions) {
    // Override useVision based on configuration
    const updatedOptions = {
      ...options,
      useVision: VISION_CONFIG.VALIDATOR_AGENT_USE_VISION
    };
    super(updatedOptions);
    this.strictMode = options.strictMode || false;
  }

  /**
   * Override: Create tool registry for the agent
   * @returns Empty ToolRegistry - ValidatorAgent doesn't use tools
   */
  protected createToolRegistry(): ToolRegistry {
    return new ToolRegistry();  // Empty registry - no tools needed
  }


  /**
   * Override: Generate system prompt for validator agent
   * @returns System prompt string
   */
  protected generateSystemPrompt(): string {
    // Use the prompt generator to create the system prompt
    return this.promptGenerator.generateSystemPrompt(this.strictMode);
  }

  /**
   * Override: Get the agent name for logging
   * @returns Agent name
   */
  protected getAgentName(): string {
    return 'ValidatorAgent';
  }

  /**
   * Override: Get agent-specific initialization message
   * @returns Initialization message
   */
  protected getInitializationMessage(): string {
    return '✅ Initializing task validation agent...';
  }
  
  /**
   * Initialize the agent - called once before first execute
   */
  public async initialize(): Promise<void> {
    // Initialize prompt generator BEFORE calling parent
    this.promptGenerator = new ValidatorToolPrompt();
    
    // Now parent can safely call generateSystemPrompt()
    await super.initialize();
  }

  
  /**
   * Execute validation using the validator tool - handles instruction enhancement and execution
   * @param input - Agent input containing instruction and context
   * @param callbacks - Optional streaming callbacks
   * @param config - Optional configuration for LangGraph web compatibility
   * @returns Promise resolving to validator output
   */
  protected async executeAgent(
    input: AgentInput,
    config?: RunnableConfig
  ): Promise<ValidatorOutput> {
    await this.ensureInitialized();
    
    // 1. Add system prompt to message history at position 0 (agent-specific)
    this.executionContext.messageManager.addSystemMessage(this.systemPrompt, 0);
    this.systemPromptAdded = true;
    
    // Enhance instruction with browser context
    const enhancedInstruction = await this.enhanceInstructionWithContext(input.instruction);
    
    // Send progress update via EventBus
    this.currentEventBus?.emitThinking('✅ Validating task completion...', 'info', this.getAgentName());
    
    // Determine if vision should be used
    const useVision = VISION_CONFIG.VALIDATOR_TOOL_USE_VISION;
    
    // Debug: Log validation context
    this.log('🔍 Starting validation', 'info', {
      task: input.instruction,
      strictMode: this.strictMode,
      useVision,
      hasContext: !!input.context
    });
    
    try {
      // 2. Add browser state before validation
      if (!this.stateMessageAdded) {
        const browserStateForMessage = await this.browserContext.getBrowserStateString();
        this.executionContext.messageManager.addBrowserStateMessage(browserStateForMessage);
        this.stateMessageAdded = true;
        
        // Debug: Log browser state capture
        this.log('🌐 Browser state captured for validation', 'info', {
          useVision,
          url: await this.browserContext.getCurrentPage().then(p => p.url()),
          hasScreenshot: useVision
        });
      }
      
      // Get browser state with vision support if enabled
      const browserStateText = await this.browserContext.getBrowserStateString();
      const fullBrowserState = await this.browserContext.getBrowserState();
      
      // Debug: Log validation request
      this.log('🤖 Invoking LLM for validation', 'info', {
        taskLength: enhancedInstruction.length,
        browserStateLength: browserStateText.length,
        hasScreenshot: !!fullBrowserState.screenshot,
        strictMode: this.strictMode
      });
      
      // Validate using LLM
      const validation = await this._validateWithLLM(
        enhancedInstruction,
        browserStateText,
        [],  // No plan needed for direct validation
        false,  // requireAnswer
        this.strictMode,
        fullBrowserState.screenshot  // Pass screenshot if available
      );
      
      // Debug: Log validation result
      this.log('🏁 Validation complete', 'info', {
        isValid: validation.is_valid,
        confidence: validation.confidence,
        hasSuggestions: (validation.suggestions?.length || 0) > 0,
        reasoning: validation.reasoning.substring(0, 100) + '...'
      });
      
      // 3. Remove browser state and system prompt after validation
      if (this.stateMessageAdded) {
        this.executionContext.messageManager.removeBrowserStateMessages();
        this.stateMessageAdded = false;
        
        // Debug log handled by base log method
      }
      
      if (this.systemPromptAdded) {
        this.executionContext.messageManager.removeSystemMessage();
        this.systemPromptAdded = false;
        
        // Debug log handled by base log method
      }
      
      // Clean up highlights if vision was used
      // Note: Highlights not implemented in V2
      
      return {
        ...validation,
        needs_retry: !validation.is_valid
      };
    } catch (error) {
      // Ensure state and system prompt are cleaned up on error
      if (this.stateMessageAdded) {
        this.executionContext.messageManager.removeBrowserStateMessages();
        this.stateMessageAdded = false;
      }
      
      if (this.systemPromptAdded) {
        this.executionContext.messageManager.removeSystemMessage();
        this.systemPromptAdded = false;
      }
      
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      // Debug: Log validation error
      this.log('❌ Validation failed', 'error', {
        error: errorMessage,
        stack: error instanceof Error ? error.stack : undefined
      });
      
      // Emit error result to UI
      if (this.currentEventBus) {
        this.currentEventBus.emitSystemMessage(
          `❌ Validation error: ${errorMessage}`, 
          'error', 
          this.getAgentName()
        );
        
        // Don't emit completion here - let Orchestrator handle the final completion
      }
      
      // Clean up highlights if vision was used (on error)
      // Note: Highlights not implemented in V2
      
      return {
        is_valid: false,
        reasoning: `Validation failed: ${errorMessage}`,
        answer: '',
        suggestions: [],
        confidence: 'low',
        needs_retry: true
      };
    }
  }
  
  /**
   * Validate task completion using LLM with structured output
   */
  private async _validateWithLLM(
    task: string,
    browserStateText: string,
    plan?: string[],
    requireAnswer?: boolean,
    strictMode?: boolean,
    screenshot?: string | null
  ): Promise<ValidatorOutput> {
    // Define the output schema for structured response
    const validationSchema = z.object({
      is_valid: z.boolean().describe('Whether the task was completed successfully'),
      reasoning: z.string().describe('Detailed explanation of the validation result'),
      answer: z.string().describe('The final answer extracted from the conversation if applicable, empty string otherwise'),
      suggestions: z.array(z.string()).optional().describe('Suggestions for improvement if task is not complete'),
      confidence: z.enum(['high', 'medium', 'low']).describe('Confidence level in the validation')
    });

    // Get LLM using base agent method (respects user settings)
    const llm = await this.getLLM();
    
    // Create LLM with structured output using flexible schema handling
    const structuredLLM = await withFlexibleStructuredOutput(llm, validationSchema);

    // Build system prompt using prompt generator
    const systemPrompt = this.promptGenerator.generateSystemPrompt(strictMode);

    // Build user prompt using prompt generator
    const userPrompt = this.promptGenerator.generateUserPrompt(task, browserStateText, plan);

    try {
      // Create message based on vision availability
      let userMessage: HumanMessage;

      if (VISION_CONFIG.VALIDATOR_TOOL_USE_VISION && screenshot) {
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
      const result = await structuredLLM.invoke([
        new SystemMessage(systemPrompt),
        userMessage
      ]);

      // Ensure answer field is present
      if (!result.answer) {
        result.answer = '';
      }

      return result as ValidatorOutput;
    } catch (error) {
      // Fallback if LLM fails
      return {
        is_valid: false,
        reasoning: `Validation failed: ${error instanceof Error ? error.message : String(error)}`,
        answer: '',
        confidence: 'low',
        needs_retry: true
      };
    }
  }
}
