#!/usr/bin/env node
import {StdioServerTransport} from '@modelcontextprotocol/sdk/server/stdio.js';
import {createServer} from './index.js';
import {Command} from 'commander';
import {createCurriedJSONRPC} from 'remote-procedure-call';
import {Methods} from 'eip-1193';
import pkg from '../package.json' with {type: 'json'};

const program = new Command();

program
	.name(pkg.name)
	.description(pkg.description)
	.version(pkg.version)
	.option('--rpc-url <url>', 'RPC URL for the Ethereum network', '')
	.parse(process.argv);

const options = program.opts();

const privateKey = process.env.PRIVATE_KEY;
if (!privateKey) {
	console.warn('Warning: PRIVATE_KEY environment variable is required for sending transactions');
} else if (!privateKey.startsWith('0x')) {
	console.error('Error: PRIVATE_KEY must start with 0x');
	process.exit(1);
}

if (!options.rpcUrl) {
	console.error('Error: --rpc-url option is required');
	process.exit(1);
}

const transport = new StdioServerTransport();

const rpc = createCurriedJSONRPC<Methods>(options.rpcUrl);
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
			http: [options.rpcUrl],
		},
	},
};
const server = createServer({
	chain,
	privateKey: privateKey as `0x${string}`,
});
await server.connect(transport);
