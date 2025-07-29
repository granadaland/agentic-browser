import { z } from 'zod';
import { shouldIncludeToolInMemory } from '@/lib/config/toolsConfig';

/**
 * Schema for ActionResult - tracks the outcome of tool executions
 */
export const ActionResultSchema = z.object({
  toolName: z.string(),  // Which tool was executed
  includeInMemory: z.boolean().default(false),  // Should this be added to conversation?
  extractedContent: z.string().nullable().default(null),  // Extracted content (for search_text, interact)
  timestamp: z.date().default(() => new Date()),  // When the action occurred
});

export type ActionResult = z.infer<typeof ActionResultSchema>;

/**
 * Helper class for creating ActionResult instances
 */
export class ActionResultBuilder {
  private result: Partial<ActionResult> = {};

  constructor(toolName: string) {
    this.result.toolName = toolName;
    this.result.timestamp = new Date();
    this.result.includeInMemory = shouldIncludeToolInMemory(toolName);
  }

  setExtractedContent(content: string | null): this {
    this.result.extractedContent = content;
    return this;
  }

  build(): ActionResult {
    return ActionResultSchema.parse(this.result);
  }
}


/**
 * Extracts the important content from tool output
 * Simplified: Just extract specific fields for interact and search_text
 */
export function extractContent(toolName: string, output: any): string | null {
  if (!output) return null;

  // Special handling for specific tools
  switch (toolName) {
    case 'search_text':
      // Extract output.text for search_text
      return output.text || null;
    
    case 'interact':
      // Extract output.options for interact
      if (output.options && Array.isArray(output.options) && output.options.length > 0) {
        return `options: ${JSON.stringify(output.options)}`;
      }
      return null;
    
    default:
      // For all other tools, return null (use raw output)
      return null;
  }
}