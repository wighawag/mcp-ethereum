import {describe, it, expect, beforeAll, afterAll} from 'vitest';
import {McpServer} from '@modelcontextprotocol/sdk/server/mcp.js';
import {setupTestEnvironmentForMPCServer, teardownTestEnvironment} from '../setup.js';

describe('Server Creation', () => {
	let server: McpServer;

	beforeAll(async () => {
		const context = await setupTestEnvironmentForMPCServer();
		server = context.server;
	}, 30000);

	afterAll(async () => {
		await teardownTestEnvironment();
	});

	it('should create server instance', () => {
		expect(server).toBeInstanceOf(McpServer);
	});
});
