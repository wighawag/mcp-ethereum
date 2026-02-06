import {z} from 'zod';
import {createTool} from '../tool-handling/types.js';
import {EthereumEnv} from '../types.js';

const schema = z.object({
	message: z.string().describe('Message to sign'),
});
export const sign_message = createTool<typeof schema, EthereumEnv>({
	description: 'Sign a message using the wallet (personal_sign)',
	schema,
	execute: async (env, {message}) => {
		if (!env.walletClient) {
			return {
				success: false,
				error: 'privateKey not provided. Cannot sign messages without a private key.',
			};
		}

		const signature = await env.walletClient.signMessage({
			message,
		} as any);

		return {
			success: true,
			result: {
				message,
				signature,
				address: env.walletClient.account?.address,
			},
		};
	},
});
