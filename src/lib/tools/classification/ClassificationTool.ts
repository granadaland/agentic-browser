import { DynamicStructuredTool } from '@langchain/core/tools'
import { z } from 'zod'
import { ExecutionContext } from '@/lib/runtime/ExecutionContext'
import { MessageManagerReadOnly } from '@/lib/runtime/MessageManager'
import { toolSuccess, toolError } from '@/lib/tools/Tool.interface'
import { HumanMessage, SystemMessage } from '@langchain/core/messages'
import { 
  buildClassificationSystemPrompt,
  buildClassificationTaskPrompt
} from '@/lib/tools/classification/classification.tool.prompt'

// Constants
const MAX_RECENT_MESSAGES = 10  // Number of recent messages to analyze

// Input schema - just the task
export const ClassificationInputSchema = z.object({
  task: z.string(),  // Task to classify
})

export type ClassificationInput = z.infer<typeof ClassificationInputSchema>

// Output schema for classification result
const ClassificationResultSchema = z.object({
  is_simple_task: z.boolean(),  // True if task can be done without planning
  is_followup_task: z.boolean(),  // True if task continues from previous context
})

type ClassificationResult = z.infer<typeof ClassificationResultSchema>

export class ClassificationTool {
  constructor(
    private executionContext: ExecutionContext,
    private toolDescriptions: string
  ) {}

  async execute(input: ClassificationInput): Promise<string> {
    try {
      // Get LLM instance
      const llm = await this.executionContext.getLLM()
      
      // Get recent message history
      const reader = new MessageManagerReadOnly(this.executionContext.messageManager)
      const recentMessages = reader.getAll().slice(-MAX_RECENT_MESSAGES)
      
      // Build prompt
      const systemPrompt = this._buildSystemPrompt()
      const taskPrompt = this._buildTaskPrompt(input.task, recentMessages)
      
      // Call LLM
      const response = await llm.invoke([
        new SystemMessage(systemPrompt),
        new HumanMessage(taskPrompt)
      ])
      
      // Parse response
      const content = response.content.toString()
      const jsonMatch = content.match(/\{[\s\S]*\}/)
      
      if (!jsonMatch) {
        throw new Error('No JSON found in LLM response')
      }
      
      const result = JSON.parse(jsonMatch[0]) as ClassificationResult
      
      // Validate result
      ClassificationResultSchema.parse(result)
      
      return JSON.stringify(toolSuccess(JSON.stringify(result)))
    } catch (error) {
      return JSON.stringify(toolError(`Classification failed: ${error instanceof Error ? error.message : String(error)}`))
    }
  }

  private _buildSystemPrompt(): string {
    return buildClassificationSystemPrompt(this.toolDescriptions)
  }

  private _buildTaskPrompt(task: string, recentMessages: any[]): string {
    const messageHistory = recentMessages
      .map(m => `${m._getType()}: ${m.content}`)
      .join('\n')
    
    return buildClassificationTaskPrompt(task, messageHistory)
  }
}

// Factory function
export function createClassificationTool(
  executionContext: ExecutionContext,
  toolDescriptions: string
): DynamicStructuredTool {
  const classificationTool = new ClassificationTool(executionContext, toolDescriptions)
  
  return new DynamicStructuredTool({
    name: 'classification_tool',
    description: 'Classify whether a task is simple/complex and new/follow-up',
    schema: ClassificationInputSchema,
    func: async (args: ClassificationInput): Promise<string> => {
      return await classificationTool.execute(args)
    }
  })
}