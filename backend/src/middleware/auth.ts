import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config/env';
import { logger } from '../utils/logger';

export interface JWTPayload {
  sub: string;
  address?: string;
  role?: string;
  iat?: number;
  exp?: number;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: JWTPayload;
    }
  }
}

/**
 * Optional JWT middleware.
 * Validates Bearer token if present; does NOT reject requests without a token.
 */
export function optionalAuth(
  req: Request,
  _res: Response,
  next: NextFunction
): void {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next();
  }

  const token = authHeader.slice(7);

  try {
    const payload = jwt.verify(token, config.JWT_SECRET) as JWTPayload;
    req.user = payload;
  } catch (err) {
    logger.debug('Invalid JWT token', { err });
    // Do not block - this is optional auth
  }

  next();
}

/**
 * Required JWT middleware.
 * Rejects requests without a valid Bearer token with 401.
 */
export function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({
      error: 'Unauthorized',
      code: 'MISSING_TOKEN',
    });
    return;
  }

  const token = authHeader.slice(7);

  try {
    const payload = jwt.verify(token, config.JWT_SECRET) as JWTPayload;
    req.user = payload;
    next();
  } catch (err) {
    res.status(401).json({
      error: 'Unauthorized',
      code: 'INVALID_TOKEN',
    });
  }
}

export function issueToken(payload: Omit<JWTPayload, 'iat' | 'exp'>): string {
  return jwt.sign(payload, config.JWT_SECRET, { expiresIn: '24h' });
}
