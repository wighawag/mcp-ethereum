import {z} from 'zod';
import type {Tool, ToolEnvironment, ToolResult} from '../types.js';
import {parseAbiItem, decodeFunctionData} from 'viem';
import type {AbiFunction} from 'viem';

export const decode_calldata: Tool = {
	description: 'Decode transaction calldata using function ABI',
	schema: z.object({
		data: z.string().describe('Transaction calldata to decode'),
		abi: z.string().describe('Function ABI (e.g., "function transfer(address to, uint256 amount)")'),
	}),
	execute: async (env, {data, abi}) => {
		const abiItem = parseAbiItem(abi);
		if (abiItem.type !== 'function') {
			return {
				success: false,
				error: 'Provided ABI is not a function',
			};
		}

		const decoded = decodeFunctionData({
			data: data as `0x${string}`,
			abi: [abiItem as AbiFunction],
		});

		return {
			success: true,
			result: {
				functionName: decoded.functionName,
				args: decoded.args,
				data,
			},
		};
	},
};