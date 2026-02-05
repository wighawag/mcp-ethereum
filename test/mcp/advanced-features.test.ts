import {describe, it, expect, beforeAll, afterAll} from 'vitest';
import {setupTestEnvironment, teardownTestEnvironment, getTestContext} from '../setup.js';
import {callToolWithTextResponse} from '../utils/index.js';

describe('Advanced Features', () => {
	beforeAll(async () => {
		await setupTestEnvironment();
	}, 30000);

	afterAll(async () => {
		await teardownTestEnvironment();
	});

	describe('sign_message', () => {
		it('should sign a message', async () => {
			const {client} = getTestContext();
			const result = await callToolWithTextResponse(client, {
				name: 'sign_message',
				arguments: {
					message: 'Hello, Ethereum!',
				},
			});
			expect(result.content[0].type).toBe('text');
			const data = JSON.parse(result.content[0].text);
			expect(data.message).toBe('Hello, Ethereum!');
			expect(data.signature).toMatch(/^0x[a-fA-F0-9]+$/);
			expect(data.address).toBeDefined();
		});

		it('should sign a longer message', async () => {
			const {client} = getTestContext();
			const longMessage =
				'This is a longer message that should still be signed correctly by the wallet client.';
			const result = await callToolWithTextResponse(client, {
				name: 'sign_message',
				arguments: {
					message: longMessage,
				},
			});
			expect(result.content[0].type).toBe('text');
			const data = JSON.parse(result.content[0].text);
			expect(data.message).toBe(longMessage);
			expect(data.signature).toBeDefined();
		});
	});
});
