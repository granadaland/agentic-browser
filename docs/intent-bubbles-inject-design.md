# Intent Bubbles Injection Design

## Overview

This document outlines the design for injecting intent prediction bubbles directly into web pages. These bubbles will display AI-predicted user intents at the bottom center of web pages, allowing users to quickly access the Nxtscape agent's functionality without manually opening the side panel.

## Context

### What We're Building

The Nxtscape Agent is a Chrome extension that provides AI-powered web automation through natural language commands. Currently, users must:
1. Open the side panel manually (via Cmd+E or clicking the extension)
2. Type their intent/command
3. Execute the task

With intent predictions, we're adding a proactive layer that:
- Predicts what users might want to do based on their browsing context
- Displays these predictions as clickable bubbles on the page
- Allows one-click access to execute predicted intents

### Current Architecture Insights

From analyzing the codebase, here's what I've learned:

#### 1. **Intent Prediction System**
- **Trigger**: Runs when tab history ≥ 3 pages (recently changed from ≤ 3)
- **Delay**: Immediate execution (0ms delay)
- **Storage**: Predictions stored in `chrome.storage.session` with key `intent_${tabId}`
- **Broadcast**: Sent to side panel via `INTENT_PREDICTION_UPDATED` message

#### 2. **Content Script Injection Pattern**
```typescript
// From background/index.ts
async function injectBuildDomTree(tabId: number): Promise<void> {
  await chrome.scripting.executeScript({
    target: { tabId },
    files: ['buildDomTree.js'],
  })
}
```

The extension already injects scripts in two ways:
- **Manifest injection**: `content.js` and `buildDomTree.js` via `content_scripts`
- **Dynamic injection**: Additional scripts via `chrome.scripting.executeScript`

#### 3. **Messaging Architecture**
- Uses `chrome.runtime.onMessage` for content ↔ background communication
- Port-based messaging for side panel ↔ background
- Structured message types in `MessageType` enum

#### 4. **UI Components**
- Side panel already has `IntentBubbles` React component
- Uses SCSS modules for styling
- Implements bubble click → input fill → auto-submit flow

## Design Specification

### 1. Architecture

```
┌─────────────────────────┐
│    Background Script    │
│                         │
│ - Intent predictions    │
│ - Side panel control    │
│ - Message routing       │
└───────────┬─────────────┘
            │
            │ chrome.tabs.sendMessage
            │ INTENT_BUBBLES_SHOW
            ▼
┌─────────────────────────┐
│    Content Script       │
│   (content/index.ts)    │
│                         │
│ - Message handling      │
│ - Bubble injection      │
└───────────┬─────────────┘
            │
            │ Creates & manages
            ▼
┌─────────────────────────┐
│   Intent Bubbles UI     │
│   (Shadow DOM)          │
│                         │
│ - Fixed positioning     │
│ - Click handling        │
│ - Style isolation       │
└─────────────────────────┘
```

### 2. Implementation Components

#### A. **Message Types Extension**

```typescript
// Add to MessageType enum in lib/types/messaging.ts
export enum MessageType {
  // ... existing types
  INTENT_BUBBLES_SHOW = 'INTENT_BUBBLES_SHOW',
  INTENT_BUBBLE_CLICKED = 'INTENT_BUBBLE_CLICKED',
  INTENT_BUBBLES_HIDE = 'INTENT_BUBBLES_HIDE'
}

// New message schemas
export const IntentBubblesShowMessageSchema = MessageSchema.extend({
  type: z.literal(MessageType.INTENT_BUBBLES_SHOW),
  payload: z.object({
    intents: z.array(z.string()),
    confidence: z.number().optional(),
    tabId: z.number()
  })
})

export const IntentBubbleClickedMessageSchema = MessageSchema.extend({
  type: z.literal(MessageType.INTENT_BUBBLE_CLICKED),
  payload: z.object({
    intent: z.string(),
    tabId: z.number()
  })
})
```

#### B. **Intent Bubbles UI Class**

```typescript
// New file: src/content/IntentBubblesUI.ts
class IntentBubblesUI {
  private shadowRoot: ShadowRoot;
  private container: HTMLElement;
  private bubbles: Map<string, HTMLElement>;
  
  constructor() {
    this.createShadowContainer();
    this.injectStyles();
    this.setupEventListeners();
  }
  
  showBubbles(intents: string[]) {
    // Create and display bubbles
  }
  
  hideBubbles() {
    // Fade out and remove bubbles
  }
  
  private handleBubbleClick(intent: string) {
    // Send message to background
    chrome.runtime.sendMessage({
      type: MessageType.INTENT_BUBBLE_CLICKED,
      payload: { intent, tabId: /* current tab id */ }
    });
    this.hideBubbles();
  }
}
```

#### C. **Styling Approach**

```css
/* Inside Shadow DOM */
.intent-bubbles-container {
  position: fixed;
  bottom: 20px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 999999;
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
  max-width: 600px;
  pointer-events: none; /* Allow clicks through container */
}

.intent-bubble {
  background: #4A90E2;
  color: white;
  padding: 10px 20px;
  border-radius: 20px;
  font-size: 14px;
  cursor: pointer;
  pointer-events: auto; /* Enable clicks on bubbles */
  box-shadow: 0 2px 8px rgba(0,0,0,0.15);
  transition: all 0.3s ease;
  animation: slideUp 0.4s ease-out;
}

.intent-bubble:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0,0,0,0.2);
}

@keyframes slideUp {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
```

### 3. Communication Flow

1. **Background → Content**: When predictions are generated
   ```typescript
   // In background/index.ts
   function sendIntentBubblesToTab(tabId: number, intents: string[]) {
     chrome.tabs.sendMessage(tabId, {
       type: MessageType.INTENT_BUBBLES_SHOW,
       payload: { intents, tabId }
     });
   }
   ```

2. **Content → Background**: When bubble is clicked
   ```typescript
   // In content/index.ts
   chrome.runtime.sendMessage({
     type: MessageType.INTENT_BUBBLE_CLICKED,
     payload: { intent, tabId }
   });
   ```

3. **Background → Side Panel**: Open panel with intent
   ```typescript
   // In background/index.ts
   async function handleBubbleClick(intent: string, tabId: number) {
     // Open side panel
     await chrome.sidePanel.open({ tabId });
     
     // Send intent to side panel
     setTimeout(() => {
       broadcastToSidePanel({
         type: MessageType.INTENT_BUBBLE_CLICKED,
         payload: { intent }
       });
     }, 100); // Small delay to ensure panel is ready
   }
   ```

### 4. Lifecycle Management

#### Bubble Display Rules:
- Show when predictions are received
- Hide after 30 seconds of no interaction
- Hide when user navigates away
- Hide when bubble is clicked
- Hide when side panel opens (to avoid duplication)

#### Cleanup:
- Remove event listeners on page unload
- Clear bubbles on navigation
- Properly destroy Shadow DOM elements

### 5. Security Considerations

1. **Shadow DOM Isolation**: Prevents style/script conflicts with host page
2. **Content Security Policy**: Inline styles within Shadow DOM to avoid CSP issues
3. **Event Sanitization**: Validate all messages between contexts
4. **Z-index Management**: High but not infinite to avoid breaking overlays

### 6. Performance Optimizations

1. **Lazy Initialization**: Only create UI when first predictions arrive
2. **Debouncing**: Don't update bubbles more than once per 5 seconds
3. **Efficient Rendering**: Reuse bubble elements when possible
4. **Memory Management**: Clean up references to prevent leaks

### 7. User Experience Details

#### Visual Design:
- Maximum 3 bubbles shown horizontally
- Subtle entrance animation (slide up + fade in)
- Hover effects for better interactivity
- Semi-transparent background for better visibility
- Responsive sizing on smaller viewports

#### Interaction Flow:
1. Bubbles appear 1 second after page settles
2. Click bubble → immediate visual feedback
3. Side panel opens with smooth transition
4. Intent text pre-filled in input
5. Auto-submit after 200ms (matching existing behavior)

### 8. Edge Cases & Error Handling

1. **Multiple Tabs**: Each tab maintains its own bubble state
2. **Rapid Navigation**: Cancel pending predictions on navigation
3. **Side Panel Already Open**: Just fill input, don't re-open
4. **Invalid Predictions**: Filter out empty/null intents
5. **Cross-Origin Iframes**: Bubbles only show in main frame

### 9. Testing Strategy

1. **Unit Tests**: Test message handling, UI creation
2. **Integration Tests**: Test full flow from prediction to execution
3. **Visual Tests**: Ensure bubbles appear correctly on various sites
4. **Performance Tests**: Measure impact on page load time

### 10. Future Enhancements

1. **Persistence**: Remember dismissed intents per domain
2. **Customization**: Allow users to disable/configure bubbles
3. **Analytics**: Track which predictions are clicked
4. **Smart Positioning**: Avoid covering important page elements
5. **Contextual Icons**: Add relevant icons to each intent

## Implementation Checklist

- [ ] Extend MessageType enum with new types
- [ ] Create IntentBubblesUI class
- [ ] Update content script message handling
- [ ] Modify background script to send predictions
- [ ] Add bubble click handling in background
- [ ] Update side panel to receive intent messages
- [ ] Add cleanup logic for navigation events
- [ ] Test on various websites
- [ ] Add user preference for enabling/disabling bubbles
- [ ] Document the feature in user guide

## Notes

- This design leverages existing patterns from the codebase
- Shadow DOM ensures zero interference with host pages
- Message passing follows established conventions
- UI/UX matches the existing side panel bubble design