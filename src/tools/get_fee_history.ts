import {z} from 'zod';
import {createTool} from '../tool-handling/types.js';
import {EthereumEnv} from '../types.js';

const schema = z.object({
	blockCount: z.number().describe('Number of blocks to fetch fee history for'),
	newestBlock: z
		.union([z.number(), z.literal('pending'), z.literal('latest')])
		.describe('Newest block number or "latest" or "pending"'),
	rewardPercentiles: z
		.array(z.number())
		.default([25, 50, 75])
		.describe('Array of percentiles to return reward data (e.g., [25, 50, 75])'),
});
export const get_fee_history = createTool<typeof schema, EthereumEnv>({
	description: 'Get historical gas fee data for EIP-1559 pricing',
	schema,
	execute: async (env, {blockCount, newestBlock, rewardPercentiles}) => {
		const feeHistory = await env.publicClient.getFeeHistory({
			blockCount: blockCount as any,
			blockNumber: newestBlock as any,
			rewardPercentiles,
		});

		return {
			success: true,
			result: {
				oldestBlock: feeHistory.oldestBlock?.toString(),
				baseFeePerGas: feeHistory.baseFeePerGas.map((fee) => fee.toString()),
				gasUsedRatio: feeHistory.gasUsedRatio,
				reward: feeHistory.reward?.map((rewards) => rewards.map((r) => r.toString())),
			},
		};
	},
});
