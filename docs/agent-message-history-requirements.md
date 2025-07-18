# Agent Message History Requirements

## Overview
Each agent in the system requires different message contexts to function optimally. This document outlines what message history each agent should receive based on the NanoBrowser implementation patterns.

## Agent-Specific Requirements

### 1. PlannerAgent
**Purpose**: Analyze task and create actionable plans  
**Message History**: 
- **Full conversation history** (excluding the first system message)
- Includes all previous attempts, errors, and context
- Format: `[systemMessage, ...allMessages.slice(1)]`

**Rationale**: Needs historical context to avoid repeating failed strategies and to build upon previous attempts.

### 2. NavigatorAgent / BrowseAgent  
**Purpose**: Execute browser interactions and navigation  
**Message History**:
- **Full message history** with dynamic state management
- Adds browser state message before execution
- Removes state message after execution
- Adds model output to history for next iteration

**Key Behavior**:
```
1. Add browser state → 2. Execute with all messages → 3. Remove state → 4. Add output
```

**Rationale**: Needs context of what has been tried but requires fresh browser state for each action.

### 3. ValidatorAgent
**Purpose**: Validate task completion based on current state  
**Message History**:
- **ONLY current browser state** (no conversation history)
- Format: `[systemMessage, browserStateMessage]`
- Optionally append plan to state message if replanning

**Rationale**: Should make objective assessment based solely on current state, not influenced by past attempts.

## Implementation Differences

### Current Implementation (Incorrect)
All agents receive the same message set from BaseAgent:
- System message
- Task message  
- Browser state
- Full conversation history

### Required Implementation (Per NanoBrowser)
Each agent manages its own message preparation:
- **Planner**: Sees everything for context
- **Navigator**: Manages state dynamically  
- **Validator**: Isolated to current state only

## Key Principles

1. **Message Isolation**: Validator must not see conversation history
2. **Dynamic State**: Navigator adds/removes state per execution
3. **Historical Context**: Planner needs full visibility for learning
4. **Output Tracking**: Navigator stores model outputs in history

## Benefits

- **Better Planning**: Planner learns from failures
- **Accurate Validation**: Validator gives unbiased assessment
- **Fresh Context**: Navigator always has current state
- **Reduced Hallucination**: Agents only see relevant information

## Message Manager Methods

### addModelOutput vs ActionResult

The message manager provides two distinct mechanisms for tracking agent execution:

#### 1. addModelOutput(output: Record<string, any>)
- **Purpose**: Tracks the agent's reasoning and planned actions BEFORE execution
- **Content**: The LLM's response containing its plan/reasoning (e.g., "I will click button X, then navigate to Y")
- **When used**: Right after the LLM generates its response, before executing any actions
- **In conversation**: Shows what the agent was thinking/planning
- **Primary user**: NavigatorAgent (after getting model output, before executing actions)

#### 2. ActionResult (via tool execution tracking)
- **Purpose**: Tracks the actual results of tool executions AFTER they happen
- **Content**: The outcomes of tools (e.g., "Successfully clicked button", "Found text: XYZ")
- **When used**: After each tool is executed
- **In conversation**: Shows what actually happened
- **Managed by**: StreamProcessor and BaseAgent.syncLangchainAndMessageManager

### Usage Pattern in NanoBrowser

NavigatorAgent flow:
1. Get model output from LLM (agent's plan)
2. Call `addModelOutput(modelOutput)` - saves the plan to conversation history
3. Execute the planned actions
4. Track results with ActionResults

### When to Use Each

**Use addModelOutput when:**
- You need to debug why an agent made certain decisions
- Future iterations should see what was previously planned
- Building agents that make complex multi-step decisions
- The agent's reasoning process is important to preserve

**Use ActionResult when:**
- Tracking what tools were actually executed
- Recording the outcomes of actions
- Filtering which tool results should be included in conversation history
- Managing memory by excluding verbose tool outputs

### Current Implementation Notes

- **PlannerAgent**: Uses `addPlanMessage()` instead of `addModelOutput` (functionally similar)
- **ValidatorAgent**: Doesn't need `addModelOutput` as its validation result is the final output
- **NavigatorAgent/BrowseAgent**: Should use `addModelOutput` if tracking reasoning is important

## System Prompt Management

### The Problem
When multiple agents run in sequence (e.g., Planner → Browse → Validator), their system prompts can accumulate in the message history, causing confusion as each agent sees instructions meant for other agents.

### The Solution
The `MessageManager.addSystemMessage()` method now automatically removes any existing system messages before adding a new one. This ensures:
- Only one system prompt is active at any time
- Each agent sees only its own instructions
- No manual cleanup is required

### Implementation
```typescript
public addSystemMessage(content: string, position?: number): void {
  // Remove any existing system messages first
  this.removeSystemMessage();
  
  // Now add the new system message
  const msg = new SystemMessage({ content });
  this.add(msg, 'system', position);
}
```

This automatic cleanup prevents system prompt accumulation and ensures clean agent execution.