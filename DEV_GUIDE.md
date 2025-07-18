# Developer Guide

This guide collects day-to-day recipes and reference commands for contributors working on the Nxtscape browser-agent monorepo.

---

## Project bootstrap

```bash
# Install all dependencies
yarn

# Start webpack in watch-mode for local development
yarn dev

# Run the full Jest test-suite
yarn test

# Check linting errors
yarn lint
```

---

## BAML workflow 🛠️

The codebase uses **BAML** to describe LLM prompts and automatically generate a type-safe client. All BAML-related files live under `src/baml_src` and the generated SDK is placed in `src/baml_client`.

### Initialise a BAML project

Run the following once when bootstrapping or after cloning the repository:

```bash
npx baml-cli init --dest ./src/
```

• Creates `src/baml_src` with example `.baml` specs.  
• Adds starter configuration files suited for TypeScript projects.

### Regenerate the client

Whenever you modify or add a `.baml` file, regenerate the SDK:

```bash
npx baml-cli generate --from ./src/baml_src/
```

• Scans every `.baml` spec under `src/baml_src`.  
• Produces an up-to-date, fully-typed client in `src/baml_client`.  
• Use `--no-version-check` to skip the online version check when offline.

> Note: The generated code is committed to the repository so CI and external consumers do **not** need BAML installed.

#### Typical dev loop

1. Edit or create a `.baml` spec inside `src/baml_src`.
2. Run the `generate` command shown above (consider aliasing it in a local script).
3. Import the generated function:

```ts
import { MyPrompt } from '@/baml_client'
```

4. Call the prompt as you would any other function and enjoy end-to-end type safety!

---

## Useful NPM scripts

| Script | Purpose |
| ------ | ------- |
| `yarn dev` | Run webpack in watch-mode |
| `yarn build` | Production build |
| `yarn test` | Execute Jest test-suite |
| `yarn test:watch` | Re-run tests on file changes |
| `yarn lint` | Lint the entire codebase |

---

## Coding conventions

The project follows the rules in `.cursorrules` and the extended "Custom Instructions" section at the root of the repository. That document covers formatting, naming, accessibility, state management and more.

Always run `yarn lint` (or enable your editor ESLint integration) before committing.

---

## Troubleshooting

• **BAML version mismatch** – pass `--no-version-check` to `baml-cli generate` or bump `@boundaryml/baml` in `package.json`.  
• **Types out of sync** – run the generate command; if the problem persists, clean the `src/baml_client` folder and regenerate.

---

Happy hacking! 🧑‍💻

# Development Guide

## VS Code Debugging Setup

This project includes a comprehensive debugging setup for Chrome extension development. You can set breakpoints in any TypeScript file and debug the extension running in Chrome.

### Quick Start

1. **Open VS Code** in the project directory
2. **Set a breakpoint** in any file (e.g., `src/background/index.ts` line 45)
3. **Press F5** or select "🚀 Debug Extension (One-Click)" from the debug dropdown
4. **Wait for build** - VS Code will automatically build the extension first
5. **Chrome launches** with the extension loaded
6. **Trigger your breakpoint** - interact with the extension to hit the breakpoint

### Debugging Different Contexts

Chrome extensions run in multiple contexts. After launching the main debug configuration, you can debug different parts:

#### Background Script (Service Worker)
- **File**: `src/background/index.ts`
- **Debug Config**: "Debug Background Script (Service Worker)"
- **Triggers**: Extension initialization, message handling, tab events

```typescript
// Example: Set breakpoint in src/background/index.ts
function handlePortMessage(message: PortMessage, port: chrome.runtime.Port): void {
  debugger; // Or set breakpoint here
  const { type, payload, id } = message
  // Your breakpoint will hit when messages are received
}
```

#### Options Page
- **Files**: `src/options/Options.tsx`, `src/options/components/*`
- **Debug Config**: "Debug Extension Pages (Options)"
- **Triggers**: Opening options page, clicking buttons, form submissions

```typescript
// Example: Set breakpoint in src/options/Options.tsx
const handleSubmit = async (e: React.FormEvent): Promise<void> => {
  debugger; // Or set breakpoint here
  e.preventDefault()
  // Your breakpoint will hit when submitting tasks
}
```

#### Content Scripts
- **Files**: `src/content/index.ts`
- **Debug Config**: "Debug Content Scripts (Web Pages)"
- **Triggers**: Loading web pages, DOM interactions

#### Browser Automation
- **Files**: `src/lib/langchainbrowser/NxtscapeBrowserContext.ts`, `src/lib/langchainbrowser/NxtscapePage.ts`
- **Debug Config**: "Debug Background Script (Service Worker)"
- **Triggers**: Running examples, browser automation tasks

```typescript
// Example: Debug puppeteer-core initialization
async function initializeBrowser() {
  LogUtility.log('NxtscapeBrowserContext', 'DEV_MODE detected, enabling verbose logging');
  LogUtility.log('NxtscapeBrowserContext', 'Initializing puppeteer-core connection');
  
  try {
    const browser = await connect({
      transport: await ExtensionTransport.connectTab(tabId),
      defaultViewport: null,
      protocol: 'cdp'
    });
    LogUtility.log('NxtscapeBrowserContext', `Successfully connected to tab ${tabId}`);
  } catch (error) {
    LogUtility.log('NxtscapeBrowserContext', `Connection failed: ${error}`, 'error');
  }
}
```

### Common Debugging Scenarios

#### 1. Debug Task Execution
```typescript
// src/background/index.ts - handleExecuteQueryPort()
async function handleExecuteQueryPort(payload: { query: string }, port: chrome.runtime.Port, id?: string) {
  debugger; // Breakpoint 1: When task starts
  const { query } = payload
  
  // Execute the query directly with NxtScape
  await nxtScape.initialize()
  debugger; // Breakpoint 2: After NxtScape initialization
  const result = await nxtScape.run(query)
  debugger; // Breakpoint 3: After task completion
}
```

#### 2. Debug UI Interactions
```typescript
// src/options/Options.tsx - handleRunExample()
const handleRunExample = async (): Promise<void> => {
  debugger; // Breakpoint: When "Run Example" is clicked
  try {
    setIsSubmitting(true)
    startExecution()
    // ... rest of function
  }
}
```

#### 3. Debug Log Routing
```typescript
// src/lib/utilities/LogUtility.ts - log()
public static log(source: string, message: string, level: LogLevel = 'info'): void {
  debugger; // Breakpoint: Every log message passes through here
  // See how logs are routed to options page
}
```

### Debugging Tips

1. **Source Maps**: Breakpoints work in original TypeScript files, not the bundled JavaScript
2. **Multiple Contexts**: You may need multiple debug sessions for different extension parts
3. **Console Access**: Use browser dev tools console for additional debugging
4. **Network Tab**: Check network requests in Chrome dev tools
5. **Extension Pages**: Right-click extension pages → "Inspect" for dev tools

### Troubleshooting

#### Breakpoints Not Hitting
1. **Check source maps**: Make sure `npm run build:dev` generated `.map` files
2. **Verify paths**: Source map paths in launch.json should match webpack output
3. **Chrome restart**: Sometimes Chrome needs restart for debugging changes

#### Build Errors
1. **Clean build**: Run `npm run clean && npm run build:dev`
2. **Dependencies**: Run `npm install` if packages are missing
3. **TypeScript errors**: Fix any TS errors before debugging

#### Chrome Issues
1. **Port 9222**: Make sure no other Chrome instance is using port 9222
2. **Extension reload**: Reload extension in `chrome://extensions/` after code changes
3. **Profile conflicts**: Delete `.chrome-debug-profile/` if debugging fails

### Development Workflow

1. **Code changes** → **F5 (debug)** → **Test in Chrome** → **Fix issues** → **Repeat**
2. **Set breakpoints** before triggering the functionality you want to debug
3. **Use multiple debug sessions** for different extension contexts
4. **Check logs** in options page for real-time debugging info (when `DEV_MODE: true`)

### Configuration Files

- **`.vscode/launch.json`**: VS Code debug configurations
- **`.vscode/tasks.json`**: Build tasks (pre-launch)
- **`webpack.config.js`**: Source map generation
- **`src/config.ts`**: DEV_MODE and logging settings 