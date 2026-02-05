# CLI + MCP Server Dual Mode Implementation Guide

This guide describes how to implement a dual-mode CLI that can:
1. Run as an **MCP server** for AI assistant integration
2. Execute **tools directly** from the command line

This pattern is useful when you have a set of tools that can be enumerated from an index file, each following a common pattern with a standardized tool environment (e.g., database connection, API client, etc.).

---

## Overview

### Pattern Principles

- **Tool Definition**: Each tool is defined with a description, Zod schema, and execute function
- **Environment**: Tools receive an environment object containing connections/clients (e.g., RPC clients, DB connections, API clients)
- **Enumeration**: Tools are exported from an index file (e.g., `tools/index.ts`) and registered in bulk
- **MCP Mode**: Tools are registered with the Model Context Protocol server for AI assistants
- **CLI Mode**: Tools are exposed as subcommands with flags generated from Zod schemas

### Target Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                          CLI Tool                               │
├─────────────────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐  │
│  │ Root Program │  │ MCP Command  │  │  Dynamic Tool Cmds   │  │
│  │ --global-opt │  │  mcp server  │  │ (generated per tool) │  │
│  └──────────────┘  └──────────────┘  └──────────────────────┘  │
│         │                 │                     │               │
│         ▼                 ▼                     ▼               │
│   ┌─────────────────────────────────────────────────────────┐   │
│   │                  Tool Definitions                       │   │
│   │  - description  - Zod schema  - execute(env, params)    │   │
│   └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

---

## Prerequisites

### Required Dependencies

```bash
npm install commander zod @modelcontextprotocol/sdk
# or
pnpm add commander zod @modelcontextprotocol/sdk
```

### Project Structure Assumptions

This guide assumes your project has:

1. **Tool definitions** in `src/tools/*.ts` using Zod schemas
2. **Tool index** at `src/tools/index.ts` that exports all tools
3. **Type definitions** for the tool environment and result types
4. **Helper functions** for setting up the environment (clients, connections, etc.)

---

## Implementation Steps

### Step 1: Define Tool Types

Create `src/types.ts` with the core type definitions:

```typescript
import {z} from 'zod';
import type {McpServer} from '@modelcontextprotocol/sdk/server/mcp.js';

/**
 * Environment provided to tool execute functions
 * ADAPT THIS to your project's needs (e.g., DB connection, API client, etc.)
 */
export type ToolEnvironment = {
  /** function to send status updates during tool execution */
  sendStatus: (message: string) => Promise<void>;
  /**
   * Add your environment-specific clients/connections here
   * Examples:
   * - publicClient: PublicClient  // for blockchain
   * - db: Database                // for database tools
   * - api: APIClient              // for API tools
   * - redis: RedisClient          // for cache tools
   */
  publicClient: any;
  walletClient?: any;
};

/**
 * Result returned by tool execute functions
 */
export type ToolResult =
  | {success: true; result: Record<string, any>}
  | {success: false; error: string; stack?: string};

/**
 * Tool definition with execute, schema, and description
 */
export type Tool<S extends z.ZodObject<any> = z.ZodObject<any>> = {
  description: string;
  schema: S;
  execute: (env: ToolEnvironment, params: z.infer<S>) => Promise<ToolResult>;
};

/**
 * Helper function to create a tool with automatic type inference
 */
export function createTool<S extends z.ZodObject<any>>(config: {
  description: string;
  schema: S;
  execute: (env: ToolEnvironment, params: z.infer<S>) => Promise<ToolResult>;
}): Tool<S> {
  return config;
}
```

**TODO**: Adapt `ToolEnvironment` to match your specific infrastructure (database connection, API client, etc.).

### Step 2: Create a Tool Using the Pattern

Example tool at `src/tools/example.ts`:

```typescript
import {z} from 'zod';
import {createTool} from '../types.js';

export const example_operation = createTool({
  description: 'Description of what this tool does',
  schema: z.object({
    param1: z.string().describe('First parameter'),
    param2: z.number().optional().describe('Optional numeric parameter'),
    flag: z.boolean().optional().describe('Boolean flag'),
  }),
  execute: async (env, {param1, param2, flag}) => {
    // Access environment (clients, connections, etc.)
    const result = await env.publicClient?.doSomething(param1);
    
    return {
      success: true,
      result: {
        message: `Processed ${param1}`,
        value: result,
      },
    };
  },
});
```

**TODO**: Create your tools following this pattern, exporting each from `src/tools/*.ts`.

### Step 3: Export All Tools from Index

Create `src/tools/index.ts`:

```typescript
export {example_operation} from './example.js';
export {another_tool} from './another.js';
// Add all your tools here
```

**TODO**: Add exports for all your tools.

### Step 4: Create MCP Server Setup

Create `src/index.ts` for MCP server mode:

```typescript
import {McpServer} from '@modelcontextprotocol/sdk/server/mcp.js';
import pkg from '../package.json' with {type: 'json'};
import type {Implementation} from '@modelcontextprotocol/sdk/types.js';
import * as tools from './tools/index.js';

// ADAPT: Function to create your environment-specific clients
import {getClients} from './helpers.js';

// ADAPT: Function to register a tool with the MCP server
import {registerTool} from './helpers.js';

export function createServer(
  params: {/* your environment params */},
  options?: {serverOptions?: any; serverInfo?: Implementation},
) {
  // ADAPT: Create your environment (clients, connections, etc.)
  const {publicClient, walletClient} = getClients(params);

  const server = new McpServer(
    options?.serverInfo || {
      name: 'your-mcp-server-name',
      version: pkg.version,
    },
    options?.serverOptions || {capabilities: {logging: {}}},
  );

  // Register all tools in a loop
  for (const [name, tool] of Object.entries(tools)) {
    registerTool({server, name, tool}, publicClient, walletClient);
  }

  return server;
}
```

**TODO**: 
- Implement `getClients()` to initialize your environment (DB, API, etc.)
- Implement `registerTool()` to bind tools to the MCP server

### Step 5: Create CLI Tool Generator

Create `src/cli-tool-generator.ts` to dynamically generate CLI commands from tool definitions:

```typescript
import {Command} from 'commander';
import {z} from 'zod';
import type {Tool, ToolEnvironment} from './types.js';

// ADAPT: Import your environment setup functions
import {getClients} from './helpers.js';

/**
 * Convert Zod schema field to commander.js option definition
 */
function zodFieldToOption(name: string, field: z.ZodTypeAny): string {
  if (field instanceof z.ZodBoolean) {
    return `--${name}`;
  }
  return `--${name} <value>`;
}

/**
 * Parse option value based on Zod type
 */
function parseOptionValue(field: z.ZodTypeAny, value: any): any {
  if (field instanceof z.ZodArray) {
    return typeof value === 'string' ? value.split(',').map(v => v.trim()) : value;
  }
  if (field instanceof z.ZodNumber) {
    return Number(value);
  }
  if (field instanceof z.ZodBoolean) {
    return value === true || value === 'true';
  }
  return value;
}

/**
 * Extract description from Zod schema field
 */
function getFieldDescription(field: z.ZodTypeAny): string {
  return (field as any).description || 'No description available';
}

/**
 * Check if a Zod field is optional
 */
function isOptionalField(field: z.ZodTypeAny): boolean {
  return field instanceof z.ZodOptional || field.isOptional?.();
}

/**
 * Create a CLI tool environment for executing tools
 * ADAPT: Create your environment with CLI-specific settings
 */
async function createCliToolEnvironment(rpcUrl: string): Promise<ToolEnvironment> {
  // ADAPT: Initialize your environment (DB, API, etc.)
  const chain = await getChain(rpcUrl);
  const {publicClient, walletClient} = getClients({chain});

  return {
    publicClient,
    walletClient,
    sendStatus: async (msg: string) => {
      console.log(`[Status] ${msg}`);
    },
  };
}

/**
 * Parse and validate parameters against Zod schema
 */
async function parseAndValidateParams(
  schema: z.ZodObject<any>,
  options: Record<string, any>,
): Promise<any> {
  try {
    return await schema.parseAsync(options);
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error('Parameter validation error:');
      for (const err of error.issues) {
        console.error(`  - ${err.path.join('.')}: ${err.message}`);
      }
    }
    throw error;
  }
}

/**
 * Format tool result for CLI output
 */
function formatToolResult(result: {success: boolean; result?: any; error?: string; stack?: string}): void {
  if (result.success) {
    console.log(JSON.stringify(result.result, null, 2));
  } else {
    console.error('Error:', result.error);
    if (result.stack) console.error('Stack:', result.stack);
    process.exit(1);
  }
}

/**
 * Generate a single tool command from tool definition
 */
export function generateToolCommand(
  program: Command,
  toolName: string,
  tool: Tool<z.ZodObject<any>>,
): void {
  const shape = tool.schema.shape;
  const cmd = program.command(toolName).description(tool.description);

  // Add options for each schema field
  for (const [fieldName, field] of Object.entries(shape)) {
    const actualField = isOptionalField(field as z.ZodTypeAny)
      ? (field as z.ZodOptional<any>).unwrap()
      : field;
    const optionDef = zodFieldToOption(fieldName, actualField);
    const description = getFieldDescription(actualField);

    if (isOptionalField(field as z.ZodTypeAny)) {
      cmd.option(optionDef, description);
    } else {
      cmd.requiredOption(optionDef, description);
    }
  }

  // ADAPT: Add any CLI-specific global option overrides
  cmd.option('--global-opt <value>', 'Override global option for this command');

  cmd.action(async (options: Record<string, any>) => {
    try {
      const globalOptions = program.opts();
      
      // ADAPT: Get your specific global options
      const globalOpt = options.globalOpt || globalOptions.globalOpt || process.env.GLOBAL_OPT;
      
      if (!globalOpt) {
        console.error('Error: --global-opt option or GLOBAL_OPT environment variable is required');
        process.exit(1);
      }

      // Parse and validate parameters
      const params: Record<string, any> = {};
      for (const [fieldName, field] of Object.entries(shape)) {
        const actualField = isOptionalField(field as z.ZodTypeAny)
          ? (field as z.ZodOptional<any>).unwrap()
          : field;
        const value = options[fieldName];
        if (value !== undefined) {
          params[fieldName] = parseOptionValue(actualField, value);
        }
      }

      const validatedParams = await parseAndValidateParams(tool.schema, params);

      // Create environment and execute
      const env = await createCliToolEnvironment(globalOpt);
      const result = await tool.execute(env, validatedParams);
      formatToolResult(result);
    } catch (error) {
      if (error instanceof Error) {
        console.error('Error:', error.message);
        if (error.stack) console.error('Stack:', error.stack);
      } else {
        console.error('Error:', String(error));
      }
      process.exit(1);
    }
  });
}

/**
 * Register all tool commands from a tools object
 */
export function registerAllToolCommands(program: Command, tools: Record<string, Tool>): void {
  for (const [toolName, tool] of Object.entries(tools)) {
    generateToolCommand(program, toolName, tool);
  }
}
```

**TODO**: 
- Adapt `createCliToolEnvironment()` to match your project's infrastructure
- Adapt global option handling to match your needs (env vars, CLI flags, etc.)

### Step 6: Create CLI Entry Point

Create `src/cli.ts`:

```typescript
#!/usr/bin/env node
import {StdioServerTransport} from '@modelcontextprotocol/sdk/server/stdio.js';
import {createServer} from './index.js';
import {Command} from 'commander';
import pkg from '../package.json' with {type: 'json'};
import * as tools from './tools/index.js';
import {registerAllToolCommands} from './cli-tool-generator.js';

// ADAPT: Import your environment setup
import {getClients} from './helpers.js';

const program = new Command();
const binName = Object.keys(pkg.bin)[0];

program
  .name(binName)
  .description(pkg.description)
  .version(pkg.version)
  // ADAPT: Add your global options here
  .option('--global-opt <value>', 'Global option available to all commands', '')
  .action(() => {
    program.help();
  });

// MCP subcommand - starts the MCP server
program
  .command('mcp')
  .description('Start the MCP server')
  .action(async () => {
    const options = program.opts();

    // ADAPT: Get your environment variables and validate them
    const globalOpt = options.globalOpt || process.env.GLOBAL_OPT;
    if (!globalOpt) {
      console.error('Error: --global-opt option or GLOBAL_OPT environment variable is required');
      process.exit(1);
    }

    const transport = new StdioServerTransport();
    const server = createServer({/* your params */});
    await server.connect(transport);
  });

// Register all tool commands dynamically
registerAllToolCommands(program, tools);

program.parse(process.argv);
```

**TODO**: 
- Adapt global options to match your project's needs
- Add environment variable validation as needed
- Pass appropriate params to `createServer()`

### Step 7: Update package.json

Add the CLI configuration:

```json
{
  "name": "your-project",
  "version": "1.0.0",
  "bin": {
    "your-cli-name": "dist/cli.js"
  },
  "scripts": {
    "build": "tsc",
    "cli": "node dist/cli.js"
  },
  "dependencies": {
    "commander": "^14.0.0",
    "zod": "^4.0.0",
    "@modelcontextprotocol/sdk": "^1.25.0"
  }
}
```

**TODO**: Replace `your-cli-name` with your desired CLI command name.

---

## Zod Schema to CLI Options Mapping

| Zod Type | CLI Option Type | Example |
|----------|----------------|---------|
| `z.string()` | `--name <value>` | `--address 0x123...` |
| `z.number()` | `--name <value>` | `--count 5` |
| `z.boolean()` | `--name` (flag) | `--verbose` |
| `z.array(...)` | `--name <value1,value2>` | `--tags tag1,tag2` |
| `z.optional()` | Optional option | Can be omitted |
| `z.union([...])` | String option with validation | Parse and validate |
| `z.literal(...)` | String option | `--status pending` |

---

## Usage Examples

Once implemented, your CLI will support:

```bash
# Show help
your-cli-name

# Start MCP server
your-cli-name mcp --global-opt <value>

# Execute a tool directly
your-cli-name --global-opt <value> example_operation --param1 "test" --param2 42

# Override global option per command
your-cli-name example_operation --param1 "test" --global-opt <other-value>

# Use environment variables
export GLOBAL_OPT=<value>
your-cli-name example_operation --param1 "test"

# Array parameters (comma-separated)
your-cli-name example_operation --tags tag1,tag2,tag3
```

---

## Key Design Decisions

### 1. Global Options Pattern
Use global options (defined on the root program) that all subcommands inherit. This reduces repetition for commonly needed parameters.

### 2. Snake_case Command Names
Keep command names matching tool names exactly (1:1 mapping) to maintain consistency.

### 3. JSON Output
Output tool results as JSON for machine parsing and piping:
```typescript
console.log(JSON.stringify(result.result, null, 2));
```

### 4. Environment Variables
Use environment variables for sensitive data (e.g., API keys, private keys) rather than CLI arguments.

### 5. Array Parsing
Use comma-separated values for array parameters: `--items a,b,c`

---

## Adaptation Checklist

When applying this pattern to your project, ensure you:

- [ ] Adapt `ToolEnvironment` type to match your infrastructure
- [ ] Implement environment setup functions (`getClients`, `createToolEnvironment`, etc.)
- [ ] Configure global options relevant to your domain
- [ ] Set up environment variable handling
- [ ] Implement `registerTool` for MCP server integration
- [ ] Update `package.json` with CLI bin configuration
- [ ] Test MCP server mode (`your-cli mcp --global-opt ...`)
- [ ] Test direct tool execution (`your-cli --global-opt ... tool_name ...`)
- [ ] Verify help text is generated correctly
- [ ] Test parameter validation and error handling

---

## Success Criteria

✅ CLI shows help when no command specified  
✅ `cli mcp --global-opt <value>` starts MCP server  
✅ Each tool has a corresponding CLI command  
✅ Commands accept arguments generated from Zod schemas  
✅ Parameters are validated against schemas before execution  
✅ Results are returned via CLI in readable format (JSON)  
✅ Validation errors are clear and helpful  
✅ Execution errors are properly handled and displayed  
✅ Help text is generated for all commands  
✅ Command names match tool names exactly  

---

## Troubleshooting

### Issue: Commands not appearing
- Verify tools are exported from `src/tools/index.ts`
- Check that `registerAllToolCommands` is called after defining the root program

### Issue: Parameters not validating
- Ensure Zod schema is defined with `.describe()` for help text
- Check that `parseOptionValue` handles your specific field types

### Issue: Environment not initialized
- Verify `createCliToolEnvironment` properly initializes your infrastructure
- Add debug logging to environment setup

### Issue: Global options not passed to commands
- Access global options via `program.opts()` in command action handlers
- Ensure global options are defined before subcommands

---

## Further Extensions

- **Config file support**: Add `--config` option to load settings from a file
- **Output formats**: Support `--format json|yaml|table` for different output styles
- **Interactive mode**: Add an `interactive` command for prompts
- **Batch operations**: Support executing multiple tools from a JSON file
