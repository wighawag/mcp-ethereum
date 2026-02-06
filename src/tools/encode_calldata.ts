import {z} from 'zod';
import {parseAbiItem, encodeFunctionData} from 'viem';
import type {AbiFunction} from 'viem';
import {createTool} from '../tool-handling/types.js';
import {EthereumEnv} from '../types.js';

const schema = z.object({
	abi: z.string().describe('Function ABI (e.g., "function transfer(address to, uint256 amount)")'),
	args: z
		.array(z.union([z.string(), z.number(), z.boolean(), z.array(z.any())]))
		.optional()
		.describe('Optional arguments to pass to the function'),
});

export const encode_calldata = createTool<typeof schema, EthereumEnv>({
	description: 'Encode function arguments for transactions',
	schema,
	execute: async (env, {abi, args}) => {
		const abiItem = parseAbiItem(abi);
		if (abiItem.type !== 'function') {
			return {
				success: false,
				error: 'Provided ABI is not a function',
			};
		}

		const encoded = encodeFunctionData({
			abi: [abiItem as AbiFunction],
			args: args || [],
		});

		return {
			success: true,
			result: {
				functionName: (abiItem as AbiFunction).name,
				args: args || [],
				calldata: encoded,
			},
		};
	},
});
