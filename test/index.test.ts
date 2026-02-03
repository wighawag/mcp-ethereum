import {describe, it, expect} from 'vitest';
import {createServer} from '../src/index.js';
import {McpServer} from '@modelcontextprotocol/sdk/server/mcp.js';

describe('MCP Server', () => {
	it('should create server instance', () => {
		const server = createServer();
		expect(server).toBeInstanceOf(McpServer);
	});
});
