import { ExecutionContext } from '@/lib/runtime/ExecutionContext'
import { TokenCounter } from './TokenCounter'

/**
 * Utility functions for LLM interactions
 */

/**
 * Trims content to fit within max token limits
 * @param content - The content to potentially trim
 * @param executionContext - Context containing max token information
 * @param reserveTokens - Number of tokens to reserve for response (default: 1000)
 * @returns Trimmed content if needed
 */
export function trimToMaxTokens(
  content: string,
  executionContext: ExecutionContext,
  reserveTokens: number = 1000
): string {
  // Get max tokens from message manager
  const maxTokens = executionContext.messageManager.getMaxTokens()
  
  // Calculate available tokens (leave room for response)
  const availableTokens = maxTokens - reserveTokens
  
  // Count current tokens
  const currentTokens = TokenCounter.countString(content)
  
  // If within limits, return as-is
  if (currentTokens <= availableTokens) {
    return content
  }
  
  // Calculate how many characters we can keep (roughly)
  const maxChars = availableTokens * 4  // 4 chars per token approximation
  
  // Trim from the middle to preserve beginning and end
  const halfLength = Math.floor(maxChars / 2)
  const start = content.substring(0, halfLength)
  const end = content.substring(content.length - halfLength)
  
  return `${start}\n\n[... content trimmed to fit token limit ...]\n\n${end}`
}

/**
 * Checks if content exceeds max tokens and returns both the check and trimmed version
 * @param content - The content to check
 * @param executionContext - Context containing max token information  
 * @param reserveTokens - Number of tokens to reserve for response
 * @returns Object with exceeded flag and trimmed content
 */
export function checkAndTrimTokens(
  content: string,
  executionContext: ExecutionContext,
  reserveTokens: number = 1000
): { exceeded: boolean; content: string } {
  const maxTokens = executionContext.messageManager.getMaxTokens()
  const availableTokens = maxTokens - reserveTokens
  const currentTokens = TokenCounter.countString(content)
  
  if (currentTokens <= availableTokens) {
    return { exceeded: false, content }
  }
  
  return { 
    exceeded: true, 
    content: trimToMaxTokens(content, executionContext, reserveTokens)
  }
}