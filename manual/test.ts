import {loadEnv} from 'ldenv';
import {type Chain, createWalletClient, http, SendTransactionParameters} from 'viem';
import {privateKeyToAccount, type Account} from 'viem/accounts';
import {getChain} from '../src/helpers.js';

loadEnv();

const account = privateKeyToAccount(process.env.PRIVATE_KEY as `0x${string}`);
const rpcURL = process.env.RPC_URL as string;

const chain = await getChain(rpcURL);
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
