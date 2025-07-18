import { z } from 'zod';
import { ExecutionContext } from '@/lib/runtime/ExecutionContext';
import { Logging } from '@/lib/utils/Logging';
import { IntentPredictionAgent } from '@/lib/agent/IntentPredictionAgent';
// import { getAccessibleSnapshot } from '@/lib/browser/DOMService';
import { StreamEventBus } from '@/lib/events';

/**
 * Schema for intent prediction request
 */
export const IntentPredictionRequestSchema = z.object({
  tabId: z.number(),  // Tab ID to predict intents for
  tabHistory: z.array(z.object({
    url: z.string(),
    title: z.string(),
    timestamp: z.number()
  })),  // Recent navigation history
});

export type IntentPredictionRequest = z.infer<typeof IntentPredictionRequestSchema>;

/**
 * Schema for intent prediction result
 */
export const IntentPredictionResultSchema = z.object({
  tabId: z.number(),
  url: z.string(),
  intents: z.array(z.string()),
  confidence: z.number().optional(),
  timestamp: z.number(),
  error: z.string().optional()
});

export type IntentPredictionResult = z.infer<typeof IntentPredictionResultSchema>;

/**
 * Orchestrator specifically for intent prediction
 * Simpler than the main Orchestrator as it only runs a single agent
 */
export class IntentPredictionOrchestrator {
  private executionContext: ExecutionContext;
  private agent: IntentPredictionAgent;
  private initialized: boolean = false;

  constructor(executionContext: ExecutionContext) {
    this.executionContext = executionContext;
    this.agent = new IntentPredictionAgent({
      executionContext,
      debugMode: executionContext.debugMode,
      useVision: false,
      maxIterations: 1
    });
  }

  /**
   * Initialize the orchestrator and agent
   */
  private async ensureInitialized(): Promise<void> {
    if (!this.initialized) {
      await this.agent.initialize();
      this.initialized = true;
      Logging.log('IntentPredictionOrchestrator', '✅ Initialized');
    }
  }

  /**
   * Predict intents for a given tab
   */
  public async predictIntents(
    request: IntentPredictionRequest,
    eventBus?: StreamEventBus
  ): Promise<IntentPredictionResult> {
    const startTime = Date.now();
    
    try {
      await this.ensureInitialized();
      
      const { tabId, tabHistory } = request;
      
      Logging.log('IntentPredictionOrchestrator', 
        `🔮 Predicting intents for tab ${tabId} with ${tabHistory.length} history entries`
      );
      
      // Set eventBus in ExecutionContext if provided
      if (eventBus) {
        this.executionContext.setEventBus(eventBus);
      }
      
      // Get accessibility snapshot
      let accessibilitySnapshot;
      try {
        // TODO: Fix accessibility snapshot
        // accessibilitySnapshot = await getAccessibleSnapshot(tabId);
      } catch (error) {
        Logging.log('IntentPredictionOrchestrator', 
          `Failed to get accessibility snapshot: ${error}`, 'warning'
        );
        
        // Return empty result if we can't get snapshot
        return {
          tabId,
          url: tabHistory[0]?.url || '',
          intents: [],
          timestamp: Date.now(),
          error: 'Failed to analyze page content'
        };
      }
      
      // Run the agent (eventBus is set in ExecutionContext)
      const result = await this.agent.invoke({
        instruction: 'Predict user intents based on browsing context',
        context: {
          tabHistory,
          accessibilitySnapshot
        }
      });
      
      const duration = Date.now() - startTime;
      
      // Cast result to IntentPredictionOutput
      const predictionResult = result.result as { intents: string[], confidence?: number };
      
      Logging.log('IntentPredictionOrchestrator', 
        `✅ Completed in ${duration}ms - ${predictionResult.intents.length} intents predicted`
      );
      
      return {
        tabId,
        url: 'TODO: Fix accessibility snapshot', //accessibilitySnapshot.url,
        intents: predictionResult.intents,
        confidence: predictionResult.confidence,
        timestamp: Date.now(),
        error: result.error
      };
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      Logging.log('IntentPredictionOrchestrator', 
        `❌ Failed to predict intents: ${errorMessage}`, 'error'
      );
      
      return {
        tabId: request.tabId,
        url: request.tabHistory[0]?.url || '',
        intents: [],
        timestamp: Date.now(),
        error: errorMessage
      };
    }
  }

  /**
   * Check if a URL should have intent prediction
   */
  public static shouldPredictForUrl(url: string): boolean {
    if (!url) return false;
    
    // Skip non-HTTP URLs
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      return false;
    }
    
    // Skip Chrome internal pages
    if (url.includes('chrome.google.com') || 
        url.includes('chromewebstore.google.com')) {
      return false;
    }
    
    // Skip PDFs and other non-web content
    if (url.endsWith('.pdf') || 
        url.endsWith('.doc') || 
        url.endsWith('.docx')) {
      return false;
    }
    
    return true;
  }
}