import { z } from 'zod';
import dotenv from 'dotenv';

dotenv.config();

const envSchema = z.object({
  STELLAR_NETWORK: z.enum(['testnet', 'mainnet']).default('testnet'),
  HORIZON_TESTNET_URL: z.string().url().default('https://horizon-testnet.stellar.org'),
  HORIZON_MAINNET_URL: z.string().url().default('https://horizon.stellar.org'),

  MXN_ISSUER_PUBLIC: z.string().default(''),
  MXN_ISSUER_SECRET: z.string().default(''),
  USD_ISSUER_PUBLIC: z.string().default(''),
  USD_ISSUER_SECRET: z.string().default(''),
  GOLD_ISSUER_PUBLIC: z.string().default(''),
  GOLD_ISSUER_SECRET: z.string().default(''),

  MXN_DISTRIBUTOR_PUBLIC: z.string().default(''),
  MXN_DISTRIBUTOR_SECRET: z.string().default(''),
  USD_DISTRIBUTOR_PUBLIC: z.string().default(''),
  USD_DISTRIBUTOR_SECRET: z.string().default(''),
  GOLD_DISTRIBUTOR_PUBLIC: z.string().default(''),
  GOLD_DISTRIBUTOR_SECRET: z.string().default(''),

  PORT: z.coerce.number().default(3001),
  JWT_SECRET: z.string().min(1).default('change_this_in_production_please'),
  QR_HMAC_SECRET: z.string().min(1).default('change_this_in_production_please'),
  SLIPPAGE_TOLERANCE_PCT: z.coerce.number().default(1.5),

  DB_CLIENT: z.enum(['sqlite3', 'pg']).default('sqlite3'),
  DB_FILENAME: z.string().optional(),
  DATABASE_URL: z.string().optional(),
});

export type EnvConfig = z.infer<typeof envSchema>;

function loadConfig(): EnvConfig {
  const result = envSchema.safeParse(process.env);
  if (!result.success) {
    console.error('Invalid environment configuration:');
    console.error(result.error.format());
    process.exit(1);
  }
  return result.data;
}

export const config = loadConfig();
