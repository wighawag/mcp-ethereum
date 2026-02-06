import {z} from 'zod';
import {createTool} from '../tool-handling/types.js';
import {EthereumEnv} from '../types.js';

const schema = z.object({
	address: z.string().describe('Address to get transaction count for'),
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

export const get_transaction_count = createTool<typeof schema, EthereumEnv>({
	description: 'Get transaction count (nonce) for an address',
	schema,
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
});
