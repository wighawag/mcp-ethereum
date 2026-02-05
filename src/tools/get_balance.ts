import {z} from 'zod';
import {createTool} from '../types.js';

export const get_balance = createTool({
	description: 'Get ETH balance for an address',
	schema: z.object({
		address: z.string().describe('Address to check balance'),
		blockTag: z
			.union([z.literal('latest'), z.literal('pending'), z.literal('finalized'), z.literal('safe'), z.string()])
			.optional()
			.describe('Block tag to query (default: "latest")'),
	}),
	execute: async (env, {address, blockTag}) => {
		const balance = await env.publicClient.getBalance({
			address: address as `0x${string}`,
			blockTag: blockTag as any,
		});

		return {
			success: true,
			result: {
				address,
				blockTag,
				balance: balance.toString(),
				balanceInEther: Number(balance) / 1e18,
			},
		};
	},
});