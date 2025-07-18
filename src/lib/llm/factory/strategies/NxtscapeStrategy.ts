import { LLMSettings, ResolvedProviderConfig } from '@/lib/llm/settings/types'
import { Logging } from '@/lib/utils/Logging'

/**
 * Strategy for Nxtscape provider configuration
 */
export class NxtscapeStrategy {
  private static readonly DEFAULT_PROXY_URL = 'http://llm.nxtscape.ai'
  private static readonly DEFAULT_API_KEY = process.env.LITELLM_API_KEY || 'nokey'
  private static readonly DEFAULT_MODEL = 'claude-3-5-sonnet'
  
  /**
   * Resolve Nxtscape settings to provider configuration
   * @param settings - LLM settings from browser preferences
   * @returns Resolved provider configuration
   */
  static resolve(settings: LLMSettings): ResolvedProviderConfig {
    Logging.log('NxtscapeStrategy', 'Resolving Nxtscape provider configuration')
    
    // Nxtscape always uses the proxy with OpenAI provider
    return {
      provider: 'openai',
      model: settings.nxtscape.model || this.DEFAULT_MODEL,
      apiKey: this.DEFAULT_API_KEY,
      baseUrl: this.DEFAULT_PROXY_URL,
      useProxy: true,
      temperature: undefined // Let factory decide
    }
  }
} 