import {McpServer} from '@modelcontextprotocol/sdk/server/mcp.js';
import pkg from '../package.json' with {type: 'json'};
import z from 'zod';
import {CallToolResult} from '@modelcontextprotocol/sdk/types.js';
import {createCurriedJSONRPC} from 'remote-procedure-call';
import {Methods} from 'eip-1193';

export function createServer(rpcUrl: string) {
	const server = new McpServer(
		{
			name: 'ethereum-mcp-server',
			version: pkg.version,
		},
		{capabilities: {logging: {}}},
	);

	const rpc = createCurriedJSONRPC<Methods>(rpcUrl);

	server.registerTool(
		'wait-for-transaction-confirmation',
		{
			description: 'Wait For Transaction Confirmation',
			inputSchema: {
				expectedConformations: z
					.number()
					.describe('Number of confirmations to wait for')
					.default(1),
				interval: z.number().describe('Interval in seconds between fetch').default(1),
				timeout: z.number().describe('how many seconds to wait').default(10),
			},
		},
		async ({interval, timeout}, extra): Promise<CallToolResult> => {
			const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
			let counter = 0;

			while (count === 0 || counter < count) {
				counter++;
				try {
					await server.sendLoggingMessage(
						{
							level: 'info',
							data: `Periodic notification #${counter} at ${new Date().toISOString()}`,
						},
						extra.sessionId,
					);
				} catch (error) {
					console.error('Error sending notification:', error);
				}
				// Wait for the specified interval
				await sleep(interval);
			}

			return {
				content: [
					{
						type: 'text',
						text: `Started sending periodic notifications every ${interval}ms`,
					},
				],
			};
		},
	);

	return server;
}
