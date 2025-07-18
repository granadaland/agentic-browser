import { LLMSettings, ResolvedProviderConfig } from '@/lib/llm/settings/types'
import { Logging } from '@/lib/utils/Logging'

/**
 * Strategy for Google Gemini provider configuration (BYOK)
 */
export class GeminiStrategy {
  private static readonly DEFAULT_MODEL = 'gemini-2.0-flash'
  private static readonly GEMINI_BASE_URL = 'https://generativelanguage.googleapis.com/'
  
  /**
   * Resolve Gemini settings to provider configuration
   * @param settings - LLM settings from browser preferences
   * @returns Resolved provider configuration
   */
  static resolve(settings: LLMSettings): ResolvedProviderConfig {
    Logging.log('GeminiStrategy', 'Resolving Gemini provider configuration')
    
    // Check if API key is provided
    if (!settings.gemini.apiKey) {
      throw new Error('Google AI API key required when using Gemini provider. Please configure in settings.')
    }
    
    return {
      provider: 'gemini',
      model: settings.gemini.model || this.DEFAULT_MODEL,
      apiKey: settings.gemini.apiKey,
      baseUrl: settings.gemini.baseUrl || this.GEMINI_BASE_URL,
      useProxy: false, // Direct API access
      temperature: undefined // Let factory decide
    }
  }
} 