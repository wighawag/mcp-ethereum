import {z} from 'zod';
import type {Tool, ToolEnvironment, ToolResult} from '../types.js';

export const get_block_number: Tool = {
	description: 'Get current block number',
	schema: z.object({}),
	execute: async (env) => {
		const blockNumber = await env.publicClient.getBlockNumber();

		return {
			success: true,
			result: {
				blockNumber: blockNumber.toString(),
			},
		};
	},
};