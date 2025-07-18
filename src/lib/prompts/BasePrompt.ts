import { z } from 'zod';
import { HumanMessage } from '@langchain/core/messages';
import { wrapUntrustedContent } from '@/lib/utils/MessageUtils';
import { ExecutionContext } from '@/lib/runtime/ExecutionContext';

/**
 * Base abstract class for all agent prompts.
 * Provides a structured way to build and manage complex prompts.
 */
export abstract class BasePrompt {
  /**
   * The name of the agent this prompt is for
   */
  protected abstract readonly agentName: string;

  /**
   * Tool documentation string (if any)
   */
  protected toolDocumentation: string = '';

  /**
   * Constructor
   * @param toolDocumentation - Optional tool documentation to include
   */
  constructor(toolDocumentation?: string) {
    if (toolDocumentation) {
      this.toolDocumentation = toolDocumentation;
    }
  }

  /**
   * Generate the complete prompt by combining all sections
   * @returns The complete system prompt
   */
  public abstract generate(): string;
  
  

  /**
   * Builds the user message containing the browser state
   * @param context - The agent context containing browser state and options
   * @param useVision - Legacy parameter, ignored in V2 (no vision support)
   * @returns HumanMessage with browser state information
   */
  public async buildBrowserStateUserMessage(context: ExecutionContext, useVision: boolean): Promise<HumanMessage> {
    // Get browser state (V2 doesn't support vision/screenshots)
    const browserState = await context.browserContext.getBrowserState();
    
    // Get interactive elements as pre-formatted string
    // V2 provides both clickable and typeable elements
    // Note: The numbers in brackets [11], [23] etc. are nodeIds which are sequential indices
    const clickableElements = browserState.clickableElementsString;
    const typeableElements = browserState.typeableElementsString;
    
    // Combine elements into a single display
    let rawElementsText = '';
    if (clickableElements || typeableElements) {
      const parts: string[] = [];
      if (clickableElements) {
        parts.push('Clickable elements (use the nodeId in brackets with tools):\n' + clickableElements);
      }
      if (typeableElements) {
        parts.push('Input fields (use the nodeId in brackets with tools):\n' + typeableElements);
      }
      rawElementsText = parts.join('\n\n');
    }
    
    // V2 doesn't provide scroll position info, so we simplify the format
    let formattedElementsText = '';
    if (rawElementsText !== '') {
      // Wrap untrusted content for security
      const elementsText = wrapUntrustedContent(rawElementsText);
      formattedElementsText = `[Page content]\n${elementsText}\n[End of visible content]`;
    } else {
      formattedElementsText = 'empty page';
    }

    // Add current date/time
    const timeStr = new Date().toISOString().slice(0, 16).replace('T', ' '); // Format: YYYY-MM-DD HH:mm
    const stepInfoDescription = `\nCurrent date and time: ${timeStr}`;

    // Format current tab info
    const currentTab = `{id: ${browserState.tabId}, url: ${browserState.url}, title: ${browserState.title}}`;
    
    // Format other tabs
    const otherTabs = browserState.tabs
      .filter((tab: any) => tab.id !== browserState.tabId)
      .map((tab: any) => `- {id: ${tab.id}, url: ${tab.url}, title: ${tab.title}}`);

    // Build complete state description
    const stateDescription = `
[Task history memory ends]
[Current state starts here]
The following is one-time information - if you need to remember it write it to memory:
Current tab: ${currentTab}
Other available tabs:
  ${otherTabs.join('\n  ')}
Interactive elements from the current page (numbers in [brackets] are nodeIds to use with interact/find_element tools):
${formattedElementsText}
${stepInfoDescription}
`;

    // V2 doesn't support screenshots, always return text-only message
    // TODO: add screenshot if available
    return new HumanMessage(stateDescription);
  }

  /**
   * Helper method to join sections with proper spacing
   * @param sections - Array of prompt sections
   * @returns Joined prompt string
   */
  protected joinSections(...sections: string[]): string {
    return sections
      .filter(section => section.trim().length > 0)
      .join('\n\n');
  }

  /**
   * Format a section with a header
   * @param header - Section header
   * @param content - Section content
   * @returns Formatted section
   */
  protected formatSection(header: string, content: string): string {
    return `## ${header}\n${content}`;
  }

  /**
   * Format a subsection with a header
   * @param header - Subsection header
   * @param content - Subsection content
   * @returns Formatted subsection
   */
  protected formatSubsection(header: string, content: string): string {
    return `### ${header}:\n${content}`;
  }

  /**
   * Create a bullet list from items
   * @param items - Array of items
   * @param indent - Indentation level (0 = -, 1 = •, 2 = ◦)
   * @returns Formatted bullet list
   */
  protected bulletList(items: string[], indent: number = 0): string {
    const bullets = ['-', '•', '◦'];
    const bullet = bullets[Math.min(indent, bullets.length - 1)];
    const indentStr = '  '.repeat(indent);
    
    return items
      .map(item => `${indentStr}${bullet} ${item}`)
      .join('\n');
  }

  /**
   * Create a numbered list from items
   * @param items - Array of items
   * @param startNumber - Starting number
   * @returns Formatted numbered list
   */
  protected numberedList(items: string[], startNumber: number = 1): string {
    return items
      .map((item, index) => `${startNumber + index}. ${item}`)
      .join('\n');
  }

  /**
   * Format code block
   * @param code - Code content
   * @param language - Language identifier
   * @returns Formatted code block
   */
  protected codeBlock(code: string, language: string = ''): string {
    return `\`\`\`${language}\n${code}\n\`\`\``;
  }

  /**
   * Create a divider line
   * @param char - Character to use for divider
   * @param length - Length of divider
   * @returns Divider string
   */
  protected divider(char: string = '─', length: number = 40): string {
    return char.repeat(length);
  }
} 