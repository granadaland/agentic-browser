import { z } from 'zod';
import { NxtscapeTool } from '../base/NxtscapeTool';
import { ToolConfig } from '../base/ToolConfig';
import { ExecutionContext } from '@/lib/runtime/ExecutionContext';
import { Logging } from '@/lib/utils/Logging';

/**
 * Schema for get selected tabs input
 */
export const GetSelectedTabsInputSchema = z.object({
  // No input required - simplified version
});

export type GetSelectedTabsInput = z.infer<typeof GetSelectedTabsInputSchema>;

/**
 * Schema for tab information (simplified V2)
 */
export const TabInfoSchema = z.object({
  id: z.number(),  // Tab ID
  url: z.string(),  // Current URL
  title: z.string()  // Page title
});

export type TabInfo = z.infer<typeof TabInfoSchema>;

/**
 * Schema for get selected tabs output
 */
export const GetSelectedTabsOutputSchema = z.object({
  success: z.boolean(),  // Whether the operation succeeded
  tabs: z.array(TabInfoSchema),  // Array of tab information (id, url, title)
  count: z.number(),  // Number of tabs
  activeTab: TabInfoSchema.optional(),  // The currently active tab (if in the list)
  user_selected_tabs: z.boolean(),  // Whether these are user-selected tabs or current tab fallback
  message: z.string()  // Human-readable status message
});

export type GetSelectedTabsOutput = z.infer<typeof GetSelectedTabsOutputSchema>;

/**
 * Tool for getting information about selected tabs
 */
export class GetSelectedTabsTool extends NxtscapeTool<GetSelectedTabsInput, GetSelectedTabsOutput> {
  constructor(executionContext: ExecutionContext) {
    const config: ToolConfig<GetSelectedTabsInput, GetSelectedTabsOutput> = {
      name: 'get_selected_tabs',
      description: 'Get information about currently selected tabs including tab ID, URL, and title. Returns details about all tabs that are currently selected in the browser, or just the current tab if none are selected.',
      category: 'observation',
      version: '1.0.0',
      inputSchema: GetSelectedTabsInputSchema,
      outputSchema: GetSelectedTabsOutputSchema,
      examples: [
        {
          description: 'Get current tab information',
          input: {},
          output: {
            success: true,
            tabs: [
              {
                id: 123,
                url: 'https://example.com',
                title: 'Example Domain'
              }
            ],
            count: 1,
            activeTab: {
              id: 123,
              url: 'https://example.com',
              title: 'Example Domain'
            },
            user_selected_tabs: false,
            message: 'Retrieved information for 1 current tab'
          }
        },
        {
          description: 'Get information for user-selected tabs',
          input: {},
          output: {
            success: true,
            tabs: [
              {
                id: 123,
                url: 'https://example.com',
                title: 'Example Domain'
              },
              {
                id: 124,
                url: 'https://docs.example.com',
                title: 'Documentation'
              }
            ],
            count: 2,
            activeTab: {
              id: 123,
              url: 'https://example.com',
              title: 'Example Domain'
            },
            user_selected_tabs: true,
            message: 'Retrieved information for 2 selected tabs'
          }
        },
        {
          description: 'No tabs available',
          input: {},
          output: {
            success: true,
            tabs: [],
            count: 0,
            user_selected_tabs: false,
            message: 'No current tab available'
          }
        }
      ],
      streamingConfig: {
        displayName: 'Get Selected Tabs',
        icon: '📑',
        progressMessage: 'Retrieving tab information...'
      }
    };

    super(config, executionContext);
  }

  /**
   * Override: Generate contextual display message
   */
  getProgressMessage(args: GetSelectedTabsInput): string {
    return 'Retrieving selected tab information...';
  }

  /**
   * Override: Format tab information for display
   */
  FormatResultForUI(output: GetSelectedTabsOutput): string {
    if (!output.success) {
      return `❌ ${output.message}`;
    }
    
    if (output.tabs.length === 0) {
      return '📑 No tabs selected';
    }
    
    let result = `📑 **${output.count} tab${output.count > 1 ? 's' : ''}**\n\n`;
    
    output.tabs.forEach((tab, index) => {
      result += `${index + 1}. **${tab.title}**\n`;
      result += `   ${tab.url} (ID: ${tab.id})\n`;
      
      if (index < output.tabs.length - 1) {
        result += '\n';
      }
    });
    
    return result;
  }

  protected async execute(input: GetSelectedTabsInput): Promise<GetSelectedTabsOutput> {
    try {
      // Check if user has actually selected tabs
      const selectedTabIds = this.executionContext.getSelectedTabIds();
      const hasUserSelectedTabs = Boolean(selectedTabIds && selectedTabIds.length > 0);
      
      // Use getPages to get the BrowserPage objects
      const pages = await this.browserContext.getPages(selectedTabIds || undefined);
      
      if (pages.length === 0) {
        return {
          success: true,
          tabs: [],
          count: 0,
          user_selected_tabs: hasUserSelectedTabs,
          message: hasUserSelectedTabs ? 'No selected tabs available' : 'No current tab available'
        };
      }
      
      // Extract basic info from each page
      const tabs: TabInfo[] = await Promise.all(
        pages.map(async page => ({
          id: page.tabId,
          url: page.url(),
          title: await page.title()
        }))
      );
      
      // Find the active tab
      const currentPage = await this.browserContext.getCurrentPage();
      const activeTab = tabs.find(tab => tab.id === currentPage.tabId);
      
      const tabType = hasUserSelectedTabs ? 'selected' : 'current';
      const message = `Retrieved information for ${tabs.length} ${tabType} tab${tabs.length > 1 ? 's' : ''}`;
      
      return {
        success: true,
        tabs,
        count: tabs.length,
        activeTab,
        user_selected_tabs: hasUserSelectedTabs,
        message
      };
    } catch (error) {
      Logging.log('GetSelectedTabsTool', `Error: ${error}`, 'error');
      return {
        success: false,
        tabs: [],
        count: 0,
        user_selected_tabs: false,
        message: `Error retrieving tab information: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }
} 
