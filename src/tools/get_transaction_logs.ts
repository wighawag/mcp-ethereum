import {z} from 'zod';
import type {Tool, ToolEnvironment, ToolResult} from '../types.js';
import {parseAbiItem, decodeEventLog} from 'viem';
import type {AbiEvent} from 'viem';

export const get_transaction_logs: Tool = {
	description: 'Get the events/logs of a transaction, optionally decoding them using event ABI',
	schema: z.object({
		txHash: z.string().regex(/^0x[a-fA-F0-9]{64}$/).describe('Transaction hash to get logs from'),
		eventAbis: z.array(z.string()).optional().describe('Optional list of event ABIs to decode logs. Can be Solidity format (e.g., "event Transfer(address indexed from, address indexed to, uint256 amount)") or JSON format'),
	}),
	execute: async (env, {txHash, eventAbis}) => {
		const receipt = await env.publicClient.getTransactionReceipt({
			hash: txHash as `0x${string}`,
		});

		if (!receipt) {
			return {
				success: false,
				error: 'Transaction not found or not yet mined',
			};
		}

		let decodedLogs = receipt.logs;

		if (eventAbis && eventAbis.length > 0) {
			const abiEvents: AbiEvent[] = [];
			for (const eventAbi of eventAbis) {
				try {
					const parsed = JSON.parse(eventAbi);
					if (parsed.type === 'event') {
						abiEvents.push(parsed);
					}
				} catch {
					const abiItem = parseAbiItem(eventAbi);
					if (abiItem.type === 'event') {
						abiEvents.push(abiItem);
					}
				}
			}

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

				if (!decodedLog.decoded) {
					decodedLog.decodeError = 'No matching event ABI found for this log';
				}

				return decodedLog;
			});
		}

		return {
			success: true,
			result: {
				txHash,
				blockNumber: receipt.blockNumber,
				transactionHash: receipt.transactionHash,
				from: receipt.from,
				to: receipt.to,
				status: receipt.status,
				totalLogs: receipt.logs.length,
				logs: decodedLogs,
			},
		};
	},
};