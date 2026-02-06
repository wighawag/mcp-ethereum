import {z} from 'zod';
import {createTool} from '../tool-handling/types.js';
import {EthereumEnv} from '../types.js';

const schema = z.object({});
export const get_latest_block = createTool<typeof schema, EthereumEnv>({
	description: 'Get the latest block information',
	schema,
	execute: async (env) => {
		const block = await env.publicClient.getBlock();

		return {
			success: true,
			result: block,
		};
	},
});
