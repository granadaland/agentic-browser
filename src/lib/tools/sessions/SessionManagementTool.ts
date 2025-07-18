import { z } from 'zod';
import { NxtscapeTool } from '../base/NxtscapeTool';
import { ToolConfig } from '../base/ToolConfig';
import { ExecutionContext } from '@/lib/runtime/ExecutionContext';

/**
 * Schema for saved tab information
 */
export const SavedTabSchema = z.object({
  url: z.string(),  // Tab URL
  title: z.string(),  // Tab title
  favIconUrl: z.string().optional(),  // Tab favicon
  index: z.number()  // Tab position
});

export type SavedTab = z.infer<typeof SavedTabSchema>;

/**
 * Schema for session data
 */
export const SessionSchema = z.object({
  id: z.string(),  // Unique session ID
  name: z.string(),  // Session name
  description: z.string().optional(),  // Session description
  tabs: z.array(SavedTabSchema),  // Array of saved tabs
  createdAt: z.string(),  // Creation timestamp
  tabCount: z.number(),  // Number of tabs saved
  bookmarkFolderId: z.string()  // ID of the bookmark folder for this session
});

export type Session = z.infer<typeof SessionSchema>;

/**
 * Simplified uniform input schema for all session management operations
 */
export const SessionManagementInputSchema = z.object({
  operationType: z.enum(['save', 'list', 'delete']),  // The operation to perform
  
  // For 'save' operation
  session_name: z.string().optional(),  // Name for the session
  
  // For 'list' operation
  sort_by: z.enum(['name', 'date', 'tab_count']).optional(),  // How to sort results
  
  // For 'delete' operation
  session_ids: z.array(z.string()).optional(),  // Which sessions to delete
  delete_all: z.boolean().optional()  // Delete all sessions
});

export type SessionManagementInput = z.infer<typeof SessionManagementInputSchema>;

/**
 * Simplified output schema - just success and message
 */
export const SessionManagementOutputSchema = z.object({
  success: z.boolean(),
  message: z.string()
});

export type SessionManagementOutput = z.infer<typeof SessionManagementOutputSchema>;

/**
 * Tool for managing browser sessions (save, list, delete) with simplified interface
 */
export class SessionManagementTool extends NxtscapeTool<SessionManagementInput, SessionManagementOutput> {
  private static readonly STORAGE_KEY = 'nxtscape_sessions';
  private static readonly SESSIONS_FOLDER_NAME = 'Sessions';

  constructor(executionContext: ExecutionContext) {
    const config: ToolConfig<SessionManagementInput, SessionManagementOutput> = {
      name: 'session_management',
      description: 'Manage browser sessions with a simple interface. Operations: "save" (save all tabs as session), "list" (list saved sessions), "delete" (delete sessions). Always saves all tabs in current window.',
      category: 'sessions',
      version: '2.0.0',
      inputSchema: SessionManagementInputSchema,
      outputSchema: SessionManagementOutputSchema,
      examples: [
        // Save operation examples
        {
          description: 'Save current work session with all tabs',
          input: { 
            operationType: 'save',
            session_name: 'Morning Work Session'
          },
          output: {
            success: true,
            message: 'Saved 8 tabs as "Morning Work Session" in Bookmarks Bar > Sessions > Morning Work Session'
          }
        },
        {
          description: 'Save research tabs for later',
          input: { 
            operationType: 'save',
            session_name: 'React Performance Research'
          },
          output: {
            success: true,
            message: 'Saved 12 tabs as "React Performance Research" in Bookmarks Bar > Sessions > React Performance Research'
          }
        },
        {
          description: 'Save project tabs before switching context',
          input: { 
            operationType: 'save',
            session_name: 'Project Alpha Sprint 23'
          },
          output: {
            success: true,
            message: 'Saved 6 tabs as "Project Alpha Sprint 23" in Bookmarks Bar > Sessions > Project Alpha Sprint 23'
          }
        },
        // List operation examples
        {
          description: 'List all saved sessions',
          input: { 
            operationType: 'list' 
          },
          output: {
            success: true,
            message: 'Found 5 sessions: Morning Work Session (ID: sess_1705939200123_abc123, 8 tabs, 1/22/2024), React Performance Research (ID: sess_1705939300456_def456, 12 tabs, 1/22/2024), Project Alpha Sprint 23 (ID: sess_1705939400789_ghi789, 6 tabs, 1/22/2024), Daily Standup Prep (ID: sess_1705852800321_jkl321, 4 tabs, 1/21/2024), Code Review Session (ID: sess_1705766400654_mno654, 7 tabs, 1/20/2024)'
          }
        },
        {
          description: 'List sessions sorted by name',
          input: { 
            operationType: 'list',
            sort_by: 'name'
          },
          output: {
            success: true,
            message: 'Found 5 sessions: Code Review Session (ID: sess_1705766400654_mno654, 7 tabs, 1/20/2024), Daily Standup Prep (ID: sess_1705852800321_jkl321, 4 tabs, 1/21/2024), Morning Work Session (ID: sess_1705939200123_abc123, 8 tabs, 1/22/2024), Project Alpha Sprint 23 (ID: sess_1705939400789_ghi789, 6 tabs, 1/22/2024), React Performance Research (ID: sess_1705939300456_def456, 12 tabs, 1/22/2024)'
          }
        },
        {
          description: 'List sessions sorted by tab count',
          input: { 
            operationType: 'list',
            sort_by: 'tab_count'
          },
          output: {
            success: true,
            message: 'Found 5 sessions: React Performance Research (ID: sess_1705939300456_def456, 12 tabs, 1/22/2024), Morning Work Session (ID: sess_1705939200123_abc123, 8 tabs, 1/22/2024), Code Review Session (ID: sess_1705766400654_mno654, 7 tabs, 1/20/2024), Project Alpha Sprint 23 (ID: sess_1705939400789_ghi789, 6 tabs, 1/22/2024), Daily Standup Prep (ID: sess_1705852800321_jkl321, 4 tabs, 1/21/2024)'
          }
        },
        {
          description: 'Handle empty session list',
          input: { 
            operationType: 'list'
          },
          output: {
            success: true,
            message: 'No saved sessions found'
          }
        },
        // Delete operation examples
        {
          description: 'Delete old session by ID',
          input: { 
            operationType: 'delete',
            session_ids: ['sess_1705766400654_mno654']
          },
          output: {
            success: true,
            message: 'Deleted 1 session'
          }
        },
        {
          description: 'Delete multiple sessions',
          input: { 
            operationType: 'delete',
            session_ids: ['sess_1705852800321_jkl321', 'sess_1705766400654_mno654', 'sess_1705680000987_pqr987']
          },
          output: {
            success: true,
            message: 'Deleted 3 sessions'
          }
        },
        {
          description: 'Delete sessions with some not found',
          input: { 
            operationType: 'delete',
            session_ids: ['sess_1705939200123_abc123', 'sess_invalid_999', 'sess_1705939300456_def456']
          },
          output: {
            success: true,
            message: 'Deleted 2 sessions (1 not found)'
          }
        },
        {
          description: 'Delete all sessions at once',
          input: { 
            operationType: 'delete',
            delete_all: true
          },
          output: {
            success: true,
            message: 'Deleted all 5 sessions'
          }
        },
        {
          description: 'Attempt to delete when no sessions exist',
          input: { 
            operationType: 'delete',
            delete_all: true
          },
          output: {
            success: false,
            message: 'No sessions found to delete'
          }
        }
      ],
      streamingConfig: {
        displayName: 'Session Management',
        icon: '📋',
        progressMessage: 'Managing sessions...'
      }
    };

    super(config, executionContext);
  }

  /**
   * Override: Generate contextual display message based on operation
   */
  getProgressMessage(args: SessionManagementInput): string {
    try {
      // Note: args should already be parsed by StreamEventProcessor

      const operationType = args?.operationType;

      switch (operationType) {
        case 'save':
          return args?.session_name ? `Saving session "${args.session_name}"...` : 'Saving current session...';
        case 'list':
          return 'Loading saved sessions...';
        case 'delete':
          if (args?.delete_all) {
            return 'Deleting all sessions...';
          }
          const count = args?.session_ids?.length || 0;
          return `Deleting ${count} session${count === 1 ? '' : 's'}...`;
        default:
          return 'Managing sessions...';
      }
    } catch {
      return 'Managing sessions...';
    }
  }

  /**
   * Override: Format result for display
   */
  FormatResultForUI(output: SessionManagementOutput): string {
    if (output.success) {
      return `✅ ${output.message}`;
    }
    return `❌ ${output.message}`;
  }

  protected async execute(input: SessionManagementInput): Promise<SessionManagementOutput> {
    // Validate inputs for operations that need them
    switch (input.operationType) {
      case 'save':
        if (!input.session_name) {
          return {
            success: false,
            message: 'save operation requires session_name'
          };
        }
        break;
      case 'delete':
        if (!input.session_ids && !input.delete_all) {
          return {
            success: false,
            message: 'delete operation requires either session_ids or delete_all flag'
          };
        }
        break;
    }

    // Execute the operation
    try {
      switch (input.operationType) {
        case 'save':
          return await this.saveSession(input);
        case 'list':
          return await this.listSessions(input);
        case 'delete':
          return await this.deleteSessions(input);
        default:
          return {
            success: false,
            message: 'Invalid operation type specified'
          };
      }
    } catch (error) {
      console.error('[session_management] Error:', error);
      return {
        success: false,
        message: `Error: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }

  /**
   * Save all tabs in current window as a session
   */
  private async saveSession(input: SessionManagementInput): Promise<SessionManagementOutput> {
    const sessionName = input.session_name!;

    try {
      // Get all tabs from current window
      const currentWindow = await this.browserContext.getCurrentWindow();
      const tabs = await chrome.tabs.query({ windowId: currentWindow.id });
      
      const savedTabs: SavedTab[] = tabs
        .filter(tab => tab.url && tab.title)
        .map((tab, index) => ({
          url: tab.url!,
          title: tab.title!,
          favIconUrl: tab.favIconUrl,
          index: tab.index ?? index
        }));

      if (savedTabs.length === 0) {
        return {
          success: false,
          message: 'No valid tabs to save'
        };
      }

      // Get or create the Sessions parent folder
      const sessionsFolderId = await this.getOrCreateSessionsFolder();
      if (!sessionsFolderId) {
        return {
          success: false,
          message: 'Failed to create Sessions folder in bookmarks'
        };
      }

      // Create session folder in bookmarks
      const sessionFolder = await this.createSessionBookmarkFolder(
        sessionsFolderId,
        sessionName
      );

      if (!sessionFolder) {
        return {
          success: false,
          message: 'Failed to create session bookmark folder'
        };
      }

      // Save tabs as bookmarks
      await this.saveTabsAsBookmarks(savedTabs, sessionFolder.id);

      // Create session object
      const sessionId = `sess_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const session: Session = {
        id: sessionId,
        name: sessionName,
        tabs: savedTabs,
        createdAt: new Date().toISOString(),
        tabCount: savedTabs.length,
        bookmarkFolderId: sessionFolder.id
      };

      // Save to storage
      await this.saveSessionToStorage(session);

      const folderPath = `Bookmarks Bar > Sessions > ${sessionName}`;
      return {
        success: true,
        message: `Saved ${savedTabs.length} tab${savedTabs.length === 1 ? '' : 's'} as "${sessionName}" in ${folderPath}`
      };
    } catch (error) {
      return {
        success: false,
        message: `Failed to save session: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }

  /**
   * List saved sessions
   */
  private async listSessions(input: SessionManagementInput): Promise<SessionManagementOutput> {
    try {
      const sessions = await this.loadSessions();
      
      if (sessions.length === 0) {
        return {
          success: true,
          message: 'No saved sessions found'
        };
      }

      // Sort sessions
      let sortBy = 'createdAt';
      if (input.sort_by === 'name') sortBy = 'name';
      else if (input.sort_by === 'tab_count') sortBy = 'tabCount';
      
      const sortedSessions = this.sortSessions(sessions, sortBy);

      // Format session list for message
      const sessionList = sortedSessions.map(session => {
        const date = new Date(session.createdAt).toLocaleDateString();
        return `${session.name} (ID: ${session.id}, ${session.tabCount} tabs, ${date})`;
      }).join(', ');

      return {
        success: true,
        message: `Found ${sessions.length} session${sessions.length === 1 ? '' : 's'}: ${sessionList}`
      };
    } catch (error) {
      return {
        success: false,
        message: `Failed to list sessions: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }

  /**
   * Delete sessions
   */
  private async deleteSessions(input: SessionManagementInput): Promise<SessionManagementOutput> {
    try {
      const allSessions = await this.loadSessions();
      
      if (allSessions.length === 0) {
        return {
          success: false,
          message: 'No sessions found to delete'
        };
      }

      let sessionsToDelete: Session[] = [];
      let notFoundCount = 0;

      if (input.delete_all) {
        // Delete all sessions
        sessionsToDelete = allSessions;
      } else if (input.session_ids) {
        // Delete specific sessions
        for (const sessionId of input.session_ids) {
          const session = allSessions.find(s => s.id === sessionId);
          if (session) {
            sessionsToDelete.push(session);
          } else {
            notFoundCount++;
          }
        }
      }

      if (sessionsToDelete.length === 0) {
        return {
          success: false,
          message: notFoundCount > 0 
            ? `No sessions found with the specified IDs (${notFoundCount} not found)`
            : 'No sessions to delete'
        };
      }

      // Delete bookmark folders and update storage
      let bookmarkFoldersDeleted = 0;
      for (const session of sessionsToDelete) {
        if (session.bookmarkFolderId) {
          const deleted = await this.deleteBookmarkFolder(session.bookmarkFolderId);
          if (deleted) bookmarkFoldersDeleted++;
        }
      }

      // Remove deleted sessions from storage
      const remainingSessions = allSessions.filter(
        session => !sessionsToDelete.some(toDelete => toDelete.id === session.id)
      );
      await this.saveSessionsToStorage(remainingSessions);

      let message = `Deleted ${sessionsToDelete.length} session${sessionsToDelete.length === 1 ? '' : 's'}`;
      if (notFoundCount > 0) {
        message += ` (${notFoundCount} not found)`;
      }

      return {
        success: true,
        message
      };
    } catch (error) {
      return {
        success: false,
        message: `Failed to delete sessions: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }

  /**
   * Get or create the Sessions folder in bookmarks bar
   */
  private async getOrCreateSessionsFolder(): Promise<string | null> {
    try {
      // Get bookmark bar
      const bookmarkTree = await chrome.bookmarks.getTree();
      const bookmarkBar = this.findBookmarkBar(bookmarkTree[0]);
      
      if (!bookmarkBar) {
        console.error('Could not find bookmark bar');
        return null;
      }

      // Check if Sessions folder exists
      const children = await chrome.bookmarks.getChildren(bookmarkBar.id);
      const sessionsFolder = children.find(child => 
        !child.url && child.title === SessionManagementTool.SESSIONS_FOLDER_NAME
      );

      if (sessionsFolder) {
        return sessionsFolder.id;
      }

      // Create Sessions folder
      const newSessionsFolder = await chrome.bookmarks.create({
        parentId: bookmarkBar.id,
        title: SessionManagementTool.SESSIONS_FOLDER_NAME
      });

      return newSessionsFolder.id;
    } catch (error) {
      console.error('Error creating Sessions folder:', error);
      return null;
    }
  }

  /**
   * Create a bookmark folder for a session
   */
  private async createSessionBookmarkFolder(
    parentId: string,
    name: string
  ): Promise<chrome.bookmarks.BookmarkTreeNode | null> {
    try {
      const folder = await chrome.bookmarks.create({
        parentId,
        title: name
      });
      
      // Add a description bookmark if provided
      await chrome.bookmarks.create({
        parentId: folder.id,
        title: `📋 Session: ${name}`,
        url: `data:text/plain,Session saved on ${new Date().toLocaleString()}`
      });

      return folder;
    } catch (error) {
      console.error('Error creating session bookmark folder:', error);
      return null;
    }
  }

  /**
   * Save tabs as bookmarks in the session folder
   */
  private async saveTabsAsBookmarks(tabs: SavedTab[], folderId: string): Promise<void> {
    for (const tab of tabs) {
      try {
        await chrome.bookmarks.create({
          parentId: folderId,
          title: tab.title,
          url: tab.url,
          index: tab.index
        });
      } catch (error) {
        console.error(`Error saving bookmark for ${tab.url}:`, error);
      }
    }
  }

  /**
   * Check if a bookmark folder exists
   */
  private async checkBookmarkFolderExists(folderId: string): Promise<boolean> {
    try {
      const folders = await chrome.bookmarks.get(folderId);
      return folders.length > 0 && !folders[0].url;
    } catch {
      return false;
    }
  }

  /**
   * Delete a bookmark folder
   */
  private async deleteBookmarkFolder(folderId: string): Promise<boolean> {
    try {
      const folders = await chrome.bookmarks.get(folderId);
      if (folders.length > 0 && !folders[0].url) {
        await chrome.bookmarks.removeTree(folderId);
        return true;
      }
    } catch (error) {
      console.error('Error deleting bookmark folder:', error);
    }
    return false;
  }

  /**
   * Load all sessions from storage
   */
  private async loadSessions(): Promise<Session[]> {
    try {
      const result = await chrome.storage.local.get(SessionManagementTool.STORAGE_KEY);
      const sessions = result[SessionManagementTool.STORAGE_KEY];
      
      if (!sessions || !Array.isArray(sessions)) {
        return [];
      }

      // Validate each session
      return sessions.filter((session: any) => {
        try {
          SessionSchema.parse(session);
          return true;
        } catch {
          return false;
        }
      });
    } catch (error) {
      console.error('Error loading sessions:', error);
      return [];
    }
  }

  /**
   * Save a session to storage
   */
  private async saveSessionToStorage(session: Session): Promise<void> {
    const sessions = await this.loadSessions();
    sessions.push(session);
    await this.saveSessionsToStorage(sessions);
  }

  /**
   * Save sessions to storage
   */
  private async saveSessionsToStorage(sessions: Session[]): Promise<void> {
    await chrome.storage.local.set({
      [SessionManagementTool.STORAGE_KEY]: sessions
    });
  }

  /**
   * Sort sessions by specified field
   */
  private sortSessions(sessions: Session[], sortBy: string): Session[] {
    return [...sessions].sort((a, b) => {
      switch (sortBy) {
        case 'name':
          return a.name.localeCompare(b.name);
        case 'tabCount':
          return b.tabCount - a.tabCount;
        case 'createdAt':
        default:
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      }
    });
  }

  /**
   * Find bookmark bar in bookmark tree
   */
  private findBookmarkBar(node: chrome.bookmarks.BookmarkTreeNode): chrome.bookmarks.BookmarkTreeNode | null {
    if (node.id === '1' || node.title === 'Bookmarks Bar') {
      return node;
    }
    
    if (node.children) {
      for (const child of node.children) {
        const result = this.findBookmarkBar(child);
        if (result) return result;
      }
    }
    
    return null;
  }
} 
