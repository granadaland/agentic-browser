import { z } from 'zod';
import { NxtscapeTool } from '../base/NxtscapeTool';
import { ToolConfig } from '../base/ToolConfig';
import { ExecutionContext } from '@/lib/runtime/ExecutionContext';
import { getFolderPath } from './common';

/**
 * Input schema for save bookmark tool
 */
export const SaveBookmarkInputSchema = z.object({
  folder_id: z.string(),  // Required - where to save
  tab_id: z.number().optional()  // Optional - defaults to current tab
});

export type SaveBookmarkInput = z.infer<typeof SaveBookmarkInputSchema>;

/**
 * Output schema for save bookmark tool
 */
export const SaveBookmarkOutputSchema = z.object({
  success: z.boolean(),
  message: z.string()
});

export type SaveBookmarkOutput = z.infer<typeof SaveBookmarkOutputSchema>;

/**
 * Tool for saving tabs as bookmarks - simple and focused
 */
export class SaveBookmarkTool extends NxtscapeTool<SaveBookmarkInput, SaveBookmarkOutput> {
  constructor(executionContext: ExecutionContext) {
    const config: ToolConfig<SaveBookmarkInput, SaveBookmarkOutput> = {
      name: 'save_bookmark',
      description: 'Save a browser tab as a bookmark. Saves current tab by default, or specify tab_id for a specific tab. Always requires folder_id.',
      category: 'bookmarks',
      version: '1.0.0',
      inputSchema: SaveBookmarkInputSchema,
      outputSchema: SaveBookmarkOutputSchema,
      examples: [
        {
          description: 'Save current tab to a folder',
          input: { 
            folder_id: 'folder_123'
          },
          output: {
            success: true,
            message: 'Successfully saved "React Documentation" to Bookmarks Bar/Development'
          }
        },
        {
          description: 'Save specific tab to a folder',
          input: { 
            folder_id: 'folder_456',
            tab_id: 5
          },
          output: {
            success: true,
            message: 'Successfully saved "TypeScript Guide" to Bookmarks Bar/Learning'
          }
        }
      ],
      streamingConfig: {
        displayName: 'Save Bookmark',
        icon: '🔖',
        progressMessage: 'Saving bookmark...'
      }
    };

    super(config, executionContext);
  }

  /**
   * Override: Generate contextual display message
   */
  getProgressMessage(args: SaveBookmarkInput): string {
    try {
      // Note: args should already be parsed by StreamEventProcessor

      if (args?.tab_id) {
        return `Saving tab ${args.tab_id} as bookmark...`;
      }
      return 'Saving current tab as bookmark...';
    } catch {
      return 'Saving bookmark...';
    }
  }

  /**
   * Override: Format result for display
   */
  FormatResultForUI(output: SaveBookmarkOutput): string {
    if (output.success) {
      return `✅ ${output.message}`;
    }
    return `❌ ${output.message}`;
  }

  protected async execute(input: SaveBookmarkInput): Promise<SaveBookmarkOutput> {
    const { folder_id, tab_id } = input;

    try {
      // Verify the folder exists and is valid
      let folderPath: string;
      try {
        const folders = await chrome.bookmarks.get(folder_id);
        const folder = folders[0];
        if (folder.url) {
          return {
            success: false,
            message: 'Specified ID is not a folder'
          };
        }
        folderPath = await getFolderPath(folder_id);
      } catch {
        return {
          success: false,
          message: 'Folder not found'
        };
      }

      // Get the tab to save
      let tabToSave: chrome.tabs.Tab | null = null;

      if (tab_id !== undefined) {
        // Get specific tab by ID
        try {
          tabToSave = await chrome.tabs.get(tab_id);
          if (!tabToSave.url || !tabToSave.title) {
            return {
              success: false,
              message: `Tab ${tab_id} is not a valid tab to bookmark`
            };
          }
        } catch {
          return {
            success: false,
            message: `Tab ${tab_id} not found`
          };
        }
      } else {
        // Get current active tab
        const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
        if (tabs.length === 0) {
          return {
            success: false,
            message: 'No active tab found'
          };
        }
        tabToSave = tabs[0];
        if (!tabToSave.url || !tabToSave.title) {
          return {
            success: false,
            message: 'Current tab cannot be bookmarked'
          };
        }
      }

      // Create the bookmark
      const bookmark = await chrome.bookmarks.create({
        parentId: folder_id,
        title: tabToSave.title,
        url: tabToSave.url
      });

      return {
        success: true,
        message: `Successfully saved "${tabToSave.title}" to ${folderPath}`
      };
    } catch (error) {
      console.error('[save_bookmark] Error:', error);
      return {
        success: false,
        message: `Failed to save bookmark: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }
} 
