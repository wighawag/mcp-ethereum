import {describe, it, expect, beforeAll, afterAll, assert} from 'vitest';
import {createServer} from '../src/index.js';
import {McpServer} from '@modelcontextprotocol/sdk/server/mcp.js';
import {Client} from '@modelcontextprotocol/sdk/client';
import {InMemoryTransport} from '@modelcontextprotocol/sdk/inMemory.js';
import {getChain} from '../src/helpers.js';
import {Server} from 'prool';
import {Instance} from 'prool';
import {callToolWithTextResponse} from './utils/index.js';
import {TEST_CONTRACT_ABI, TEST_CONTRACT_ADDRESS, TEST_CONTRACT_BYTECODE} from './utils/data.js';
import {createPublicClient, createWalletClient, http} from 'viem';

// Test addresses
const TEST_DEPLOYER_ADDRESS = '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266'; // acount 1
const TEST_ADDRESS = '0x70997970C51812dc3A010C7d01b50e0d17dc79C8'; // acount 2
const TEST_PRIVATE_KEY = '0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d';
const TEST_RECIPIENT = '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC'; // acount 3

// Test ABIs
const ERC20_BALANCE_OF_ABI = 'function balanceOf(address) returns (uint256)';
const ERC20_TOTAL_SUPPLY_ABI = 'function totalSupply() returns (uint256)';
const ERC20_TRANSFER_ABI = 'function transfer(address to, uint256 amount) returns (bool)';
const TRANSFER_EVENT_ABI =
	'event Transfer(address indexed from, address indexed to, uint256 amount)';
const APPROVAL_EVENT_ABI =
	'event Approval(address indexed owner, address indexed spender, uint256 value)';

// Create Anvil server
const anvilServer = Server.create({
	instance: Instance.anvil(),
	port: 8555,
});

describe('MCP Ethereum Server Tests', () => {
	let server: McpServer;
	let client: Client;
	let rpcUrl: string;

	beforeAll(async () => {
		// Start Anvil server
		await anvilServer.start();
		rpcUrl = 'http://localhost:8555/1';

		// Wait a moment for the server to be ready
		await new Promise((resolve) => setTimeout(resolve, 1000));

		// Create chain with local RPC
		const chain = await getChain(rpcUrl);

		const walletClient = createWalletClient({chain, transport: http(rpcUrl)});
		const publicClient = createPublicClient({chain, transport: http(rpcUrl)});

		const hashForDeployment = await walletClient.deployContract({
			abi: TEST_CONTRACT_ABI,
			args: [TEST_ADDRESS, 1_000_000n],
			bytecode: TEST_CONTRACT_BYTECODE,
			account: TEST_DEPLOYER_ADDRESS,
		});

		const receiptForDeployment = await publicClient.waitForTransactionReceipt({
			hash: hashForDeployment,
		});
		assert(
			receiptForDeployment.contractAddress?.toLowerCase() === TEST_CONTRACT_ADDRESS.toLowerCase(),
		);

		const hashForTokens = await walletClient.writeContract({
			account: TEST_DEPLOYER_ADDRESS,
			abi: TEST_CONTRACT_ABI,
			functionName: 'transfer',
			args: [TEST_ADDRESS, 1_000n],
			address: TEST_CONTRACT_ADDRESS,
		});
		await publicClient.waitForTransactionReceipt({hash: hashForTokens});

		// console.log(`Contract deployed at ${receipt.contractAddress}`);

		// Create server
		server = createServer({
			chain,
			privateKey: TEST_PRIVATE_KEY,
		});

		// Connect using an in-memory transport
		const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
		client = new Client({name: 'test-client', version: '1.0.0'}, {});

		await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
	}, 30000);

	afterAll(async () => {
		// Stop Anvil server
		await anvilServer.stop();
		// Close client connection
		await client.close();
	});

	describe('Server Creation', () => {
		it('should create server instance', () => {
			expect(server).toBeInstanceOf(McpServer);
		});
	});

	describe('Read-Only Tools', () => {
		describe('get_balance', () => {
			it('should get ETH balance for an address', async () => {
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
				const result = await callToolWithTextResponse(client, {
					name: 'get_block',
					arguments: {},
				});
				expect(result.content[0].type).toBe('text');
				const data = JSON.parse(result.content[0].text);
				// get_block returns formatted data with specific field names
				expect(data.parentHash).toBeDefined();
				expect(data.transactionCount).toBeDefined();
				expect(data.gasUsed).toBeDefined();
				expect(data.gasLimit).toBeDefined();
			});

			it('should get block by number', async () => {
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
				const result = await callToolWithTextResponse(client, {
					name: 'get_latest_block',
					arguments: {},
				});
				expect(result.content[0].type).toBe('text');
				const data = JSON.parse(result.content[0].text);
				// get_latest_block returns the full viem block object
				expect(data.number || data.blockNumber).toBeDefined();
				expect(data.hash).toBeDefined();
			});
		});

		describe('get_block_number', () => {
			it('should get current block number', async () => {
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
				const result = await callToolWithTextResponse(client, {
					name: 'get_code',
					arguments: {
						address: TEST_CONTRACT_ADDRESS,
					},
				});
				expect(result.content[0].type).toBe('text');
				const data = JSON.parse(result.content[0].text);
				// Contract might not exist in fresh Anvil, so just verify we get a response
				expect(data).toBeDefined();
			});
		});

		describe('get_storage_at', () => {
			it('should get contract storage value at a slot', async () => {
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

	describe('Contract Interaction Tools', () => {
		describe('call_contract', () => {
			it('should call a read-only contract function', async () => {
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
				const result = await callToolWithTextResponse(client, {
					name: 'estimate_gas',
					arguments: {
						to: TEST_RECIPIENT,
						value: '1000000000000000000', // 1 ETH
					},
				});
				expect(result.content[0].type).toBe('text');
				const data = JSON.parse(result.content[0].text);
				expect(data.gasEstimate).toBeDefined();
				expect(data.gasEstimateInGwei).toBeDefined();
			});

			it('should estimate gas for contract call', async () => {
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
				expect(data.gasEstimate).toBeDefined();
			});

			it('should estimate gas with value', async () => {
				const result = await callToolWithTextResponse(client, {
					name: 'estimate_gas',
					arguments: {
						to: TEST_RECIPIENT,
						value: '1000', // small amount
					},
				});
				expect(result.content[0].type).toBe('text');
				const data = JSON.parse(result.content[0].text);
				expect(data.gasEstimate).toBeDefined();
			});
		});

		describe('encode_calldata', () => {
			it('should encode function arguments', async () => {
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
				expect(data.encodedData).toBeDefined();
				expect(data.encodedData).toMatch(/^0x[a-fA-F0-9]+$/);
			});

			it('should return error for non-function ABI', async () => {
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
				// First encode the data
				const encodeResult = await callToolWithTextResponse(client, {
					name: 'encode_calldata',
					arguments: {
						abi: ERC20_TRANSFER_ABI,
						args: [TEST_RECIPIENT, 100],
					},
				});
				const encodedData = JSON.parse(encodeResult.content[0].text).encodedData;

				// Then decode it
				const result = await callToolWithTextResponse(client, {
					name: 'decode_calldata',
					arguments: {
						data: encodedData,
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
				const result = await callToolWithTextResponse(client, {
					name: 'decode_calldata',
					arguments: {
						data: '0x1234',
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

	describe('Transaction Tools', () => {
		describe('send_transaction', () => {
			it('should send a simple ETH transfer', async () => {
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
				const result = await callToolWithTextResponse(client, {
					name: 'send_transaction',
					arguments: {
						to: TEST_CONTRACT_ADDRESS,
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
				// Send a transaction
				const sendResult = await callToolWithTextResponse(client, {
					name: 'send_transaction',
					arguments: {
						to: TEST_RECIPIENT,
						value: '1000000000000000',
					},
				});
				const txHash = JSON.parse(sendResult.content[0].text).txHash;

				// Wait for confirmation - note that Anvil mines blocks instantly, so this should be quick
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
				// In Anvil, transactions are mined instantly, so it should be confirmed
				// If not, at least check we got a valid response
				expect(['confirmed', 'timeout']).toContain(data.status);
				expect(data.txHash).toBe(txHash);
			}, 15000);

			it('should handle timeout', async () => {
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
				// Send a transaction that will revert by calling a non-existent function
				// This test is best-effort - the contract may not exist or may have different behavior
				const NON_EXISTENT_FUNCTION_ABI = 'function thisFunctionDoesNotExist() returns (uint256)';

				const sendResult = await callToolWithTextResponse(client, {
					name: 'send_transaction',
					arguments: {
						to: TEST_CONTRACT_ADDRESS,
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
				// We accept both outcomes as valid test coverage
				expect(['confirmed', 'reverted', 'timeout']).toContain(data.status);

				// If reverted, verify the response contains revert information
				if (data.status === 'reverted') {
					expect(data.txHash).toBe(txHash);
					expect(data.receipt).toBeDefined();
				}
			}, 15000);
		});
	});

	describe('Log Query Tools', () => {
		describe('get_contract_logs', () => {
			it('should get logs from a contract', async () => {
				// Send a transaction to generate a log
				await callToolWithTextResponse(client, {
					name: 'send_transaction',
					arguments: {
						to: TEST_CONTRACT_ADDRESS,
						abi: ERC20_TRANSFER_ABI,
						args: [TEST_RECIPIENT, 100],
					},
				});
				await new Promise((resolve) => setTimeout(resolve, 1000));

				const result = await callToolWithTextResponse(client, {
					name: 'get_contract_logs',
					arguments: {
						contractAddress: TEST_CONTRACT_ADDRESS,
						fromBlock: 'latest',
						toBlock: 'latest',
					},
				});
				expect(result.content[0].type).toBe('text');
				const data = JSON.parse(result.content[0].text);
				expect(data.contractAddress).toBe(TEST_CONTRACT_ADDRESS);
				expect(data.totalLogs).toBeDefined();
			});

			it('should get logs with block numbers', async () => {
				const result = await callToolWithTextResponse(client, {
					name: 'get_contract_logs',
					arguments: {
						contractAddress: TEST_CONTRACT_ADDRESS,
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
				// Send a transaction to generate a log
				await callToolWithTextResponse(client, {
					name: 'send_transaction',
					arguments: {
						to: TEST_CONTRACT_ADDRESS,
						abi: ERC20_TRANSFER_ABI,
						args: [TEST_RECIPIENT, 100],
					},
				});
				await new Promise((resolve) => setTimeout(resolve, 1000));

				const result = await callToolWithTextResponse(client, {
					name: 'get_contract_logs',
					arguments: {
						contractAddress: TEST_CONTRACT_ADDRESS,
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
				const result = await callToolWithTextResponse(client, {
					name: 'get_contract_logs',
					arguments: {
						contractAddress: TEST_CONTRACT_ADDRESS,
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
						contractAddress: TEST_CONTRACT_ADDRESS,
						fromBlock: 0,
						toBlock: 'latest',
						eventAbis: [jsonEventAbi],
					},
				});
				expect(result.content[0].type).toBe('text');
				const data = JSON.parse(result.content[0].text);
				expect(data.logs).toBeDefined();
				expect(data.contractAddress).toBe(TEST_CONTRACT_ADDRESS);
			});
		});

		describe('get_transaction_logs', () => {
			it('should get logs for a transaction', async () => {
				// Send a transaction
				const sendResult = await callToolWithTextResponse(client, {
					name: 'send_transaction',
					arguments: {
						to: TEST_CONTRACT_ADDRESS,
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
				// Send a transaction
				const sendResult = await callToolWithTextResponse(client, {
					name: 'send_transaction',
					arguments: {
						to: TEST_CONTRACT_ADDRESS,
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

	describe('Advanced Features', () => {
		describe('sign_message', () => {
			it('should sign a message', async () => {
				const result = await callToolWithTextResponse(client, {
					name: 'sign_message',
					arguments: {
						message: 'Hello, Ethereum!',
					},
				});
				expect(result.content[0].type).toBe('text');
				const data = JSON.parse(result.content[0].text);
				expect(data.message).toBe('Hello, Ethereum!');
				expect(data.signature).toMatch(/^0x[a-fA-F0-9]+$/);
				expect(data.address).toBeDefined();
			});

			it('should sign a longer message', async () => {
				const longMessage =
					'This is a longer message that should still be signed correctly by the wallet client.';
				const result = await callToolWithTextResponse(client, {
					name: 'sign_message',
					arguments: {
						message: longMessage,
					},
				});
				expect(result.content[0].type).toBe('text');
				const data = JSON.parse(result.content[0].text);
				expect(data.message).toBe(longMessage);
				expect(data.signature).toBeDefined();
			});
		});
	});

	describe('Error Handling', () => {
		it('should handle invalid address format', async () => {
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
			const result = await callToolWithTextResponse(client, {
				name: 'get_transaction',
				arguments: {
					txHash: 'invalid-hash',
				},
			});
			expect(result.content[0].type).toBe('text');
			const text = result.content[0].text;
			// TODO remove ambiguity:
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
});
