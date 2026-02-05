import {Methods} from 'eip-1193';
import {createCurriedJSONRPC} from 'remote-procedure-call';
import {Chain, createPublicClient, createWalletClient, http} from 'viem';
import {privateKeyToAccount} from 'viem/accounts';
import {z} from 'zod';

export async function getChain(rpcUrl: string) {
	const rpc = createCurriedJSONRPC<Methods>(rpcUrl);
	const response = await rpc.call('eth_chainId')();
	if (!response.success) {
		throw new Error('Failed to get chain ID');
	}
	const chainIDAsHex = response.value;

	const chain = {
		id: Number(chainIDAsHex),
		name: 'Unknown',
		nativeCurrency: {
			decimals: 18,
			name: 'Ether',
			symbol: 'ETH',
		},
		rpcUrls: {
			default: {
				http: [rpcUrl],
			},
		},
	};
	return chain;
}

export function getClients(
	params: {chain: Chain; privateKey?: `0x${string}`},
	options?: {rpcURL?: string},
) {
	const {chain, privateKey} = params;
	const account = privateKey ? privateKeyToAccount(privateKey) : undefined;
	const transport = http(options?.rpcURL || chain.rpcUrls.default.http[0]);
	const walletClient = account
		? createWalletClient({
				account,
				chain,
				transport,
			})
		: undefined;
	const publicClient = createPublicClient({
		chain,
		transport,
	});

	return {walletClient, publicClient};
}

// Helper function to handle BigInt serialization in JSON.stringify
export function stringifyWithBigInt(obj: any, space?: number): string {
	return JSON.stringify(
		obj,
		(_key, value) => (typeof value === 'bigint' ? value.toString() : value),
		space,
	);
}

import type {PublicClient, WalletClient} from 'viem';
import type {McpServer} from '@modelcontextprotocol/sdk/server/mcp.js';
import type {ToolEnvironment, Tool} from './types.js';
import {CallToolResult} from '@modelcontextprotocol/sdk/types.js';

/**
 * Create a tool environment with optional sendStatus function
 */
export function createToolEnvironment(
	server: McpServer,
	publicClient: PublicClient,
	walletClient: WalletClient | undefined,
	withSendStatus: boolean,
	sessionId: string | undefined,
): ToolEnvironment {
	const env: ToolEnvironment = {
		publicClient,
		walletClient,
	};

	if (withSendStatus) {
		env.sendStatus = async (message: string) => {
			try {
				await server.sendLoggingMessage(
					{
						level: 'info',
						data: message,
					},
					sessionId,
				);
			} catch (error) {
				console.error('Error sending notification:', error);
			}
		};
	}

	return env;
}

/**
 * Convert ToolResult to CallToolResult format
 */
function convertToCallToolResult(result: {
	success: boolean;
	result?: Record<string, any>;
	error?: string;
	stack?: string;
}): CallToolResult {
	if (result.success === false) {
		return {
			content: [
				{
					type: 'text',
					text: JSON.stringify({
						error: result.error,
						...(result.stack ? {stack: result.stack} : {}),
					}),
				},
			],
			isError: true,
		};
	}

	return {
		content: [
			{
				type: 'text',
				text: JSON.stringify(
					result.result,
					(_key, value) => (typeof value === 'bigint' ? value.toString() : value),
					2,
				),
			},
		],
	};
}

/**
 * Register a tool with the MCP server
 */
export function registerTool<S extends z.ZodObject<any>>(
	{
		server,
		name,
		tool,
		withSendStatus = false,
	}: {
		server: McpServer;
		name: string;
		tool: Tool<S>;
		withSendStatus?: boolean;
	},
	publicClient: PublicClient,
	walletClient: WalletClient | undefined,
): void {
	server.registerTool(
		name,
		{
			description: tool.description,
			inputSchema: tool.schema as any,
		},
		(async (params: any, mcpExtra: any): Promise<CallToolResult> => {
			const env = createToolEnvironment(
				server,
				publicClient,
				walletClient,
				withSendStatus,
				mcpExtra.sessionId,
			);

			try {
				const result = await tool.execute(env, params as z.infer<S>);
				return convertToCallToolResult(result);
			} catch (error) {
				const errorResult = {
					success: false,
					error: error instanceof Error ? error.message : String(error),
					stack: error instanceof Error ? error.stack : undefined,
				};
				return convertToCallToolResult(errorResult);
			}
		}) as any,
	);
}
