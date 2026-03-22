import { v4 as uuidv4 } from 'uuid';
import db from '../../config/database';
import { generateToken } from '../../utils/crypto';

export type QRStatus = 'pending' | 'scanned' | 'settled' | 'expired';

export interface QRSession {
  id: string;
  token: string;
  merchant_address: string;
  amount_mxn: number;
  status: QRStatus;
  payment_id: string | null;
  tx_hash: string | null;
  expires_at: string;
  scanned_at: string | null;
  settled_at: string | null;
  qr_image_base64: string | null;
  payment_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateQRSessionInput {
  merchant_address: string;
  amount_mxn: number;
  ttl_seconds?: number;
  qr_image_base64?: string;
  payment_url?: string;
}

export async function createQRSession(
  input: CreateQRSessionInput
): Promise<QRSession> {
  const id = uuidv4();
  const token = generateToken();
  const now = new Date();
  const ttl = input.ttl_seconds ?? 300; // 5 minutes default
  const expiresAt = new Date(now.getTime() + ttl * 1000);

  const record = {
    id,
    token,
    merchant_address: input.merchant_address,
    amount_mxn: input.amount_mxn,
    status: 'pending' as QRStatus,
    payment_id: null,
    tx_hash: null,
    expires_at: expiresAt.toISOString(),
    scanned_at: null,
    settled_at: null,
    qr_image_base64: input.qr_image_base64 ?? null,
    payment_url: input.payment_url ?? null,
    created_at: now.toISOString(),
    updated_at: now.toISOString(),
  };

  await db('qr_sessions').insert(record);
  return findByToken(token) as Promise<QRSession>;
}

export async function findByToken(
  token: string
): Promise<QRSession | undefined> {
  return db('qr_sessions').where({ token }).first();
}

export async function findById(id: string): Promise<QRSession | undefined> {
  return db('qr_sessions').where({ id }).first();
}

export async function markScanned(token: string): Promise<void> {
  await db('qr_sessions').where({ token }).update({
    status: 'scanned',
    scanned_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });
}

export async function markSettled(
  token: string,
  txHash: string,
  paymentId?: string
): Promise<void> {
  await db('qr_sessions').where({ token }).update({
    status: 'settled',
    tx_hash: txHash,
    payment_id: paymentId ?? null,
    settled_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });
}

export async function expireOld(): Promise<number> {
  const now = new Date().toISOString();
  const count = await db('qr_sessions')
    .where('status', 'pending')
    .where('expires_at', '<', now)
    .update({
      status: 'expired',
      updated_at: now,
    });
  return count;
}

export async function findByMerchant(
  merchantAddress: string,
  limit = 50
): Promise<QRSession[]> {
  return db('qr_sessions')
    .where({ merchant_address: merchantAddress })
    .orderBy('created_at', 'desc')
    .limit(limit);
}
