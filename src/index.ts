import {McpServer} from '@modelcontextprotocol/sdk/server/mcp.js';
import pkg from '../package.json' with {type: 'json'};
import z from 'zod';
import {CallToolResult} from '@modelcontextprotocol/sdk/types.js';

export function createServer() {
	const server = new McpServer(
		{
			name: 'ethereum-mcp-server',
			version: pkg.version,
		},
		{capabilities: {logging: {}}},
	);

	server.registerTool(
		'start-notification-stream',
		{
			description: 'Wait For Transaction Confirmation',
			inputSchema: {
				interval: z
					.number()
					.describe('Interval in milliseconds between notifications')
					.default(100),
				count: z.number().describe('Number of notifications to send (0 for 100)').default(10),
			},
		},
		async ({interval, count}, extra): Promise<CallToolResult> => {
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
