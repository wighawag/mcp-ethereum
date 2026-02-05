import {z} from 'zod';
import {createTool} from '../types.js';

export const get_latest_block = createTool({
	description: 'Get the latest block information',
	schema: z.object({}),
	execute: async (env) => {
		const block = await env.publicClient.getBlock();

		return {
			success: true,
			result: block,
		};
	},
});
