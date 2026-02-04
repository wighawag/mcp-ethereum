import {describe, it, expect} from 'vitest';
import {createServer} from '../src/index.js';
import {McpServer} from '@modelcontextprotocol/sdk/server/mcp.js';
import {getChain} from '../src/helpers.js';
import {InMemoryTransport} from '@modelcontextprotocol/sdk/inMemory.js';
import {Client} from '@modelcontextprotocol/sdk/client';
import {callToolWithTextResponse} from './utils/index.js';

const chain = await getChain('https://eth.llamarpc.com');

describe('MCP Server', () => {
	it('should create server instance', async () => {
		const server = createServer({
			chain,
			privateKey: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
		});
		// Connect using an in-memory transport
		const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
		const client = new Client({name: 'test-client', version: '1.0.0'}, {});
		await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);

		// Test with a real tool
		const result = await callToolWithTextResponse(client, {
			name: 'get_block_number',
			arguments: {},
		});

		expect(result.content[0].type).toBe('text');
		const data = JSON.parse(result.content[0].text);
		expect(data.blockNumber).toBeDefined();
	});
});
