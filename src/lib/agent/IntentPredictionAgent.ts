import { z } from 'zod';
import { BaseAgent, AgentOptions, AgentInput } from './BaseAgent';
import { ToolRegistry } from '@/lib/tools/base';
import { Logging } from '@/lib/utils/Logging';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import { RunnableConfig } from '@langchain/core/runnables';
import { IntentPredictionPrompt } from '@/lib/prompts/IntentPredictionPrompt';
import { withFlexibleStructuredOutput } from '@/lib/llm/utils/structuredOutput';

// Schema for navigation history entry
const NavigationEntrySchema = z.object({
  url: z.string(),
  title: z.string(),
  timestamp: z.number()
});

// Schema for accessibility snapshot
const AccessibilitySnapshotSchema = z.object({
  url: z.string(),
  cleanUrl: z.string(),  // URL without query parameters
  title: z.string(),
  metaDescription: z.string().optional(),  // Meta description tag
  ogTitle: z.string().optional(),  // Open Graph title
  ogDescription: z.string().optional(),  // Open Graph description
  headings: z.array(z.string()),
  buttons: z.array(z.string()),
  links: z.array(z.string()),
  ariaLabels: z.array(z.string()),
  landmarks: z.array(z.object({
    role: z.string(),
    label: z.string().optional()
  })),
  forms: z.array(z.object({
    action: z.string().optional(),
    fields: z.array(z.string())
  })),
  mainText: z.string().optional()
});

// Intent prediction specific input schema
export const IntentPredictionInputSchema = z.object({
  tabHistory: z.array(NavigationEntrySchema),
  accessibilitySnapshot: AccessibilitySnapshotSchema
});

// Intent prediction output schema
export const IntentPredictionOutputSchema = z.object({
  success: z.boolean(),
  intents: z.array(z.string()),  // Predicted intents
  confidence: z.number().min(0).max(1).optional(),  // Overall confidence
  error: z.string().optional()
});

export type IntentPredictionInput = z.infer<typeof IntentPredictionInputSchema>;
export type IntentPredictionOutput = z.infer<typeof IntentPredictionOutputSchema>;

/**
 * Agent specialized for predicting user intents based on browsing context
 */
export class IntentPredictionAgent extends BaseAgent {
  private prompt: IntentPredictionPrompt;

  constructor(options: AgentOptions) {
    super(options);
    this.prompt = new IntentPredictionPrompt();
  }

  /**
   * Override: Create tool registry for the agent (no tools needed for intent prediction)
   */
  protected createToolRegistry(): ToolRegistry {
    this.log('🔧 Creating empty ToolRegistry (intent prediction uses only LLM)');
    return new ToolRegistry();
  }

  /**
   * Override: Generate system prompt for intent prediction
   */
  protected generateSystemPrompt(): string {
    return this.prompt.generate();
  }

  /**
   * Execute agent-specific logic (required by BaseAgent)
   */
  protected async executeAgent(
    input: AgentInput,
    callbacks?: any,
    config?: RunnableConfig
  ): Promise<unknown> {
    try {
      // Ensure agent is initialized
      if (!this.isInitialized) {
        await this.initialize();
      }

      this.log('🔮 Starting intent prediction');

      // Parse and validate context
      const context = input.context as IntentPredictionInput;
      if (!context?.tabHistory || !context?.accessibilitySnapshot) {
        throw new Error('Missing required context: tabHistory and accessibilitySnapshot');
      }

      const { tabHistory, accessibilitySnapshot } = context;

      // Log tab history for debugging
      this.log('📍 Tab history:', 'info', {
        tabHistory: tabHistory.map(entry => ({
          url: entry.url,
          title: entry.title,
          timestamp: new Date(entry.timestamp).toISOString()
        }))
      });

      // Log current page info
      this.log('📄 Current page:', 'info', {
        url: accessibilitySnapshot.url,
        cleanUrl: accessibilitySnapshot.cleanUrl,
        title: accessibilitySnapshot.title,
        metaDescription: accessibilitySnapshot.metaDescription,
        ogTitle: accessibilitySnapshot.ogTitle,
        headingsCount: accessibilitySnapshot.headings.length,
        buttonsCount: accessibilitySnapshot.buttons.length,
        linksCount: accessibilitySnapshot.links.length,
        formsCount: accessibilitySnapshot.forms.length
      });

      // Build prompt
      const prompt = this.prompt.buildPredictionPrompt(tabHistory, accessibilitySnapshot);

      // TODO(nithin): Similar to other agents, add system prompt to the message manager. Also, in the intent prediction
      // message manager, keep track of which intents were predicted and which were clicked and pass that to the LLM.
      // this.executionContext.messageManager.addSystemMessage(this.systemPrompt, 0);
      // this.systemPromptAdded = true;

      // Get LLM (created lazily with latest settings)
      const llm = await this.getLLM();

      // Define the structured output schema for intent prediction
      const intentPredictionSchema = z.object({
        intents: z.array(z.string()).max(3).describe('Top 3 predicted user intents based on browsing context'),
        confidence: z.number().min(0).max(1).describe('Confidence level in the predictions (0-1)')
      });

      // Create LLM with structured output using flexible schema handling
      const structuredLLM = await withFlexibleStructuredOutput(llm, intentPredictionSchema);

      // Get system prompt
      const systemPrompt = this.generateSystemPrompt();

      // Add messages with system prompt
      const messages = [
        new SystemMessage(systemPrompt),
        new HumanMessage(prompt)
      ];

      // Invoke LLM with structured output
      this.log('🤖 Invoking LLM for intent prediction with structured output');
      const result = await structuredLLM.invoke(messages, config);

      // Log the structured response
      this.log('🤖 Structured LLM response:', 'info', {
        intents: result.intents,
        confidence: result.confidence,
        intentsCount: result.intents.length
      });

      this.log(`✅ Predicted ${result.intents.length} intents`);
      
      // Log the predicted intents with confidence
      this.log('🎯 Predicted intents:', 'info', {
        intents: result.intents,
        confidence: result.confidence,
        pageUrl: accessibilitySnapshot.cleanUrl,
        pageTitle: accessibilitySnapshot.ogTitle || accessibilitySnapshot.title
      });

      // Return just the data - BaseAgent will wrap it
      return {
        intents: result.intents,
        confidence: result.confidence
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.log(`❌ Intent prediction failed: ${errorMessage}`, 'error');
      
      // Don't return any intents on error - let the UI handle it
      throw error;
    }
  }

  // Removed buildPredictionPrompt, analyzePageFeatures, parseIntentResponse, and getFallbackIntents
  // Now using structured output with withFlexibleStructuredOutput for reliable JSON parsing

  protected getAgentName(): string {
    return 'IntentPredictionAgent';
  }
}