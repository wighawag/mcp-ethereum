import {z} from 'zod';
import {EthereumEnv} from '../types.js';
import {createTool} from '../tool-handling/types.js';

const schema = z.object({
	address: z.string().describe('Address to check balance'),
	blockTag: z
		.union([
			z.literal('latest'),
			z.literal('pending'),
			z.literal('finalized'),
			z.literal('safe'),
			z.string(),
		])
		.optional()
		.describe('Block tag to query (default: "latest")'),
});
export const get_balance = createTool<typeof schema, EthereumEnv>({
	description: 'Get ETH balance for an address',
	schema,
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
