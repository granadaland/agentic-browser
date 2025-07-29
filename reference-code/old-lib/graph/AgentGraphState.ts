import { Annotation } from '@langchain/langgraph/web';
import { PlannerOutput } from '@/lib/agent/PlannerAgent';
import { BrowseOutput } from '@/lib/agent/BrowseAgent';
import { ValidatorOutput } from '@/lib/agent/ValidatorAgent';
import { ClassificationOutput } from '@/lib/agent/ClassificationAgent';
import { ProductivityOutput } from '@/lib/agent/ProductivityAgent';
import { AnswerOutput } from '@/lib/agent/AnswerAgent';

/**
 * State annotation for the agent execution graph using LangGraph's new annotation system
 */
export const AgentGraphState = Annotation.Root({
  // Core task information
  task: Annotation<string>(),

  // Classification phase
  classificationResult: Annotation<ClassificationOutput | undefined>(),
  taskType: Annotation<"productivity" | "browse" | "answer" | undefined>(),

  // Different agents and their results
  plan: Annotation<string[]>({
    reducer: (current, update) => update ?? current ?? [],
  }),
  planResult: Annotation<PlannerOutput | undefined>(),
  browseResult: Annotation<BrowseOutput | undefined>(),
  productivityResult: Annotation<ProductivityOutput | undefined>(),
  answerResult: Annotation<AnswerOutput | undefined>(),
  validationResult: Annotation<ValidatorOutput | undefined>(),

  // Control flow
  currentStepIndex: Annotation<number>({
    reducer: (current, update) => update ?? current ?? 0,
  }),
  stepResults: Annotation<BrowseOutput[]>({
    reducer: (current, update) => update ?? current ?? [],
  }),
  isComplete: Annotation<boolean>({
    reducer: (current, update) => update ?? current ?? false,
  }),
  retryCount: Annotation<number>({
    reducer: (current, update) => update ?? current ?? 0,
  }),
  maxRetries: Annotation<number>({
    reducer: (current, update) => update ?? current ?? 2,
  }),
  startTime: Annotation<number | undefined>(),

  // Follow-up task tracking
  isFollowUp: Annotation<boolean>({
    reducer: (current, update) => update ?? current ?? false,
  }),
  previousTaskType: Annotation<"productivity" | "browse" | "answer" | undefined>(),
  previousPlan: Annotation<string[] | undefined>(),
});

export type AgentGraphStateType = typeof AgentGraphState.State;

/**
 * Helper function to create initial state from task
 */
export function createInitialState(
  task: string, 
  followUpContext?: {
    isFollowUp: boolean;
    previousTaskType: 'productivity' | 'browse' | 'answer' | null;
    previousPlan: string[] | null;
    previousQuery: string | null;
  } | null
): AgentGraphStateType {
  return {
    task,
    classificationResult: undefined,
    taskType: undefined,
    
    plan: [],
    planResult: undefined,
    browseResult: undefined,
    productivityResult: undefined,
    answerResult: undefined,
    validationResult: undefined,
    
    // Execution phase
    currentStepIndex: 0,
    stepResults: [],
    isComplete: false,
    retryCount: 0,
    maxRetries: 2,
    startTime: Date.now(),
    
    // Follow-up task tracking
    isFollowUp: followUpContext?.isFollowUp ?? false,
    previousTaskType: followUpContext?.previousTaskType || undefined,
    previousPlan: followUpContext?.previousPlan || undefined
  };
}

/**
 * Type guards for checking specific result types in state
 */
export function isClassificationResult(result: any): result is ClassificationOutput {
  return result && typeof result.task_type === 'string' && ['productivity', 'browse', 'answer'].includes(result.task_type);
}

export function isPlannerResult(result: any): result is PlannerOutput {
  return result && typeof result.plan === 'object' && Array.isArray(result.plan);
}

export function isBrowseResult(result: any): result is BrowseOutput {
  return result && typeof result.completed === 'boolean';
}

export function isProductivityResult(result: any): result is ProductivityOutput {
  return result && typeof result.completed === 'boolean' && typeof result.result === 'string';
}

export function isAnswerResult(result: any): result is AnswerOutput {
  return result && typeof result.success === 'boolean' && typeof result.status_message === 'string';
}

export function isValidatorResult(result: any): result is ValidatorOutput {
  return result && typeof result.is_valid === 'boolean';
}