import {StdioServerTransport} from '@modelcontextprotocol/sdk/server/stdio.js';
import {createServer} from './index.js';

const transport = new StdioServerTransport();
const server = createServer(process.env.RPC_URL!);
await server.connect(transport);
