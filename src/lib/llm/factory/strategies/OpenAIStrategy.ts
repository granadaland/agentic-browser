import { LLMSettings, ResolvedProviderConfig } from '@/lib/llm/settings/types'
import { Logging } from '@/lib/utils/Logging'

/**
 * Strategy for OpenAI provider configuration (BYOK)
 */
export class OpenAIStrategy {
  private static readonly DEFAULT_MODEL = 'gpt-4o'
  private static readonly OPENAI_BASE_URL = 'https://api.openai.com/v1'
  
  /**
   * Resolve OpenAI settings to provider configuration
   * @param settings - LLM settings from browser preferences
   * @returns Resolved provider configuration
   */
  static resolve(settings: LLMSettings): ResolvedProviderConfig {
    Logging.log('OpenAIStrategy', 'Resolving OpenAI provider configuration')
    
    // Check if API key is provided
    if (!settings.openai.apiKey) {
      throw new Error('OpenAI API key required when using OpenAI provider. Please configure in settings.')
    }
    
    return {
      provider: 'openai',
      model: settings.openai.model || this.DEFAULT_MODEL,
      apiKey: settings.openai.apiKey,
      baseUrl: settings.openai.baseUrl || this.OPENAI_BASE_URL,
      useProxy: false, // Direct API access
      temperature: undefined // Let factory decide
    }
  }
} 