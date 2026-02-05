import {z} from 'zod';
import type {Tool, ToolEnvironment, ToolResult} from '../types.js';

export const get_block: Tool = {
	description: 'Get a specific block by number or hash',
	schema: z.object({
		blockNumber: z
			.union([z.number(), z.literal('latest'), z.literal('pending'), z.literal('finalized'), z.literal('safe')])
			.optional()
			.describe('Block number or tag (default: "latest")'),
		blockHash: z.string().optional().describe('Block hash (alternative to blockNumber)'),
		includeTransactions: z.boolean().optional().describe('Whether to include full transaction list (default: false)'),
	}),
	execute: async (env, {blockNumber, blockHash, includeTransactions}) => {
		let block;
		if (blockHash) {
			block = await env.publicClient.getBlock({
				blockHash: blockHash as `0x${string}`,
				includeTransactions: includeTransactions || false,
			});
		} else if (blockNumber !== undefined && typeof blockNumber === 'number') {
			block = await env.publicClient.getBlock({
				blockNumber: BigInt(blockNumber),
				includeTransactions: includeTransactions || false,
			});
		} else {
			block = await env.publicClient.getBlock({
				blockNumber: blockNumber as any,
				includeTransactions: includeTransactions || false,
			});
		}

		const transactionCount = includeTransactions
			? block.transactions.length
			: block.transactions.length;

		return {
			success: true,
			result: {
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
		};
	},
};