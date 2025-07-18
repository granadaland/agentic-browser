# EventBus Architecture Guide

## Overview

The EventBus architecture provides a centralized, type-safe event system for handling streaming updates throughout the Nxtscape agent framework. It replaces the previous callback-based approach with a cleaner, more maintainable event-driven pattern.

## Core Components

### 1. StreamEventBus (`/src/lib/events/EventBus.ts`)

The main event bus that extends Node.js EventEmitter with type-safe event handling.

```typescript
import { StreamEventBus } from '@/lib/events';

// Create an EventBus instance
const eventBus = new StreamEventBus({
  bufferSize: 100,  // Number of events to buffer for replay
  debugMode: false  // Enable debug logging
});
```

### 2. Event Types

Events are categorized into four main types:

- **Segment Events** - For streaming text segments
  - `segment.start` - New text segment begins
  - `segment.chunk` - Streaming text chunk
  - `segment.end` - Segment completes

- **Tool Events** - For tool execution
  - `tool.start` - Tool execution begins
  - `tool.stream` - Tool streaming output
  - `tool.end` - Tool execution completes

- **System Events** - For system-level updates
  - `system.message` - System status messages
  - `system.error` - Error notifications
  - `system.complete` - Task completion
  - `system.cancel` - Task cancellation

- **Debug Events** - For debugging (only in debug mode)
  - `debug.message` - Debug information

### 3. Event Schema

All events follow this structure:

```typescript
interface StreamEvent {
  id: string;              // Unique event ID
  type: StreamEventType;   // Event type
  timestamp: number;       // Unix timestamp
  source?: string;         // Source component
  data: unknown;           // Event-specific data
}
```

## Usage Guidelines

### 1. Emitting Events

Use the type-specific helper methods for better type safety:

```typescript
// System messages
eventBus.emitSystemMessage('Processing your request...', 'info', 'MyAgent');

// Tool execution
eventBus.emitToolStart({
  toolName: 'search_tool',
  displayName: 'Web Search',
  icon: '🔍',
  args: { query: 'example' }
}, 'MyAgent');

// Streaming segments
const segmentId = 1;
const messageId = 'msg-123';

eventBus.emitSegmentStart(segmentId, messageId, 'MyAgent');
eventBus.emitSegmentChunk(segmentId, 'Hello ', messageId, 'MyAgent');
eventBus.emitSegmentChunk(segmentId, 'world!', messageId, 'MyAgent');
eventBus.emitSegmentEnd(segmentId, 'Hello world!', messageId, 'MyAgent');

// Errors
eventBus.emitError('Something went wrong', 'ERR_001', false, 'MyAgent');

// Completion
eventBus.emitComplete(true, 'Task completed successfully', 'MyAgent');
```

### 2. Subscribing to Events

Subscribe to specific event types or use wildcards:

```typescript
// Subscribe to specific event type
eventBus.onStreamEvent('system.message', (event) => {
  const { message, level } = event.data as any;
  console.log(`[${level}] ${message}`);
});

// Subscribe to multiple event types
eventBus.onStreamEvent(['tool.start', 'tool.end'], (event) => {
  console.log('Tool event:', event);
});

// Subscribe to all events
eventBus.onStreamEvent('*', (event) => {
  console.log('Any event:', event);
});

// Filtered subscription
const unsubscribe = eventBus.onFiltered(
  (event) => event.source === 'BrowseAgent',
  (event) => console.log('BrowseAgent event:', event)
);

// Unsubscribe when done
unsubscribe();
```

### 3. Promise-based Event Waiting

Wait for specific events with optional timeout:

```typescript
try {
  const event = await eventBus.waitFor('system.complete', 30000);
  console.log('Task completed:', event.data);
} catch (error) {
  console.error('Timeout waiting for completion');
}
```

### 4. Event Replay

Replay buffered events for late subscribers:

```typescript
// Replay all buffered events
eventBus.replay((event) => {
  console.log('Replayed event:', event);
});

// Replay filtered events
eventBus.replay(
  (event) => console.log('Tool event:', event),
  (event) => event.type.startsWith('tool.')
);
```

## Integration Patterns

### 1. In Agents

Agents receive EventBus through the config parameter:

```typescript
export class MyAgent extends BaseAgent {
  protected async executeAgent(
    input: AgentInput,
    config?: RunnableConfig
  ): Promise<AgentOutput> {
    // EventBus is available via config
    const eventBus = config?.configurable?.eventBus || this.currentEventBus;
    
    // Emit progress updates
    eventBus?.emitSystemMessage('Starting task...', 'info', this.getAgentName());
    
    // Your agent logic here
    
    return result;
  }
}
```

### 2. In Background Script

Create EventBus for each query execution:

```typescript
async function handleExecuteQuery(query: string, tabIds?: number[]) {
  // Create EventBus and UI handler
  const { eventBus, cleanup } = createStreamingEventBus();
  
  try {
    // Execute with EventBus
    const result = await nxtScape.run({
      query,
      tabIds,
      eventBus
    });
    
    // Handle result
  } finally {
    // Clean up listeners
    cleanup();
  }
}

function createStreamingEventBus() {
  const eventBus = new StreamEventBus();
  
  // Create UI handler to convert events to messages
  const uiHandler = new UIEventHandler(eventBus, (type, payload) => {
    // Send to UI via port messaging
    broadcastToUI(payload);
  });
  
  return {
    eventBus,
    cleanup: () => {
      uiHandler.destroy();
      eventBus.removeAllListeners();
    }
  };
}
```

### 3. In UI Components

The UI receives events as messages through the port messaging system:

```typescript
// In React component
useEffect(() => {
  const handleStreamUpdate = (payload: any) => {
    const { action, details } = payload;
    
    switch (details?.messageType) {
      case 'SystemMessage':
        addSystemMessage(details.content);
        break;
      case 'NewSegment':
        startNewSegment(details.messageId);
        break;
      case 'StreamingChunk':
        appendToSegment(details.messageId, details.content);
        break;
      // Handle other message types
    }
  };
  
  addMessageListener(MessageType.AGENT_STREAM_UPDATE, handleStreamUpdate);
  
  return () => {
    removeMessageListener(MessageType.AGENT_STREAM_UPDATE, handleStreamUpdate);
  };
}, []);
```

## Best Practices

### 1. Always Provide Source

Include the source parameter to help with debugging:

```typescript
eventBus.emitSystemMessage('Processing...', 'info', 'ProductivityAgent');
```

### 2. Use Appropriate Event Types

Choose the right event type for your use case:
- Use `system.message` for user-facing status updates
- Use `system.error` for errors that should be shown to users
- Use `debug.message` for developer-oriented debugging info
- Use segment events for streaming LLM responses
- Use tool events for tool execution updates

### 3. Clean Up Listeners

Always clean up event listeners to prevent memory leaks:

```typescript
const handler = (event) => { /* ... */ };
eventBus.onStreamEvent('system.message', handler);

// Later, when done
eventBus.offStreamEvent('system.message', handler);
```

### 4. Handle Errors Gracefully

Wrap event handlers in try-catch to prevent breaking the event flow:

```typescript
eventBus.onStreamEvent('*', (event) => {
  try {
    processEvent(event);
  } catch (error) {
    console.error('Error processing event:', error);
  }
});
```

### 5. Use Event Buffering Wisely

The event buffer helps with debugging and late subscribers, but be mindful of memory usage:

```typescript
// Get buffer statistics
const stats = eventBus.getStats();
console.log('Event counts:', stats);

// Clear buffer if needed
eventBus.clearBuffer();
```

## Migration Guide

### From Callbacks to EventBus

**Before (Callback-based):**
```typescript
const callbacks = {
  onSystemMessage: (msg) => console.log(msg),
  onToolCall: (tool, args) => console.log('Tool:', tool),
  onError: (err) => console.error(err)
};

await agent.execute(input, callbacks);
```

**After (EventBus-based):**
```typescript
const eventBus = new StreamEventBus();

// Set up listeners
eventBus.onStreamEvent('system.message', (event) => {
  console.log(event.data.message);
});

eventBus.onStreamEvent('tool.start', (event) => {
  console.log('Tool:', event.data.toolName);
});

eventBus.onStreamEvent('system.error', (event) => {
  console.error(event.data.error);
});

// Execute with EventBus
await agent.execute(input, { configurable: { eventBus } });
```

## Debugging

### 1. Enable Debug Mode

```typescript
const eventBus = new StreamEventBus({ debugMode: true });
```

### 2. Log All Events

```typescript
eventBus.onStreamEvent('*', (event) => {
  console.log(`[${event.type}] ${event.source}:`, event.data);
});
```

### 3. Inspect Event Buffer

```typescript
// Get all buffered events
const events = eventBus.getBuffer();

// Get events of specific type
const toolEvents = eventBus.getBuffer(
  (event) => event.type.startsWith('tool.')
);

// Get event statistics
const stats = eventBus.getStats();
```

## Common Patterns

### 1. Progress Tracking

```typescript
let completedSteps = 0;
const totalSteps = 5;

eventBus.onStreamEvent('tool.end', (event) => {
  completedSteps++;
  const progress = (completedSteps / totalSteps) * 100;
  updateProgressBar(progress);
});
```

### 2. Error Aggregation

```typescript
const errors: string[] = [];

eventBus.onStreamEvent('system.error', (event) => {
  errors.push(event.data.error);
});

eventBus.onStreamEvent('system.complete', (event) => {
  if (errors.length > 0) {
    showErrorSummary(errors);
  }
});
```

### 3. Tool Execution Timeline

```typescript
const timeline: any[] = [];

eventBus.onStreamEvent(['tool.start', 'tool.end'], (event) => {
  timeline.push({
    timestamp: event.timestamp,
    type: event.type,
    tool: event.data.toolName
  });
});
```

## Conclusion

The EventBus architecture provides a clean, scalable way to handle streaming updates throughout the Nxtscape agent framework. By following these guidelines and best practices, you can create maintainable, debuggable code that integrates seamlessly with the rest of the system.

For implementation examples, see:
- `/src/lib/events/EventBus.ts` - Core EventBus implementation
- `/src/lib/events/UIEventHandler.ts` - UI event bridge
- `/src/lib/agent/streaming/StreamEventProcessor.ts` - LangChain event processing
- `/src/background/index.ts` - Background script integration