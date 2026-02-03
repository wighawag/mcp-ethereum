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
				txHash: z.string().regex(/^0x[a-fA-F0-9]{64}$/).describe('Transaction hash to monitor'),
				expectedConformations: z
					.number()
					.describe('Number of confirmations to wait for')
					.default(1),
				interval: z.number().describe('Interval in seconds between status checks').default(1),
				timeout: z.number().describe('Timeout in seconds').default(300),
			},
		},
		async ({txHash, expectedConformations, interval, timeout}, extra): Promise<CallToolResult> => {
			const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
			const intervalMs = interval * 1000;
			const timeoutMs = timeout * 1000;
			const startTime = Date.now();
			
			const sendStatus = async (message: string) => {
				try {
					await server.sendLoggingMessage(
						{
							level: 'info',
							data: message,
						},
						extra.sessionId,
					);
				} catch (error) {
					console.error('Error sending notification:', error);
				}
			};

			while (Date.now() - startTime < timeoutMs) {
				try {
					// Get current block number
					const currentBlockResult = await rpc.call('eth_blockNumber')();
					if (!currentBlockResult.success) {
						throw new Error(`Failed to get block number: ${currentBlockResult.error.message}`);
					}
					const currentBlockNumber = BigInt(currentBlockResult.value);
					
					// Get transaction receipt
					const receiptResult = await rpc.call('eth_getTransactionReceipt')([txHash as `0x${string}`]);
					if (!receiptResult.success) {
						throw new Error(`Failed to get transaction receipt: ${receiptResult.error.message}`);
					}
					const receipt = receiptResult.value;
					
					if (receipt !== null) {
						const txBlockNumber = BigInt(receipt.blockNumber);
						const confirmations = Number(currentBlockNumber - txBlockNumber);
						
						if (confirmations >= expectedConformations) {
							await sendStatus(
								`Transaction ${txHash} confirmed with ${confirmations} confirmations`
							);
							
							return {
								content: [
									{
										type: 'text',
										text: JSON.stringify({
											status: 'confirmed',
											txHash,
											blockNumber: receipt.blockNumber,
											confirmations,
											receipt,
										}, null, 2),
									},
								],
							};
						}
						
						await sendStatus(
							`Transaction ${txHash} included in block ${txBlockNumber}. Waiting for ${expectedConformations - confirmations} more confirmations...`
						);
					} else {
						await sendStatus(
							`Transaction ${txHash} not yet mined. Checking again in ${interval} seconds...`
						);
					}
				} catch (error) {
					await sendStatus(
						`Error checking transaction status: ${error instanceof Error ? error.message : String(error)}`
					);
				}
				
				// Wait for the specified interval
				await sleep(intervalMs);
			}

			return {
				content: [
					{
						type: 'text',
						text: JSON.stringify({
							status: 'timeout',
							txHash,
							message: `Timeout reached after ${timeout} seconds`,
						}, null, 2),
					},
				],
			};
		},
	);

	return server;
}
