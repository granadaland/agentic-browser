import { z } from 'zod';
import { NxtscapeTool } from '../base/NxtscapeTool';
import { ToolConfig } from '../base/ToolConfig';
import { ExecutionContext } from '@/lib/runtime/ExecutionContext';

/**
 * Enum for tab operations
 */
export const TabOperationTypeEnum = z.enum([
  'close',  // Close tabs
  'new',  // Create new tab
  'switch_to',  // Switch to a specific tab
  'list_tabs_in_window',  // List tabs in current window
  'list_tabs_across_windows'  // List tabs across all windows
]);

export type TabOperationType = z.infer<typeof TabOperationTypeEnum>;

/**
 * Simplified uniform schema for all tab operations
 */
export const TabOperationsInputSchema = z.object({
  operationType: TabOperationTypeEnum,  // The operation to perform
  tab_ids: z.array(z.number()).optional()  // Tab IDs (for close, switch_to)
});

export type TabOperationsInput = z.infer<typeof TabOperationsInputSchema>;

/**
 * Schema for tab info in results
 */
export const TabInfoSchema = z.object({
  id: z.number(),  // Tab ID
  title: z.string(),  // Tab title
  url: z.string(),  // Tab URL
  active: z.boolean().optional()  // Whether tab is active
});

export type TabInfo = z.infer<typeof TabInfoSchema>;

/**
 * Schema for tab operations output
 */
export const TabOperationsOutputSchema = z.object({
  success: z.boolean(),  // Whether the operation succeeded
  operationType: TabOperationTypeEnum,  // Operation that was performed
  message: z.string(),  // Human-readable result message
  
  // Results specific to different operations
  tabs: z.array(TabInfoSchema).optional(),  // For list operations
  tabId: z.number().optional(),  // For new/switch_to operations
  closedCount: z.number().optional(),  // For close operation
  url: z.string().optional()  // For new tab operation
});

export type TabOperationsOutput = z.infer<typeof TabOperationsOutputSchema>;

/**
 * Unified tool for tab operations with simplified input
 */
export class TabOperationsTool extends NxtscapeTool<TabOperationsInput, TabOperationsOutput> {
  constructor(executionContext: ExecutionContext) {
    const config: ToolConfig<TabOperationsInput, TabOperationsOutput> = {
      name: 'tab_operations',
      description: 'Perform tab operations with a simple interface. Operations: "list_tabs_in_window" (list tabs in current window), "list_tabs_across_windows" (list all tabs), "new" (create blank tab - use NavigationTool to navigate to URLs), "switch_to" (switch to tab by id), "close" (close tabs by ids). Always pass operationType. Only pass tab_ids when needed for close/switch_to operations. IMPORTANT: To navigate to a URL, use NavigationTool after creating a new tab.',
      category: 'tab_management',
      version: '2.0.0',
      inputSchema: TabOperationsInputSchema,
      outputSchema: TabOperationsOutputSchema,
      examples: [
        // List operations
        {
          description: 'List tabs in current window to see what\'s open',
          input: { operationType: 'list_tabs_in_window' },
          output: {
            success: true,
            operationType: 'list_tabs_in_window',
            message: 'Found 5 tabs in current window',
            tabs: [
              { id: 2048, title: 'React Documentation - React Hooks', url: 'https://react.dev/reference/react/hooks', active: true },
              { id: 2049, title: 'Pull Request #1234 - Add authentication module · myorg/myrepo', url: 'https://github.com/myorg/myrepo/pull/1234' },
              { id: 2050, title: 'Stack Overflow - How to use useEffect with async functions', url: 'https://stackoverflow.com/questions/53332321' },
              { id: 2051, title: 'MDN Web Docs - Promise.all()', url: 'https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise/all' },
              { id: 2052, title: 'YouTube - Advanced TypeScript Patterns', url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' }
            ]
          }
        },
        {
          description: 'List all tabs across multiple browser windows',
          input: { operationType: 'list_tabs_across_windows' },
          output: {
            success: true,
            operationType: 'list_tabs_across_windows',
            message: 'Found 12 tabs across all windows',
            tabs: [
              { id: 2048, title: 'React Documentation - React Hooks', url: 'https://react.dev/reference/react/hooks', active: true },
              { id: 2049, title: 'Pull Request #1234 - Add authentication module · myorg/myrepo', url: 'https://github.com/myorg/myrepo/pull/1234' },
              { id: 3001, title: 'Gmail - Inbox (42)', url: 'https://mail.google.com/mail/u/0/#inbox' },
              { id: 3002, title: 'Jira - Sprint Board - Project Alpha', url: 'https://mycompany.atlassian.net/jira/software/projects/ALPHA/boards/1' },
              { id: 3003, title: 'AWS Console - EC2 Dashboard', url: 'https://console.aws.amazon.com/ec2/v2/home' },
              { id: 3004, title: 'Notion - Meeting Notes', url: 'https://www.notion.so/myworkspace/Meeting-Notes-2024-01-22' },
              { id: 3005, title: 'Figma - Mobile App Design System', url: 'https://www.figma.com/file/ABC123/Mobile-App-Design-System' },
              { id: 3006, title: 'Linear - Bug Reports', url: 'https://linear.app/mycompany/team/ENG/active' },
              { id: 3007, title: 'Slack | engineering | My Company', url: 'https://app.slack.com/client/T01234567/C01234567' },
              { id: 3008, title: 'localhost:3000 - Development Server', url: 'http://localhost:3000' },
              { id: 3009, title: 'ChatGPT', url: 'https://chat.openai.com' },
              { id: 3010, title: 'Vercel - Deployment Dashboard', url: 'https://vercel.com/myteam/myproject' }
            ]
          }
        },
        // New tab operations
        {
          description: 'Create blank tab (use NavigationTool after to navigate to a URL)',
          input: { operationType: 'new' },
          output: {
            success: true,
            operationType: 'new',
            message: 'Created new blank tab',
            tabId: 2054,
            url: 'chrome://newtab/'
          }
        },
        {
          description: 'Create new tab for further navigation',
          input: { operationType: 'new' },
          output: {
            success: true,
            operationType: 'new',
            message: 'Created new blank tab',
            tabId: 2055,
            url: 'chrome://newtab/'
          }
        },
        // Switch operations
        {
          description: 'Switch to Gmail tab to check emails',
          input: { operationType: 'switch_to', tab_ids: [3001] },
          output: {
            success: true,
            operationType: 'switch_to',
            message: 'Switched to tab: Gmail - Inbox (42)',
            tabId: 3001
          }
        },
        {
          description: 'Switch back to development server',
          input: { operationType: 'switch_to', tab_ids: [3008] },
          output: {
            success: true,
            operationType: 'switch_to',
            message: 'Switched to tab: localhost:3000 - Development Server',
            tabId: 3008
          }
        },
        // Close operations
        {
          description: 'Close single YouTube tab',
          input: { operationType: 'close', tab_ids: [2052] },
          output: {
            success: true,
            operationType: 'close',
            message: 'Closed 1 tab',
            closedCount: 1
          }
        },
        {
          description: 'Close multiple documentation tabs after research',
          input: { operationType: 'close', tab_ids: [2048, 2050, 2051] },
          output: {
            success: true,
            operationType: 'close',
            message: 'Closed 3 tabs',
            closedCount: 3
          }
        },
        {
          description: 'Clean up all non-work tabs',
          input: { operationType: 'close', tab_ids: [2052, 3009, 3011, 3012, 3013] },
          output: {
            success: true,
            operationType: 'close',
            message: 'Closed 5 tabs',
            closedCount: 5
          }
        }
      ],
      streamingConfig: {
        displayName: 'Tab Operations',
        icon: '🗂️',
        progressMessage: 'Performing tab operation...'
      }
    };

    super(config, executionContext);
  }

  /**
   * Override: Generate contextual display message based on operation
   */
  getProgressMessage(args: TabOperationsInput): string {
    try {
      // Note: args should already be parsed by StreamEventProcessor, but we keep this defensive check
      const operationType = args?.operationType;

      switch (operationType) {
        case 'list_tabs_in_window':
          return 'Listing tabs from current window';
        case 'list_tabs_across_windows':
          return 'Listing tabs from all windows';
        case 'new':
          return 'Creating new blank tab';
        case 'switch_to':
          const switchTabId = args?.tab_ids?.[0];
          return switchTabId ? `Switching to tab ${switchTabId}` : 'Switching to tab';
        case 'close':
          const count = args?.tab_ids?.length || 0;
          return `Closing ${count} tab${count === 1 ? '' : 's'}`;
        default:
          return 'Performing tab operation...';
      }
    } catch {
      return 'Performing tab operation...';
    }
  }

  /**
   * Override: Format result based on operation type
   */
  FormatResultForUI(output: TabOperationsOutput): string {
    if (!output.success) {
      return `❌ ${output.message}`;
    }

    switch (output.operationType) {
      case 'list_tabs_in_window':
      case 'list_tabs_across_windows':
        const tabs = output.tabs || [];
        const count = tabs.length;
        const maxTabs = 5; // Show first 5 tabs
        
        let result = `📑 Found ${count} tab${count === 1 ? '' : 's'}`;
        
        if (count > 0) {
          result += ':\n';
          const tabsToShow = tabs.slice(0, maxTabs);
          tabsToShow.forEach(tab => {
            const hostname = tab.url ? new URL(tab.url).hostname : 'unknown';
            const title = tab.title || 'Untitled';
            const truncatedTitle = title.length > 40 ? title.substring(0, 40) + '...' : title;
            result += `- ${truncatedTitle} (${hostname})\n`;
          });
          
          if (count > maxTabs) {
            result += `  ... and ${count - maxTabs} more`;
          }
        }
        
        return result.trim();
      
      case 'new':
        return `✅ Created new blank tab (ID: ${output.tabId})`;
      
      case 'switch_to':
        return `🔄 Switched to tab ${output.tabId}`;
      
      case 'close':
        return `✅ Closed ${output.closedCount} tab${
          output.closedCount === 1 ? "" : "s"
        }`;
      
      default:
        return `✅ ${output.message}`;
    }
  }

  protected async execute(input: TabOperationsInput): Promise<TabOperationsOutput> {
    // Validate inputs for operations that need them
    switch (input.operationType) {
      case 'switch_to':
        if (!input.tab_ids || input.tab_ids.length === 0) {
          return {
            success: false,
            operationType: input.operationType,
            message: 'switch_to operation requires at least one tab_id'
          };
        }
        break;
      case 'close':
        if (!input.tab_ids || input.tab_ids.length === 0) {
          return {
            success: false,
            operationType: input.operationType,
            message: 'close operation requires at least one tab_id'
          };
        }
        break;
    }

    // Execute the operation
    switch (input.operationType) {
      case 'list_tabs_in_window':
        return this.listTabs(false);
      case 'list_tabs_across_windows':
        return this.listTabs(true);
      case 'new':
        return this.createNewTab();
      case 'switch_to':
        return this.switchToTab(input.tab_ids![0]);
      case 'close':
        return this.closeTabs(input.tab_ids!);
      default:
        return {
          success: false,
          operationType: 'list_tabs_in_window',
          message: 'Invalid operation type specified'
        };
    }
  }

  /**
   * List tabs
   */
  private async listTabs(allWindows: boolean): Promise<TabOperationsOutput> {
    try {
      const queryOptions: chrome.tabs.QueryInfo = {};
      
      if (!allWindows) {
        const currentWindow = await this.browserContext.getCurrentWindow();
        queryOptions.windowId = currentWindow.id;
      }

      const tabs = await chrome.tabs.query(queryOptions);
      
      const tabInfos: TabInfo[] = tabs
        .filter(tab => tab.id !== undefined && tab.url && tab.title)
        .map(tab => ({
          id: tab.id!,
          title: tab.title!,
          url: tab.url!,
          active: tab.active
        }));

      const location = allWindows ? 'across all windows' : 'in current window';
      const operationType = allWindows ? 'list_tabs_across_windows' : 'list_tabs_in_window';

      return {
        success: true,
        operationType: operationType as TabOperationType,
        message: `Found ${tabInfos.length} tab${tabInfos.length === 1 ? '' : 's'} ${location}`,
        tabs: tabInfos
      };
    } catch (error) {
      return {
        success: false,
        operationType: allWindows ? 'list_tabs_across_windows' : 'list_tabs_in_window',
        message: `Failed to list tabs: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }

  /**
   * Create a new blank tab
   */
  private async createNewTab(): Promise<TabOperationsOutput> {
    try {
      // Use browserContext.openTab for proper tab management
      const page = await this.browserContext.openTab('chrome://newtab/');
      
      return {
        success: true,
        operationType: 'new',
        message: `Created new blank tab`,
        tabId: page.tabId,
        url: 'chrome://newtab/'
      };
    } catch (error) {
      return {
        success: false,
        operationType: 'new',
        message: `Failed to create new tab: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }

  /**
   * Switch to a specific tab
   */
  private async switchToTab(tabId: number): Promise<TabOperationsOutput> {
    try {
      // Use browserContext.switchTab for proper tab management
      await this.browserContext.switchTab(tabId);
      
      // Get tab info for confirmation message
      const tab = await chrome.tabs.get(tabId);
      
      return {
        success: true,
        operationType: 'switch_to',
        message: `Switched to tab: ${tab.title}`,
        tabId: tabId
      };
    } catch (error) {
      return {
        success: false,
        operationType: 'switch_to',
        message: `Failed to switch to tab ${tabId}: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }

  /**
   * Close tabs
   */
  private async closeTabs(tabIds: number[]): Promise<TabOperationsOutput> {
    try {
      // Verify tabs exist before closing
      const allTabs = await chrome.tabs.query({});
      const validTabIds = tabIds.filter(tabId => 
        allTabs.some(tab => tab.id === tabId)
      );

      if (validTabIds.length === 0) {
        return {
          success: true,
          operationType: 'close',
          message: 'No valid tabs found to close',
          closedCount: 0
        };
      }

      // Close tabs using browserContext.closeTab for proper cleanup
      let closedCount = 0;
      for (const tabId of validTabIds) {
        try {
          await this.browserContext.closeTab(tabId);
          closedCount++;
        } catch (error) {
          // Log individual tab close errors but continue with others
          console.warn(`Failed to close tab ${tabId}: ${error}`);
        }
      }

      return {
        success: true,
        operationType: 'close',
        message: `Closed ${closedCount} tab${closedCount === 1 ? '' : 's'}`,
        closedCount: closedCount
      };
    } catch (error) {
      return {
        success: false,
        operationType: 'close',
        message: `Failed to close tabs: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }
} 
