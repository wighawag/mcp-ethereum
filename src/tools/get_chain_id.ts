import {z} from 'zod';
import {createTool} from '../types.js';

export const get_chain_id = createTool({
	description: 'Get current chain ID',
	schema: z.object({}),
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