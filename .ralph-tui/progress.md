## Codebase Patterns

### Type Safety with Viem
- Viem returns `bigint` for numeric fields like `nonce`, `blockNumber`, etc.
- Use `Number()` to convert to regular numbers when needed for display/JSON
- Be careful with type assertions - use `as any` sparingly when dealing with mixed types

### Error Handling in Async Loops
- Wrap non-critical operations in try-catch to allow polling to continue
- Use `undefined` checks to guard optional operations that may fail early

### MCP Server Logging
- Use `server.sendLoggingMessage()` for progress updates
- Always wrap in try-catch to prevent crashes if notification fails

---

## [Feb 4, 2025] - mcp-ethereum-sin.1
- Implemented replaced transaction detection for wait_for_transaction_confirmation tool
- Added tracking of transaction nonce to detect when original tx is replaced by higher-gas tx with same nonce
- Returns `replacedBy` field in response containing new transaction hash when detected
- Updated tool description to explain replaced transaction behavior
- Files changed: src/index.ts
- Quality gates passed: pnpm format:check, pnpm build, pnpm test

**Learnings:**
- Viem transaction nonce is `bigint`, but we used `number` for originalTxNonce variable to avoid type conflicts
- Block transactions array can be array of strings (tx hashes) or full transaction objects; need type guard before accessing properties
- Transaction replacement detection logic must check block transactions after original tx is known and has block number
- Must store original tx nonce early (when tx is first fetched) to detect replacements later
- Error handling is critical: continue polling if tx not found yet rather than failing
- MCP protocol uses logging messages for progress updates during long-running operations
---