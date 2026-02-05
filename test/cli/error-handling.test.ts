/**
 * CLI Error Handling Tests
 */

import {describe, it, expect} from 'vitest';
import {invokeCliCommand} from '../cli-utils.js';
import {TEST_ADDRESS} from '../setup.js';

describe('CLI - Error Handling', () => {
	describe('missing required parameters', () => {
		it('should show error when missing required --address parameter', async () => {
			const {stderr, exitCode} = await invokeCliCommand(['get_balance']);

			expect(exitCode).toBe(1);
			expect(stderr).toContain('required');
			expect(stderr).toContain('--address');
		});

		it('should show error when missing required --txHash parameter', async () => {
			const {stderr, exitCode} = await invokeCliCommand(['get_transaction']);
	
			expect(exitCode).toBe(1);
			expect(stderr).toContain('required');
			expect(stderr).toContain('--txHash');
		});

		it('should show error when missing required --to parameter for send_transaction', async () => {
			const {stderr, exitCode} = await invokeCliCommand(['send_transaction']);

			expect(exitCode).toBe(1);
			expect(stderr).toContain('required');
			expect(stderr).toContain('--to');
		});

		it('should show error when missing required --message parameter for sign_message', async () => {
			const {stderr, exitCode} = await invokeCliCommand(['sign_message']);

			expect(exitCode).toBe(1);
			expect(stderr).toContain('required');
			expect(stderr).toContain('--message');
		});

		it('should show error when missing required --address parameter for call_contract', async () => {
			const {stderr, exitCode} = await invokeCliCommand(['call_contract']);

			expect(exitCode).toBe(1);
			expect(stderr).toContain('required');
			expect(stderr).toContain('--address');
		});

		it('should show error when missing required --abi parameter for call_contract', async () => {
			const {stderr, exitCode} = await invokeCliCommand([
				'call_contract',
				'--address',
				TEST_ADDRESS,
			]);

			expect(exitCode).toBe(1);
			expect(stderr).toContain('required');
			expect(stderr).toContain('--abi');
		});
	});

	describe('missing RPC URL', () => {
		it('should show error when --rpc-url is not provided and env var is not set', async () => {
			const {stderr, exitCode} = await invokeCliCommand([
				'get_balance',
				'--address',
				TEST_ADDRESS,
			]);

			expect(exitCode).toBe(1);
			expect(stderr).toContain('Error');
			expect(stderr).toContain('--rpc-url');
			expect(stderr).toContain('RPC_URL');
		});
	});

	describe('invalid private key format', () => {
		it('should show error when private key does not start with 0x', async () => {
			const invalidPrivateKey = '59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d'; // missing 0x prefix

			const {stderr, exitCode} = await invokeCliCommand(
				['send_transaction', '--to', TEST_ADDRESS, '--rpc-url', 'http://localhost:8545'],
				{
					env: {ECLI_PRIVATE_KEY: invalidPrivateKey},
				}
			);

			expect(exitCode).toBe(1);
			expect(stderr).toContain('Error');
			expect(stderr).toContain('0x');
		});
	});

	describe('invalid parameter values', () => {
		it('should show error for invalid blockTag value', async () => {
			const {stderr, exitCode} = await invokeCliCommand(
				['get_balance', '--address', TEST_ADDRESS, '--blockTag', 'invalid', '--rpc-url', 'http://localhost:8545']
			);

			expect(exitCode).toBe(1);
			expect(stderr).toContain('Error');
		});

		it('should show error for invalid address format', async () => {
			const invalidAddress = 'not-an-address';

			const {stderr, exitCode} = await invokeCliCommand(
				['get_balance', '--address', invalidAddress, '--rpc-url', 'http://localhost:8545']
			);

			expect(exitCode).toBe(1);
			expect(stderr).toContain('Error');
		});
	});

	describe('invalid ABI format', () => {
		it('should show error for invalid ABI string', async () => {
			const {stderr, exitCode} = await invokeCliCommand(
				[
					'call_contract',
					'--address',
					TEST_ADDRESS,
					'--abi',
					'not-a-valid-abi',
					'--rpc-url',
					'http://localhost:8545',
				]
			);

			expect(exitCode).toBe(1);
			expect(stderr).toContain('Error');
		});
	});

	describe('network errors', () => {
		it('should show error for invalid RPC URL', async () => {
			const {stderr, exitCode} = await invokeCliCommand(
				['get_balance', '--address', TEST_ADDRESS, '--rpc-url', 'http://invalid-rpc-url:9999']
			);

			expect(exitCode).toBe(1);
			expect(stderr).toContain('Error');
		});

		it('should show error for non-existent transaction hash', async () => {
			const fakeTxHash = '0x0000000000000000000000000000000000000000000000000000000000000001';
	
			const {stderr, exitCode} = await invokeCliCommand([
				'get_transaction',
				'--txHash',
				fakeTxHash,
				'--rpc-url',
				'http://localhost:8545',
			]);
	
			expect(exitCode).toBe(1);
			expect(stderr).toContain('Error');
		});
	});

	describe('validation errors', () => {
		it('should show validation error for invalid calldata format', async () => {
			const invalidCalldata = 'not-valid-calldata';
	
			const {stderr, exitCode} = await invokeCliCommand(
				['decode_calldata', '--data', invalidCalldata, '--abi', 'function transfer(address,uint256)', '--rpc-url', 'http://localhost:8545']
			);
	
			expect(exitCode).toBe(1);
			expect(stderr).toContain('Error');
		});

		it('should show validation error for invalid slot format', async () => {
			const {stderr, exitCode} = await invokeCliCommand(
				['get_storage_at', '--address', TEST_ADDRESS, '--slot', 'invalid', '--rpc-url', 'http://localhost:8545']
			);

			expect(exitCode).toBe(1);
			expect(stderr).toContain('Error');
		});
	});

	describe('parameter type validation', () => {
		it('should handle number parameters correctly', async () => {
			const {stderr, exitCode} = await invokeCliCommand(
				['get_fee_history', '--blockCount', 'invalid', '--newestBlock', 'latest', '--rewardPercentiles', '25', '--rpc-url', 'http://localhost:8545']
			);

			expect(exitCode).toBe(1);
			expect(stderr).toContain('Error');
		});

		it('should handle array parameters correctly', async () => {
			const {stderr, exitCode} = await invokeCliCommand(
				['get_fee_history', '--blockCount', '4', '--newestBlock', 'latest', '--rewardPercentiles', 'invalid', '--rpc-url', 'http://localhost:8545']
			);

			expect(exitCode).toBe(1);
			expect(stderr).toContain('Error');
		});
	});
});