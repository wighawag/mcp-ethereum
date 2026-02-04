import {McpServer} from '@modelcontextprotocol/sdk/server/mcp.js';
import pkg from '../package.json' with {type: 'json'};
import z from 'zod';
import {CallToolResult, Implementation} from '@modelcontextprotocol/sdk/types.js';
import {privateKeyToAccount} from 'viem/accounts';
import {
	Chain,
	createPublicClient,
	createWalletClient,
	http,
	parseAbiItem,
	encodeFunctionData,
	decodeEventLog,
	AbiEvent,
	SendTransactionParameters,
	Account,
} from 'viem';
import {ServerOptions} from '@modelcontextprotocol/sdk/server';
import {getClients, stringifyWithBigInt} from './helpers.js';

export function createServer(
	params: {chain: Chain; privateKey?: `0x${string}`},
	options?: {rpcURL?: string; serverOptions?: ServerOptions; serverInfo?: Implementation},
) {
	const {publicClient, walletClient} = getClients(params, options);

	const server = new McpServer(
		options?.serverInfo || {
			name: 'mcp-ethereum-server',
			version: pkg.version,
		},
		options?.serverOptions || {capabilities: {logging: {}}},
	);

	server.registerTool(
		'wait_for_transaction_confirmation',
		{
			description:
				'Wait For Transaction Confirmation. Returns status: "confirmed" or "reverted" with revertReason for failed transactions',
			inputSchema: {
				txHash: z
					.string()
					.regex(/^0x[a-fA-F0-9]{64}$/)
					.describe('Transaction hash to monitor'),
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
			let lastMilestonePercentage = 0;

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

			const shouldSendProgress = (confirmations: number): boolean => {
				if (expectedConformations <= 1) return false;
				const percentage = Math.floor((confirmations / expectedConformations) * 100);
				const milestones = [25, 50, 75, 100];
				return milestones.some(
					(milestone) => percentage >= milestone && lastMilestonePercentage < milestone,
				);
			};

			const sendProgress = async (confirmations: number) => {
				const percentage = Math.floor((confirmations / expectedConformations) * 100);
				const milestones = [25, 50, 75, 100];
				for (const milestone of milestones) {
					if (percentage >= milestone && lastMilestonePercentage < milestone) {
						await sendStatus(
							`Transaction ${txHash} confirmation progress: ${milestone}% (${confirmations}/${expectedConformations} confirmations)`,
						);
						lastMilestonePercentage = milestone;
					}
				}
			};

			while (Date.now() - startTime < timeoutMs) {
				try {
					// Get current block number
					const currentBlockNumber = await publicClient.getBlockNumber();

					// Get transaction receipt
					const receipt = await publicClient.getTransactionReceipt({
						hash: txHash as `0x${string}`,
					});

					if (receipt) {
						const txBlockNumber = receipt.blockNumber;
						const confirmations = Number(currentBlockNumber - txBlockNumber);

						if (confirmations >= expectedConformations) {
							// Check if transaction was successful
							if (receipt.status === 'success') {
								await sendProgress(confirmations);
								await sendStatus(
									`Transaction ${txHash} confirmed with ${confirmations} confirmations`,
								);

								return {
									content: [
										{
											type: 'text',
											text: stringifyWithBigInt(
												{
													status: 'confirmed',
													txHash,
													blockNumber: receipt.blockNumber,
													confirmations,
													receipt,
												},
												2,
											),
										},
									],
								};
							} else {
								// Transaction reverted - try to get revert reason
								let revertReason = 'Unknown';
								try {
									const tx = await publicClient.getTransaction({
										hash: txHash as `0x${string}`,
									});
									if (tx) {
										try {
											await publicClient.call({
												account: tx.from,
												to: tx.to,
												data: tx.input,
												value: tx.value,
												blockNumber: receipt.blockNumber,
											});
										} catch (callError) {
											revertReason =
												callError instanceof Error ? callError.message : String(callError);
										}
									}
								} catch (error) {
									// Ignore error getting transaction details
								}

								await sendProgress(confirmations);
								await sendStatus(`Transaction ${txHash} reverted: ${revertReason}`);

								return {
									content: [
										{
											type: 'text',
											text: stringifyWithBigInt(
												{
													status: 'reverted',
													txHash,
													blockNumber: receipt.blockNumber,
													confirmations,
													revertReason,
													receipt,
												},
												2,
											),
										},
									],
								};
							}
						}

						if (shouldSendProgress(confirmations)) {
							await sendProgress(confirmations);
						}

						await sendStatus(
							`Transaction ${txHash} included in block ${txBlockNumber}. Waiting for ${expectedConformations - confirmations} more confirmations...`,
						);
					} else {
						await sendStatus(
							`Transaction ${txHash} not yet mined. Checking again in ${interval} seconds...`,
						);
					}
				} catch (error) {
					await sendStatus(
						`Error checking transaction status: ${error instanceof Error ? error.message : String(error)}`,
					);
				}

				// Wait for the specified interval
				await sleep(intervalMs);
			}

			return {
				content: [
					{
						type: 'text',
						text: stringifyWithBigInt(
							{
								status: 'timeout',
								txHash,
								message: `Timeout reached after ${timeout} seconds`,
							},
							2,
						),
					},
				],
			};
		},
	);

	server.registerTool(
		'send_transaction',
		{
			description: 'Send a transaction, optionally calling a contract function with ABI',
			inputSchema: {
				to: z.string().describe('Recipient address or contract address'),
				value: z
					.string()
					.optional()
					.describe(
						'Optional amount of ETH to send in wei (e.g., "1000000000000000000" for 1 ETH)',
					),
				abi: z
					.string()
					.optional()
					.describe(
						'Optional ABI element for the function to call (e.g., "function transfer(address to, uint256 amount)")',
					),
				args: z
					.array(z.union([z.string(), z.number(), z.boolean()]))
					.optional()
					.describe('Optional arguments to pass to the function'),
			},
		},
		async ({to, value, abi, args}, extra): Promise<CallToolResult> => {
			try {
				if (!walletClient) {
					return {
						content: [
							{
								type: 'text',
								text: stringifyWithBigInt(
									{
										error:
											'privateKey not provided. Cannot send transactions without a private key.',
									},
									2,
								),
							},
						],
						isError: true,
					};
				}

				const txParams: SendTransactionParameters<Chain, Account> = {
					to: to as `0x${string}`,
				};

				if (value) {
					txParams.value = BigInt(value);
				}

				// If ABI is provided, encode the function call
				if (abi && args) {
					txParams.data = encodeFunctionData({
						abi: [parseAbiItem(abi)],
						args,
					});
				}

				const hash = await walletClient.sendTransaction(txParams);

				return {
					content: [
						{
							type: 'text',
							text: stringifyWithBigInt(
								{
									status: 'sent',
									txHash: hash,
									message: `Transaction sent successfully. Use the hash to monitor confirmation: ${hash}`,
								},
								2,
							),
						},
					],
				};
			} catch (error) {
				return {
					content: [
						{
							type: 'text',
							text: stringifyWithBigInt(
								{
									error: error instanceof Error ? error.message : String(error),
									stack: error instanceof Error ? error.stack : undefined,
								},
								2,
							),
						},
					],
					isError: true,
				};
			}
		},
	);

	server.registerTool(
		'get_contract_logs',
		{
			description: 'Fetch logs for a contract, optionally decoding them using event ABI',
			inputSchema: {
				contractAddress: z.string().describe('Contract address to fetch logs from'),
				fromBlock: z
					.union([z.number(), z.literal('latest'), z.literal('pending')])
					.optional()
					.describe('Starting block number (or "latest", "pending")'),
				toBlock: z
					.union([z.number(), z.literal('latest'), z.literal('pending')])
					.optional()
					.describe('Ending block number (or "latest", "pending")'),
				eventAbis: z
					.array(z.string())
					.optional()
					.describe(
						'Optional list of event ABIs to decode logs. Can be Solidity format (e.g., "event Transfer(address indexed from, address indexed to, uint256 amount)") or JSON format',
					),
			},
		},
		async ({contractAddress, fromBlock, toBlock, eventAbis}, extra): Promise<CallToolResult> => {
			try {
				const filter: any = {
					address: contractAddress as `0x${string}`,
					fromBlock:
						fromBlock !== undefined
							? typeof fromBlock === 'number'
								? BigInt(fromBlock)
								: fromBlock
							: 'latest',
					toBlock:
						toBlock !== undefined
							? typeof toBlock === 'number'
								? BigInt(toBlock)
								: toBlock
							: 'latest',
				};

				const logs = await publicClient.getLogs(filter);

				let decodedLogs = logs;

				// If event ABIs are provided, decode the logs
				if (eventAbis && eventAbis.length > 0) {
					// Parse all event ABIs (support both Solidity and JSON formats)
					const abiEvents: AbiEvent[] = [];
					for (const eventAbi of eventAbis) {
						try {
							// Try parsing as JSON first
							const parsed = JSON.parse(eventAbi);
							if (parsed.type === 'event') {
								abiEvents.push(parsed);
							}
						} catch {
							// If JSON parsing fails, treat as Solidity format
							const abiItem = parseAbiItem(eventAbi);
							if (abiItem.type === 'event') {
								abiEvents.push(abiItem);
							}
						}
					}

					// Try to decode each log against all provided event ABIs
					decodedLogs = logs.map((log) => {
						let decodedLog: any = {...log};

						try {
							const decoded = decodeEventLog({
								abi: abiEvents,
								data: log.data,
								topics: log.topics,
							});
							decodedLog.decoded = decoded;
							// Successfully decoded, no need to try other events
						} catch {
							// This log cannot be decoded with the abi provided
						}

						// If no event matched the log
						if (!decodedLog.decoded) {
							decodedLog.decodeError = 'No matching event ABI found for this log';
						}

						return decodedLog;
					});
				}

				return {
					content: [
						{
							type: 'text',
							text: stringifyWithBigInt(
								{
									contractAddress,
									fromBlock,
									toBlock,
									totalLogs: logs.length,
									logs: decodedLogs,
								},
								2,
							),
						},
					],
				};
			} catch (error) {
				return {
					content: [
						{
							type: 'text',
							text: stringifyWithBigInt(
								{
									error: error instanceof Error ? error.message : String(error),
								},
								2,
							),
						},
					],
					isError: true,
				};
			}
		},
	);

	server.registerTool(
		'get_transaction_logs',
		{
			description: 'Get the events/logs of a transaction, optionally decoding them using event ABI',
			inputSchema: {
				txHash: z
					.string()
					.regex(/^0x[a-fA-F0-9]{64}$/)
					.describe('Transaction hash to get logs from'),
				eventAbis: z
					.array(z.string())
					.optional()
					.describe(
						'Optional list of event ABIs to decode logs. Can be Solidity format (e.g., "event Transfer(address indexed from, address indexed to, uint256 amount)") or JSON format',
					),
			},
		},
		async ({txHash, eventAbis}, extra): Promise<CallToolResult> => {
			try {
				// Get transaction receipt which contains the logs
				const receipt = await publicClient.getTransactionReceipt({
					hash: txHash as `0x${string}`,
				});

				if (!receipt) {
					return {
						content: [
							{
								type: 'text',
								text: stringifyWithBigInt(
									{
										error: 'Transaction not found or not yet mined',
										txHash,
									},
									2,
								),
							},
						],
						isError: true,
					};
				}

				let decodedLogs = receipt.logs;

				// If event ABIs are provided, decode the logs
				if (eventAbis && eventAbis.length > 0) {
					// Parse all event ABIs (support both Solidity and JSON formats)
					const abiEvents: AbiEvent[] = [];
					for (const eventAbi of eventAbis) {
						try {
							// Try parsing as JSON first
							const parsed = JSON.parse(eventAbi);
							if (parsed.type === 'event') {
								abiEvents.push(parsed);
							}
						} catch {
							// If JSON parsing fails, treat as Solidity format
							const abiItem = parseAbiItem(eventAbi);
							if (abiItem.type === 'event') {
								abiEvents.push(abiItem);
							}
						}
					}

					// Try to decode each log against all provided event ABIs
					decodedLogs = receipt.logs.map((log) => {
						let decodedLog: any = {...log};

						try {
							const decoded = decodeEventLog({
								abi: abiEvents,
								data: log.data,
								topics: log.topics,
							});
							decodedLog.decoded = decoded;
						} catch {
							// This log cannot be decoded with the abi provided
						}

						// If no event matched the log
						if (!decodedLog.decoded) {
							decodedLog.decodeError = 'No matching event ABI found for this log';
						}

						return decodedLog;
					});
				}

				return {
					content: [
						{
							type: 'text',
							text: stringifyWithBigInt(
								{
									txHash,
									blockNumber: receipt.blockNumber,
									transactionHash: receipt.transactionHash,
									from: receipt.from,
									to: receipt.to,
									status: receipt.status,
									totalLogs: receipt.logs.length,
									logs: decodedLogs,
								},
								2,
							),
						},
					],
				};
			} catch (error) {
				return {
					content: [
						{
							type: 'text',
							text: stringifyWithBigInt(
								{
									error: error instanceof Error ? error.message : String(error),
								},
								2,
							),
						},
					],
					isError: true,
				};
			}
		},
	);

	server.registerTool(
		'get_latest_block',
		{
			description: 'Get the latest block information',
			inputSchema: {},
		},
		async (_params, extra): Promise<CallToolResult> => {
			try {
				const block = await publicClient.getBlock();

				return {
					content: [
						{
							type: 'text',
							text: stringifyWithBigInt(block, 2),
						},
					],
				};
			} catch (error) {
				return {
					content: [
						{
							type: 'text',
							text: stringifyWithBigInt(
								{
									error: error instanceof Error ? error.message : String(error),
								},
								2,
							),
						},
					],
					isError: true,
				};
			}
		},
	);

	return server;
}
