import { BasePrompt } from './BasePrompt';

/**
 * Prompt generator for the Planner Tool.
 * Provides modular prompt functions for planning web automation tasks.
 */
export class PlannerToolPrompt extends BasePrompt {
  protected readonly agentName = 'Planner Tool';

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
   * Generate system prompt for planning with specified steps
   * @param steps - Number of steps to plan (1-5)
   * @param isFollowUp - Whether this is a follow-up task
   * @returns Complete system prompt for planning
   */
  public generateSystemPrompt(steps: number = 5, isFollowUp: boolean = false): string {
    const sections = isFollowUp ? [
      // For follow-up tasks, emphasize continuity FIRST
      this.addFollowUpTaskGuidance(),
      this.addPlannerRole(),
      this.addCriticalContinueFromCurrentState(),
      this.addPlanningGuidelines(steps),
      this.addStepFormat(),
      this.addConfidenceLevels(),
      this.addPlanningReminders(steps)
    ] : [
      // Regular task flow
      this.addPlannerRole(),
      this.addCriticalContinueFromCurrentState(),
      this.addPlanningGuidelines(steps),
      this.addStepFormat(),
      this.addConfidenceLevels(),
      this.addPlanningReminders(steps)
    ];

    return this.joinSections(...sections);
  }

  /**
   * Generate planning examples for tool configuration
   * @returns Array of planning examples
   */
  public generatePlanningExamples() {
    return [
      {
        description: 'Plan next 5 steps for a web search task',
        input: { 
          task: 'Find the best restaurants in San Francisco',
          steps: 5
        },
        output: {
          observation: 'Currently on Google search page. Need to search for restaurants and analyze results.',
          done: false,
          next_steps: [
            '- [ ] Search for best restaurants in San Francisco',
            '- [ ] Review search results for highly-rated options',
            '- [ ] Visit a reputable restaurant review site',
            '- [ ] Compare top restaurant recommendations',
            '- [ ] Gather key information (cuisine, price, location)'
          ],
          reasoning: 'Starting with a web search to find restaurant information.',
          web_task: true,
          challenges: 'Need to identify reliable sources and current information.'
        }
      },
      {
        description: 'Simple 1-step task for immediate action',
        input: { 
          task: 'Click the login button',
          steps: 1
        },
        output: {
          observation: 'Login button is visible on the current page.',
          challenges: 'None - straightforward single action.',
          done: false,
          next_steps: [
            '- [ ] Sign in to the website'
          ],
          reasoning: 'Direct action required - login interface is available.',
          web_task: true,
        }
      },
      {
        description: 'Medium complexity 3-step task',
        input: { 
          task: 'Submit contact form with my details',
          steps: 3
        },
        output: {
          observation: 'Contact form is visible with required fields.',
          challenges: 'Need to ensure all required information is provided.',
          done: false,
          next_steps: [
            '- [ ] Fill out contact form with provided details',
            '- [ ] Review form for completeness',
            '- [ ] Submit the contact form'
          ],
          reasoning: 'Form submission requires accurate information entry.',
          web_task: true,
        }
      },
      {
        description: 'Plan after multiple actions',
        input: { 
          task: 'Continue browsing GitHub repository',
          steps: 5
        },
        output: {
          observation: 'Currently in a GitHub repository. Need to explore documentation.',
          challenges: 'Need to navigate repository structure effectively.',
          done: false,
          next_steps: [
            '- [ ] Review repository README documentation',
            '- [ ] Explore key project folders',
            '- [ ] Check for setup instructions',
            '- [ ] Look for example code or demos',
            '- [ ] Find contribution guidelines'
          ],
          reasoning: 'Systematic exploration of repository contents.',
          web_task: true,
        }
      },
      this.addShoppingExample(),
      this.addNavigationExample(),
      this.addFormExample(),
      this.addCurrentPageCheckExample()
    ];
  }

  /**
   * Add critical guidance for follow-up tasks - MUST BE FIRST
   */
  private addFollowUpTaskGuidance(): string {
    return `# 🔄 CRITICAL: THIS IS A FOLLOW-UP TASK!

⚠️ **IMPORTANT**: The user is continuing or modifying a previous task. This is NOT a new task!

## FOLLOW-UP TASK REQUIREMENTS:
1. **UNDERSTAND THE CONTEXT**: Review the conversation history to understand:
   - What was the original task?
   - What has already been accomplished?
   - What is the current browser state?
   - What is the user's NEW instruction?

2. **BUILD ON PREVIOUS WORK**: 
   - DO NOT start from the beginning
   - DO NOT repeat actions that were already completed
   - ACKNOWLEDGE what has been done
   - CONTINUE from the current state

3. **INTERPRET THE NEW INSTRUCTION**:
   - The user's new instruction might:
     - Continue the previous task (e.g., "continue", "keep going")
     - Modify the approach (e.g., "try a different product", "use another method")
     - Add new requirements (e.g., "also check the reviews", "compare with another option")
     - Ask for a different outcome (e.g., "actually, let's go with the blue one instead")

4. **PLAN ACCORDINGLY**:
   - Your plan should start from WHERE WE ARE NOW
   - Consider how the new instruction changes or extends the original goal
   - If the user says "continue", pick up exactly where the previous task left off
   - If the user modifies the goal, adjust the plan while preserving completed progress

## CRITICAL: ALWAYS CHECK CURRENT PAGE FIRST!
⚠️ **GOLDEN RULE**: Before planning any new action, ALWAYS check if what the user wants can be done on the current page!

### THE FOLLOW-UP LOGIC:
1. **FIRST**: Can I do what the user wants on the current page?
   - Is the requested item/option/button/link visible?
   - Can the action be performed here?
2. **IF YES**: Plan to interact with current page elements
3. **IF NO**: Then plan next steps (search, navigate, etc.)

## EXAMPLE FOLLOW-UP SCENARIOS:

### 1. SELECTION/CHOICE TASKS:
- Current state: Page with multiple options (products, articles, links, etc.)
- Follow-up: "Get the blue one" / "Select the third option" / "Choose the premium plan"
- ✅ CORRECT: First check if the requested option exists on current page
- ❌ WRONG: Immediately navigate away or search

### 2. INFORMATION TASKS:
- Current state: Documentation page, article, or form
- Follow-up: "Find the pricing info" / "What about refunds?" / "Show me the requirements"
- ✅ CORRECT: First scan current page for the requested information
- ❌ WRONG: Navigate to search without checking current content

### 3. ACTION TASKS:
- Current state: Any interactive page
- Follow-up: "Download it" / "Sign up" / "Add to favorites" / "Share this"
- ✅ CORRECT: Look for the action button/link on current page first
- ❌ WRONG: Navigate to a different page to perform the action

### 4. MODIFICATION TASKS:
- Current state: Form, settings, or configuration page
- Follow-up: "Change the language" / "Update the quantity" / "Set it to monthly"
- ✅ CORRECT: Check if the setting/option is available on current page
- ❌ WRONG: Go to a different settings page without checking

### 5. WHEN TO NAVIGATE/SEARCH:
- Follow-up requests something completely different from current context
- The requested item/action is confirmed NOT on current page
- User explicitly asks to go elsewhere ("Go back", "Search for X instead")

Remember: The user can SEE the current page. They're often referring to something they can already see!`;
  }

  /**
   * Add planner role and responsibilities
   */
  private addPlannerRole(): string {
    return `You are a helpful assistant that excels at analyzing web browsing tasks and breaking them down into actionable steps.

# RESPONSIBILITIES:
1. Analyze the current state and conversation history to understand what has been accomplished
2. Evaluate progress towards the ultimate goal
3. Identify potential challenges or roadblocks
4. Generate specific, actionable next steps (maximum 5 steps)
5. Provide clear reasoning for your suggested approach`;
  }

  /**
   * Add critical guidance about continuing from current state
   */
  private addCriticalContinueFromCurrentState(): string {
    return `${this.divider()}
# 🚨 CRITICAL - CONTINUE FROM CURRENT STATE:
⚠️ The browser is ALREADY at a specific page/state from previous actions!
- ANALYZE the current browser state FIRST to understand where you are NOW
- DO NOT restart the task from the beginning
- DO NOT repeat actions that have already been completed
- BUILD ON the progress already made

## State Recognition:
Understanding where you are helps determine next steps:
- On a list/results page → Check if requested item is in the list
- On a detail/content page → Check if requested info/action is available
- On a form page → Check if requested field/option exists
- On a dashboard → Check if requested section/data is visible
- On documentation → Check if requested topic is on current page

## THE UNIVERSAL FOLLOW-UP APPROACH:
🔍 **For ANY follow-up instruction**:
1. **ANALYZE**: What does the user want?
2. **SCAN**: Is it available on the current page?
3. **DECIDE**: 
   - If YES → Interact with current page
   - If NO → Plan appropriate next steps

### Quick Decision Examples:
- "Click the blue button" → Is there a blue button visible? 
- "Get the premium version" → Is premium option on this page?
- "Show me the stats" → Are stats displayed here?
- "Find the contact info" → Is contact info on current page?
- "Download the PDF" → Is there a download link visible?

## Example Task Progression:
Task: "Order toothpaste on Amazon"
- If at homepage → Plan: Search for toothpaste
- If at search results → Plan: Select a toothpaste product, add to cart
- If at product page → Plan: Add to cart, go to cart
- If at cart → Plan: Proceed to checkout, complete order
- NEVER go backwards in this flow!`;
  }


  /**
   * Add planning guidelines with step count
   */
  private addPlanningGuidelines(steps: number): string {
    return `${this.divider()}
# PLANNING GUIDELINES:
- Keep plans SHORT and FOCUSED: Maximum ${steps} steps at a time
- Focus on WHAT to achieve, not HOW to do it
- Each step should be a logical business action or goal
- Order steps logically with dependencies in mind
- Think in terms of user objectives, not technical implementations
- If you know specific sites/URLs, mention them (e.g., "Navigate to Amazon")
- Let the browser agent handle the technical details of each step`;
  }

  /**
   * Add step format guidelines
   */
  private addStepFormat(): string {
    return `${this.divider()}
# STEP FORMAT:
Each step should be formatted as a checkbox markdown item describing WHAT to achieve, not HOW:
- "- [ ] Navigate to Amazon" (not "Click on address bar and type amazon.com")
- "- [ ] Search for toothpaste" (not "Click search box, type toothpaste, press enter")
- "- [ ] Select a suitable product" (not "Click on the first result with 4+ stars")
- "- [ ] Add product to cart" (not "Find and click the Add to Cart button")
- "- [ ] Proceed to checkout" (not "Click on cart icon then checkout button")

IMPORTANT: Always format steps with "- [ ]" prefix for uncompleted checkbox items.`;
  }

  /**
   * Add confidence level guidelines
   */
  private addConfidenceLevels(): string {
    return `${this.divider()}
# CONFIDENCE LEVELS:
- **high**: Clear path forward, previous actions successful, browser state is fresh
- **medium**: Some uncertainty but reasonable approach available
- **low**: Major obstacles, unclear requirements, repeated failures, or stale browser state`;
  }

  /**
   * Add planning reminders
   */
  private addPlanningReminders(steps: number): string {
    return `${this.divider()}
# REMEMBER:
- Maximum ${steps} steps focusing on business objectives
- Keep steps high-level and goal-oriented
- Consider what has already been accomplished
- 🔍 ALWAYS check current page FIRST for any requested element/action
- Look for requested items/buttons/links/info on the visible page
- Only plan navigation if the requested element is NOT on current page
- The user can see the page - they often refer to visible elements
- Set done=true only if the task is genuinely complete
- Always identify potential challenges or considerations`;
  }

  /**
   * Add current page interaction example
   */
  private addShoppingExample() {
    return {
      description: 'Plan when user wants something visible on current page',
      input: {
        task: 'Get the blue one',
        steps: 3
      },
      output: {
        observation: 'Currently viewing a page with multiple color options for a product. Blue, red, and black variants are visible.',
        challenges: 'Need to select the blue variant from the current page.',
        done: false,
        next_steps: [
          '- [ ] Select the blue option from the current page',
          '- [ ] Proceed with the selection',
          '- [ ] Continue to next step in the process'
        ],
        reasoning: 'Blue option is visible on current page. No navigation needed.',
        web_task: true,
        confidence: 'high'
      }
    };
  }

  /**
   * Add navigation workflow example
   */
  private addNavigationExample() {
    return {
      description: 'Simple navigation to known URL',
      input: {
        task: 'Go to MDN documentation homepage',
        steps: 1
      },
      output: {
        observation: 'Need to navigate to the MDN documentation website.',
        done: false,
        next_steps: [
          '- [ ] Go to MDN documentation homepage'
        ],
        reasoning: 'Direct navigation to known URL is most efficient.',
        web_task: true,
        confidence: 'high'
      }
    };
  }

  /**
   * Add form workflow example
   */
  private addFormExample() {
    return {
      description: 'Plan form completion workflow',
      input: {
        task: 'Fill out contact form with provided details',
        steps: 5
      },
      output: {
        observation: 'Contact form is visible. Need to fill fields and submit.',
        challenges: 'Must ensure all required fields are completed correctly.',
        next_steps: [
          '- [ ] Fill in contact information',
          '- [ ] Enter email address', 
          '- [ ] Compose message with required details',
          '- [ ] Review form for completeness',
          '- [ ] Submit the contact form'
        ],
        reasoning: 'Sequential form filling to avoid focus issues.',
        web_task: true,
        confidence: 'high'
      }
    };
  }


  /**
   * Add example showing when navigation IS needed
   */
  private addCurrentPageCheckExample() {
    return {
      description: 'Plan when requested item is NOT on current page',
      input: {
        task: 'Show me the documentation',
        steps: 3
      },
      output: {
        observation: 'Currently on product page. No documentation links visible on this page.',
        challenges: 'Documentation is not available on current page. Need to navigate.',
        done: false,
        next_steps: [
          '- [ ] Look for documentation link in navigation menu or footer',
          '- [ ] Navigate to documentation section',
          '- [ ] Find relevant documentation'
        ],
        reasoning: 'Documentation not on current page. Navigation required.',
        web_task: true,
        confidence: 'medium'
      }
    };
  }

  /**
   * Generate user prompt template for planning requests
   */
  public generateUserPrompt(
    conversationHistory: string,
    browserState: string,
    task: string,
    steps: number,
    validationFeedback?: string,
    isFollowUp: boolean = false,
    previousPlan?: string[]
  ): string {
    let userPrompt = '';
    
    // For follow-up tasks, add special emphasis
    if (isFollowUp) {
      userPrompt += '🔄 FOLLOW-UP TASK CONTEXT:\n';
      userPrompt += '========================\n';
      userPrompt += 'The user is continuing or modifying a previous task.\n';
      
      if (previousPlan && previousPlan.length > 0) {
        userPrompt += '\n📋 PREVIOUS PLAN THAT WAS BEING EXECUTED:\n';
        previousPlan.forEach((step, index) => {
          userPrompt += `${index + 1}. ${step}\n`;
        });
        userPrompt += '\n⚠️ The user has now given a NEW instruction. You must understand how this relates to the previous task.\n';
      }
      
      userPrompt += `\n🆕 USER\'S NEW INSTRUCTION: "${task}"\n`;
      userPrompt += '\n🎯 YOUR TASK: Create a plan that continues/modifies the previous work based on this new instruction.\n';
      userPrompt += '\n🔍 CRITICAL: First check if what the user wants can be done on the CURRENT PAGE!\n';
      userPrompt += '   - If YES → Plan to interact with current page elements\n';
      userPrompt += '   - If NO → Plan appropriate next steps (navigate, search, etc.)\n';
      userPrompt += '========================\n\n';
    }
    
    userPrompt += 'CONVERSATION HISTORY:\n';
    userPrompt += conversationHistory;
    
    if (browserState) {
      userPrompt += `\n🌐 CURRENT ${browserState}`;
      userPrompt += '\n⚠️ YOU ARE HERE NOW - Plan the NEXT steps from THIS current state!';
    }
    
    if (validationFeedback) {
      userPrompt += `\n\n🔍 VALIDATION FEEDBACK (Why previous attempt was incomplete):\n${validationFeedback}`;
      userPrompt += '\n👉 Address these specific issues in your next steps!';
    }
    
    userPrompt += '\n\nPLANNING REQUEST:\n';
    userPrompt += `- Generate ${steps} next steps to ${isFollowUp ? 'CONTINUE/MODIFY the previous task' : 'accomplish the task'}\n`;
    userPrompt += `- ${isFollowUp ? 'New instruction' : 'Task'}: ${task}\n`;
    userPrompt += `- ALWAYS check current page FIRST before planning navigation\n`;
    userPrompt += `- DO NOT repeat completed actions, BUILD on current progress\n`;
    
    if (isFollowUp) {
      userPrompt += '- REMEMBER: Check if the requested action/item is on the CURRENT PAGE before planning new searches or navigation!\n';
    }
    
    return userPrompt;
  }
}