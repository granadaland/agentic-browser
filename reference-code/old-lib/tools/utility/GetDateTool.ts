import { z } from 'zod';
import { NxtscapeTool } from '../base/NxtscapeTool';
import { ToolConfig } from '../base/ToolConfig';
import { ExecutionContext } from '@/lib/runtime/ExecutionContext';

/**
 * Schema for get date input
 */
export const GetDateInputSchema = z.object({
  format: z.enum(['today', 'yesterday', 'lastWeek', 'lastMonth', 'last30Days', 'weekStart', 'monthStart', 'custom']).default('today').optional().describe('Type of date calculation to perform'),
  daysBack: z.number().min(0).max(365).optional().describe('For custom format: number of days to go back from today'),
  includeTime: z.boolean().default(false).optional().describe('Whether to include time component in ISO string')
});

export type GetDateInput = z.infer<typeof GetDateInputSchema>;

/**
 * Schema for date result
 */
export const DateResultSchema = z.object({
  date: z.string(),  // ISO date string (YYYY-MM-DD or full ISO if includeTime is true)
  label: z.string(),  // Human-readable label for the date
  timestamp: z.number(),  // Unix timestamp in milliseconds
  dayOfWeek: z.string(),  // Day of the week (Monday, Tuesday, etc.)
  relative: z.string()  // Relative description (today, yesterday, 7 days ago, etc.)
});

export type DateResult = z.infer<typeof DateResultSchema>;

/**
 * Schema for get date output
 */
export const GetDateOutputSchema = z.object({
  success: z.boolean(),
  data: DateResultSchema.optional().describe('Date information'),
  commonRanges: z.object({
    today: z.string(),  // Today's date for startDate
    yesterday: z.string(),  // Yesterday's date  
    lastWeek: z.string(),  // 7 days ago for startDate
    lastMonth: z.string(),  // 30 days ago for startDate
    last30Days: z.string(),  // 30 days ago for startDate
    weekStart: z.string(),  // Start of current week (Monday)
    monthStart: z.string()  // Start of current month
  }).optional().describe('Common date ranges for quick reference'),
  message: z.string()
});

export type GetDateOutput = z.infer<typeof GetDateOutputSchema>;

/**
 * Tool for getting formatted dates for use with history tools
 */
export class GetDateTool extends NxtscapeTool<GetDateInput, GetDateOutput> {
  constructor(executionContext: ExecutionContext) {
    const config: ToolConfig<GetDateInput, GetDateOutput> = {
      name: 'get_date',
      description: 'Get properly formatted dates for use with history tools. Provides common date ranges like today, last week, last month, etc.',
      category: 'control',
      version: '1.0.0',
      inputSchema: GetDateInputSchema,
      outputSchema: GetDateOutputSchema,
      examples: [
        // 'today' format
        {
          description: 'Get today\'s date for current browsing history',
          input: { 
            format: 'today'
          },
          output: {
            success: true,
            data: {
              date: '2024-01-22',
              label: 'Today',
              timestamp: 1705939200000,
              dayOfWeek: 'Monday',
              relative: 'today'
            },
            commonRanges: {
              today: '2024-01-22',
              yesterday: '2024-01-21',
              lastWeek: '2024-01-15',
              lastMonth: '2023-12-23',
              last30Days: '2023-12-23',
              weekStart: '2024-01-22',
              monthStart: '2024-01-01'
            },
            message: 'Retrieved date: Today (2024-01-22)'
          }
        },
        // 'yesterday' format
        {
          description: 'Get yesterday\'s date for recent history',
          input: { 
            format: 'yesterday'
          },
          output: {
            success: true,
            data: {
              date: '2024-01-21',
              label: 'Yesterday',
              timestamp: 1705852800000,
              dayOfWeek: 'Sunday',
              relative: 'yesterday'
            },
            commonRanges: {
              today: '2024-01-22',
              yesterday: '2024-01-21',
              lastWeek: '2024-01-15',
              lastMonth: '2023-12-23',
              last30Days: '2023-12-23',
              weekStart: '2024-01-22',
              monthStart: '2024-01-01'
            },
            message: 'Retrieved date: Yesterday (2024-01-21)'
          }
        },
        // 'lastWeek' format
        {
          description: 'Get date from one week ago for weekly analysis',
          input: { 
            format: 'lastWeek'
          },
          output: {
            success: true,
            data: {
              date: '2024-01-15',
              label: 'Last Week',
              timestamp: 1705334400000,
              dayOfWeek: 'Monday',
              relative: '7 days ago'
            },
            commonRanges: {
              today: '2024-01-22',
              yesterday: '2024-01-21',
              lastWeek: '2024-01-15',
              lastMonth: '2023-12-23',
              last30Days: '2023-12-23',
              weekStart: '2024-01-22',
              monthStart: '2024-01-01'
            },
            message: 'Retrieved date: Last Week (2024-01-15)'
          }
        },
        // 'lastMonth' format
        {
          description: 'Get date from last month for monthly comparison',
          input: { 
            format: 'lastMonth'
          },
          output: {
            success: true,
            data: {
              date: '2023-12-22',
              label: 'Last Month',
              timestamp: 1703260800000,
              dayOfWeek: 'Friday',
              relative: '1 month ago'
            },
            commonRanges: {
              today: '2024-01-22',
              yesterday: '2024-01-21',
              lastWeek: '2024-01-15',
              lastMonth: '2023-12-22',
              last30Days: '2023-12-23',
              weekStart: '2024-01-22',
              monthStart: '2024-01-01'
            },
            message: 'Retrieved date: Last Month (2023-12-22)'
          }
        },
        // 'last30Days' format
        {
          description: 'Get date from 30 days ago for rolling analysis',
          input: { 
            format: 'last30Days'
          },
          output: {
            success: true,
            data: {
              date: '2023-12-23',
              label: 'Last 30 Days',
              timestamp: 1703347200000,
              dayOfWeek: 'Saturday',
              relative: '30 days ago'
            },
            commonRanges: {
              today: '2024-01-22',
              yesterday: '2024-01-21',
              lastWeek: '2024-01-15',
              lastMonth: '2023-12-22',
              last30Days: '2023-12-23',
              weekStart: '2024-01-22',
              monthStart: '2024-01-01'
            },
            message: 'Retrieved date: Last 30 Days (2023-12-23)'
          }
        },
        // 'weekStart' format
        {
          description: 'Get start of current week (Monday)',
          input: { 
            format: 'weekStart'
          },
          output: {
            success: true,
            data: {
              date: '2024-01-22',
              label: 'Week Start',
              timestamp: 1705939200000,
              dayOfWeek: 'Monday',
              relative: 'today'
            },
            commonRanges: {
              today: '2024-01-22',
              yesterday: '2024-01-21',
              lastWeek: '2024-01-15',
              lastMonth: '2023-12-22',
              last30Days: '2023-12-23',
              weekStart: '2024-01-22',
              monthStart: '2024-01-01'
            },
            message: 'Retrieved date: Week Start (2024-01-22)'
          }
        },
        // 'monthStart' format
        {
          description: 'Get start of current month',
          input: { 
            format: 'monthStart'
          },
          output: {
            success: true,
            data: {
              date: '2024-01-01',
              label: 'Month Start',
              timestamp: 1704096000000,
              dayOfWeek: 'Monday',
              relative: '21 days ago'
            },
            commonRanges: {
              today: '2024-01-22',
              yesterday: '2024-01-21',
              lastWeek: '2024-01-15',
              lastMonth: '2023-12-22',
              last30Days: '2023-12-23',
              weekStart: '2024-01-22',
              monthStart: '2024-01-01'
            },
            message: 'Retrieved date: Month Start (2024-01-01)'
          }
        },
        // 'custom' format examples
        {
          description: 'Get custom date 3 days ago',
          input: { 
            format: 'custom',
            daysBack: 3
          },
          output: {
            success: true,
            data: {
              date: '2024-01-19',
              label: '3 Days Ago',
              timestamp: 1705680000000,
              dayOfWeek: 'Friday',
              relative: '3 days ago'
            },
            commonRanges: {
              today: '2024-01-22',
              yesterday: '2024-01-21',
              lastWeek: '2024-01-15',
              lastMonth: '2023-12-22',
              last30Days: '2023-12-23',
              weekStart: '2024-01-22',
              monthStart: '2024-01-01'
            },
            message: 'Retrieved date: 3 Days Ago (2024-01-19)'
          }
        },
        {
          description: 'Get custom date 14 days ago',
          input: { 
            format: 'custom',
            daysBack: 14
          },
          output: {
            success: true,
            data: {
              date: '2024-01-08',
              label: '14 Days Ago',
              timestamp: 1704700800000,
              dayOfWeek: 'Monday',
              relative: '14 days ago'
            },
            commonRanges: {
              today: '2024-01-22',
              yesterday: '2024-01-21',
              lastWeek: '2024-01-15',
              lastMonth: '2023-12-22',
              last30Days: '2023-12-23',
              weekStart: '2024-01-22',
              monthStart: '2024-01-01'
            },
            message: 'Retrieved date: 14 Days Ago (2024-01-08)'
          }
        },
        {
          description: 'Get current date with time included',
          input: { 
            format: 'today',
            includeTime: true
          },
          output: {
            success: true,
            data: {
              date: '2024-01-22T10:30:00.000Z',
              label: 'Today',
              timestamp: 1705976400000,
              dayOfWeek: 'Monday',
              relative: 'today'
            },
            commonRanges: {
              today: '2024-01-22',
              yesterday: '2024-01-21',
              lastWeek: '2024-01-15',
              lastMonth: '2023-12-22',
              last30Days: '2023-12-23',
              weekStart: '2024-01-22',
              monthStart: '2024-01-01'
            },
            message: 'Retrieved date: Today (2024-01-22)'
          }
        },
        {
          description: 'Handle custom format without daysBack parameter',
          input: { 
            format: 'custom'
          },
          output: {
            success: false,
            message: 'daysBack parameter required for custom format'
          }
        }
      ],
      streamingConfig: {
        displayName: 'Get Date',
        icon: '📅',
        progressMessage: 'Getting date information...'
      }
    };

    super(config, executionContext);
  }

  /**
   * Override: Generate contextual display message
   */
  getProgressMessage(args: GetDateInput): string {
    try {
      // Note: args should already be parsed by StreamEventProcessor

      const format = args?.format || 'today';
      const daysBack = args?.daysBack;
      
      if (format === 'custom' && daysBack) {
        return `Getting date from ${daysBack} days ago`;
      }
      
      const formatLabels: Record<string, string> = {
        today: 'today\'s date',
        yesterday: 'yesterday\'s date',
        lastWeek: 'date from last week',
        lastMonth: 'date from last month',
        last30Days: 'date from 30 days ago',
        weekStart: 'start of this week',
        monthStart: 'start of this month'
      };
      
      return `Getting ${formatLabels[format] || 'date'}`;
    } catch {
      return 'Getting date information...';
    }
  }

  /**
   * Override: Format date result for display
   */
  FormatResultForUI(output: GetDateOutput): string {
    if (!output.success) {
      return `❌ ${output.message}`;
    }
    
    if (output.data) {
      return `📅 ${output.data.label}: ${output.data.date} (${output.data.dayOfWeek})`;
    }
    
    return '✅ ' + output.message;
  }

  protected async execute(input: GetDateInput): Promise<GetDateOutput> {
    try {
      const { format = 'today', daysBack, includeTime = false } = input;
      
      // Get current date
      const now = new Date();
      let targetDate: Date;
      let label: string;
      let relative: string;
      
      // Calculate target date based on format
      switch (format) {
        case 'today':
          targetDate = new Date(now);
          label = 'Today';
          relative = 'today';
          break;
          
        case 'yesterday':
          targetDate = new Date(now);
          targetDate.setDate(targetDate.getDate() - 1);
          label = 'Yesterday';
          relative = 'yesterday';
          break;
          
        case 'lastWeek':
          targetDate = new Date(now);
          targetDate.setDate(targetDate.getDate() - 7);
          label = 'Last Week';
          relative = '7 days ago';
          break;
          
        case 'lastMonth':
          targetDate = new Date(now);
          targetDate.setMonth(targetDate.getMonth() - 1);
          label = 'Last Month';
          relative = '1 month ago';
          break;
          
        case 'last30Days':
          targetDate = new Date(now);
          targetDate.setDate(targetDate.getDate() - 30);
          label = 'Last 30 Days';
          relative = '30 days ago';
          break;
          
        case 'weekStart':
          targetDate = new Date(now);
          const dayOfWeek = targetDate.getDay();
          const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1; // Sunday = 0, Monday = 1
          targetDate.setDate(targetDate.getDate() - daysToMonday);
          label = 'Week Start';
          relative = daysToMonday === 0 ? 'today' : `${daysToMonday} days ago`;
          break;
          
        case 'monthStart':
          targetDate = new Date(now.getFullYear(), now.getMonth(), 1);
          label = 'Month Start';
          const daysFromStart = now.getDate() - 1;
          relative = daysFromStart === 0 ? 'today' : `${daysFromStart} days ago`;
          break;
          
        case 'custom':
          if (daysBack === undefined) {
            return {
              success: false,
              message: 'daysBack parameter required for custom format'
            };
          }
          targetDate = new Date(now);
          targetDate.setDate(targetDate.getDate() - daysBack);
          label = daysBack === 0 ? 'Today' : `${daysBack} Days Ago`;
          relative = daysBack === 0 ? 'today' : daysBack === 1 ? 'yesterday' : `${daysBack} days ago`;
          break;
          
        default:
          return {
            success: false,
            message: `Unknown format: ${format}`
          };
      }
      
      // Format the date
      const dateStr = includeTime ? targetDate.toISOString() : targetDate.toISOString().split('T')[0];
      
      // Get day of week
      const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      const dayOfWeek = dayNames[targetDate.getDay()];
      
      // Generate common ranges for reference
      const today = new Date(now);
      const yesterday = new Date(now); yesterday.setDate(yesterday.getDate() - 1);
      const weekAgo = new Date(now); weekAgo.setDate(weekAgo.getDate() - 7);
      const monthAgo = new Date(now); monthAgo.setMonth(monthAgo.getMonth() - 1);
      const thirtyDaysAgo = new Date(now); thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const weekStartDate = new Date(now);
      const weekStartDays = weekStartDate.getDay() === 0 ? 6 : weekStartDate.getDay() - 1;
      weekStartDate.setDate(weekStartDate.getDate() - weekStartDays);
      const monthStartDate = new Date(now.getFullYear(), now.getMonth(), 1);
      
      const commonRanges = {
        today: today.toISOString().split('T')[0],
        yesterday: yesterday.toISOString().split('T')[0],
        lastWeek: weekAgo.toISOString().split('T')[0],
        lastMonth: monthAgo.toISOString().split('T')[0],
        last30Days: thirtyDaysAgo.toISOString().split('T')[0],
        weekStart: weekStartDate.toISOString().split('T')[0],
        monthStart: monthStartDate.toISOString().split('T')[0]
      };
      
      return {
        success: true,
        data: {
          date: dateStr,
          label,
          timestamp: targetDate.getTime(),
          dayOfWeek,
          relative
        },
        commonRanges,
        message: `Retrieved date: ${label} (${dateStr.split('T')[0]})`
      };
    } catch (error) {
      console.error('[get_date] Error:', error);
      return {
        success: false,
        message: `Error getting date: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }
} 
