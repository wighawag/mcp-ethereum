import {z} from 'zod';
import {createTool} from '../types.js';

export const wait_for_transaction_confirmation = createTool({
	description: 'Wait For Transaction Confirmation',
	schema: z.object({
		hash: z
			.string()
			.regex(/^0x[a-fA-F0-9]{64}$/)
			.describe('Transaction hash to monitor'),
		confirmations: z.number().optional().describe('Number of confirmations to wait for').default(1),
		interval: z
			.number()
			.optional()
			.describe('Interval in seconds between status checks')
			.default(1),
		timeout: z.number().optional().describe('Timeout in milliseconds').default(300000),
	}),
	execute: async (env, {hash, confirmations, interval, timeout}) => {
		const txHash = hash;
		const expectedConfirmations = confirmations ?? 1;
		const intervalSec = interval ?? 1;
		const timeoutMs = timeout ?? 300000;
		const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
		const intervalMs = intervalSec * 1000;
		const startTime = Date.now();

		while (Date.now() - startTime < timeoutMs) {
			try {
				const currentBlockNumber = await env.publicClient.getBlockNumber();

				const receipt = await env.publicClient.getTransactionReceipt({
					hash: txHash as `0x${string}`,
				});

				if (receipt) {
					const txBlockNumber = receipt.blockNumber;
					// Being included in a block counts as 1 confirmation
					// currentBlock - txBlock + 1 = confirmations
					const currentConfirmations = Number(currentBlockNumber - txBlockNumber) + 1;

					if (receipt.status === 'reverted') {
						await env.sendStatus(`Transaction ${txHash} was reverted`);

						const transaction = await env.publicClient.getTransaction({
							hash: txHash as `0x${string}`,
						});

						return {
							success: true,
							result: {
								status: 'reverted',
								transactionHash: txHash,
								blockNumber: receipt.blockNumber,
								confirmations: currentConfirmations,
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

					if (currentConfirmations >= expectedConfirmations) {
						await env.sendStatus(
							`Transaction ${txHash} confirmed with ${currentConfirmations} confirmations`,
						);

						return {
							success: true,
							result: {
								status: 'confirmed',
								transactionHash: txHash,
								blockNumber: receipt.blockNumber,
								timestamp: block?.timestamp,
								confirmations: currentConfirmations,
								receipt,
							},
						};
					}

					await env.sendStatus(
						`Transaction ${txHash} included in block ${txBlockNumber}. Waiting for ${expectedConfirmations - currentConfirmations} more confirmations...`,
					);
				} else {
					await env.sendStatus(
						`Transaction ${txHash} not yet mined. Checking again in ${intervalSec} seconds...`,
					);
				}
			} catch (error) {
				await env.sendStatus(
					`Error checking transaction status: ${error instanceof Error ? error.message : String(error)}`,
				);
			}

			await sleep(intervalMs);
		}

		return {
			success: false,
			error: `Timeout reached after ${timeoutMs} milliseconds waiting for transaction ${txHash}`,
		};
	},
});
