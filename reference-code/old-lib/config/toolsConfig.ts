/**
 * List of tools whose output should be saved to MessageManager.
 * Only tools in this list will have their output included in conversation memory.
 */
export const toolsToIncludeInMemory = [
  // Browser navigation tools
  'navigate',
  // 'search_text',
  // 'interact',
  // 'scroll',
  // 'wait',
  
  // Content extraction tools
  'extract',
  'refresh_browser_state',
  
  // Tab management tools
  // 'tab_operations',
  // 'group_tabs',
  // 'get_selected_tabs',
  
  // Bookmark tools
  // 'save_bookmark',
  // 'bookmark_management',
  // 'bookmark_search',
  // 'bookmarks_folder',
  
  // History tools
  // 'get_history',
  // 'stats_history',
  
  // Session tools
  // 'session_management',
  // 'session_execution',
  
  // Utility tools
  // 'get_date',
  // 'done',
  // 'terminate',
  
  // Answer tools
  'answer',
];

/**
 * Check if a tool's output should be included in memory
 * @param toolName - The name of the tool
 * @returns Whether the tool output should be saved to MessageManager
 */
export function shouldIncludeToolInMemory(toolName: string): boolean {
  return toolsToIncludeInMemory.includes(toolName);
}