import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import { config } from '../config/env';

export function signQRToken(data: string): string {
  return crypto
    .createHmac('sha256', config.QR_HMAC_SECRET)
    .update(data)
    .digest('hex');
}

export function verifyQRToken(data: string, sig: string): boolean {
  const expected = signQRToken(data);
  try {
    return crypto.timingSafeEqual(
      Buffer.from(expected, 'hex'),
      Buffer.from(sig, 'hex')
    );
  } catch {
    return false;
  }
}

export function generateToken(): string {
  return uuidv4();
}

export function generateSecureRandom(bytes = 32): string {
  return crypto.randomBytes(bytes).toString('hex');
}

export function hashData(data: string): string {
  return crypto.createHash('sha256').update(data).digest('hex');
}
