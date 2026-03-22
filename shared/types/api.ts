// ============================================================
// Proyecto Centurion – API Request / Response DTOs
// These types are shared between the backend (Express) and
// the frontend (React + Vite) so both sides stay in sync.
// ============================================================

// ---------------------------------------------------------------------------
// POST /api/qr/session
// ---------------------------------------------------------------------------

/** Merchant requests a new QR payment session. */
export interface CreateQRSessionRequest {
  /** G… public key of the merchant's Stellar account. */
  merchantAddress: string

  /**
   * Amount (in MXN) the merchant expects to receive.
   * Decimal string, max 7 decimal places (Stellar precision).
   * Example: "250.50"
   */
  amountMxn: string
}

/** Server responds with the session details + pre-rendered QR image. */
export interface CreateQRSessionResponse {
  /** UUID v4 – use to poll session status. */
  sessionId: string

  /**
   * Random URL-safe token embedded in the QR URL.
   * Example QR URL: https://pay.centurion.mx/scan?token=<token>
   */
  token: string

  /** Full URL encoded in the QR code. */
  qrUrl: string

  /** PNG image of the QR code, base64-encoded (data URI ready). */
  qrImageBase64: string

  /** ISO-8601 UTC string – session expires at this time (default: +5 min). */
  expiresAt: string
}

// ---------------------------------------------------------------------------
// GET /api/qr/session/:token
// ---------------------------------------------------------------------------

/** Response to polling a QR session by token (used by customer wallet). */
export interface GetQRSessionResponse {
  sessionId: string
  merchantAddress: string
  amountMxn: string
  status: 'PENDING' | 'SCANNED' | 'SETTLED' | 'EXPIRED'
  expiresAt: string
  paymentId?: string
}

// ---------------------------------------------------------------------------
// POST /api/payment/quote
// ---------------------------------------------------------------------------

/**
 * Customer wallet requests a path-payment quote.
 * The backend calls Horizon strict-receive path-find and caches the result.
 */
export interface GetQuoteRequest {
  /** Asset the customer wants to spend. */
  sendAsset: 'USD' | 'GOLD'

  /**
   * Exact amount of MXN the merchant must receive.
   * Decimal string.
   */
  destAmount: string

  /** G… public key of the merchant (destination). */
  merchantAddress: string
}

/** Quote result.  Valid for ~30 seconds (configurable via QUOTE_TTL_SECONDS). */
export interface GetQuoteResponse {
  /** Opaque UUID – pass back to /payment/build to lock the quote. */
  quoteId: string

  /** Asset the sender will spend (same as request.sendAsset). */
  sendAsset: string

  /**
   * Maximum units of sendAsset the sender will be debited.
   * Includes a 1 % slippage buffer on top of Horizon's path-find sendMax.
   */
  sendMax: string

  /** Always "MXN" in the current design. */
  destAsset: string

  /** Exact MXN amount the merchant receives (= request.destAmount). */
  destAmount: string

  /**
   * Ordered array of intermediate asset codes.
   * Empty array means a direct (no-hop) payment.
   * Example: ["XLM"] means USD → XLM → MXN.
   */
  path: string[]

  /** Human-readable rate, e.g. "17.2340 MXN/USD". */
  rate: string

  /** ISO-8601 UTC – quote expires after this time. */
  expiresAt: string
}

// ---------------------------------------------------------------------------
// POST /api/payment/build
// ---------------------------------------------------------------------------

/**
 * Customer provides their public key; backend builds (but does NOT sign)
 * the Stellar transaction and returns the XDR for the wallet to sign.
 */
export interface BuildPaymentRequest {
  /** Quote UUID obtained from /payment/quote. */
  quoteId: string

  /** G… public key of the customer's Stellar account (sequence # source). */
  senderAddress: string
}

export interface BuildPaymentResponse {
  /** UUID v4 – persisted payment record. */
  paymentId: string

  /**
   * Base64-encoded Stellar Transaction Envelope XDR.
   * The wallet must sign this with the sender's secret key and return it
   * to /payment/submit.
   */
  unsignedXdr: string

  /**
   * Network fee in stroops (as a string to preserve precision).
   * Informational – already included in the XDR.
   */
  fee: string
}

// ---------------------------------------------------------------------------
// POST /api/payment/submit
// ---------------------------------------------------------------------------

/** Wallet signs the XDR and posts it back for broadcasting. */
export interface SubmitPaymentRequest {
  /**
   * Base64-encoded Stellar Transaction Envelope XDR with at least one
   * valid signature (the sender's).
   */
  signedXdr: string

  /** Payment UUID from /payment/build – used to link the Horizon result. */
  paymentId: string
}

export interface SubmitPaymentResponse {
  /** Same UUID from the request. */
  paymentId: string

  /** 64-character hex Stellar transaction hash. */
  txHash: string

  /** Final payment status: "SUBMITTED" immediately, "SETTLED" after ledger close. */
  status: string
}

// ---------------------------------------------------------------------------
// GET /api/payment/:paymentId
// ---------------------------------------------------------------------------

/** Full payment detail used by receipt screens. */
export interface GetPaymentResponse {
  paymentId: string
  status: string
  sendAsset: string
  destAsset: string
  sendAmount: string
  destAmount: string
  senderAddr: string
  merchantAddr: string
  stellarTxHash?: string
  pathUsed: string[]
  createdAt: string
  settledAt?: string
  stellarExpertUrl?: string
}

// ---------------------------------------------------------------------------
// GET /api/account/:address
// ---------------------------------------------------------------------------

/** Wallet dashboard fetches this to show the user's balances. */
export interface AccountInfoResponse {
  /** G… public key. */
  address: string

  balances: {
    /** Decimal string, "0.0000000" if no trustline or zero balance. */
    MXN: string
    USD: string
    GOLD: string
    /** Native XLM – always present. */
    XLM: string
  }

  /** Whether the account has a trustline for each custom asset. */
  trustlines: {
    MXN: boolean
    USD: boolean
    GOLD: boolean
  }
}

// ---------------------------------------------------------------------------
// GET /api/rates
// ---------------------------------------------------------------------------

/** Live exchange rates used to display previews before quoting. */
export interface RatesResponse {
  /** MXN per 1 USD, decimal string. */
  USD_MXN: string

  /** MXN per 1 GOLD token, decimal string. */
  GOLD_MXN: string

  /** ISO-8601 UTC – when these rates were last refreshed. */
  updatedAt: string
}

// ---------------------------------------------------------------------------
// Generic API error envelope
// ---------------------------------------------------------------------------

/**
 * All error responses from the Centurion API have this shape.
 * HTTP status code is in the response header; `code` is a machine-readable
 * string for the frontend to handle specific cases.
 */
export interface ApiError {
  /** Machine-readable error code, e.g. "QUOTE_EXPIRED", "INVALID_ADDRESS". */
  code: string

  /** Human-readable message (English). */
  message: string

  /** Optional additional context (validation errors, etc.). */
  details?: unknown
}

/** Wrapper used for all successful list endpoints. */
export interface PaginatedResponse<T> {
  data: T[]
  total: number
  page: number
  pageSize: number
}
