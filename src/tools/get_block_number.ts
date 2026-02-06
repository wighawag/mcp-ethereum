import {z} from 'zod';
import {EthereumEnv} from '../types.js';
import {createTool} from '../tool-handling/types.js';

const schema = z.object({});
export const get_block_number = createTool<typeof schema, EthereumEnv>({
	description: 'Get current block number',
	schema,
	execute: async (env) => {
		const blockNumber = await env.publicClient.getBlockNumber();

		return {
			success: true,
			result: {
				blockNumber: blockNumber.toString(),
			},
		};
	},
});
