#!/usr/bin/env ts-node
// ============================================================
// Proyecto Centurion – Testnet Account Setup
// Generates 6 keypairs (MXN/USD/GOLD × issuer/distributor),
// funds them via Friendbot, and saves them to testnet-accounts.json
// ============================================================

import { Keypair } from '@stellar/stellar-sdk';
import * as fs from 'fs';
import * as path from 'path';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const FRIENDBOT_URL = 'https://friendbot.stellar.org/?addr=';
const OUTPUT_FILE = path.join(__dirname, 'testnet-accounts.json');

/**
 * Definitions for every keypair we need.
 * label  – human-readable name
 * role   – 'issuer' | 'distributor'
 * asset  – the asset this account belongs to
 */
const ACCOUNT_DEFS = [
  { label: 'MXN Issuer',        asset: 'MXN',  role: 'issuer'       },
  { label: 'MXN Distributor',   asset: 'MXN',  role: 'distributor'  },
  { label: 'USD Issuer',        asset: 'USD',  role: 'issuer'       },
  { label: 'USD Distributor',   asset: 'USD',  role: 'distributor'  },
  { label: 'GOLD Issuer',       asset: 'GOLD', role: 'issuer'       },
  { label: 'GOLD Distributor',  asset: 'GOLD', role: 'distributor'  },
] as const;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Sleep for `ms` milliseconds. */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/** Fund a single account via Friendbot.  Retries up to `maxRetries` times. */
async function fundViaFriendbot(
  publicKey: string,
  label: string,
  maxRetries = 5,
): Promise<void> {
  const url = `${FRIENDBOT_URL}${publicKey}`;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`  [${label}] Friendbot attempt ${attempt}/${maxRetries}…`);
      const response = await fetch(url);

      if (response.ok) {
        const body = (await response.json()) as { hash?: string };
        console.log(`  [${label}] Funded! tx hash: ${body.hash ?? 'n/a'}`);
        return;
      }

      // Friendbot returns 400 if the account already exists – treat as success.
      if (response.status === 400) {
        const body = await response.text();
        if (body.includes('createAccountAlreadyExist') || body.includes('already funded')) {
          console.log(`  [${label}] Account already funded – continuing.`);
          return;
        }
      }

      // Any other non-ok response – log and retry.
      console.warn(`  [${label}] Unexpected status ${response.status} – retrying…`);
    } catch (err) {
      console.warn(`  [${label}] Network error on attempt ${attempt}: ${(err as Error).message}`);
    }

    if (attempt < maxRetries) {
      const delay = 2000 * attempt;
      console.log(`  [${label}] Waiting ${delay / 1000}s before retry…`);
      await sleep(delay);
    }
  }

  throw new Error(`Failed to fund [${label}] after ${maxRetries} attempts.`);
}

/** Verify that a funded account exists on Horizon. */
async function verifyAccountExists(publicKey: string, label: string): Promise<void> {
  const url = `https://horizon-testnet.stellar.org/accounts/${publicKey}`;
  const maxRetries = 10;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(url);
      if (response.ok) {
        const account = (await response.json()) as { balances: unknown[] };
        console.log(
          `  [${label}] Confirmed on-chain. Balances: ${account.balances.length} entries.`,
        );
        return;
      }
      // 404 means ledger hasn't closed yet
      console.log(`  [${label}] Not yet on Horizon (attempt ${attempt}/${maxRetries}) – waiting 3s…`);
    } catch {
      console.log(`  [${label}] Horizon query error – retrying in 3s…`);
    }
    await sleep(3000);
  }

  throw new Error(
    `Account [${label}] (${publicKey}) not found on Horizon after ${maxRetries} checks.`,
  );
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

interface AccountEntry {
  label: string;
  asset: string;
  role: string;
  publicKey: string;
  secretKey: string;
}

interface TestnetAccounts {
  network: 'testnet';
  generatedAt: string;
  accounts: AccountEntry[];
  assets: {
    MXN: { issuerPublic: string; distributorPublic: string };
    USD: { issuerPublic: string; distributorPublic: string };
    GOLD: { issuerPublic: string; distributorPublic: string };
  };
  envInstructions: Record<string, string>;
}

async function main(): Promise<void> {
  console.log('╔══════════════════════════════════════════════════════╗');
  console.log('║  Proyecto Centurion – Testnet Account Setup           ║');
  console.log('╚══════════════════════════════════════════════════════╝');
  console.log('');

  // ── Step 1: Generate keypairs ────────────────────────────────────────────
  console.log('Step 1/4  Generating 6 keypairs…');
  const accounts: AccountEntry[] = ACCOUNT_DEFS.map(def => {
    const kp = Keypair.random();
    console.log(`  Generated [${def.label}]: ${kp.publicKey()}`);
    return {
      label: def.label,
      asset: def.asset,
      role:  def.role,
      publicKey:  kp.publicKey(),
      secretKey:  kp.secret(),
    };
  });
  console.log('');

  // ── Step 2: Fund via Friendbot (sequentially to avoid rate-limits) ────────
  console.log('Step 2/4  Funding accounts via Friendbot…');
  for (const account of accounts) {
    await fundViaFriendbot(account.publicKey, account.label);
    // Small delay between requests to be a good citizen
    await sleep(800);
  }
  console.log('');

  // ── Step 3: Verify all accounts exist on Horizon ─────────────────────────
  console.log('Step 3/4  Verifying accounts on Horizon testnet…');
  for (const account of accounts) {
    await verifyAccountExists(account.publicKey, account.label);
  }
  console.log('');

  // ── Step 4: Persist to JSON ───────────────────────────────────────────────
  console.log('Step 4/4  Saving keypairs to testnet-accounts.json…');

  const get = (asset: string, role: string): AccountEntry => {
    const found = accounts.find(a => a.asset === asset && a.role === role);
    if (!found) throw new Error(`Account not found: ${asset} ${role}`);
    return found;
  };

  const mxnIssuer  = get('MXN',  'issuer');
  const mxnDist    = get('MXN',  'distributor');
  const usdIssuer  = get('USD',  'issuer');
  const usdDist    = get('USD',  'distributor');
  const goldIssuer = get('GOLD', 'issuer');
  const goldDist   = get('GOLD', 'distributor');

  const output: TestnetAccounts = {
    network:     'testnet',
    generatedAt: new Date().toISOString(),
    accounts,
    assets: {
      MXN:  { issuerPublic: mxnIssuer.publicKey,  distributorPublic: mxnDist.publicKey  },
      USD:  { issuerPublic: usdIssuer.publicKey,  distributorPublic: usdDist.publicKey  },
      GOLD: { issuerPublic: goldIssuer.publicKey, distributorPublic: goldDist.publicKey },
    },
    envInstructions: {
      // Map the fields exactly to backend .env variable names
      MXN_ISSUER_PUBLIC:        mxnIssuer.publicKey,
      MXN_ISSUER_SECRET:        mxnIssuer.secretKey,
      MXN_DISTRIBUTOR_PUBLIC:   mxnDist.publicKey,
      MXN_DISTRIBUTOR_SECRET:   mxnDist.secretKey,
      USD_ISSUER_PUBLIC:        usdIssuer.publicKey,
      USD_ISSUER_SECRET:        usdIssuer.secretKey,
      USD_DISTRIBUTOR_PUBLIC:   usdDist.publicKey,
      USD_DISTRIBUTOR_SECRET:   usdDist.secretKey,
      GOLD_ISSUER_PUBLIC:       goldIssuer.publicKey,
      GOLD_ISSUER_SECRET:       goldIssuer.secretKey,
      GOLD_DISTRIBUTOR_PUBLIC:  goldDist.publicKey,
      GOLD_DISTRIBUTOR_SECRET:  goldDist.secretKey,
    },
  };

  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(output, null, 2), 'utf8');
  console.log(`  Saved to ${OUTPUT_FILE}`);
  console.log('');

  // ── Print .env instructions ───────────────────────────────────────────────
  console.log('╔══════════════════════════════════════════════════════╗');
  console.log('║  NEXT STEPS – Copy the following to backend/.env      ║');
  console.log('╚══════════════════════════════════════════════════════╝');
  console.log('');
  console.log('# Stellar Network');
  console.log('STELLAR_NETWORK=testnet');
  console.log('HORIZON_URL=https://horizon-testnet.stellar.org');
  console.log('');

  for (const [key, value] of Object.entries(output.envInstructions)) {
    console.log(`${key}=${value}`);
  }

  console.log('');
  console.log('╔══════════════════════════════════════════════════════╗');
  console.log('║  After copying to .env, run:                          ║');
  console.log('║    npm run issue      ← issues MXN / USD / GOLD      ║');
  console.log('║    npm run liquidity  ← creates DEX liquidity offers  ║');
  console.log('║    npm run verify     ← tests path payment routes     ║');
  console.log('╚══════════════════════════════════════════════════════╝');
  console.log('');
  console.log('Setup complete!');
}

main().catch(err => {
  console.error('Fatal error in setup-testnet:', err);
  process.exit(1);
});
