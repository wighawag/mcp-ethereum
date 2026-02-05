import {z} from 'zod';
import type {Tool, ToolEnvironment, ToolResult} from '../types.js';

export const get_transaction_count: Tool = {
	description: 'Get transaction count (nonce) for an address',
	schema: z.object({
		address: z.string().describe('Address to get transaction count for'),
		blockTag: z
			.union([z.literal('latest'), z.literal('pending'), z.literal('finalized'), z.literal('safe'), z.string()])
			.optional()
			.describe('Block tag to query (default: "latest")'),
	}),
	execute: async (env, {address, blockTag}) => {
		const count = await env.publicClient.getTransactionCount({
			address: address as `0x${string}`,
			blockTag: blockTag as any,
		});

		return {
			success: true,
			result: {
				address,
				blockTag,
				transactionCount: count,
			},
		};
	},
};