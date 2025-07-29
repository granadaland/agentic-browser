import { z } from 'zod';
import { createReactAgent } from '@langchain/langgraph/prebuilt';
import { Logging } from '@/lib/utils/Logging';
import { RunnableConfig } from '@langchain/core/runnables';
import { profileStart, profileEnd, profileAsync } from '@/lib/utils/Profiler';

// Import base agent
import { BaseAgent, AgentOptions, AgentInput } from './BaseAgent';

// Import tools
import { ToolRegistry } from '@/lib/tools/base';
import { ExtractTool } from '@/lib/tools/answer';
import { GetSelectedTabsTool } from '@/lib/tools/tab';

/**
 * Answer agent output schema
 */
export const AnswerOutputSchema = z.object({
  success: z.boolean(),  // Whether the answer was successfully generated
  status_message: z.string()  // Status message (answer is streamed separately)
});

export type AnswerOutput = z.infer<typeof AnswerOutputSchema>;

/**
 * Agent specialized for answering questions about web page content.
 * Analyzes single or multiple tabs to provide intelligent answers.
 */
export class AnswerAgent extends BaseAgent {
  /**
   * Creates a new instance of AnswerAgent
   * @param options - Configuration options for the answer agent
   */
  constructor(options: AgentOptions) {
    super(options);
  }

  /**
   * Override: Create tool registry for the agent
   * @returns ToolRegistry with answer-specific tools
   */
  protected createToolRegistry(): ToolRegistry {
    const registry = new ToolRegistry();

    // Register answer-specific tools
    registry.registerAll([
      new ExtractTool(this.executionContext),
      new GetSelectedTabsTool(this.executionContext)
    ]);

    return registry;
  }

  /**
   * Override: Generate system prompt for answer agent
   * @param followUpContext - Optional context for follow-up tasks
   * @returns System prompt string
   */
  protected generateSystemPrompt(followUpContext?: { isFollowUp: boolean; previousTaskType?: string }): string {
    const toolDocs = this.toolRegistry?.generateSystemPrompt() || '';
    
    // Add follow-up context to prompt if applicable
    const followUpSection = followUpContext?.isFollowUp && followUpContext.previousTaskType === 'answer'
      ? `
## FOLLOW-UP CONTEXT
This is a follow-up question to a previous answer task. Important guidelines:
- Review the conversation history to understand what was previously discussed
- Reference and build upon your previous answers when relevant
- If the user asks "what about...", "how about...", or uses pronouns like "it/this/that", they're referring to the previous context
- Maintain continuity in your responses - don't start from scratch unless explicitly asked
- If you need clarification about what aspect they're following up on, ask specifically
`
      : '';

    return `You are a web content analysis expert. Your job is to extract information from web pages and provide accurate, helpful answers.

## CORE PRINCIPLES
- **Accuracy First**: Only state what you can verify from the page content
- **Be Specific**: Reference exact quotes, numbers, or facts from the pages
- **Stay Focused**: Answer exactly what was asked, nothing more
- **Handle Uncertainty**: If information is unclear or missing, say so explicitly

## WORKFLOW
1. **Understand the Task**
   - Is this a summary, extraction, comparison, or analysis?
   - What specific information does the user need?
   
2. **Check Available Tabs**
   - Use get_selected_tabs to see what pages you have access to
   - Note which tabs are most relevant to the question
   
3. **Extract Content**
   - Use the extract tool to get content from relevant tabs
   - For summaries: Extract the full content
   - For specific info: You can still extract full content (the tool will handle it)
   
4. **Analyze and Answer**
   - Process the extracted content based on the task type
   - Structure your response appropriately

## TASK-SPECIFIC GUIDELINES

### For Summaries:
- Start with a brief overview (1-2 sentences)
- Use bullet points for key points
- Keep each point concise and meaningful
- End with any important conclusions or takeaways

### For Information Extraction:
- Provide the exact information requested
- Include relevant context if helpful
- Use quotes for direct citations
- Mention if some requested info wasn't found

### For Comparisons:
- Create clear sections for each item
- Use consistent criteria for comparison
- Highlight key differences and similarities

### For Lists/Enumerations:
- Use numbered lists for ordered items
- Use bullet points for unordered items
- Keep formatting consistent

### For Follow-up Questions:
- Check if the user is referencing something from earlier in the conversation
- When they use pronouns (it, this, that) or phrases like "what about...", refer to the previous context
- Build upon previous answers rather than repeating information
- If context is unclear, ask for clarification

## OUTPUT FORMATTING
- Use **bold** for emphasis on key points
- Use \`code blocks\` for technical content, URLs, or special formatting
- Use > blockquotes for direct quotes from pages
- Break up long responses with clear sections

## IMPORTANT REMINDERS
- The extract tool is smart - just use it on relevant tabs
- Always cite which page information comes from using the format: "Source: [Page Title] (URL)"

## AVAILABLE TOOLS
${toolDocs}

Remember: Users rely on your accuracy. It's better to say "I couldn't find that information" than to make assumptions.${followUpSection}`;
  }

  /**
   * Override: Get the agent name for logging
   * @returns Agent name
   */
  protected getAgentName(): string {
    return 'AnswerAgent';
  }

  /**
   * Execute answer agent - analyzes content and generates answers
   * @param input - Agent input containing the question
   * @param callbacks - Optional streaming callbacks
   * @param config - Optional configuration
   * @returns Parsed answer output
   */
  protected async executeAgent(
    input: AgentInput,
    config?: RunnableConfig
  ): Promise<AnswerOutput> {
    profileStart('AnswerAgent.executeAgent');
    const startTime = Date.now();
    
    try {
      await this.ensureInitialized();
      
      // Extract follow-up context from input
      const followUpContext = input.context ? {
        isFollowUp: Boolean(input.context.isFollowUp) || false,
        previousTaskType: input.context.previousTaskType as string | undefined
      } : undefined;
      
      // Debug: Log task context
      this.log('📋 Answer task context', 'info', {
        question: input.instruction,
        isFollowUp: followUpContext?.isFollowUp || false,
        previousTaskType: followUpContext?.previousTaskType || 'none'
      });
      
      // Generate system prompt with follow-up context
      profileStart('AnswerAgent.generateSystemPrompt');
      this.systemPrompt = this.generateSystemPrompt(followUpContext);
      profileEnd('AnswerAgent.generateSystemPrompt');
      
      // 1. Add system prompt to message history (agent-specific)
      this.executionContext.messageManager.addSystemMessage(this.systemPrompt, 0);
      this.systemPromptAdded = true;

      // Get selected tabs context if available
      const selectedTabIds = this.executionContext.getSelectedTabIds();
      if (selectedTabIds && selectedTabIds.length > 0) {
        const tabContext = `[Context: You have access to ${selectedTabIds.length} selected tab(s) with IDs: ${selectedTabIds.join(', ')}. Use these tabs to answer the user's question.]`;
        this.executionContext.messageManager.addHumanMessage(tabContext);
        
        // Debug: Log tab selection
        this.log('🔍 Tab selection', 'info', {
          selectedTabCount: selectedTabIds.length,
          tabIds: selectedTabIds
        });
      }

      // Get LLM and tools
      profileStart('AnswerAgent.setupLLM');
      const llm = await this.getLLM();
      const tools = this.createTools();
      const isGemini = llm._llmType()?.indexOf('google') !== -1 || false;
      const messages = this.executionContext.messageManager.getMessages(isGemini);
      profileEnd('AnswerAgent.setupLLM');

      // Debug: Log agent creation details
      this.log('🤖 Creating ReAct agent', 'info', {
        toolCount: tools.length,
        tools: tools.map(t => t.name),
        llmType: llm._llmType(),
        messageCount: messages.length
      });

      // Create ReAct agent (without messageModifier, as system prompt is in messages)
      profileStart('AnswerAgent.createAgent');
      const agent = createReactAgent({
        llm,
        tools,
      });
      profileEnd('AnswerAgent.createAgent');

      // Use centralized streaming execution
      profileStart('AnswerAgent.invokeWithStreaming');
      const { result, allMessages } = await this.executeReactAgentWithStreaming(
        agent,
        input.instruction,
        config,
        messages
      );
      profileEnd('AnswerAgent.invokeWithStreaming');

      // 2. Remove system prompt after execution
      if (this.systemPromptAdded) {
        this.executionContext.messageManager.removeSystemMessage();
        this.systemPromptAdded = false;
      }

      /*
       * The block below checks for an explicit `done` tool call. We are
       * temporarily disabling it while we evaluate streaming-only completion.
       * --------------------------------------------------------------------
       * let successFlag = false;
       * for (const msg of allMessages) {
       *   if ((msg as any).tool_calls?.some((tc: any) => tc.name === 'done')) {
       *     successFlag = true;
       *     break;
       *   }
       * }
       * const success = successFlag;
       * if (success) {
       *   this.log('✅ Answer generated successfully');
       * } else {
       *   this.log('❌ Failed to generate answer', 'warning');
       * }
       */

      // Assume success once answer has been streamed
      const success = true;
      
      // Debug: Log completion
      const executionTime = Date.now() - startTime;
      this.log('✅ Answer generation complete', 'info', {
        totalMessages: allMessages.length,
        executionTime: executionTime
      });

      profileEnd('AnswerAgent.executeAgent');
      
      // Return the answer output
      // Note: The actual answer has already been streamed to the UI during execution,
      // so we only need to return metadata and success status here
      return {
        success,
        status_message: ''  // Answer already streamed to UI
      };

    } catch (error) {
      // Ensure system prompt is cleaned up on error
      if (this.systemPromptAdded) {
        this.executionContext.messageManager.removeSystemMessage();
        this.systemPromptAdded = false;
      }

      const errorMessage = error instanceof Error ? error.message : String(error);
      this.log(`❌ Answer generation failed: ${errorMessage}`, 'error');

      profileEnd('AnswerAgent.executeAgent');
      
      return {
        success: false,
        status_message: `Failed to generate answer: ${errorMessage}`
      };
    }
  }
}