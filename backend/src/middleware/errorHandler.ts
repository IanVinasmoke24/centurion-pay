import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { logger } from '../utils/logger';

export interface ErrorResponse {
  error: string;
  code: string;
  details?: unknown;
}

export class AppError extends Error {
  constructor(
    public message: string,
    public code: string,
    public statusCode: number = 400,
    public details?: unknown
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export function errorHandler(
  err: unknown,
  req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _next: NextFunction
): void {
  // Zod validation errors
  if (err instanceof ZodError) {
    res.status(400).json({
      error: 'Validation error',
      code: 'VALIDATION_ERROR',
      details: err.flatten(),
    } satisfies ErrorResponse);
    return;
  }

  // Application-level errors
  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      error: err.message,
      code: err.code,
      details: err.details,
    } satisfies ErrorResponse);
    return;
  }

  // Stellar / Horizon errors
  if (
    typeof err === 'object' &&
    err !== null &&
    'response' in err &&
    typeof (err as { response?: unknown }).response === 'object'
  ) {
    const stellarErr = err as {
      response?: { data?: { extras?: { result_codes?: unknown } }; status?: number };
      message?: string;
    };
    const statusCode = stellarErr.response?.status ?? 502;
    const resultCodes = stellarErr.response?.data?.extras?.result_codes;

    logger.error('Stellar/Horizon error', {
      method: req.method,
      path: req.path,
      resultCodes,
      status: statusCode,
    });

    res.status(statusCode).json({
      error: 'Stellar network error',
      code: 'STELLAR_ERROR',
      details: resultCodes,
    } satisfies ErrorResponse);
    return;
  }

  // Generic errors
  const error = err instanceof Error ? err : new Error(String(err));

  logger.error('Unhandled error', {
    method: req.method,
    path: req.path,
    message: error.message,
    stack: error.stack,
  });

  res.status(500).json({
    error: 'Internal server error',
    code: 'INTERNAL_ERROR',
    details: process.env.NODE_ENV === 'development' ? error.message : undefined,
  } satisfies ErrorResponse);
}

export function notFoundHandler(req: Request, res: Response): void {
  res.status(404).json({
    error: `Route ${req.method} ${req.path} not found`,
    code: 'NOT_FOUND',
  } satisfies ErrorResponse);
}
