import {z} from 'zod';
import {createTool} from '../tool-handling/types.js';
import {EthereumEnv} from '../types.js';

const schema = z.object({
	txHash: z
		.string()
		.regex(/^0x[a-fA-F0-9]{64}$/)
		.describe('Transaction hash to get details for'),
});
export const get_transaction = createTool<typeof schema, EthereumEnv>({
	description: 'Get full transaction details by hash',
	schema,
	execute: async (env, {txHash}) => {
		const transaction = await env.publicClient.getTransaction({
			hash: txHash as `0x${string}`,
		});

		if (!transaction) {
			return {
				success: false,
				error: 'Transaction not found',
			};
		}

		return {
			success: true,
			result: {
				hash: transaction.hash,
				from: transaction.from,
				to: transaction.to,
				value: transaction.value?.toString(),
				gas: transaction.gas?.toString(),
				maxFeePerGas: transaction.maxFeePerGas?.toString(),
				maxPriorityFeePerGas: transaction.maxPriorityFeePerGas?.toString(),
				gasPrice: transaction.gasPrice?.toString(),
				blockNumber: transaction.blockNumber?.toString(),
				blockHash: transaction.blockHash,
				transactionIndex: transaction.transactionIndex,
				nonce: transaction.nonce,
				input: transaction.input,
				type: transaction.type,
				accessList: transaction.accessList,
			},
		};
	},
});
