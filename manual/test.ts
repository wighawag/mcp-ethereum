import {loadEnv} from 'ldenv';
import {Methods} from 'eip-1193';
import {createCurriedJSONRPC} from 'remote-procedure-call';
import {
	type Chain,
	createPublicClient,
	createWalletClient,
	http,
	SendTransactionParameters,
} from 'viem';
import {privateKeyToAccount, type Account} from 'viem/accounts';

loadEnv();

const account = privateKeyToAccount(process.env.PRIVATE_KEY as `0x${string}`);
const rpcURL = process.env.RPC_URL as string;

const rpc = createCurriedJSONRPC<Methods>(rpcURL);
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
			http: [rpcURL],
		},
	},
};

const transport = http(rpcURL);
const walletClient = createWalletClient({
	account,
	chain,
	transport,
});

const to = '';
const value = '1';

const txParams: SendTransactionParameters<Chain, Account> = {
	to: to as `0x${string}`,
};

if (value) {
	txParams.value = BigInt(value);
}

const hash = await walletClient.sendTransaction(txParams);
console.log('Transaction hash:', hash);
