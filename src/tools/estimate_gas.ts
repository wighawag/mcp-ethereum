import {z} from 'zod';
import {createTool} from '../types.js';
import {parseAbiItem, encodeFunctionData} from 'viem';
import type {AbiFunction} from 'viem';

export const estimate_gas = createTool({
	description: 'Estimate gas cost for a transaction before sending',
	schema: z.object({
		to: z.string().describe('Recipient address or contract address'),
		value: z
			.string()
			.optional()
			.describe('Optional amount of ETH to send in wei (e.g., "1000000000000000000" for 1 ETH)'),
		abi: z
			.string()
			.optional()
			.describe(
				'Optional ABI element for the function to call (e.g., "function transfer(address to, uint256 amount)")',
			),
		args: z
			.array(z.union([z.string(), z.number(), z.boolean(), z.array(z.any())]))
			.optional()
			.describe('Optional arguments to pass to the function'),
		from: z
			.string()
			.optional()
			.describe('Optional sender address to estimate gas from (default: wallet address)'),
	}),
	execute: async (env, {to, value, abi, args, from}) => {
		const request: any = {
			to: to as `0x${string}`,
		};

		if (value) {
			request.value = BigInt(value);
		}

		if (abi && args) {
			const abiItem = parseAbiItem(abi);
			if (abiItem.type === 'function') {
				request.data = encodeFunctionData({
					abi: [abiItem as AbiFunction],
					args,
				});
			}
		}

		if (from) {
			request.account = from as `0x${string}`;
		} else if (env.walletClient?.account) {
			request.account = env.walletClient.account.address;
		}

		const gasEstimate = await env.publicClient.estimateGas(request);

		return {
			success: true,
			result: {
				to,
				from: from || env.walletClient?.account?.address,
				value: value || '0',
				gasEstimate: gasEstimate.toString(),
				gasEstimateInGwei: Number(gasEstimate) / 1e9,
			},
		};
	},
});
