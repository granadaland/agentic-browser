# Conversation Continuity and Follow-up Task Routing

## Overview

This document describes the implementation of conversation continuity and intelligent follow-up task routing in the Nxtscape agent system. The feature enables the agent to maintain context across multiple user interactions within a single conversation, intelligently routing follow-up tasks based on previous execution context.

## Problem Statement

Previously, when a user interrupted a task and then provided a new instruction, the system would:
1. Lose all context from the previous execution
2. Start from scratch with classification
3. Not consider what was already accomplished
4. Not leverage the previous plan for browse tasks

This led to inefficient execution and poor user experience, especially when users wanted to modify or continue interrupted tasks.

## Design Goals

1. **Preserve Conversation Context**: Maintain message history and execution state across tasks
2. **Smart Routing**: Route follow-up tasks intelligently based on previous agent type
3. **Efficient Replanning**: When browse tasks are interrupted, use previous plan context
4. **Simple Implementation**: Avoid complex state persistence initially (no LangGraph checkpointing)
5. **User Control**: Allow users to interrupt and redirect tasks naturally

## Architecture

### Key Components

1. **NxtScape** (`src/lib/core/NxtScape.ts`)
   - Tracks `lastAgentType` and `lastCompletedPlan`
   - Creates follow-up context for the orchestrator
   - Determines if current execution is a follow-up

2. **MessageManager** (`src/lib/runtime/MessageManager.ts`)
   - Persists conversation history
   - Tracks last agent type
   - Stores and retrieves previous plans

3. **AgentGraph** (`src/lib/graph/AgentGraph.ts`)
   - New `entry` node for intelligent routing
   - `routeFromEntry` logic for follow-up handling
   - Smart classification bypass for known contexts

4. **GraphState** (`src/lib/graph/GraphState.ts`)
   - Added follow-up tracking fields
   - `isFollowUp`, `previousTaskType`, `previousPlan`, `requiresReplanning`

5. **PlannerAgent** (`src/lib/agent/PlannerAgent.ts`)
   - Context-aware planning using previous plan
   - Shows interrupted steps to LLM

## Implementation Details

### Follow-up Detection

The system detects follow-up tasks by checking if there are existing messages in the conversation:

```typescript
const isFollowUp = this.messageManager.getMessages().length > 0;
```

### Follow-up Context Structure

```typescript
const followUpContext = {
  isFollowUp: true,
  lastAgentType: 'productivity' | 'browse' | null,
  lastPlan: string[] | null,
  previousQuery: string | null
}
```

### Routing Logic

The `entry` node in AgentGraph implements intelligent routing:

1. **New Tasks** → Classification
2. **Productivity Follow-ups** → ProductivityAgent (skip classification)
3. **Browse Follow-ups** → PlannerAgent (for replanning)
4. **Browse Continuation** → BrowseAgent (if plan exists and not completed)

### Special Handling for Browse Tasks

After discussion, we decided that **all browse follow-ups should go to the planner** for better handling. This ensures:
- Proper context awareness
- Intelligent replanning based on what was accomplished
- Better handling of user redirections

The system uses a special `browse-follow-up` task type to bypass classification and route directly to the planner.

### Replanning Detection

The system analyzes keywords to detect when replanning is needed:
- "instead", "actually", "no", "wait", "change", "different", "stop", "forget"

However, based on user feedback, we simplified this to always replan for browse follow-ups.

## User Experience

### Example Flow 1: Browse Task Interruption

1. User: "Order toothpaste on Amazon"
   - Routes through: classify → planner → browse
   - User interrupts after search results appear

2. User: "Actually, make it fluoride-free toothpaste"
   - System detects follow-up (previous type: browse)
   - Routes directly to planner with previous context
   - Planner sees: "User was at search results, now wants fluoride-free"
   - Creates new plan starting from current state

### Example Flow 2: Productivity Task Continuation

1. User: "Close all Google tabs"
   - Routes through: classify → productivity
   - Executes successfully

2. User: "Now close YouTube tabs too"
   - System detects follow-up (previous type: productivity)
   - Routes directly to productivity agent
   - No need to reclassify

## Technical Decisions

### 1. State Management
- **Decision**: Use in-memory state with MessageManager
- **Rationale**: Simpler than LangGraph checkpointing, sufficient for single-session continuity
- **Trade-off**: State lost on extension reload (acceptable per requirements)

### 2. Routing Strategy
- **Decision**: Always route browse follow-ups to planner
- **Rationale**: Ensures proper context handling and replanning
- **Alternative considered**: Conditional routing based on keywords (too complex)

### 3. Type System
- **Decision**: Use `any` type for LangGraph routing methods
- **Rationale**: LangGraph TypeScript compatibility issues
- **Trade-off**: Less type safety in routing methods

### 4. Plan Storage
- **Decision**: Store plans in MessageManager with special message type
- **Rationale**: Centralized conversation state management
- **Format**: JSON array wrapped in `<plan>` tags

## Configuration

No additional configuration required. The feature is automatically enabled and works with existing agent settings.

## Limitations

1. **Session-based**: Conversation state is lost on extension reload
2. **Single conversation**: No support for multiple parallel conversations
3. **No persistence**: State not saved to disk or browser storage
4. **Plan-only context**: Only tracks plans, not detailed execution state

## Future Enhancements

1. **LangGraph Checkpointing**: Implement full state persistence
2. **Multi-conversation Support**: Track multiple conversation threads
3. **Execution State Tracking**: Remember exact step progress
4. **UI Indicators**: Show when in continuation mode
5. **User Control**: Add explicit "start fresh" option

## Testing

The implementation was tested with various scenarios:

1. **Browse interruption and redirection**
   - Start browse task, interrupt, provide new direction
   - Verified routing to planner with context

2. **Productivity task chaining**
   - Execute productivity task, follow with related task
   - Verified direct routing without reclassification

3. **Mixed task types**
   - Alternate between browse and productivity tasks
   - Verified correct routing based on new task type

4. **Build verification**
   - TypeScript compilation successful
   - No runtime errors in testing

## Code Examples

### Creating Follow-up Context (NxtScape)

```typescript
const followUpContext = isFollowUp ? {
  isFollowUp: true,
  lastAgentType: this.messageManager.getLastAgentType() || this.lastAgentType,
  lastPlan: this.messageManager.getLastPlan() || this.lastCompletedPlan,
  previousQuery: this.currentQuery
} : null;
```

### Entry Node Routing (AgentGraph)

```typescript
private async entryNode(state: any, config?: any) {
  if (!state.isFollowUp) {
    return {}; // New conversation
  }
  
  if (state.previousTaskType === 'browse') {
    return {
      requiresReplanning: true,
      taskType: 'browse-follow-up'
    };
  }
  
  if (state.previousTaskType === 'productivity') {
    return { taskType: 'productivity' };
  }
}
```

### Using Previous Plan Context (PlannerAgent)

```typescript
if (previousPlan && previousPlan.length > 0) {
  conversationHistory += '\n\n📋 PREVIOUS PLAN (from interrupted task):\n';
  previousPlan.forEach((step, index) => {
    conversationHistory += `${index + 1}. ${step}\n`;
  });
  conversationHistory += '\n⚠️ The user interrupted this plan...';
}
```

## Conclusion

The conversation continuity feature significantly improves the user experience by maintaining context across interactions. The implementation is clean, efficient, and works within the existing architecture without requiring major changes. The decision to always route browse follow-ups through the planner ensures reliable and predictable behavior while maintaining the flexibility to handle various user interaction patterns.