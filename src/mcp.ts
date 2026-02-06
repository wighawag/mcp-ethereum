import {McpServer} from '@modelcontextprotocol/sdk/server/mcp.js';
import pkg from '../package.json' with {type: 'json'};
import {Implementation} from '@modelcontextprotocol/sdk/types.js';
import {ServerOptions} from '@modelcontextprotocol/sdk/server';
import * as tools from './tools/index.js';
import {registerAllMCPTools} from './tool-handling/mcp.js';
import {EthereumEnv} from './types.js';

export function createServer(
	env: EthereumEnv,
	options?: {
		serverInfo?: Implementation;
		serverOptions?: ServerOptions;
	},
) {
	const server = new McpServer(
		options?.serverInfo || {
			name: 'tools-ethereum-mcp-server',
			version: pkg.version,
		},
		options?.serverOptions || {capabilities: {logging: {}}},
	);

	registerAllMCPTools({server, tools, env});

	return server;
}
