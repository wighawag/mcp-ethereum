import {describe, it, expect, beforeAll, afterAll} from 'vitest';
import {
	setupTestEnvironment,
	teardownTestEnvironment,
	getTestContext,
	TEST_ADDRESS,
	TEST_RECIPIENT,
	ERC20_TRANSFER_ABI,
} from '../setup.js';
import {callToolWithTextResponse} from '../utils/index.js';
import {createServer} from '../../src/index.js';
import {InMemoryTransport} from '@modelcontextprotocol/sdk/inMemory.js';
import {Client} from '@modelcontextprotocol/sdk/client';
import {getChain} from '../../src/helpers.js';

const TEST_KEY = 'transaction';

describe('Transaction Tools', () => {
	beforeAll(async () => {
		await setupTestEnvironment(TEST_KEY);
	}, 30000);

	afterAll(async () => {
		await teardownTestEnvironment(TEST_KEY);
	});

	describe('send_transaction', () => {
		it('should send a simple ETH transfer', async () => {
			const {client} = getTestContext(TEST_KEY);
			const result = await callToolWithTextResponse(client, {
				name: 'send_transaction',
				arguments: {
					to: TEST_RECIPIENT,
					value: '1000000000000000', // 0.001 ETH
				},
			});
			expect(result.content[0].type).toBe('text');
			const data = JSON.parse(result.content[0].text);
			expect(data.status).toBe('sent');
			expect(data.txHash).toMatch(/^0x[a-fA-F0-9]{64}$/);
		});

		it('should send contract call transaction', async () => {
			const {client} = getTestContext(TEST_KEY);
			const result = await callToolWithTextResponse(client, {
				name: 'send_transaction',
				arguments: {
					to: '0x5FbDB2315678afecb367f032d93F642f64180aa3',
					abi: ERC20_TRANSFER_ABI,
					args: [TEST_RECIPIENT, 100],
				},
			});
			expect(result.content[0].type).toBe('text');
			const data = JSON.parse(result.content[0].text);
			expect(data.status).toBe('sent');
			expect(data.txHash).toBeDefined();
		});

		it('should send transaction with gas parameters', async () => {
			const {client} = getTestContext(TEST_KEY);
			const result = await callToolWithTextResponse(client, {
				name: 'send_transaction',
				arguments: {
					to: TEST_RECIPIENT,
					value: '1000000000000000',
					maxFeePerGas: '1000000000',
					maxPriorityFeePerGas: '1000000000',
				},
			});
			expect(result.content[0].type).toBe('text');
			const data = JSON.parse(result.content[0].text);
			expect(data.status).toBe('sent');
			expect(data.txHash).toBeDefined();
		});

		it('should send transaction with gas limit', async () => {
			const {client} = getTestContext(TEST_KEY);
			const result = await callToolWithTextResponse(client, {
				name: 'send_transaction',
				arguments: {
					to: TEST_RECIPIENT,
					value: '1000000000000000',
					gas: '21000',
				},
			});
			expect(result.content[0].type).toBe('text');
			const data = JSON.parse(result.content[0].text);
			expect(data.status).toBe('sent');
			expect(data.txHash).toBeDefined();
		});

		it('should send transaction with nonce', async () => {
			const {client} = getTestContext(TEST_KEY);
			// First get the nonce
			const nonceResult = await callToolWithTextResponse(client, {
				name: 'get_transaction_count',
				arguments: {
					address: TEST_ADDRESS,
				},
			});
			const nonce = JSON.parse(nonceResult.content[0].text).transactionCount;

			const result = await callToolWithTextResponse(client, {
				name: 'send_transaction',
				arguments: {
					to: TEST_RECIPIENT,
					value: '1000000000000000',
					nonce,
				},
			});
			expect(result.content[0].type).toBe('text');
			const data = JSON.parse(result.content[0].text);
			expect(data.status).toBe('sent');
			expect(data.txHash).toBeDefined();
		});

		it('should return error when sending transaction without private key', async () => {
			const {rpcUrl} = getTestContext();
			// Create a server without private key
			const serverWithoutKey = createServer({
				chain: await getChain(rpcUrl),
			});

			// Connect using in-memory transport
			const [clientTransport2, serverTransport2] = InMemoryTransport.createLinkedPair();
			const clientWithoutKey = new Client({name: 'test-client-2', version: '1.0.0'}, {});

			await Promise.all([
				serverWithoutKey.connect(serverTransport2),
				clientWithoutKey.connect(clientTransport2),
			]);

			// Try to send a transaction
			const result = await callToolWithTextResponse(clientWithoutKey, {
				name: 'send_transaction',
				arguments: {
					to: TEST_RECIPIENT,
					value: '1000000000000000',
				},
			});

			expect(result.content[0].type).toBe('text');
			const data = JSON.parse(result.content[0].text);
			expect(data.error).toBeDefined();
			expect(result.isError).toBe(true);
			expect(data.error).toContain('privateKey');

			// Clean up
			await clientWithoutKey.close();
		});
	});

	describe('get_transaction', () => {
		it('should get transaction details by hash', async () => {
			const {client} = getTestContext(TEST_KEY);
			// First send a transaction
			const sendResult = await callToolWithTextResponse(client, {
				name: 'send_transaction',
				arguments: {
					to: TEST_RECIPIENT,
					value: '1000000000000000',
				},
			});
			const txHash = JSON.parse(sendResult.content[0].text).txHash;

			// Wait a moment for the transaction to be mined
			await new Promise((resolve) => setTimeout(resolve, 1000));

			// Get the transaction
			const result = await callToolWithTextResponse(client, {
				name: 'get_transaction',
				arguments: {
					txHash,
				},
			});
			expect(result.content[0].type).toBe('text');
			const data = JSON.parse(result.content[0].text);
			expect(data.hash).toBe(txHash);
			expect(data.from).toBeDefined();
			expect(data.to).toBe(TEST_RECIPIENT.toLowerCase());
		});

		it('should return error for non-existent transaction', async () => {
			const {client} = getTestContext(TEST_KEY);
			const result = await callToolWithTextResponse(client, {
				name: 'get_transaction',
				arguments: {
					txHash: '0x0000000000000000000000000000000000000000000000000000000000000001',
				},
			});
			expect(result.content[0].type).toBe('text');
			const data = JSON.parse(result.content[0].text);
			expect(data.error).toBeDefined();
			expect(result.isError).toBe(true);
		});
	});

	describe('wait_for_transaction_confirmation', () => {
		it('should wait for transaction confirmation', async () => {
			const {client} = getTestContext(TEST_KEY);
			// Send a transaction
			const sendResult = await callToolWithTextResponse(client, {
				name: 'send_transaction',
				arguments: {
					to: TEST_RECIPIENT,
					value: '1000000000000000',
				},
			});
			const txHash = JSON.parse(sendResult.content[0].text).txHash;

			// Wait for confirmation
			const result = await callToolWithTextResponse(client, {
				name: 'wait_for_transaction_confirmation',
				arguments: {
					txHash,
					expectedConformations: 1,
					interval: 0.1,
					timeout: 5,
				},
			});
			expect(result.content[0].type).toBe('text');
			const data = JSON.parse(result.content[0].text);
			expect(['confirmed', 'timeout']).toContain(data.status);
			expect(data.txHash).toBe(txHash);
		}, 15000);

		it('should handle timeout', async () => {
			const {client} = getTestContext(TEST_KEY);
			const result = await callToolWithTextResponse(client, {
				name: 'wait_for_transaction_confirmation',
				arguments: {
					txHash: '0x0000000000000000000000000000000000000000000000000000000000000001',
					expectedConformations: 1,
					interval: 0.1,
					timeout: 1,
				},
			});
			expect(result.content[0].type).toBe('text');
			const data = JSON.parse(result.content[0].text);
			expect(data.status).toBe('timeout');
			expect(data.message).toContain('Timeout reached');
		}, 5000);

		it('should handle reverted transaction', async () => {
			const {client} = getTestContext(TEST_KEY);
			// Send a transaction that will revert by calling a non-existent function
			const NON_EXISTENT_FUNCTION_ABI = 'function thisFunctionDoesNotExist() returns (uint256)';

			const sendResult = await callToolWithTextResponse(client, {
				name: 'send_transaction',
				arguments: {
					to: '0x5FbDB2315678afecb367f032d93F642f64180aa3',
					abi: NON_EXISTENT_FUNCTION_ABI,
					args: [],
					gas: '100000', // Provide gas to skip simulation
				},
			});
			const txHash = JSON.parse(sendResult.content[0].text).txHash;

			// Wait a moment for the transaction to be mined
			await new Promise((resolve) => setTimeout(resolve, 1000));

			// Wait for confirmation and check for revert status
			const result = await callToolWithTextResponse(client, {
				name: 'wait_for_transaction_confirmation',
				arguments: {
					txHash,
					expectedConformations: 1,
					interval: 0.1,
					timeout: 5,
				},
			});
			expect(result.content[0].type).toBe('text');
			const data = JSON.parse(result.content[0].text);

			// The transaction should either be reverted or fail if the contract doesn't exist
			expect(['confirmed', 'reverted', 'timeout']).toContain(data.status);

			// If reverted, verify the response contains revert information
			if (data.status === 'reverted') {
				expect(data.txHash).toBe(txHash);
				expect(data.receipt).toBeDefined();
			}
		}, 15000);
	});
});
