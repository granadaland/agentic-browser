import { z } from 'zod';
import { NxtscapeTool } from '../base/NxtscapeTool';
import { ToolConfig } from '../base/ToolConfig';
import { ExecutionContext } from '@/lib/runtime/ExecutionContext';

/**
 * Enum for search providers
 */
export const SearchProviderEnum = z.enum([
  'google',  // Google search
  'amazon',  // Amazon product search
  'google_maps',  // Google Maps location search
  'google_finance'  // Google Finance stock/financial search
]);

export type SearchProvider = z.infer<typeof SearchProviderEnum>;

/**
 * Schema for search tool input
 */
export const SearchInputSchema = z.object({
  searchProvider: SearchProviderEnum,  // The search provider to use
  query: z.string(),  // The search query
  intent: z.string().optional()  // Optional description of why this search is being performed
});

export type SearchInput = z.infer<typeof SearchInputSchema>;

/**
 * Schema for search tool output
 */
export const SearchOutputSchema = z.object({
  success: z.boolean(),  // Whether the operation succeeded
  searchProvider: SearchProviderEnum,  // Search provider that was used
  message: z.string(),  // Human-readable result message
  query: z.string(),  // The search query that was used
  url: z.string()  // The URL that was navigated to
});

export type SearchOutput = z.infer<typeof SearchOutputSchema>;

/**
 * Tool for performing searches across different providers
 */
export class SearchTool extends NxtscapeTool<SearchInput, SearchOutput> {
  constructor(executionContext: ExecutionContext) {
    const config: ToolConfig<SearchInput, SearchOutput> = {
      name: 'search',
      description: 'Perform searches on different platforms. Providers: "google" (general web search), "amazon" (product search), "google_maps" (location search), "google_finance" (stock/financial search). Always pass searchProvider and query.',
      category: 'navigation',
      version: '1.0.0',
      inputSchema: SearchInputSchema,
      outputSchema: SearchOutputSchema,
      examples: [
        {
          description: 'Search on Google',
          input: { 
            searchProvider: 'google',
            query: 'best programming laptops 2024',
            intent: 'Finding information about programming laptops'
          },
          output: {
            success: true,
            searchProvider: 'google',
            message: 'Searched for "best programming laptops 2024" on Google',
            query: 'best programming laptops 2024',
            url: 'https://www.google.com/search?q=best+programming+laptops+2024'
          }
        },
        {
          description: 'Search on Amazon',
          input: { 
            searchProvider: 'amazon',
            query: 'mechanical keyboard',
            intent: 'Looking for mechanical keyboards on Amazon'
          },
          output: {
            success: true,
            searchProvider: 'amazon',
            message: 'Searched for "mechanical keyboard" on Amazon',
            query: 'mechanical keyboard',
            url: 'https://www.amazon.com/s?k=mechanical+keyboard'
          }
        },
        {
          description: 'Search on Google Maps',
          input: { 
            searchProvider: 'google_maps',
            query: 'coffee shops near Times Square NYC',
            intent: 'Finding coffee shops in Times Square area'
          },
          output: {
            success: true,
            searchProvider: 'google_maps',
            message: 'Searched for "coffee shops near Times Square NYC" on Google Maps',
            query: 'coffee shops near Times Square NYC',
            url: 'https://www.google.com/maps/search/coffee+shops+near+Times+Square+NYC'
          }
        },
        {
          description: 'Search on Google Finance',
          input: { 
            searchProvider: 'google_finance',
            query: 'AAPL',
            intent: 'Looking up Apple stock information'
          },
          output: {
            success: true,
            searchProvider: 'google_finance',
            message: 'Searched for "AAPL" on Google Finance',
            query: 'AAPL',
            url: 'https://www.google.com/finance/quote/AAPL:NASDAQ'
          }
        }
      ],
      streamingConfig: {
        displayName: 'Search',
        icon: '🔍',
        progressMessage: 'Performing search...'
      }
    };

    super(config, executionContext);
  }

  /**
   * Override: Generate contextual display message based on search provider
   */
  getProgressMessage(args: SearchInput): string {
    try {
      // Note: args should already be parsed by StreamEventProcessor

      const searchProvider = args?.searchProvider;
      const query = args?.query;
      const intent = args?.intent;

      // Use intent if provided, otherwise generate based on provider
      if (intent) {
        return intent;
      }

      const providerNames = {
        'google': 'Google',
        'amazon': 'Amazon',
        'google_maps': 'Google Maps',
        'google_finance': 'Google Finance'
      };

      const providerName = providerNames[searchProvider as keyof typeof providerNames] || 'Search';
      return query ? `Searching ${providerName} for "${query}"` : `Searching on ${providerName}`;
    } catch {
      return 'Performing search...';
    }
  }

  /**
   * Override: Format result based on search provider
   */
  FormatResultForUI(output: SearchOutput): string {
    if (!output.success) {
      return `❌ ${output.message}`;
    }

    const providerIcons = {
      'google': '🔍',
      'amazon': '🛒',
      'google_maps': '📍',
      'google_finance': '📈'
    };

    const icon = providerIcons[output.searchProvider] || '🔍';
    return `${icon} Searched: "${output.query}"`;
  }

  protected async execute(input: SearchInput): Promise<SearchOutput> {
    try {
      // Build the search URL based on the provider
      const searchUrl = this.buildSearchUrl(input.searchProvider, input.query);
      
      // Get the current page and navigate
      const page = await this.executionContext.browserContext.getCurrentPage();
      await page.navigateTo(searchUrl);
      
      // Wait a bit for the page to load
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      const providerNames = {
        'google': 'Google',
        'amazon': 'Amazon',
        'google_maps': 'Google Maps',
        'google_finance': 'Google Finance'
      };

      const providerName = providerNames[input.searchProvider] || input.searchProvider;
      
      // Get the final URL after any redirects
      const finalUrl = page.url();
      
      return {
        success: true,
        searchProvider: input.searchProvider,
        message: `Searched for "${input.query}" on ${providerName}`,
        query: input.query,
        url: finalUrl
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        success: false,
        searchProvider: input.searchProvider,
        message: `Search failed: ${errorMessage}`,
        query: input.query,
        url: ''
      };
    }
  }

  /**
   * Build the search URL for the given provider and query
   */
  private buildSearchUrl(provider: SearchProvider, query: string): string {
    const encodedQuery = encodeURIComponent(query);
    
    switch (provider) {
      case 'google':
        return `https://www.google.com/search?q=${encodedQuery}`;
      
      case 'amazon':
        return `https://www.amazon.com/s?k=${encodedQuery}`;
      
      case 'google_maps':
        return `https://www.google.com/maps/search/${encodedQuery}`;
      
      case 'google_finance':
        // Google Finance has a special format for stock symbols
        // Try to detect if it's a stock symbol (all caps, 1-5 letters)
        if (/^[A-Z]{1,5}$/.test(query.trim())) {
          // Assume NASDAQ for US stocks, but this could be improved
          return `https://www.google.com/finance/quote/${query.trim()}:NASDAQ`;
        }
        // For non-symbol queries, use the search
        return `https://www.google.com/search?q=${encodedQuery}+stock+finance`;
      
      default:
        // Fallback to Google search
        return `https://www.google.com/search?q=${encodedQuery}`;
    }
  }
} 
