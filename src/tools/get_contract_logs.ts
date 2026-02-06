import {z} from 'zod';
import {parseAbiItem, decodeEventLog} from 'viem';
import type {AbiEvent} from 'viem';
import {createTool} from '../tool-handling/types.js';
import {EthereumEnv} from '../types.js';

const schema = z.object({
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
});
export const get_contract_logs = createTool<typeof schema, EthereumEnv>({
	description: 'Fetch logs for a contract, optionally decoding them using event ABI',
	schema,
	execute: async (env, {contractAddress, fromBlock, toBlock, eventAbis}) => {
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

		const logs = await env.publicClient.getLogs(filter);

		let decodedLogs = logs;

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

			decodedLogs = logs.map((log) => {
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
				contractAddress,
				fromBlock,
				toBlock,
				totalLogs: logs.length,
				logs: decodedLogs,
			},
		};
	},
});
