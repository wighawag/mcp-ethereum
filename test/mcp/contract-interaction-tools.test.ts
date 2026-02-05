import {describe, it, expect, beforeAll, afterAll} from 'vitest';
import {
	setupTestEnvironmentForMPCServer,
	teardownTestEnvironment,
	getTestContextForMPCServer,
	TEST_ADDRESS,
	TEST_RECIPIENT,
	TRANSFER_EVENT_ABI,
	ERC20_BALANCE_OF_ABI,
	ERC20_TOTAL_SUPPLY_ABI,
	ERC20_TRANSFER_ABI,
} from '../setup.js';
import {callToolWithTextResponse} from '../utils/index.js';
import {TEST_CONTRACT_ADDRESS} from '../utils/data.js';

describe('Contract Interaction Tools', () => {
	beforeAll(async () => {
		await setupTestEnvironmentForMPCServer();
	}, 30000);

	afterAll(async () => {
		await teardownTestEnvironment();
	});

	describe('call_contract', () => {
		it('should call a read-only contract function', async () => {
			const {client} = getTestContextForMPCServer();
			const result = await callToolWithTextResponse(client, {
				name: 'call_contract',
				arguments: {
					address: TEST_CONTRACT_ADDRESS,
					abi: ERC20_TOTAL_SUPPLY_ABI,
					args: [],
				},
			});
			expect(result.content[0].type).toBe('text');
			const data = JSON.parse(result.content[0].text);
			expect(data.address || data.result).toBeDefined();
		});

		it('should call contract with arguments', async () => {
			const {client} = getTestContextForMPCServer();
			const result = await callToolWithTextResponse(client, {
				name: 'call_contract',
				arguments: {
					address: TEST_CONTRACT_ADDRESS,
					abi: ERC20_BALANCE_OF_ABI,
					args: [TEST_ADDRESS],
				},
			});
			expect(result.content[0].type).toBe('text');
			const data = JSON.parse(result.content[0].text);
			expect(data.functionName || data.result).toBeDefined();
		});

		it('should call contract with blockTag', async () => {
			const {client} = getTestContextForMPCServer();
			const result = await callToolWithTextResponse(client, {
				name: 'call_contract',
				arguments: {
					address: TEST_CONTRACT_ADDRESS,
					abi: ERC20_TOTAL_SUPPLY_ABI,
					args: [],
					blockTag: 'latest',
				},
			});
			expect(result.content[0].type).toBe('text');
			const data = JSON.parse(result.content[0].text);
			expect(data.blockTag || data.result).toBeDefined();
		});

		it('should return error for non-function ABI', async () => {
			const {client} = getTestContextForMPCServer();
			const result = await callToolWithTextResponse(client, {
				name: 'call_contract',
				arguments: {
					address: TEST_CONTRACT_ADDRESS,
					abi: TRANSFER_EVENT_ABI,
					args: [],
				},
			});
			expect(result.content[0].type).toBe('text');
			const data = JSON.parse(result.content[0].text);
			expect(data.error).toBeDefined();
			expect(result.isError).toBe(true);
		});
	});

	describe('estimate_gas', () => {
		it('should estimate gas for simple ETH transfer', async () => {
			const {client} = getTestContextForMPCServer();
			const result = await callToolWithTextResponse(client, {
				name: 'estimate_gas',
				arguments: {
					to: TEST_RECIPIENT,
					value: '1000000000000000000', // 1 ETH
				},
			});
			expect(result.content[0].type).toBe('text');
			const data = JSON.parse(result.content[0].text);
			expect(data.gasUsed).toBeDefined();
			expect(data.gasEstimateInGwei).toBeDefined();
		});

		it('should estimate gas for contract call', async () => {
			const {client} = getTestContextForMPCServer();
			const result = await callToolWithTextResponse(client, {
				name: 'estimate_gas',
				arguments: {
					to: TEST_CONTRACT_ADDRESS,
					abi: ERC20_TRANSFER_ABI,
					args: [TEST_RECIPIENT, '10'],
				},
			});
			expect(result.content[0].type).toBe('text');
			const data = JSON.parse(result.content[0].text);
			expect(data.gasUsed).toBeDefined();
		});

		it('should estimate gas with value', async () => {
			const {client} = getTestContextForMPCServer();
			const result = await callToolWithTextResponse(client, {
				name: 'estimate_gas',
				arguments: {
					to: TEST_RECIPIENT,
					value: '1000', // small amount
				},
			});
			expect(result.content[0].type).toBe('text');
			const data = JSON.parse(result.content[0].text);
			expect(data.gasUsed).toBeDefined();
		});
	});

	describe('encode_calldata', () => {
		it('should encode function arguments', async () => {
			const {client} = getTestContextForMPCServer();
			const result = await callToolWithTextResponse(client, {
				name: 'encode_calldata',
				arguments: {
					abi: ERC20_TRANSFER_ABI,
					args: [TEST_RECIPIENT, 100],
				},
			});
			expect(result.content[0].type).toBe('text');
			const data = JSON.parse(result.content[0].text);
			expect(data.functionName).toBe('transfer');
			expect(data.calldata).toBeDefined();
			expect(data.calldata).toMatch(/^0x[a-fA-F0-9]+$/);
		});

		it('should return error for non-function ABI', async () => {
			const {client} = getTestContextForMPCServer();
			const result = await callToolWithTextResponse(client, {
				name: 'encode_calldata',
				arguments: {
					abi: TRANSFER_EVENT_ABI,
					args: [TEST_RECIPIENT, 100],
				},
			});
			expect(result.content[0].type).toBe('text');
			const data = JSON.parse(result.content[0].text);
			expect(data.error).toBeDefined();
			expect(result.isError).toBe(true);
		});
	});

	describe('decode_calldata', () => {
		it('should decode calldata using function ABI', async () => {
			const {client} = getTestContextForMPCServer();
			// First encode the data
			const encodeResult = await callToolWithTextResponse(client, {
				name: 'encode_calldata',
				arguments: {
					abi: ERC20_TRANSFER_ABI,
					args: [TEST_RECIPIENT, 100],
				},
			});
			const encodedCalldata = JSON.parse(encodeResult.content[0].text).calldata;

			// Then decode it
			const result = await callToolWithTextResponse(client, {
				name: 'decode_calldata',
				arguments: {
					calldata: encodedCalldata,
					abi: ERC20_TRANSFER_ABI,
				},
			});
			expect(result.content[0].type).toBe('text');
			const data = JSON.parse(result.content[0].text);
			expect(data.functionName).toBe('transfer');
			expect(data.args).toBeDefined();
			expect(data.args[0].toLowerCase()).toBe(TEST_RECIPIENT.toLowerCase());
			// BigInt values get converted to strings when JSON serialized
			expect(Number(data.args[1])).toBe(100);
		});

		it('should return error for non-function ABI', async () => {
			const {client} = getTestContextForMPCServer();
			const result = await callToolWithTextResponse(client, {
				name: 'decode_calldata',
				arguments: {
					calldata: '0x1234',
					abi: TRANSFER_EVENT_ABI,
				},
			});
			expect(result.content[0].type).toBe('text');
			const data = JSON.parse(result.content[0].text);
			expect(data.error).toBeDefined();
			expect(result.isError).toBe(true);
		});
	});
});
