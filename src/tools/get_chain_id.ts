import {z} from 'zod';
import {createTool} from '../tool-handling/types.js';
import {EthereumEnv} from '../types.js';

const schema = z.object({});
export const get_chain_id = createTool<typeof schema, EthereumEnv>({
	description: 'Get current chain ID',
	schema,
	execute: async (env) => {
		const chainId = await env.publicClient.getChainId();

		return {
			success: true,
			result: {
				chainId,
			},
		};
	},
});
