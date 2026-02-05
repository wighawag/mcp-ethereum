import {z} from 'zod';
import {createTool} from '../types.js';
import {parseAbiItem, encodeFunctionData} from 'viem';
import type {AbiFunction} from 'viem';

// Base schema for common fields
const baseSchema = {
	to: z.string().describe('Recipient address or contract address'),
	value: z
		.string()
		.optional()
		.describe('Optional amount of ETH to send in wei (e.g., "1000000000000000000" for 1 ETH)'),
	from: z
		.string()
		.optional()
		.describe('Optional sender address to estimate gas from (default: wallet address)'),
	blockTag: z
		.union([
			z.literal('latest'),
			z.literal('pending'),
			z.literal('finalized'),
			z.literal('safe'),
			z.string(),
		])
		.optional()
		.describe('Block tag to use for estimation (default: "latest")'),
};

// Schema for raw data input
const dataSchema = z.object({
	...baseSchema,
	data: z.string().describe('Calldata for the transaction'),
});

// Schema for abi+args input
const abiArgsSchema = z.object({
	...baseSchema,
	abi: z
		.string()
		.describe(
			'ABI element for the function to call (e.g., "function transfer(address to, uint256 amount)")',
		),
	args: z
		.array(z.union([z.string(), z.number(), z.boolean(), z.array(z.any())]))
		.describe('Arguments to pass to the function'),
});

// Schema for simple transfer (no data, no abi/args)
const simpleSchema = z.object({
	...baseSchema,
});

// Combined schema using union - type-safe mutual exclusivity
const estimateGasSchema = z.union([dataSchema, abiArgsSchema, simpleSchema]);

export const estimate_gas = createTool({
	description:
		'Estimate gas cost for a transaction before sending. Provide either "data" OR "abi"+"args", not both.',
	schema: estimateGasSchema,
	execute: async (env, params) => {
		const {to, value, from, blockTag} = params;

		const request: any = {
			to: to as `0x${string}`,
		};

		if (value) {
			request.value = BigInt(value);
		}

		// Use explicit data if provided, otherwise encode from abi+args
		if ('data' in params && params.data) {
			request.data = params.data as `0x${string}`;
		} else if ('abi' in params && 'args' in params && params.abi && params.args) {
			const abiItem = parseAbiItem(params.abi);
			if (abiItem.type === 'function') {
				request.data = encodeFunctionData({
					abi: [abiItem as AbiFunction],
					args: params.args,
				});
			}
		}

		if (from) {
			request.account = from as `0x${string}`;
		} else if (env.walletClient?.account) {
			request.account = env.walletClient.account.address;
		}

		if (blockTag) {
			request.blockTag = blockTag as any;
		}

		const gasEstimate = await env.publicClient.estimateGas(request);

		return {
			success: true,
			result: {
				to,
				from: from || env.walletClient?.account?.address,
				value: value || '0',
				gasUsed: gasEstimate.toString(),
				gasEstimateInGwei: Number(gasEstimate) / 1e9,
			},
		};
	},
});
