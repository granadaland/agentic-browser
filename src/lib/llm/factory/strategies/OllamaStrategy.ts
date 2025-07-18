import { LLMSettings, ResolvedProviderConfig } from '@/lib/llm/settings/types'
import { Logging } from '@/lib/utils/Logging'

/**
 * Strategy for Ollama provider configuration
 */
export class OllamaStrategy {
  private static readonly DEFAULT_MODEL = 'qwen3'
  private static readonly DEFAULT_BASE_URL = 'http://localhost:11434'
  
  /**
   * Resolve Ollama settings to provider configuration
   * @param settings - LLM settings from browser preferences
   * @returns Resolved provider configuration
   */
  static resolve(settings: LLMSettings): ResolvedProviderConfig {
    Logging.log('OllamaStrategy', 'Resolving Ollama provider configuration')
    
    // Check if base URL is provided
    if (!settings.ollama.baseUrl) {
      throw new Error('Ollama base URL not configured. Please set in browser settings.')
    }
    
    return {
      provider: 'ollama',
      model: settings.ollama.model || this.DEFAULT_MODEL,
      apiKey: settings.ollama.apiKey, // Optional for secured instances
      baseUrl: settings.ollama.baseUrl,
      useProxy: false, // Direct connection to Ollama
      temperature: undefined // Let factory decide
    }
  }
} 