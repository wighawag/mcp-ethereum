import {z} from 'zod';
import {createTool} from '../tool-handling/types.js';
import {EthereumEnv} from '../types.js';

const schema = z.object({
	address: z.string().describe('Contract address'),
	slot: z.union([z.string(), z.number()]).describe('Storage slot (hex string or number)'),
	blockTag: z
		.union([
			z.literal('latest'),
			z.literal('pending'),
			z.literal('finalized'),
			z.literal('safe'),
			z.string(),
		])
		.optional()
		.describe('Block tag to query (default: "latest")'),
});
export const get_storage_at = createTool<typeof schema, EthereumEnv>({
	description: 'Get contract storage value at a specific slot',
	schema,
	execute: async (env, {address, slot, blockTag}) => {
		const storage = await env.publicClient.getStorageAt({
			address: address as `0x${string}`,
			slot: typeof slot === 'string' ? (slot as `0x${string}`) : `0x${BigInt(slot).toString(16)}`,
			blockTag: blockTag as any,
		});

		return {
			success: true,
			result: {
				address,
				slot: typeof slot === 'string' ? slot : slot.toString(),
				blockTag,
				storage: storage || '0x',
				storageAsNumber: storage && storage !== '0x' ? BigInt(storage).toString() : '0',
			},
		};
	},
});
