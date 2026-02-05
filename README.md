# tools-ethereum

A comprehensive Ethereum toolkit providing both a CLI interface and an MCP (Model Context Protocol) server for blockchain interactions.

## Features

- **Dual Interface**: Use as a command-line tool (`ecli`) or as an MCP server for AI assistants
- **20+ Ethereum Tools**: Complete coverage for reading blockchain data, sending transactions, and interacting with smart contracts
- **Type-Safe**: Written in TypeScript with Zod schema validation
- **Modern Stack**: Built on Viem for reliable Ethereum interactions

## Installation

```bash
npm install tools-ethereum
# or
pnpm add tools-ethereum
# or
yarn add tools-ethereum
```

## CLI Usage

The package provides the `ecli` command-line interface:

```bash
# Start the MCP server with prefixed env vars
export ECLI_RPC_URL=https://eth-mainnet.g.alchemy.com/v2/YOUR_KEY
export ECLI_PRIVATE_KEY=0x...
ecli mcp

# Or use generic env var names (fallback)
export RPC_URL=https://eth-mainnet.g.alchemy.com/v2/YOUR_KEY
export PRIVATE_KEY=0x...
ecli mcp

# Or use --rpc-url option
ecli --rpc-url https://eth-mainnet.g.alchemy.com/v2/YOUR_KEY mcp

# Get ETH balance (uses env var)
ecli get_balance 0x...

# Or specify --rpc-url explicitly
ecli --rpc-url https://eth-mainnet.g.alchemy.com/v2/YOUR_KEY get_balance 0x...

# Get latest block number
ecli get_block_number
```

### Global Options

- `--rpc-url <url>` - RPC URL for the Ethereum network (optional if env var is set)

### Environment Variables

The CLI checks for environment variables in this priority order:

1. **`ECLI_RPC_URL`** - RPC URL for the Ethereum network (prefix avoids conflicts)
2. `RPC_URL` - Fallback RPC URL (generic name for convenience)
3. **`ECLI_PRIVATE_KEY`** - Private key for signing transactions (prefix avoids conflicts)
4. `PRIVATE_KEY` - Fallback private key (generic name for convenience)

**Note:** Private keys must start with `0x`

## MCP Server

The MCP server exposes all Ethereum tools via the Model Context Protocol, enabling AI assistants to interact with the blockchain:

```typescript
import { createServer } from 'tools-ethereum';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { mainnet } from 'viem/chains';

const server = createServer({
  chain: mainnet,
  privateKey: process.env.PRIVATE_KEY as `0x${string}`,
});

const transport = new StdioServerTransport();
await server.connect(transport);
```

## Available Tools

### Read-Only Operations

| Tool | Description |
|------|-------------|
| [`get_balance`](src/tools/get_balance.ts) | Get ETH balance for an address |
| [`get_block_number`](src/tools/get_block_number.ts) | Get the latest block number |
| [`get_block`](src/tools/get_block.ts) | Get block details by number or hash |
| [`get_latest_block`](src/tools/get_latest_block.ts) | Get the latest block details |
| [`get_transaction`](src/tools/get_transaction.ts) | Get transaction details by hash |
| [`get_transaction_count`](src/tools/get_transaction_count.ts) | Get nonce/transaction count for an address |
| [`get_gas_price`](src/tools/get_gas_price.ts) | Get current gas price |
| [`get_fee_history`](src/tools/get_fee_history.ts) | Get fee history for gas estimation |
| [`get_chain_id`](src/tools/get_chain_id.ts) | Get the network chain ID |
| [`get_code`](src/tools/get_code.ts) | Get bytecode at an address |
| [`get_storage_at`](src/tools/get_storage_at.ts) | Get storage value at a specific slot |

### Contract Interactions

| Tool | Description |
|------|-------------|
| [`call_contract`](src/tools/call_contract.ts) | Call read-only contract functions (view/pure) |
| [`encode_calldata`](src/tools/encode_calldata.ts) | Encode function calls for contract interactions |
| [`decode_calldata`](src/tools/decode_calldata.ts) | Decode transaction input data |
| [`estimate_gas`](src/tools/estimate_gas.ts) | Estimate gas for transactions |

### Transaction Operations (requires PRIVATE_KEY)

| Tool | Description |
|------|-------------|
| [`send_transaction`](src/tools/send_transaction.ts) | Send ETH or call contract functions |
| [`sign_message`](src/tools/sign_message.ts) | Sign arbitrary messages |
| [`wait_for_transaction_confirmation`](src/tools/wait_for_transaction_confirmation.ts) | Wait for transaction receipt |

### Log Queries

| Tool | Description |
|------|-------------|
| [`get_contract_logs`](src/tools/get_contract_logs.ts) | Query event logs from contracts |
| [`get_transaction_logs`](src/tools/get_transaction_logs.ts) | Get logs from a specific transaction |

## Development

```bash
# Install dependencies
pnpm install

# Build the project
pnpm build

# Run tests
pnpm test

# Watch mode for development
pnpm dev

# Format code
pnpm format
```

## Testing

The project uses [Vitest](https://vitest.dev/) for testing with [Prool](https://github.com/wevm/prool) for local Ethereum node testing:

```bash
# Run all tests
pnpm test

# Run with deprecation tracing
pnpm test:trace

# Watch mode
pnpm test:watch
```

## Project Structure

```
src/
├── index.ts           # Main MCP server creation
├── cli.ts             # CLI entry point
├── cli-tool-generator.ts  # Dynamic CLI command generation
├── helpers.ts         # Client creation and tool registration utilities
├── types.ts           # TypeScript type definitions
└── tools/             # Individual tool implementations
    ├── index.ts       # Tool exports
    ├── get_balance.ts
    ├── send_transaction.ts
    └── ... (20 tools total)
```

## Architecture

The project follows a modular tool-based architecture:

1. **Tools** (`src/tools/*.ts`): Self-contained units with schema, description, and execute function
2. **MCP Server** (`src/index.ts`): Aggregates all tools into an MCP-compatible server
3. **CLI** (`src/cli.ts`): Exposes tools as command-line commands
4. **Helpers** (`src/helpers.ts`): Shared utilities for client creation and tool registration

## License

[MIT](LICENSE) © Ronan Sandford

## Contributing

Contributions are welcome! Please ensure your changes:

1. Follow the existing code style (run `pnpm format`)
2. Include appropriate tests
3. Maintain TypeScript type safety
4. Follow the tool pattern with Zod schemas

## Resources

- [Viem Documentation](https://viem.sh/)
- [MCP Specification](https://modelcontextprotocol.io/)