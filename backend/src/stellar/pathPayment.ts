import {
  Asset,
  Memo,
  Operation,
  TransactionBuilder,
  BASE_FEE,
} from '@stellar/stellar-sdk';
import { getHorizonServer, getNetworkPassphrase } from '../config/stellar';
import { getAccount } from './accounts';
import { logger } from '../utils/logger';

export interface PathPaymentParams {
  senderAddress: string;
  merchantAddress: string;
  sendAsset: Asset;
  sendMax: string;
  destAsset: Asset;
  destAmount: string;
  path: Asset[];
  memo?: string;
}

export interface PathPaymentResult {
  xdr: string;
  fee: string;
  networkPassphrase: string;
}

export async function buildPathPaymentTransaction(
  params: PathPaymentParams
): Promise<PathPaymentResult> {
  const {
    senderAddress,
    merchantAddress,
    sendAsset,
    sendMax,
    destAsset,
    destAmount,
    path,
    memo,
  } = params;

  const account = await getAccount(senderAddress);
  const networkPassphrase = getNetworkPassphrase();

  const txBuilder = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase,
  });

  txBuilder.addOperation(
    Operation.pathPaymentStrictReceive({
      sendAsset,
      sendMax,
      destination: merchantAddress,
      destAsset,
      destAmount,
      path,
    })
  );

  if (memo) {
    if (memo.length <= 28) {
      txBuilder.addMemo(Memo.text(memo));
    } else {
      txBuilder.addMemo(Memo.hash(Buffer.from(memo, 'hex')));
    }
  }

  const tx = txBuilder.setTimeout(120).build();
  const xdr = tx.toXDR();

  logger.info('Built path payment transaction', {
    sender: senderAddress,
    merchant: merchantAddress,
    sendAsset: sendAsset.getCode(),
    destAsset: destAsset.getCode(),
    destAmount,
    sendMax,
  });

  return {
    xdr,
    fee: BASE_FEE,
    networkPassphrase,
  };
}

export async function submitTransaction(signedXDR: string): Promise<{
  hash: string;
  ledger: number;
  successful: boolean;
}> {
  const server = getHorizonServer();
  const { TransactionBuilder } = await import('@stellar/stellar-sdk');
  const networkPassphrase = getNetworkPassphrase();

  const tx = TransactionBuilder.fromXDR(signedXDR, networkPassphrase);

  try {
    const result = await server.submitTransaction(tx);

    logger.info('Transaction submitted successfully', {
      hash: result.hash,
      ledger: result.ledger,
    });

    return {
      hash: result.hash,
      ledger: result.ledger,
      successful: result.successful,
    };
  } catch (err: unknown) {
    const error = err as {
      response?: {
        data?: {
          extras?: {
            result_codes?: unknown;
          };
        };
      };
      message?: string;
    };

    logger.error('Transaction submission failed', {
      err: error.response?.data?.extras?.result_codes ?? error.message,
    });

    const codes = error.response?.data?.extras?.result_codes;
    throw new Error(
      `Transaction failed: ${JSON.stringify(codes) ?? error.message}`
    );
  }
}
