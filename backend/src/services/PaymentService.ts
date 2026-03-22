import { Asset } from '@stellar/stellar-sdk';
import { findPaymentPaths, getBestPath } from '../stellar/pathFinder';
import {
  buildPathPaymentTransaction,
  submitTransaction,
} from '../stellar/pathPayment';
import { getAsset, NATIVE, AssetCode } from '../stellar/assets';
import {
  createPayment,
  findById,
  updateStatus,
} from '../db/models/Payment';
import db from '../config/database';
import { config } from '../config/env';
import { logger } from '../utils/logger';

export interface PaymentQuote {
  paymentId: string;
  sendAsset: string;
  destAsset: string;
  destAmount: string;
  sendMax: string;
  sourceAmount: string;
  path: string[];
  slippagePct: number;
  expiresAt: string;
}

export interface BuildPaymentResult {
  paymentId: string;
  xdr: string;
  networkPassphrase: string;
  fee: string;
}

function resolveAsset(code: string): Asset {
  if (code === 'XLM') return NATIVE;
  return getAsset(code as AssetCode);
}

function assetToString(asset: Asset): string {
  return asset.isNative() ? 'XLM' : `${asset.getCode()}:${asset.getIssuer()}`;
}

export async function getPaymentQuote(
  sendAssetCode: string,
  destAmount: string,
  merchantAddress: string
): Promise<PaymentQuote> {
  const destAsset = resolveAsset('MXN'); // Merchants always receive MXN
  const sendAsset = resolveAsset(sendAssetCode);

  const paths = await findPaymentPaths(sendAsset, destAsset, destAmount);
  const best = getBestPath(paths);

  // Create a pending payment record
  const payment = await createPayment({
    sender_address: 'PENDING', // will be set at build time
    merchant_address: merchantAddress,
    send_asset: sendAssetCode,
    dest_asset: 'MXN',
    dest_amount: parseFloat(destAmount),
    send_max: parseFloat(best.sendMax),
    path_json: JSON.stringify(best.path.map(assetToString)),
  });

  const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString(); // 5 minutes

  logger.info('Payment quote generated', {
    paymentId: payment.id,
    sendAsset: sendAssetCode,
    destAmount,
    sendMax: best.sendMax,
  });

  return {
    paymentId: payment.id,
    sendAsset: sendAssetCode,
    destAsset: 'MXN',
    destAmount,
    sendMax: best.sendMax,
    sourceAmount: best.sourceAmount,
    path: best.path.map(assetToString),
    slippagePct: config.SLIPPAGE_TOLERANCE_PCT,
    expiresAt,
  };
}

export async function buildPayment(
  quote: PaymentQuote,
  senderAddress: string,
  memo?: string
): Promise<BuildPaymentResult> {
  const payment = await findById(quote.paymentId);
  if (!payment) {
    throw new Error(`Payment ${quote.paymentId} not found`);
  }

  await updateStatus(quote.paymentId, 'building');

  const sendAsset = resolveAsset(quote.sendAsset);
  const destAsset = resolveAsset(quote.destAsset);
  const pathAssets: Asset[] = (JSON.parse(payment.path_json ?? '[]') as string[]).map(
    resolveAsset
  );

  const result = await buildPathPaymentTransaction({
    senderAddress,
    merchantAddress: payment.merchant_address,
    sendAsset,
    sendMax: quote.sendMax,
    destAsset,
    destAmount: quote.destAmount,
    path: pathAssets,
    memo: memo ?? quote.paymentId.substring(0, 28),
  });

  // Update sender address in the payment record
  await db('payments')
    .where({ id: quote.paymentId })
    .update({ sender_address: senderAddress, updated_at: new Date().toISOString() });

  logger.info('Payment XDR built', {
    paymentId: quote.paymentId,
    sender: senderAddress,
  });

  return {
    paymentId: quote.paymentId,
    xdr: result.xdr,
    networkPassphrase: result.networkPassphrase,
    fee: result.fee,
  };
}

export async function submitPayment(
  signedXDR: string,
  paymentId: string
): Promise<{ txHash: string; ledger: number }> {
  const payment = await findById(paymentId);
  if (!payment) {
    throw new Error(`Payment ${paymentId} not found`);
  }

  await updateStatus(paymentId, 'submitted');

  try {
    const result = await submitTransaction(signedXDR);

    await updateStatus(paymentId, 'settled', {
      tx_hash: result.hash,
      ledger: result.ledger,
    });

    logger.info('Payment submitted and settled', {
      paymentId,
      txHash: result.hash,
      ledger: result.ledger,
    });

    return { txHash: result.hash, ledger: result.ledger };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await updateStatus(paymentId, 'failed', { error_message: message });
    throw err;
  }
}
