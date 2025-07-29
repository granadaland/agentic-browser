import { z } from 'zod';
import { NxtscapeTool } from '../base/NxtscapeTool';
import { ToolConfig } from '../base/ToolConfig';
import { ExecutionContext } from '@/lib/runtime/ExecutionContext';

/**
 * Schema for get history input
 */
export const GetHistoryInputSchema = z.object({
  startDate: z.string().describe('Start date for history retrieval (ISO format, e.g., 2024-01-01)'),
  endDate: z.string().optional().describe('End date for history retrieval (ISO format). If not provided, uses current date'),
  filter: z.string().optional().describe('Optional filter to match against page titles and URLs (case-insensitive)'),
  limit: z.number().min(1).max(10000).default(1000).optional().describe('Maximum number of history items to retrieve')
});

export type GetHistoryInput = z.infer<typeof GetHistoryInputSchema>;

/**
 * Schema for history result item
 */
export const HistoryResultItemSchema = z.object({
  url: z.string(),  // URL of the page
  title: z.string(),  // Title of the page
  date: z.string(),  // ISO date string of when the page was visited
  visitCount: z.number(),  // Number of times this page was visited
  lastVisitTime: z.string()  // ISO string of the last visit time
});

export type HistoryResultItem = z.infer<typeof HistoryResultItemSchema>;

/**
 * Schema for get history output
 */
export const GetHistoryOutputSchema = z.object({
  success: z.boolean(),
  data: z.array(HistoryResultItemSchema).optional().describe('Array of unique history items'),
  summary: z.object({
    totalItems: z.number(),  // Total number of unique items returned
    dateRange: z.string(),  // Human-readable date range
    duplicatesRemoved: z.number()  // Number of duplicate entries that were removed
  }).optional(),
  message: z.string()
});

export type GetHistoryOutput = z.infer<typeof GetHistoryOutputSchema>;

/**
 * Tool for retrieving browser history with date filtering and duplicate removal
 */
export class GetHistoryTool extends NxtscapeTool<GetHistoryInput, GetHistoryOutput> {
  constructor(executionContext: ExecutionContext) {
    const config: ToolConfig<GetHistoryInput, GetHistoryOutput> = {
      name: 'get_history',
      description: 'Retrieve browser history within a date range with duplicate removal. Returns URL, title, date, and visit statistics.',
      category: 'observation',
      version: '1.0.0',
      inputSchema: GetHistoryInputSchema,
      outputSchema: GetHistoryOutputSchema,
      examples: [
        {
          description: 'Get history for the last week',
          input: { 
            startDate: '2024-01-15',
            endDate: '2024-01-22',
            limit: 500
          },
          output: {
            success: true,
            data: [
              {
                url: 'https://github.com/user/repo',
                title: 'GitHub Repository',
                date: '2024-01-20',
                visitCount: 5,
                lastVisitTime: '2024-01-20T14:30:00.000Z'
              },
              {
                url: 'https://stackoverflow.com/questions/12345',
                title: 'How to use React hooks?',
                date: '2024-01-19',
                visitCount: 2,
                lastVisitTime: '2024-01-19T10:15:00.000Z'
              }
            ],
            summary: {
              totalItems: 2,
              dateRange: 'Jan 15, 2024 - Jan 22, 2024',
              duplicatesRemoved: 3
            },
            message: 'Successfully retrieved 2 unique history items from Jan 15, 2024 to Jan 22, 2024'
          }
        },
        {
          description: 'Get GitHub-related history',
          input: { 
            startDate: '2024-01-15',
            endDate: '2024-01-22',
            filter: 'github'
          },
          output: {
            success: true,
            data: [
              {
                url: 'https://github.com/user/repo',
                title: 'GitHub Repository',
                date: '2024-01-20',
                visitCount: 5,
                lastVisitTime: '2024-01-20T14:30:00.000Z'
              }
            ],
            summary: {
              totalItems: 1,
              dateRange: 'Jan 15, 2024 - Jan 22, 2024',
              duplicatesRemoved: 0
            },
            message: 'Successfully retrieved 1 unique history items matching "github" from Jan 15, 2024 to Jan 22, 2024'
          }
        },
        {
          description: 'Get today\'s history',
          input: { 
            startDate: '2024-01-22'
          },
          output: {
            success: true,
            data: [
              {
                url: 'https://docs.example.com',
                title: 'API Documentation',
                date: '2024-01-22',
                visitCount: 8,
                lastVisitTime: '2024-01-22T16:45:00.000Z'
              }
            ],
            summary: {
              totalItems: 1,
              dateRange: 'Jan 22, 2024 - Jan 22, 2024',
              duplicatesRemoved: 0
            },
            message: 'Successfully retrieved 1 unique history item for Jan 22, 2024'
          }
        }
      ],
      streamingConfig: {
        displayName: 'Get History',
        icon: '📅',
        progressMessage: 'Retrieving browser history...'
      }
    };

    super(config, executionContext);
  }

  /**
   * Override: Generate contextual display message
   */
  getProgressMessage(args: GetHistoryInput): string {
    try {
      // Note: args should already be parsed by StreamEventProcessor

      const startDate = args?.startDate;
      const endDate = args?.endDate;
      const filter = args?.filter;
      
      let message = '';
      if (startDate && endDate) {
        message = `Getting history from ${startDate} to ${endDate}`;
      } else if (startDate) {
        message = `Getting history from ${startDate} to now`;
      } else {
        message = 'Getting browser history...';
      }
      
      if (filter) {
        message += ` matching "${filter}"`;
      }
      
      return message;
    } catch {
      return 'Getting browser history...';
    }
  }

  /**
   * Override: Format history result for display
   */
  FormatResultForUI(output: GetHistoryOutput): string {
    if (!output.success) {
      return `❌ ${output.message}`;
    }
    
    if (output.summary) {
      const { totalItems, dateRange, duplicatesRemoved } = output.summary;
      let result = `✅ Retrieved ${totalItems} unique history items`;
      
      if (duplicatesRemoved > 0) {
        result += ` (${duplicatesRemoved} duplicates removed)`;
      }
      
      result += ` from ${dateRange}`;
      
      return result;
    }
    
    return '✅ ' + output.message;
  }

  protected async execute(input: GetHistoryInput): Promise<GetHistoryOutput> {
    try {
      // Parse and validate dates
      const startDate = new Date(input.startDate);
      const endDate = input.endDate ? new Date(input.endDate) : new Date();
      
      if (isNaN(startDate.getTime())) {
        return {
          success: false,
          message: 'Invalid start date format. Please use ISO format (YYYY-MM-DD)'
        };
      }
      
      if (input.endDate && isNaN(endDate.getTime())) {
        return {
          success: false,
          message: 'Invalid end date format. Please use ISO format (YYYY-MM-DD)'
        };
      }
      
      if (endDate <= startDate) {
        return {
          success: false,
          message: 'End date must be after start date'
        };
      }

      // Set time boundaries
      const startTime = startDate.getTime();
      const endTime = endDate.getTime();
      
      // Fetch history items
      const rawHistoryItems = await this.fetchHistory(startTime, endTime, input.limit || 1000);
      
      if (rawHistoryItems.length === 0) {
        const dateRange = this.formatDateRange(startDate, endDate);
        const filterText = input.filter ? ` matching "${input.filter}"` : '';
        return {
          success: true,
          data: [],
          summary: {
            totalItems: 0,
            dateRange,
            duplicatesRemoved: 0
          },
          message: `No browsing history found${filterText} for ${dateRange}`
        };
      }

      // Remove duplicates and format results
      const { uniqueItems, duplicatesCount } = this.removeDuplicatesAndFormat(rawHistoryItems);
      
      // Apply filter if provided
      let filteredItems = uniqueItems;
      if (input.filter) {
        const filterLower = input.filter.toLowerCase();
        filteredItems = uniqueItems.filter(item => 
          item.title.toLowerCase().includes(filterLower) || 
          item.url.toLowerCase().includes(filterLower)
        );
      }
      
      const dateRange = this.formatDateRange(startDate, endDate);
      const filterText = input.filter ? ` matching "${input.filter}"` : '';
      
      return {
        success: true,
        data: filteredItems,
        summary: {
          totalItems: filteredItems.length,
          dateRange,
          duplicatesRemoved: duplicatesCount
        },
        message: `Successfully retrieved ${filteredItems.length} unique history items${filterText} from ${dateRange}`
      };
    } catch (error) {
      console.error('[get_history] Error:', error);
      return {
        success: false,
        message: `Error retrieving history: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }

  /**
   * Fetch history items from Chrome API
   */
  private async fetchHistory(startTime: number, endTime: number, maxResults: number): Promise<chrome.history.HistoryItem[]> {
    return new Promise((resolve, reject) => {
      chrome.history.search({
        text: '',  // Empty string to get all history
        startTime,
        endTime,
        maxResults
      }, (items) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }

        resolve(items || []);
      });
    });
  }

  /**
   * Remove duplicates based on URL and format results
   */
  private removeDuplicatesAndFormat(historyItems: chrome.history.HistoryItem[]): {
    uniqueItems: HistoryResultItem[];
    duplicatesCount: number;
  } {
    const urlMap = new Map<string, HistoryResultItem>();
    let duplicatesCount = 0;

    // Process each history item
    historyItems.forEach(item => {
      if (!item.url) return;

      const existingItem = urlMap.get(item.url);
      
      if (existingItem) {
        // This is a duplicate URL
        duplicatesCount++;
        
        // Update existing item with the most recent visit time and higher visit count
        if (item.lastVisitTime && item.lastVisitTime > new Date(existingItem.lastVisitTime).getTime()) {
          existingItem.lastVisitTime = new Date(item.lastVisitTime).toISOString();
          existingItem.date = new Date(item.lastVisitTime).toISOString().split('T')[0];
        }
        
        // Add visit counts
        existingItem.visitCount += (item.visitCount || 0);
      } else {
        // This is a new unique URL
        const visitTime = item.lastVisitTime || Date.now();
        urlMap.set(item.url, {
          url: item.url,
          title: item.title || 'Untitled',
          date: new Date(visitTime).toISOString().split('T')[0],
          visitCount: item.visitCount || 1,
          lastVisitTime: new Date(visitTime).toISOString()
        });
      }
    });

    // Convert map to array and sort by last visit time (most recent first)
    const uniqueItems = Array.from(urlMap.values()).sort((a, b) => 
      new Date(b.lastVisitTime).getTime() - new Date(a.lastVisitTime).getTime()
    );

    return {
      uniqueItems,
      duplicatesCount
    };
  }

  /**
   * Format date range for display
   */
  private formatDateRange(startDate: Date, endDate: Date): string {
    const formatOptions: Intl.DateTimeFormatOptions = { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric' 
    };
    
    const startFormatted = startDate.toLocaleDateString('en-US', formatOptions);
    const endFormatted = endDate.toLocaleDateString('en-US', formatOptions);
    
    // If same day, show just one date
    if (startDate.toDateString() === endDate.toDateString()) {
      return startFormatted;
    }
    
    return `${startFormatted} - ${endFormatted}`;
  }
} 
