/**
 * CLI Contract Interaction Tools Tests
 */

import {describe, it, expect, beforeAll, afterAll} from 'vitest';
import {setupTestEnvironment, teardownTestEnvironment, TEST_ADDRESS} from '../setup.js';
import {TEST_CONTRACT_ADDRESS} from '../utils/data.js';
import {RPC_URL} from '../prool/url.js';
import {invokeCliCommand} from '../cli-utils.js';

describe('CLI - Contract Tools', () => {
	beforeAll(async () => {
		await setupTestEnvironment();
	}, 30000);

	afterAll(async () => {
		await teardownTestEnvironment();
	});

	describe('call_contract', () => {
		it('should call a read-only contract function with address and abi', async () => {
			const {stdout, exitCode} = await invokeCliCommand([
				'call_contract',
				'--address',
				TEST_CONTRACT_ADDRESS,
				'--abi',
				'function balanceOf(address) returns (uint256)',
				'--args',
				TEST_ADDRESS,
				'--rpc-url',
				RPC_URL,
			]);

			expect(exitCode).toBe(0);
			const result = JSON.parse(stdout);
			expect(result.address).toBe(TEST_CONTRACT_ADDRESS);
			expect(result.functionName).toBe('balanceOf');
			expect(result.result).toBeDefined();
		});

		it('should call contract with blockTag parameter', async () => {
			const {stdout, exitCode} = await invokeCliCommand([
				'call_contract',
				'--address',
				TEST_CONTRACT_ADDRESS,
				'--abi',
				'function totalSupply() returns (uint256)',
				'--blockTag',
				'latest',
				'--rpc-url',
				RPC_URL,
			]);

			expect(exitCode).toBe(0);
			const result = JSON.parse(stdout);
			expect(result.address).toBe(TEST_CONTRACT_ADDRESS);
			expect(result.functionName).toBe('totalSupply');
			expect(result.blockTag).toBe('latest');
		});

		it('should call contract with no args parameter', async () => {
			const {stdout, exitCode} = await invokeCliCommand([
				'call_contract',
				'--address',
				TEST_CONTRACT_ADDRESS,
				'--abi',
				'function name() returns (string)',
				'--rpc-url',
				RPC_URL,
			]);

			expect(exitCode).toBe(0);
			const result = JSON.parse(stdout);
			expect(result.address).toBe(TEST_CONTRACT_ADDRESS);
			expect(result.functionName).toBe('name');
			expect(result.result).toBeDefined();
		});

		it('should call contract with array args', async () => {
			const {stdout, exitCode} = await invokeCliCommand([
				'call_contract',
				'--address',
				TEST_CONTRACT_ADDRESS,
				'--abi',
				'function balanceOf(address) returns (uint256)',
				'--args',
				`["${TEST_ADDRESS}"]`,
				'--rpc-url',
				RPC_URL,
			]);

			expect(exitCode).toBe(0);
			const result = JSON.parse(stdout);
			expect(result.address).toBe(TEST_CONTRACT_ADDRESS);
			expect(result.result).toBeDefined();
		});
	});

	describe('estimate_gas', () => {
		it('should estimate gas for a transaction', async () => {
			const {stdout, exitCode} = await invokeCliCommand([
				'estimate_gas',
				'--to',
				TEST_ADDRESS,
				'--data',
				'0x',
				'--rpc-url',
				RPC_URL,
			]);

			expect(exitCode).toBe(0);
			const result = JSON.parse(stdout);
			expect(result.gasUsed).toBeDefined();
			expect(Number(result.gasUsed)).toBeGreaterThanOrEqual(0);
		});

		it('should estimate gas with value parameter', async () => {
			const {stdout, exitCode} = await invokeCliCommand([
				'estimate_gas',
				'--to',
				TEST_ADDRESS,
				'--data',
				'0x',
				'--value',
				'1000000000000000000',
				'--rpc-url',
				RPC_URL,
			]);

			expect(exitCode).toBe(0);
			const result = JSON.parse(stdout);
			expect(result.gasUsed).toBeDefined();
		});

		it('should estimate gas with from parameter', async () => {
			const {stdout, exitCode} = await invokeCliCommand([
				'estimate_gas',
				'--to',
				TEST_ADDRESS,
				'--data',
				'0x',
				'--from',
				TEST_ADDRESS,
				'--rpc-url',
				RPC_URL,
			]);

			expect(exitCode).toBe(0);
			const result = JSON.parse(stdout);
			expect(result.gasUsed).toBeDefined();
		});

		it('should estimate gas with blockTag parameter', async () => {
			const {stdout, exitCode} = await invokeCliCommand([
				'estimate_gas',
				'--to',
				TEST_ADDRESS,
				'--data',
				'0x',
				'--blockTag',
				'latest',
				'--rpc-url',
				RPC_URL,
			]);

			expect(exitCode).toBe(0);
			const result = JSON.parse(stdout);
			expect(result.gasUsed).toBeDefined();
		});
	});

	describe('decode_calldata', () => {
		it('should decode calldata with abi', async () => {
			const transferCalldata =
				'0xa9059cbb000000000000000000000000' +
				TEST_ADDRESS.slice(2) +
				'0000000000000000000000000000000000000000000000000000000000000064';

			const {stdout, exitCode} = await invokeCliCommand([
				'decode_calldata',
				'--calldata',
				transferCalldata,
				'--abi',
				'function transfer(address to, uint256 amount) returns (bool)',
				'--rpc-url',
				RPC_URL,
			]);

			expect(exitCode).toBe(0);
			const result = JSON.parse(stdout);
			expect(result.functionName).toBe('transfer');
			expect(result.args).toBeDefined();
		});

		it('should decode calldata without abi (auto-detect)', async () => {
			const transferCalldata =
				'0xa9059cbb000000000000000000000000' +
				TEST_ADDRESS.slice(2) +
				'0000000000000000000000000000000000000000000000000000000000000064';

			const {stdout, exitCode} = await invokeCliCommand([
				'decode_calldata',
				'--calldata',
				transferCalldata,
				'--rpc-url',
				RPC_URL,
			]);

			expect(exitCode).toBe(0);
			const result = JSON.parse(stdout);
			expect(result).toBeDefined();
		});
	});

	describe('encode_calldata', () => {
		it('should encode calldata with abi and args', async () => {
			const {stdout, exitCode} = await invokeCliCommand([
				'encode_calldata',
				'--abi',
				'function transfer(address to, uint256 amount) returns (bool)',
				'--args',
				TEST_ADDRESS + ',100',
				'--rpc-url',
				RPC_URL,
			]);

			expect(exitCode).toBe(0);
			const result = JSON.parse(stdout);
			expect(result.calldata).toBeDefined();
			expect(result.calldata).toMatch(/^0x[a-f0-9]+$/);
		});

		it('should encode calldata with no args parameter', async () => {
			const {stdout, exitCode} = await invokeCliCommand([
				'encode_calldata',
				'--abi',
				'function totalSupply() returns (uint256)',
				'--rpc-url',
				RPC_URL,
			]);

			expect(exitCode).toBe(0);
			const result = JSON.parse(stdout);
			expect(result.calldata).toBeDefined();
			expect(result.calldata).toMatch(/^0x[a-f0-9]+$/);
		});

		it('should encode calldata with array args', async () => {
			const {stdout, exitCode} = await invokeCliCommand([
				'encode_calldata',
				'--abi',
				'function transfer(address to, uint256 amount) returns (bool)',
				'--args',
				`["${TEST_ADDRESS}","100"]`,
				'--rpc-url',
				RPC_URL,
			]);

			expect(exitCode).toBe(0);
			const result = JSON.parse(stdout);
			expect(result.calldata).toBeDefined();
			expect(result.calldata).toMatch(/^0x[a-f0-9]+$/);
		});
	});
});
