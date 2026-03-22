import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { getCurrentRate, getAllCachedRates } from '../services/RateService';
import { findPaymentPaths } from '../stellar/pathFinder';
import { getAsset, NATIVE } from '../stellar/assets';
import { Asset } from '@stellar/stellar-sdk';

const router = Router();

function resolveAsset(code: string): Asset {
  if (code === 'XLM') return NATIVE;
  return getAsset(code as 'MXN' | 'USD' | 'GOLD');
}

function assetToObj(asset: Asset): { code: string; issuer?: string } {
  return asset.isNative()
    ? { code: 'XLM' }
    : { code: asset.getCode(), issuer: asset.getIssuer() };
}

/**
 * GET /api/assets/rates
 * Returns cached exchange rates for all pairs.
 * Optionally query ?from=XLM&to=MXN&amount=100 for a live rate.
 */
router.get(
  '/rates',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { from, to, amount } = req.query as {
        from?: string;
        to?: string;
        amount?: string;
      };

      if (from && to) {
        const rate = await getCurrentRate(from, to, amount ?? '100');
        res.json({ success: true, data: rate });
        return;
      }

      const rates = getAllCachedRates();
      res.json({ success: true, data: rates });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * GET /api/assets/paths
 * Query available payment paths.
 * Required: ?sendAsset=XLM&destAsset=MXN&destAmount=100
 */
const PathsQuerySchema = z.object({
  sendAsset: z.string().min(1),
  destAsset: z.string().min(1),
  destAmount: z
    .string()
    .regex(/^\d+(\.\d+)?$/, 'destAmount must be a valid number'),
});

router.get(
  '/paths',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const query = PathsQuerySchema.parse(req.query);
      const sendAsset = resolveAsset(query.sendAsset);
      const destAsset = resolveAsset(query.destAsset);

      const paths = await findPaymentPaths(
        sendAsset,
        destAsset,
        query.destAmount
      );

      const formatted = paths.map((p) => ({
        sendAsset: assetToObj(p.sendAsset),
        sendMax: p.sendMax,
        sourceAmount: p.sourceAmount,
        destAsset: assetToObj(p.destAsset),
        destAmount: p.destAmount,
        path: p.path.map(assetToObj),
      }));

      res.json({ success: true, data: formatted });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
