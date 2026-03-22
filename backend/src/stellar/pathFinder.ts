import { Asset } from '@stellar/stellar-sdk';
import { getHorizonServer } from '../config/stellar';
import { config } from '../config/env';
import { logger } from '../utils/logger';

export interface PathOption {
  sendAsset: Asset;
  sendMax: string;
  destAsset: Asset;
  destAmount: string;
  path: Asset[];
  sourceAmount: string;
}

export async function findPaymentPaths(
  sendAsset: Asset,
  destAsset: Asset,
  destAmount: string
): Promise<PathOption[]> {
  const server = getHorizonServer();

  try {
    const pathsResponse = await server
      .strictReceivePaths([sendAsset], destAsset, destAmount)
      .call();

    const paths: PathOption[] = pathsResponse.records.map((record) => {
      const pathAssets: Asset[] = (record.path ?? []).map((p: { asset_type: string; asset_code?: string; asset_issuer?: string }) => {
        if (p.asset_type === 'native') return Asset.native();
        return new Asset(p.asset_code!, p.asset_issuer!);
      });

      return {
        sendAsset,
        sendMax: applySlippage(record.source_amount, config.SLIPPAGE_TOLERANCE_PCT),
        destAsset,
        destAmount,
        path: pathAssets,
        sourceAmount: record.source_amount,
      };
    });

    logger.debug('Found payment paths', {
      sendAsset: sendAsset.getCode(),
      destAsset: destAsset.getCode(),
      destAmount,
      pathCount: paths.length,
    });

    return paths;
  } catch (err) {
    logger.error('Failed to find payment paths', { err });
    throw new Error('Could not find payment paths for this asset pair');
  }
}

export function getBestPath(paths: PathOption[]): PathOption {
  if (paths.length === 0) {
    throw new Error('No payment paths available');
  }

  return paths.reduce((best, current) => {
    const bestAmount = parseFloat(best.sourceAmount);
    const currentAmount = parseFloat(current.sourceAmount);
    return currentAmount < bestAmount ? current : best;
  });
}

export function applySlippage(amount: string, pct: number): string {
  const parsed = parseFloat(amount);
  if (isNaN(parsed)) {
    throw new Error(`Invalid amount: ${amount}`);
  }
  const slippageMultiplier = 1 + pct / 100;
  const withSlippage = parsed * slippageMultiplier;
  return withSlippage.toFixed(7);
}
