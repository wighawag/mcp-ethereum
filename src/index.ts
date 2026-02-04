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
	decodeFunctionData,
	AbiEvent,
	SendTransactionParameters,
	Account,
	AbiFunction,
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
			description: 'Wait For Transaction Confirmation',
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
					const currentBlockNumber = await publicClient.getBlockNumber();

					// Get transaction receipt
					const receipt = await publicClient.getTransactionReceipt({
						hash: txHash as `0x${string}`,
					});

					if (receipt) {
						const txBlockNumber = receipt.blockNumber;
						const confirmations = Number(currentBlockNumber - txBlockNumber);

						// Check if transaction reverted
						if (receipt.status === 'reverted') {
							await sendStatus(
								`Transaction ${txHash} was reverted`,
							);

							// Try to get the transaction to include more details
							const transaction = await publicClient.getTransaction({
								hash: txHash as `0x${string}`,
							});

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
												receipt,
												gasUsed: receipt.gasUsed?.toString(),
												effectiveGasPrice: receipt.effectiveGasPrice?.toString(),
												transaction,
											},
											2,
										),
									},
								],
								isError: true,
							};
						}

						// Get block for timestamp
						const block = await publicClient.getBlock({
							blockNumber: receipt.blockNumber,
						});

						if (confirmations >= expectedConformations) {
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
												timestamp: block?.timestamp,
												confirmations,
												receipt,
											},
											2,
										),
									},
								],
							};
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
				maxFeePerGas: z
					.string()
					.optional()
					.describe('Optional EIP-1559 max fee per gas in wei'),
				maxPriorityFeePerGas: z
					.string()
					.optional()
					.describe('Optional EIP-1559 max priority fee per gas in wei'),
				gas: z.string().optional().describe('Optional gas limit in wei'),
				nonce: z.number().optional().describe('Optional nonce for the transaction'),
			},
		},
		async ({to, value, abi, args, maxFeePerGas, maxPriorityFeePerGas, gas, nonce}, extra): Promise<CallToolResult> => {
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

				// EIP-1559 support
				if (maxFeePerGas) {
					txParams.maxFeePerGas = BigInt(maxFeePerGas);
				}
				if (maxPriorityFeePerGas) {
					txParams.maxPriorityFeePerGas = BigInt(maxPriorityFeePerGas);
				}

				// Optional gas limit and nonce
				if (gas) {
					txParams.gas = BigInt(gas);
				}
				if (nonce !== undefined) {
					txParams.nonce = nonce;
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

	// Phase 1: Core Missing Functionality

	server.registerTool(
		'call_contract',
		{
			description: 'Call a read-only contract function (view/pure) without spending gas',
			inputSchema: {
				address: z.string().describe('Contract address to call'),
				abi: z
					.string()
					.describe(
						'Function ABI (e.g., "function balanceOf(address) returns (uint256)" or "function totalSupply() returns (uint256)")',
					),
				args: z
					.array(z.union([z.string(), z.number(), z.boolean(), z.array(z.any())]))
					.optional()
					.describe('Optional arguments to pass to the function'),
				blockTag: z
					.union([z.literal('latest'), z.literal('pending'), z.literal('finalized'), z.literal('safe'), z.string()])
					.optional()
					.describe('Block tag to query (default: "latest")'),
			},
		},
		async ({address, abi, args, blockTag}, _extra): Promise<CallToolResult> => {
			try {
				const abiItem = parseAbiItem(abi);
				if (abiItem.type !== 'function') {
					return {
						content: [
							{
								type: 'text',
								text: stringifyWithBigInt(
									{error: 'Provided ABI is not a function'},
									2,
								),
							},
						],
						isError: true,
					};
				}

				const result = await publicClient.readContract({
					address: address as `0x${string}`,
					abi: [abiItem as AbiFunction],
					functionName: (abiItem as AbiFunction).name,
					args: args as any[],
					blockTag: blockTag as any,
				});

				return {
					content: [
						{
							type: 'text',
							text: stringifyWithBigInt(
								{
									address,
									functionName: (abiItem as AbiFunction).name,
									blockTag,
									result,
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
		'get_balance',
		{
			description: 'Get ETH balance for an address',
			inputSchema: {
				address: z.string().describe('Address to check balance'),
				blockTag: z
					.union([z.literal('latest'), z.literal('pending'), z.literal('finalized'), z.literal('safe'), z.string()])
					.optional()
					.describe('Block tag to query (default: "latest")'),
			},
		},
		async ({address, blockTag}, _extra): Promise<CallToolResult> => {
			try {
				const balance = await publicClient.getBalance({
					address: address as `0x${string}`,
					blockTag: blockTag as any,
				});

				return {
					content: [
						{
							type: 'text',
							text: stringifyWithBigInt(
								{
									address,
									blockTag,
									balance: balance.toString(),
									balanceInEther: Number(balance) / 1e18,
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
		'estimate_gas',
		{
			description: 'Estimate gas cost for a transaction before sending',
			inputSchema: {
				to: z.string().describe('Recipient address or contract address'),
				value: z
					.string()
					.optional()
					.describe('Optional amount of ETH to send in wei (e.g., "1000000000000000000" for 1 ETH)'),
				abi: z
					.string()
					.optional()
					.describe(
						'Optional ABI element for the function to call (e.g., "function transfer(address to, uint256 amount)")',
					),
				args: z
					.array(z.union([z.string(), z.number(), z.boolean(), z.array(z.any())]))
					.optional()
					.describe('Optional arguments to pass to the function'),
			},
		},
		async ({to, value, abi, args}, _extra): Promise<CallToolResult> => {
			try {
				const request: any = {
					to: to as `0x${string}`,
				};

				if (value) {
					request.value = BigInt(value);
				}

				if (abi && args) {
					const abiItem = parseAbiItem(abi);
					if (abiItem.type === 'function') {
						request.data = encodeFunctionData({
							abi: [abiItem as AbiFunction],
							args,
						});
					}
				}

				const gasEstimate = await publicClient.estimateGas(request);

				return {
					content: [
						{
							type: 'text',
							text: stringifyWithBigInt(
								{
									to,
									value: value || '0',
									gasEstimate: gasEstimate.toString(),
									gasEstimateInGwei: Number(gasEstimate) / 1e9,
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
		'get_block',
		{
			description: 'Get a specific block by number or hash',
			inputSchema: {
				blockNumber: z
					.union([z.number(), z.literal('latest'), z.literal('pending'), z.literal('finalized'), z.literal('safe')])
					.optional()
					.describe('Block number or tag (default: "latest")'),
				blockHash: z.string().optional().describe('Block hash (alternative to blockNumber)'),
				includeTransactions: z
					.boolean()
					.optional()
					.describe('Whether to include full transaction list (default: false)'),
			},
		},
		async ({blockNumber, blockHash, includeTransactions}, _extra): Promise<CallToolResult> => {
			try {
				let block;
				if (blockHash) {
					block = await publicClient.getBlock({
						blockHash: blockHash as `0x${string}`,
						includeTransactions: includeTransactions || false,
					});
				} else if (blockNumber !== undefined && typeof blockNumber === 'number') {
					block = await publicClient.getBlock({
						blockNumber: BigInt(blockNumber),
						includeTransactions: includeTransactions || false,
					});
				} else {
					// blockNumber is 'latest', 'pending', 'finalized', 'safe', or undefined
					block = await publicClient.getBlock({
						blockNumber: blockNumber as any,
						includeTransactions: includeTransactions || false,
					});
				}

				const transactionCount = includeTransactions
					? block.transactions.length
					: block.transactions.length;

				return {
					content: [
						{
							type: 'text',
							text: stringifyWithBigInt(
								{
									blockNumber: block.number?.toString(),
									blockHash: block.hash,
									parentHash: block.parentHash,
									timestamp: block.timestamp,
									gasUsed: block.gasUsed?.toString(),
									gasLimit: block.gasLimit?.toString(),
									baseFeePerGas: block.baseFeePerGas?.toString(),
									transactionCount,
									transactions: includeTransactions ? block.transactions : undefined,
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

	// Phase 2: Transaction Management

	server.registerTool(
		'get_transaction',
		{
			description: 'Get full transaction details by hash',
			inputSchema: {
				txHash: z
					.string()
					.regex(/^0x[a-fA-F0-9]{64}$/)
					.describe('Transaction hash to get details for'),
			},
		},
		async ({txHash}, _extra): Promise<CallToolResult> => {
			try {
				const transaction = await publicClient.getTransaction({
					hash: txHash as `0x${string}`,
				});

				if (!transaction) {
					return {
						content: [
							{
								type: 'text',
								text: stringifyWithBigInt(
									{error: 'Transaction not found', txHash},
									2,
								),
							},
						],
						isError: true,
					};
				}

				return {
					content: [
						{
							type: 'text',
							text: stringifyWithBigInt(
								{
									hash: transaction.hash,
									from: transaction.from,
									to: transaction.to,
									value: transaction.value?.toString(),
									gas: transaction.gas?.toString(),
									maxFeePerGas: transaction.maxFeePerGas?.toString(),
									maxPriorityFeePerGas: transaction.maxPriorityFeePerGas?.toString(),
									gasPrice: transaction.gasPrice?.toString(),
									blockNumber: transaction.blockNumber?.toString(),
									blockHash: transaction.blockHash,
									transactionIndex: transaction.transactionIndex,
									nonce: transaction.nonce,
									input: transaction.input,
									type: transaction.type,
									accessList: transaction.accessList,
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
		'get_block_number',
		{
			description: 'Get current block number',
			inputSchema: {},
		},
		async (_params, _extra): Promise<CallToolResult> => {
			try {
				const blockNumber = await publicClient.getBlockNumber();

				return {
					content: [
						{
							type: 'text',
							text: stringifyWithBigInt(
								{
									blockNumber: blockNumber.toString(),
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
		'get_gas_price',
		{
			description: 'Get current gas price',
			inputSchema: {},
		},
		async (_params, _extra): Promise<CallToolResult> => {
			try {
				const [gasPrice, feeData] = await Promise.all([
					publicClient.getGasPrice(),
					publicClient.estimateFeesPerGas().catch(() => null),
				]);

				return {
					content: [
						{
							type: 'text',
							text: stringifyWithBigInt(
								{
									gasPrice: gasPrice.toString(),
									gasPriceInGwei: Number(gasPrice) / 1e9,
									...(feeData
										? {
												maxFeePerGas: feeData.maxFeePerGas?.toString(),
												maxPriorityFeePerGas: feeData.maxPriorityFeePerGas?.toString(),
												maxFeePerGasInGwei: feeData.maxFeePerGas ? Number(feeData.maxFeePerGas) / 1e9 : undefined,
												maxPriorityFeePerGasInGwei: feeData.maxPriorityFeePerGas
													? Number(feeData.maxPriorityFeePerGas) / 1e9
													: undefined,
										  }
										: {}),
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
		'get_transaction_count',
		{
			description: 'Get transaction count (nonce) for an address',
			inputSchema: {
				address: z.string().describe('Address to get transaction count for'),
				blockTag: z
					.union([z.literal('latest'), z.literal('pending'), z.literal('finalized'), z.literal('safe'), z.string()])
					.optional()
					.describe('Block tag to query (default: "latest")'),
			},
		},
		async ({address, blockTag}, _extra): Promise<CallToolResult> => {
			try {
				const count = await publicClient.getTransactionCount({
					address: address as `0x${string}`,
					blockTag: blockTag as any,
				});

				return {
					content: [
						{
							type: 'text',
							text: stringifyWithBigInt(
								{
									address,
									blockTag,
									transactionCount: count,
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

	// Phase 3: Advanced Features

	server.registerTool(
		'decode_calldata',
		{
			description: 'Decode transaction calldata using function ABI',
			inputSchema: {
				data: z.string().describe('Transaction calldata to decode'),
				abi: z
					.string()
					.describe(
						'Function ABI (e.g., "function transfer(address to, uint256 amount)")',
					),
			},
		},
		async ({data, abi}, _extra): Promise<CallToolResult> => {
			try {
				const abiItem = parseAbiItem(abi);
				if (abiItem.type !== 'function') {
					return {
						content: [
							{
								type: 'text',
								text: stringifyWithBigInt(
									{error: 'Provided ABI is not a function'},
									2,
								),
							},
						],
						isError: true,
					};
				}

				const decoded = decodeFunctionData({
					data: data as `0x${string}`,
					abi: [abiItem as AbiFunction],
				});

				return {
					content: [
						{
							type: 'text',
							text: stringifyWithBigInt(
								{
									functionName: decoded.functionName,
									args: decoded.args,
									data,
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
		'encode_calldata',
		{
			description: 'Encode function arguments for transactions',
			inputSchema: {
				abi: z
					.string()
					.describe(
						'Function ABI (e.g., "function transfer(address to, uint256 amount)")',
					),
				args: z
					.array(z.union([z.string(), z.number(), z.boolean(), z.array(z.any())]))
					.describe('Arguments to pass to the function'),
			},
		},
		async ({abi, args}, _extra): Promise<CallToolResult> => {
			try {
				const abiItem = parseAbiItem(abi);
				if (abiItem.type !== 'function') {
					return {
						content: [
							{
								type: 'text',
								text: stringifyWithBigInt(
									{error: 'Provided ABI is not a function'},
									2,
								),
							},
						],
						isError: true,
					};
				}

				const encoded = encodeFunctionData({
					abi: [abiItem as AbiFunction],
					args,
				});

				return {
					content: [
						{
							type: 'text',
							text: stringifyWithBigInt(
								{
									functionName: (abiItem as AbiFunction).name,
									args,
									encodedData: encoded,
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
		'get_chain_id',
		{
			description: 'Get current chain ID',
			inputSchema: {},
		},
		async (_params, _extra): Promise<CallToolResult> => {
			try {
				const chainId = await publicClient.getChainId();

				return {
					content: [
						{
							type: 'text',
							text: stringifyWithBigInt(
								{
									chainId,
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
		'get_code',
		{
			description: 'Get bytecode at an address (useful for checking if an address is a contract)',
			inputSchema: {
				address: z.string().describe('Address to get code from'),
				blockTag: z
					.union([z.literal('latest'), z.literal('pending'), z.literal('finalized'), z.literal('safe'), z.string()])
					.optional()
					.describe('Block tag to query (default: "latest")'),
			},
		},
		async ({address, blockTag}, _extra): Promise<CallToolResult> => {
			try {
				const code = await publicClient.getCode({
					address: address as `0x${string}`,
					blockTag: blockTag as any,
				});
	
				return {
					content: [
						{
							type: 'text',
							text: stringifyWithBigInt(
								{
									address,
									blockTag,
									isContract: code && code !== '0x',
									codeLength: code ? code.length : 0,
									code: code && code !== '0x' ? code : undefined,
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

	// Phase 4: Nice-to-Have Features

	server.registerTool(
		'get_fee_history',
		{
			description: 'Get historical gas fee data for EIP-1559 pricing',
			inputSchema: {
				blockCount: z.number().describe('Number of blocks to fetch fee history for'),
				newestBlock: z.union([z.number(), z.literal('pending'), z.literal('latest')]).describe('Newest block number or "latest" or "pending"'),
				rewardPercentiles: z
					.array(z.number())
					.default([25, 50, 75])
					.describe('Array of percentiles to return reward data (e.g., [25, 50, 75])'),
			},
		},
		async ({blockCount, newestBlock, rewardPercentiles}, _extra): Promise<CallToolResult> => {
			try {
				const feeHistory = await publicClient.getFeeHistory({
					blockCount: blockCount as any,
					blockNumber: newestBlock as any,
					rewardPercentiles,
				});

				return {
					content: [
						{
							type: 'text',
							text: stringifyWithBigInt(
								{
									oldestBlock: feeHistory.oldestBlock?.toString(),
									baseFeePerGas: feeHistory.baseFeePerGas.map((fee) => fee.toString()),
									gasUsedRatio: feeHistory.gasUsedRatio,
									reward: feeHistory.reward?.map((rewards) => rewards.map((r) => r.toString())),
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
		'sign_message',
		{
			description: 'Sign a message using the wallet (personal_sign)',
			inputSchema: {
				message: z.string().describe('Message to sign'),
			},
		},
		async ({message}, _extra): Promise<CallToolResult> => {
			try {
				if (!walletClient) {
					return {
						content: [
							{
								type: 'text',
								text: stringifyWithBigInt(
									{
										error: 'privateKey not provided. Cannot sign messages without a private key.',
									},
									2,
								),
							},
						],
						isError: true,
					};
				}

				const signature = await walletClient.signMessage({
					message,
				});

				return {
					content: [
						{
							type: 'text',
							text: stringifyWithBigInt(
								{
									message,
									signature,
									address: walletClient.account.address,
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
		'get_storage_at',
		{
			description: 'Get contract storage value at a specific slot',
			inputSchema: {
				address: z.string().describe('Contract address'),
				slot: z.union([z.string(), z.number()]).describe('Storage slot (hex string or number)'),
				blockTag: z
					.union([z.literal('latest'), z.literal('pending'), z.literal('finalized'), z.literal('safe'), z.string()])
					.optional()
					.describe('Block tag to query (default: "latest")'),
			},
		},
		async ({address, slot, blockTag}, _extra): Promise<CallToolResult> => {
			try {
				const storage = await publicClient.getStorageAt({
					address: address as `0x${string}`,
					slot: typeof slot === 'string' ? (slot as `0x${string}`) : `0x${BigInt(slot).toString(16)}`,
					blockTag: blockTag as any,
				});
	
				return {
					content: [
						{
							type: 'text',
							text: stringifyWithBigInt(
								{
									address,
									slot: typeof slot === 'string' ? slot : slot.toString(),
									blockTag,
									storage: storage || '0x',
									storageAsNumber: storage && storage !== '0x' ? BigInt(storage).toString() : '0',
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

	return server;
}
