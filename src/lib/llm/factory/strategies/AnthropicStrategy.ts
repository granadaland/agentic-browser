import { LLMSettings, ResolvedProviderConfig } from '@/lib/llm/settings/types'
import { Logging } from '@/lib/utils/Logging'

/**
 * Strategy for Anthropic provider configuration (BYOK)
 */
export class AnthropicStrategy {
  private static readonly DEFAULT_MODEL = 'claude-3-5-sonnet-latest'
  private static readonly ANTHROPIC_BASE_URL = 'https://api.anthropic.com'
  
  /**
   * Resolve Anthropic settings to provider configuration
   * @param settings - LLM settings from browser preferences
   * @returns Resolved provider configuration
   */
  static resolve(settings: LLMSettings): ResolvedProviderConfig {
    Logging.log('AnthropicStrategy', 'Resolving Anthropic provider configuration')
    
    // Check if API key is provided
    if (!settings.anthropic.apiKey) {
      throw new Error('Anthropic API key required when using Anthropic provider. Please configure in settings.')
    }
    
    return {
      provider: 'anthropic',
      model: settings.anthropic.model || this.DEFAULT_MODEL,
      apiKey: settings.anthropic.apiKey,
      baseUrl: settings.anthropic.baseUrl || this.ANTHROPIC_BASE_URL,
      useProxy: false, // Direct API access
      temperature: undefined // Let factory decide
    }
  }
} 