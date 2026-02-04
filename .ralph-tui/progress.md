## Codebase Patterns

### Transaction Status Handling
- When working with viem transaction receipts, use `receipt.status === 'success'` to check if a transaction succeeded
- For revert detection, use `publicClient.call()` to simulate the transaction and capture the error message
- This is a common pattern for getting revert reasons from failed transactions

---

## [2025-02-04] - mcp-ethereum-sin.2
- Implemented reverted status detection in `wait_for_transaction_confirmation` tool
- Added check for `receipt.status === 'success'` to differentiate between confirmed and reverted transactions
- Added `publicClient.call()` simulation to get revert reason for failed transactions
- Returns status: 'reverted' with `revertReason` field when transaction fails
- Maintains backwards compatibility with status: 'confirmed' for successful transactions
- Updated tool description to mention revert status detection
- Files changed:
  - `src/index.ts:86-132` - Added reverted status detection logic

**Learnings:**
- Viem's transaction receipt has a `status` field that can be 'success' or undefined (for reverted)
- To get the exact revert reason, you need to simulate the transaction using `publicClient.call()` and catch the error
- The `call` method in viem returns the same error message that would appear on-chain
 - Error handling needs to be careful not to catch errors from the simulation logic itself
---

## [2025-02-04] - mcp-ethereum-sin.4
- Implemented progress percentage display for transaction confirmations
- Added progress calculation based on confirmations / expectedConformations
- Only shows progress when confirmations > 1
- Emits progress events at 25%, 50%, 75%, and 100% milestones
- Added `shouldSendProgress` helper to check if milestone should be reported
- Added `sendProgress` helper to send progress updates at milestones
- Progress messages show percentage and confirmation count
- Files changed:
  - `src/index.ts:58-79` - Added progress tracking variables and helpers
  - `src/index.ts:152` - Send progress on transaction confirmation
  - `src/index.ts:178` - Send progress on transaction revert
  - `src/index.ts:184-186` - Send progress updates during waiting period

**Learnings:**
- Progress should only be shown when multiple confirmations are required (confirmations > 1)
- Need to track `lastMilestonePercentage` to avoid duplicate milestone notifications
- Milestone calculation should use `Math.floor()` for consistent percentage reporting
- Helper functions for progress checking (`shouldSendProgress`) and sending (`sendProgress`) make the code more readable and maintainable
- Progress updates are sent at milestones (25%, 50%, 75%, 100%) and before final status messages
---