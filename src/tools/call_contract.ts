import {z} from 'zod';
import {createTool} from '../types.js';
import {parseAbiItem} from 'viem';
import type {AbiFunction} from 'viem';

export const call_contract = createTool({
	description: 'Call a read-only contract function (view/pure) without spending gas',
	schema: z.object({
		address: z.string().describe('Contract address to call'),
		abi: z.string().describe('Function ABI (e.g., "function balanceOf(address) returns (uint256)" or "function totalSupply() returns (uint256)")'),
		args: z.array(z.union([z.string(), z.number(), z.boolean(), z.array(z.any())])).optional().describe('Optional arguments to pass to the function'),
		blockTag: z
			.union([z.literal('latest'), z.literal('pending'), z.literal('finalized'), z.literal('safe'), z.string()])
			.optional()
			.describe('Block tag to query (default: "latest")'),
	}),
	execute: async (env, {address, abi, args, blockTag}) => {
		const abiItem = parseAbiItem(abi);
		if (abiItem.type !== 'function') {
			return {
				success: false,
				error: 'Provided ABI is not a function',
			};
		}

		const result = await env.publicClient.readContract({
			address: address as `0x${string}`,
			abi: [abiItem as AbiFunction],
			functionName: (abiItem as AbiFunction).name,
			args: args as any[],
			blockTag: blockTag as any,
		});

		return {
			success: true,
			result: {
				address,
				functionName: (abiItem as AbiFunction).name,
				blockTag,
				result,
			},
		};
	},
});