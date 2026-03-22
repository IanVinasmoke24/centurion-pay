import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { getBalances } from '../stellar/accounts';
import { setupTrustlines } from '../stellar/accounts';
import { Keypair } from '@stellar/stellar-sdk';
import { getAsset } from '../stellar/assets';
import { upsert, findByAddress } from '../db/models/Account';
import { isValidStellarAddress } from '../utils/stellarHelpers';

const router = Router();

/**
 * GET /api/accounts/:address
 * Get account info and balances from Horizon + local DB metadata.
 */
router.get(
  '/:address',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { address } = req.params;

      if (!isValidStellarAddress(address)) {
        res
          .status(400)
          .json({ error: 'Invalid Stellar address', code: 'INVALID_ADDRESS' });
        return;
      }

      const [balances, dbAccount] = await Promise.allSettled([
        getBalances(address),
        findByAddress(address),
      ]);

      const balancesData =
        balances.status === 'fulfilled' ? balances.value : null;
      const accountData =
        dbAccount.status === 'fulfilled' ? dbAccount.value : null;

      if (!balancesData) {
        res.status(404).json({
          error: 'Account not found on the Stellar network',
          code: 'ACCOUNT_NOT_FOUND',
        });
        return;
      }

      res.json({
        success: true,
        data: {
          address,
          balances: balancesData,
          metadata: accountData ?? null,
        },
      });
    } catch (err) {
      next(err);
    }
  }
);

const SetupTrustlinesSchema = z.object({
  secretKey: z.string().min(56, 'secretKey must be a valid Stellar secret key'),
  assets: z
    .array(z.enum(['MXN', 'USD', 'GOLD']))
    .min(1, 'At least one asset required'),
  label: z.string().optional(),
  role: z.enum(['user', 'merchant', 'issuer', 'distributor']).optional(),
});

/**
 * POST /api/accounts/setup
 * Setup trustlines for a new account.
 * NOTE: In production, the client should sign locally. This is for testnet convenience.
 */
router.post(
  '/setup',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = SetupTrustlinesSchema.parse(req.body);
      let keypair: Keypair;

      try {
        keypair = Keypair.fromSecret(body.secretKey);
      } catch {
        res
          .status(400)
          .json({ error: 'Invalid secret key', code: 'INVALID_SECRET_KEY' });
        return;
      }

      const assets = body.assets.map((code) => getAsset(code));
      const txHash = await setupTrustlines(keypair, assets);

      // Record trustlines in DB
      const trustlineUpdates: {
        has_mxn_trustline?: boolean;
        has_usd_trustline?: boolean;
        has_gold_trustline?: boolean;
      } = {};

      if (body.assets.includes('MXN')) trustlineUpdates.has_mxn_trustline = true;
      if (body.assets.includes('USD')) trustlineUpdates.has_usd_trustline = true;
      if (body.assets.includes('GOLD')) trustlineUpdates.has_gold_trustline = true;

      await upsert({
        address: keypair.publicKey(),
        label: body.label,
        role: body.role,
        ...trustlineUpdates,
      });

      res.json({
        success: true,
        data: {
          address: keypair.publicKey(),
          txHash,
          trustlines: body.assets,
        },
      });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
