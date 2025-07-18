Only P0 as launch blockers for tomorrow

## PROGRESS
- Fix the browse agent prompt
- Don't need highlighter in chat mode
  - not using image, why use highlighter?

## P0:
- Tell if it's web task or chat task

## P1:
- Better display of messages in planner and validator

## P2:

## Backlog:
- remove conversation history just use the new message manager
- merge browsercontext into agentcontext and pass it everywhere
  - clean up agent context
- better streaming thing
  - maybe event mitter and subscriber like nano?

## Done:
- Add missing tools from action builder
  - Added sendKeys and getDropdownOptions to InteractionTool
  - Added SearchTool with support for Google, Amazon, Google Maps, Google Finance
  - Added ExtractTool with extract_text operation (ready for future expansion)
- Merge BYOK
- Fix tab attach issue.
- clear conversation should Abort also

