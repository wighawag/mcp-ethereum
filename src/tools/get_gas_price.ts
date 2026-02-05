import {z} from 'zod';
import {createTool} from '../types.js';

export const get_gas_price = createTool({
	description: 'Get current gas price',
	schema: z.object({}),
	execute: async (env) => {
		const [gasPrice, feeData] = await Promise.all([
			env.publicClient.getGasPrice(),
			env.publicClient.estimateFeesPerGas().catch(() => null),
		]);

		return {
			success: true,
			result: {
				gasPrice: gasPrice.toString(),
				gasPriceInGwei: Number(gasPrice) / 1e9,
				...(feeData
					? {
							maxFeePerGas: feeData.maxFeePerGas?.toString(),
							maxPriorityFeePerGas: feeData.maxPriorityFeePerGas?.toString(),
							maxFeePerGasInGwei: feeData.maxFeePerGas ? Number(feeData.maxFeePerGas) / 1e9 : undefined,
							maxPriorityFeePerGasInGwei: feeData.maxPriorityFeePerGas
								? Number(feeData.maxPriorityFeePerGas) / 1e9
								: undefined,
					  }
					: {}),
			},
		};
	},
});