import { z } from 'zod';
import { NxtscapeTool } from '../base/NxtscapeTool';
import { ToolConfig } from '../base/ToolConfig';
import { ExecutionContext } from '@/lib/runtime/ExecutionContext';
import { 
  getBookmarkBar, 
  getFolderPath, 
  isProtectedFolder,
  isSystemFolder
} from './common';

// Define schemas

/**
 * Schema for folder creation result
 */
export const FolderResultSchema = z.object({
  name: z.string(),  // Folder name
  folderId: z.string().optional(),  // ID of the created folder (if successful)
  folderPath: z.string(),  // Full path of the folder
  created: z.boolean(),  // Whether the folder was created
  skipped: z.boolean(),  // Whether the folder was skipped (already exists)
  error: z.string().optional()  // Error message if creation failed
});

export type FolderResult = z.infer<typeof FolderResultSchema>;

/**
 * Schema for folder deletion result
 */
export const FolderDeletionResultSchema = z.object({
  folderId: z.string(),  // Folder ID
  folderPath: z.string(),  // Full path of the folder
  success: z.boolean(),  // Whether deletion succeeded
  reason: z.string().optional(),  // Reason for failure (if any)
  itemCount: z.number().optional()  // Number of items in folder before deletion
});

export type FolderDeletionResult = z.infer<typeof FolderDeletionResultSchema>;

/**
 * Schema for folder item
 */
export const FolderItemSchema = z.object({
  id: z.string(),  // Folder ID
  title: z.string(),  // Folder title
  path: z.string(),  // Full path from root (e.g., "Bookmarks Bar/Work/Projects")
  depth: z.number(),  // Depth level in hierarchy
  parentId: z.string().optional(),  // Parent folder ID
  bookmarkCount: z.number(),  // Number of bookmarks in this folder
  subfolderCount: z.number(),  // Number of subfolders
  totalItemCount: z.number()  // Total items (bookmarks + subfolders)
});

export type FolderItem = z.infer<typeof FolderItemSchema>;


/**
 * Operation types for bookmark folder tool
 */
export const FolderOperationTypeEnum = z.enum([
  'create',  // Create new folders
  'delete',  // Delete folders
  'list'     // List all folders
]);

export type FolderOperationType = z.infer<typeof FolderOperationTypeEnum>;

/**
 * Simplified uniform schema for all folder operations
 */
export const BookmarksFolderInputSchema = z.object({
  operationType: FolderOperationTypeEnum,  // The operation to perform
  
  // Common optional fields used across operations
  folder_names: z.array(z.string()).optional(),  // For create operation
  folder_ids: z.array(z.string()).optional(),  // For delete operations
  parent_id: z.string().optional(),  // For create, list operations
  delete_empty: z.boolean().optional(),  // For delete operation
  force: z.boolean().optional(),  // For delete operation
  dry_run: z.boolean().optional(),  // For delete operations
  include_system: z.boolean().optional(),  // For list operation
  max_depth: z.number().optional()  // For list operation
});

export type BookmarksFolderInput = z.infer<typeof BookmarksFolderInputSchema>;

/**
 * Simplified output schema for all folder operations
 */
export const BookmarksFolderOutputSchema = z.object({
  success: z.boolean(),  // Whether the operation succeeded
  operationType: FolderOperationTypeEnum,  // Operation that was performed
  message: z.string(),  // Human-readable result message
  
  // Results specific to different operations
  folders: z.array(FolderItemSchema).optional(),  // For list operation
  createdFolders: z.array(FolderResultSchema).optional(),  // For create operation
  deletedFolders: z.array(FolderDeletionResultSchema).optional(),  // For delete operation
  
  totalCount: z.number().optional(),  // Total items processed
  createdCount: z.number().optional(),  // For create operation
  deletedCount: z.number().optional(),  // For delete operation
  skippedCount: z.number().optional(),  // For operations that skip items
  failedCount: z.number().optional()  // For operations that can fail
});

export type BookmarksFolderOutput = z.infer<typeof BookmarksFolderOutputSchema>;

/**
 * Unified tool for bookmark folder operations with simplified input
 */
export class BookmarksFolderTool extends NxtscapeTool<BookmarksFolderInput, BookmarksFolderOutput> {
  constructor(executionContext: ExecutionContext) {
    const config: ToolConfig<BookmarksFolderInput, BookmarksFolderOutput> = {
      name: 'bookmarks_folder',
      description: 'Manage bookmark folders with a simple interface. Operations: "create" (create folders), "delete" (delete folders), "list" (list all folders). Always pass operationType. Use folder_names for create, folder_ids for delete, parent_id for create/list.',
      category: 'bookmarks',
      version: '2.0.0',
      inputSchema: BookmarksFolderInputSchema,
      outputSchema: BookmarksFolderOutputSchema,
      examples: [
        // Create operation examples
        {
          description: 'Create Work folder in bookmark bar',
          input: { 
            operationType: 'create',
            folder_names: ['Work']
          },
          output: {
            success: true,
            operationType: 'create',
            message: 'Successfully created 1 folder',
            createdCount: 1,
            skippedCount: 0,
            failedCount: 0,
            createdFolders: [
              {
                name: 'Work',
                folderId: 'folder_work_1234',
                folderPath: 'Bookmarks Bar/Work',
                created: true,
                skipped: false
              }
            ]
          }
        },
        {
          description: 'Create project folders structure',
          input: { 
            operationType: 'create',
            folder_names: ['Project Alpha', 'Project Beta', 'Project Gamma'],
            parent_id: 'folder_work_1234'
          },
          output: {
            success: true,
            operationType: 'create',
            message: 'Successfully created 3 folders',
            createdCount: 3,
            skippedCount: 0,
            failedCount: 0,
            createdFolders: [
              {
                name: 'Project Alpha',
                folderId: 'folder_alpha_5678',
                folderPath: 'Bookmarks Bar/Work/Project Alpha',
                created: true,
                skipped: false
              },
              {
                name: 'Project Beta',
                folderId: 'folder_beta_5679',
                folderPath: 'Bookmarks Bar/Work/Project Beta',
                created: true,
                skipped: false
              },
              {
                name: 'Project Gamma',
                folderId: 'folder_gamma_5680',
                folderPath: 'Bookmarks Bar/Work/Project Gamma',
                created: true,
                skipped: false
              }
            ]
          }
        },
        {
          description: 'Create development resource folders',
          input: { 
            operationType: 'create',
            folder_names: ['Frontend', 'Backend', 'DevOps', 'APIs', 'Libraries'],
            parent_id: 'folder_dev_resources_9999'
          },
          output: {
            success: true,
            operationType: 'create',
            message: 'Successfully created 4 folders, skipped 1 existing folder',
            createdCount: 4,
            skippedCount: 1,
            failedCount: 0,
            createdFolders: [
              {
                name: 'Frontend',
                folderId: 'folder_frontend_1111',
                folderPath: 'Bookmarks Bar/Development Resources/Frontend',
                created: true,
                skipped: false
              },
              {
                name: 'Backend',
                folderId: 'folder_backend_2222',
                folderPath: 'Bookmarks Bar/Development Resources/Backend',
                created: true,
                skipped: false
              },
              {
                name: 'DevOps',
                folderId: 'folder_devops_3333',
                folderPath: 'Bookmarks Bar/Development Resources/DevOps',
                created: true,
                skipped: false
              },
              {
                name: 'APIs',
                folderId: 'folder_apis_existing',
                folderPath: 'Bookmarks Bar/Development Resources/APIs',
                created: false,
                skipped: true
              },
              {
                name: 'Libraries',
                folderId: 'folder_libs_4444',
                folderPath: 'Bookmarks Bar/Development Resources/Libraries',
                created: true,
                skipped: false
              }
            ]
          }
        },
        // Delete operation examples
        {
          description: 'Delete old project folders',
          input: { 
            operationType: 'delete',
            folder_ids: ['folder_old_proj_1', 'folder_old_proj_2'],
            force: true
          },
          output: {
            success: true,
            operationType: 'delete',
            message: 'Successfully deleted 2 folders',
            deletedCount: 2,
            deletedFolders: [
              {
                folderId: 'folder_old_proj_1',
                folderPath: 'Bookmarks Bar/Archive/Old Project 2022',
                success: true,
                itemCount: 23
              },
              {
                folderId: 'folder_old_proj_2',
                folderPath: 'Bookmarks Bar/Archive/Legacy Code',
                success: true,
                itemCount: 15
              }
            ]
          }
        },
        {
          description: 'Clean up all empty folders',
          input: { 
            operationType: 'delete',
            delete_empty: true
          },
          output: {
            success: true,
            operationType: 'delete',
            message: 'Cleaned up 5 empty folders',
            deletedCount: 5,
            deletedFolders: [
              {
                folderId: 'folder_empty_1',
                folderPath: 'Bookmarks Bar/Temp',
                success: true,
                itemCount: 0
              },
              {
                folderId: 'folder_empty_2',
                folderPath: 'Bookmarks Bar/Work/Old Sprint',
                success: true,
                itemCount: 0
              },
              {
                folderId: 'folder_empty_3',
                folderPath: 'Bookmarks Bar/Learning/Completed',
                success: true,
                itemCount: 0
              },
              {
                folderId: 'folder_empty_4',
                folderPath: 'Bookmarks Bar/Archive/2021',
                success: true,
                itemCount: 0
              },
              {
                folderId: 'folder_empty_5',
                folderPath: 'Bookmarks Bar/Projects/Cancelled',
                success: true,
                itemCount: 0
              }
            ]
          }
        },
        {
          description: 'Preview deletion with dry run',
          input: { 
            operationType: 'delete',
            folder_ids: ['folder_important_1234'],
            dry_run: true
          },
          output: {
            success: true,
            operationType: 'delete',
            message: 'DRY RUN: Would delete 1 folder with 45 items',
            deletedCount: 1,
            deletedFolders: [
              {
                folderId: 'folder_important_1234',
                folderPath: 'Bookmarks Bar/Important Resources',
                success: true,
                itemCount: 45
              }
            ]
          }
        },
        // List operation examples
        {
          description: 'List all bookmark folders',
          input: { 
            operationType: 'list'
          },
          output: {
            success: true,
            operationType: 'list',
            message: 'Found 24 folders in bookmark bar',
            totalCount: 24,
            folders: [
              {
                id: 'folder_work_1234',
                title: 'Work',
                path: 'Work',
                depth: 1,
                parentId: '1',
                bookmarkCount: 12,
                subfolderCount: 5,
                totalItemCount: 17
              },
              {
                id: 'folder_dev_resources_9999',
                title: 'Development Resources',
                path: 'Development Resources',
                depth: 1,
                parentId: '1',
                bookmarkCount: 156,
                subfolderCount: 8,
                totalItemCount: 164
              },
              {
                id: 'folder_learning_5678',
                title: 'Learning',
                path: 'Learning',
                depth: 1,
                parentId: '1',
                bookmarkCount: 89,
                subfolderCount: 4,
                totalItemCount: 93
              }
            ]
          }
        },
        {
          description: 'List folders within specific parent',
          input: { 
            operationType: 'list',
            parent_id: 'folder_work_1234',
            max_depth: 2
          },
          output: {
            success: true,
            operationType: 'list',
            message: 'Found 5 folders in Work',
            totalCount: 5,
            folders: [
              {
                id: 'folder_alpha_5678',
                title: 'Project Alpha',
                path: 'Work/Project Alpha',
                depth: 2,
                parentId: 'folder_work_1234',
                bookmarkCount: 23,
                subfolderCount: 2,
                totalItemCount: 25
              },
              {
                id: 'folder_beta_5679',
                title: 'Project Beta',
                path: 'Work/Project Beta',
                depth: 2,
                parentId: 'folder_work_1234',
                bookmarkCount: 15,
                subfolderCount: 0,
                totalItemCount: 15
              }
            ]
          }
        }
      ],
      streamingConfig: {
        displayName: 'Bookmark Folders',
        icon: '📁',
        progressMessage: 'Processing folder operation...'
      }
    };

    super(config, executionContext);
  }

  /**
   * Override: Generate contextual display message
   */
  getProgressMessage(args: BookmarksFolderInput): string {
    try {
      // Note: args should already be parsed by StreamEventProcessor

      const operationType = args?.operationType;
      
      switch (operationType) {
        case 'create':
          const folderCount = args?.folder_names?.length || 0;
          return `Creating ${folderCount} bookmark folder${folderCount > 1 ? 's' : ''}...`;
          
        case 'delete':
          if (args?.dry_run) {
            return 'Previewing folder deletions...';
          }
          if (args?.delete_empty) {
            return 'Cleaning up empty folders...';
          }
          const deleteCount = args?.folder_ids?.length || 0;
          return `Deleting ${deleteCount} folder${deleteCount > 1 ? 's' : ''}...`;
          
        case 'list':
          return 'Listing bookmark folders...';
          
        default:
          return 'Processing folder operation...';
      }
    } catch {
      return 'Processing folder operation...';
    }
  }

  /**
   * Override: Format result for display
   */
  FormatResultForUI(output: BookmarksFolderOutput): string {
    if (!output.success) {
      return `❌ ${output.message}`;
    }

    switch (output.operationType) {
      case 'create':
        const parts = [`📂 ${output.message}`];
        if (output.createdCount && output.createdCount > 0) {
          parts.push(`✅ Created: ${output.createdCount}`);
        }
        if (output.skippedCount && output.skippedCount > 0) {
          parts.push(`⏭️ Skipped: ${output.skippedCount}`);
        }
        if (output.failedCount && output.failedCount > 0) {
          parts.push(`❌ Failed: ${output.failedCount}`);
        }
        return parts.join('\n');
        
      case 'delete':
        return `🗑️ ${output.message}`;
        
      case 'list':
        if (output.totalCount === 0) {
          return `📁 No folders found`;
        }
        return `📁 Found ${output.totalCount} folder${output.totalCount === 1 ? '' : 's'}`;
        
      default:
        return `✅ ${output.message}`;
    }
  }

  protected async execute(input: BookmarksFolderInput): Promise<BookmarksFolderOutput> {
    // Validate inputs for operations that need them
    switch (input.operationType) {
      case 'create':
        if (!input.folder_names || input.folder_names.length === 0) {
          return {
            success: false,
            operationType: input.operationType,
            message: 'create operation requires at least one folder_name'
          };
        }
        break;
      case 'delete':
        // Delete can work with either folder_ids or delete_empty
        if (!input.folder_ids && !input.delete_empty) {
          return {
            success: false,
            operationType: input.operationType,
            message: 'delete operation requires either folder_ids or delete_empty flag'
          };
        }
        break;
    }

    // Execute the operation
    try {
      switch (input.operationType) {
        case 'create':
          return await this.executeCreate(input);
        case 'delete':
          return await this.executeDelete(input);
        case 'list':
          return await this.executeList(input);
        default:
          return {
            success: false,
            operationType: 'create',
            message: 'Invalid operation type specified'
          };
      }
    } catch (error) {
      console.error('[bookmarks_folder] Error:', error);
      return {
        success: false,
        operationType: input.operationType,
        message: `Error performing operation: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }

  /**
   * Execute create operation - simplified to create flat folders
   */
  private async executeCreate(input: BookmarksFolderInput): Promise<BookmarksFolderOutput> {
    const folderNames = input.folder_names!;
    const parentId = input.parent_id;

    // Determine root parent folder
    let rootParentId: string;
    let rootParentPath: string = 'Bookmarks Bar';

    if (parentId) {
      rootParentId = parentId;
      try {
        const parentFolder = await chrome.bookmarks.get(parentId);
        if (parentFolder[0].url) {
          return {
            success: false,
            operationType: 'create',
            message: 'Parent ID is not a folder'
          };
        }
        rootParentPath = await getFolderPath(parentId);
      } catch {
        return {
          success: false,
          operationType: 'create',
          message: `Parent folder with ID "${parentId}" not found`
        };
      }
    } else {
      const bookmarkBar = await getBookmarkBar();
      if (!bookmarkBar) {
        return {
          success: false,
          operationType: 'create',
          message: 'Could not find bookmark bar'
        };
      }
      rootParentId = bookmarkBar.id;
    }

    // Create folders
    const results: FolderResult[] = [];
    let createdCount = 0;
    let skippedCount = 0;
    let failedCount = 0;

    for (const folderName of folderNames) {
      const folderPath = `${rootParentPath}/${folderName}`;
      
      try {
        // Check if folder already exists
        const children = await chrome.bookmarks.getChildren(rootParentId);
        const existingFolder = children.find(child => !child.url && child.title === folderName);
        
        if (existingFolder) {
          results.push({
            name: folderName,
            folderId: existingFolder.id,
            folderPath,
            created: false,
            skipped: true
          });
          skippedCount++;
        } else {
          // Create the folder
          const newFolder = await chrome.bookmarks.create({
            parentId: rootParentId,
            title: folderName
          });
          
          results.push({
            name: folderName,
            folderId: newFolder.id,
            folderPath,
            created: true,
            skipped: false
          });
          createdCount++;
        }
      } catch (error) {
        results.push({
          name: folderName,
          folderPath,
          created: false,
          skipped: false,
          error: error instanceof Error ? error.message : String(error)
        });
        failedCount++;
      }
    }

    return {
      success: failedCount === 0,
      operationType: 'create',
      message: this.generateCreateSummaryMessage(createdCount, skippedCount, failedCount),
      createdFolders: results,
      createdCount,
      skippedCount,
      failedCount
    };
  }

  /**
   * Execute delete operation
   */
  private async executeDelete(input: BookmarksFolderInput): Promise<BookmarksFolderOutput> {
    const deletedFolders: FolderDeletionResult[] = [];
    const failedFolders: FolderDeletionResult[] = [];
    const skippedFolders: FolderDeletionResult[] = [];

    // Get bookmark bar for empty folder cleanup
    const bookmarkBar = await getBookmarkBar();
    if (!bookmarkBar) {
      return {
        success: false,
        operationType: 'delete',
        message: 'Could not access bookmark bar'
      };
    }

    // Handle specific folder deletions
    if (input.folder_ids && input.folder_ids.length > 0) {
      for (const folderId of input.folder_ids) {
        try {
          const folders = await chrome.bookmarks.get(folderId);
          const folder = folders[0];
          
          if (!folder || folder.url) {
            failedFolders.push({
              folderId,
              folderPath: 'Unknown',
              success: false,
              reason: 'Not a valid folder'
            });
            continue;
          }

          await this.processFolderDeletion(
            folder,
            input,
            deletedFolders,
            failedFolders,
            skippedFolders
          );
        } catch (error) {
          failedFolders.push({
            folderId,
            folderPath: 'Unknown',
            success: false,
            reason: 'Folder not found'
          });
        }
      }
    }

    // Handle empty folder cleanup
    if (input.delete_empty) {
      await this.cleanupEmptyFolders(
        bookmarkBar.id,
        deletedFolders,
        failedFolders,
        skippedFolders,
        input.dry_run || false
      );
    }

    const deletedCount = deletedFolders.length;
    const totalProcessed = deletedCount + failedFolders.length + skippedFolders.length;

    let message: string;
    if (input.dry_run) {
      const totalItems = deletedFolders.reduce((sum, f) => sum + (f.itemCount || 0), 0);
      message = `DRY RUN: Would delete ${deletedCount} folder${deletedCount !== 1 ? 's' : ''} with ${totalItems} items`;
    } else if (deletedCount === 0) {
      message = 'No folders were deleted';
    } else if (input.delete_empty) {
      message = `Cleaned up ${deletedCount} empty folder${deletedCount !== 1 ? 's' : ''}`;
    } else {
      message = `Successfully deleted ${deletedCount} folder${deletedCount !== 1 ? 's' : ''}`;
    }

    return {
      success: true,
      operationType: 'delete',
      message,
      deletedFolders,
      deletedCount,
      totalCount: totalProcessed
    };
  }

  /**
   * Execute list operation
   */
  private async executeList(input: BookmarksFolderInput): Promise<BookmarksFolderOutput> {
    const includeSystemFolders = input.include_system ?? false;
    const maxDepth = input.max_depth;
    const parentFolderId = input.parent_id;

    // Get starting point
    let startFolder: chrome.bookmarks.BookmarkTreeNode;
    let startFolderName: string;
    
    if (parentFolderId) {
      const folders = await chrome.bookmarks.get(parentFolderId);
      startFolder = folders[0];
      startFolderName = startFolder.title;
    } else {
      const bookmarkBar = await getBookmarkBar();
      if (!bookmarkBar) {
        return {
          success: false,
          operationType: 'list',
          message: 'Could not find bookmark bar'
        };
      }
      startFolder = bookmarkBar;
      startFolderName = 'bookmark bar';
    }

    // Collect all folders recursively
    const folders: FolderItem[] = [];
    await this.collectFoldersRecursively(
      startFolder,
      '',
      0,
      folders,
      maxDepth,
      includeSystemFolders
    );

    // Sort folders by path for better readability
    folders.sort((a, b) => a.path.localeCompare(b.path));

    return {
      success: true,
      operationType: 'list',
      message: `Found ${folders.length} folder${folders.length === 1 ? '' : 's'} in ${startFolderName}`,
      folders,
      totalCount: folders.length
    };
  }

  // Helper methods

  /**
   * Generate summary message for create operation
   */
  private generateCreateSummaryMessage(created: number, skipped: number, failed: number): string {
    const parts: string[] = [];
    
    if (created > 0) {
      parts.push(`created ${created} folder${created > 1 ? 's' : ''}`);
    }
    
    if (skipped > 0) {
      parts.push(`skipped ${skipped} existing folder${skipped > 1 ? 's' : ''}`);
    }
    
    if (failed > 0) {
      parts.push(`failed to create ${failed} folder${failed > 1 ? 's' : ''}`);
    }

    if (parts.length === 0) {
      return 'No folders processed';
    }

    return `Successfully ${parts.join(', ')}`;
  }

  /**
   * Process deletion of a single folder
   */
  private async processFolderDeletion(
    folder: chrome.bookmarks.BookmarkTreeNode,
    input: BookmarksFolderInput,
    deletedFolders: FolderDeletionResult[],
    failedFolders: FolderDeletionResult[],
    skippedFolders: FolderDeletionResult[]
  ): Promise<void> {
    const folderPath = await getFolderPath(folder.id);
    
    // Check if folder is protected
    if (isProtectedFolder(folder)) {
      skippedFolders.push({
        folderId: folder.id,
        folderPath,
        success: false,
        reason: 'Protected system folder'
      });
      return;
    }

    try {
      // Check folder contents
      const children = await chrome.bookmarks.getChildren(folder.id);
      const itemCount = children.length;

      // Check if force is required for non-empty folders
      if (itemCount > 0 && !input.force) {
        failedFolders.push({
          folderId: folder.id,
          folderPath,
          success: false,
          reason: `Contains ${itemCount} items (use force: true to delete)`,
          itemCount
        });
        return;
      }

      // Perform deletion (or simulate for dry run)
      if (!input.dry_run) {
        await chrome.bookmarks.removeTree(folder.id);
      }

      deletedFolders.push({
        folderId: folder.id,
        folderPath,
        success: true,
        itemCount
      });
    } catch (error) {
      failedFolders.push({
        folderId: folder.id,
        folderPath,
        success: false,
        reason: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Clean up empty folders recursively
   */
  private async cleanupEmptyFolders(
    startFolderId: string,
    deletedFolders: FolderDeletionResult[],
    failedFolders: FolderDeletionResult[],
    skippedFolders: FolderDeletionResult[],
    dryRun: boolean
  ): Promise<void> {
    // First, collect all empty folders recursively
    const emptyFolders = await this.collectEmptyFoldersRecursively(startFolderId);
    
    // Process each empty folder for deletion
    for (const folder of emptyFolders) {
      const folderPath = await getFolderPath(folder.id);
      
      // Skip protected folders
      if (isProtectedFolder(folder)) {
        skippedFolders.push({
          folderId: folder.id,
          folderPath,
          success: false,
          reason: 'Protected system folder',
          itemCount: 0
        });
        continue;
      }

      try {
        // Perform deletion (or simulate for dry run)
        if (!dryRun) {
          await chrome.bookmarks.remove(folder.id);
        }
        
        deletedFolders.push({
          folderId: folder.id,
          folderPath,
          success: true,
          itemCount: 0
        });
      } catch (error) {
        failedFolders.push({
          folderId: folder.id,
          folderPath,
          success: false,
          reason: error instanceof Error ? error.message : 'Unknown error',
          itemCount: 0
        });
      }
    }
  }

  /**
   * Recursively collect all empty folders
   */
  private async collectEmptyFoldersRecursively(
    parentFolderId: string,
    collected: chrome.bookmarks.BookmarkTreeNode[] = []
  ): Promise<chrome.bookmarks.BookmarkTreeNode[]> {
    try {
      const children = await chrome.bookmarks.getChildren(parentFolderId);
      const folders = children.filter(child => !child.url);
      
      // First, recursively process all subfolders (depth-first)
      for (const folder of folders) {
        if (!isProtectedFolder(folder)) {
          await this.collectEmptyFoldersRecursively(folder.id, collected);
        }
      }
      
      // After processing subfolders, check if any folders at this level are now empty
      for (const folder of folders) {
        if (!isProtectedFolder(folder)) {
          const folderChildren = await chrome.bookmarks.getChildren(folder.id);
          if (folderChildren.length === 0) {
            collected.push(folder);
          }
        }
      }
    } catch (error) {
      console.error(`Error collecting empty folders from ${parentFolderId}:`, error);
    }
    
    return collected;
  }

  /**
   * Recursively collect all folders
   */
  private async collectFoldersRecursively(
    folder: chrome.bookmarks.BookmarkTreeNode,
    parentPath: string,
    depth: number,
    folders: FolderItem[],
    maxDepth?: number,
    includeSystemFolders: boolean = false
  ): Promise<void> {
    // Check depth limit
    if (maxDepth !== undefined && depth > maxDepth) {
      return;
    }

    // Skip system folders if not included
    if (!includeSystemFolders && isSystemFolder(folder)) {
      return;
    }

    // Build current path
    const currentPath = parentPath ? `${parentPath}/${folder.title}` : folder.title;

    // Get children to count items
    const children = await chrome.bookmarks.getChildren(folder.id);
    const bookmarkCount = children.filter(child => child.url).length;
    const subfolders = children.filter(child => !child.url);
    const subfolderCount = subfolders.length;

    // Add current folder (skip root)
    if (depth > 0 || folder.title !== 'Bookmarks Bar') {
      folders.push({
        id: folder.id,
        title: folder.title,
        path: currentPath,
        depth: depth,
        parentId: folder.parentId,
        bookmarkCount: bookmarkCount,
        subfolderCount: subfolderCount,
        totalItemCount: bookmarkCount + subfolderCount
      });
    }

    // Process subfolders
    for (const subfolder of subfolders) {
      await this.collectFoldersRecursively(
        subfolder,
        currentPath,
        depth + 1,
        folders,
        maxDepth,
        includeSystemFolders
      );
    }
  }

  /**
   * Get folder by ID
   */
  private async getFolder(folderId: string): Promise<chrome.bookmarks.BookmarkTreeNode | null> {
    try {
      const folders = await chrome.bookmarks.get(folderId);
      const folder = folders[0];
      if (folder && !folder.url) {
        return folder;
      }
    } catch {
      // Folder not found
    }
    return null;
  }

} 
