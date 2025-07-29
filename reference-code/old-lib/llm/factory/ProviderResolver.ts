import { LLMSettings, ResolvedProviderConfig, ProviderType } from '@/lib/llm/settings/types'
import { Logging } from '@/lib/utils/Logging'
import { NxtscapeStrategy } from './strategies/NxtscapeStrategy'
import { OpenAIStrategy } from './strategies/OpenAIStrategy'
import { AnthropicStrategy } from './strategies/AnthropicStrategy'
import { GeminiStrategy } from './strategies/GeminiStrategy'
import { OllamaStrategy } from './strategies/OllamaStrategy'

/**
 * Resolves LLM settings to provider configuration using strategy pattern
 */
export class ProviderResolver {
  /**
   * Resolve settings to provider configuration
   * @param settings - LLM settings from browser preferences
   * @returns Resolved provider configuration
   */
  static resolve(settings: LLMSettings): ResolvedProviderConfig {
    Logging.log('ProviderResolver', `Resolving configuration for provider: ${settings.defaultProvider}`)
    
    try {
      const strategy = this.getStrategy(settings.defaultProvider)
      const config = strategy.resolve(settings)
      
      Logging.log('ProviderResolver', 
        `Resolved to ${config.provider} provider with model ${config.model}`)
      
      return config
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      Logging.log('ProviderResolver', `Failed to resolve provider: ${errorMessage}`, 'error')
      throw error
    }
  }
  
  /**
   * Get strategy for provider type
   * @param provider - Provider type from settings
   * @returns Strategy instance
   */
  private static getStrategy(provider: ProviderType): { resolve: (settings: LLMSettings) => ResolvedProviderConfig } {
    switch (provider) {
      case 'nxtscape':
        return NxtscapeStrategy
      case 'openai':
        return OpenAIStrategy
      case 'anthropic':
        return AnthropicStrategy
      case 'gemini':
        return GeminiStrategy
      case 'ollama':
        return OllamaStrategy
      default:
        throw new Error(`Unknown provider: ${provider}. Please select a valid provider in settings.`)
    }
  }
} 