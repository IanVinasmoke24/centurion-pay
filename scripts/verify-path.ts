#!/usr/bin/env ts-node
// ============================================================
// Proyecto Centurion – Path Payment Route Verification
// Tests all expected payment paths against Horizon testnet.
// Exits with code 1 if no viable paths found.
// Run after create-liquidity.ts.
// ============================================================

import { Keypair } from '@stellar/stellar-sdk';
import * as fs from 'fs';
import * as path from 'path';

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const HORIZON_URL   = 'https://horizon-testnet.stellar.org';
const ACCOUNTS_FILE = path.join(__dirname, 'testnet-accounts.json');

/** Amount of MXN the merchant wants to receive in each test. */
const TEST_DEST_AMOUNT = '500';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface AccountEntry {
  asset: string;
  role: string;
  publicKey: string;
  secretKey: string;
}

interface TestnetAccounts {
  accounts: AccountEntry[];
}

/** Raw record from Horizon /paths/strict-receive */
interface HorizonPathRecord {
  source_asset_type: string;
  source_asset_code?: string;
  source_asset_issuer?: string;
  source_amount: string;
  destination_asset_type: string;
  destination_asset_code?: string;
  destination_asset_issuer?: string;
  destination_amount: string;
  path: Array<{
    asset_type: string;
    asset_code?: string;
    asset_issuer?: string;
  }>;
}

interface HorizonPathsResponse {
  _embedded: {
    records: HorizonPathRecord[];
  };
}

interface PathTestResult {
  routeLabel: string;
  sourceAsset: string;
  destAsset: string;
  destAmount: string;
  paths: Array<{
    sendMax: string;
    hops: string[];
    rate: string;
  }>;
  cheapestSendMax?: string;
  error?: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function loadAccounts(): TestnetAccounts {
  if (!fs.existsSync(ACCOUNTS_FILE)) {
    throw new Error(
      `${ACCOUNTS_FILE} not found. Run 'npm run setup' first.`,
    );
  }
  return JSON.parse(fs.readFileSync(ACCOUNTS_FILE, 'utf8')) as TestnetAccounts;
}

function getPublicKey(accounts: AccountEntry[], asset: string, role: string): string {
  const entry = accounts.find(a => a.asset === asset && a.role === role);
  if (!entry) throw new Error(`Account not found: ${asset} ${role}`);
  return entry.publicKey;
}

/** Format a Horizon asset reference for a URL query parameter. */
function assetParam(
  type: 'native' | 'credit',
  code?: string,
  issuer?: string,
): URLSearchParams {
  const p = new URLSearchParams();
  if (type === 'native') {
    p.set('source_asset_type', 'native');
  } else {
    p.set('source_asset_type', 'credit_alphanum4');
    p.set('source_asset_code', code!);
    p.set('source_asset_issuer', issuer!);
  }
  return p;
}

/**
 * Calls Horizon strict-receive path-find endpoint.
 * Returns an array of path records (may be empty if no liquidity).
 */
async function findPaths(
  sourceType: 'native' | 'credit',
  sourceCode: string | undefined,
  sourceIssuer: string | undefined,
  destCode: string,
  destIssuer: string,
  destAmount: string,
  destinationAccount: string,
): Promise<HorizonPathRecord[]> {
  const params = new URLSearchParams();

  // Source asset
  if (sourceType === 'native') {
    params.set('source_asset_type', 'native');
  } else {
    params.set('source_asset_type', 'credit_alphanum4');
    params.set('source_asset_code', sourceCode!);
    params.set('source_asset_issuer', sourceIssuer!);
  }

  // Destination asset
  params.set('destination_asset_type', 'credit_alphanum4');
  params.set('destination_asset_code', destCode);
  params.set('destination_asset_issuer', destIssuer);
  params.set('destination_amount', destAmount);
  params.set('destination_account', destinationAccount);

  const url = `${HORIZON_URL}/paths/strict-receive?${params.toString()}`;

  const response = await fetch(url);
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Horizon paths API error ${response.status}: ${text.slice(0, 200)}`);
  }

  const data = (await response.json()) as HorizonPathsResponse;
  return data._embedded?.records ?? [];
}

/** Format path hops as a human-readable arrow string. */
function formatPath(record: HorizonPathRecord): string {
  const sourceCode =
    record.source_asset_type === 'native' ? 'XLM' : record.source_asset_code ?? '?';
  const destCode =
    record.destination_asset_type === 'native' ? 'XLM' : record.destination_asset_code ?? '?';

  const hops = record.path.map(p =>
    p.asset_type === 'native' ? 'XLM' : p.asset_code ?? '?',
  );

  const parts = [sourceCode, ...hops, destCode];
  return parts.join(' → ');
}

function computeRate(sendMax: string, destAmount: string, srcCode: string, destCode: string): string {
  const rate = parseFloat(destAmount) / parseFloat(sendMax);
  return `${rate.toFixed(4)} ${destCode}/${srcCode}`;
}

// ---------------------------------------------------------------------------
// Test definitions
// ---------------------------------------------------------------------------

interface RouteTest {
  label: string;
  sourceType: 'native' | 'credit';
  sourceCode?: string;
  sourceAssetKey?: string;  // "ASSET role" to look up issuer
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  console.log('╔══════════════════════════════════════════════════════╗');
  console.log('║  Proyecto Centurion – Path Payment Verification       ║');
  console.log(`║  Testing routes for ${TEST_DEST_AMOUNT} MXN destination amount    ║`);
  console.log('╚══════════════════════════════════════════════════════╝');

  const data = loadAccounts();
  const { accounts } = data;

  // Load relevant public keys
  const mxnIssuer  = getPublicKey(accounts, 'MXN',  'issuer');
  const mxnDist    = getPublicKey(accounts, 'MXN',  'distributor');
  const usdIssuer  = getPublicKey(accounts, 'USD',  'issuer');
  const goldIssuer = getPublicKey(accounts, 'GOLD', 'issuer');

  console.log('\nMerchant destination account: MXN Distributor');
  console.log(`  Address: ${mxnDist}`);
  console.log(`  Asset:   MXN issued by ${mxnIssuer}`);

  const results: PathTestResult[] = [];

  const routes: Array<{
    label: string;
    sourceType: 'native' | 'credit';
    sourceCode?: string;
    sourceIssuer?: string;
    sourceAssetLabel: string;
  }> = [
    {
      label:            'USD → XLM → MXN (via Stellar DEX)',
      sourceType:       'credit',
      sourceCode:       'USD',
      sourceIssuer:     usdIssuer,
      sourceAssetLabel: 'USD',
    },
    {
      label:            'GOLD → XLM → MXN (via Stellar DEX)',
      sourceType:       'credit',
      sourceCode:       'GOLD',
      sourceIssuer:     goldIssuer,
      sourceAssetLabel: 'GOLD',
    },
    {
      label:            'USD → MXN (direct cross-pair)',
      sourceType:       'credit',
      sourceCode:       'USD',
      sourceIssuer:     usdIssuer,
      sourceAssetLabel: 'USD',
    },
    {
      label:            'XLM → MXN (native path)',
      sourceType:       'native',
      sourceAssetLabel: 'XLM',
    },
  ];

  let anyPathFound = false;

  for (const route of routes) {
    console.log(`\n━━━  Testing: ${route.label}`);
    const result: PathTestResult = {
      routeLabel:  route.label,
      sourceAsset: route.sourceAssetLabel,
      destAsset:   'MXN',
      destAmount:  TEST_DEST_AMOUNT,
      paths:       [],
    };

    try {
      const records = await findPaths(
        route.sourceType,
        route.sourceCode,
        route.sourceIssuer,
        'MXN',
        mxnIssuer,
        TEST_DEST_AMOUNT,
        mxnDist,
      );

      if (records.length === 0) {
        console.log('  No paths found for this route.');
        result.error = 'No paths found';
      } else {
        anyPathFound = true;
        console.log(`  Found ${records.length} path(s):`);

        // Sort by sendMax ascending (cheapest first)
        records.sort((a, b) => parseFloat(a.source_amount) - parseFloat(b.source_amount));

        records.forEach((rec, idx) => {
          const pathStr  = formatPath(rec);
          const rate     = computeRate(
            rec.source_amount, rec.destination_amount,
            route.sourceAssetLabel, 'MXN',
          );
          const marker   = idx === 0 ? '  BEST' : '      ';
          console.log(`  ${marker} Path ${idx + 1}: ${pathStr}`);
          console.log(`          Send max: ${rec.source_amount} ${route.sourceAssetLabel}`);
          console.log(`          Rate:     ${rate}`);

          result.paths.push({
            sendMax: rec.source_amount,
            hops:    rec.path.map(p =>
              p.asset_type === 'native' ? 'XLM' : p.asset_code ?? '?',
            ),
            rate,
          });
        });

        result.cheapestSendMax = records[0].source_amount;
      }
    } catch (err) {
      const msg = (err as Error).message;
      console.error(`  Error querying paths: ${msg}`);
      result.error = msg;
    }

    results.push(result);
  }

  // ── Summary table ─────────────────────────────────────────────────────────
  console.log('\n');
  console.log('╔══════════════════════════════════════════════════════════════════╗');
  console.log('║  SUMMARY – Path Payment Route Results                             ║');
  console.log('╠══════════════════════════════════════════════════════════════════╣');
  console.log(`║  Destination: ${TEST_DEST_AMOUNT} MXN`.padEnd(67) + '║');
  console.log('╠═══════════════════════════════╦══════════╦═══════════════════════╣');
  console.log('║ Route                         ║ Status   ║ Best Send Max         ║');
  console.log('╠═══════════════════════════════╦══════════╦═══════════════════════╣');

  let bestResult: PathTestResult | null = null;
  let bestSendMax = Infinity;

  for (const r of results) {
    const status  = r.error ? 'NO PATH' : 'FOUND';
    const sendMax = r.cheapestSendMax
      ? `${r.cheapestSendMax} ${r.sourceAsset}`
      : 'N/A';
    const routeTrunc = r.routeLabel.slice(0, 29).padEnd(29);
    console.log(`║ ${routeTrunc} ║ ${status.padEnd(8)} ║ ${sendMax.padEnd(21)} ║`);

    if (r.cheapestSendMax) {
      const usdEquiv = parseFloat(r.cheapestSendMax);
      if (usdEquiv < bestSendMax) {
        bestSendMax = usdEquiv;
        bestResult  = r;
      }
    }
  }
  console.log('╚═══════════════════════════════╩══════════╩═══════════════════════╝');

  if (bestResult) {
    console.log(`\n  Cheapest route: ${bestResult.routeLabel}`);
    console.log(`  Send max:       ${bestResult.cheapestSendMax} ${bestResult.sourceAsset}`);
  }

  // ── Exit code ─────────────────────────────────────────────────────────────
  if (!anyPathFound) {
    console.error('\n');
    console.error('ERROR: No payment paths found on any tested route.');
    console.error('');
    console.error('Likely causes:');
    console.error('  1. issue-assets.ts has not been run yet.');
    console.error('     → Run: npm run issue');
    console.error('');
    console.error('  2. create-liquidity.ts has not been run yet.');
    console.error('     → Run: npm run liquidity');
    console.error('');
    console.error('  3. DEX offers have expired or been consumed.');
    console.error('     → Re-run: npm run liquidity');
    console.error('');
    process.exit(1);
  }

  console.log('\nVerification complete.  Payment paths are operational.');
}

main().catch(err => {
  console.error('\nFatal error in verify-path:', err);
  process.exit(1);
});
