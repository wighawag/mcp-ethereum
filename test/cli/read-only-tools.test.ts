/**
 * CLI Read-Only Tools Tests
 */

import {describe, it, expect, beforeAll, afterAll} from 'vitest';
import {setupTestEnvironment, teardownTestEnvironment, TEST_ADDRESS} from '../setup.js';
import {TEST_CONTRACT_ADDRESS} from '../utils/data.js';
import {RPC_URL} from '../prool/url.js';
import {invokeCliCommand} from '../cli-utils.js';

describe('CLI - Read-Only Tools', () => {
	beforeAll(async () => {
		await setupTestEnvironment();
	}, 30000);

	afterAll(async () => {
		await teardownTestEnvironment();
	});

	describe('get_balance', () => {
		it('should get balance for an address', async () => {
			const {stdout, exitCode} = await invokeCliCommand([
				'get_balance',
				'--address',
				TEST_ADDRESS,
				'--rpc-url',
				RPC_URL,
			]);

			expect(exitCode).toBe(0);
			const result = JSON.parse(stdout);
			expect(result.address).toBe(TEST_ADDRESS);
			expect(result.balance).toBeDefined();
			expect(result.balanceInEther).toBeDefined();
		});

		it('should get balance with blockTag', async () => {
			const {stdout, exitCode} = await invokeCliCommand([
				'get_balance',
				'--address',
				TEST_ADDRESS,
				'--blockTag',
				'latest',
				'--rpc-url',
				RPC_URL,
			]);

			expect(exitCode).toBe(0);
			const result = JSON.parse(stdout);
			expect(result.address).toBe(TEST_ADDRESS);
			expect(result.blockTag).toBe('latest');
		});

		it('should use ECLI_RPC_URL environment variable', async () => {
			const {stdout, exitCode} = await invokeCliCommand(['get_balance', '--address', TEST_ADDRESS], {
				env: {ECLI_RPC_URL: RPC_URL},
			});

			expect(exitCode).toBe(0);
			const result = JSON.parse(stdout);
			expect(result.address).toBe(TEST_ADDRESS);
		});
	});

	describe('get_block_number', () => {
		it('should get current block number', async () => {
			const {stdout, exitCode} = await invokeCliCommand(['get_block_number', '--rpc-url', RPC_URL]);

			expect(exitCode).toBe(0);
			const result = JSON.parse(stdout);
			expect(result.blockNumber).toBeDefined();
		});
	});

	describe('get_chain_id', () => {
		it('should get current chain ID', async () => {
			const {stdout, exitCode} = await invokeCliCommand(['get_chain_id', '--rpc-url', RPC_URL]);

			expect(exitCode).toBe(0);
			const result = JSON.parse(stdout);
			expect(result.chainId).toBe(31337); // Anvil default chain ID
		});
	});

	describe('get_gas_price', () => {
		it('should get current gas price', async () => {
			const {stdout, exitCode} = await invokeCliCommand(['get_gas_price', '--rpc-url', RPC_URL]);

			expect(exitCode).toBe(0);
			const result = JSON.parse(stdout);
			expect(result.gasPrice).toBeDefined();
			expect(result.gasPriceInGwei).toBeDefined();
		});
	});

	describe('get_latest_block', () => {
		it('should get latest block information', async () => {
			const {stdout, exitCode} = await invokeCliCommand(['get_latest_block', '--rpc-url', RPC_URL]);

			expect(exitCode).toBe(0);
			const result = JSON.parse(stdout);
			expect(result.number || result.blockNumber).toBeDefined();
			expect(result.hash).toBeDefined();
		});
	});

	describe('get_block', () => {
		it('should get block by number', async () => {
			const {stdout, exitCode} = await invokeCliCommand([
				'get_block',
				'--blockNumber',
				'0',
				'--rpc-url',
				RPC_URL,
			]);

			expect(exitCode).toBe(0);
			const result = JSON.parse(stdout);
			expect(result.blockNumber).toBe('0');
			expect(result.transactionCount).toBeDefined();
		});

		it('should get block with transactions', async () => {
			const {stdout, exitCode} = await invokeCliCommand([
				'get_block',
				'--blockNumber',
				'0',
				'--includeTransactions',
				'true',
				'--rpc-url',
				RPC_URL,
			]);

			expect(exitCode).toBe(0);
			const result = JSON.parse(stdout);
			expect(result.transactions).toBeDefined();
		});

		it('should get block by hash', async () => {
			// First get a block to get its hash
			const {stdout: blockStdout} = await invokeCliCommand([
				'get_block',
				'--blockNumber',
				'0',
				'--rpc-url',
				RPC_URL,
			]);
			const blockData = JSON.parse(blockStdout);
			const blockHash = blockData.blockHash;

			// Now get the same block by hash
			const {stdout, exitCode} = await invokeCliCommand([
				'get_block',
				'--blockHash',
				blockHash,
				'--rpc-url',
				RPC_URL,
			]);

			expect(exitCode).toBe(0);
			const result = JSON.parse(stdout);
			expect(result.blockHash).toBe(blockHash);
			expect(result.blockNumber).toBe('0');
		});
	});

	describe('get_code', () => {
		it('should get code at an address (EOA)', async () => {
			const {stdout, exitCode} = await invokeCliCommand([
				'get_code',
				'--address',
				TEST_ADDRESS,
				'--rpc-url',
				RPC_URL,
			]);

			expect(exitCode).toBe(0);
			const result = JSON.parse(stdout);
			expect(result.address).toBe(TEST_ADDRESS);
			expect(result.isContract === false || result.codeLength === 0).toBe(true);
		});

		it('should get code with blockTag', async () => {
			const {stdout, exitCode} = await invokeCliCommand([
				'get_code',
				'--address',
				TEST_ADDRESS,
				'--blockTag',
				'latest',
				'--rpc-url',
				RPC_URL,
			]);

			expect(exitCode).toBe(0);
			const result = JSON.parse(stdout);
			expect(result.address).toBe(TEST_ADDRESS);
		});

		it('should get code at contract address', async () => {
			const {stdout, exitCode} = await invokeCliCommand([
				'get_code',
				'--address',
				TEST_CONTRACT_ADDRESS,
				'--rpc-url',
				RPC_URL,
			]);

			expect(exitCode).toBe(0);
			const result = JSON.parse(stdout);
			expect(result).toBeDefined();
		});
	});

	describe('get_storage_at', () => {
		it('should get contract storage value at a slot', async () => {
			const {stdout, exitCode} = await invokeCliCommand([
				'get_storage_at',
				'--address',
				TEST_CONTRACT_ADDRESS,
				'--slot',
				'0',
				'--rpc-url',
				RPC_URL,
			]);

			expect(exitCode).toBe(0);
			const result = JSON.parse(stdout);
			expect(result.address).toBe(TEST_CONTRACT_ADDRESS);
			expect(result.storage).toBeDefined();
			expect(result.storageAsNumber).toBeDefined();
		});

		it('should get storage with hex slot', async () => {
			const {stdout, exitCode} = await invokeCliCommand([
				'get_storage_at',
				'--address',
				TEST_CONTRACT_ADDRESS,
				'--slot',
				'0x0',
				'--rpc-url',
				RPC_URL,
			]);

			expect(exitCode).toBe(0);
			const result = JSON.parse(stdout);
			expect(result.slot).toBe('0x0');
		});
	});

	describe('get_fee_history', () => {
		it('should get fee history for EIP-1559 pricing', async () => {
			const {stdout, exitCode} = await invokeCliCommand([
				'get_fee_history',
				'--blockCount',
				'4',
				'--newestBlock',
				'latest',
				'--rewardPercentiles',
				'25,50,75',
				'--rpc-url',
				RPC_URL,
			]);

			expect(exitCode).toBe(0);
			const result = JSON.parse(stdout);
			expect(result.baseFeePerGas).toBeDefined();
			expect(result.gasUsedRatio).toBeDefined();
		});

		it('should get fee history with newestBlock as number', async () => {
			const {stdout, exitCode} = await invokeCliCommand([
				'get_fee_history',
				'--blockCount',
				'4',
				'--newestBlock',
				'0',
				'--rewardPercentiles',
				'25,50,75',
				'--rpc-url',
				RPC_URL,
			]);

			expect(exitCode).toBe(0);
			const result = JSON.parse(stdout);
			expect(result.baseFeePerGas).toBeDefined();
			expect(result.gasUsedRatio).toBeDefined();
			expect(result.oldestBlock).toBeDefined();
		});
	});

	describe('get_transaction_count', () => {
		it('should get transaction count for an address', async () => {
			const {stdout, exitCode} = await invokeCliCommand([
				'get_transaction_count',
				'--address',
				TEST_ADDRESS,
				'--rpc-url',
				RPC_URL,
			]);

			expect(exitCode).toBe(0);
			const result = JSON.parse(stdout);
			expect(result.address).toBe(TEST_ADDRESS);
			expect(result.transactionCount).toBeDefined();
		});
	});
});