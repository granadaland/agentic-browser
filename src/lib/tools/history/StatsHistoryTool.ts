import { z } from 'zod';
import { NxtscapeTool } from '../base/NxtscapeTool';
import { ToolConfig } from '../base/ToolConfig';
import { ExecutionContext } from '@/lib/runtime/ExecutionContext';

/**
 * Schema for stats type options
 */
export const StatsTypeSchema = z.enum([
  'domain',     // Group by domain (e.g., github.com, stackoverflow.com)
  'date',       // Group by date (e.g., 2024-01-15, 2024-01-16)
  'hour',       // Group by hour of day (e.g., 09:00, 14:00)
  'day_of_week', // Group by day of week (e.g., Monday, Tuesday)
  'title_words'  // Group by common words in titles
]);

export type StatsType = z.infer<typeof StatsTypeSchema>;

/**
 * Schema for stats history input
 */
export const StatsHistoryInputSchema = z.object({
  startDate: z.string().describe('Start date for history analysis (ISO format, e.g., 2024-01-01)'),
  endDate: z.string().optional().describe('End date for history analysis (ISO format). If not provided, uses current date'),
  statsType: z.array(StatsTypeSchema).min(1).describe('Type(s) of statistics to generate - can specify multiple for combined analysis'),
  filter: z.string().optional().describe('Optional filter to match against page titles and URLs before applying stats (case-insensitive)'),
  limit: z.number().min(1).max(10000).default(5000).optional().describe('Maximum number of history items to analyze'),
  topN: z.number().min(1).max(100).default(20).optional().describe('Return top N results for each stats type')
});

export type StatsHistoryInput = z.infer<typeof StatsHistoryInputSchema>;

/**
 * Schema for individual stat result
 */
export const StatResultSchema = z.object({
  key: z.string(),  // The grouping key (domain, date, etc.)
  count: z.number(),  // Number of visits
  percentage: z.number(),  // Percentage of total visits
  uniquePages: z.number(),  // Number of unique pages in this group
  totalTime: z.number().optional(),  // Total time spent (if available)
  topPages: z.array(z.object({
    url: z.string(),
    title: z.string(),
    visitCount: z.number()
  })).optional()  // Top pages in this group
});

export type StatResult = z.infer<typeof StatResultSchema>;

/**
 * Schema for stats group result
 */
export const StatsGroupSchema = z.object({
  statsType: StatsTypeSchema,  // Type of grouping
  results: z.array(StatResultSchema),  // Results for this grouping
  totalItems: z.number(),  // Total items analyzed for this grouping
  uniqueItems: z.number()  // Unique items in this grouping
});

export type StatsGroup = z.infer<typeof StatsGroupSchema>;

/**
 * Schema for stats history output
 */
export const StatsHistoryOutputSchema = z.object({
  success: z.boolean(),
  data: z.array(StatsGroupSchema).optional().describe('Array of statistical analyses by type'),
  summary: z.object({
    totalItemsAnalyzed: z.number(),  // Total history items analyzed
    dateRange: z.string(),  // Human-readable date range
    filterApplied: z.string().optional(),  // Filter that was applied
    duplicatesRemoved: z.number(),  // Number of duplicates removed
    analysisTypes: z.array(StatsTypeSchema)  // Types of analysis performed
  }).optional(),
  message: z.string()
});

export type StatsHistoryOutput = z.infer<typeof StatsHistoryOutputSchema>;

/**
 * Tool for generating statistical analysis of browser history
 */
export class StatsHistoryTool extends NxtscapeTool<StatsHistoryInput, StatsHistoryOutput> {
  constructor(executionContext: ExecutionContext) {
    const config: ToolConfig<StatsHistoryInput, StatsHistoryOutput> = {
      name: 'stats_history',
      description: 'Generate statistical analysis of browser history with flexible grouping (by domain, date, hour, etc.) and filtering capabilities.',
      category: 'observation',
      version: '1.0.0',
      inputSchema: StatsHistoryInputSchema,
      outputSchema: StatsHistoryOutputSchema,
      examples: [
        // Domain analysis example
        {
          description: 'Analyze most visited domains for the week',
          input: { 
            startDate: '2024-01-15',
            endDate: '2024-01-22',
            statsType: ['domain'],
            topN: 10
          },
          output: {
            success: true,
            data: [
              {
                statsType: 'domain',
                results: [
                  {
                    key: 'github.com',
                    count: 156,
                    percentage: 24.3,
                    uniquePages: 42,
                    topPages: [
                      {
                        url: 'https://github.com/facebook/react/pulls',
                        title: 'Pull Requests · facebook/react',
                        visitCount: 23
                      },
                      {
                        url: 'https://github.com/myorg/myrepo',
                        title: 'GitHub - myorg/myrepo: Project repository',
                        visitCount: 18
                      },
                      {
                        url: 'https://github.com/notifications',
                        title: 'Notifications',
                        visitCount: 15
                      }
                    ]
                  },
                  {
                    key: 'stackoverflow.com',
                    count: 89,
                    percentage: 13.9,
                    uniquePages: 67,
                    topPages: [
                      {
                        url: 'https://stackoverflow.com/questions/53332321/react-hook-warnings-for-async',
                        title: 'React Hook Warnings for async function in useEffect',
                        visitCount: 8
                      },
                      {
                        url: 'https://stackoverflow.com/questions/tagged/typescript',
                        title: 'Newest \'typescript\' Questions',
                        visitCount: 6
                      }
                    ]
                  },
                  {
                    key: 'developer.mozilla.org',
                    count: 76,
                    percentage: 11.8,
                    uniquePages: 34,
                    topPages: [
                      {
                        url: 'https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise',
                        title: 'Promise - JavaScript | MDN',
                        visitCount: 12
                      }
                    ]
                  }
                ],
                totalItems: 642,
                uniqueItems: 189
              }
            ],
            summary: {
              totalItemsAnalyzed: 642,
              dateRange: 'Jan 15, 2024 - Jan 22, 2024',
              duplicatesRemoved: 78,
              analysisTypes: ['domain']
            },
            message: 'Successfully analyzed 642 history items by domain from Jan 15, 2024 to Jan 22, 2024'
          }
        },
        // Date analysis example
        {
          description: 'Analyze browsing patterns by date',
          input: { 
            startDate: '2024-01-15',
            endDate: '2024-01-22',
            statsType: ['date'],
            topN: 7
          },
          output: {
            success: true,
            data: [
              {
                statsType: 'date',
                results: [
                  {
                    key: '2024-01-22',
                    count: 145,
                    percentage: 22.6,
                    uniquePages: 67
                  },
                  {
                    key: '2024-01-21',
                    count: 98,
                    percentage: 15.3,
                    uniquePages: 45
                  },
                  {
                    key: '2024-01-20',
                    count: 72,
                    percentage: 11.2,
                    uniquePages: 31
                  },
                  {
                    key: '2024-01-19',
                    count: 134,
                    percentage: 20.9,
                    uniquePages: 58
                  },
                  {
                    key: '2024-01-18',
                    count: 89,
                    percentage: 13.9,
                    uniquePages: 42
                  },
                  {
                    key: '2024-01-17',
                    count: 67,
                    percentage: 10.4,
                    uniquePages: 29
                  },
                  {
                    key: '2024-01-16',
                    count: 37,
                    percentage: 5.8,
                    uniquePages: 18
                  }
                ],
                totalItems: 642,
                uniqueItems: 189
              }
            ],
            summary: {
              totalItemsAnalyzed: 642,
              dateRange: 'Jan 15, 2024 - Jan 22, 2024',
              duplicatesRemoved: 78,
              analysisTypes: ['date']
            },
            message: 'Successfully analyzed 642 history items by date from Jan 15, 2024 to Jan 22, 2024'
          }
        },
        // Hour analysis example
        {
          description: 'Analyze browsing patterns by hour of day',
          input: { 
            startDate: '2024-01-20',
            endDate: '2024-01-22',
            statsType: ['hour'],
            topN: 24
          },
          output: {
            success: true,
            data: [
              {
                statsType: 'hour',
                results: [
                  {
                    key: '09:00',
                    count: 45,
                    percentage: 14.0,
                    uniquePages: 23
                  },
                  {
                    key: '10:00',
                    count: 67,
                    percentage: 20.8,
                    uniquePages: 31
                  },
                  {
                    key: '11:00',
                    count: 52,
                    percentage: 16.1,
                    uniquePages: 28
                  },
                  {
                    key: '14:00',
                    count: 38,
                    percentage: 11.8,
                    uniquePages: 19
                  },
                  {
                    key: '15:00',
                    count: 43,
                    percentage: 13.4,
                    uniquePages: 21
                  },
                  {
                    key: '16:00',
                    count: 29,
                    percentage: 9.0,
                    uniquePages: 15
                  },
                  {
                    key: '17:00',
                    count: 23,
                    percentage: 7.1,
                    uniquePages: 12
                  },
                  {
                    key: '20:00',
                    count: 18,
                    percentage: 5.6,
                    uniquePages: 9
                  },
                  {
                    key: '21:00',
                    count: 7,
                    percentage: 2.2,
                    uniquePages: 4
                  }
                ],
                totalItems: 322,
                uniqueItems: 98
              }
            ],
            summary: {
              totalItemsAnalyzed: 322,
              dateRange: 'Jan 20, 2024 - Jan 22, 2024',
              duplicatesRemoved: 34,
              analysisTypes: ['hour']
            },
            message: 'Successfully analyzed 322 history items by hour from Jan 20, 2024 to Jan 22, 2024'
          }
        },
        // Day of week analysis example
        {
          description: 'Analyze browsing patterns by day of week',
          input: { 
            startDate: '2024-01-01',
            endDate: '2024-01-22',
            statsType: ['day_of_week'],
            topN: 7
          },
          output: {
            success: true,
            data: [
              {
                statsType: 'day_of_week',
                results: [
                  {
                    key: 'Monday',
                    count: 567,
                    percentage: 19.8,
                    uniquePages: 234
                  },
                  {
                    key: 'Tuesday',
                    count: 612,
                    percentage: 21.4,
                    uniquePages: 256
                  },
                  {
                    key: 'Wednesday',
                    count: 589,
                    percentage: 20.6,
                    uniquePages: 241
                  },
                  {
                    key: 'Thursday',
                    count: 534,
                    percentage: 18.6,
                    uniquePages: 218
                  },
                  {
                    key: 'Friday',
                    count: 423,
                    percentage: 14.8,
                    uniquePages: 187
                  },
                  {
                    key: 'Saturday',
                    count: 89,
                    percentage: 3.1,
                    uniquePages: 45
                  },
                  {
                    key: 'Sunday',
                    count: 52,
                    percentage: 1.8,
                    uniquePages: 28
                  }
                ],
                totalItems: 2866,
                uniqueItems: 876
              }
            ],
            summary: {
              totalItemsAnalyzed: 2866,
              dateRange: 'Jan 1, 2024 - Jan 22, 2024',
              duplicatesRemoved: 342,
              analysisTypes: ['day_of_week']
            },
            message: 'Successfully analyzed 2866 history items by day_of_week from Jan 1, 2024 to Jan 22, 2024'
          }
        },
        // Title words analysis example
        {
          description: 'Analyze most common topics by title words',
          input: { 
            startDate: '2024-01-20',
            endDate: '2024-01-22',
            statsType: ['title_words'],
            topN: 15
          },
          output: {
            success: true,
            data: [
              {
                statsType: 'title_words',
                results: [
                  {
                    key: 'react',
                    count: 67,
                    percentage: 20.8,
                    uniquePages: 23
                  },
                  {
                    key: 'javascript',
                    count: 45,
                    percentage: 14.0,
                    uniquePages: 18
                  },
                  {
                    key: 'typescript',
                    count: 38,
                    percentage: 11.8,
                    uniquePages: 15
                  },
                  {
                    key: 'github',
                    count: 34,
                    percentage: 10.6,
                    uniquePages: 12
                  },
                  {
                    key: 'documentation',
                    count: 29,
                    percentage: 9.0,
                    uniquePages: 11
                  },
                  {
                    key: 'tutorial',
                    count: 23,
                    percentage: 7.1,
                    uniquePages: 9
                  },
                  {
                    key: 'guide',
                    count: 21,
                    percentage: 6.5,
                    uniquePages: 8
                  },
                  {
                    key: 'hooks',
                    count: 18,
                    percentage: 5.6,
                    uniquePages: 7
                  },
                  {
                    key: 'error',
                    count: 16,
                    percentage: 5.0,
                    uniquePages: 6
                  },
                  {
                    key: 'stack',
                    count: 14,
                    percentage: 4.3,
                    uniquePages: 5
                  },
                  {
                    key: 'overflow',
                    count: 13,
                    percentage: 4.0,
                    uniquePages: 5
                  },
                  {
                    key: 'questions',
                    count: 4,
                    percentage: 1.2,
                    uniquePages: 2
                  }
                ],
                totalItems: 322,
                uniqueItems: 98
              }
            ],
            summary: {
              totalItemsAnalyzed: 322,
              dateRange: 'Jan 20, 2024 - Jan 22, 2024',
              duplicatesRemoved: 34,
              analysisTypes: ['title_words']
            },
            message: 'Successfully analyzed 322 history items by title_words from Jan 20, 2024 to Jan 22, 2024'
          }
        },
        // Multiple stats with filtering example
        {
          description: 'Get comprehensive React-related stats',
          input: { 
            startDate: '2024-01-15',
            endDate: '2024-01-22',
            statsType: ['domain', 'date', 'hour'],
            filter: 'react',
            topN: 5
          },
          output: {
            success: true,
            data: [
              {
                statsType: 'domain',
                results: [
                  {
                    key: 'react.dev',
                    count: 34,
                    percentage: 42.5,
                    uniquePages: 12
                  },
                  {
                    key: 'github.com',
                    count: 23,
                    percentage: 28.8,
                    uniquePages: 8
                  },
                  {
                    key: 'stackoverflow.com',
                    count: 15,
                    percentage: 18.8,
                    uniquePages: 9
                  },
                  {
                    key: 'medium.com',
                    count: 6,
                    percentage: 7.5,
                    uniquePages: 3
                  },
                  {
                    key: 'dev.to',
                    count: 2,
                    percentage: 2.5,
                    uniquePages: 2
                  }
                ],
                totalItems: 80,
                uniqueItems: 34
              },
              {
                statsType: 'date',
                results: [
                  {
                    key: '2024-01-22',
                    count: 28,
                    percentage: 35.0,
                    uniquePages: 12
                  },
                  {
                    key: '2024-01-21',
                    count: 19,
                    percentage: 23.8,
                    uniquePages: 8
                  },
                  {
                    key: '2024-01-19',
                    count: 15,
                    percentage: 18.8,
                    uniquePages: 7
                  },
                  {
                    key: '2024-01-18',
                    count: 12,
                    percentage: 15.0,
                    uniquePages: 5
                  },
                  {
                    key: '2024-01-16',
                    count: 6,
                    percentage: 7.5,
                    uniquePages: 3
                  }
                ],
                totalItems: 80,
                uniqueItems: 34
              },
              {
                statsType: 'hour',
                results: [
                  {
                    key: '10:00',
                    count: 18,
                    percentage: 22.5,
                    uniquePages: 8
                  },
                  {
                    key: '11:00',
                    count: 16,
                    percentage: 20.0,
                    uniquePages: 7
                  },
                  {
                    key: '15:00',
                    count: 14,
                    percentage: 17.5,
                    uniquePages: 6
                  },
                  {
                    key: '14:00',
                    count: 12,
                    percentage: 15.0,
                    uniquePages: 5
                  },
                  {
                    key: '16:00',
                    count: 10,
                    percentage: 12.5,
                    uniquePages: 4
                  }
                ],
                totalItems: 80,
                uniqueItems: 34
              }
            ],
            summary: {
              totalItemsAnalyzed: 80,
              dateRange: 'Jan 15, 2024 - Jan 22, 2024',
              filterApplied: 'react',
              duplicatesRemoved: 12,
              analysisTypes: ['domain', 'date', 'hour']
            },
            message: 'Successfully analyzed 80 history items matching "react" by domain, date, hour from Jan 15, 2024 to Jan 22, 2024'
          }
        }
      ],
      streamingConfig: {
        displayName: 'History Stats',
        icon: '📊',
        progressMessage: 'Analyzing browser history statistics...'
      }
    };

    super(config, executionContext);
  }

  /**
   * Override: Generate contextual display message
   */
  getProgressMessage(args: StatsHistoryInput): string {
    try {
      // Note: args should already be parsed by StreamEventProcessor

      const startDate = args?.startDate;
      const endDate = args?.endDate;
      const statsType = args?.statsType || [];
      const filter = args?.filter;
      
      let message = 'Analyzing history stats';
      
      if (statsType.length > 0) {
        message += ` by ${statsType.join(', ')}`;
      }
      
      if (startDate && endDate) {
        message += ` from ${startDate} to ${endDate}`;
      } else if (startDate) {
        message += ` from ${startDate} to now`;
      }
      
      if (filter) {
        message += ` matching "${filter}"`;
      }
      
      return message;
    } catch {
      return 'Analyzing browser history statistics...';
    }
  }

  /**
   * Override: Format stats result for display
   */
  FormatResultForUI(output: StatsHistoryOutput): string {
    if (!output.success) {
      return `❌ ${output.message}`;
    }
    
    if (output.summary && output.data) {
      const { totalItemsAnalyzed, analysisTypes, filterApplied } = output.summary;
      let result = `✅ Analyzed ${totalItemsAnalyzed} items by ${analysisTypes.join(', ')}`;
      
      if (filterApplied) {
        result += ` matching "${filterApplied}"`;
      }
      
      // Add top result preview
      if (output.data.length > 0 && output.data[0].results.length > 0) {
        const topResult = output.data[0].results[0];
        result += `\n📈 Top ${output.data[0].statsType}: ${topResult.key} (${topResult.count} visits, ${topResult.percentage.toFixed(1)}%)`;
      }
      
      return result;
    }
    
    return '✅ ' + output.message;
  }

  protected async execute(input: StatsHistoryInput): Promise<StatsHistoryOutput> {
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
      const rawHistoryItems = await this.fetchHistory(startTime, endTime, input.limit || 5000);
      
      if (rawHistoryItems.length === 0) {
        const dateRange = this.formatDateRange(startDate, endDate);
        const filterText = input.filter ? ` matching "${input.filter}"` : '';
        return {
          success: true,
          data: [],
          summary: {
            totalItemsAnalyzed: 0,
            dateRange,
            filterApplied: input.filter,
            duplicatesRemoved: 0,
            analysisTypes: input.statsType
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

      if (filteredItems.length === 0) {
        const dateRange = this.formatDateRange(startDate, endDate);
        return {
          success: true,
          data: [],
          summary: {
            totalItemsAnalyzed: 0,
            dateRange,
            filterApplied: input.filter,
            duplicatesRemoved: duplicatesCount,
            analysisTypes: input.statsType
          },
          message: `No history items found matching filter "${input.filter}" for ${dateRange}`
        };
      }
      
      // Generate statistics for each requested type
      const statsGroups: StatsGroup[] = [];
      
      for (const statsType of input.statsType) {
        const statsGroup = this.generateStatsGroup(filteredItems, statsType, input.topN || 20);
        statsGroups.push(statsGroup);
      }
      
      const dateRange = this.formatDateRange(startDate, endDate);
      const filterText = input.filter ? ` matching "${input.filter}"` : '';
      const analysisText = input.statsType.join(', ');
      
      return {
        success: true,
        data: statsGroups,
        summary: {
          totalItemsAnalyzed: filteredItems.length,
          dateRange,
          filterApplied: input.filter,
          duplicatesRemoved: duplicatesCount,
          analysisTypes: input.statsType
        },
        message: `Successfully analyzed ${filteredItems.length} history items${filterText} by ${analysisText} from ${dateRange}`
      };
    } catch (error) {
      console.error('[stats_history] Error:', error);
      return {
        success: false,
        message: `Error analyzing history stats: ${error instanceof Error ? error.message : String(error)}`
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
   * Generate statistics group for a specific stats type
   */
  private generateStatsGroup(items: HistoryResultItem[], statsType: StatsType, topN: number): StatsGroup {
    const groupMap = new Map<string, {
      count: number;
      uniquePages: Set<string>;
      pages: Array<{ url: string; title: string; visitCount: number }>;
    }>();

    // Group items by the specified stats type
    items.forEach(item => {
      const groupKey = this.getGroupKey(item, statsType);
      
      if (!groupMap.has(groupKey)) {
        groupMap.set(groupKey, {
          count: 0,
          uniquePages: new Set(),
          pages: []
        });
      }
      
      const group = groupMap.get(groupKey)!;
      group.count += item.visitCount;
      group.uniquePages.add(item.url);
      group.pages.push({
        url: item.url,
        title: item.title,
        visitCount: item.visitCount
      });
    });

    // Calculate total visits for percentage calculation
    const totalVisits = Array.from(groupMap.values()).reduce((sum, group) => sum + group.count, 0);

    // Convert to results array
    const results: StatResult[] = Array.from(groupMap.entries())
      .map(([key, group]) => ({
        key,
        count: group.count,
        percentage: (group.count / totalVisits) * 100,
        uniquePages: group.uniquePages.size,
        topPages: group.pages
          .sort((a, b) => b.visitCount - a.visitCount)
          .slice(0, 3)  // Top 3 pages per group
      }))
      .sort((a, b) => b.count - a.count)  // Sort by visit count descending
      .slice(0, topN);  // Limit to topN results

    return {
      statsType,
      results,
      totalItems: items.length,
      uniqueItems: new Set(items.map(item => item.url)).size
    };
  }

  /**
   * Get the grouping key for an item based on stats type
   */
  private getGroupKey(item: HistoryResultItem, statsType: StatsType): string {
    switch (statsType) {
      case 'domain':
        try {
          return new URL(item.url).hostname;
        } catch {
          return 'unknown-domain';
        }
      
      case 'date':
        return item.date;
      
      case 'hour':
        const hour = new Date(item.lastVisitTime).getHours();
        return `${hour.toString().padStart(2, '0')}:00`;
      
      case 'day_of_week':
        const dayIndex = new Date(item.lastVisitTime).getDay();
        const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        return days[dayIndex];
      
      case 'title_words':
        // Extract common meaningful words from title
        const words = item.title
          .toLowerCase()
          .replace(/[^\w\s]/g, ' ')
          .split(/\s+/)
          .filter(word => word.length > 3 && !this.isStopWord(word));
        
        return words.length > 0 ? words[0] : 'untitled';
      
      default:
        return 'unknown';
    }
  }

  /**
   * Check if a word is a common stop word
   */
  private isStopWord(word: string): boolean {
    const stopWords = new Set([
      'this', 'that', 'with', 'have', 'will', 'from', 'they', 'know',
      'want', 'been', 'good', 'much', 'some', 'time', 'very', 'when',
      'come', 'here', 'just', 'like', 'long', 'make', 'many', 'over',
      'such', 'take', 'than', 'them', 'well', 'were', 'what'
    ]);
    return stopWords.has(word);
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

// Helper type for internal use
interface HistoryResultItem {
  url: string;
  title: string;
  date: string;
  visitCount: number;
  lastVisitTime: string;
} 
