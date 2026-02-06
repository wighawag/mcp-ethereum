import {z} from 'zod';
import {EthereumEnv} from '../types.js';
import {createTool} from '../tool-handling/types.js';

const schema = z.object({});
export const get_gas_price = createTool<typeof schema, EthereumEnv>({
	description: 'Get current gas price',
	schema,
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
							maxFeePerGasInGwei: feeData.maxFeePerGas
								? Number(feeData.maxFeePerGas) / 1e9
								: undefined,
							maxPriorityFeePerGasInGwei: feeData.maxPriorityFeePerGas
								? Number(feeData.maxPriorityFeePerGas) / 1e9
								: undefined,
						}
					: {}),
			},
		};
	},
});
