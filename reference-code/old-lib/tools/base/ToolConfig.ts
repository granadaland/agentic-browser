import { z } from 'zod';

/**
 * Tool category enum
 */
export const ToolCategorySchema = z.enum([
  'navigation',
  'observation',
  'interaction',
  'tab_management',
  'control',
  'sessions',
  'bookmarks'
]);

export type ToolCategory = z.infer<typeof ToolCategorySchema>;

/**
 * Tool example schema
 */
export const ToolExampleSchema = z.object({
  description: z.string(),  // Description of what this example demonstrates
  input: z.record(z.unknown()),  // Example input parameters
  output: z.unknown()  // Expected output
});

export type ToolExample = z.infer<typeof ToolExampleSchema>;

/**
 * Tool configuration schema
 */
export const ToolConfigSchema = z.object({
  name: z.string(),  // Tool identifier (e.g., 'list_tabs')
  description: z.string(),  // Human-readable description
  category: ToolCategorySchema,  // Tool category
  version: z.string().default('1.0.0'),  // Tool version
  inputSchema: z.instanceof(z.ZodType),  // Zod schema for input validation
  outputSchema: z.instanceof(z.ZodType),  // Zod schema for output validation
  examples: z.array(ToolExampleSchema).optional(),  // Example inputs/outputs
  systemPromptTemplate: z.string().optional(),  // Custom prompt template
  streamingConfig: z.object({
    displayName: z.string().optional(),  // Display name for streaming UI
    icon: z.string().optional(),  // Icon identifier
    progressMessage: z.string().optional()  // Progress message template
  }).optional()
});

export type ToolConfig<TInput = any, TOutput = any> = Omit<z.infer<typeof ToolConfigSchema>, 'inputSchema' | 'outputSchema'> & {
  inputSchema: z.ZodType<TInput>;
  outputSchema: z.ZodType<TOutput>;
}; 