import {getChain, getClients} from './helpers.js';
import {ClientsWithOptionalWallet, EnvFactoryOptions, EthereumEnv} from './types.js';

export {createServer as createEthereumMPCServer} from './mcp.js';

/**
 * Factory function to create the ConquestEnv
 * This is shared between CLI and MCP server
 *
 * @param options - Configuration options for creating the environment
 * @returns ConquestEnv with fleetManager and planetManager
 */
export async function createEthereumEnv(options: EnvFactoryOptions): Promise<EthereumEnv> {
	const {rpcUrl, privateKey} = options;

	const chain = await getChain(rpcUrl);
	const clients = getClients({
		chain,
		privateKey,
	}) as ClientsWithOptionalWallet;

	return {
		walletClient: clients.walletClient,
		publicClient: clients.publicClient,
		options,
	};
}
