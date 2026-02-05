import {z} from 'zod';
import {createTool} from '../types.js';

export const wait_for_transaction_confirmation = createTool({
	description: 'Wait For Transaction Confirmation',
	schema: z.object({
		txHash: z
			.string()
			.regex(/^0x[a-fA-F0-9]{64}$/)
			.describe('Transaction hash to monitor'),
		expectedConformations: z.number().describe('Number of confirmations to wait for').default(1),
		interval: z.number().describe('Interval in seconds between status checks').default(1),
		timeout: z.number().describe('Timeout in seconds').default(300),
	}),
	execute: async (env, {txHash, expectedConformations, interval, timeout}) => {
		const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
		const intervalMs = interval * 1000;
		const timeoutMs = timeout * 1000;
		const startTime = Date.now();

		while (Date.now() - startTime < timeoutMs) {
			try {
				const currentBlockNumber = await env.publicClient.getBlockNumber();

				const receipt = await env.publicClient.getTransactionReceipt({
					hash: txHash as `0x${string}`,
				});

				if (receipt) {
					const txBlockNumber = receipt.blockNumber;
					const confirmations = Number(currentBlockNumber - txBlockNumber);

					if (receipt.status === 'reverted') {
						await env?.sendStatus?.(`Transaction ${txHash} was reverted`);

						const transaction = await env.publicClient.getTransaction({
							hash: txHash as `0x${string}`,
						});

						return {
							success: true,
							result: {
								status: 'reverted',
								txHash,
								blockNumber: receipt.blockNumber,
								confirmations,
								receipt,
								gasUsed: receipt.gasUsed?.toString(),
								effectiveGasPrice: receipt.effectiveGasPrice?.toString(),
								transaction,
							},
						};
					}

					const block = await env.publicClient.getBlock({
						blockNumber: receipt.blockNumber,
					});

					if (confirmations >= expectedConformations) {
						await env?.sendStatus?.(
							`Transaction ${txHash} confirmed with ${confirmations} confirmations`,
						);

						return {
							success: true,
							result: {
								status: 'confirmed',
								txHash,
								blockNumber: receipt.blockNumber,
								timestamp: block?.timestamp,
								confirmations,
								receipt,
							},
						};
					}

					await env?.sendStatus?.(
						`Transaction ${txHash} included in block ${txBlockNumber}. Waiting for ${expectedConformations - confirmations} more confirmations...`,
					);
				} else {
					await env?.sendStatus?.(
						`Transaction ${txHash} not yet mined. Checking again in ${interval} seconds...`,
					);
				}
			} catch (error) {
				await env?.sendStatus?.(
					`Error checking transaction status: ${error instanceof Error ? error.message : String(error)}`,
				);
			}

			await sleep(intervalMs);
		}

		return {
			success: true,
			result: {
				status: 'timeout',
				txHash,
				message: `Timeout reached after ${timeout} seconds`,
			},
		};
	},
});
