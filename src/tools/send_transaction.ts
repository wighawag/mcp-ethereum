import {z} from 'zod';
import type {Tool, ToolEnvironment, ToolResult} from '../types.js';
import {encodeFunctionData, parseAbiItem} from 'viem';

export const send_transaction: Tool = {
	description: 'Send a transaction, optionally calling a contract function with ABI',
	schema: z.object({
		to: z.string().describe('Recipient address or contract address'),
		value: z.string().optional().describe('Optional amount of ETH to send in wei (e.g., "1000000000000000000" for 1 ETH)'),
		abi: z.string().optional().describe('Optional ABI element for the function to call (e.g., "function transfer(address to, uint256 amount)")'),
		args: z.array(z.union([z.string(), z.number(), z.boolean()])).optional().describe('Optional arguments to pass to the function'),
		maxFeePerGas: z.string().optional().describe('Optional EIP-1559 max fee per gas in wei'),
		maxPriorityFeePerGas: z.string().optional().describe('Optional EIP-1559 max priority fee per gas in wei'),
		gas: z.string().optional().describe('Optional gas limit in wei'),
		nonce: z.number().optional().describe('Optional nonce for the transaction'),
	}),
	execute: async (env, params) => {
		const {to, value, abi, args, maxFeePerGas, maxPriorityFeePerGas, gas, nonce} = params as any;

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

		if (abi && args) {
			const abiItem = parseAbiItem(abi);
			if (abiItem.type === 'function') {
				txParams.data = encodeFunctionData({
					abi: [abiItem],
					args: args as readonly unknown[],
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
				txHash: hash,
				message: `Transaction sent successfully. Use the hash to monitor confirmation: ${hash}`,
			},
		};
	},
};