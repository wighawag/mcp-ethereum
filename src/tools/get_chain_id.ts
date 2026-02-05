import {z} from 'zod';
import type {Tool, ToolEnvironment, ToolResult} from '../types.js';

export const get_chain_id: Tool = {
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
};