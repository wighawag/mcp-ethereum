import {z} from 'zod';
import {createTool} from '../types.js';

export const sign_message = createTool({
	description: 'Sign a message using the wallet (personal_sign)',
	schema: z.object({
		message: z.string().describe('Message to sign'),
	}),
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
