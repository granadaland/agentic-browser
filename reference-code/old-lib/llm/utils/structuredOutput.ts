import { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { z } from 'zod';
import { LLMSettingsReader } from '../settings/LLMSettingsReader';
import { Logging } from '@/lib/utils/Logging';

/**
 * OpenAI’s Structured Outputs mode does NOT allow optional object properties:
 * every key that appears in `properties` must also appear in the
 * `required` array.  The canonical workaround is to keep the property
 * required while permitting the value `null`.
 *
 * To automate this, we walk the supplied Zod schema and:
 *   • replace each `z.optional(T)` with `T.nullable()` (required-nullable)
 *   • recurse into nested objects and arrays so the rule is applied deeply.
 *
 * The resulting schema can be fed into `zodToJsonSchema` → OpenAI without
 * triggering the error: “uses .optional() without .nullable()”.
 */
function makeOpenAICompatible<T extends z.ZodTypeAny>(schema: T): T {
  // Handle ZodOptional by unwrapping it and adding .nullable()
  if (schema instanceof z.ZodOptional) {
    const inner = makeOpenAICompatible((schema as any)._def.innerType);
    return (inner.nullable() as unknown) as T;  // required + nullable
  }

  // Recursively process object shapes
  if (schema instanceof z.ZodObject) {
    const newShape: Record<string, z.ZodTypeAny> = {};
    for (const [key, value] of Object.entries(schema.shape)) {
      newShape[key] = makeOpenAICompatible(value as z.ZodTypeAny);
    }
    return (z.object(newShape) as unknown) as T;
  }

  // Process arrays by transforming their element type
  if (schema instanceof z.ZodArray) {
    const element = makeOpenAICompatible((schema as any)._def.type);
    return (z.array(element) as unknown) as T;
  }

  // Leave all other schema types unchanged
  return schema;
}

/**
 * Ollama models sometimes serialise enum values with different capitalisation
 * (e.g. "HIGH" vs "high").  This helper walks a schema and replaces every
 * ZodEnum/ZodNativeEnum with a case-insensitive equivalent that lower-cases
 * the input before validation, then returns the canonical lower-case value.
 */
function makeOllamaCompatible<T extends z.ZodTypeAny>(schema: T): T {
  // Handle optional by preserving optionality after transformation
  if (schema instanceof z.ZodOptional) {
    const inner = makeOllamaCompatible((schema as any)._def.innerType);
    return (inner.optional() as unknown) as T;
  }

  // Case-insensitive enums
  if (schema instanceof z.ZodEnum) {
    const values: string[] = (schema as any).options ?? (schema as any)._def.values;
    const lower = values.map(v => v.toLowerCase()) as [string, ...string[]];
    const ciEnum = z.preprocess((val) => typeof val === 'string' ? val.toLowerCase() : val, z.enum(lower));
    return (ciEnum as unknown) as T;
  }

  if (schema instanceof z.ZodNativeEnum) {
    const nativeEnum = (schema as any)._def.values;
    const stringVals = Object.values(nativeEnum).filter(v => typeof v === 'string') as string[];
    const lower = stringVals.map(v => v.toLowerCase()) as [string, ...string[]];
    const ciEnum = z.preprocess((val) => typeof val === 'string' ? val.toLowerCase() : val, z.enum(lower));
    return (ciEnum as unknown) as T;
  }

  // Recursively process object shapes
  if (schema instanceof z.ZodObject) {
    const newShape: Record<string, z.ZodTypeAny> = {};
    for (const [key, value] of Object.entries(schema.shape)) {
      newShape[key] = makeOllamaCompatible(value as z.ZodTypeAny);
    }
    return (z.object(newShape) as unknown) as T;
  }

  // Arrays – transform element type
  if (schema instanceof z.ZodArray) {
    const elem = makeOllamaCompatible((schema as any)._def.type);
    return (z.array(elem) as unknown) as T;
  }

  return schema;
}

/**
 * Creates a Zod schema that handles both direct and function-wrapped formats
 * This is designed to handle Ollama and other LLMs that return function-calling format
 */
export function createFlexibleSchema<T>(baseSchema: z.ZodSchema<T>): z.ZodSchema<T> {
  return z.union([
    // Accept direct format (what we expect)
    baseSchema,
    
    // Accept function calling format and extract arguments
    z.object({
      name: z.string(),
      arguments: baseSchema
    }).transform(data => data.arguments),
    
    // Accept function_call format (older OpenAI style)
    z.object({
      function_call: z.object({
        name: z.string(),
        arguments: baseSchema
      })
    }).transform(data => data.function_call!.arguments),
    
    // Accept arguments as string that needs parsing
    z.object({
      name: z.string(),
      arguments: z.string()
    }).transform(data => {
      const parsed = JSON.parse(data.arguments);
      return baseSchema.parse(parsed);
    }),
    
    // Accept tool_calls array format (newer OpenAI style)
    z.object({
      tool_calls: z.array(z.object({
        function: z.object({
          name: z.string(),
          arguments: z.union([baseSchema, z.string()])
        })
      })).min(1)  // Ensure at least one tool call
    }).transform(data => {
      const firstCall = data.tool_calls[0];
      if (!firstCall || !firstCall.function) {
        throw new Error('No tool calls found');
      }
      const args = firstCall.function.arguments;
      if (typeof args === 'string') {
        return baseSchema.parse(JSON.parse(args));
      }
      return args;
    })
  ]) as z.ZodSchema<T>;
}

/**
 * Provider-aware wrapper around `llm.withStructuredOutput()` that hides all
 * provider-specific edge-cases from callers.
 *
 * Strategy:
 *  • Ollama – models tend to wrap answers in tool-call envelopes ⇒ try a
 *    `flexibleSchema` (handles wrappers) with case-insensitive enums via
 *    `makeOllamaCompatible`, then other fallbacks.
 *  • Non-Ollama (OpenAI, Claude, …) – must satisfy OpenAI’s “no optional
 *    properties” rule ⇒ try `makeOpenAICompatible` first, then
 *    `flexibleSchema`, finally the plain schema.
 *
 * Each attempt is sandboxed; on failure we log a `warning` and proceed to the
 * next attempt, guaranteeing we always return a configured model instead of
 * throwing early.
 */
export async function withFlexibleStructuredOutput<T>(
  llm: BaseChatModel,
  schema: z.ZodSchema<T>
): Promise<any> { // Return 'any' for compatibility
  const settings = await LLMSettingsReader.read();
  const provider = settings.defaultProvider;

  // Helper: attempt a schema and swallow errors, logging them for debug
  const attempt = (factory: () => z.ZodSchema<any>): any | undefined => {
    try {
      const sch = factory();
      return llm.withStructuredOutput(sch as any);
    } catch (err) {
      Logging.log('structuredOutput', `Schema attempt failed: ${err}`, 'warning');
      return undefined;
    }
  };

  if (provider === 'ollama') {
    // 1️⃣ Ollama: case-insensitive enums + flexible wrappers first
    return (
      attempt(() => createFlexibleSchema(makeOllamaCompatible(schema))) ??
      attempt(() => createFlexibleSchema(schema)) ??
      attempt(() => makeOllamaCompatible(schema)) ??
      attempt(() => schema)
    );
  }

  // 2️⃣ Non-Ollama (OpenAI, Claude, etc.) → OpenAI-compatible → flexible → plain
  return (
    attempt(() => makeOpenAICompatible(schema)) ??
    attempt(() => createFlexibleSchema(schema)) ??
    attempt(() => schema)
  );
}