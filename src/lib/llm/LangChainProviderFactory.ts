import { z } from 'zod'
import { ChatOpenAI } from '@langchain/openai'
import { ChatAnthropic } from '@langchain/anthropic'
import { ChatOllama } from '@langchain/ollama'
import { ChatGoogleGenerativeAI } from '@langchain/google-genai'
import { BaseChatModel } from '@langchain/core/language_models/chat_models'
import { Logging } from '@/lib/utils/Logging'
import { LLMSettingsReader } from '@/lib/llm/settings/LLMSettingsReader'
import { ProviderResolver } from '@/lib/llm/factory/ProviderResolver'

/**
 * Configuration schema for LangChain-based LLM providers
 */
export const LangChainProviderConfigSchema = z.object({
  provider: z.enum(['openai', 'claude', 'gemini', 'ollama']),  // Provider type
  model: z.string().optional(),  // Optional specific model name
  temperature: z.number().min(0).max(2).optional().default(0.2),  // Temperature setting
  apiKey: z.string().optional(),  // Optional API key override
  proxyUrl: z.string().url().optional(),  // Optional proxy URL override
  baseUrl: z.string().url().optional(),  // Optional base URL for Ollama/Gemini
  debugMode: z.boolean().default(false)  // Debug logging flag
})

export type LangChainProviderConfig = z.infer<typeof LangChainProviderConfigSchema>

/**
 * Default model configurations for different providers
 */
export const DEFAULT_MODELS = {
  openai: 'gpt-4o',
  claude: 'claude-3-5-sonnet',
  gemini: 'gemini-1.5-pro',
  ollama: 'qwen3'
} as const

const DEFAULT_TEMPERATURE = 0.2

/**
 * Override options schema for LLM creation
 */
export const LLMOverridesSchema = z.object({
  model: z.string().optional(),  // Override model selection
  temperature: z.number().min(0).max(2).optional()  // Override temperature
})

export type LLMOverrides = z.infer<typeof LLMOverridesSchema>

/**
 * Factory for creating LangChain-based chat model instances
 * configured for use with LangGraph agents and based on user settings
 */
export class LangChainProviderFactory {
  private static readonly DEFAULT_PROXY_URL = 'http://llm.nxtscape.ai'
  private static readonly DEFAULT_API_KEY = process.env.LITELLM_API_KEY || 'nokey'
  private static readonly DEFAULT_OLLAMA_BASE_URL = 'http://localhost:11434'

  /**
   * Creates an LLM based on user settings
   * @param overrides - Optional overrides for model/temperature
   * @returns Configured chat model instance
   */
  static async createLLM(overrides?: LLMOverrides): Promise<BaseChatModel> {
    try {
      Logging.log('LangChainProviderFactory', 'Creating LLM from user settings')
      
      // 1. Read settings from browser preferences
      const settings = await LLMSettingsReader.read()
      
      // 2. Resolve to provider configuration
      const config = ProviderResolver.resolve(settings)
      
      // 3. Apply overrides if provided
      if (overrides?.model) {
        config.model = overrides.model
        Logging.log('LangChainProviderFactory', `Model overridden to: ${overrides.model}`)
      }
      
      if (overrides?.temperature !== undefined) {
        config.temperature = overrides.temperature
        Logging.log('LangChainProviderFactory', `Temperature overridden to: ${overrides.temperature}`)
      }
      
      // 4. Create LLM using enhanced factory
      const llm = this.createFromConfig(config)
      
      Logging.log('LangChainProviderFactory', 
        `Created ${config.provider} LLM with model ${config.model}`)
      
      return llm
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      Logging.log('LangChainProviderFactory', `Failed to create LLM: ${errorMessage}`, 'error')
      throw error
    }
  }
  
  private static shouldIncludeTemperature(model: string): boolean {
    switch (model) {
      case 'o4-mini':
      case 'o3-mini':
      case 'o3-pro':
        return false
      default:
        if (model.includes('o3')) {
          return false
        }
        if (model.includes('o4')) {
          return false
        }
        return true
    }
  }
  
  /**
   * Create LLM from resolved configuration
   * @param config - Resolved provider configuration
   * @returns Configured chat model instance
   */
  private static createFromConfig(config: {
    provider: 'openai' | 'anthropic' | 'gemini' | 'ollama'
    model: string
    apiKey?: string
    baseUrl?: string
    useProxy: boolean
    temperature?: number
  }): BaseChatModel {
    // Map to LangChainProviderFactory config
    const factoryConfig = {
      provider: config.provider === 'anthropic' ? 'claude' as const : config.provider,
      model: config.model,
      temperature: config.temperature ?? (config.provider === 'anthropic' ? 0 : 0.2),
      apiKey: config.apiKey,
      proxyUrl: config.useProxy ? config.baseUrl : undefined,
      baseUrl: !config.useProxy && (config.provider === 'ollama' || config.provider === 'gemini') ? config.baseUrl : undefined,
      debugMode: false
    }
    
    // Handle BYOK for OpenAI/Anthropic
    if (!config.useProxy && config.provider === 'openai') {
      // For BYOK OpenAI, we need to pass baseUrl in configuration
      return this.createOpenAI(config.model, {
        temperature: factoryConfig.temperature,
        apiKey: config.apiKey,
        baseUrl: config.baseUrl, // Use custom base URL if provided
        proxyUrl: undefined // Ensure no proxy URL
      })
    }
    
    if (!config.useProxy && config.provider === 'anthropic') {
      // For BYOK Anthropic, ensure direct API access
      return this.createClaude(config.model, {
        temperature: factoryConfig.temperature,
        apiKey: config.apiKey,
        baseUrl: config.baseUrl, // Use custom base URL if provided
        proxyUrl: undefined // Ensure no proxy URL
      })
    }
    
    if (!config.useProxy && config.provider === 'gemini') {
      // For BYOK Gemini, ensure direct API access
      return this.createGemini(config.model, {
        temperature: factoryConfig.temperature,
        apiKey: config.apiKey,
        baseUrl: config.baseUrl, // Use custom base URL if provided
        proxyUrl: undefined // Ensure no proxy URL
      })
    }
    
    // For all other cases, use the generic provider method
    return this.createProvider(factoryConfig)
  }

  /**
   * Creates a ChatOpenAI instance configured for the Nxtscape proxy or direct API
   * @param config - Configuration for the OpenAI provider
   * @returns Configured ChatOpenAI instance
   */
  private static createOpenAIProvider(config: LangChainProviderConfig): ChatOpenAI {
    const modelName = config.model || DEFAULT_MODELS.openai
    const apiKey = config.apiKey || this.DEFAULT_API_KEY
    const isDirectAPI = !config.proxyUrl && config.apiKey && config.apiKey !== this.DEFAULT_API_KEY
    
    // o3, o4 and few openai models do not support temperature only 1.0
    let temperature: number = 1.0;
    if (modelName && this.shouldIncludeTemperature(modelName)) {
      temperature = config.temperature ?? DEFAULT_TEMPERATURE
    } else {
      temperature = 1.0
    }
    
    // For direct API (BYOK), use standard OpenAI configuration
    if (isDirectAPI) {
      const chatModel = new ChatOpenAI({
        modelName,
        temperature,
        apiKey,
        configuration: {
          dangerouslyAllowBrowser: true,
          // Use custom base URL if provided, otherwise use default OpenAI API
          ...(config.baseUrl && { baseURL: config.baseUrl })
        }
      })
      
      if (config.debugMode) {
        Logging.log('LangChainProviderFactory', `Created OpenAI provider (BYOK) with model: ${modelName}`)
      }
      
      return chatModel
    }
    
    // For proxy configuration
    const proxyUrl = config.proxyUrl || this.DEFAULT_PROXY_URL
    const chatModel = new ChatOpenAI({
      modelName,
      temperature: config.temperature || 0.2,
      apiKey,
      // The `configuration` field is forwarded directly to the underlying OpenAI client.
      // Passing baseURL here ensures requests hit our LiteLLM proxy instead of api.openai.com.
      configuration: {
        baseURL: proxyUrl,
        apiKey, // still required by openai client constructor
        dangerouslyAllowBrowser: true
      }
    })

    if (config.debugMode) {
      Logging.log('LangChainProviderFactory', `Created OpenAI provider (proxy) with model: ${modelName}`)
    }

    return chatModel
  }

  /**
   * Creates a ChatAnthropic instance configured for the Nxtscape proxy or direct API
   * @param config - Configuration for the Anthropic provider
   * @returns Configured ChatAnthropic instance
   */
  private static createAnthropicProvider(config: LangChainProviderConfig): ChatAnthropic {
    const modelName = config.model || DEFAULT_MODELS.claude
    const apiKey = config.apiKey || this.DEFAULT_API_KEY
    const isDirectAPI = !config.proxyUrl && config.apiKey && config.apiKey !== this.DEFAULT_API_KEY
    
    // For direct API (BYOK), use standard Anthropic configuration
    if (isDirectAPI) {
      const chatModel = new ChatAnthropic({
        model: modelName,
        temperature: config.temperature || 0,
        apiKey,
        // Use custom base URL if provided
        ...(config.baseUrl && { anthropicApiUrl: config.baseUrl })
      })
      
      if (config.debugMode) {
        Logging.log('LangChainProviderFactory', `Created Anthropic provider (BYOK) with model: ${modelName}`)
      }
      
      return chatModel
    }
    
    // For proxy configuration
    const proxyUrl = config.proxyUrl || this.DEFAULT_PROXY_URL
    const chatModel = new ChatAnthropic({
      model: modelName,
      temperature: config.temperature || 0,
      apiKey,
      anthropicApiUrl: proxyUrl
    })

    if (config.debugMode) {
      Logging.log('LangChainProviderFactory', `Created Anthropic provider (proxy) with model: ${modelName}`)
    }

    return chatModel
  }

  /**
   * Creates a Gemini provider instance
   * @param config - Validated provider configuration
   * @returns Configured ChatGoogleGenerativeAI instance
   */
  private static createGeminiProvider(config: LangChainProviderConfig): ChatGoogleGenerativeAI {
    const modelName = config.model || DEFAULT_MODELS.gemini
    const apiKey = config.apiKey || this.DEFAULT_API_KEY
    const isDirectAPI = !config.proxyUrl && config.apiKey && config.apiKey !== this.DEFAULT_API_KEY
    
    // For direct API (BYOK), use standard Gemini configuration
    if (isDirectAPI) {
      const chatModel = new ChatGoogleGenerativeAI({
        model: modelName,
        temperature: config.temperature || 0.2,
        apiKey,
        convertSystemMessageToHumanContent: true,
        // Use custom base URL if provided
        ...(config.baseUrl && { baseUrl: config.baseUrl })
      })
      
      if (config.debugMode) {
        Logging.log('LangChainProviderFactory', `Created Gemini provider (BYOK) with model: ${modelName}`)
      }
      
      return chatModel
    }
    
    // For proxy configuration (if supported in future)
    const proxyUrl = config.proxyUrl || this.DEFAULT_PROXY_URL
    const chatModel = new ChatGoogleGenerativeAI({
      model: modelName,
      temperature: config.temperature || 0.2,
      apiKey,
      convertSystemMessageToHumanContent: true,
      ...(proxyUrl && { baseUrl: proxyUrl })
    })

    if (config.debugMode) {
      Logging.log('LangChainProviderFactory', `Created Gemini provider (proxy) with model: ${modelName}`)
    }

    return chatModel
  }

  /**
   * Creates an Ollama provider instance
   * @param config - Validated provider configuration
   * @returns Configured ChatOllama instance
   */
  private static createOllamaProvider(config: LangChainProviderConfig): ChatOllama {
    const modelName = config.model || DEFAULT_MODELS.ollama
    const baseUrl = config.baseUrl || this.DEFAULT_OLLAMA_BASE_URL
    
    const chatModel = new ChatOllama({
      model: modelName,
      baseUrl,
      temperature: config.temperature || 0.2,
      verbose: config.debugMode
    })

    if (config.debugMode) {
      Logging.log('LangChainProviderFactory', `Created Ollama provider with model: ${modelName} at ${baseUrl}`)
    }

    return chatModel
  }

  /**
   * Creates a provider based on configuration
   * @param config - Provider configuration
   * @returns Configured chat model instance
   */
  public static createProvider(config: LangChainProviderConfig): BaseChatModel {
    const validatedConfig = LangChainProviderConfigSchema.parse(config)
    switch (validatedConfig.provider) {
      case 'openai':
        return this.createOpenAIProvider(validatedConfig)
      case 'claude':
        return this.createAnthropicProvider(validatedConfig)
      case 'gemini':
        return this.createGeminiProvider(validatedConfig)
      case 'ollama':
        return this.createOllamaProvider(validatedConfig)
      default:
        throw new Error(`Unsupported LangChain provider: ${validatedConfig.provider}. Supported providers: 'openai', 'claude', 'gemini', 'ollama'`)
    }
  }

  /**
   * Creates an OpenAI provider with default settings
   * @param model - Optional model name override
   * @param options - Optional additional configuration
   * @returns Configured ChatOpenAI instance
   */
  public static createOpenAI(
    model?: string, 
    options?: Partial<LangChainProviderConfig & { baseUrl?: string }>
  ): ChatOpenAI {
    

    const config: LangChainProviderConfig = {
      provider: 'openai',
      temperature: options?.temperature ?? DEFAULT_TEMPERATURE,
      debugMode: options?.debugMode ?? false,
      model,
      apiKey: options?.apiKey,
      proxyUrl: options?.proxyUrl,
      baseUrl: options?.baseUrl
    }
    
    return this.createOpenAIProvider(config)
  }

  /**
   * Creates a Claude provider with simplified configuration
   * @param model - Optional model name (defaults to claude-3-5-sonnet)
   * @param options - Optional additional configuration
   * @returns Configured ChatAnthropic instance
   */
  public static createClaude(
    model?: string,
    options?: Partial<LangChainProviderConfig & { baseUrl?: string }>
  ): BaseChatModel {
    const config: LangChainProviderConfig = {
      provider: 'claude',
      model: model || 'claude-3-5-sonnet',
      temperature: options?.temperature ?? 0,
      debugMode: options?.debugMode ?? false,
      baseUrl: options?.baseUrl,
      ...options
    }
    
    return this.createAnthropicProvider(config)
  }

  /**
   * Creates a Gemini provider with simplified configuration
   * @param model - Optional model name (defaults to gemini-1.5-pro)
   * @param options - Optional additional configuration
   * @returns Configured ChatGoogleGenerativeAI instance
   */
  public static createGemini(
    model?: string,
    options?: Partial<LangChainProviderConfig>
  ): BaseChatModel {
    const config: LangChainProviderConfig = {
      provider: 'gemini',
      model: model || 'gemini-1.5-pro',
      temperature: options?.temperature ?? 0.2,
      debugMode: options?.debugMode ?? false,
      ...options
    }
    
    return this.createGeminiProvider(config)
  }

  /**
   * Creates an Ollama provider with simplified configuration
   * @param model - Optional model name (defaults to qwen3)
   * @param options - Optional additional configuration
   * @returns Configured ChatOllama instance
   */
  public static createOllama(
    model?: string,
    options?: Partial<LangChainProviderConfig>
  ): BaseChatModel {
    const config: LangChainProviderConfig = {
      provider: 'ollama',
      model: model || 'qwen3',
      temperature: options?.temperature ?? 0.2,
      debugMode: options?.debugMode ?? false,
      ...options
    }
    
    return this.createOllamaProvider(config)
  }

  /**
   * Creates a provider with simplified configuration
   * @param provider - Provider name ('openai', 'claude', 'gemini', or 'ollama')
   * @param model - Optional model name
   * @param debugMode - Optional debug mode flag
   * @returns Configured chat model instance
   */
  public static create(
    provider: 'openai' | 'claude' | 'gemini' | 'ollama',
    model?: string,
    debugMode?: boolean
  ): BaseChatModel {
    return this.createProvider({
      provider,
      model,
      temperature: provider === 'claude' ? 0 : 0.2,
      debugMode: debugMode || false
    })
  }
} 
