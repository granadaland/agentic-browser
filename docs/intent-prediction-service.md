# Intent Prediction Service (v1.0)

> High-level, implementation-ready design – minimal fluff, maximal clarity.

## 1. Goal
Predict 1-3 high-level actions the user is *likely* to take on the **current page** and surface them as actionable chips in the Nxtscape side-panel.

## 2. Why a New, Lightweight Method?
- Playwright-based `AnswerUtils` pulls full accessibility trees – **heavy** (>KBs) & only available in Node runtime.
- Background script runs **inside Chrome extension**, must use `chrome.scripting` and stay fast (<50 ms) on *every* page load.
- For intent prediction we only need **semantic hints** (title, headings, buttons, aria-labels) → small snapshot (<<1 KB) is enough and cheaper for the LLM.

## 3. Architecture Overview (Push Model)
1. **Tab Tracker (background)** – records last N URLs (bounded queue).
2. **Accessible Snapshot (content)** – quick DOM query returning JSON with:
   - `title`
   - first `h1-h3` texts
   - up to 30 button / link texts
   - all `aria-label` values
   - landmark tags (`nav`, `main`, …)
3. **IntentPredictionTool (agent)** – LLM call that consumes `{tabHistory, accessibility}` → returns `string[]` of intents.
4. **Storage & Broadcast** – prediction cached in `chrome.storage.session` and broadcast via `INTENT_PREDICTION_UPDATED` port message.
5. **Side-Panel UI** – shows intent chips; clicking sends synthetic user prompt.

## 4. Detailed Data Flow
```
Tab load ➜ onUpdated(complete)
         ➜ push {url,title,time} → tabHistory
         ➜ debounce runIntentPrediction(tabId)
               ↳ getAccessibleSnapshot(tabId)
               ↳ IntentPredictionTool.predict({tabHistory[-5], snapshot})
               ↳ cache & broadcast(INTENT_PREDICTION_UPDATED)
Side-panel  ↳ receives message → store.predictedIntents → <IntentBubbles>
User click  ↳ EXECUTE_QUERY("<intent>") → normal agent workflow
```

## 5. Key Components & File Map
| Concern | File | Notes |
|---------|------|-------|
|Tab/URL history|`src/background/index.ts`|`tabHistory` (25 max) + listeners|
|Snapshot helper|`src/lib/browser/DOMService.ts`|`getAccessibleSnapshot(tabId)` (DOM queries)|
|Prediction tool|`src/lib/tools/intent-prediction/IntentPredictionTool.ts`|Implements `NxtscapeTool`|
|UI store|`src/sidepanel/store/tabsStore.ts`|`predictedIntents:string[]`|
|Chips component|`src/sidepanel/components/IntentBubbles.tsx`|simple buttons|
|Side-panel hook|`sidepanel/hooks/useSidePanelPortMessaging.ts`|handle new message|

## 6. Reasoning Highlights
- **Performance:** small DOM snapshot keeps background CPU + token cost low.
- **Decoupling:** LLM call encapsulated in a Tool – reusable & swap-able for local model later.
- **Resilience:** predictions stored per-tab → survive panel reloads; broadcast ensures real-time UI.

## 7. Missing High-Level Features

### 7.1 Navigation Context Manager
- **Per-tab history stacks**: Maintain separate navigation history for each tab (max 5 entries)
- **Dwell time tracking**: Record time spent on each page for better intent weighting

### 7.2 Enhanced DOM Snapshot Service
- **Viewport-aware extraction**: Prioritize above-fold content
- **Semantic element detection**: Identify reviews, prices, comments sections
- **Form state capture**: Include form field types and placeholders

### 7.3 Intent Prediction Orchestrator
- **Debounced execution**: 2s delay after navigation to allow page to stabilize


### 7.8 Privacy & Security
- **PII filtering**: Remove sensitive data from snapshots

## 8. Implementation Roadmap (Step by Step)

### Phase 1: Core Infrastructure (Week 1)
1. **Navigation History Tracking**
   - [ ] Extend `background/index.ts` with `tabHistory` Map structure
   - [ ] Implement `onUpdated` listener for navigation tracking
   - [ ] Add history pruning logic (max 5 entries per tab)
   - [ ] Create `MessageType.GET_TAB_HISTORY` handler

2. **DOM Snapshot Service**
   - [ ] Create `getAccessibleSnapshot()` in `DOMService.ts`
   - [ ] Implement lightweight DOM extraction (title, headings, buttons)

3. **Basic Intent Prediction Tool**
   - [ ] Create `IntentPredictionTool.ts` extending `NxtscapeTool`
   - [ ] Implement basic prompt template with few-shot examples
   - [ ] Add tool registration in `tools/index.ts`

### Phase 2: Background Orchestration (Week 2)
4. **Prediction Orchestrator**
   - [ ] Implement debounced prediction trigger in background
   - [ ] Add tab filtering (skip chrome://, PDFs, etc.)

6. **Message Broadcasting**
   - [ ] Add `INTENT_PREDICTION_UPDATED` message type
   - [ ] Implement broadcast to all connected ports
   - [ ] Handle port disconnection gracefully

### Phase 3: UI Integration (Week 3)
7. **Zustand Store Updates**
   - [ ] Add `predictedIntents` to `tabsStore.ts`
   - [ ] Create actions for updating/clearing intents

8. **IntentBubbles Component**
   - [ ] Create `IntentBubbles.tsx` component
   - [ ] Implement bubble styling with confidence indicators
   - [ ] Add click handlers for intent execution

9. **Side Panel Integration**
   - [ ] Add IntentBubbles above input in `SidePanel.tsx`
   - [ ] Implement message listener for predictions
   - [ ] Add loading states during prediction
   - [ ] Handle empty/error states gracefully

### Phase 4: Optimization & Polish (Week 4)
11. **Enhanced Prompting**
    - [ ] Create domain-specific prompt templates
    - [ ] Add prediction examples for top 20 sites

12. **Error Handling**
    - [ ] Implement retry logic with backoff for LLM calls

### Phase 5: Advanced Features (Future)
13. **Learning Pipeline**
    - [ ] Track intent click-through rates
    - [ ] Store user preference patterns
    - [ ] Implement personalized predictions
    - [ ] Create feedback mechanism

## 9. Success Metrics
- **Performance**: <50ms DOM extraction, <3s total prediction time
- **Accuracy**: >60% click-through rate on top prediction
- **Coverage**: Works on 90% of popular websites
- **Reliability**: <1% error rate in production

## 10. Future Extensions (non-blocking)
- Add feature-flag `enableIntentPrediction` via Vision (`visionConfig.ts`)
- Integrate with content script for on-page bubble display
- Add voice input for intent refinement
- Export anonymized data for model training
- Create intent chaining for multi-step workflows
