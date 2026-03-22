export interface QRPayload {
  version: '1'
  token: string
  merchant: string
  amount: string
  asset: 'MXN'
  expires: number
  sig: string
}

export interface NFCPayload {
  token: string
  merchant: string
  amount: string
}

export interface PathQuote {
  sendAsset: string
  sendMax: string
  destAsset: string
  destAmount: string
  path: string[]
  rate: string
  fee: string
  expiresAt: number
}

export interface Payment {
  id: string
  status: 'PENDING' | 'SUBMITTED' | 'SETTLED' | 'FAILED'
  sendAsset: string
  destAsset: string
  sendAmount: string
  destAmount: string
  senderAddr: string
  merchantAddr: string
  stellarTxHash?: string
  createdAt: string
  settledAt?: string
}

export interface QRSession {
  id: string
  token: string
  merchantAddr: string
  amountMxn: string
  status: 'PENDING' | 'SCANNED' | 'SETTLED' | 'EXPIRED'
  qrImageBase64?: string
  expiresAt: string
}

export interface RateUpdate {
  asset: string
  rateMxn: string
  change24h: string
  updatedAt: string
}

export type PaymentStatus =
  | 'idle'
  | 'quoting'
  | 'building'
  | 'signing'
  | 'submitting'
  | 'settled'
  | 'failed'
