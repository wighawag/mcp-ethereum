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