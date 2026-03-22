import QRCode from 'qrcode';
import {
  createQRSession as dbCreateQRSession,
  findByToken,
  markScanned,
  markSettled,
  expireOld,
  QRSession,
} from '../db/models/QRSession';
import db from '../config/database';
import { signQRToken, verifyQRToken } from '../utils/crypto';
import { logger } from '../utils/logger';

const QR_TTL_SECONDS = 300; // 5 minutes
const BASE_URL = process.env.FRONTEND_URL ?? 'http://localhost:3000';

export interface QRSessionResult {
  sessionId: string;
  token: string;
  paymentUrl: string;
  qrImageBase64: string;
  amountMXN: number;
  merchantAddress: string;
  expiresAt: string;
}

export interface QRValidationResult {
  valid: boolean;
  token?: string;
  merchantAddress?: string;
  amountMXN?: number;
  reason?: string;
}

function buildPaymentUrl(token: string): string {
  return `${BASE_URL}/pay?token=${token}`;
}

function buildHMACPayload(token: string, merchantAddress: string, amountMXN: number): string {
  return `${token}:${merchantAddress}:${amountMXN}`;
}

export async function createQRSession(
  merchantAddress: string,
  amountMXN: number
): Promise<QRSessionResult> {
  // Expire stale sessions before creating a new one
  const expired = await expireOld();
  if (expired > 0) {
    logger.debug(`Expired ${expired} stale QR sessions`);
  }

  // Create DB session (token is UUID v4 from generateToken inside model)
  const tempSession = await dbCreateQRSession({
    merchant_address: merchantAddress,
    amount_mxn: amountMXN,
    ttl_seconds: QR_TTL_SECONDS,
  });

  const token = tempSession.token;
  const paymentUrl = buildPaymentUrl(token);

  // Generate HMAC signature appended to URL as query param
  const hmacPayload = buildHMACPayload(token, merchantAddress, amountMXN);
  const signature = signQRToken(hmacPayload);
  const signedPaymentUrl = `${paymentUrl}&sig=${signature}`;

  // Generate QR code as base64 PNG
  const qrImageBase64 = await QRCode.toDataURL(signedPaymentUrl, {
    errorCorrectionLevel: 'H',
    width: 400,
    margin: 2,
  });

  // Update session with URL and QR
  await db('qr_sessions').where({ token }).update({
    qr_image_base64: qrImageBase64,
    payment_url: signedPaymentUrl,
    updated_at: new Date().toISOString(),
  });

  logger.info('QR session created', {
    token,
    merchantAddress,
    amountMXN,
    expiresAt: tempSession.expires_at,
  });

  return {
    sessionId: tempSession.id,
    token,
    paymentUrl: signedPaymentUrl,
    qrImageBase64,
    amountMXN,
    merchantAddress,
    expiresAt: tempSession.expires_at,
  };
}

export function validateQRToken(
  token: string,
  merchantAddress: string,
  amountMXN: number,
  sig: string
): QRValidationResult {
  const hmacPayload = buildHMACPayload(token, merchantAddress, amountMXN);
  const isValid = verifyQRToken(hmacPayload, sig);

  if (!isValid) {
    return { valid: false, reason: 'Invalid signature' };
  }

  return {
    valid: true,
    token,
    merchantAddress,
    amountMXN,
  };
}

export async function getQRSessionStatus(token: string): Promise<QRSession | null> {
  const session = await findByToken(token);
  if (!session) return null;

  // Auto-expire if past expiry
  if (session.status === 'pending' && new Date(session.expires_at) < new Date()) {
    await db('qr_sessions').where({ token }).update({
      status: 'expired',
      updated_at: new Date().toISOString(),
    });
    return { ...session, status: 'expired' };
  }

  return session;
}

export async function scanQRSession(token: string): Promise<void> {
  await markScanned(token);
  logger.info('QR session scanned', { token });
}

export async function settleQRSession(
  token: string,
  txHash: string,
  paymentId?: string
): Promise<void> {
  await markSettled(token, txHash, paymentId);
  logger.info('QR session settled', { token, txHash });
}
