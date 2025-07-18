import { z } from 'zod';
import { NxtscapeTool } from '../base/NxtscapeTool';
import { ToolConfig } from '../base/ToolConfig';
import { ExecutionContext } from '@/lib/runtime/ExecutionContext';
import { getBookmarkBar, getFolderPath } from './common';

/**
 * Input schema for bookmark management tool
 */
export const BookmarkManagementInputSchema = z.object({
  operationType: z.enum(['get']),  // The operation to perform
  
  // For 'get'
  folder_id: z.string().optional()  // Which folder to get bookmarks from (defaults to bookmark bar)
});

export type BookmarkManagementInput = z.infer<typeof BookmarkManagementInputSchema>;

/**
 * Output schema for bookmark management tool
 */
export const BookmarkManagementOutputSchema = z.object({
  success: z.boolean(),
  message: z.string()
});

export type BookmarkManagementOutput = z.infer<typeof BookmarkManagementOutputSchema>;

/**
 * Tool for managing existing bookmarks - get and move operations
 */
export class BookmarkManagementTool extends NxtscapeTool<BookmarkManagementInput, BookmarkManagementOutput> {
  constructor(executionContext: ExecutionContext) {
    const config: ToolConfig<BookmarkManagementInput, BookmarkManagementOutput> = {
      name: 'bookmark_management',
      description: 'List existing bookmarks. Operation: "get" (list bookmarks from a folder recursively). Use folder_id to specify a folder, or leave empty for bookmark bar.',
      category: 'bookmarks',
      version: '1.0.0',
      inputSchema: BookmarkManagementInputSchema,
      outputSchema: BookmarkManagementOutputSchema,
      examples: [
        // Get operations
        {
          description: 'Get all bookmarks from bookmark bar to see what\'s saved',
          input: { 
            operationType: 'get'
          },
          output: {
            success: true,
            message: 'Found 47 bookmarks in bookmark bar'
          }
        },
        {
          description: 'Get bookmarks from Work folder to find project resources',
          input: { 
            operationType: 'get',
            folder_id: 'folder_work_2341'
          },
          output: {
            success: true,
            message: 'Found 23 bookmarks in Work folder'
          }
        },
        {
          description: 'Get bookmarks from Development Resources folder',
          input: { 
            operationType: 'get',
            folder_id: 'folder_dev_8765'
          },
          output: {
            success: true,
            message: 'Found 156 bookmarks in Development Resources folder'
          }
        }
      ],
      streamingConfig: {
        displayName: 'Bookmark Management',
        icon: '📚',
        progressMessage: 'Processing bookmark operation...'
      }
    };

    super(config, executionContext);
  }

  /**
   * Override: Generate contextual display message
   */
  getProgressMessage(args: BookmarkManagementInput): string {
    try {
      // Note: args should already be parsed by StreamEventProcessor

      const operationType = args?.operationType;
      
      switch (operationType) {
        case 'get':
          return 'Getting bookmarks...';
          
        default:
          return 'Processing bookmark operation...';
      }
    } catch {
      return 'Processing bookmark operation...';
    }
  }

  /**
   * Override: Format result for display
   */
  FormatResultForUI(output: BookmarkManagementOutput): string {
    if (output.success) {
      return `✅ ${output.message}`;
    }
    return `❌ ${output.message}`;
  }

  protected async execute(input: BookmarkManagementInput): Promise<BookmarkManagementOutput> {
    try {
      switch (input.operationType) {
        case 'get':
          return await this.executeGet(input);
        default:
          return {
            success: false,
            message: 'Invalid operation type'
          };
      }
    } catch (error) {
      console.error('[bookmark_management] Error:', error);
      return {
        success: false,
        message: `Error: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }

  /**
   * Execute get operation - always recursive
   */
  private async executeGet(input: BookmarkManagementInput): Promise<BookmarkManagementOutput> {
    const folderId = input.folder_id;

    let startFolder: chrome.bookmarks.BookmarkTreeNode;
    let folderName: string;

    if (folderId) {
      try {
        const folders = await chrome.bookmarks.get(folderId);
        startFolder = folders[0];
        if (startFolder.url) {
          return {
            success: false,
            message: 'Specified ID is not a folder'
          };
        }
        folderName = startFolder.title;
      } catch {
        return {
          success: false,
          message: 'Folder not found'
        };
      }
    } else {
      const bookmarkBar = await getBookmarkBar();
      if (!bookmarkBar) {
        return {
          success: false,
          message: 'Could not find bookmark bar'
        };
      }
      startFolder = bookmarkBar;
      folderName = 'bookmark bar';
    }

    // Collect bookmarks recursively
    const bookmarkCount = await this.countBookmarksRecursively(startFolder);

    return {
      success: true,
      message: `Found ${bookmarkCount} bookmark${bookmarkCount === 1 ? '' : 's'} in ${folderName}`
    };
  }

  /**
   * Count bookmarks recursively
   */
  private async countBookmarksRecursively(folder: chrome.bookmarks.BookmarkTreeNode): Promise<number> {
    let count = 0;
    const children = await chrome.bookmarks.getChildren(folder.id);
    
    for (const child of children) {
      if (child.url) {
        // It's a bookmark
        count++;
      } else {
        // It's a folder - recurse
        count += await this.countBookmarksRecursively(child);
      }
    }
    
    return count;
  }
} 
