# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

### Build Commands
- `npm run build` - Production build with webpack
- `npm run build:dev` - Development build with source maps
- `npm run build:watch` - Development build with file watching
- `npm run clean` - Remove dist directory

### Linting Commands
- `npm run lint` - Check code with eslint
- `npm run lint:fix` - Fix eslint issues automatically

### Testing Commands
- `npm run test` - Run all tests with Jest
- `npm run test:watch` - Run tests in watch mode for development
- `npm run test:coverage` - Generate code coverage report
- `npm run test:unit` - Run unit tests only (files matching *.unit.test.ts)
- `npm run test:integration` - Run integration tests only (files matching *.integration.test.ts)

## Environment Setup

### Required Environment Variables
- `LITELLM_API_KEY` - Required for LLM provider access (set in webpack.config.js)
- Create a `.env` file in the project root with your API keys

### VS Code Debugging
Launch configurations are available in `.vscode/launch.json`:
- **Extension + Dev Server**: Debug the extension with webpack dev server
- **Extension Only**: Debug the extension without dev server
- **Dev Server Only**: Run webpack dev server separately

To debug:
1. Run `npm run build:dev` or `npm run build:watch`
2. Use VS Code's Run and Debug panel (Cmd/Ctrl+Shift+D)
3. Select appropriate launch configuration
4. Chrome will open with the extension loaded in debug mode

## Architecture Overview

### Core Framework
This is a Chrome extension that provides AI-powered web automation using LLM agents. The architecture is built around:

1. **NxtScape Core** (`src/lib/core/NxtScape.ts`) - Main orchestration layer that coordinates ProductivityAgent execution
2. **Agent System** - LLM-powered agents that execute natural language tasks
3. **Browser Context** - Puppeteer-core integration for Chrome extension tab control
4. **Tool Registry** - Modular browser automation tools
5. **Workflow Engine** - DAG-based workflow execution system

### Key Components

#### Browser Integration
- **BrowserContext** (`src/lib/browser/BrowserContext.ts`) - Manages Chrome tab connections via puppeteer-core with multi-tab support and debugger handling
- **BrowserPage** (`src/lib/browser/BrowserPage.ts`) - Extended wrapper for puppeteer Page with enhanced DOM handling and automation capabilities
- Uses Chrome Extension APIs for tab management and debugger attachment

#### Agent Architecture
- **BaseAgent** (`src/lib/agent/BaseAgent.ts`) - Abstract base class implementing IAgent interface with LangChain integration
- **ProductivityAgent** - Primary agent for tab management and productivity tasks
- **BrowseAgent** - Specialized agent for web browsing and navigation
- **ClassificationAgent** - Routes tasks to appropriate agents based on classification
- **PlannerAgent** - Creates step-by-step plans for complex browse tasks
- **ValidatorAgent** - Validates task completion and determines retry needs
- **IntentPredictionAgent** - Predicts user intent from webpage context for proactive assistance
- **Orchestrator** (`src/lib/agent/Orchestrator.ts`) - Coordinates agent graph execution
- **AgentGraph** (`src/lib/graph/AgentGraph.ts`) - LangGraph-based workflow with classification routing
- Agents use LangChain for LLM integration (Claude/OpenAI/Ollama support)

#### Tool System
- **Tool Registry** (`src/lib/tools/base/ToolRegistry.ts`) - Centralized tool management
- **Categories**: tab operations, bookmarks, history, browser navigation, extraction, sessions, utility
- Tools implement NxtscapeTool interface with Zod schema validation
- **Browser Navigation**: InteractionTool, NavigationTool, PlannerTool, ScrollTool, SearchTool
- **Tab Management**: TabOperationsTool, GroupTabsTool, GetSelectedTabsTool
- **Bookmarks**: BookmarkManagementTool, BookmarkSearchTool, SaveBookmarkTool
- **Utility**: AnswerTool, DoneTool, TerminateTool, WaitTool

### UI Components
- **Side Panel** (`src/sidepanel/`) - Chrome side panel integration with React
- **Components**: AgentStreamDisplay, MarkdownContent, TabSelector, StreamingMessageDisplay
- **Hooks**: useSidePanelPortMessaging, useSidePanelState
- **Store**: Zustand-based state management (appStore, tabsStore)
- Real-time streaming display for agent execution with SCSS modules

### LLM Integration
- **LangChainProviderFactory** (`src/lib/llm/LangChainProviderFactory.ts`) - Abstraction over multiple LLM providers
- **Provider Strategies**: AnthropicStrategy, OpenAIStrategy, OllamaStrategy, NxtscapeStrategy
- **LLM Settings**: LLMSettingsReader for configuration management
- **Supported Providers**: Claude (Anthropic), OpenAI, Ollama
- **LangChain Integration** - Uses @langchain packages for agent execution
- **Streaming Support** - Real-time response streaming with StreamProcessor

## Development Guidelines

### Code Style
- Follow windurfurrules.txt for TypeScript/React conventions
- Use Zod schemas instead of plain TypeScript interfaces
- PascalCase for components, camelCase for functions/variables
- SCSS modules for component styling

### Agent Development
- Extend BaseAgent interface
- Implement execute method with proper error handling
- Use StreamingCallbacks for progress updates
- Register agents in WorkflowEngine agent registry

### Tool Development
- Extend NxtscapeTool base class
- Define Zod schema for tool parameters
- Implement execute method returning tool results
- Register in appropriate tool category index

### Browser Context Usage
- Always use BrowserContext for tab operations
- Handle debugger conflicts and tab cleanup properly
- Use anti-detection scripts for automation
- Implement proper error handling for tab attachment failures
- Support multi-tab operations and user-selected tab contexts

### Performance Monitoring
The codebase includes built-in performance monitoring utilities for debugging and optimization:

#### PerformanceProfiler (`src/lib/utils/PerformanceProfiler.ts`)
- Comprehensive profiling with color-coded console output (🟢 <500ms, 🟡 500-1000ms, 🔴 >1000ms)
- Chrome DevTools integration with Performance API marks/measures
- Chrome tracing support viewable at `chrome://tracing`
- Multiple usage patterns: manual start/end, async wrapper, method decorator
- Automatically disabled in production

```typescript
// Manual profiling
PerformanceProfiler.start('operation');
// ... code to profile
PerformanceProfiler.end('operation');

// Async function profiling
await PerformanceProfiler.profile('fetch-data', async () => {
  return await fetchData();
});

// Method decorator
@PerformanceProfiler.profileMethod()
async processData() { }
```

#### TraceDecorator (`src/lib/utils/TraceDecorator.ts`)
- Lightweight method-level tracing with `@trace` decorator
- Exports Perfetto-compatible traces for visualization
- Already integrated in BaseAgent, ProductivityAgent, and BrowseAgent
- Access trace data via `window.__traceCollector.getTraces()`

```typescript
class MyAgent {
  @trace
  async executeAgent() {
    // Method execution is automatically traced
  }
}
```

### Testing Guidelines
- Place test files next to source files with `.test.ts` or `.spec.ts` extension
- Use Jest with ts-jest for TypeScript support
- Mock Chrome Extension APIs as needed for unit tests
- Follow AAA pattern: Arrange, Act, Assert
- Use descriptive test names that explain the expected behavior
- Group related tests using `describe` blocks
- Test file structure mirrors source file structure

## Key Files Reference

- `src/lib/core/NxtScape.ts` - Main orchestration class
- `src/lib/agent/BaseAgent.ts` - Abstract base class for all agents
- `src/lib/agent/Orchestrator.ts` - Agent graph execution coordinator
- `src/lib/graph/AgentGraph.ts` - LangGraph workflow with classification routing
- `src/lib/browser/BrowserContext.ts` - Multi-tab browser management with puppeteer-core
- `src/lib/tools/base/ToolRegistry.ts` - Tool management system
- `src/lib/llm/LangChainProviderFactory.ts` - LLM provider abstraction
- `src/lib/runtime/ExecutionContext.ts` - Runtime state and context management
- `src/lib/runtime/MessageManager.ts` - Conversation history management
- `manifest.json` - Chrome extension configuration
- `webpack.config.js` - Build configuration

## Rules
#  ALWAYS FOLLOW THESE RULES.
- DO NOT automatically create or update, README.md file for changes.
- DO NOT automatically generate example file to use the code unless asked.
- DO NOT automatically generate tests for the code unless asked.
- IMPORTANT: When asked a question or given a task, ALWAYS first generate a rough plan with pseudo code or design. DO NOT make changes without asking for approval first.

# Code Style & Formatting
- Use English for all code and documentation.
- Write concise, technical TypeScript. Follow Standard.js rules.
- Always declare the type of each variable and function (parameters and return value).
- Avoid using any.
- Create necessary types.
- Keep interfaces in the same file as their components rather than in a separate types directory.
- Use JSDoc to document public classes and methods.
- For interfaces, class properties, and smaller logic use inline comments, give two spaces and "// <comment>".
- DO NOT use JSDoc-style comments (`/** ... */`) for class properties or schema definitions, use inline comments instead.
- Favor loops and small helper modules over duplicate code.
- Use descriptive names with auxiliary verbs (e.g. isLoading, hasError).
- File layout: exported component → subcomponents → hooks/helpers → static content.


# Naming Conventions
- Use PascalCase for classes.
- Use camelCase for variables, functions, and methods.
- Directories: Use kebab-case (e.g. components/auth-wizard).
- Files: Use PascalCase (e.g. UserProfile.tsx, AuthService.ts).
- Use UPPERCASE for environment variables.
- Avoid magic numbers and define constants.
- File extensions:
  - Components → .tsx
  - Hooks/Utils → .ts
  - Style modules → .module.scss
- Prefer named exports for components
- Types/Interfaces in PascalCase (e.g. User, ButtonProps)
- OUR PRODUCT NAME IS Nxtscape (the "s" is small letter) -- so use that name correctly when naming things.

# Functions & Logic
- Keep functions short and single-purpose (<20 lines).
- Avoid deeply nested blocks by:
- Using early returns.
- Extracting logic into utility functions.
- Use higher-order functions (map, filter, reduce) to simplify logic.
- Use arrow functions for simple cases (<3 instructions), named functions otherwise.
- Use default parameter values instead of null/undefined checks.
- Use RO-RO (Receive Object, Return Object) for passing and returning multiple parameters.

# Data Handling
- Avoid excessive use of primitive types; encapsulate data in composite types.
- Avoid placing validation inside functions—use classes with internal validation instead.
- Prefer immutability for data:
- Use readonly for immutable properties.
- Use as const for literals that never change.

# TypeScript & Zod
- ALWAYS define data structures using Zod schemas instead of interfaces or types.
- NEVER use plain TypeScript interfaces; always convert them to Zod schemas.
- ALWAYS use inline comments with two spaces followed by `// <comment>` next to each key in Zod schemas, NOT JSDoc-style comments (`/** ... */`).
- Use the following pattern for all data structures:
  ```ts
  // First, import Zod
  import { z } from "zod";

  // Define your schema using Zod
  export const UserSchema = z.object({
    id: z.string().uuid(),  // Unique identifier for the user
    name: z.string().min(2),  // User's full name
    email: z.string().email(),  // User's email address
    age: z.number().int().positive().optional(),  // User's age in years
    role: z.enum(["admin", "user", "editor"]),  // User's permission role
    metadata: z.record(z.string(), z.unknown()).optional(),  // Additional user metadata
    createdAt: z.date()  // When the user was created
  })

  // For enums, place comments on the same line as enum values
  export const StatusSchema = z.enum([
    'PENDING',  // Awaiting processing
    'ACTIVE',   // Currently active
    'INACTIVE', // No longer active
    'DELETED'   // Marked for deletion
  ])

  // Infer the TypeScript type from the Zod schema
  export type User = z.infer<typeof UserSchema>;
  ```
- Naming conventions for Zod schemas:
  - Schema variables: PascalCase with "Schema" suffix (e.g., `UserSchema`, `ConfigSchema`)
  - Inferred types: PascalCase without suffix (e.g., `type User = z.infer<typeof UserSchema>`)
- Use appropriate Zod validators to ensure runtime safety:
  - String validation: `.min()`, `.max()`, `.email()`, `.url()`, etc.
  - Number validation: `.int()`, `.positive()`, `.min()`, `.max()`, etc.
  - Object validation: `.strict()` when appropriate
- For optional properties, use `.optional()` instead of the TypeScript `?` syntax
- For nullable values, use `.nullable()` instead of TypeScript union with `null`
- For recursive types, provide a type hint:
  ```ts
  const baseCategorySchema = z.object({
    name: z.string(),
  });

  type Category = z.infer<typeof baseCategorySchema> & {
    subcategories: Category[];
  };

  const categorySchema: z.ZodType<Category> = baseCategorySchema.extend({
    subcategories: z.lazy(() => categorySchema.array()),
  });
  ```
- For discriminated unions, use `z.discriminatedUnion()` with the discriminator field
- For enums, use `z.enum()` or `z.nativeEnum()` for TypeScript enums

# Accessibility (a11y)

- Use semantic HTML.
- Apply appropriate ARIA attributes.
- Ensure full keyboard navigation.


# Error Handling & Validation
- Validate inputs and preconditions early (guard clauses).
- Place happy-path logic last.
- Provide clear, user‑friendly error messages.
- Log or report unexpected errors.

# Forms & Validation
- Use controlled inputs.
- For simple forms, write custom hooks; for complex ones, use react-hook-form with generics (e.g. <Controller>).
- Separate client‑side and server‑side validation.
- Use Zod schemas for form validation.


# Performance Optimization
- Minimize client‑only code (useEffect/useState) where unnecessary.
- Dynamically import non‑critical components.
- Optimize images (WebP, width/height, lazy-loading).
- Memoize expensive computations with useMemo.
- Wrap pure components in React.memo.
- Structure modules for effective tree‑shaking.

# React + TypeScript Best Practices
- Define props with Zod schemas, not interfaces:

```ts
// Define the props schema with Zod
const ButtonPropsSchema = z.object({
  label: z.string(),
  onClick: z.function().args().returns(z.void()).optional()
});

// Infer the type from the schema
type ButtonProps = z.infer<typeof ButtonPropsSchema>;

export function Button({ label, onClick }: ButtonProps) {
  return <button onClick={onClick}>{label}</button>
}
```

- Call hooks (useState, useEffect, etc.) only at the top level.
- Extract reusable logic into custom hooks (useAuth, useFormValidation).
- Memoize with React.memo, useCallback, useMemo where appropriate.
- Avoid inline functions in JSX—pull handlers out or wrap in useCallback.
- Favor composition (render props, children) over inheritance.
- Use React.lazy + Suspense for code splitting.
- Use refs only for direct DOM access.
- Prefer controlled components for forms.
- Implement an error boundary component.
- Clean up effects in useEffect to prevent leaks.
- Use guard clauses (early returns) for error handling.

# Standard.js Rules
- 2‑space indentation
- Single quotes (except to avoid escaping)
- No semicolons (unless disambiguation requires)
- No unused variables
- Space after keywords (if (… ))
- Space before function's (
- Always use === / !==
- Operators spaced (a + b)
- Commas followed by space
- else on same line as closing }
- Multi‑line if blocks always use { }
- Always handle error callback parameters
- camelCase for variables/functions; PascalCase for components and interfaces

# State Management (Zustand)
- Global state: Zustand
- Lift state up before introducing context.
- Use React Context for intermediate, tree‑wide sharing.

# TypeScript Configuration
- Enable "strict": true in tsconfig.json.
- Explicitly type function returns and object literals.
- Enforce noImplicitAny, strictNullChecks, strictFunctionTypes.
- Minimize use of @ts-ignore/@ts-expect-error.

# UI & Styling (SCSS Modules)
- Co‑locate a .scss file with each component.
- Leverage SCSS features:
  - Variables ($primary-color, $spacing)
  - Mixins (@mixin flexCenter)
  - Parent selector & for pseudo‑classes (&:hover)
- Partials (_variables.scss, _mixins.scss) imported in styles/index.scss
- Name classes in camelCase or BEM (.card__header).
- Keep global styles minimal (e.g. reset, typography).

## Additional Architecture Notes

### Execution Flow
1. **NxtScape.run()** - Main entry point that delegates to Orchestrator
2. **Orchestrator.execute()** - Initializes and runs AgentGraph
3. **AgentGraph** - LangGraph workflow: classify → [productivity OR (plan → browse → validate)] → complete
4. **Classification** determines routing: simple tasks go to ProductivityAgent, complex browsing goes through planning pipeline
5. **StreamProcessor** handles real-time progress updates throughout execution

### Chrome Extension Structure
- **Background Script** (`src/background/`) - Service worker handling extension lifecycle
- **Content Scripts** (`src/content/`) - Injected scripts for DOM manipulation
- **Side Panel** - Primary UI using Chrome's side panel API
- **Port Messaging** - Communication between extension contexts

### Multi-Tab Support
- BrowserContext manages multiple tab attachments via puppeteer-core
- User can select multiple tabs for collective processing
- Tab selection context automatically included in agent instructions
- Proper cleanup and debugger handling for tab lifecycle management

# important-instruction-reminders
Do what has been asked; nothing more, nothing less.
NEVER create files unless they're absolutely necessary for achieving your goal.
ALWAYS prefer editing an existing file to creating a new one.
NEVER proactively create documentation files (*.md) or README files. Only create documentation files if explicitly requested by the User.
