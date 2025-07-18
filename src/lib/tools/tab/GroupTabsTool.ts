import { z } from 'zod';
import { NxtscapeTool } from '../base/NxtscapeTool';
import { ToolConfig } from '../base/ToolConfig';
import { ExecutionContext } from '@/lib/runtime/ExecutionContext';
import { TabInfo } from './TabOperationsTool';

/**
 * Schema for group tabs input
 */
export const GroupTabsInputSchema = z.object({
  tabIds: z.array(z.number()).min(1),  // Array of tab IDs to group (at least 1 required)
  groupName: z.string().optional(),  // Optional name for the group
  color: z.enum(['grey', 'blue', 'red', 'yellow', 'green', 'pink', 'purple', 'cyan', 'orange']).optional(),  // Group color
  windowId: z.number().optional()  // Optional window ID where group should be created
});

export type GroupTabsInput = z.infer<typeof GroupTabsInputSchema>;

/**
 * Schema for group tabs output
 */
export const GroupTabsOutputSchema = z.object({
  success: z.boolean(),  // Whether the operation succeeded
  groupId: z.number().optional(),  // ID of the created group
  groupName: z.string().optional(),  // Name of the group
  color: z.string(),  // Color of the group
  tabCount: z.number(),  // Number of tabs in the group
  message: z.string()  // Human-readable summary message
});

export type GroupTabsOutput = z.infer<typeof GroupTabsOutputSchema>;

/**
 * Tool for grouping browser tabs together
 */
export class GroupTabsTool extends NxtscapeTool<GroupTabsInput, GroupTabsOutput> {
  constructor(executionContext: ExecutionContext) {
    const config: ToolConfig<GroupTabsInput, GroupTabsOutput> = {
      name: 'group_tabs',
      description: 'Group browser tabs together. Takes an array of tab IDs and creates a group with optional name and color. Colors: grey, blue, red, yellow, green, pink, purple, cyan, orange.',
      category: 'tab_management',
      version: '1.0.0',
      inputSchema: GroupTabsInputSchema,
      outputSchema: GroupTabsOutputSchema,
      examples: [
        {
          description: 'Group work-related tabs with a blue color',
          input: { 
            tabIds: [123, 456], 
            groupName: 'Work Research',
            color: 'blue' 
          },
          output: {
            success: true,
            groupId: 1,
            groupName: 'Work Research',
            groupedCount: 2,
            groupedTabs: [
              { id: 123, title: 'GitHub', url: 'https://github.com' },
              { id: 456, title: 'Documentation', url: 'https://docs.example.com' }
            ],
            message: 'Successfully grouped 2 tabs into "Work Research"'
          }
        }
      ],
      streamingConfig: {
        displayName: 'Group Tabs',
        icon: '📁',
        progressMessage: 'Organizing tabs into groups...'
      }
    };

    super(config, executionContext);
  }

  /**
   * Override: Generate contextual display message based on arguments
   */
  getProgressMessage(args: GroupTabsInput): string {
    try {
      // Parse args safely
      // Note: args should already be parsed by StreamEventProcessor

      const tabIds = args?.tabIds;
      const groupName = args?.groupName;

      if (tabIds && Array.isArray(tabIds)) {
        const count = tabIds.length;
        const tabText = count === 1 ? 'tab' : 'tabs';
        
        if (groupName) {
          return `Grouping ${count} ${tabText} into "${groupName}"`;
        }
        
        return `Grouping ${count} ${tabText}`;
      }

      return 'Organizing tabs into groups...'; // Fallback to default
    } catch {
      return 'Organizing tabs into groups...'; // Fallback on any error
    }
  }

  /**
   * Override: Format group creation result for display
   * Returns user-friendly group creation information
   */
  FormatResultForUI(output: GroupTabsOutput): string {
    if (!output.success) {
      return `❌ ${output.message}`;
    }
    
    const tabCount = output.tabCount;
    const tabText = tabCount === 1 ? 'tab' : 'tabs';
    
    if (output.groupName) {
      return `📁 Created "${output.groupName}" group with ${tabCount} ${tabText}`;
    }
    
    return `📁 Grouped ${tabCount} ${tabText} together`;
  }

  protected async execute(input: GroupTabsInput): Promise<GroupTabsOutput> {
    try {
      // Validate that all tab IDs exist
      const allTabs = await this.getAllTabs(input.windowId);
      const validTabIds = input.tabIds.filter(tabId => 
        allTabs.some(tab => tab.id === tabId)
      );

      if (validTabIds.length === 0) {
        return {
          success: false,
          color: input.color || 'blue',
          tabCount: 0,
          message: `No valid tabs found for the provided tab IDs: ${input.tabIds.join(', ')}`
        };
      }

      if (validTabIds.length !== input.tabIds.length) {
        const invalidIds = input.tabIds.filter(id => !validTabIds.includes(id));
        console.warn(`[group_tabs] Some tab IDs were invalid and skipped: ${invalidIds.join(', ')}`);
      }

      // Create the group with the valid tab IDs
      const groupOptions: chrome.tabs.GroupOptions = {
        tabIds: validTabIds
      };

      if (input.windowId) {
        groupOptions.createProperties = { windowId: input.windowId };
      }

      // Group the tabs
      const groupId = await chrome.tabs.group(groupOptions);

      // Update group properties if name or color specified
      const color = input.color || 'blue';
      
      // Check if chrome.tabGroups API is available
      if (chrome.tabGroups && chrome.tabGroups.update) {
        const updateProperties: chrome.tabGroups.UpdateProperties = {
          color: color
        };

        if (input.groupName) {
          updateProperties.title = input.groupName;
        }

        await chrome.tabGroups.update(groupId, updateProperties);
      } else {
        console.warn('[group_tabs] chrome.tabGroups API not available, cannot set group properties');
      }

      return {
        success: true,
        groupId,
        groupName: input.groupName,
        color,
        tabCount: validTabIds.length,
        message: `Successfully created group${input.groupName ? ` "${input.groupName}"` : ''} with ${validTabIds.length} tab(s)`
      };
    } catch (error) {
      console.error('[group_tabs] Error:', error);
      return {
        success: false,
        color: input.color || 'blue',
        tabCount: 0,
        message: `Error grouping tabs: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }

  /**
   * Get all tabs with their information
   */
  private async getAllTabs(windowId?: number): Promise<TabInfo[]> {
    const queryOptions: chrome.tabs.QueryInfo = {};
    if (windowId !== undefined) {
      queryOptions.windowId = windowId;
    }

    // get window id from current tab
    // we should only group tabs on the same window
    const currentTab = await chrome.tabs.getCurrent();
    if (currentTab && windowId === undefined) {
      windowId = currentTab.windowId;
    }
    
    const tabs = await chrome.tabs.query(queryOptions);
    
    return tabs
      .filter(tab => tab.id !== undefined && tab.url && tab.title)
      .map(tab => ({
        id: tab.id!,
        url: tab.url!,
        title: tab.title!,
        active: tab.active || false,
        windowId: tab.windowId || 0
      }));
  }
} 
