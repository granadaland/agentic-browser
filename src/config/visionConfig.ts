/**
 * Vision System Configuration
 * 
 * This file contains configuration constants for the vision and highlights system.
 * Modify these values to enable/disable vision for specific agents and tools.
 */

/**
 * Global vision configuration
 */
export const VISION_CONFIG = {
  /**
   * Enable vision for ValidatorAgent
   * When true, validator will receive screenshots with highlighted elements
   * to better understand page state and validate task completion
   */
  VALIDATOR_AGENT_USE_VISION: true,

  /**
   * Enable vision for InteractionTool
   * When true, elements will be highlighted before clicking
   * Useful for debugging and visual verification
   */
  INTERACTION_TOOL_USE_VISION: true,

  /**
   * Enable vision for specific tools in ValidatorAgent
   */
  VALIDATOR_TOOL_USE_VISION: true,

  /**
   * Default vision setting for other agents
   * Currently disabled for performance
   */
  DEFAULT_USE_VISION: true,

  /**
   * Display highlights configuration
   * This is separate from vision - highlights can be shown without screenshots
   */
  DISPLAY_HIGHLIGHTS: false,

  /**
   * Debug mode - enables vision for all agents
   * WARNING: This will significantly impact performance
   */
  DEBUG_VISION_FOR_ALL: true
} as const;

/**
 * Helper function to determine if vision should be used for a specific agent
 * @param agentName - Name of the agent
 * @returns Whether vision should be enabled
 */
export function shouldUseVision(agentName: string): boolean {
  // Debug mode overrides all settings
  if (VISION_CONFIG.DEBUG_VISION_FOR_ALL) {
    return true;
  }

  // Check specific agent configurations
  switch (agentName) {
    case 'ValidatorAgent':
      return VISION_CONFIG.VALIDATOR_AGENT_USE_VISION;
    case 'InteractionTool':
      return VISION_CONFIG.INTERACTION_TOOL_USE_VISION;
    default:
      return VISION_CONFIG.DEFAULT_USE_VISION;
  }
}

/**
 * Vision performance settings
 */
export const VISION_PERFORMANCE = {
  /**
   * Screenshot quality (0-100)
   * Lower values reduce file size but may impact visual clarity
   */
  SCREENSHOT_QUALITY: 80,

  /**
   * Maximum screenshot width
   * Images larger than this will be scaled down
   */
  MAX_SCREENSHOT_WIDTH: 1920,

  /**
   * Timeout for screenshot capture (ms)
   */
  SCREENSHOT_TIMEOUT: 5000,

  /**
   * Cache screenshots for repeated views
   */
  ENABLE_SCREENSHOT_CACHE: false,

  /**
   * Cache duration in milliseconds
   */
  SCREENSHOT_CACHE_TTL: 60000 // 1 minute
} as const;
