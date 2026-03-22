import {
  Asset,
  Keypair,
  Operation,
  TransactionBuilder,
  BASE_FEE,
} from '@stellar/stellar-sdk';
import { getHorizonServer, getNetworkPassphrase } from '../config/stellar';
import { NATIVE } from './assets';
import { logger } from '../utils/logger';

export interface BalanceMap {
  MXN: string;
  USD: string;
  GOLD: string;
  XLM: string;
  [key: string]: string;
}

export async function getAccount(address: string) {
  const server = getHorizonServer();
  try {
    const account = await server.loadAccount(address);
    return account;
  } catch (err: unknown) {
    const error = err as { response?: { status?: number } };
    if (error?.response?.status === 404) {
      throw new Error(`Account ${address} not found on ${process.env.STELLAR_NETWORK ?? 'testnet'}`);
    }
    throw err;
  }
}

export async function setupTrustlines(
  keypair: Keypair,
  assets: Asset[]
): Promise<string> {
  const server = getHorizonServer();
  const account = await server.loadAccount(keypair.publicKey());
  const networkPassphrase = getNetworkPassphrase();

  const txBuilder = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase,
  });

  for (const asset of assets) {
    if (asset.isNative()) continue;
    txBuilder.addOperation(
      Operation.changeTrust({
        asset,
        limit: '999999999',
      })
    );
  }

  const tx = txBuilder.setTimeout(30).build();
  tx.sign(keypair);

  const result = await server.submitTransaction(tx);
  logger.info('Trustlines setup successful', {
    account: keypair.publicKey(),
    hash: result.hash,
  });
  return result.hash;
}

export async function getBalances(address: string): Promise<BalanceMap> {
  const account = await getAccount(address);
  const balances: BalanceMap = {
    MXN: '0',
    USD: '0',
    GOLD: '0',
    XLM: '0',
  };

  for (const balance of account.balances) {
    if (balance.asset_type === 'native') {
      balances.XLM = balance.balance;
    } else if (
      balance.asset_type === 'credit_alphanum4' ||
      balance.asset_type === 'credit_alphanum12'
    ) {
      const code = balance.asset_code ?? '';
      balances[code] = balance.balance;
    }
  }

  return balances;
}

export async function fundTestnetAccount(address: string): Promise<void> {
  const FRIENDBOT_URL = `https://friendbot.stellar.org?addr=${address}`;
  const response = await fetch(FRIENDBOT_URL);
  if (!response.ok) {
    throw new Error(`Friendbot funding failed: ${response.statusText}`);
  }
  logger.info('Testnet account funded via Friendbot', { address });
}
