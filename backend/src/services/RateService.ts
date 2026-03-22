import { Asset } from '@stellar/stellar-sdk';
import { getHorizonServer } from '../config/stellar';
import { getAsset, NATIVE, AssetCode } from '../stellar/assets';
import { logger } from '../utils/logger';

export interface RateInfo {
  fromAsset: string;
  toAsset: string;
  rate: string;
  sourceAmount: string;
  destAmount: string;
  timestamp: number;
}

interface RateCacheKey {
  from: string;
  to: string;
}

const rateCache = new Map<string, RateInfo>();
let pollingInterval: NodeJS.Timeout | null = null;

const RATE_PAIRS: Array<[string, string]> = [
  ['XLM', 'MXN'],
  ['USD', 'MXN'],
  ['GOLD', 'MXN'],
  ['XLM', 'USD'],
];

const TEST_AMOUNT = '100';

function cacheKey(from: string, to: string): string {
  return `${from}:${to}`;
}

function resolveAsset(code: string): Asset {
  if (code === 'XLM') return NATIVE;
  try {
    return getAsset(code as AssetCode);
  } catch {
    return NATIVE;
  }
}

export async function getCurrentRate(
  fromAsset: string,
  toAsset: string,
  amount = TEST_AMOUNT
): Promise<RateInfo> {
  const server = getHorizonServer();
  const from = resolveAsset(fromAsset);
  const to = resolveAsset(toAsset);

  try {
    const paths = await server
      .strictReceivePaths(from, to, amount)
      .call();

    if (!paths.records.length) {
      throw new Error(`No path found for ${fromAsset} -> ${toAsset}`);
    }

    const best = paths.records.reduce((min, cur) =>
      parseFloat(cur.source_amount) < parseFloat(min.source_amount) ? cur : min
    );

    const sourceAmt = parseFloat(best.source_amount);
    const destAmt = parseFloat(amount);
    const rate = destAmt > 0 && sourceAmt > 0 ? (destAmt / sourceAmt).toFixed(7) : '0';

    const info: RateInfo = {
      fromAsset,
      toAsset,
      rate,
      sourceAmount: best.source_amount,
      destAmount: amount,
      timestamp: Date.now(),
    };

    rateCache.set(cacheKey(fromAsset, toAsset), info);
    return info;
  } catch (err) {
    logger.warn('Rate fetch failed', { fromAsset, toAsset, err });
    const cached = rateCache.get(cacheKey(fromAsset, toAsset));
    if (cached) return cached;
    throw err;
  }
}

export function getCachedRate(fromAsset: string, toAsset: string): RateInfo | null {
  return rateCache.get(cacheKey(fromAsset, toAsset)) ?? null;
}

export function getAllCachedRates(): RateInfo[] {
  return Array.from(rateCache.values());
}

export function startRatePolling(intervalMs = 30_000): void {
  if (pollingInterval) return;

  logger.info('Starting rate polling', { intervalMs, pairs: RATE_PAIRS });

  const fetchAll = async () => {
    for (const [from, to] of RATE_PAIRS) {
      try {
        await getCurrentRate(from, to, TEST_AMOUNT);
        logger.debug('Rate updated', { from, to });
      } catch (err) {
        logger.warn('Rate polling failed for pair', { from, to, err });
      }
    }
  };

  // Initial fetch
  fetchAll().catch((err) => logger.error('Initial rate fetch failed', { err }));

  pollingInterval = setInterval(() => {
    fetchAll().catch((err) => logger.error('Rate poll cycle failed', { err }));
  }, intervalMs);
}

export function stopRatePolling(): void {
  if (pollingInterval) {
    clearInterval(pollingInterval);
    pollingInterval = null;
    logger.info('Rate polling stopped');
  }
}
