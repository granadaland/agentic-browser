# ParallelManus Agent

Chrome extension for automated web tasks using LLM-powered agents.

## Features

- **AI-Powered Web Agent**: Natural language commands for browser automation
- **Multiple LLM Support**: Works with OpenAI GPT and Claude models
- **Chrome Extension**: Seamless integration with your browser
- **Browser Automation**: Powered by puppeteer-core for Chrome extension integration
- **Streaming Responses**: Real-time feedback and responses
- **Tool-Based Architecture**: Modular design for extensibility
- **Real-time Logging**: Development logs appear in the options page
- **Natural Language Tools**: Click, type, navigate using natural language descriptions
- **Persistent UI**: Options page stays open unlike disappearing popups
- **Robust Connectivity**: Heartbeat system keeps connections alive during long tasks
- **Auto-Reconnection**: Automatically reconnects when port connections drop

## Development

### Debugging with VS Code

The project includes comprehensive VS Code debugging support for Chrome extensions:

#### 🚀 One-Click Debugging

1. **Set breakpoints** in any file under `src/` (background scripts, options page, etc.)
2. **Press F5** or select **"🚀 Debug Extension (One-Click)"** from the debug dropdown
3. VS Code will:
   - Build the extension in development mode with source maps
   - Launch Chrome with the extension loaded
   - Enable debugging for all extension contexts

#### Debugging Different Contexts

After launching the main debug configuration, you can attach to specific contexts:

- **Background Script**: Use "Debug Background Script (Service Worker)" 
- **Options Pages**: Use "Debug Extension Pages (Options)"
- **Content Scripts**: Use "Debug Content Scripts (Web Pages)"

#### Setup Requirements

- Make sure Chrome is installed at `/Applications/Google Chrome.app/Contents/MacOS/Google Chrome`
- The debug profile will be created at `.chrome-debug-profile/` (ignored by git)
- Port 9222 will be used for remote debugging

### Building

```bash
# Production build
npm run build

# Development build (with source maps)
npm run build:dev

# Development build with file watching
npm run build:watch
```

### Project Structure

```
src/
├── background/          # Service worker (background script)
├── options/            # Options page (main UI)
├── content/            # Content scripts
├── lib/                # Shared libraries
│   ├── browser/        # Browser automation (puppeteer-core)
│   ├── agent/          # LLM agents
│   ├── tools/          # Browser automation tools
│   └── utilities/      # Utilities (LogUtility, etc.)
└── config.ts           # Global configuration (DEV_MODE, etc.)
```

### Configuration

Key settings in `src/config.ts`:

```typescript
export const config = {
  DEV_MODE: true,     // Shows logs in options page
  VERSION: '0.1.0',
  LOG_LEVEL: 'info'
}
```

## Usage

1. **Install Extension**: Load `dist/` directory in Chrome extensions
2. **Open Control Panel**: Click extension icon to open options page
3. **Run Tasks**: Enter natural language tasks or click "Run Example"
4. **View Logs**: Development logs appear in real-time (when DEV_MODE: true)

## Architecture

- **Port Messaging**: Uses `OPTIONS_TO_BACKGROUND` for UI ↔ Background communication
- **Centralized Logging**: `LogUtility` routes logs to options page when DEV_MODE enabled
- **Browser Context**: `NxtscapeBrowserContext` manages puppeteer-core connections
- **Agent System**: Specialized agents for different automation tasks

## License

MIT
