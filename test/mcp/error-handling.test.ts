import {describe, it, expect, beforeAll, afterAll} from 'vitest';
import {
	setupTestEnvironmentForMPCServer,
	teardownTestEnvironment,
	getTestContextForMPCServer,
} from '../setup.js';
import {callToolWithTextResponse} from '../utils/index.js';
import {TEST_CONTRACT_ADDRESS} from '../utils/data.js';

describe('Error Handling', () => {
	beforeAll(async () => {
		await setupTestEnvironmentForMPCServer();
	}, 30000);

	afterAll(async () => {
		await teardownTestEnvironment();
	});

	it('should handle invalid address format', async () => {
		const {client} = getTestContextForMPCServer();
		const result = await callToolWithTextResponse(client, {
			name: 'get_balance',
			arguments: {
				address: 'invalid-address',
			},
		});
		expect(result.content[0].type).toBe('text');
		const data = JSON.parse(result.content[0].text);
		expect(data.error).toBeDefined();
	});

	it('should handle invalid transaction hash format', async () => {
		const {client} = getTestContextForMPCServer();
		const result = await callToolWithTextResponse(client, {
			name: 'get_transaction',
			arguments: {
				txHash: 'invalid-hash',
			},
		});
		expect(result.content[0].type).toBe('text');
		const text = result.content[0].text;
		// Error might be in JSON format or plain text
		if (text.startsWith('{')) {
			const data = JSON.parse(text);
			expect(data.error).toBeDefined();
		} else {
			// Plain text error message
			expect(text).toBeDefined();
			expect(text.length).toBeGreaterThan(0);
		}
	});

	it('should handle invalid ABI', async () => {
		const {client} = getTestContextForMPCServer();
		const result = await callToolWithTextResponse(client, {
			name: 'call_contract',
			arguments: {
				address: TEST_CONTRACT_ADDRESS,
				abi: 'invalid function abi',
				args: [],
			},
		});
		expect(result.content[0].type).toBe('text');
		const data = JSON.parse(result.content[0].text);
		expect(data.error).toBeDefined();
		expect(result.isError).toBe(true);
	});
});
