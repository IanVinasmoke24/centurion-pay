import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import cors from 'cors';
import http from 'http';
import { config } from './config/env';
import { logger } from './utils/logger';
import { rateLimiter } from './middleware/rateLimiter';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';
import paymentsRouter from './routes/payments';
import assetsRouter from './routes/assets';
import accountsRouter from './routes/accounts';
import * as NotificationService from './services/NotificationService';
import { startRatePolling } from './services/RateService';

const app = express();
const httpServer = http.createServer(app);

// ── Middleware ────────────────────────────────────────────────────────────────

app.use(
  cors({
    origin: process.env.CORS_ORIGIN ?? '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);

app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(rateLimiter);

// ── Health check ──────────────────────────────────────────────────────────────

app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'centurion-backend',
    network: config.STELLAR_NETWORK,
    timestamp: new Date().toISOString(),
    wsClients: NotificationService.getConnectedCount(),
  });
});

// ── Routes ────────────────────────────────────────────────────────────────────

app.use('/api/payments', paymentsRouter);
app.use('/api/assets', assetsRouter);
app.use('/api/accounts', accountsRouter);

// ── 404 & Error handlers ──────────────────────────────────────────────────────

app.use(notFoundHandler);
app.use(errorHandler);

// ── WebSocket ─────────────────────────────────────────────────────────────────

NotificationService.initialize(httpServer);

// ── Start rate polling ────────────────────────────────────────────────────────

startRatePolling(30_000);

// ── Startup ───────────────────────────────────────────────────────────────────

const PORT = config.PORT;

httpServer.listen(PORT, () => {
  logger.info(`Centurion backend listening`, {
    port: PORT,
    network: config.STELLAR_NETWORK,
    env: process.env.NODE_ENV ?? 'development',
  });
});

// ── Graceful shutdown ─────────────────────────────────────────────────────────

async function shutdown(signal: string) {
  logger.info(`Received ${signal}, shutting down gracefully...`);

  NotificationService.shutdown();

  const { stopAllStreams } = await import('./services/SettlementService');
  stopAllStreams();

  const { stopRatePolling } = await import('./services/RateService');
  stopRatePolling();

  httpServer.close(() => {
    logger.info('HTTP server closed');
    process.exit(0);
  });

  // Force-kill if graceful shutdown takes too long
  setTimeout(() => {
    logger.error('Forced shutdown after timeout');
    process.exit(1);
  }, 10_000);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

export { app, httpServer };
