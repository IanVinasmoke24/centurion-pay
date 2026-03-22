import dotenv from 'dotenv';
dotenv.config();

import { Keypair } from '@stellar/stellar-sdk';
import { fundTestnetAccount } from '../../stellar/accounts';
import { issueAsset, createTrustline, createDEXOffer } from '../../stellar/issuer';
import { upsert } from '../models/Account';
import { logger } from '../../utils/logger';

/**
 * Seeds the testnet with freshly-funded accounts and issued assets.
 * Run with: npm run seed
 *
 * This will:
 * 1. Generate keypairs for issuer + distributor of each asset
 * 2. Fund them via Friendbot
 * 3. Issue MXN, USD, GOLD from issuer -> distributor
 * 4. Create DEX liquidity offers
 * 5. Print the public/secret keys so you can put them in .env
 */

interface AccountSet {
  issuer: Keypair;
  distributor: Keypair;
  code: string;
  initialSupply: string;
}

async function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

async function main() {
  logger.info('Starting testnet seed script...');

  const accountSets: AccountSet[] = [
    {
      issuer: Keypair.random(),
      distributor: Keypair.random(),
      code: 'MXN',
      initialSupply: '1000000',
    },
    {
      issuer: Keypair.random(),
      distributor: Keypair.random(),
      code: 'USD',
      initialSupply: '1000000',
    },
    {
      issuer: Keypair.random(),
      distributor: Keypair.random(),
      code: 'GOLD',
      initialSupply: '10000',
    },
  ];

  // Fund all accounts via Friendbot
  logger.info('Funding accounts via Friendbot...');
  for (const set of accountSets) {
    await fundTestnetAccount(set.issuer.publicKey());
    await sleep(1500);
    await fundTestnetAccount(set.distributor.publicKey());
    await sleep(1500);
    logger.info(`Funded ${set.code} accounts`);
  }

  // Issue assets
  logger.info('Issuing assets...');
  for (const set of accountSets) {
    const { trustlineHash, paymentHash } = await issueAsset(
      set.issuer,
      set.distributor,
      set.code,
      set.initialSupply
    );
    logger.info(`Issued ${set.code}`, { trustlineHash, paymentHash });
    await sleep(2000);
  }

  // Store in DB
  for (const set of accountSets) {
    await upsert({
      address: set.issuer.publicKey(),
      label: `${set.code} Issuer`,
      role: 'issuer',
    });
    await upsert({
      address: set.distributor.publicKey(),
      label: `${set.code} Distributor`,
      role: 'distributor',
    });
  }

  // Print env vars
  console.log('\n====== Copy these to your .env ======\n');
  for (const set of accountSets) {
    console.log(`${set.code}_ISSUER_PUBLIC=${set.issuer.publicKey()}`);
    console.log(`${set.code}_ISSUER_SECRET=${set.issuer.secret()}`);
    console.log(`${set.code}_DISTRIBUTOR_PUBLIC=${set.distributor.publicKey()}`);
    console.log(`${set.code}_DISTRIBUTOR_SECRET=${set.distributor.secret()}`);
    console.log('');
  }

  logger.info('Seed complete!');
  process.exit(0);
}

main().catch((err) => {
  logger.error('Seed script failed', { err });
  process.exit(1);
});
