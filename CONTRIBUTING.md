
## Development

### Getting Started

This project uses Yarn as the package manager. Make sure you have it installed before starting.

```bash
# Install dependencies
yarn install

# Start development build with hot reload
yarn dev:watch
```

### Debugging with VS Code

The project includes VS Code debugging support for Chrome extensions:

#### 🚀 One-Click Debugging

1. **Set breakpoints** in any file under `src/` (background scripts, sidepanel, content scripts, etc.)
2. **Press F5** or select **"🚀 Debug Extension (One-Click)"** from the debug dropdown

#### Debugging Different Contexts

After launching the main debug configuration, you can attach to specific contexts:

- **Background Script**: Use "Debug Background Script (Service Worker)" 
- **Side Panel**: Use "Debug Extension Pages (Side Panel)"
- **Content Scripts**: Use "Debug Content Scripts (Web Pages)"

#### Setup Requirements

- Make sure Chrome is installed at `/Applications/Google Chrome.app/Contents/MacOS/Google Chrome`
- The debug profile will be created at `.chrome-debug-profile/` (ignored by git)
- Port 9222 will be used for remote debugging

### Building

```bash
# Production build
yarn build

# Chrome-specific production build
yarn build:chrome

# Development build (with source maps)
yarn build:dev

# Development build with file watching
yarn dev:watch
```

### Project Structure

```
src/
├── background/         # Service worker (background script)
├── sidepanel/          # Side panel UI (React app)
│   ├── components/     # React components
│   ├── hooks/          # Custom React hooks
│   ├── pages/          # Page components
│   ├── store/          # Zustand state management
│   └── styles/         # SCSS modules
├── content/            # Content scripts
├── config/             # Configuration files
│   └── visionConfig.ts # Vision-related settings
├── lib/                # Core libraries
│   ├── agent/          # LangChain agents (Answer, Browse, etc.)
│   ├── browser/        # Browser automation (puppeteer-core)
│   ├── core/           # Core Nxtscape functionality
│   ├── events/         # Event bus and streaming
│   ├── graph/          # Agent graph implementation
│   ├── llm/            # LLM provider factories
│   ├── orchestrators/  # Agent orchestration
│   ├── prompts/        # Agent prompts
│   ├── runtime/        # Execution context and errors
│   ├── tools/          # Browser automation tools
│   ├── types/          # TypeScript type definitions
│   └── utils/          # Utility functions
├── types/              # Global TypeScript declarations
└── config.ts           # Main configuration file
```

### Configuration

The main config file at `src/config.ts` controls global settings. You can also configure LLM providers and other settings through the extension's side panel.

## Usage

1. **Install Extension**: Load the `dist/` directory as an unpacked extension in Chrome
2. **Open Side Panel**: Click the extension icon to open the side panel
3. **Configure LLM**: Set up your preferred LLM provider (OpenAI, Anthropic, etc.)
4. **Start Using**: The agent will help you browse and interact with web pages

## Architecture

- **LangChain Integration**: Uses LangChain and LangGraph for agent orchestration
- **Port Messaging**: Communication between background script, content scripts, and side panel
- **Event Bus**: Streaming events and updates between components
- **Modular Tools**: Each browser action is a separate tool that agents can use

## Testing

```bash
# Run linting
yarn lint

# Fix linting issues
yarn lint:fix
```

## License

AGPL-v3.0