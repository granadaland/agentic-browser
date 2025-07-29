/**
 * Common utilities and operations for bookmark tools
 */

/**
 * Get the bookmark bar folder
 */
export async function getBookmarkBar(): Promise<chrome.bookmarks.BookmarkTreeNode | null> {
  const tree = await chrome.bookmarks.getTree();
  const root = tree[0];
  
  for (const child of root.children || []) {
    if (child.id === '1' || child.title === 'Bookmarks Bar') {
      return child;
    }
  }
  
  return null;
}

/**
 * Find a folder by its path (e.g., "Work/Projects/React")
 */
export async function findFolderByPath(path: string): Promise<chrome.bookmarks.BookmarkTreeNode | null> {
  const parts = path.split('/').filter(p => p.length > 0);
  if (parts.length === 0) return null;

  // Start from bookmark bar
  const bookmarkBar = await getBookmarkBar();
  if (!bookmarkBar) return null;

  let currentFolder = bookmarkBar;

  // Navigate through the path
  for (const part of parts) {
    const children = await chrome.bookmarks.getChildren(currentFolder.id);
    const folder = children.find(child => !child.url && child.title === part);
    
    if (!folder) {
      return null;  // Path not found
    }
    
    currentFolder = folder;
  }

  return currentFolder;
}

/**
 * Get the full path of a folder from its ID
 */
export async function getFolderPath(folderId: string): Promise<string> {
  const path: string[] = [];
  let currentId = folderId;

  while (currentId) {
    try {
      const folders = await chrome.bookmarks.get(currentId);
      const folder = folders[0];
      
      if (folder.title === 'Bookmarks Bar' || !folder.parentId) {
        path.unshift('Bookmarks Bar');
        break;
      }
      
      path.unshift(folder.title);
      currentId = folder.parentId;
    } catch {
      break;
    }
  }

  return path.join('/');
}

/**
 * Find a child folder by name within a parent folder
 */
export async function findChildFolder(
  parentId: string, 
  folderName: string
): Promise<chrome.bookmarks.BookmarkTreeNode | null> {
  const children = await chrome.bookmarks.getChildren(parentId);
  return children.find(child => !child.url && child.title === folderName) || null;
}

/**
 * Check if a folder is a system folder
 */
export function isSystemFolder(folder: chrome.bookmarks.BookmarkTreeNode): boolean {
  const systemFolders = ['Other Bookmarks', 'Mobile Bookmarks'];
  return systemFolders.includes(folder.title);
}

/**
 * Check if a folder is protected from deletion
 */
export function isProtectedFolder(folder: chrome.bookmarks.BookmarkTreeNode): boolean {
  // Protect system folders by ID
  const protectedIds = ['0', '1', '2'];  // Root, Bookmarks Bar, Other Bookmarks
  if (protectedIds.includes(folder.id)) {
    return true;
  }

  // Protect by name
  const protectedNames = [
    'Bookmarks Bar',
    'Other Bookmarks',
    'Mobile Bookmarks',
    'Sessions'
  ];
  
  return protectedNames.includes(folder.title);
}

/**
 * Recursively collect all bookmarks from a folder and its subfolders
 */
export async function collectAllBookmarksRecursively(
  folderId: string, 
  parentTitle: string, 
  targetFolderToSkip?: string
): Promise<Array<{ id: string; title: string; url: string; parentTitle?: string }>> {
  const allBookmarks: Array<{ id: string; title: string; url: string; parentTitle?: string }> = [];
  
  try {
    const children = await chrome.bookmarks.getChildren(folderId);
    
    for (const child of children) {
      if (child.url) {
        // It's a bookmark - add it to the collection
        allBookmarks.push({
          id: child.id,
          title: child.title,
          url: child.url,
          parentTitle: parentTitle
        });
      } else {
        // It's a folder - skip target folder and recursively explore others
        if (!targetFolderToSkip || child.title !== targetFolderToSkip) {
          const childBookmarks = await collectAllBookmarksRecursively(
            child.id, 
            child.title, 
            targetFolderToSkip
          );
          allBookmarks.push(...childBookmarks);
        }
      }
    }
  } catch (error) {
    console.error(`Error collecting bookmarks from folder ${folderId}:`, error);
  }
  
  return allBookmarks;
}

/**
 * Recursively clean up empty folders
 */
export async function cleanupEmptyFoldersRecursively(
  parentFolderId: string, 
  targetFolderToProtect?: string
): Promise<void> {
  try {
    const children = await chrome.bookmarks.getChildren(parentFolderId);
    const folders = children.filter(child => !child.url);
    
    // Process folders in reverse order to handle nested cleanup properly
    for (const folder of folders) {
      // Skip protected folders
      if ((targetFolderToProtect && folder.title === targetFolderToProtect) || isProtectedFolder(folder)) {
        continue;
      }
      
      // First, recursively clean up subfolders
      await cleanupEmptyFoldersRecursively(folder.id, targetFolderToProtect);
      
      // After cleaning subfolders, check if this folder is now empty
      const folderChildren = await chrome.bookmarks.getChildren(folder.id);
      if (folderChildren.length === 0) {
        await chrome.bookmarks.remove(folder.id);
      }
    }
  } catch (error) {
    console.error(`Error cleaning up folders in ${parentFolderId}:`, error);
  }
}

/**
 * Type for bookmark item with metadata
 */
export interface BookmarkWithMetadata {
  id: string;
  title: string;
  url: string;
  parentTitle?: string;
}

/**
 * Type for folder statistics
 */
export interface FolderStats {
  bookmarkCount: number;
  subfolderCount: number;
  totalItemCount: number;
}

/**
 * Move all bookmarks from source folder to destination folder (non-recursive)
 */
export async function moveBookmarksToFolder(
  sourceFolderId: string,
  destinationFolderId: string
): Promise<number> {
  let movedCount = 0;
  
  try {
    const children = await chrome.bookmarks.getChildren(sourceFolderId);
    const bookmarks = children.filter(child => child.url);
    
    for (const bookmark of bookmarks) {
      try {
        await chrome.bookmarks.move(bookmark.id, {
          parentId: destinationFolderId
        });
        movedCount++;
      } catch (error) {
        console.error(`Failed to move bookmark ${bookmark.title}:`, error);
      }
    }
  } catch (error) {
    console.error(`Error moving bookmarks from ${sourceFolderId}:`, error);
  }
  
  return movedCount;
} 