import {StdioServerTransport} from '@modelcontextprotocol/sdk/server/stdio.js';
import {createServer} from './index.js';

const transport = new StdioServerTransport();
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
await server.connect(transport);
