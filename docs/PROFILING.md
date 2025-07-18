# Simple Performance Profiling

This extension uses a simple performance profiling system that's only active in development mode.

## How It Works

- Profiling is **automatically enabled** when `DEV_MODE` is true (i.e., when `NODE_ENV !== 'production'`)
- Uses native `performance.mark()` and `performance.measure()` APIs
- Logs timing information to console with color coding:
  - 🟢 Green = Fast (<500ms)
  - 🟡 Yellow = Medium (500-1000ms)
  - 🔴 Red = Slow (>1000ms)
- Zero overhead in production builds

## What Gets Profiled

The following components are automatically profiled:

1. **Agents** - Each agent's `invoke()` method
   - Profile label: `Agent.{AgentName}` (e.g., `Agent.ProductivityAgent`)

2. **Tools** - Each tool's execution
   - Profile label: `Tool.{ToolName}` (e.g., `Tool.search_text`)

3. **Orchestrator** - Main orchestration flow
   - Profile label: `Orchestrator.execute`

## Viewing Performance Data

### Console Output (Automatic)

When you use the extension in development mode, you'll see timing logs in the console:
```
⏱️ [START] Agent.ProductivityAgent
🟢 [END] Tool.search_text: 234.56ms
🟡 [END] Agent.ProductivityAgent: 567.89ms
🔴 [END] Orchestrator.execute: 1234.56ms
```

### Performance Report

To see a summary of all performance measures:

```javascript
// Using the profiler namespace (recommended)
profiler.report()

// Or using the direct function
__profileReport()
```

This will display:
```
📊 Performance Report:
==================================================
🔴 Orchestrator.execute        1234.56ms
🟡 Agent.ProductivityAgent     567.89ms
🟢 Tool.search_text           234.56ms
==================================================
Total measures: 3
```

### Raw Performance Data

To get the raw performance entries:
```javascript
// Using the profiler namespace
profiler.measures()

// Or direct functions
__profileMeasures()

// Or using the Performance API directly
performance.getEntriesByType('measure')
```

### Manual Profiling from Console

You can also manually profile code from the console:
```javascript
// Start a custom profile
profiler.start('MyCustomOperation')

// ... do something ...

// End the profile
profiler.end('MyCustomOperation')
```

### Performance Tab

1. Open Chrome DevTools (F12)
2. Go to **Performance** tab
3. Look for "User Timing" section
4. You'll see all the performance marks and measures

## Manual Profiling

If you want to add profiling to additional methods:

```typescript
import { profileStart, profileEnd } from '@/lib/utils/Profiler';

// For async methods
async myMethod() {
  profileStart('MyComponent.myMethod');
  try {
    // ... your code
  } finally {
    profileEnd('MyComponent.myMethod');
  }
}

// Or use the decorator
import { profile } from '@/lib/utils/Profiler';

class MyClass {
  @profile()
  async myMethod() {
    // ... your code
  }
}
```

## Global Access in Console

When in development mode, the profiler is available globally:

```javascript
// As individual functions
globalThis.__profileStart('MyOperation')
globalThis.__profileEnd('MyOperation')
globalThis.__profileReport()
globalThis.__profileMeasures()

// Or via the profiler namespace (cleaner)
globalThis.profiler.start('MyOperation')
globalThis.profiler.end('MyOperation')
globalThis.profiler.report()
globalThis.profiler.measures()
```

## Notes

- Profiles are only created in development mode
- No performance impact in production
- Profile labels follow the pattern: `Component.method`
- Uses `performance.mark()` and `performance.measure()` APIs which work in all Chrome extension contexts