import {z} from 'zod';
import type {Tool, ToolEnvironment, ToolResult} from '../types.js';

export const get_latest_block: Tool = {
	description: 'Get the latest block information',
	schema: z.object({}),
	execute: async (env) => {
		const block = await env.publicClient.getBlock();

		return {
			success: true,
			result: block,
		};
	},
};