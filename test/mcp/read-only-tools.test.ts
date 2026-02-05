import {describe, it, expect, beforeAll, afterAll} from 'vitest';
import {
	setupTestEnvironmentForMPCServer,
	teardownTestEnvironment,
	getTestContextForMPCServer,
	TEST_ADDRESS,
} from '../setup.js';
import {callToolWithTextResponse} from '../utils/index.js';
import {TEST_CONTRACT_ADDRESS} from '../utils/data.js';

describe('Read-Only Tools', () => {
	beforeAll(async () => {
		await setupTestEnvironmentForMPCServer();
	}, 30000);

	afterAll(async () => {
		await teardownTestEnvironment();
	});

	describe('get_balance', () => {
		it('should get ETH balance for an address', async () => {
			const {client} = getTestContextForMPCServer();
			const result = await callToolWithTextResponse(client, {
				name: 'get_balance',
				arguments: {
					address: TEST_ADDRESS,
				},
			});
			expect(result.content[0].type).toBe('text');
			const data = JSON.parse(result.content[0].text);
			expect(data.address).toBe(TEST_ADDRESS);
			expect(data.balance).toBeDefined();
			expect(data.balanceInEther).toBeDefined();
		});

		it('should get balance with blockTag', async () => {
			const {client} = getTestContextForMPCServer();
			const result = await callToolWithTextResponse(client, {
				name: 'get_balance',
				arguments: {
					address: TEST_ADDRESS,
					blockTag: 'latest',
				},
			});
			expect(result.content[0].type).toBe('text');
			const data = JSON.parse(result.content[0].text);
			expect(data.address).toBe(TEST_ADDRESS);
		});
	});

	describe('get_block', () => {
		it('should get latest block', async () => {
			const {client} = getTestContextForMPCServer();
			const result = await callToolWithTextResponse(client, {
				name: 'get_block',
				arguments: {},
			});
			expect(result.content[0].type).toBe('text');
			const data = JSON.parse(result.content[0].text);
			expect(data.parentHash).toBeDefined();
			expect(data.transactionCount).toBeDefined();
			expect(data.gasUsed).toBeDefined();
			expect(data.gasLimit).toBeDefined();
		});

		it('should get block by number', async () => {
			const {client} = getTestContextForMPCServer();
			const result = await callToolWithTextResponse(client, {
				name: 'get_block',
				arguments: {
					blockNumber: 0,
				},
			});
			expect(result.content[0].type).toBe('text');
			const data = JSON.parse(result.content[0].text);
			expect(data.blockNumber).toBe('0');
			expect(data.transactionCount).toBeDefined();
		});

		it('should get block with transactions', async () => {
			const {client} = getTestContextForMPCServer();
			const result = await callToolWithTextResponse(client, {
				name: 'get_block',
				arguments: {
					blockNumber: 0,
					includeTransactions: true,
				},
			});
			expect(result.content[0].type).toBe('text');
			const data = JSON.parse(result.content[0].text);
			expect(data.transactions).toBeDefined();
		});

		it('should get block by hash', async () => {
			const {client} = getTestContextForMPCServer();
			// First get a block to get its hash
			const blockResult = await callToolWithTextResponse(client, {
				name: 'get_block',
				arguments: {
					blockNumber: 0,
				},
			});
			const blockData = JSON.parse(blockResult.content[0].text);
			const blockHash = blockData.blockHash;

			// Now get the same block by hash
			const result = await callToolWithTextResponse(client, {
				name: 'get_block',
				arguments: {
					blockHash,
				},
			});
			expect(result.content[0].type).toBe('text');
			const data = JSON.parse(result.content[0].text);
			expect(data.blockHash).toBe(blockHash);
			expect(data.blockNumber).toBe('0');
		});
	});

	describe('get_latest_block', () => {
		it('should get latest block information', async () => {
			const {client} = getTestContextForMPCServer();
			const result = await callToolWithTextResponse(client, {
				name: 'get_latest_block',
				arguments: {},
			});
			expect(result.content[0].type).toBe('text');
			const data = JSON.parse(result.content[0].text);
			expect(data.number || data.blockNumber).toBeDefined();
			expect(data.hash).toBeDefined();
		});
	});

	describe('get_block_number', () => {
		it('should get current block number', async () => {
			const {client} = getTestContextForMPCServer();
			const result = await callToolWithTextResponse(client, {
				name: 'get_block_number',
				arguments: {},
			});
			expect(result.content[0].type).toBe('text');
			const data = JSON.parse(result.content[0].text);
			expect(data.blockNumber).toBeDefined();
		});
	});

	describe('get_chain_id', () => {
		it('should get current chain ID', async () => {
			const {client} = getTestContextForMPCServer();
			const result = await callToolWithTextResponse(client, {
				name: 'get_chain_id',
				arguments: {},
			});
			expect(result.content[0].type).toBe('text');
			const data = JSON.parse(result.content[0].text);
			expect(data.chainId).toBe(31337); // Anvil default chain ID
		});
	});

	describe('get_gas_price', () => {
		it('should get current gas price', async () => {
			const {client} = getTestContextForMPCServer();
			const result = await callToolWithTextResponse(client, {
				name: 'get_gas_price',
				arguments: {},
			});
			expect(result.content[0].type).toBe('text');
			const data = JSON.parse(result.content[0].text);
			expect(data.gasPrice).toBeDefined();
			expect(data.gasPriceInGwei).toBeDefined();
		});
	});

	describe('get_transaction_count', () => {
		it('should get transaction count for an address', async () => {
			const {client} = getTestContextForMPCServer();
			const result = await callToolWithTextResponse(client, {
				name: 'get_transaction_count',
				arguments: {
					address: TEST_ADDRESS,
				},
			});
			expect(result.content[0].type).toBe('text');
			const data = JSON.parse(result.content[0].text);
			expect(data.address).toBe(TEST_ADDRESS);
			expect(data.transactionCount).toBeDefined();
		});
	});

	describe('get_code', () => {
		it('should get code at an address (EOA)', async () => {
			const {client} = getTestContextForMPCServer();
			const result = await callToolWithTextResponse(client, {
				name: 'get_code',
				arguments: {
					address: TEST_ADDRESS,
				},
			});
			expect(result.content[0].type).toBe('text');
			const data = JSON.parse(result.content[0].text);
			expect(data.address).toBe(TEST_ADDRESS);
			expect(data.isContract === false || data.codeLength === 0).toBe(true);
		});

		it('should get code with blockTag', async () => {
			const {client} = getTestContextForMPCServer();
			const result = await callToolWithTextResponse(client, {
				name: 'get_code',
				arguments: {
					address: TEST_ADDRESS,
					blockTag: 'latest',
				},
			});
			expect(result.content[0].type).toBe('text');
			const data = JSON.parse(result.content[0].text);
			expect(data.address).toBe(TEST_ADDRESS);
		});

		it('should get code at contract address', async () => {
			const {client} = getTestContextForMPCServer();
			const result = await callToolWithTextResponse(client, {
				name: 'get_code',
				arguments: {
					address: TEST_CONTRACT_ADDRESS,
				},
			});
			expect(result.content[0].type).toBe('text');
			const data = JSON.parse(result.content[0].text);
			expect(data).toBeDefined();
		});
	});

	describe('get_storage_at', () => {
		it('should get contract storage value at a slot', async () => {
			const {client} = getTestContextForMPCServer();
			const result = await callToolWithTextResponse(client, {
				name: 'get_storage_at',
				arguments: {
					address: TEST_CONTRACT_ADDRESS,
					slot: 0,
				},
			});
			expect(result.content[0].type).toBe('text');
			const data = JSON.parse(result.content[0].text);
			expect(data.address).toBe(TEST_CONTRACT_ADDRESS);
			expect(data.storage).toBeDefined();
			expect(data.storageAsNumber).toBeDefined();
		});

		it('should get storage with hex slot', async () => {
			const {client} = getTestContextForMPCServer();
			const result = await callToolWithTextResponse(client, {
				name: 'get_storage_at',
				arguments: {
					address: TEST_CONTRACT_ADDRESS,
					slot: '0x0',
				},
			});
			expect(result.content[0].type).toBe('text');
			const data = JSON.parse(result.content[0].text);
			expect(data.slot).toBe('0x0');
		});
	});

	describe('get_fee_history', () => {
		it('should get fee history for EIP-1559 pricing', async () => {
			const {client} = getTestContextForMPCServer();
			const result = await callToolWithTextResponse(client, {
				name: 'get_fee_history',
				arguments: {
					blockCount: 4,
					newestBlock: 'latest',
					rewardPercentiles: [25, 50, 75],
				},
			});
			expect(result.content[0].type).toBe('text');
			const data = JSON.parse(result.content[0].text);
			expect(data.baseFeePerGas).toBeDefined();
			expect(data.gasUsedRatio).toBeDefined();
		});

		it('should get fee history with newestBlock as number', async () => {
			const {client} = getTestContextForMPCServer();
			const result = await callToolWithTextResponse(client, {
				name: 'get_fee_history',
				arguments: {
					blockCount: 4,
					newestBlock: 0,
					rewardPercentiles: [25, 50, 75],
				},
			});
			expect(result.content[0].type).toBe('text');
			const data = JSON.parse(result.content[0].text);
			expect(data.baseFeePerGas).toBeDefined();
			expect(data.gasUsedRatio).toBeDefined();
			expect(data.oldestBlock).toBeDefined();
		});
	});
});
