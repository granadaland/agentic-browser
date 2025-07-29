import { z } from 'zod';
import { BaseAgent, AgentOptions, AgentInput } from './BaseAgent';
import { ToolRegistry } from '@/lib/tools/base/ToolRegistry';
import { LangChainProviderFactory } from '@/lib/llm/LangChainProviderFactory';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { RunnableConfig } from '@langchain/core/runnables';
import { withFlexibleStructuredOutput } from '@/lib/llm/utils/structuredOutput';

/**
 * Classification output schema for routing decisions
 */
export const ClassificationOutputSchema = z.object({
  task_type: z.enum(['productivity', 'browse', 'answer'])  // Which agent path to take
});

export type ClassificationOutput = z.infer<typeof ClassificationOutputSchema>;

/**
 * Agent specialized for classifying user intents and routing to appropriate workflows.
 * Determines whether tasks should go to ProductivityAgent or BrowseAgent flow.
 */
export class ClassificationAgent extends BaseAgent {
  /**
   * Creates a new instance of ClassificationAgent
   * @param options - Configuration options for the classification agent
   */
  constructor(options: AgentOptions) {
    super(options);
  }
  
  /**
   * Override: Get the agent name for logging
   */
  protected getAgentName(): string {
    return 'ClassificationAgent';
  }
  
  /**
   * Override: Create empty tool registry (classification doesn't use tools)
   */
  protected createToolRegistry(): ToolRegistry {
    return new ToolRegistry(); // Empty registry
  }
  
  /**
   * Override: Get the default system prompt for classification
   */
  protected generateSystemPrompt(): string {
    return `You are a task classification specialist for the Nxtscape browser assistant. Your job is to analyze user requests and determine the appropriate workflow.

CLASSIFICATION RULES:

**ANSWER TASKS** (Question answering about web content):
- Content questions: "what is this page about?", "explain this article", "what does this site say about X?"
- Multi-tab analysis: "summarize these tabs", "compare content across tabs", "find information about Y in open tabs"
- Specific queries: "what are the main points?", "extract key information", "answer based on page content"
- Research questions: "what can you tell me about X from these pages?", "analyze the content"
- Active data extraction: "get product prices", "scrape company info"

**PRODUCTIVITY TASKS** (Direct browser management - no content analysis):
- Tab management: "close tabs", "group tabs", "switch to Gmail", "list open tabs"
- Browser organization: "save session", "bookmark page", "organize bookmarks"
- Status queries: "what tabs are open?", "show history", "tab count"
- Browser efficiency: "close duplicate tabs", "group shopping tabs"

**BROWSE TASKS** (Require multi-step planning and web automation):
- Website navigation: "go to Amazon and search", "navigate to login page"
- Form interactions: "fill out form", "submit contact form", "sign up for account"
- Complex workflows: "complete checkout", "compare prices across sites"
- Web automation: "click buttons", "scroll and find", "interact with elements"

DECISION CRITERIA:
- If task is about understanding/analyzing current page content → answer
- If task involves direct browser management → productivity
- If task involves web page interaction/automation → browse
- If unsure and task is about content → answer
- If unsure and task involves actions → browse

Analyze the user request and classify it appropriately with high confidence.`;
  }
  
  
  /**
   * Execute classification task - handles instruction enhancement and execution
   * @param input - Agent input containing instruction and context
   * @param callbacks - Optional streaming callbacks
   * @param config - Optional configuration for LangGraph web compatibility
   * @returns Promise resolving to classification output
   */
  protected async executeAgent(
    input: AgentInput,
    config?: RunnableConfig
  ): Promise<ClassificationOutput> {
    try {
      this.log(`🎯 Classifying user request: ${input.instruction}`);
      
      // Send progress update via EventBus
      // this.currentEventBus?.emitSystemMessage('🎯 Analyzing and planning your task...', 'info', this.getAgentName());
      
      // Create structured output schema for LLM
      const classificationSchema = z.object({
        task_type: z.enum(['productivity', 'browse', 'answer']).describe('Whether this is a productivity task, browse task, or answer task')
      });
      
      // Get LLM and create structured output
      const llm = await this.getLLM();
      const structuredLLM = await withFlexibleStructuredOutput(llm, classificationSchema);
      
      // Build classification prompt
      const userPrompt = `Classify this user request:

USER REQUEST: "${input.instruction}"

Determine if this is:
- An answer task (question about web content)
- A productivity task (browser/tab management)
- A browse task (web automation)

You must return a JSON object with a single field "task_type" that has value either "answer", "productivity", or "browse".`;

      // Get classification from LLM
      const result = await structuredLLM.invoke([
        new SystemMessage(this.systemPrompt),
        new HumanMessage(userPrompt)
      ], config);
      
      this.log(`✅ Classification result: ${result.task_type}`);
      
      return result as ClassificationOutput;
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.log(`❌ Classification failed: ${errorMessage}`, 'error');
      
      // Default to productivity path on error
      return {
        task_type: 'productivity'
      };
    }
  }
}
