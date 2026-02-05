# CLI Refactoring Plan

## Overview
Refactor the CLI to support multiple commands:
- Show help if no command is specified
- `mcp` command: Runs the MCP server (existing functionality)
- One command per tool: Dynamically generated from tool definitions using snake_case names

## Current Structure Analysis

### Existing Components
- **CLI** (`src/cli.ts`): Currently only runs MCP server with `--rpc-url` option
- **Tools** (`src/tools/*.ts`): 20 tools with Zod schemas
- **Tool Type** (`src/types.ts`): Standard structure with `description`, `schema`, `execute`
- **Helpers** (`src/helpers.ts`): Utility functions for tool execution and registration

### Available Tools (20 total)
1. `get_balance` - Get ETH balance for an address
2. `get_block_number` - Get current block number
3. `get_chain_id` - Get chain ID
4. `get_gas_price` - Get current gas price
5. `get_transaction_count` - Get transaction count (nonce)
6. `get_code` - Get contract code
7. `get_storage_at` - Get storage at position
8. `get_latest_block` - Get latest block
9. `get_block` - Get block by number/hash
10. `get_fee_history` - Get fee history
11. `call_contract` - Call contract read function
12. `estimate_gas` - Estimate gas for transaction
13. `get_transaction` - Get transaction by hash
14. `get_contract_logs` - Get contract logs
15. `get_transaction_logs` - Get transaction logs
16. `decode_calldata` - Decode calldata
17. `encode_calldata` - Encode calldata
18. `send_transaction` - Send transaction
19. `sign_message` - Sign message
20. `wait_for_transaction_confirmation` - Wait for transaction confirmation

## Implementation Plan

### Phase 1: CLI Structure Setup

#### 1.1 Update CLI Entry Point
**File**: `src/cli.ts`

Changes:
- Create main `program` with help display when no command specified
- Add `--rpc-url` as a **global option** that all subcommands inherit
- Add `mcp` subcommand for MCP server functionality
- Setup framework for dynamic tool command generation

Structure:
```typescript
program
  .name(pkg.name)
  .description(pkg.description)
  .version(pkg.version)
  // Global option - inherited by all subcommands
  .option('--rpc-url <url>', 'RPC URL for the Ethereum network', '')
  .action(() => {
    program.help(); // Show help if no command specified
  });

// mcp subcommand - can override global --rpc-url or use it
program
  .command('mcp')
  .description('Start the MCP server')
  .action(handleMcpCommand);

// Dynamic tool commands will be added here
// They will automatically inherit --rpc-url from the global options
```

#### 1.2 Create Tool Command Generator
**File**: `src/cli-tool-generator.ts` (new file)

Purpose: Dynamically generate commander.js subcommands from tool definitions

Responsibilities:
- Iterate through all exported tools
- Extract tool name, description, and schema
- Convert Zod schema to CLI options/arguments
- Create subcommand with appropriate argument handling
- Access global options (like `--rpc-url`) from `program.opts()`
- Execute tool and return results

Functions:
- `generateToolCommand(program, toolName, toolDefinition)`: Generate single tool command
- `registerAllToolCommands(program, tools)`: Register all tool commands
- `zodSchemaToOptions(schema)`: Convert Zod schema to commander options
- `executeTool(tool, params, env)`: Execute tool and format output

**Accessing Global Options in Commander.js**:
```typescript
// In subcommand handler, access global options:
program.command('get_balance')
  .description('Get ETH balance for an address')
  .option('--address <address>', 'Address to check balance')
  .action((options) => {
    // Get global options (includes --rpc-url)
    const globalOptions = program.opts();
    const rpcUrl = options.rpcUrl || globalOptions.rpcUrl;
    // ... execute tool
  });
```

### Phase 2: Schema to CLI Options Conversion

#### 2.1 Zod Schema Mapping
Create a mapping function that converts Zod types to CLI options:

| Zod Type | CLI Option Type | Example |
|----------|----------------|---------|
| `z.string()` | `--name <value>` | `--address 0x123...` |
| `z.number()` | `--name <value>` | `--nonce 5` |
| `z.boolean()` | `--name` (flag) | `--verbose` |
| `z.array(...)` | `--name <value1,value2>` | `--args arg1,arg2` |
| `z.optional()` | Optional option | `.optional()` |
| `z.union([...])` | String option with validation | Parse and validate |
| `z.literal(...)` | Choice option | `--block-tag latest` |

#### 2.2 Option Descriptions
Extract `.describe()` from Zod schemas for CLI help text:
```typescript
const description = field.description || 'No description available';
```

### Phase 3: Tool Execution

#### 3.1 Environment Setup
Create a lightweight environment for CLI tool execution:
```typescript
function createCliToolEnvironment(rpcUrl: string, privateKey?: string): ToolEnvironment {
  const chain = await getChain(rpcUrl);
  const {publicClient, walletClient} = getClients({chain, privateKey});
  
  // Create minimal environment without sendStatus (CLI mode)
  return {
    publicClient,
    walletClient,
    sendStatus: async (msg: string) => {
      console.log(`[Status] ${msg}`);
    }
  };
}
```

#### 3.2 Parameter Parsing
Parse CLI arguments to match Zod schema:
```typescript
async function parseAndValidateParams(schema: z.ZodObject, options: any): Promise<any> {
  try {
    return await schema.parseAsync(options);
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error('Parameter validation error:');
      error.errors.forEach(err => {
        console.error(`  - ${err.path.join('.')}: ${err.message}`);
      });
    }
    throw error;
  }
}
```

#### 3.3 Output Formatting
Format tool results for CLI output:
```typescript
function formatToolResult(result: ToolResult): void {
  if (result.success) {
    console.log(JSON.stringify(result.result, null, 2));
  } else {
    console.error('Error:', result.error);
    if (result.stack) {
      console.error('Stack:', result.stack);
    }
    process.exit(1);
  }
}
```

### Phase 4: Command Structure

#### 4.1 Example Commands
```bash
# Show help
ecli

# Start MCP server
ecli mcp --rpc-url https://mainnet.infura.io/v3/YOUR_KEY

# Global --rpc-url option - inherited by all subcommands
ecli --rpc-url https://mainnet.infura.io/v3/YOUR_KEY get_balance --address 0x1234...

# Send transaction (requires PRIVATE_KEY env var)
ecli --rpc-url https://mainnet.infura.io/v3/YOUR_KEY send_transaction --to 0x5678... --value 1000000000000000000

# Call contract
ecli --rpc-url https://mainnet.infura.io/v3/YOUR_KEY call_contract --address 0xabcd... --data 0x1234...

# You can also override --rpc-url per command if needed
ecli get_balance --address 0x1234... --rpc-url https://other.rpc.com
```

#### 4.2 Command Naming Convention
Use snake_case to match tool names exactly (no conversion needed):
- `get_balance` → `get_balance`
- `send_transaction` → `send_transaction`
- `get_block_number` → `get_block_number`

This provides direct 1:1 mapping between tool names and CLI commands, maintaining consistency across the codebase.

### Phase 5: Error Handling

#### 5.1 Validation Errors
Display clear validation errors when parameters don't match schema:
```bash
$ ecli get_balance --address invalid
Parameter validation error:
  - address: Invalid Ethereum address format
```

#### 5.2 Execution Errors
Handle and display tool execution errors with stack traces when needed:
```bash
$ ecli send_transaction --to 0x1234... --rpc-url https://...
Error: insufficient funds for gas * price + value
Stack: Error: insufficient funds...
```

### Phase 6: Implementation Steps

#### Step 1: Create Tool Command Generator Module
- Create `src/cli-tool-generator.ts`
- Implement `zodSchemaToOptions()` function
- Implement `generateToolCommand()` function
- Implement `registerAllToolCommands()` function

#### Step 2: Refactor Main CLI
- Update `src/cli.ts` to use new command structure
- Add `mcp` subcommand with existing MCP server logic
- Call `registerAllToolCommands()` to generate tool commands
- Add default action to show help

#### Step 3: Implement Environment Setup
- Create CLI-specific environment setup
- Handle PRIVATE_KEY validation for write operations
- Ensure proper client initialization

#### Step 4: Handle Special Cases
- **Array parameters**: Parse comma-separated values (e.g., `--args arg1,arg2,arg3`)
- **Union types**: Use string options with post-parsing validation
- **Optional parameters**: Set commander options as optional
- **Boolean flags**: Use commander's `.option('--flag')` syntax

#### Step 5: Testing
- Test each command with valid parameters
- Test validation errors
- Test execution errors
- Verify help text is clear and accurate
- Test both read-only and write operations

## File Structure Changes

### New Files
```
src/
  cli-tool-generator.ts  # New: Dynamic tool command generation
```

### Modified Files
```
src/
  cli.ts                 # Modified: Add subcommand structure
```

### Unchanged Files
```
src/
  index.ts               # MCP server (unchanged)
  types.ts               # Tool types (unchanged)
  helpers.ts             # Utility functions (unchanged)
  tools/*.ts             # Tool definitions (unchanged)
```

## Key Design Decisions

### 1. Global vs Local RPC URL
**Decision**: Use `--rpc-url` as a **global option** that all subcommands inherit via commander.js.
**Rationale**: 
- Most tool commands need an RPC URL, so a global option reduces repetition
- Commander.js automatically makes global options available to all subcommands via `program.opts()`
- Users can set it once: `ecli --rpc-url <url> <command> [args]`
- Subcommands can override the global option if needed by accepting their own `--rpc-url`
- This is the recommended pattern in commander.js for options needed by multiple commands

### 2. Parameter Style
**Decision**: Use `--option-name <value>` style for all parameters.
**Rationale**: Consistent with commander.js conventions and clear to users.

### 3. Output Format
**Decision**: Use JSON output for successful results, plain text for errors.
**Rationale**: JSON is machine-readable and can be piped to other tools.

### 4. Array Parsing
**Decision**: Use comma-separated values for array parameters.
**Rationale**: Simple and works well with CLI shells. Example: `--args arg1,arg2,arg3`

### 5. Private Key Handling
**Decision**: Continue using `PRIVATE_KEY` environment variable.
**Rationale**: More secure than passing as CLI argument (won't show in process list).

### 6. Command Naming Convention
**Decision**: Use snake_case to match tool names exactly.
**Rationale**: 
- Direct 1:1 mapping between tool names and CLI commands
- No conversion logic needed
- Consistency across codebase
- Less cognitive overhead for users familiar with the tools


## Success Criteria

✅ CLI shows help when no command specified
✅ `ecli mcp --rpc-url <url>` starts MCP server as before
✅ Each tool has a corresponding CLI command
✅ Commands accept arguments generated from Zod schemas
✅ Parameters are validated against schemas before execution
✅ Results are returned via CLI in readable format
✅ Validation errors are clear and helpful
✅ Execution errors are properly handled and displayed
✅ Help text is generated for all commands
✅ All 20 tools work as CLI commands
✅ Command names match tool names exactly (snake_case)

## Next Steps

1. Review and approve this plan
2. Switch to Code mode to implement the changes
3. Test the implementation thoroughly
4. Update documentation if needed