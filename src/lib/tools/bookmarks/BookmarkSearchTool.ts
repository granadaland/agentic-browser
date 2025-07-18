import { z } from 'zod';
import { NxtscapeTool } from '../base/NxtscapeTool';
import { ToolConfig } from '../base/ToolConfig';
import { ExecutionContext } from '@/lib/runtime/ExecutionContext';

/**
 * Input schema for bookmark search tool
 */
export const BookmarkSearchInputSchema = z.object({
  query: z.string(),  // Required - what to search for
  max_results: z.number().optional()  // Optional limit
});

export type BookmarkSearchInput = z.infer<typeof BookmarkSearchInputSchema>;

/**
 * Output schema for bookmark search tool
 */
export const BookmarkSearchOutputSchema = z.object({
  success: z.boolean(),
  message: z.string()
});

export type BookmarkSearchOutput = z.infer<typeof BookmarkSearchOutputSchema>;

/**
 * Tool for searching bookmarks - single purpose
 */
export class BookmarkSearchTool extends NxtscapeTool<BookmarkSearchInput, BookmarkSearchOutput> {
  constructor(executionContext: ExecutionContext) {
    const config: ToolConfig<BookmarkSearchInput, BookmarkSearchOutput> = {
      name: 'bookmark_search',
      description: 'Search for bookmarks by title or URL. Returns bookmarks matching the search query.',
      category: 'bookmarks',
      version: '1.0.0',
      inputSchema: BookmarkSearchInputSchema,
      outputSchema: BookmarkSearchOutputSchema,
      examples: [
        {
          description: 'Search for React-related bookmarks',
          input: { 
            query: 'react'
          },
          output: {
            success: true,
            message: 'Found 5 bookmarks matching "react"'
          }
        },
        {
          description: 'Search with limited results',
          input: { 
            query: 'typescript',
            max_results: 20
          },
          output: {
            success: true,
            message: 'Found 12 bookmarks matching "typescript"'
          }
        }
      ],
      streamingConfig: {
        displayName: 'Bookmark Search',
        icon: '🔍',
        progressMessage: 'Searching bookmarks...'
      }
    };

    super(config, executionContext);
  }

  /**
   * Override: Generate contextual display message
   */
  getProgressMessage(args: BookmarkSearchInput): string {
    try {
      // Note: args should already be parsed by StreamEventProcessor

      const query = args?.query;
      if (query) {
        return `Searching bookmarks for "${query}"...`;
      }
      return 'Searching bookmarks...';
    } catch {
      return 'Searching bookmarks...';
    }
  }

  /**
   * Override: Format result for display
   */
  FormatResultForUI(output: BookmarkSearchOutput): string {
    if (output.success) {
      return `✅ ${output.message}`;
    }
    return `❌ ${output.message}`;
  }

  protected async execute(input: BookmarkSearchInput): Promise<BookmarkSearchOutput> {
    const { query, max_results = 50 } = input;

    try {
      // Search bookmarks using Chrome's search API
      const searchResults = await chrome.bookmarks.search(query);
      
      // Filter out folders and limit results
      const bookmarkResults = searchResults
        .filter(item => item.url)
        .slice(0, max_results);

      const count = bookmarkResults.length;

      if (count === 0) {
        return {
          success: true,
          message: `No bookmarks found matching "${query}"`
        };
      }

      return {
        success: true,
        message: `Found ${count} bookmark${count === 1 ? '' : 's'} matching "${query}"`
      };
    } catch (error) {
      console.error('[bookmark_search] Error:', error);
      return {
        success: false,
        message: `Search failed: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }
} 
