import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import {
  createQRSession,
  getQRSessionStatus,
  scanQRSession,
} from '../services/QRService';
import {
  getPaymentQuote,
  buildPayment,
  submitPayment,
} from '../services/PaymentService';
import { findById } from '../db/models/Payment';
import { optionalAuth } from '../middleware/auth';
import { isValidStellarAddress } from '../utils/stellarHelpers';

const router = Router();

// ── QR / NFC ──────────────────────────────────────────────────────────────────

const CreateSessionSchema = z.object({
  merchantAddress: z.string().refine(isValidStellarAddress, {
    message: 'Invalid Stellar address',
  }),
  amountMXN: z.number().positive('Amount must be positive'),
  ttlSeconds: z.number().int().min(60).max(3600).optional(),
});

/**
 * POST /api/payments/qr/create
 * Create a new QR payment session.
 */
router.post(
  '/qr/create',
  optionalAuth,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = CreateSessionSchema.parse(req.body);
      const session = await createQRSession(
        body.merchantAddress,
        body.amountMXN
      );
      res.status(201).json({ success: true, data: session });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * GET /api/payments/qr/:token
 * Get status of a QR payment session.
 */
router.get(
  '/qr/:token',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { token } = req.params;
      const session = await getQRSessionStatus(token);
      if (!session) {
        res.status(404).json({ error: 'Session not found', code: 'NOT_FOUND' });
        return;
      }
      res.json({ success: true, data: session });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * POST /api/payments/qr/:token/scan
 * Mark a QR session as scanned.
 */
router.post(
  '/qr/:token/scan',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { token } = req.params;
      await scanQRSession(token);
      res.json({ success: true, message: 'Session marked as scanned' });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * POST /api/payments/nfc/session
 * Create NFC payment session (identical to QR for now).
 */
router.post(
  '/nfc/session',
  optionalAuth,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = CreateSessionSchema.parse(req.body);
      const session = await createQRSession(
        body.merchantAddress,
        body.amountMXN
      );
      res.status(201).json({ success: true, data: session });
    } catch (err) {
      next(err);
    }
  }
);

// ── Quotes & Payment Building ─────────────────────────────────────────────────

const QuoteSchema = z.object({
  sendAsset: z.string().min(1),
  destAmount: z.string().regex(/^\d+(\.\d+)?$/, 'Invalid amount format'),
  merchantAddress: z.string().refine(isValidStellarAddress, {
    message: 'Invalid merchant address',
  }),
});

/**
 * POST /api/payments/quote
 * Get a path payment quote.
 */
router.post(
  '/quote',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = QuoteSchema.parse(req.body);
      const quote = await getPaymentQuote(
        body.sendAsset,
        body.destAmount,
        body.merchantAddress
      );
      res.json({ success: true, data: quote });
    } catch (err) {
      next(err);
    }
  }
);

const BuildSchema = z.object({
  quote: z.object({
    paymentId: z.string(),
    sendAsset: z.string(),
    destAsset: z.string(),
    destAmount: z.string(),
    sendMax: z.string(),
    sourceAmount: z.string(),
    path: z.array(z.string()),
    slippagePct: z.number(),
    expiresAt: z.string(),
  }),
  senderAddress: z.string().refine(isValidStellarAddress, {
    message: 'Invalid sender address',
  }),
  memo: z.string().max(28).optional(),
});

/**
 * POST /api/payments/build
 * Build an unsigned payment transaction XDR.
 */
router.post(
  '/build',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = BuildSchema.parse(req.body);
      const result = await buildPayment(
        body.quote,
        body.senderAddress,
        body.memo
      );
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }
);

const SubmitSchema = z.object({
  signedXDR: z.string().min(1, 'signedXDR is required'),
  paymentId: z.string().min(1, 'paymentId is required'),
});

/**
 * POST /api/payments/submit
 * Submit a signed payment transaction.
 */
router.post(
  '/submit',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = SubmitSchema.parse(req.body);
      const result = await submitPayment(body.signedXDR, body.paymentId);
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * GET /api/payments/:id
 * Get payment status by ID.
 */
router.get(
  '/:id',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const payment = await findById(id);
      if (!payment) {
        res.status(404).json({ error: 'Payment not found', code: 'NOT_FOUND' });
        return;
      }
      res.json({ success: true, data: payment });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
