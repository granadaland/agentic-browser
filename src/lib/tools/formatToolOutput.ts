/**
 * Lightweight tool output formatter that converts raw tool outputs to markdown
 * for nice display in the side panel.
 */

interface ToolResult {
  ok: boolean;
  output?: any;
  error?: string;
}

export function formatToolOutput(toolName: string, result: ToolResult): string {
  // Handle error cases first
  if (!result.ok) {
    const errorMessage = result.error || 'Unknown error occurred';
    return `Error in ${toolName}: ${errorMessage}`;
  }

  // Handle success cases
  const output = result.output;
  if (!output) return 'No output available.';

  switch (toolName) {
    case 'planner_tool': {
      // Output: { steps: [{ action: string, reasoning: string }] }
      if (!output.steps || !Array.isArray(output.steps)) {
        return JSON.stringify(output);
      }
      return `Created ${output.steps.length} step execution plan`;
    }

    case 'tab_operations': {
      // Return raw JSON for tab data so it can be properly formatted in the UI
      if (typeof output === 'string') {
        try {
          const tabs = JSON.parse(output);
          if (Array.isArray(tabs) && tabs.length > 0 && tabs.every(tab => 
            typeof tab === 'object' && 
            typeof tab.id === 'number' && 
            typeof tab.url === 'string' && 
            typeof tab.title === 'string' && 
            typeof tab.windowId === 'number'
          )) {
            // Return raw JSON for tab data to be formatted in UI
            return output;
          }
        } catch {
          // If parsing fails, return as-is
        }
      }
      
      // For non-tab data or errors, return formatted message
      if (Array.isArray(output) && output.length === 0) {
        return 'No open tabs found';
      }
      
      return `Found ${Array.isArray(output) ? output.length : 0} open tabs`;
    }

    case 'validator_tool': {
      // Output: { isComplete: boolean, reasoning: string, suggestions: string[] }
      const status = output.isComplete ? 'Complete' : 'Incomplete';
      return `Task validation: ${status}`;
    }

    case 'navigation_tool': {
      // Output: { url: string, success: boolean } or similar
      const navUrl = output.url || 'Unknown URL';
      const navStatus = output.success !== undefined ? (output.success ? 'Success' : 'Failed') : 'Complete';
      return `Navigation - ${navStatus}`;
    }

    case 'find_element': {
      // Output: { elements: [{ selector: string, text: string, position: {x,y} }] }
      if (!output.elements || !Array.isArray(output.elements)) {
        return JSON.stringify(output);
      }
      if (output.elements.length === 0) {
        return 'No elements found';
      }
      return `Found ${output.elements.length} element${output.elements.length > 1 ? 's' : ''}`;
    }

    case 'classification_tool': {
      // Output: { is_simple_task: boolean }
      const taskType = output.is_simple_task ? 'Simple' : 'Complex';
      return `Task classified as ${taskType}`;
    }

    case 'interact': {
      // Output: { success: boolean, action: string, element?: string }
      const action = output.action || 'Unknown action';
      const status = output.success ? 'Success' : 'Failed';
      return `${action} - ${status}`;
    }

    case 'scroll': {
      // Output: { success: boolean, direction?: string, amount?: number }
      const direction = output.direction || 'Unknown direction';
      const amount = output.amount !== undefined ? `${output.amount}px` : '';
      const status = output.success ? 'Success' : 'Failed';
      return `Scrolled ${direction} ${amount} - ${status}`;
    }

    case 'search': {
      // Output: { matches: [{ text: string, selector: string }], query: string }
      if (!output.matches || !Array.isArray(output.matches)) {
        return JSON.stringify(output);
      }
      const query = output.query || 'Unknown query';
      if (output.matches.length === 0) {
        return `No matches found for "${query}"`;
      }
      return `Found ${output.matches.length} match${output.matches.length > 1 ? 'es' : ''} for "${query}"`;
    }

    case 'refresh_browser_state_tool': {
      // Output: Browser state snapshot (potentially large)
      return 'Browser state refreshed';
    }

    case 'group_tabs': {
      // Output: { groups: [{ name: string, tabs: [...] }] }
      if (!output.groups || !Array.isArray(output.groups)) {
        return JSON.stringify(output);
      }
      return `Created ${output.groups.length} tab group${output.groups.length > 1 ? 's' : ''}`;
    }

    case 'get_selected_tabs': {
      // Return raw JSON for selected tab data so it can be properly formatted in the UI
      if (typeof output === 'string') {
        try {
          const tabs = JSON.parse(output);
          if (Array.isArray(tabs) && tabs.length > 0 && tabs.every(tab => 
            typeof tab === 'object' && 
            typeof tab.id === 'number' && 
            typeof tab.url === 'string' && 
            typeof tab.title === 'string'
          )) {
            // Return raw JSON for tab data to be formatted in UI
            return output;
          }
        } catch {
          // If parsing fails, return as-is
        }
      }
      
      // For non-tab data or errors, return formatted message
      if (Array.isArray(output) && output.length === 0) {
        return 'No selected tabs found';
      }
      
      return `Found ${Array.isArray(output) ? output.length : 0} selected tab${Array.isArray(output) && output.length !== 1 ? 's' : ''}`;
    }

    case 'done_tool': {
      // Output: { status?: string, message?: string }
      if (output.message) {
        return output.message;
      } else if (output.status) {
        return `Task complete: ${output.status}`;
      } else {
        return 'Task complete';
      }
    }

    case 'todo_manager_tool': {
      // Output: string (success message) or XML for list action
      if (typeof output === 'string') {
        return output;
      }
      return JSON.stringify(output);
    }

    default:
      // Fallback to simple JSON string
      return JSON.stringify(output);
  }
}