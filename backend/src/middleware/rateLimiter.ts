import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const store = new Map<string, RateLimitEntry>();

const WINDOW_MS = 60_000; // 1 minute
const MAX_REQUESTS = 100;

// Clean up expired entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of store.entries()) {
    if (entry.resetAt < now) {
      store.delete(key);
    }
  }
}, 5 * 60_000);

function getClientIP(req: Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') {
    return forwarded.split(',')[0].trim();
  }
  return req.socket.remoteAddress ?? 'unknown';
}

export function rateLimiter(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const ip = getClientIP(req);
  const now = Date.now();

  let entry = store.get(ip);

  if (!entry || entry.resetAt < now) {
    entry = { count: 1, resetAt: now + WINDOW_MS };
    store.set(ip, entry);
  } else {
    entry.count++;
  }

  res.setHeader('X-RateLimit-Limit', MAX_REQUESTS);
  res.setHeader('X-RateLimit-Remaining', Math.max(0, MAX_REQUESTS - entry.count));
  res.setHeader('X-RateLimit-Reset', Math.ceil(entry.resetAt / 1000));

  if (entry.count > MAX_REQUESTS) {
    logger.warn('Rate limit exceeded', { ip, count: entry.count });
    res.status(429).json({
      error: 'Too many requests. Please slow down.',
      code: 'RATE_LIMIT_EXCEEDED',
      retryAfter: Math.ceil((entry.resetAt - now) / 1000),
    });
    return;
  }

  next();
}

export function createRouteRateLimiter(
  maxRequests: number,
  windowMs = WINDOW_MS
) {
  const routeStore = new Map<string, RateLimitEntry>();

  return function (req: Request, res: Response, next: NextFunction): void {
    const ip = getClientIP(req);
    const key = `${ip}:${req.path}`;
    const now = Date.now();

    let entry = routeStore.get(key);

    if (!entry || entry.resetAt < now) {
      entry = { count: 1, resetAt: now + windowMs };
      routeStore.set(key, entry);
    } else {
      entry.count++;
    }

    if (entry.count > maxRequests) {
      res.status(429).json({
        error: 'Too many requests for this endpoint',
        code: 'RATE_LIMIT_EXCEEDED',
        retryAfter: Math.ceil((entry.resetAt - now) / 1000),
      });
      return;
    }

    next();
  };
}
