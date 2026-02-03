import {describe, it, expect} from 'vitest';
import {createServer} from '../src/index.js';
import {McpServer} from '@modelcontextprotocol/sdk/server/mcp.js';

describe('MCP Server', () => {
	it('should create server instance', () => {
		const server = createServer({
			chain: {
				id: 1,
				name: 'Ethereum',
				nativeCurrency: {
					decimals: 18,
					name: 'Ether',
					symbol: 'ETH',
				},
				rpcUrls: {
					default: {
						http: [''],
					},
				},
			},
			privateKey: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
		});
		expect(server).toBeInstanceOf(McpServer);
	});
});
