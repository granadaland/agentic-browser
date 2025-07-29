import { BasePrompt } from './BasePrompt';
import { z } from 'zod';

// Schema for navigation history entry
const NavigationEntrySchema = z.object({
  url: z.string(),
  title: z.string(),
  timestamp: z.number()
});

// Schema for accessibility snapshot
const AccessibilitySnapshotSchema = z.object({
  url: z.string(),
  cleanUrl: z.string(),  // URL without query parameters
  title: z.string(),
  metaDescription: z.string().optional(),  // Meta description tag
  ogTitle: z.string().optional(),  // Open Graph title
  ogDescription: z.string().optional(),  // Open Graph description
  headings: z.array(z.string()),
  buttons: z.array(z.string()),
  links: z.array(z.string()),
  ariaLabels: z.array(z.string()),
  landmarks: z.array(z.object({
    role: z.string(),
    label: z.string().optional()
  })),
  forms: z.array(z.object({
    action: z.string().optional(),
    fields: z.array(z.string())
  })),
  mainText: z.string().optional()
});

type NavigationEntry = z.infer<typeof NavigationEntrySchema>;
type AccessibilitySnapshot = z.infer<typeof AccessibilitySnapshotSchema>;

/**
 * Prompt generator for the Intent Prediction Agent.
 * Builds comprehensive prompts for predicting user intents based on browsing context.
 */
export class IntentPredictionPrompt extends BasePrompt {
  protected readonly agentName = 'Intent Prediction Agent';

  constructor() {
    super(); // No tool documentation needed for intent prediction
  }

  /**
   * Generate the complete system prompt
   * @returns Complete system prompt
   */
  public generate(): string {
    const sections = [
      this.addRole(),
      this.addTask(),
      this.addGuidelines(),
      this.addIntentCharacteristics(),
      this.addExampleIntents(),
      this.addContextAnalysis(),
      this.addOutputFormat()
    ];

    return this.joinSections(...sections);
  }

  /**
   * Add role definition
   */
  private addRole(): string {
    return `You are an intent prediction expert. Your job is to analyze browsing context and predict user intents.`;
  }

  /**
   * Add task description
   */
  private addTask(): string {
    return this.formatSection('YOUR TASK',
      `Analyze the user's current browsing context (navigation history and page accessibility data) to predict their most likely next actions.`
    );
  }

  /**
   * Add guidelines
   */
  private addGuidelines(): string {
    return this.formatSection('GUIDELINES',
      this.numberedList([
        'Consider the navigation pattern - what journey is the user on?',
        'Analyze page elements to understand what actions are available',
        'Predict 3 specific, actionable intents the user might want to perform',
        'Focus on high-value actions relevant to the current page',
        'Consider site-specific patterns and common user behaviors'
      ])
    );
  }

  /**
   * Add intent characteristics
   */
  private addIntentCharacteristics(): string {
    return this.formatSection('INTENT CHARACTERISTICS',
      `Good intents are:
${this.bulletList([
  'Action-oriented (start with a verb)',
  'The action should be slightly deeper than just saying click a button',
  'Specific to the current page context',
  'Achievable through browser automation',
  'Valuable to the user',
  'Clear and concise (3-8 words)'
])}`
    );
  }

  /**
   * Add example intents for top sites
   */
  private addExampleIntents(): string {
    return this.formatSection('EXAMPLE INTENTS BY SITE',
      `### Google Search Results
${this.bulletList([
  '"Open first 5 search results"',
  '"Filter results by date"'
])}

### Amazon Product Page
${this.bulletList([
  '"Summarize customer reviews"',
  '"Search for other <product options>"',
  '"Add to cart and proceed to checkout"',
  '"Extract product specifications"'
])}

### YouTube Video Page
${this.bulletList([
  '"Extract video transcript"',
  '"Summarize top comments"',
  '"Click on next recommended video"',
  '"Go to videos channel page"'
])}

### GitHub Repository
${this.bulletList([
  '"Star the repo"',
  '"Summarize README content"',
  '"Look at recent activitiy"',
  '"Find open issues"',
])}

### LinkedIn Profile
${this.bulletList([
  '"Extract work experience"',
  '"Summarize skills and endorsements"',
  '"Find mutual connections"',
])}

### Twitter/X Thread
${this.bulletList([
  '"Extract entire thread"',
  '"Summarize replies and reactions"',
  '"Find quoted tweets"',
])}

### Airbnb Listing
${this.bulletList([
  '"Summarize guest reviews"',
  '"Extract amenities list"',
  '"Calculate total cost"'
])}

### Google Maps Restaurant
${this.bulletList([
  '"Summarize customer reviews"',
  '"Extract menu information"',
  '"Check opening hours"',
  '"Find if users have mentioned parking in the reviews"',
  '"Get contact details"'
])}

### News Article
${this.bulletList([
  '"Summarize article content"',
  '"Find related articles"',
  '"Check publication date and author"'
])}

### Stack Overflow Question
${this.bulletList([
  '"Extract accepted answer"',
  '"Summarize all solutions"',
])}`
    );
  }

  /**
   * Add context analysis guidance
   */
  private addContextAnalysis(): string {
    return this.formatSection('CONTEXT ANALYSIS',
      `When analyzing the browsing context:
${this.bulletList([
  'Look for patterns in navigation history',
  'Identify the user\'s likely goal based on their journey',
  'Consider the current page type and available actions',
  'Think about common workflows on this type of site',
  'Prioritize intents that save time or extract value'
])}`
    );
  }

  /**
   * Add output format specification
   */
  private addOutputFormat(): string {
    return this.formatSection('OUTPUT FORMAT',
      `Return ONLY a JSON object with this structure:
${this.codeBlock(`{
  "intents": ["Intent 1", "Intent 2", "Intent 3"],
  "confidence": 0.85
}`, 'json')}

The confidence score should reflect how well the predicted intents match the user's likely needs (0.0-1.0).`
    );
  }

  /**
   * Build the prediction prompt with context
   */
  public buildPredictionPrompt(
    tabHistory: NavigationEntry[], 
    snapshot: AccessibilitySnapshot
  ): string {
    // Format navigation history
    const historyItems = tabHistory.slice(0, 5).map((entry, i) => 
      `${entry.title || 'Untitled'} - ${entry.url}`
    );
    
    // Prepare page description
    const pageDescription = snapshot.metaDescription || snapshot.ogDescription || 
                          (snapshot.mainText ? snapshot.mainText.substring(0, 150) + '...' : 'No description available');
    
    // Build sections
    const currentPageSection = this.formatSection('CURRENT PAGE',
      `URL: ${snapshot.cleanUrl}
Title: ${snapshot.ogTitle || snapshot.title}
Description: ${pageDescription}`
    );

    const availableActionsSection = this.formatSection('AVAILABLE ACTIONS',
      this.bulletList([
        `Buttons: ${snapshot.buttons.slice(0, 10).join(', ') || 'none'}`,
        `Forms: ${snapshot.forms.length} form(s) detected`,
        `Links: ${snapshot.links.length} links available`
      ])
    );

    const navigationSection = this.formatSection('RECENT NAVIGATION (newest first)',
      historyItems.length > 0 ? this.numberedList(historyItems) : 'No recent history'
    );

    const contentPreviewSection = this.formatSection('MAIN CONTENT PREVIEW',
      snapshot.mainText ? snapshot.mainText.substring(0, 200) + '...' : 'No main content detected'
    );

    const instruction = 'Analyze this browsing context and predict user intents:';
    const footer = 'Based on this context, predict the 3 most likely high-level intents.';

    return this.joinSections(
      instruction,
      currentPageSection,
      availableActionsSection,
      navigationSection,
      contentPreviewSection,
      footer
    );
  }
}