import {McpServer} from '@modelcontextprotocol/sdk/server/mcp.js';
import pkg from '../package.json' with {type: 'json'};
import {Implementation} from '@modelcontextprotocol/sdk/types.js';
import {Chain} from 'viem';
import {ServerOptions} from '@modelcontextprotocol/sdk/server';
import {getClients} from './helpers.js';
import {registerTool} from './helpers.js';
import * as tools from './tools/index.js';

export function createServer(
	params: {chain: Chain; privateKey?: `0x${string}`},
	options?: {rpcURL?: string; serverOptions?: ServerOptions; serverInfo?: Implementation},
) {
	const {publicClient, walletClient} = getClients(params, options);

	const server = new McpServer(
		options?.serverInfo || {
			name: 'tools-ethereum-mcp-server',
			version: pkg.version,
		},
		options?.serverOptions || {capabilities: {logging: {}}},
	);

	// Register all tools in a loop
	for (const [name, tool] of Object.entries(tools)) {
		registerTool(
			{
				server,
				name,
				tool,
			},
			publicClient,
			walletClient,
		);
	}

	return server;
}
