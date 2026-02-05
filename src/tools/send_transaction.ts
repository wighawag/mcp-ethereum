import {z} from 'zod';
import {createTool} from '../types.js';
import {encodeFunctionData, parseAbiItem} from 'viem';

// Base schema for common fields
const baseSchema = {
	to: z.string().describe('Recipient address or contract address'),
	value: z
		.string()
		.optional()
		.describe('Optional amount of ETH to send in wei (e.g., "1000000000000000000" for 1 ETH)'),
	from: z.string().optional().describe('Optional sender address (must match private key)'),
	maxFeePerGas: z.string().optional().describe('Optional EIP-1559 max fee per gas in wei'),
	maxPriorityFeePerGas: z
		.string()
		.optional()
		.describe('Optional EIP-1559 max priority fee per gas in wei'),
	gas: z.string().optional().describe('Optional gas limit in wei'),
	nonce: z.number().optional().describe('Optional nonce for the transaction'),
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
		.array(z.union([z.string(), z.number(), z.boolean()]))
		.describe('Arguments to pass to the function'),
});

// Schema for simple transfer (no data, no abi/args)
const simpleSchema = z.object({
	...baseSchema,
});

// Combined schema using union - type-safe mutual exclusivity
const sendTransactionSchema = z.union([dataSchema, abiArgsSchema, simpleSchema]);

export const send_transaction = createTool({
	description:
		'Send a transaction, optionally calling a contract function with ABI. Provide either "data" OR "abi"+"args", not both.',
	schema: sendTransactionSchema,
	execute: async (env, params) => {
		const {to, value, from, maxFeePerGas, maxPriorityFeePerGas, gas, nonce} = params;

		if (!env.walletClient) {
			return {
				success: false,
				error: 'privateKey not provided. Cannot send transactions without a private key.',
			};
		}

		const txParams: any = {
			to: to as `0x${string}`,
		};

		if (value) {
			txParams.value = BigInt(value);
		}

		// Use explicit data if provided, otherwise encode from abi+args
		if ('data' in params && params.data) {
			txParams.data = params.data as `0x${string}`;
		} else if ('abi' in params && 'args' in params && params.abi && params.args) {
			const abiItem = parseAbiItem(params.abi);
			if (abiItem.type === 'function') {
				txParams.data = encodeFunctionData({
					abi: [abiItem],
					args: params.args as readonly unknown[],
				});
			}
		}

		if (maxFeePerGas) {
			txParams.maxFeePerGas = BigInt(maxFeePerGas);
		}
		if (maxPriorityFeePerGas) {
			txParams.maxPriorityFeePerGas = BigInt(maxPriorityFeePerGas);
		}

		if (gas) {
			txParams.gas = BigInt(gas);
		}
		if (nonce !== undefined) {
			txParams.nonce = nonce;
		}

		const hash = await env.walletClient.sendTransaction(txParams);

		return {
			success: true,
			result: {
				status: 'sent',
				transactionHash: hash,
				message: `Transaction sent successfully. Use the hash to monitor confirmation: ${hash}`,
			},
		};
	},
});
