import { StateGraph, START, END } from '@langchain/langgraph/web';
import { 
  AgentGraphState,
  AgentGraphStateType,
  isClassificationResult,
  isPlannerResult, 
  isBrowseResult, 
  isProductivityResult,
  isValidatorResult 
} from './AgentGraphState';
import { ClassificationAgent } from '@/lib/agent/ClassificationAgent';
import { PlannerAgent } from '@/lib/agent/PlannerAgent';
import { BrowseAgent } from '@/lib/agent/BrowseAgent';
import { ProductivityAgent } from '@/lib/agent/ProductivityAgent';
import { ValidatorAgent } from '@/lib/agent/ValidatorAgent';
import { AnswerAgent, AnswerOutput } from '@/lib/agent/AnswerAgent';
import { ExecutionContext } from '@/lib/runtime/ExecutionContext';
import { Logging } from '@/lib/utils/Logging';

/**
 * Enhanced LangGraph-based orchestration with classification routing
 * Flow: classify → [productivity OR answer OR (plan → browse → validate)] → complete
 */
export class AgentGraph {
  private graph: StateGraph<typeof AgentGraphState>;
  private classificationAgent: ClassificationAgent;
  private plannerAgent: PlannerAgent;
  private browseAgent: BrowseAgent;
  private productivityAgent: ProductivityAgent;
  private validatorAgent: ValidatorAgent;
  private answerAgent: AnswerAgent;
  
  constructor(private executionContext: ExecutionContext) {
    // Initialize all agents with proper options
    const agentOptions = {
      executionContext,
      debugMode: executionContext.debugMode,
      useVision: false,
      maxIterations: 10
    };

    this.classificationAgent = new ClassificationAgent(agentOptions);
    this.plannerAgent = new PlannerAgent(agentOptions);
    this.browseAgent = new BrowseAgent(agentOptions);
    this.productivityAgent = new ProductivityAgent(agentOptions);
    this.validatorAgent = new ValidatorAgent({ ...agentOptions, strictMode: false });
    this.answerAgent = new AnswerAgent(agentOptions);
    
    // Create the state graph with new annotation system
    this.graph = new StateGraph({
      input: AgentGraphState,
      output: AgentGraphState
    });
    
    this.buildGraph();
  }
  
  /**
   * Initialize all agents - must be called before using the graph
   */
  async initialize(): Promise<void> {
    // Initialize all agents
    await Promise.all([
      this.classificationAgent.initialize(),
      this.plannerAgent.initialize(),
      this.browseAgent.initialize(),
      this.productivityAgent.initialize(),
      this.validatorAgent.initialize(),
      this.answerAgent.initialize()
    ]);
    
    Logging.log('AgentGraph', '✅ All agents initialized successfully');
  }
  
  /**
   * Cleanup all agents - should be called after graph execution or on error
   */
  async cleanup(): Promise<void> {
    const agents = [
      { agent: this.classificationAgent, name: 'ClassificationAgent' },
      { agent: this.plannerAgent, name: 'PlannerAgent' },
      { agent: this.browseAgent, name: 'BrowseAgent' },
      { agent: this.productivityAgent, name: 'ProductivityAgent' },
      { agent: this.validatorAgent, name: 'ValidatorAgent' },
      { agent: this.answerAgent, name: 'AnswerAgent' }
    ];
    
    // Cleanup all agents in parallel, capturing any errors
    const cleanupResults = await Promise.allSettled(
      agents.map(async ({ agent, name }) => {
        try {
          await agent.cleanup();
          Logging.log('AgentGraph', `✅ Cleaned up ${name}`);
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          Logging.log('AgentGraph', `❌ Failed to cleanup ${name}: ${errorMessage}`, 'error');
          throw error;
        }
      })
    );
    
    // Check if any cleanup operations failed
    const failures = cleanupResults.filter(result => result.status === 'rejected');
    if (failures.length > 0) {
      Logging.log('AgentGraph', `⚠️ ${failures.length} agent(s) failed to cleanup properly`, 'warning');
    } else {
      Logging.log('AgentGraph', '✅ All agents cleaned up successfully');
    }
  }
  
  /**
   * Build the enhanced LangGraph workflow with classification
   */
  private buildGraph(): void {
    // Keep everything in method chaining - this pattern works with LangGraph web TypeScript
    this.graph
      .addNode('classify', this.classificationNode.bind(this))
      .addNode('productivity', this.productivityNode.bind(this))
      .addNode('answer', this.answerNode.bind(this))
      .addNode('planner', this.plannerNode.bind(this))
      .addNode('browse', this.browseNode.bind(this))
      .addNode('validate', this.validateNode.bind(this))
      .addEdge(START, 'classify')
      .addConditionalEdges(
        'classify',
        this.routeAfterClassification.bind(this),
        {
          'productivity': 'productivity',
          'browse': 'planner',
          'answer': 'answer'
        }
      )
      .addEdge('productivity', END)
      .addEdge('answer', END)
      .addEdge('planner', 'browse')
      .addConditionalEdges(
        'browse',
        this.shouldContinueBrowsing.bind(this),
        {
          'continue': 'browse',
          'validate': 'validate'
        }
      )
      .addConditionalEdges(
        'validate',
        this.shouldRetryOrComplete.bind(this),
        {
          'complete': END,
          'replan': 'planner',
          'retry': 'planner'
        }
      );
  }
  
  
  /**
   * Node: Execute classification agent
   */
  private async classificationNode(state: AgentGraphStateType, config?: any): Promise<Partial<AgentGraphStateType>> {
    try {
      Logging.log('AgentGraph', `🎯 Classifying task: ${state.task}`);
      
      // EventBus is accessed through ExecutionContext in each agent
      const result = await this.classificationAgent.invoke({
        instruction: state.task,
        context: {}
      }, config);
      
      if (!result.success || !isClassificationResult(result.result)) {
        throw new Error(`Classification failed: ${result.error || 'No valid classification result'}`);
      }
      
      const classificationOutput = result.result;
      
      Logging.log('AgentGraph', `📊 Task classified as: ${classificationOutput.task_type}`);
      
      // For follow-up tasks, check if task type matches previous
      if (state.isFollowUp && state.previousTaskType) {
        if (state.previousTaskType !== classificationOutput.task_type) {
          // Different task type - treat as new task without context
          Logging.log('AgentGraph', `📝 Task type changed from '${state.previousTaskType}' to '${classificationOutput.task_type}' - starting fresh`);
          
          return {
            classificationResult: classificationOutput,
            taskType: classificationOutput.task_type,
            isFollowUp: false,  // Reset follow-up flag
            previousTaskType: undefined,  // Clear previous context
            previousPlan: undefined  // Clear previous plan
          };
        } else {
          // Same task type - continue with context
          Logging.log('AgentGraph', `🔄 Continuing ${classificationOutput.task_type} task with context`);
        }
      }
      
      return {
        classificationResult: classificationOutput,
        taskType: classificationOutput.task_type
      };
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      Logging.log('AgentGraph', `❌ Classification failed: ${errorMessage}`, 'error');
      
      // Default to productivity path on classification failure
      return {
        classificationResult: {
          task_type: 'productivity' as const
        },
        taskType: 'productivity'
      };
    }
  }
  
  /**
   * Node: Execute productivity agent
   */
  private async productivityNode(state: AgentGraphStateType, config?: any): Promise<Partial<AgentGraphStateType>> {
    try {
      Logging.log('AgentGraph', `🚀 Executing productivity task: ${state.task}`);
      
      // EventBus is accessed through ExecutionContext in each agent
      const result = await this.productivityAgent.invoke({
        instruction: state.task,
        context: {}
      }, config);
      
      if (!result.success || !isProductivityResult(result.result)) {
        throw new Error(`Productivity execution failed: ${result.error || 'No valid productivity result'}`);
      }
      
      const productivityOutput = result.result;
      
      Logging.log('AgentGraph', `✅ Productivity task completed: ${productivityOutput.completed ? 'SUCCESS' : 'FAILED'}`);
      
      return {
        productivityResult: productivityOutput,
        isComplete: true // Productivity tasks complete immediately
      };
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      Logging.log('AgentGraph', `❌ Productivity execution failed: ${errorMessage}`, 'error');
      
      return {
        isComplete: true,
        productivityResult: {
          completed: false,
          result: `Productivity task failed: ${errorMessage}`,
          data: {}
        }
      };
    }
  }
  
  /**
   * Node: Execute answer agent
   */
  private async answerNode(state: AgentGraphStateType, config?: any): Promise<Partial<AgentGraphStateType>> {
    try {
      Logging.log('AgentGraph', `🤔 Executing answer task: ${state.task}`);
      
      // EventBus is accessed through ExecutionContext in each agent
      const result = await this.answerAgent.invoke({
        instruction: state.task,
        context: {
          isFollowUp: state.isFollowUp,
          previousTaskType: state.previousTaskType
        }
      }, config);
      
      if (!result.success) {
        throw new Error(`Answer generation failed: ${result.error || 'No valid answer result'}`);
      }
      
      const answerOutput = result.result as AnswerOutput;
      
      Logging.log('AgentGraph', `✅ Answer generated successfully`);
      
      return {
        answerResult: answerOutput,
        taskType: 'answer' as const,
        isComplete: true // Answer tasks complete immediately
      };
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      Logging.log('AgentGraph', `❌ Answer generation failed: ${errorMessage}`, 'error');
      
      return {
        isComplete: true,
        answerResult: {
          success: false,
          status_message: `Answer generation failed: ${errorMessage}`
        }
      };
    }
  }
  
  /**
   * Node: Execute planner agent (for browse tasks)
   */
  private async plannerNode(state: AgentGraphStateType, config?: any): Promise<Partial<AgentGraphStateType>> {
    try {
      Logging.log('AgentGraph', `🎯 Planning browse task: ${state.task}`);
      
      // Get EventBus from ExecutionContext
      const eventBus = this.executionContext.getEventBus();
      
      const result = await this.plannerAgent.invoke({
        instruction: state.task,
        context: {
          retryCount: state.retryCount,
          previousResults: state.stepResults,
          validationResult: state.validationResult,  // Pass validation feedback for replanning
          previousPlan: state.previousPlan  // Pass previous plan for follow-up tasks
        }
      }, config);
      
      if (!result.success || !isPlannerResult(result.result)) {
        throw new Error(`Planning failed: ${result.error || 'No valid plan generated'}`);
      }
      
      const plannerOutput = result.result;
      
      Logging.log('AgentGraph', `📋 Plan created with ${plannerOutput.plan.length} steps`);
      
      // Display the plan to the user via EventBus
      if (eventBus && plannerOutput.plan.length > 0) {
        // Build a compact plan display
        let planDisplay = `📝 Execution Plan:\n`;
        plannerOutput.plan.forEach((step, index) => {
          planDisplay += `${step}\n`;
        });
        eventBus.emitSystemMessage(planDisplay, 'info', 'AgentGraph');
      }
      
      return {
        plan: plannerOutput.plan,
        planResult: plannerOutput,
        currentStepIndex: 0,
        stepResults: [], // Reset results when replanning
        retryCount: (state.retryCount || 0) + (state.validationResult ? 1 : 0) // Increment retry count if replanning after validation
      };
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      Logging.log('AgentGraph', `❌ Planning failed: ${errorMessage}`, 'error');
      
      return {
        isComplete: true,
        validationResult: {
          is_valid: false,
          reasoning: `Planning failed: ${errorMessage}`,
          answer: '',
          confidence: 'low' as const,
          needs_retry: false
        }
      };
    }
  }
  
  /**
   * Node: Execute browse agent for current step
   */
  private async browseNode(state: AgentGraphStateType, config?: any): Promise<Partial<AgentGraphStateType>> {
    try {
      // Determine how many steps the agent should work on
      // Allow agent to complete multiple related steps in one execution
      const remainingSteps = state.plan.length - state.currentStepIndex;
      const stepsToExecute = Math.min(remainingSteps, 3); // Work on up to 3 steps at a time
      
      if (remainingSteps === 0) {
        throw new Error(`No steps remaining in plan`);
      }
      
      // Get the current batch of steps
      const currentSteps = state.plan.slice(
        state.currentStepIndex, 
        state.currentStepIndex + stepsToExecute
      );
      
      Logging.log('AgentGraph', `🌐 Browsing steps ${state.currentStepIndex + 1}-${state.currentStepIndex + stepsToExecute} of ${state.plan.length}`);
      
      // EventBus is accessed through ExecutionContext in each agent
      
      // Create enhanced instruction that includes the full plan context
      const enhancedInstruction = `You have a todo list (plan) to complete. Focus on the current steps but be aware of the full plan.

Full Plan:
${state.plan.join('\n')}

Current Progress: Step ${state.currentStepIndex + 1} of ${state.plan.length}

Your Task:
1. Analyze the current browser state
2. Work on the following steps (in order):
${currentSteps.map((step, idx) => `   ${state.currentStepIndex + idx + 1}. ${step}`).join('\n')}

Important Instructions:
- Use the 'todo_list_manager' tool after completing or skipping each step to update the plan
- If a step is already done or not applicable, mark it as skipped with todo_list_manager
- Be EXTREMELY CONCISE in your responses - just state what action you took
- You may complete multiple related steps before using the done tool
- Only use the 'done' tool when you've completed all assigned steps or hit a natural stopping point`;
      
      const result = await this.browseAgent.invoke({
        instruction: enhancedInstruction,
        context: {
          stepNumber: state.currentStepIndex + 1,
          totalSteps: state.plan.length,
          originalTask: state.task,
          plan: state.plan,
          currentStepIndex: state.currentStepIndex,
          stepsToExecute: stepsToExecute
        }
      }, config);
      
      if (!result.success || !isBrowseResult(result.result)) {
        throw new Error(`Browsing failed: ${result.error || 'No valid browse result'}`);
      }
      
      const browseOutput = result.result;
      
      // Calculate how many steps were actually completed based on the updated plan
      // The agent should have updated the plan via todo_list_manager
      const updatedPlan = this.getUpdatedPlanFromMessageHistory(state);
      const completedSteps = this.countCompletedSteps(updatedPlan, state.currentStepIndex, stepsToExecute);
      
      Logging.log('AgentGraph', `✅ Browse completed ${completedSteps} steps`);
      
      return {
        browseResult: browseOutput,
        stepResults: [...state.stepResults, browseOutput],
        currentStepIndex: state.currentStepIndex + completedSteps,
        plan: updatedPlan // Update the plan in state with the checkbox progress
      };
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      Logging.log('AgentGraph', `❌ Browsing failed: ${errorMessage}`, 'error');
      
      // Mark as failed but continue to validation
      const failedResult: any = {
        completed: false,
        actions_taken: [],
        final_state: `Failed: ${errorMessage}`,
        extracted_data: {}
      };
      
      return {
        browseResult: failedResult,
        stepResults: [...state.stepResults, failedResult],
        currentStepIndex: state.currentStepIndex + 1
      };
    }
  }
  
  /**
   * Node: Execute validator agent (for browse tasks)
   */
  private async validateNode(state: AgentGraphStateType, config?: any): Promise<Partial<AgentGraphStateType>> {
    try {
      Logging.log('AgentGraph', `🔍 Validating browse task completion`);
      
      // EventBus is accessed through ExecutionContext in each agent
      
      const result = await this.validatorAgent.invoke({
        instruction: state.task,
        context: {
          plan: state.plan,
          stepResults: state.stepResults,
          browseResult: state.browseResult
        }
      }, config);
      
      if (!result.success || !isValidatorResult(result.result)) {
        throw new Error(`Validation failed: ${result.error || 'No valid validation result'}`);
      }
      
      const validatorOutput = result.result;
      
      Logging.log('AgentGraph', `🎯 Validation result: ${validatorOutput.is_valid ? 'VALID' : 'INVALID'}`);
      
      return {
        validationResult: validatorOutput,
        isComplete: validatorOutput.is_valid || state.retryCount >= state.maxRetries
      };
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      Logging.log('AgentGraph', `❌ Validation failed: ${errorMessage}`, 'error');
      
      return {
        isComplete: true,
        validationResult: {
          is_valid: false,
          reasoning: `Validation failed: ${errorMessage}`,
          answer: '',
          confidence: 'low' as const,
          needs_retry: false
        }
      };
    }
  }
  
  /**
   * Conditional edge: Route after classification
   */
  private routeAfterClassification(state: any): 'productivity' | 'browse' | 'answer' {
    return state.taskType || 'productivity'; // Default to productivity if no classification
  }
  
  /**
   * Conditional edge: Should continue browsing through plan steps?
   */
  private shouldContinueBrowsing(state: any): 'continue' | 'validate' {
    // If we have more steps in the plan, continue browsing
    if (state.currentStepIndex < state.plan.length) {
      return 'continue';
    }
    
    // All steps completed, go to validation
    return 'validate';
  }
  
  /**
   * Conditional edge: Should retry, replan, or complete?
   */
  private shouldRetryOrComplete(state: any): 'retry' | 'replan' | 'complete' {
    // If validation passed or max retries reached, complete
    if (state.isComplete) {
      return 'complete';
    }
    
    const validator = state.validationResult;
    if (!validator || !isValidatorResult(validator)) {
      return 'complete'; // No validation result, complete
    }
    
    // If valid, complete
    if (validator.is_valid) {
      return 'complete';
    }
    
    // If max retries reached, complete
    if (state.retryCount >= state.maxRetries) {
      return 'complete';
    }
    
    // If validator suggests retry and we have retries left
    if (validator.needs_retry) {
      // For now, always replan instead of just retrying
      // This ensures fresh planning based on current state
      return 'replan';
    }
    
    return 'complete';
  }
  
  /**
   * Get the updated plan from message history
   * The TodoListManager tool updates the plan in message history
   */
  private getUpdatedPlanFromMessageHistory(state: AgentGraphStateType): string[] {
    try {
      // Try to get the updated plan from message manager
      const updatedPlan = this.executionContext.messageManager.getPreviousPlan();
      if (updatedPlan && updatedPlan.length > 0) {
        return updatedPlan;
      }
    } catch (error) {
      Logging.log('AgentGraph', `Failed to get updated plan: ${error}`, 'warning');
    }
    
    // Fallback to current state plan
    return state.plan;
  }
  
  /**
   * Count how many steps were completed or skipped
   * @param updatedPlan - Plan with checkbox markers
   * @param startIndex - Starting index in the plan
   * @param maxSteps - Maximum number of steps that could have been completed
   */
  private countCompletedSteps(updatedPlan: string[], startIndex: number, maxSteps: number): number {
    let completed = 0;
    
    for (let i = 0; i < maxSteps && (startIndex + i) < updatedPlan.length; i++) {
      const step = updatedPlan[startIndex + i];
      // Check if step is marked as completed [x] or skipped [~]
      if (step.includes('[x]') || step.includes('[~]')) {
        completed++;
      } else {
        // Stop counting at the first incomplete step
        break;
      }
    }
    
    // At least move forward by 1 to avoid infinite loops
    return Math.max(completed, 1);
  }
  
  /**
   * Conditional edge: Should replan after validation?
   */
  private shouldReplan(state: any): 'plan' | 'end' {
    // Check if we should replan based on validation result
    if (state.validationResult?.needs_retry && state.retryCount < 2) {
      return 'plan';
    }
    
    return 'end';
  }
  
  /**
   * Compile and return the executable graph
   */
  public compile() {
    return this.graph.compile();
  }
}