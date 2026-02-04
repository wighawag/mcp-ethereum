# Ralph Progress Log

This file tracks progress across iterations. Agents update this file
after each iteration and it's included in prompts for context.

## Codebase Patterns (Study These First)

* **Transaction Flow in wait_for_transaction_confirmation**:
  - Uses a while loop with timeout checking
  - Sleeps between iterations using `setTimeout` wrapped in Promise
  - Sends status updates via `server.sendLoggingMessage()`
  - Progress tracking with milestones (25%, 50%, 75%, 100%)
  - Returns `CallToolResult` with `content` array containing text with JSON data
  - Uses `stringifyWithBigInt()` to handle BigInt serialization (2-space indentation)

* **Returning Transaction Status**:
  - Status field indicates: "confirmed", "reverted", "replaced", "timeout"
  - Always return txHash, blockNumber, confirmations for confirmed/reverted
  - For replaced: return replacedBy field with new txHash
  - Include receipt object for confirmed/reverted transactions
  - Include revertReason for reverted transactions

* **Error Handling Pattern**:
  - Wrap individual operations in try-catch
  - Return error results with `isError: true` in CallToolResult
  - Use `error instanceof Error ? error.message : String(error)` pattern for consistent error messages

---

## [Wed Feb 04 2025] - mcp-ethereum-sin.1
- Implemented replaced transaction detection in wait_for_transaction_confirmation tool
- Files changed:
  - src/index.ts: Added logic to detect replaced transactions by checking for transactions with same nonce in latest block
  - .ralph-tui/progress.md: Added codebase patterns and completed work entry
- **Learnings:**
  - Viem's getBlock with includeTransactions returns full transaction data
  - Replacement detection: find transaction in latest block with same nonce but different hash
  - Must check txHash.toLowerCase() for safe comparison
  - Return "replaced" status with replacedBy field containing new transaction hash
  - Update tool description to reflect new status type

---

