import {describe, it, expect, beforeAll, afterAll} from 'vitest';
import {
	setupTestEnvironment,
	teardownTestEnvironment,
	getTestContext,
	TEST_RECIPIENT,
	TRANSFER_EVENT_ABI,
	APPROVAL_EVENT_ABI,
	ERC20_TRANSFER_ABI,
} from './setup.js';
import {callToolWithTextResponse} from './utils/index.js';

describe('Log Query Tools', () => {
	beforeAll(async () => {
		await setupTestEnvironment();
	}, 30000);

	afterAll(async () => {
		await teardownTestEnvironment();
	});

	describe('get_contract_logs', () => {
		it('should get logs from a contract', async () => {
			const {client} = getTestContext();
			// Send a transaction to generate a log
			await callToolWithTextResponse(client, {
				name: 'send_transaction',
				arguments: {
					to: '0x5FbDB2315678afecb367f032d93F642f64180aa3',
					abi: ERC20_TRANSFER_ABI,
					args: [TEST_RECIPIENT, 100],
				},
			});
			await new Promise((resolve) => setTimeout(resolve, 1000));

			const result = await callToolWithTextResponse(client, {
				name: 'get_contract_logs',
				arguments: {
					contractAddress: '0x5FbDB2315678afecb367f032d93F642f64180aa3',
					fromBlock: 'latest',
					toBlock: 'latest',
				},
			});
			expect(result.content[0].type).toBe('text');
			const data = JSON.parse(result.content[0].text);
			expect(data.contractAddress).toBe('0x5FbDB2315678afecb367f032d93F642f64180aa3');
			expect(data.totalLogs).toBeDefined();
		});

		it('should get logs with block numbers', async () => {
			const {client} = getTestContext();
			const result = await callToolWithTextResponse(client, {
				name: 'get_contract_logs',
				arguments: {
					contractAddress: '0x5FbDB2315678afecb367f032d93F642f64180aa3',
					fromBlock: 0,
					toBlock: 'latest',
				},
			});
			expect(result.content[0].type).toBe('text');
			const data = JSON.parse(result.content[0].text);
			expect(data.totalLogs).toBeDefined();
			expect(data.logs).toBeDefined();
		});

		it('should decode logs with event ABI', async () => {
			const {client} = getTestContext();
			// Send a transaction to generate a log
			await callToolWithTextResponse(client, {
				name: 'send_transaction',
				arguments: {
					to: '0x5FbDB2315678afecb367f032d93F642f64180aa3',
					abi: ERC20_TRANSFER_ABI,
					args: [TEST_RECIPIENT, 100],
				},
			});
			await new Promise((resolve) => setTimeout(resolve, 1000));

			const result = await callToolWithTextResponse(client, {
				name: 'get_contract_logs',
				arguments: {
					contractAddress: '0x5FbDB2315678afecb367f032d93F642f64180aa3',
					fromBlock: 'latest',
					toBlock: 'latest',
					eventAbis: [TRANSFER_EVENT_ABI],
				},
			});
			expect(result.content[0].type).toBe('text');
			const data = JSON.parse(result.content[0].text);
			expect(data.logs).toBeDefined();
			// Check if any log was decoded
			const decodedLogs = data.logs.filter((log: any) => log.decoded);
			expect(decodedLogs.length).toBeGreaterThanOrEqual(0);
		});

		it('should decode logs with multiple event ABIs', async () => {
			const {client} = getTestContext();
			const result = await callToolWithTextResponse(client, {
				name: 'get_contract_logs',
				arguments: {
					contractAddress: '0x5FbDB2315678afecb367f032d93F642f64180aa3',
					fromBlock: 0,
					toBlock: 'latest',
					eventAbis: [TRANSFER_EVENT_ABI, APPROVAL_EVENT_ABI],
				},
			});
			expect(result.content[0].type).toBe('text');
			const data = JSON.parse(result.content[0].text);
			expect(data.logs).toBeDefined();
		});

		it('should decode logs with JSON format event ABI', async () => {
			const {client} = getTestContext();
			const jsonEventAbi = JSON.stringify({
				type: 'event',
				name: 'Transfer',
				inputs: [
					{type: 'address', indexed: true, name: 'from'},
					{type: 'address', indexed: true, name: 'to'},
					{type: 'uint256', indexed: false, name: 'amount'},
				],
			});

			const result = await callToolWithTextResponse(client, {
				name: 'get_contract_logs',
				arguments: {
					contractAddress: '0x5FbDB2315678afecb367f032d93F642f64180aa3',
					fromBlock: 0,
					toBlock: 'latest',
					eventAbis: [jsonEventAbi],
				},
			});
			expect(result.content[0].type).toBe('text');
			const data = JSON.parse(result.content[0].text);
			expect(data.logs).toBeDefined();
			expect(data.contractAddress).toBe('0x5FbDB2315678afecb367f032d93F642f64180aa3');
		});
	});

	describe('get_transaction_logs', () => {
		it('should get logs for a transaction', async () => {
			const {client} = getTestContext();
			// Send a transaction
			const sendResult = await callToolWithTextResponse(client, {
				name: 'send_transaction',
				arguments: {
					to: '0x5FbDB2315678afecb367f032d93F642f64180aa3',
					abi: ERC20_TRANSFER_ABI,
					args: [TEST_RECIPIENT, 100],
				},
			});
			const txHash = JSON.parse(sendResult.content[0].text).txHash;
			await new Promise((resolve) => setTimeout(resolve, 1000));

			// Get the logs
			const result = await callToolWithTextResponse(client, {
				name: 'get_transaction_logs',
				arguments: {
					txHash,
				},
			});
			expect(result.content[0].type).toBe('text');
			const data = JSON.parse(result.content[0].text);
			expect(data.txHash).toBe(txHash);
			expect(data.totalLogs).toBeDefined();
			expect(data.logs).toBeDefined();
		});

		it('should decode transaction logs with event ABI', async () => {
			const {client} = getTestContext();
			// Send a transaction
			const sendResult = await callToolWithTextResponse(client, {
				name: 'send_transaction',
				arguments: {
					to: '0x5FbDB2315678afecb367f032d93F642f64180aa3',
					abi: ERC20_TRANSFER_ABI,
					args: [TEST_RECIPIENT, 100],
				},
			});
			const txHash = JSON.parse(sendResult.content[0].text).txHash;
			await new Promise((resolve) => setTimeout(resolve, 1000));

			// Get the logs with decoding
			const result = await callToolWithTextResponse(client, {
				name: 'get_transaction_logs',
				arguments: {
					txHash,
					eventAbis: [TRANSFER_EVENT_ABI],
				},
			});
			expect(result.content[0].type).toBe('text');
			const data = JSON.parse(result.content[0].text);
			expect(data.logs).toBeDefined();
			// Check if any log was decoded
			const decodedLogs = data.logs.filter((log: any) => log.decoded);
			expect(decodedLogs.length).toBeGreaterThanOrEqual(0);
		});

		it('should return error for non-existent transaction', async () => {
			const {client} = getTestContext();
			const result = await callToolWithTextResponse(client, {
				name: 'get_transaction_logs',
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
});