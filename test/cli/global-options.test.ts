/**
 * CLI Global Options and Environment Variables Tests
 */

import {describe, it, expect, beforeAll, afterAll} from 'vitest';
import {setupTestEnvironment, teardownTestEnvironment, TEST_ADDRESS, TEST_PRIVATE_KEY} from '../setup.js';
import {RPC_URL} from '../prool/url.js';
import {invokeCliCommand, setupCliTest} from '../cli-utils.js';

describe('CLI - Global Options and Environment Variables', () => {
	beforeAll(async () => {
		await setupTestEnvironment();
	}, 30000);

	afterAll(async () => {
		await teardownTestEnvironment();
	});

	describe('--rpc-url global option', () => {
		it('should use --rpc-url global option for commands', async () => {
			const {stdout, exitCode} = await invokeCliCommand(
				['--rpc-url', RPC_URL, 'get_balance', '--address', TEST_ADDRESS]
			);

			expect(exitCode).toBe(0);
			const result = JSON.parse(stdout);
			expect(result.address).toBe(TEST_ADDRESS);
		});

		it('should inherit --rpc-url from parent command', async () => {
			const {stdout, exitCode} = await invokeCliCommand(
				['--rpc-url', RPC_URL, 'get_block_number']
			);

			expect(exitCode).toBe(0);
			const result = JSON.parse(stdout);
			expect(result.blockNumber).toBeDefined();
		});
	});

	describe('--rpc-url local override', () => {
		it('should allow local --rpc-url to override global --rpc-url', async () => {
			const {stdout, exitCode} = await invokeCliCommand(
				['--rpc-url', 'http://invalid-url:9999', 'get_balance', '--address', TEST_ADDRESS, '--rpc-url', RPC_URL]
			);

			expect(exitCode).toBe(0);
			const result = JSON.parse(stdout);
			expect(result.address).toBe(TEST_ADDRESS);
		});
	});

	describe('ECLI_RPC_URL environment variable', () => {
		it('should use ECLI_RPC_URL environment variable when --rpc-url not provided', async () => {
			const {stdout, exitCode} = await invokeCliCommand(['get_balance', '--address', TEST_ADDRESS], {
				env: {ECLI_RPC_URL: RPC_URL},
			});

			expect(exitCode).toBe(0);
			const result = JSON.parse(stdout);
			expect(result.address).toBe(TEST_ADDRESS);
		});

		it('should use ECLI_RPC_URL with command', async () => {
			const {stdout, exitCode} = await invokeCliCommand(['get_block_number'], {
				env: {ECLI_RPC_URL: RPC_URL},
			});

			expect(exitCode).toBe(0);
			const result = JSON.parse(stdout);
			expect(result.blockNumber).toBeDefined();
		});

		it('should use ECLI_RPC_URL with transaction tools', async () => {
			const {stdout, exitCode} = await invokeCliCommand(
				['send_transaction', '--to', TEST_ADDRESS, '--value', '1'],
				{
					env: {ECLI_RPC_URL: RPC_URL, ECLI_PRIVATE_KEY: TEST_PRIVATE_KEY},
				}
			);

			expect(exitCode).toBe(0);
			const result = JSON.parse(stdout);
			expect(result.transactionHash).toBeDefined();
		});
	});

	describe('RPC_URL environment variable (fallback)', () => {
		it('should use RPC_URL environment variable when ECLI_RPC_URL not set', async () => {
			const {stdout, exitCode} = await invokeCliCommand(['get_balance', '--address', TEST_ADDRESS], {
				env: {RPC_URL: RPC_URL},
			});

			expect(exitCode).toBe(0);
			const result = JSON.parse(stdout);
			expect(result.address).toBe(TEST_ADDRESS);
		});
	});

	describe('option precedence over environment variables', () => {
		it('should use --rpc-url option over ECLI_RPC_URL environment variable', async () => {
			const {stdout, exitCode} = await invokeCliCommand(
				['get_balance', '--address', TEST_ADDRESS, '--rpc-url', RPC_URL],
				{
					env: {ECLI_RPC_URL: 'http://invalid-url:9999'},
				}
			);

			expect(exitCode).toBe(0);
			const result = JSON.parse(stdout);
			expect(result.address).toBe(TEST_ADDRESS);
		});

		it('should use --rpc-url option over RPC_URL environment variable', async () => {
			const {stdout, exitCode} = await invokeCliCommand(
				['get_balance', '--address', TEST_ADDRESS, '--rpc-url', RPC_URL],
				{
					env: {RPC_URL: 'http://invalid-url:9999'},
				}
			);

			expect(exitCode).toBe(0);
			const result = JSON.parse(stdout);
			expect(result.address).toBe(TEST_ADDRESS);
		});
	});

	describe('ECLI_PRIVATE_KEY environment variable', () => {
		it('should use ECLI_PRIVATE_KEY environment variable for transaction tools', async () => {
			const {stdout, exitCode} = await invokeCliCommand(
				['send_transaction', '--to', TEST_ADDRESS, '--value', '1', '--rpc-url', RPC_URL],
				{
					env: {ECLI_PRIVATE_KEY: TEST_PRIVATE_KEY},
				}
			);

			expect(exitCode).toBe(0);
			const result = JSON.parse(stdout);
			expect(result.transactionHash).toBeDefined();
		});

		it('should use ECLI_PRIVATE_KEY for signing messages', async () => {
			const {stdout, exitCode} = await invokeCliCommand(
				['sign_message', '--message', 'Test message', '--rpc-url', RPC_URL],
				{
					env: {ECLI_PRIVATE_KEY: TEST_PRIVATE_KEY},
				}
			);

			expect(exitCode).toBe(0);
			const result = JSON.parse(stdout);
			expect(result.signature).toBeDefined();
		});
	});

	describe('PRIVATE_KEY environment variable (fallback)', () => {
		it('should use PRIVATE_KEY environment variable when ECLI_PRIVATE_KEY not set', async () => {
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

		it('should use PRIVATE_KEY for signing messages', async () => {
			const {stdout, exitCode} = await invokeCliCommand(
				['sign_message', '--message', 'Test message', '--rpc-url', RPC_URL],
				{
					env: {PRIVATE_KEY: TEST_PRIVATE_KEY},
				}
			);

			expect(exitCode).toBe(0);
			const result = JSON.parse(stdout);
			expect(result.signature).toBeDefined();
		});
	});

	describe('ECLI_PRIVATE_KEY precedence over PRIVATE_KEY', () => {
		it('should prefer ECLI_PRIVATE_KEY over PRIVATE_KEY environment variable', async () => {
			const validKey = TEST_PRIVATE_KEY;
			const invalidKey = '0x' + '0'.repeat(64);

			const {stdout, exitCode} = await invokeCliCommand(
				['send_transaction', '--to', TEST_ADDRESS, '--value', '1', '--rpc-url', RPC_URL],
				{
					env: {ECLI_PRIVATE_KEY: validKey, PRIVATE_KEY: invalidKey},
				}
			);

			expect(exitCode).toBe(0);
			const result = JSON.parse(stdout);
			expect(result.transactionHash).toBeDefined();
		});
	});

	describe('ECLI_RPC_URL precedence over RPC_URL', () => {
		it('should prefer ECLI_RPC_URL over RPC_URL environment variable', async () => {
			const {stdout, exitCode} = await invokeCliCommand(['get_balance', '--address', TEST_ADDRESS], {
				env: {ECLI_RPC_URL: RPC_URL, RPC_URL: 'http://invalid-url:9999'},
			});

			expect(exitCode).toBe(0);
			const result = JSON.parse(stdout);
			expect(result.address).toBe(TEST_ADDRESS);
		});
	});

	describe('setupCliTest utility function', () => {
		it('should set environment variables and provide restore function', () => {
			const {restore} = setupCliTest({
				rpcUrl: RPC_URL,
				privateKey: TEST_PRIVATE_KEY,
			});

			expect(process.env.ECLI_RPC_URL).toBe(RPC_URL);
			expect(process.env.RPC_URL).toBe(RPC_URL);
			expect(process.env.ECLI_PRIVATE_KEY).toBe(TEST_PRIVATE_KEY);
			expect(process.env.PRIVATE_KEY).toBe(TEST_PRIVATE_KEY);

			restore();

			expect(process.env.ECLI_RPC_URL).toBeUndefined();
			expect(process.env.RPC_URL).toBeUndefined();
			expect(process.env.ECLI_PRIVATE_KEY).toBeUndefined();
			expect(process.env.PRIVATE_KEY).toBeUndefined();
		});

		it('should restore original environment variables', () => {
			const originalRpcUrl = process.env.ECLI_RPC_URL;
			const originalPrivateKey = process.env.ECLI_PRIVATE_KEY;

			process.env.ECLI_RPC_URL = 'http://original-url:8545';
			process.env.ECLI_PRIVATE_KEY = '0x' + '1'.repeat(64);

			const {restore} = setupCliTest({
				rpcUrl: RPC_URL,
				privateKey: TEST_PRIVATE_KEY,
			});

			restore();

			expect(process.env.ECLI_RPC_URL).toBe('http://original-url:8545');
			expect(process.env.ECLI_PRIVATE_KEY).toBe('0x' + '1'.repeat(64));

			// Clean up
			if (!originalRpcUrl) {
				delete process.env.ECLI_RPC_URL;
			}
			if (!originalPrivateKey) {
				delete process.env.ECLI_PRIVATE_KEY;
			}
		});
	});

	describe('combined environment variables', () => {
		it('should use combined ECLI_RPC_URL and ECLI_PRIVATE_KEY for transaction', async () => {
			const {stdout, exitCode} = await invokeCliCommand(
				['send_transaction', '--to', TEST_ADDRESS, '--value', '1'],
				{
					env: {
						ECLI_RPC_URL: RPC_URL,
						ECLI_PRIVATE_KEY: TEST_PRIVATE_KEY,
					},
				}
			);

			expect(exitCode).toBe(0);
			const result = JSON.parse(stdout);
			expect(result.transactionHash).toBeDefined();
		});

		it('should use combined RPC_URL and PRIVATE_KEY for transaction', async () => {
			const {stdout, exitCode} = await invokeCliCommand(
				['send_transaction', '--to', TEST_ADDRESS, '--value', '1'],
				{
					env: {
						RPC_URL: RPC_URL,
						PRIVATE_KEY: TEST_PRIVATE_KEY,
					},
				}
			);

			expect(exitCode).toBe(0);
			const result = JSON.parse(stdout);
			expect(result.transactionHash).toBeDefined();
		});
	});
});