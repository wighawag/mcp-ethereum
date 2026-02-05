#!/usr/bin/env node
import {StdioServerTransport} from '@modelcontextprotocol/sdk/server/stdio.js';
import {createServer} from './index.js';
import {Command} from 'commander';
import pkg from '../package.json' with {type: 'json'};
import {getChain} from './helpers.js';
import {registerAllToolCommands} from './cli-tool-generator.js';
import * as tools from './tools/index.js';

const program = new Command();

const binName = Object.keys(pkg.bin)[0];
program
	.name(binName)
	.description(pkg.description)
	.version(pkg.version)
	// Global option - inherited by all subcommands
	.option('--rpc-url <url>', 'RPC URL for the Ethereum network', '')
	.action(() => {
		// Show help if no command is specified
		program.help();
	});

// mcp subcommand - starts the MCP server
program
	.command('mcp')
	.description('Start the MCP server')
	.action(async () => {
		const options = program.opts();

		const privateKey = process.env.PRIVATE_KEY;
		if (!privateKey) {
			console.warn(
				'Warning: PRIVATE_KEY environment variable is required for sending transactions',
			);
		} else if (!privateKey.startsWith('0x')) {
			console.error('Error: PRIVATE_KEY must start with 0x');
			process.exit(1);
		}

		if (!options.rpcUrl) {
			console.error('Error: --rpc-url option is required');
			process.exit(1);
		}

		const transport = new StdioServerTransport();

		const chain = await getChain(options.rpcUrl);
		const server = createServer({
			chain,
			privateKey: privateKey as `0x${string}`,
		});
		await server.connect(transport);
	});

// Register all tool commands dynamically
registerAllToolCommands(program, tools);

// Parse the command line arguments
program.parse(process.argv);
