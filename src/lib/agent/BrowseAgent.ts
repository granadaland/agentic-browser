import { z } from 'zod';
import { createReactAgent } from '@langchain/langgraph/prebuilt';
import { Logging } from '@/lib/utils/Logging';
import { RunnableConfig } from '@langchain/core/runnables';

// Import base agent
import { BaseAgent, AgentOptions, AgentInput } from './BaseAgent';

// Import new tool system
import { ToolRegistry } from '@/lib/tools/base';
import { ExtractTool } from '@/lib/tools/answer/ExtractTool';
import { NavigationTool } from '@/lib/tools/browser-navigation/NavigationTool';
import { FindElementTool } from '@/lib/tools/browser-navigation/FindElementTool';
import { InteractionTool } from '@/lib/tools/browser-navigation/InteractionTool';
import { ScrollTool } from '@/lib/tools/browser-navigation/ScrollTool';
import { SearchTool } from '@/lib/tools/browser-navigation/SearchTool';
import { TabOperationsTool } from '@/lib/tools/tab/TabOperationsTool';
import { DoneTool } from '@/lib/tools/utility/DoneTool';
import { WaitTool } from '@/lib/tools/utility/WaitTool';
import { TodoListManagerTool } from '@/lib/tools/utility/TodoListManagerTool';

// Import prompt
import { BrowseAgentPrompt } from '@/lib/prompts/BrowseAgentPrompt';
import { RefreshStateTool } from '../tools';

/**
 * Browse agent output schema
 */
export const BrowseOutputSchema = z.object({
  completed: z.boolean(),  // Whether the browsing task was completed
  actions_taken: z.array(z.string()),  // List of actions performed
  final_state: z.string(),  // Description of final page state
  extracted_data: z.record(z.unknown()).optional()  // Any data extracted during browsing
});

export type BrowseOutput = z.infer<typeof BrowseOutputSchema>;

/**
 * Agent specialized for web browsing automation using ReAct pattern.
 * Uses tools to complete complex web tasks through multi-step reasoning.
 */
export class BrowseAgent extends BaseAgent {
  /**
   * Creates a new instance of BrowseAgent
   * @param options - Configuration options for the browse agent
   */
  constructor(options: AgentOptions) {
    super(options);
  }

  /**
   * Override: Create tool registry for the agent
   * @returns ToolRegistry with browse tools
   */
  protected createToolRegistry(): ToolRegistry {
    const registry = new ToolRegistry();
    
    // Register only browser navigation, extraction, and utility tools
    registry.registerAll([
      // Browser navigation tools
      new NavigationTool(this.executionContext),
      new FindElementTool(this.executionContext),
      new SearchTool(this.executionContext),
      new InteractionTool(this.executionContext),
      new ScrollTool(this.executionContext),
      // Tab management tools
      new TabOperationsTool(this.executionContext),
      // Utility tools
      new DoneTool(this.executionContext),
      // new WaitTool(this.executionContext),
      new TodoListManagerTool(this.executionContext),
      // Extraction tools
      new ExtractTool(this.executionContext),
      new RefreshStateTool(this.executionContext),
    ]);
    
    return registry;
  }

  /**
   * Override: Generate system prompt for browse agent
   * @returns System prompt string
   */
  protected generateSystemPrompt(): string {
    // Use the tool registry to generate documentation
    const toolRegistry = this.toolRegistry;
    const toolDocs = toolRegistry?.generateSystemPrompt() || '';
    
    // Create and use the browse agent prompt with tool documentation
    const promptGenerator = new BrowseAgentPrompt(toolDocs);
    return promptGenerator.generate();
  }

  /**
   * Override: Get the agent name for logging
   * @returns Agent name
   */
  protected getAgentName(): string {
    return 'BrowseAgent';
  }


  /**
   * Execute browsing agent - handles instruction enhancement and execution
   * @param input - Agent input containing instruction and context
   * @param callbacks - Optional streaming callbacks
   * @param config - Optional configuration for LangGraph web compatibility
   * @returns Parsed browse output
   */
  protected async executeAgent(
    input: AgentInput,
    config?: RunnableConfig
  ): Promise<BrowseOutput> {
    try {
      await this.ensureInitialized();

      // 1. Add system prompt (agent-specific)
      // TODO: do we need to add system prompt here? we add as messageModifier below
      this.executionContext.messageManager.addSystemMessage(this.systemPrompt, 0);
      this.systemPromptAdded = true;
      
      // 2. Add browser state before execution
      if (!this.stateMessageAdded) {
        const browserState = await this.executionContext.browserContext.getBrowserStateString();
        this.executionContext.messageManager.addBrowserStateMessage(browserState);
        this.stateMessageAdded = true;
        
        // Debug: Log browser state details
        const currentPage = await this.browserContext.getCurrentPage();
        this.log('🌐 Browser state captured', 'info', {
          url: currentPage.url(),
          title: await currentPage.title(),
          useVision: this.options.useVision,
          hasScreenshot: browserState.includes('Screenshot:')
        });
      }

      // Add selected tabs instruction if any
      const selectedTabsInstruction = await this.getSelectedTabsInstruction();
      if (selectedTabsInstruction) {
        this.executionContext.messageManager.addHumanMessage(`[Context: ${selectedTabsInstruction}]`);
      }

      
      // Get LLM and tools
      const llm = await this.getLLM();
      const tools = this.createTools();
      const isGemini = llm._llmType()?.indexOf('google') !== -1 || false;
      
      const messages = this.executionContext.messageManager.getMessages(isGemini);
      
      // Debug: Log agent configuration
      this.log('🤖 Creating browse agent', 'info', {
        instruction: input.instruction,
        toolCount: tools.length,
        tools: tools.map(t => t.name),
        llmType: llm._llmType(),
        messageCount: messages.length,
        hasSelectedTabs: !!selectedTabsInstruction
      });
      
      // Create ReAct agent
      const agent = createReactAgent({
        llm,
        tools,
      });
      
      // Use centralized streaming execution
      const { result, allMessages } = await this.executeReactAgentWithStreaming(
        agent,
        input.instruction,
        config,
        messages
      );
      
      // 3. Remove browser state and system prompt after execution
      if (this.stateMessageAdded) {
        this.executionContext.messageManager.removeBrowserStateMessages();
        this.stateMessageAdded = false;
        
        // Debug log handled by base log method
      }
      // 
      if (this.systemPromptAdded) {
        this.executionContext.messageManager.removeSystemMessage();
        this.systemPromptAdded = false;
        
        // Debug log handled by base log method
      }
      
      // Extract the final message content and model output
      const lastMessage = allMessages[allMessages.length - 1];
      const finalContent = typeof lastMessage?.content === 'string' 
        ? lastMessage.content 
        : 'Task completed';
      
      // Check for done tool usage to determine completion
      const actionsTaken: string[] = [];
      let completed = false;
      const modelOutput: Record<string, any> | null = null;
      
      for (const message of allMessages) {
        // Check if message has tool_calls property (type guard)
        if ('tool_calls' in message && message.tool_calls && Array.isArray(message.tool_calls)) {
          for (const toolCall of message.tool_calls) {
            actionsTaken.push(`${toolCall.name}: ${JSON.stringify(toolCall.args)}`);
            if (toolCall.name === 'done') {
              completed = true;
            }
          }
        }
      }
      
      // Debug: Log execution results
      this.log('🏁 Browse execution complete', 'info', {
        completed,
        actionCount: actionsTaken.length,
        toolCalls: actionsTaken.map(action => action.split(':')[0]),
        finalStateLength: finalContent.length
      });
      
      return {
        completed,
        actions_taken: actionsTaken,
        final_state: finalContent,
        extracted_data: input.context || {} // Include any context data passed in
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
      
      // Debug: Log error details
      this.log('❌ Browse task failed', 'error', {
        error: errorMessage,
        stack: error instanceof Error ? error.stack : undefined
      });
      
      return {
        completed: false,
        actions_taken: [],
        final_state: `Task failed: ${errorMessage}`,
        extracted_data: {}
      };
    }
  }
}
