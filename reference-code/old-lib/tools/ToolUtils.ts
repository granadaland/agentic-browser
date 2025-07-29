import { z } from 'zod';

/**
 * Constants for output size limits
 */
export const MAX_RETURN_CHARS = 20000;
export const MAX_SCREENSHOT_CHARS = 500000;

/**
 * Truncate a string to a maximum length
 * @param str - The string to truncate
 * @param maxLength - The maximum length (default: MAX_RETURN_CHARS)
 * @returns The truncated string
 */
export function truncate(str: string, maxLength: number = MAX_RETURN_CHARS): string {
  if (str.length <= maxLength) return str;
  return str.substring(0, maxLength) + `\n\n[Truncated ${str.length - maxLength} characters]`;
}

/**
 * Schema for tool result that includes success status
 */
export const ToolResultSchema = z.object({
  success: z.boolean(),  // Whether the operation succeeded
  message: z.string(),  // Result message
  data: z.unknown().optional()  // Optional additional data
});

export type ToolResult = z.infer<typeof ToolResultSchema>;

/**
 * Create a successful tool result
 */
export function createSuccessResult(message: string, data?: unknown): string {
  return message; // For now, just return the message for LangChain compatibility
}

/**
 * Create an error tool result
 */
export function createErrorResult(error: string | Error): string {
  const message = error instanceof Error ? error.message : error;
  return `Error: ${message}`;
}

/**
 * Parse options from input string (comma-separated key=value pairs)
 * @param input - Input string with options
 * @returns Parsed options object
 */
export function parseOptions(input: string): Record<string, string | boolean> {
  const options: Record<string, string | boolean> = {};
  
  if (!input || input.trim() === '') {
    return options;
  }

  // Split by comma and parse each part
  input.split(',').forEach(part => {
    const trimmed = part.trim();
    
    if (trimmed.includes('=')) {
      const [key, value] = trimmed.split('=', 2);
      options[key.trim()] = value.trim();
    } else {
      // Treat as boolean flag
      options[trimmed] = true;
    }
  });

  return options;
}