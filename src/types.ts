import {PublicClient, WalletClient} from 'viem';

export type ClientsWithOptionalWallet = {
	walletClient?: WalletClient;
	publicClient: PublicClient;
};

/**
 * Configuration options for creating the ConquestEnv
 */
export interface EnvFactoryOptions {
	/** RPC URL for the Ethereum network */
	rpcUrl: string;
	/** Optional private key for sending transactions */
	privateKey?: `0x${string}`;
}

/**
 * Environment type for Conquest tools
 * Contains the managers needed for tool execution
 */
export type EthereumEnv = ClientsWithOptionalWallet & {
	options: EnvFactoryOptions;
};
