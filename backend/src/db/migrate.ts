import dotenv from 'dotenv';
dotenv.config();

import db from '../config/database';
import {
  createPaymentsTable,
  createQRSessionsTable,
  createAccountsTable,
} from './schema';
import { logger } from '../utils/logger';

async function migrate(): Promise<void> {
  logger.info('Starting database migration...');

  try {
    await createAccountsTable(db);
    logger.info('accounts table: OK');

    await createQRSessionsTable(db);
    logger.info('qr_sessions table: OK');

    await createPaymentsTable(db);
    logger.info('payments table: OK');

    logger.info('Migration complete.');
  } catch (err) {
    logger.error('Migration failed', { err });
    process.exit(1);
  } finally {
    await db.destroy();
  }
}

migrate();
