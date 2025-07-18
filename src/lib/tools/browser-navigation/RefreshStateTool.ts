import { z } from 'zod'
import { NxtscapeTool } from '../base/NxtscapeTool'
import { ToolConfig } from '../base/ToolConfig'
import { ExecutionContext } from '@/lib/runtime/ExecutionContext'
import { Logging } from '@/lib/utils/Logging'

/**
 * Input schema for RefreshStateTool
 */
export const RefreshStateInputSchema = z.object({})  // No inputs needed

export type RefreshStateInput = z.infer<typeof RefreshStateInputSchema>

/**
 * Output schema for RefreshStateTool
 */
export const RefreshStateOutputSchema = z.object({
  success: z.boolean(),  // Whether state was refreshed
  message: z.string(),  // Status message
  actionCount: z.number().optional()  // Number of actions since last refresh
})

export type RefreshStateOutput = z.infer<typeof RefreshStateOutputSchema>

/**
 * Tool for refreshing browser state in the message history.
 * Should be called regularly to ensure agent has fresh browser state.
 */
export class RefreshStateTool extends NxtscapeTool<RefreshStateInput, RefreshStateOutput> {
  constructor (executionContext: ExecutionContext) {
    const config: ToolConfig<RefreshStateInput, RefreshStateOutput> = {
      name: 'refresh_browser_state',
      description: `CRITICAL TOOL - Updates the browser state in your conversation context to reflect the current page after navigation or interactions.

# WHEN TO USE:
- **IMMEDIATELY AFTER**: Major page changes (navigation, form submission, clicking links)
- **BEFORE**: Planning or validation steps if browser state seems outdated
- **WHEN**: You need to verify the current page matches your expectations
- **IF STRUGGLING**: When you are having difficulty executing tasks or actions are failing repeatedly - refresh the state to get accurate current page information

# WHY IT'S CRITICAL:
Without calling this tool regularly, you will be working with STALE, OUTDATED page information that no longer reflects reality. This leads to:
- Trying to interact with elements that no longer exist
- Missing new content that appeared after actions
- Incorrect assumptions about the current page state
- Failed interactions and wasted actions

# USAGE PATTERN:
1. Perform actions (navigate, click, type, scroll)
2. Call refresh_browser_state
3. Continue with next actions using the fresh state
4. Repeat this cycle throughout the task

Remember: The browser state in your context does NOT update automatically. You MUST call this tool to see changes.`,
      category: 'navigation',
      version: '1.0.0',
      inputSchema: RefreshStateInputSchema,
      outputSchema: RefreshStateOutputSchema,
      examples: [
        {
          description: 'Refresh after navigation and interaction',
          input: {},
          output: {
            success: true,
            message: 'Browser state refreshed successfully. Current page: https://example.com/results',
            actionCount: 3
          }
        },
        {
          description: 'Refresh to check current state',
          input: {},
          output: {
            success: true,
            message: 'Browser state refreshed successfully. Current page: https://github.com/user/repo',
            actionCount: 2
          }
        }
      ],
      streamingConfig: {
        displayName: 'Refresh Browser State',
        icon: '🔄',
        progressMessage: 'Updating browser state to reflect current page...'
      }
    }
    super(config, executionContext)
  }

  /**
   * Execute the refresh state operation
   * @param input - Input parameters (none required)
   * @returns Result containing refresh status
   */
  protected async execute (input: RefreshStateInput): Promise<RefreshStateOutput> {
    try {
      Logging.log('refresh_browser_state', '🔄 Refreshing browser state', 'info')

      // Get the browser context
      const browserContext = this.executionContext.browserContext
      if (!browserContext) {
        throw new Error('Browser context not available')
      }

      // Get message manager
      const messageManager = this.executionContext.messageManager
      if (!messageManager) {
        throw new Error('Message manager not available')
      }

      // Remove any existing browser state messages
      messageManager.removeBrowserStateMessages()

      // Get current page state
      const currentPage = await browserContext.getCurrentPage()
      if (!currentPage) {
        return {
          success: false,
          message: 'No active page to refresh state from'
        }
      }

      // Get fresh browser state object
      // RefreshStateTool doesn't need vision - just text representation
      const browserState = await browserContext.getBrowserStateString()
      
      // Add fresh browser state to messages
      messageManager.addBrowserStateMessage(browserState)

      // count actions since last browser state
      const messages = messageManager.getMessagesWithMetadata()
      let actionCount = 0
      for (let i = messages.length - 1; i >= 0; i--) {
        const msg = messages[i]
        if (msg.metadata.messageType === 'tool') {
          actionCount++
        }
      }

      return {
        success: true,
        message: `Browser state refreshed successfully. Current page: ${currentPage.url()}`,
        actionCount
      }
    } catch (error) {
      Logging.log('refresh_browser_state', `❌ Failed to refresh browser state: ${error}`, 'error')
      return {
        success: false,
        message: `Failed to refresh browser state: ${error instanceof Error ? error.message : String(error)}`
      }
    }
  }

  /**
   * Format the refresh state result for UI display
   * @param output - The tool output
   * @returns Formatted string for UI display
   */
  FormatResultForUI(output: RefreshStateOutput): string {
    if (output.success) {
      // Extract hostname from the message if it contains a URL
      let displayMessage = output.message;
      const urlMatch = output.message.match(/Current page: (.+)$/);
      if (urlMatch && urlMatch[1]) {
        try {
          const url = new URL(urlMatch[1]);
          displayMessage = `Browser state refreshed successfully. Current page: ${url.hostname}`;
        } catch {
          // If URL parsing fails, use the original message
        }
      }
      
      const actionInfo = output.actionCount !== undefined ? ` (${output.actionCount} actions)` : '';
      return `🔄 ${displayMessage}${actionInfo}`;
    }
    return `❌ ${output.message}`;
  }

  /**
   * Generate contextual progress message for refresh state
   * @param args - Tool arguments
   * @returns Progress message
   */
  getProgressMessage(args: RefreshStateInput): string {
    return 'Updating browser state to reflect current page...';
  }
} 