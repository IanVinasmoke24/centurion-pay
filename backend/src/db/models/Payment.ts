import { v4 as uuidv4 } from 'uuid';
import db from '../../config/database';

export type PaymentStatus =
  | 'pending'
  | 'building'
  | 'submitted'
  | 'settled'
  | 'failed';

export interface Payment {
  id: string;
  qr_session_token: string | null;
  sender_address: string;
  merchant_address: string;
  send_asset: string;
  dest_asset: string;
  dest_amount: number;
  send_max: number;
  actual_send_amount: number | null;
  tx_hash: string | null;
  status: PaymentStatus;
  memo: string | null;
  path_json: string | null;
  error_message: string | null;
  ledger: number | null;
  created_at: string;
  updated_at: string;
}

export interface CreatePaymentInput {
  qr_session_token?: string;
  sender_address: string;
  merchant_address: string;
  send_asset: string;
  dest_asset: string;
  dest_amount: number;
  send_max: number;
  memo?: string;
  path_json?: string;
}

export async function createPayment(
  input: CreatePaymentInput
): Promise<Payment> {
  const id = uuidv4();
  const now = new Date().toISOString();

  const record: Omit<Payment, 'created_at' | 'updated_at'> & {
    created_at: string;
    updated_at: string;
  } = {
    id,
    qr_session_token: input.qr_session_token ?? null,
    sender_address: input.sender_address,
    merchant_address: input.merchant_address,
    send_asset: input.send_asset,
    dest_asset: input.dest_asset,
    dest_amount: input.dest_amount,
    send_max: input.send_max,
    actual_send_amount: null,
    tx_hash: null,
    status: 'pending',
    memo: input.memo ?? null,
    path_json: input.path_json ?? null,
    error_message: null,
    ledger: null,
    created_at: now,
    updated_at: now,
  };

  await db('payments').insert(record);
  return findById(id) as Promise<Payment>;
}

export async function findById(id: string): Promise<Payment | undefined> {
  return db('payments').where({ id }).first();
}

export async function updateStatus(
  id: string,
  status: PaymentStatus,
  extra?: Partial<Pick<Payment, 'tx_hash' | 'ledger' | 'actual_send_amount' | 'error_message'>>
): Promise<void> {
  await db('payments')
    .where({ id })
    .update({
      status,
      ...extra,
      updated_at: new Date().toISOString(),
    });
}

export async function findByMerchant(
  merchantAddress: string,
  limit = 50
): Promise<Payment[]> {
  return db('payments')
    .where({ merchant_address: merchantAddress })
    .orderBy('created_at', 'desc')
    .limit(limit);
}

export async function findByQRSession(
  qrSessionToken: string
): Promise<Payment | undefined> {
  return db('payments').where({ qr_session_token: qrSessionToken }).first();
}
