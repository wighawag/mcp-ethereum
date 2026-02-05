# CLI Invocation Tests Plan

## Overview
Create comprehensive tests for CLI invocation using `program.parse()` to complement existing MCP server tests.

## Current State
- MCP invocation tests exist in `test/*.test.ts` files (e.g., `test/read-only-tools.test.ts`)
- CLI is built using Commander.js with `program` from `src/commands.ts`
- Tool commands are dynamically registered via `registerAllToolCommands` from `src/cli-tool-generator.ts`
- Each tool becomes a CLI command with options derived from its Zod schema

## Test File Structure Reorganization

### Proposed Directory Structure
```
test/
├── mcp/                          # Existing MCP tests (to be moved)
│   ├── read-only-tools.test.ts
│   ├── contract-interaction-tools.test.ts
│   ├── error-handling.test.ts
│   ├── log-query-tools.test.ts
│   ├── transaction-tools.test.ts
│   ├── server.test.ts
│   └── advanced-eatures.test.ts
├── cli/                          # New CLI tests
│   ├── basic.test.ts             # Basic CLI functionality
│   ├── read-only-tools.test.ts   # Read-only tool commands
│   ├── contract-tools.test.ts    # Contract interaction tools
│   ├── transaction-tools.test.ts # Transaction tools
│   ├── query-tools.test.ts       # Query tools
│   ├── error-handling.test.ts    # CLI error handling
│   └── global-options.test.ts    # Global options and env vars
├── utils/                        # Shared test utilities (existing)
│   ├── data.ts
│   └── index.ts
├── prool/                        # Prool test setup (existing)
│   ├── globalSetup.ts
│   ├── node-instances.ts
│   └── url.ts
├── setup.ts                      # Shared test setup (existing)
└── cli-utils.ts                  # New CLI-specific utilities
```

### File Migration Plan
Move existing MCP tests to `test/mcp/`:
- `test/read-only-tools.test.ts` → `test/mcp/read-only-tools.test.ts`
- `test/contract-interaction-tools.test.ts` → `test/mcp/contract-interaction-tools.test.ts`
- `test/error-handling.test.ts` → `test/mcp/error-handling.test.ts`
- `test/log-query-tools.test.ts` → `test/mcp/log-query-tools.test.ts`
- `test/transaction-tools.test.ts` → `test/mcp/transaction-tools.test.ts`
- `test/server.test.ts` → `test/mcp/server.test.ts`
- `test/advanced-features.test.ts` → `test/mcp/advanced-features.test.ts`

## Test Categories by File

### test/cli/basic.test.ts
Basic CLI functionality tests:
- [ ] Test that program can be parsed without errors
- [ ] Test help output is generated correctly
- [ ] Test version output works
- [ ] Test no command shows help

### test/cli/read-only-tools.test.ts
Read-only tool command tests (using test RPC):
- [ ] `get_balance` - Test with address parameter
- [ ] `get_balance` - Test with optional blockTag parameter
- [ ] `get_block_number` - Test with no parameters
- [ ] `get_chain_id` - Test with no parameters
- [ ] `get_gas_price` - Test with no parameters
- [ ] `get_latest_block` - Test with no parameters
- [ ] `get_block` - Test with blockNumber parameter
- [ ] `get_block` - Test with blockHash parameter
- [ ] `get_code` - Test with address parameter
- [ ] `get_code` - Test with blockTag parameter
- [ ] `get_code` - Test with contract address
- [ ] `get_storage_at` - Test with address and slot parameters
- [ ] `get_storage_at` - Test with hex slot
- [ ] `get_fee_history` - Test with blockCount, newestBlock, rewardPercentiles
- [ ] `get_fee_history` - Test with newestBlock as number

### test/cli/contract-tools.test.ts
Contract interaction tool tests:
- [ ] `call_contract` - Test with address, abi, and args parameters
- [ ] `call_contract` - Test with blockTag parameter
- [ ] `call_contract` - Test with no args parameter
- [ ] `estimate_gas` - Test with to, data, and optional parameters
- [ ] `decode_calldata` - Test with calldata and abi parameters
- [ ] `encode_calldata` - Test with abi and args parameters
- [ ] `encode_calldata` - Test with no args parameter

### test/cli/transaction-tools.test.ts
Transaction tool tests (requiring private key):
- [ ] `send_transaction` - Test with to and value parameters
- [ ] `send_transaction` - Test with data parameter
- [ ] `sign_message` - Test with message parameter
- [ ] `wait_for_transaction_confirmation` - Test with hash parameter

### test/cli/query-tools.test.ts
Query tool tests:
- [ ] `get_transaction` - Test with hash parameter
- [ ] `get_transaction` - Test with non-existent hash
- [ ] `get_transaction_count` - Test with address parameter
- [ ] `get_transaction_logs` - Test with hash parameter
- [ ] `get_contract_logs` - Test with address parameter
- [ ] `get_contract_logs` - Test with event filter parameters

### test/cli/error-handling.test.ts
Error handling tests:
- [ ] Test missing required parameter shows error
- [ ] Test invalid parameter value shows validation error
- [ ] Test missing --rpc-url when not in environment shows error
- [ ] Test invalid private key format (missing 0x prefix) shows error
- [ ] Test invalid ABI format shows error
- [ ] Test network errors are handled gracefully

### test/cli/global-options.test.ts
Global options and environment variable tests:
- [ ] Test --rpc-url global option works
- [ ] Test --rpc-url option is inherited by subcommands
- [ ] Test local --rpc-url overrides global --rpc-url
- [ ] Test environment variable ECLI_RPC_URL is used
- [ ] Test environment variable RPC_URL is used (fallback)
- [ ] Test option takes precedence over environment variables
- [ ] Test ECLI_PRIVATE_KEY is recognized
- [ ] Test PRIVATE_KEY is recognized (fallback)

## Test Utilities

### test/cli-utils.ts (new file)
CLI-specific test utilities:

```typescript
/**
 * Capture console output during function execution
 */
export async function captureConsoleOutput(fn: () => Promise<void>): Promise<{stdout: string, stderr: string}> {
  const logs: string[] = [];
  const errors: string[] = [];

  const originalLog = console.log;
  const originalError = console.error;

  console.log = (...args: any[]) => {
    logs.push(args.map(arg => typeof arg === 'object' ? JSON.stringify(arg) : String(arg)).join(' '));
  };

  console.error = (...args: any[]) => {
    errors.push(args.map(arg => typeof arg === 'object' ? JSON.stringify(arg) : String(arg)).join(' '));
  };

  try {
    await fn();
    return { stdout: logs.join('\n'), stderr: errors.join('\n') };
  } finally {
    console.log = originalLog;
    console.error = originalError;
  }
}

/**
 * Setup CLI test environment
 */
export function setupCliTestEnvironment(options?: {
  rpcUrl?: string;
  privateKey?: string;
}): {restore: () => void} {
  const envVars = new Map<string, string | undefined>();

  if (options?.rpcUrl) {
    envVars.set('ECLI_RPC_URL', process.env.ECLI_RPC_URL);
    envVars.set('RPC_URL', process.env.RPC_URL);
    process.env.ECLI_RPC_URL = options.rpcUrl;
    process.env.RPC_URL = options.rpcUrl;
  }

  if (options?.privateKey) {
    envVars.set('ECLI_PRIVATE_KEY', process.env.ECLI_PRIVATE_KEY);
    envVars.set('PRIVATE_KEY', process.env.PRIVATE_KEY);
    process.env.ECLI_PRIVATE_KEY = options.privateKey;
    process.env.PRIVATE_KEY = options.privateKey;
  }

  const restore = () => {
    for (const [key, value] of envVars) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  };

  return { restore };
}

/**
 * Invoke CLI command with arguments and capture output
 */
export async function invokeCliCommand(
  args: string[],
  options?: {
    env?: Record<string, string>;
  }
): Promise<{stdout: string, stderr: string, exitCode: number}> {
  // Set environment variables
  const envVars = new Map<string, string | undefined>();
  if (options?.env) {
    for (const [key, value] of Object.entries(options.env)) {
      envVars.set(key, process.env[key]);
      process.env[key] = value;
    }
  }

  let exitCode = 0;
  const originalExit = process.exit;

  // Mock process.exit to capture exit code
  process.exit = (code?: number) => {
    exitCode = code ?? 0;
    throw new Error(`process.exit(${code}) called`);
  };

  try {
    const output = await captureConsoleOutput(async () => {
      // Import program fresh for each test
      const {program} = await import('../src/commands.js');
      // Reset program state
      program.commands = [];
      program.options = [];
      // Re-register commands
      const {registerAllToolCommands} = await import('../src/cli-tool-generator.js');
      const tools = await import('../src/tools/index.js');
      registerAllToolCommands(program, tools);

      try {
        await program.parseAsync(['node', 'cli', ...args]);
      } catch (error: any) {
        if (!error.message.includes('process.exit')) {
          throw error;
        }
      }
    });

    return {
      stdout: output.stdout,
      stderr: output.stderr,
      exitCode
    };
  } finally {
    // Restore environment
    for (const [key, value] of envVars) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }

    // Restore process.exit
    process.exit = originalExit;
  }
}
```

### test/setup.ts (extend existing)
Add CLI-specific setup function:

```typescript
/**
 * Setup CLI test environment with test RPC URL
 */
export function setupCliTestEnvironment(options?: {
  privateKey?: string;
}): {restore: () => void} {
  return setupCliTest({
    rpcUrl: RPC_URL,
    privateKey: options?.privateKey
  });
}
```

## Key Considerations

### 1. Process Exit Handling
- CLI commands call `process.exit(1)` on errors
- Need to mock or handle this in tests
- Consider using `process.exitCode` instead in production code, or mock `process.exit`

### 2. Console Output
- Tools use `console.log` for success output
- Tools use `console.error` for error output
- Need to capture both for proper assertions

### 3. Async Execution
- CLI command actions are async
- Tests need to wait for completion

### 4. Environment Cleanup
- Tests modify environment variables
- Need to restore original values after each test

### 5. Program State
- Commander's `program` maintains state between calls
- May need to reset program between tests or use fresh instances

## Test File Organization

### test/cli.test.ts
Main CLI invocation tests covering all categories above.

### test/cli-utils.ts (new file)
Utilities for CLI testing:
- `captureConsoleOutput()`
- `invokeCliCommand()`
- `setupCliTestEnvironment()`
- `restoreEnvironment()`

## Dependencies
- No new dependencies needed
- Uses existing: `vitest`, `commander`

## Integration with Existing Tests
- Reuses existing test setup from `test/setup.ts`
- Reuses test data from `test/utils/data.ts`
- Reuses RPC URL from `test/prool/url.ts`

## Implementation Steps

### Phase 1: Reorganize Existing Tests
1. Create `test/mcp/` directory
2. Move existing MCP test files to `test/mcp/`
3. Update import statements in moved files if needed
4. Verify tests still pass after move

### Phase 2: Create CLI Test Infrastructure
1. Create `test/cli/` directory
2. Create `test/cli-utils.ts` with CLI test utilities
3. Extend `test/setup.ts` with CLI-specific setup functions
4. Update `vitest.config.ts` to include new test patterns if needed

### Phase 3: Implement CLI Test Files
1. Create `test/cli/basic.test.ts` - Basic CLI functionality
2. Create `test/cli/read-only-tools.test.ts` - Read-only tool commands
3. Create `test/cli/contract-tools.test.ts` - Contract interaction tools
4. Create `test/cli/transaction-tools.test.ts` - Transaction tools
5. Create `test/cli/query-tools.test.ts` - Query tools
6. Create `test/cli/error-handling.test.ts` - Error handling
7. Create `test/cli/global-options.test.ts` - Global options and env vars

## Example Test File Structure

### test/cli/read-only-tools.test.ts
```typescript
import {describe, it, expect, beforeAll, afterAll} from 'vitest';
import {setupTestEnvironment, teardownTestEnvironment, TEST_ADDRESS} from '../setup.js';
import {invokeCliCommand} from '../cli-utils.js';

describe('CLI - Read-Only Tools', () => {
  beforeAll(async () => {
    await setupTestEnvironment();
  }, 30000);

  afterAll(async () => {
    await teardownTestEnvironment();
  });

  describe('get_balance', () => {
    it('should get balance for an address', async () => {
      const {stdout, exitCode} = await invokeCliCommand([
        'get_balance',
        '--address', TEST_ADDRESS,
        '--rpc-url', 'http://localhost:8545'
      ]);

      expect(exitCode).toBe(0);
      const result = JSON.parse(stdout);
      expect(result.address).toBe(TEST_ADDRESS);
      expect(result.balance).toBeDefined();
      expect(result.balanceInEther).toBeDefined();
    });

    it('should get balance with blockTag', async () => {
      const {stdout, exitCode} = await invokeCliCommand([
        'get_balance',
        '--address', TEST_ADDRESS,
        '--blockTag', 'latest',
        '--rpc-url', 'http://localhost:8545'
      ]);

      expect(exitCode).toBe(0);
      const result = JSON.parse(stdout);
      expect(result.address).toBe(TEST_ADDRESS);
      expect(result.blockTag).toBe('latest');
    });
  });

  describe('get_block_number', () => {
    it('should get current block number', async () => {
      const {stdout, exitCode} = await invokeCliCommand([
        'get_block_number',
        '--rpc-url', 'http://localhost:8545'
      ]);

      expect(exitCode).toBe(0);
      const result = JSON.parse(stdout);
      expect(result.blockNumber).toBeDefined();
    });
  });
  // ... more tests
});
```

## Update vitest.config.ts

After reorganizing, ensure `vitest.config.ts` includes both directories:

```typescript
import {join} from 'node:path';
import {defineConfig} from 'vitest/config';

export default defineConfig({
  test: {
    include: [
      'test/mcp/**/*.test.ts',
      'test/cli/**/*.test.ts'
    ],
    environment: 'node',
    globalSetup: [join(__dirname, './test/prool/globalSetup.ts')],
  },
});
```