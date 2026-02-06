import {z} from 'zod';
import {parseAbiItem, decodeFunctionData} from 'viem';
import type {AbiFunction} from 'viem';
import {createTool} from '../tool-handling/types.js';
import {EthereumEnv} from '../types.js';

const schema = z.object({
	calldata: z.string().describe('Transaction calldata to decode'),
	abi: z
		.string()
		.optional()
		.describe('Function ABI (e.g., "function transfer(address to, uint256 amount)")'),
});
export const decode_calldata = createTool<typeof schema, EthereumEnv>({
	description: 'Decode transaction calldata using function ABI',
	schema,
	execute: async (env, {calldata, abi}) => {
		// If no ABI provided, just return the raw calldata info (selector)
		if (!abi) {
			const selector = calldata.slice(0, 10);
			return {
				success: true,
				result: {
					selector,
					calldata,
					message: 'No ABI provided - showing raw selector only',
				},
			};
		}

		const abiItem = parseAbiItem(abi);
		if (abiItem.type !== 'function') {
			return {
				success: false,
				error: 'Provided ABI is not a function',
			};
		}

		const decoded = decodeFunctionData({
			data: calldata as `0x${string}`,
			abi: [abiItem as AbiFunction],
		});

		return {
			success: true,
			result: {
				functionName: decoded.functionName,
				args: decoded.args,
				calldata,
			},
		};
	},
});
