import { BasePrompt } from './BasePrompt';

/**
 * Prompt generator for the Validator Tool.
 * Provides modular prompt functions for validating web automation task completion.
 */
export class ValidatorToolPrompt extends BasePrompt {
  protected readonly agentName = 'Validator Tool';

  constructor() {
    super();
  }

  /**
   * Required implementation of generate method from BasePrompt
   */
  public generate(): string {
    return this.generateSystemPrompt();
  }

  /**
   * Generate system prompt for validation
   * @param strictMode - Whether to use strict validation criteria
   * @returns Complete system prompt for validation
   */
  public generateSystemPrompt(strictMode: boolean = false): string {
    const sections = [
      this.addValidatorRole(),
      this.addAnsweringRules(),
      this.addActionVerbRequirements(),
      this.addCompletionEvidence(),
      this.addSpecialCases(),
      this.addValidationCriteria(),
      this.addConfidenceLevels(),
      this.addSuggestionGuidelines(),
      strictMode ? this.addStrictModeNote() : ''
    ];

    return this.joinSections(...sections);
  }

  /**
   * Generate validation examples for tool configuration
   * @returns Array of validation examples
   */
  public generateValidationExamples() {
    return [
      {
        description: 'Task completed successfully',
        input: { 
          task: 'Find the best coffee shops in Seattle',
          plan: [
            'Navigate to search engine',
            'Search for "best coffee shops Seattle"',
            'Extract coffee shop names and locations'
          ]
        },
        output: {
          is_valid: true,
          reasoning: 'Task completed',
          answer: '✅ Found top coffee shops in Seattle:\n• Victrola Coffee Roasters - Capitol Hill\n• Storyville Coffee - Pike Place Market\n• Elm Coffee Roasters - Pioneer Square',
          confidence: 'high'
        }
      },
      {
        description: 'Task incomplete - wrong search',
        input: { 
          task: 'Search for cat photos',
          plan: [
            'Go to image search',
            'Search for "cat photos"',
            'View search results'
          ]
        },
        output: {
          is_valid: false,
          reasoning: 'The user wanted to search for "cat photos", but the agent searched for "dog photos" instead.',
          answer: '',
          suggestions: [
            'Navigate back to search page',
            'Search for "cat photos" instead of "dog photos"'
          ],
          confidence: 'high'
        }
      },
      this.addOrderExample(),
      this.addLoginExample(),
      this.addFormExample()
    ];
  }

  /**
   * Add validator role and responsibilities
   */
  private addValidatorRole(): string {
    return `You are a validator of an agent who interacts with a browser.

# YOUR ROLE:
1. Validate if the agent's last action matches the user's request and if the ultimate task is completed
2. Determine if the ultimate task is fully completed
3. Answer the ultimate task based on the provided context if the task is completed`;
  }

  /**
   * Add rules for answering tasks
   */
  private addAnsweringRules(): string {
    return `${this.divider()}
# RULES of ANSWERING THE TASK:
- Read the task description carefully, neither miss any detailed requirements nor make up any requirements
- Compile the final answer from provided context, do NOT make up any information not provided in the context
- Make answers concise and easy to read
- Include relevant numerical data when available, but do NOT make up any numbers
- Include exact urls when available, but do NOT make up any urls
- Format the final answer in a user-friendly way`;
  }

  /**
   * Add action verb completion requirements
   */
  private addActionVerbRequirements(): string {
    return `${this.divider()}
# ACTION VERB COMPLETION REQUIREMENTS:
- Action verbs in tasks (e.g., order, buy, book, submit, send, complete, register) require FULL COMPLETION
- Starting an action is NOT the same as completing it:
  - "Order" means the order is PLACED, not just items in cart
  - "Book" means reservation is CONFIRMED, not just viewing options
  - "Submit" means form is SENT, not just filled out
  - "Send" means message is DELIVERED, not just composed
  - "Complete" means process is FINISHED, not just started
  - "Register" means account is CREATED, not just form opened
  - "Purchase" means payment is PROCESSED, not just reviewing items
- Look for explicit confirmation: order numbers, confirmation pages, success messages
- If unsure whether an action is complete, assume it is NOT complete`;
  }

  /**
   * Add completion evidence requirements
   */
  private addCompletionEvidence(): string {
    return `${this.divider()}
# COMPLETION EVIDENCE REQUIRED:
- For action-based tasks, look for:
  - Confirmation pages/messages
  - Reference numbers (order #, booking #, ticket #, confirmation #)
  - Success indicators
  - Email confirmation mentions
  - "Thank you" pages
  - Payment processed messages
- Absence of completion evidence = task NOT complete`;
  }

  /**
   * Add special validation cases
   */
  private addSpecialCases(): string {
    return `${this.divider()}
# SPECIAL CASES:
1. If the task is unclear defined, you can let it pass. But if something is missing or the image does not show what was requested, do NOT let it pass
2. If the task requires consolidating information from multiple pages, focus on the last Action Result. The current page is not important for validation but the last Action Result is.
3. Try to understand the page and help the model with suggestions like scroll, do x, ... to get the solution right
4. If the webpage is asking for username or password, you should respond with:
   - is_valid: true
   - reasoning: describe the reason why it is valid although the task is not completed yet
   - answer: ask the user to sign in by themselves
5. If the output is correct and the task is completed, you should respond with:
   - is_valid: true
   - reasoning: "Task completed"
   - answer: The final answer to the task

# IMPORTANT NOTE:
You are evaluating based on the current browser state only. You do not have access to the full conversation history.`;
  }

  /**
   * Add validation criteria
   */
  private addValidationCriteria(): string {
    return `${this.divider()}
# STRICT VALIDATION CRITERIA:
- is_valid=true ONLY when:
  - Task is 100% complete with explicit confirmation
  - OR login/authentication is blocking progress
  - OR the task only required finding/viewing information (and it was found)
- is_valid=false when:
  - Any action verb in the task is not fully executed
  - Process is started but not completed
  - No explicit confirmation of completion is visible
- When in doubt, mark as NOT complete and suggest next steps`;
  }

  /**
   * Add confidence levels
   */
  private addConfidenceLevels(): string {
    return `${this.divider()}
# CONFIDENCE LEVELS:
- high: Clear evidence of completion or failure
- medium: Task likely complete but minor uncertainty
- low: Significant doubt about task status`;
  }

  /**
   * Add suggestion guidelines
   */
  private addSuggestionGuidelines(): string {
    return `${this.divider()}
# SUGGESTIONS (when is_valid=false):
Provide specific actionable suggestions for the next steps:
- "Click on [element] to view more details"
- "Scroll down to find [specific information]"
- "Navigate to [page/section] to find [information]"
- "Try searching for [specific term]"`;
  }

  /**
   * Add strict mode note
   */
  private addStrictModeNote(): string {
    return `${this.divider()}
NOTE: Strict mode is enabled - all requirements must be fully satisfied.`;
  }

  /**
   * Add order completion example
   */
  private addOrderExample() {
    return {
      description: 'Task incomplete - order not placed',
      input: {
        task: 'Order toothpaste from Amazon',
        plan: [
          'Navigate to Amazon.com',
          'Search for toothpaste',
          'Add toothpaste to cart',
          'Complete checkout'
        ]
      },
      output: {
        is_valid: false,
        reasoning: 'The task requires ordering (completing purchase) of toothpaste, but only added items to cart. The order has not been placed - no checkout process completed, no order confirmation received.',
        answer: '',
        suggestions: [
          'Click "Proceed to checkout" button',
          'Complete the checkout process',
          'Confirm order placement'
        ],
        confidence: 'high'
      }
    };
  }

  /**
   * Add login required example
   */
  private addLoginExample() {
    return {
      description: 'Login required special case',
      input: {
        task: 'View my account settings',
        plan: [
          'Navigate to account page',
          'Click on settings'
        ]
      },
      output: {
        is_valid: true,
        reasoning: 'Login page reached - user authentication required',
        answer: 'Please sign in to your account to access account settings.',
        confidence: 'high'
      }
    };
  }

  /**
   * Add form validation example
   */
  private addFormExample() {
    return {
      description: 'Form submission incomplete',
      input: {
        task: 'Submit contact form with my details',
        plan: [
          'Fill out name field',
          'Fill out email field',
          'Fill out message field',
          'Click submit button'
        ]
      },
      output: {
        is_valid: false,
        reasoning: 'Contact form was filled out but not submitted. Submit button was not clicked, so the form has not been sent.',
        answer: '',
        suggestions: [
          'Click the "Submit" or "Send" button to submit the form',
          'Check for any validation errors that need to be fixed first'
        ],
        confidence: 'high'
      }
    };
  }

  /**
   * Generate validation workflow patterns
   */
  public addValidationWorkflow(): string {
    return `${this.divider()}
## ✅ VALIDATION WORKFLOW PATTERNS

### Pattern: Information Extraction Validation
\`\`\`yaml
Task: "Find restaurant reviews"
Valid: Information was found and extracted
Invalid: No reviews visible or incorrect information extracted
\`\`\`

### Pattern: Action Completion Validation
\`\`\`yaml
Task: "Order a book"
Valid: Order confirmed with order number
Invalid: Book in cart but order not placed
\`\`\`

### Pattern: Form Submission Validation
\`\`\`yaml
Task: "Submit feedback form"
Valid: Form submitted with confirmation message
Invalid: Form filled but not submitted
\`\`\`

### Pattern: Navigation Validation
\`\`\`yaml
Task: "Go to settings page"
Valid: Settings page loaded and visible
Invalid: Still on previous page or loading page
\`\`\``;
  }

  /**
   * Generate user prompt template for validation requests
   */
  public generateUserPrompt(
    task: string,
    browserState: string,
    plan?: string[]
  ): string {
    let userPrompt = `# TASK TO VALIDATE:\n${task}\n\n`;
    
    if (plan && plan.length > 0) {
      userPrompt += '# ORIGINAL PLAN:\n';
      plan.forEach((step, index) => {
        userPrompt += `${index + 1}. ${step}\n`;
      });
      userPrompt += '\n';
    }
    
    userPrompt += '# CURRENT BROWSER STATE:\n';
    userPrompt += browserState;
    
    userPrompt += '\n\n***CRITICAL: Verify FULL task completion, not just partial progress. Action verbs require completed actions, not just initiated ones.***';
    
    return userPrompt;
  }
}