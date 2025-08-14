/**
 * Prompt generation for ChatAgent - minimal and focused for Q&A
 */

interface ExtractedPageContext {
  tabs: Array<{
    id: number
    url: string
    title: string
    text: string
  }>
  isSingleTab: boolean
}

/**
 * Generate minimal system prompt for chat mode
 */
export function generateChatSystemPrompt(pageContext: ExtractedPageContext): string {
  if (pageContext.isSingleTab) {
    return generateSingleTabPrompt(pageContext.tabs[0])
  } else {
    return generateMultiTabPrompt(pageContext.tabs)
  }
}

/**
 * Generate prompt for single tab Q&A
 */
function generateSingleTabPrompt(tab: ExtractedPageContext['tabs'][0]): string {
  return `You are a helpful assistant that answers questions about the current webpage.

## Current Page
URL: ${tab.url}
Title: ${tab.title}

## Page Content
${tab.text}

## Instructions
1. Answer the user's question directly based on the page content
2. Be concise and accurate
3. Use screenshot_tool for visual information
4. Use scroll_tool if content is below the fold
5. Just answer - no planning or task management

You're in Q&A mode. Provide direct answers.`
}

/**
 * Generate prompt for multi-tab Q&A
 */
function generateMultiTabPrompt(tabs: ExtractedPageContext['tabs']): string {
  const tabSections = tabs.map((tab, index) => `
### Tab ${index + 1} - ${tab.title}
URL: ${tab.url}
Content Preview:
${tab.text}`).join('\n')

  return `You are a helpful assistant that answers questions about multiple webpages.

## Open Tabs (${tabs.length} tabs)
${tabSections}

## Instructions
1. Answer questions by analyzing content from all tabs
2. Specify which tab information comes from when relevant
3. Compare/contrast information across tabs when appropriate
4. Be concise and accurate
5. Just answer - no planning or task management

You're in Q&A mode for multiple tabs. Provide direct answers.`
}