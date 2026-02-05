/**
 * CLI Transaction Tools Tests
 */

import {describe, it, expect, beforeAll, afterAll} from 'vitest';
import {setupTestEnvironment, teardownTestEnvironment, TEST_ADDRESS, TEST_PRIVATE_KEY} from '../setup.js';
import {RPC_URL} from '../prool/url.js';
import {invokeCliCommand} from '../cli-utils.js';

describe('CLI - Transaction Tools', () => {
	beforeAll(async () => {
		await setupTestEnvironment();
	}, 30000);

	afterAll(async () => {
		await teardownTestEnvironment();
	});

	describe('send_transaction', () => {
		it('should send a transaction with to and value parameters', async () => {
			const {stdout, exitCode} = await invokeCliCommand(
				['send_transaction', '--to', TEST_ADDRESS, '--value', '1', '--rpc-url', RPC_URL],
				{
					env: {ECLI_PRIVATE_KEY: TEST_PRIVATE_KEY},
				}
			);

			expect(exitCode).toBe(0);
			const result = JSON.parse(stdout);
			expect(result.transactionHash).toBeDefined();
			expect(result.transactionHash).toMatch(/^0x[a-f0-9]{64}$/);
		});

		it('should send a transaction with data parameter', async () => {
			const {stdout, exitCode} = await invokeCliCommand(
				['send_transaction', '--to', TEST_ADDRESS, '--data', '0x', '--rpc-url', RPC_URL],
				{
					env: {ECLI_PRIVATE_KEY: TEST_PRIVATE_KEY},
				}
			);

			expect(exitCode).toBe(0);
			const result = JSON.parse(stdout);
			expect(result.transactionHash).toBeDefined();
		});

		it('should send a transaction with from parameter', async () => {
			const {stdout, exitCode} = await invokeCliCommand(
				['send_transaction', '--to', TEST_ADDRESS, '--value', '1', '--from', TEST_ADDRESS, '--rpc-url', RPC_URL],
				{
					env: {ECLI_PRIVATE_KEY: TEST_PRIVATE_KEY},
				}
			);

			expect(exitCode).toBe(0);
			const result = JSON.parse(stdout);
			expect(result.transactionHash).toBeDefined();
		});

		it('should send a transaction with gas parameter', async () => {
			const {stdout, exitCode} = await invokeCliCommand(
				['send_transaction', '--to', TEST_ADDRESS, '--value', '1', '--gas', '21000', '--rpc-url', RPC_URL],
				{
					env: {ECLI_PRIVATE_KEY: TEST_PRIVATE_KEY},
				}
			);

			expect(exitCode).toBe(0);
			const result = JSON.parse(stdout);
			expect(result.transactionHash).toBeDefined();
		});

		it('should use PRIVATE_KEY environment variable as fallback', async () => {
			const {stdout, exitCode} = await invokeCliCommand(
				['send_transaction', '--to', TEST_ADDRESS, '--value', '1', '--rpc-url', RPC_URL],
				{
					env: {PRIVATE_KEY: TEST_PRIVATE_KEY},
				}
			);

			expect(exitCode).toBe(0);
			const result = JSON.parse(stdout);
			expect(result.transactionHash).toBeDefined();
		});
	});

	describe('sign_message', () => {
		it('should sign a message', async () => {
			const message = 'Hello, Ethereum!';

			const {stdout, exitCode} = await invokeCliCommand(['sign_message', '--message', message, '--rpc-url', RPC_URL], {
				env: {ECLI_PRIVATE_KEY: TEST_PRIVATE_KEY},
			});

			expect(exitCode).toBe(0);
			const result = JSON.parse(stdout);
			expect(result.message).toBe(message);
			expect(result.signature).toBeDefined();
			expect(result.signature).toMatch(/^0x[a-f0-9]+$/);
		});

		it('should sign a hex message', async () => {
			const message = '0x48656c6c6f2c20457468657265756d21'; // "Hello, Ethereum!" in hex

			const {stdout, exitCode} = await invokeCliCommand(['sign_message', '--message', message, '--rpc-url', RPC_URL], {
				env: {ECLI_PRIVATE_KEY: TEST_PRIVATE_KEY},
			});

			expect(exitCode).toBe(0);
			const result = JSON.parse(stdout);
			expect(result.message).toBe(message);
			expect(result.signature).toBeDefined();
		});

		it('should sign a message with PRIVATE_KEY env var', async () => {
			const message = 'Test message';

			const {stdout, exitCode} = await invokeCliCommand(['sign_message', '--message', message, '--rpc-url', RPC_URL], {
				env: {PRIVATE_KEY: TEST_PRIVATE_KEY},
			});

			expect(exitCode).toBe(0);
			const result = JSON.parse(stdout);
			expect(result.signature).toBeDefined();
		});
	});

	describe('wait_for_transaction_confirmation', () => {
		it('should wait for transaction confirmation', async () => {
			// First, send a transaction to get a hash
			const sendResult = await invokeCliCommand(
				['send_transaction', '--to', TEST_ADDRESS, '--value', '1', '--rpc-url', RPC_URL],
				{
					env: {ECLI_PRIVATE_KEY: TEST_PRIVATE_KEY},
				}
			);

			const txData = JSON.parse(sendResult.stdout);
			const txHash = txData.transactionHash;

			// Wait for confirmation
			const {stdout, exitCode} = await invokeCliCommand(
				['wait_for_transaction_confirmation', '--hash', txHash, '--rpc-url', RPC_URL],
				{
					env: {ECLI_PRIVATE_KEY: TEST_PRIVATE_KEY},
				}
			);

			expect(exitCode).toBe(0);
			const result = JSON.parse(stdout);
			expect(result.transactionHash).toBe(txHash);
			expect(result.confirmations).toBeDefined();
			expect(result.confirmations).toBeGreaterThan(0);
		});

		it('should wait for specific number of confirmations', async () => {
			// First, send a transaction to get a hash
			const sendResult = await invokeCliCommand(
				['send_transaction', '--to', TEST_ADDRESS, '--value', '1', '--rpc-url', RPC_URL],
				{
					env: {ECLI_PRIVATE_KEY: TEST_PRIVATE_KEY},
				}
			);

			const txData = JSON.parse(sendResult.stdout);
			const txHash = txData.transactionHash;

			// Wait for 2 confirmations
			const {stdout, exitCode} = await invokeCliCommand(
				['wait_for_transaction_confirmation', '--hash', txHash, '--confirmations', '2', '--rpc-url', RPC_URL],
				{
					env: {ECLI_PRIVATE_KEY: TEST_PRIVATE_KEY},
				}
			);

			expect(exitCode).toBe(0);
			const result = JSON.parse(stdout);
			expect(result.transactionHash).toBe(txHash);
			expect(result.confirmations).toBeGreaterThanOrEqual(2);
		});

		it('should timeout waiting for transaction confirmation', async () => {
			const fakeTxHash = '0x0000000000000000000000000000000000000000000000000000000000000001';

			const {stderr, exitCode} = await invokeCliCommand(
				['wait_for_transaction_confirmation', '--hash', fakeTxHash, '--timeout', '1000', '--rpc-url', RPC_URL],
				{
					env: {ECLI_PRIVATE_KEY: TEST_PRIVATE_KEY},
				}
			);

			expect(exitCode).toBe(1);
			expect(stderr).toContain('Error');
		}, 5000);
	});
});