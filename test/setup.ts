import {McpServer} from '@modelcontextprotocol/sdk/server/mcp.js';
import {Client} from '@modelcontextprotocol/sdk/client';
import {InMemoryTransport} from '@modelcontextprotocol/sdk/inMemory.js';
import {createServer} from '../src/index.js';
import {getChain} from '../src/helpers.js';
import {createPublicClient, createWalletClient, http} from 'viem';
import {TEST_CONTRACT_ABI, TEST_CONTRACT_ADDRESS, TEST_CONTRACT_BYTECODE} from './utils/data.js';
import {assert} from 'vitest';
import {RPC_URL} from './prool/url.js';

// Test addresses
export const TEST_DEPLOYER_ADDRESS = '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266'; // acount 1
export const TEST_ADDRESS = '0x70997970C51812dc3A010C7d01b50e0d17dc79C8'; // acount 2
export const TEST_PRIVATE_KEY =
	'0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d';
export const TEST_RECIPIENT = '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC'; // acount 3

// Test ABIs
export const ERC20_BALANCE_OF_ABI = 'function balanceOf(address) returns (uint256)';
export const ERC20_TOTAL_SUPPLY_ABI = 'function totalSupply() returns (uint256)';
export const ERC20_TRANSFER_ABI = 'function transfer(address to, uint256 amount) returns (bool)';
export const TRANSFER_EVENT_ABI =
	'event Transfer(address indexed from, address indexed to, uint256 amount)';
export const APPROVAL_EVENT_ABI =
	'event Approval(address indexed owner, address indexed spender, uint256 value)';

// Test context type
export type TestContext = {
	server: McpServer;
	client: Client;
	rpcUrl: string;
	walletClient: ReturnType<typeof createWalletClient>;
	publicClient: ReturnType<typeof createPublicClient>;
};

// Global test setup
let testContext: TestContext | null = null;

/**
 * Setup test environment - starts Anvil, deploys test contract, creates MCP server
 * @returns Test context with server, client, and RPC clients
 */
export async function setupTestEnvironment(): Promise<TestContext> {
	const rpcUrl = RPC_URL;

	// Create chain with local RPC
	const chain = await getChain(rpcUrl);

	const walletClient = createWalletClient({chain, transport: http(rpcUrl)});
	const publicClient = createPublicClient({chain, transport: http(rpcUrl)});

	// Wait for the RPC to be ready with retries
	let retries = 10;
	let blockNumber: bigint | null = null;
	while (retries > 0) {
		try {
			blockNumber = await publicClient.getBlockNumber();
			if (blockNumber !== undefined && blockNumber !== null) {
				break;
			}
		} catch (error) {
			console.log(`RPC not ready yet, retries left: ${retries}`);
		}
		retries--;
		await new Promise((resolve) => setTimeout(resolve, 500));
	}

	if (blockNumber === null || blockNumber === undefined) {
		throw new Error('Failed to connect to RPC after multiple retries');
	}

	console.log(`RPC ready at block ${blockNumber}`);

	// Deploy test contract with retry mechanism
	let deploymentReceipt: Awaited<ReturnType<typeof publicClient.waitForTransactionReceipt>> | null =
		null;
	let deploymentHash: `0x${string}` | null = null;
	let deploymentRetries = 3;

	while (deploymentRetries > 0 && !deploymentReceipt) {
		try {
			console.log(`Attempting contract deployment (retries left: ${deploymentRetries})`);
			deploymentHash = await walletClient.deployContract({
				abi: TEST_CONTRACT_ABI,
				args: [TEST_ADDRESS, 1_000_000n],
				bytecode: TEST_CONTRACT_BYTECODE,
				account: TEST_DEPLOYER_ADDRESS,
			});

			console.log(`Deployment transaction hash: ${deploymentHash}`);
			deploymentReceipt = await publicClient.waitForTransactionReceipt({
				hash: deploymentHash,
				timeout: 10000, // 10 second timeout
			});

			// Check if transaction was successful
			if (deploymentReceipt.status !== 'success') {
				throw new Error(
					`Contract deployment failed. Transaction hash: ${deploymentHash}, Status: ${deploymentReceipt.status}`,
				);
			}

			// Check if contract address exists
			if (!deploymentReceipt.contractAddress) {
				throw new Error(
					`Contract deployment did not return a contract address. Transaction hash: ${deploymentHash}`,
				);
			}

			console.log(`Contract deployed at: ${deploymentReceipt.contractAddress}`);
		} catch (error) {
			console.error(`Deployment attempt failed:`, error);
			deploymentRetries--;
			if (deploymentRetries > 0) {
				console.log(`Retrying deployment in 1 second...`);
				await new Promise((resolve) => setTimeout(resolve, 1000));
			} else {
				throw new Error(
					`Failed to deploy contract after 3 attempts. Last error: ${error instanceof Error ? error.message : String(error)}`,
				);
			}
		}
	}

	if (!deploymentReceipt || !deploymentReceipt.contractAddress) {
		throw new Error('Contract deployment failed: No receipt or contract address');
	}

	assert(
		deploymentReceipt.contractAddress.toLowerCase() === TEST_CONTRACT_ADDRESS.toLowerCase(),
		`Expected contract address ${TEST_CONTRACT_ADDRESS}, but got ${deploymentReceipt.contractAddress}`,
	);

	// Transfer some tokens to test address
	const hashForTokens = await walletClient.writeContract({
		account: TEST_DEPLOYER_ADDRESS,
		abi: TEST_CONTRACT_ABI,
		functionName: 'transfer',
		args: [TEST_ADDRESS, 1_000n],
		address: '0x5FbDB2315678afecb367f032d93F642f64180aa3',
	});
	await publicClient.waitForTransactionReceipt({hash: hashForTokens});

	// Create MCP server
	const server = createServer({
		chain,
		privateKey: TEST_PRIVATE_KEY,
	});

	// Connect using an in-memory transport
	const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
	const client = new Client({name: 'test-client', version: '1.0.0'}, {});

	await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);

	testContext = {
		server,
		client,
		rpcUrl,
		walletClient,
		publicClient,
	};

	return testContext;
}

/**
 * Tear down test environment - stops Anvil and closes client connection
 */
export async function teardownTestEnvironment(): Promise<void> {
	if (testContext) {
		await testContext.client.close();
	}
	testContext = null;
}

/**
 * Get or create test context
 */
export function getTestContext(): TestContext {
	if (!testContext) {
		throw new Error('Test context not initialized. Call setupTestEnvironment() first.');
	}
	return testContext;
}
