import { Horizon } from '@stellar/stellar-sdk';
import { getHorizonServer } from '../config/stellar';
import { findByToken, markSettled } from '../db/models/QRSession';
import { updateStatus } from '../db/models/Payment';
import { notifyPaymentSettled, notifyMerchantPayment } from './NotificationService';
import { decodeMemo } from '../utils/stellarHelpers';
import { logger } from '../utils/logger';

type StreamClose = () => void;
const activeStreams = new Map<string, StreamClose>();

export interface LedgerPayment {
  txHash: string;
  amount: string;
  asset: string;
  sender: string;
  memo: string | null;
  ledger: number;
  createdAt: string;
}

export function startPaymentStream(merchantAddress: string): StreamClose {
  if (activeStreams.has(merchantAddress)) {
    logger.debug('Stream already active for merchant', { merchantAddress });
    return activeStreams.get(merchantAddress)!;
  }

  const server = getHorizonServer();

  logger.info('Starting payment stream for merchant', { merchantAddress });

  const closeStream = server
    .payments()
    .forAccount(merchantAddress)
    .cursor('now')
    .stream({
      onmessage: async (record) => {
        try {
          await handleIncomingPayment(record as Horizon.ServerApi.PaymentOperationRecord, merchantAddress);
        } catch (err) {
          logger.error('Error handling payment stream event', { err });
        }
      },
      onerror: (err) => {
        logger.error('Payment stream error', { merchantAddress, err });
        // Remove dead stream so it can be restarted
        activeStreams.delete(merchantAddress);
      },
    });

  activeStreams.set(merchantAddress, closeStream);
  return closeStream;
}

export function stopPaymentStream(merchantAddress: string): void {
  const close = activeStreams.get(merchantAddress);
  if (close) {
    close();
    activeStreams.delete(merchantAddress);
    logger.info('Payment stream stopped', { merchantAddress });
  }
}

export function stopAllStreams(): void {
  for (const [address, close] of activeStreams.entries()) {
    close();
    logger.info('Stream stopped', { address });
  }
  activeStreams.clear();
}

async function handleIncomingPayment(
  record: Horizon.ServerApi.PaymentOperationRecord,
  merchantAddress: string
): Promise<void> {
  if (record.type !== 'payment' && record.type !== 'path_payment_strict_receive') {
    return;
  }

  const txHash = record.transaction_hash;
  const amount = record.amount;
  const asset =
    record.asset_type === 'native'
      ? 'XLM'
      : `${record.asset_code}:${record.asset_issuer}`;

  logger.info('Incoming payment detected', {
    merchant: merchantAddress,
    txHash,
    asset,
    amount,
  });

  const payment = await verifyPayment(txHash);

  if (payment) {
    await matchPaymentToSession(payment);

    notifyMerchantPayment(merchantAddress, {
      txHash,
      amount,
      asset,
      sender: record.from,
      memo: payment.memo,
    });
  }
}

export async function verifyPayment(txHash: string): Promise<LedgerPayment | null> {
  const server = getHorizonServer();

  try {
    const tx = await server.transactions().transaction(txHash).call();
    const operations = await tx.operations();

    let paymentOp: Horizon.ServerApi.PaymentOperationRecord | null = null;

    for (const op of operations.records) {
      if (
        op.type === 'payment' ||
        op.type === 'path_payment_strict_receive' ||
        op.type === 'path_payment_strict_send'
      ) {
        paymentOp = op as Horizon.ServerApi.PaymentOperationRecord;
        break;
      }
    }

    if (!paymentOp) return null;

    const memoStr = tx.memo_type && tx.memo_type !== 'none' ? (tx.memo as string) : null;

    return {
      txHash,
      amount: paymentOp.amount,
      asset:
        paymentOp.asset_type === 'native'
          ? 'XLM'
          : `${paymentOp.asset_code}:${paymentOp.asset_issuer}`,
      sender: paymentOp.from,
      memo: memoStr,
      ledger: tx.ledger_attr,
      createdAt: tx.created_at,
    };
  } catch (err) {
    logger.error('Failed to verify payment', { txHash, err });
    return null;
  }
}

export async function matchPaymentToSession(
  payment: LedgerPayment
): Promise<void> {
  if (!payment.memo) {
    logger.debug('Payment has no memo, cannot match to session', {
      txHash: payment.txHash,
    });
    return;
  }

  // Memo should contain the payment ID (first 28 chars of UUID) or full token
  const session = await findByToken(payment.memo);

  if (!session) {
    logger.debug('No QR session found for memo', { memo: payment.memo });
    return;
  }

  if (session.status === 'settled') {
    logger.debug('Session already settled', { token: payment.memo });
    return;
  }

  await markSettled(session.token, payment.txHash);

  logger.info('QR session matched and settled', {
    token: session.token,
    txHash: payment.txHash,
    merchant: session.merchant_address,
  });

  notifyPaymentSettled(session.token, payment.txHash);
}
