import {z} from 'zod';
import {createTool} from '../tool-handling/types.js';
import {EthereumEnv} from '../types.js';
const schema = z.object({
	address: z.string().describe('Address to get code from'),
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
export const get_code = createTool<typeof schema, EthereumEnv>({
	description: 'Get bytecode at an address (useful for checking if an address is a contract)',
	schema,
	execute: async (env, {address, blockTag}) => {
		const code = await env.publicClient.getCode({
			address: address as `0x${string}`,
			blockTag: blockTag as any,
		});

		return {
			success: true,
			result: {
				address,
				blockTag,
				isContract: code && code !== '0x',
				codeLength: code ? code.length : 0,
				code: code && code !== '0x' ? code : undefined,
			},
		};
	},
});
