import { z } from 'zod';
import { NxtscapeTool } from '../base/NxtscapeTool';
import { ToolConfig } from '../base/ToolConfig';
import { ExecutionContext } from '@/lib/runtime/ExecutionContext';
import { Session, SessionSchema } from './SessionManagementTool';

/**
 * Schema for resume session input
 */
export const ResumeSessionInputSchema = z.object({
  sessionId: z.string().min(1),  // ID of session to resume (required)
  newWindow: z.boolean().optional(),  // Whether to open in new window (default true)
  focusWindow: z.boolean().optional()  // Whether to focus the window after opening (default true)
});

export type ResumeSessionInput = z.infer<typeof ResumeSessionInputSchema>;

/**
 * Schema for session execution output
 */
export const SessionExecutionOutputSchema = z.object({
  success: z.boolean(),  // Whether the operation succeeded
  sessionName: z.string().optional(),  // Name of resumed session
  tabsOpened: z.number(),  // Number of tabs successfully opened
  windowId: z.number().optional(),  // ID of window where tabs were opened
  failedTabs: z.array(z.object({
    url: z.string(),  // URL that failed to open
    title: z.string(),  // Title of tab that failed
    error: z.string()  // Error message
  })).optional(),  // Tabs that failed to open
  message: z.string()  // Human-readable summary message
});

export type SessionExecutionOutput = z.infer<typeof SessionExecutionOutputSchema>;

/**
 * Tool for executing/resuming saved browser sessions
 */
export class SessionExecutionTool extends NxtscapeTool<ResumeSessionInput, SessionExecutionOutput> {
  private static readonly STORAGE_KEY = 'nxtscape_sessions';

  constructor(executionContext: ExecutionContext) {
    const config: ToolConfig<ResumeSessionInput, SessionExecutionOutput> = {
      name: 'session_execution',
      description: 'Resume a saved browser session by opening all its tabs. By default opens in a new window.',
      category: 'sessions',
      version: '1.0.0',
      inputSchema: ResumeSessionInputSchema,
      outputSchema: SessionExecutionOutputSchema,
      examples: [
        {
          description: 'Resume a session in a new window',
          input: { 
            sessionId: 'sess_123abc',
            newWindow: true 
          },
          output: {
            success: true,
            sessionName: 'Morning Work Session',
            tabsOpened: 5,
            windowId: 2,
            message: 'Successfully resumed "Morning Work Session" with 5 tabs in new window'
          }
        },
        {
          description: 'Resume a session in current window',
          input: { 
            sessionId: 'sess_456def',
            newWindow: false,
            focusWindow: true
          },
          output: {
            success: true,
            sessionName: 'Research Project',
            tabsOpened: 3,
            windowId: 1,
            message: 'Successfully resumed "Research Project" with 3 tabs in current window'
          }
        }
      ],
      streamingConfig: {
        displayName: 'Session Execution',
        icon: '🔄',
        progressMessage: 'Resuming session...'
      }
    };

    super(config, executionContext);
  }

  /**
   * Override: Generate contextual display message based on arguments
   */
  getProgressMessage(args: ResumeSessionInput): string {
    try {
      // Note: args should already be parsed by StreamEventProcessor

      const sessionId = args?.sessionId;
      const newWindow = args?.newWindow ?? true;
      
      if (sessionId) {
        return newWindow 
          ? `Opening session ${sessionId} in new window...`
          : `Opening session ${sessionId} in current window...`;
      }

      return 'Resuming session...';
    } catch {
      return 'Resuming session...';
    }
  }

  /**
   * Override: Format session execution result for display
   */
  FormatResultForUI(output: SessionExecutionOutput): string {
    if (!output.success) {
      return `❌ ${output.message}`;
    }
    
    const tabText = output.tabsOpened === 1 ? 'tab' : 'tabs';
    let result = `🔄 Resumed "${output.sessionName}" with ${output.tabsOpened} ${tabText}`;
    
    if (output.failedTabs && output.failedTabs.length > 0) {
      const failedCount = output.failedTabs.length;
      const failedText = failedCount === 1 ? 'tab' : 'tabs';
      result += ` (${failedCount} ${failedText} failed to open)`;
    }
    
    return result;
  }

  protected async execute(input: ResumeSessionInput): Promise<SessionExecutionOutput> {
    try {
      // Load the session
      const session = await this.loadSession(input.sessionId);
      
      if (!session) {
        return {
          success: false,
          tabsOpened: 0,
          message: `Session with ID ${input.sessionId} not found`
        };
      }

      if (session.tabs.length === 0) {
        return {
          success: false,
          sessionName: session.name,
          tabsOpened: 0,
          message: `Session "${session.name}" has no tabs to open`
        };
      }

      // Determine where to open tabs
      let targetWindowId: number | undefined;
      const newWindow = input.newWindow ?? true;
      const focusWindow = input.focusWindow ?? true;
      
      if (newWindow) {
        // Create new window with first tab
        const firstTab = session.tabs[0];
        const newWindowObj = await chrome.windows.create({
          url: firstTab.url,
          focused: focusWindow
        });
        
        if (!newWindowObj?.id) {
          throw new Error('Failed to create new window');
        }
        
        targetWindowId = newWindowObj.id;
      } else {
        // Use current window - leverage BrowserContext's getCurrentWindow
        try {
          const currentWindow = await this.browserContext.getCurrentWindow();
          targetWindowId = currentWindow.id;
        } catch (error) {
          throw new Error('Could not determine target window');
        }
      }

      // Open remaining tabs
      const tabsToOpen = newWindow ? session.tabs.slice(1) : session.tabs;
      const failedTabs = [];
      let successCount = newWindow ? 1 : 0; // First tab already opened if new window

      // If we're opening in the current window and using BrowserContext features,
      // we could use openTab for the first tab to get better integration
      // For now, we'll keep using chrome.tabs.create for consistency
      
      for (const tab of tabsToOpen) {
        try {
          await chrome.tabs.create({
            windowId: targetWindowId,
            url: tab.url,
            active: false // Don't focus each tab as it opens
          });
          successCount++;
        } catch (error) {
          console.warn('[session_execution] Failed to open tab:', tab.url, error);
          failedTabs.push({
            url: tab.url,
            title: tab.title,
            error: error instanceof Error ? error.message : String(error)
          });
        }
      }

      // Focus the window if requested
      if (focusWindow && targetWindowId) {
        try {
          await chrome.windows.update(targetWindowId, { focused: true });
        } catch (error) {
          console.warn('[session_execution] Failed to focus window:', error);
        }
      }

      const totalTabs = session.tabs.length;
      const hasFailures = failedTabs.length > 0;
      const windowLocation = newWindow ? 'new window' : 'current window';
      
      return {
        success: successCount > 0,
        sessionName: session.name,
        tabsOpened: successCount,
        windowId: targetWindowId,
        failedTabs: hasFailures ? failedTabs : undefined,
        message: hasFailures 
          ? `Resumed "${session.name}" with ${successCount}/${totalTabs} tabs in ${windowLocation} (${failedTabs.length} failed)`
          : `Successfully resumed "${session.name}" with ${successCount} tab(s) in ${windowLocation}`
      };
    } catch (error) {
      console.error('[session_execution] Error:', error);
      return {
        success: false,
        tabsOpened: 0,
        message: `Error resuming session: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }

  /**
   * Load a specific session from chrome storage
   */
  private async loadSession(sessionId: string): Promise<Session | null> {
    try {
      const result = await chrome.storage.local.get([SessionExecutionTool.STORAGE_KEY]);
      const sessions = result[SessionExecutionTool.STORAGE_KEY] || [];
      
      // Find the session by ID
      const sessionData = sessions.find((session: any) => session.id === sessionId);
      
      if (!sessionData) {
        return null;
      }

      // Validate session against schema
      try {
        return SessionSchema.parse(sessionData);
      } catch (error) {
        console.warn('[session_execution] Invalid session data found:', error);
        return null;
      }
    } catch (error) {
      throw new Error(`Failed to load session from storage: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
} 
