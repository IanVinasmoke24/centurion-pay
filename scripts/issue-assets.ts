#!/usr/bin/env ts-node
// ============================================================
// Proyecto Centurion – Asset Issuance Script
// For each asset (MXN, USD, GOLD):
//   1. Distributor establishes trustline to issuer
//   2. Issuer mints 1,000,000 tokens → distributor
//   3. Distributor creates a DEX offer for XLM liquidity
// ============================================================

import {
  Asset,
  Horizon,
  Keypair,
  Networks,
  Operation,
  TransactionBuilder,
} from '@stellar/stellar-sdk';
import * as fs from 'fs';
import * as path from 'path';

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const HORIZON_URL   = 'https://horizon-testnet.stellar.org';
const NETWORK_PASSPHRASE = Networks.TESTNET;
const ACCOUNTS_FILE = path.join(__dirname, 'testnet-accounts.json');
const STELLAR_EXPERT = 'https://stellar.expert/explorer/testnet/tx';

const ISSUE_AMOUNT  = '1000000'; // 1 million tokens per asset
const BASE_FEE      = '100';     // stroops

/**
 * DEX offers placed by the distributor immediately after issuance.
 * price = how many XLM per 1 unit of the custom asset
 * (i.e., "n XLM = 1 token" → we sell tokens for XLM at this rate)
 *
 * Real-world approximations at time of writing (testnet only):
 *   1 XLM ≈ 17    MXN  → 1 MXN  = 0.0588 XLM
 *   1 XLM ≈ 0.10  USD  → 1 USD  = 10.0   XLM
 *   1 XLM ≈ 0.005 GOLD → 1 GOLD = 200.0  XLM
 */
const INITIAL_OFFERS: Record<string, { xlmPerToken: string; offerAmount: string }> = {
  MXN:  { xlmPerToken: '0.0588235', offerAmount: '500000' },  // sell 500k MXN
  USD:  { xlmPerToken: '10.000000', offerAmount: '50000'  },  // sell  50k USD
  GOLD: { xlmPerToken: '200.00000', offerAmount: '5000'   },  // sell   5k GOLD
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function explorerLink(hash: string): string {
  return `${STELLAR_EXPERT}/${hash}`;
}

interface AccountEntry {
  label: string;
  asset: string;
  role: string;
  publicKey: string;
  secretKey: string;
}

interface TestnetAccounts {
  accounts: AccountEntry[];
}

function loadAccounts(): TestnetAccounts {
  if (!fs.existsSync(ACCOUNTS_FILE)) {
    throw new Error(
      `${ACCOUNTS_FILE} not found. Run 'npm run setup' first.`,
    );
  }
  return JSON.parse(fs.readFileSync(ACCOUNTS_FILE, 'utf8')) as TestnetAccounts;
}

function getKeypair(accounts: AccountEntry[], asset: string, role: string): Keypair {
  const entry = accounts.find(a => a.asset === asset && a.role === role);
  if (!entry) throw new Error(`Keypair not found: ${asset} ${role}`);
  return Keypair.fromSecret(entry.secretKey);
}

/** Build, sign, and submit a transaction; throws on failure. */
async function submitTransaction(
  server: Horizon.Server,
  builder: TransactionBuilder,
  ...signers: Keypair[]
): Promise<string> {
  const tx = builder.setTimeout(30).build();
  for (const signer of signers) {
    tx.sign(signer);
  }
  const result = await server.submitTransaction(tx);
  return result.hash;
}

/** Load account from Horizon and return its AccountResponse. */
async function loadAccount(
  server: Horizon.Server,
  publicKey: string,
): Promise<Horizon.AccountResponse> {
  return server.loadAccount(publicKey);
}

// ---------------------------------------------------------------------------
// Core operations
// ---------------------------------------------------------------------------

async function createTrustline(
  server: Horizon.Server,
  distributorKp: Keypair,
  asset: Asset,
  assetCode: string,
): Promise<void> {
  console.log(`\n  [${assetCode}] Creating trustline from distributor to issuer…`);
  const distAccount = await loadAccount(server, distributorKp.publicKey());

  const builder = new TransactionBuilder(distAccount, {
    fee: BASE_FEE,
    networkPassphrase: NETWORK_PASSPHRASE,
  }).addOperation(
    Operation.changeTrust({ asset, limit: '10000000' }),
  );

  const hash = await submitTransaction(server, builder, distributorKp);
  console.log(`  [${assetCode}] Trustline established. TX: ${explorerLink(hash)}`);
  await sleep(5000); // wait for ledger close
}

async function issueTokens(
  server: Horizon.Server,
  issuerKp: Keypair,
  distributorKp: Keypair,
  asset: Asset,
  assetCode: string,
): Promise<void> {
  console.log(`  [${assetCode}] Issuing ${ISSUE_AMOUNT} tokens to distributor…`);
  const issuerAccount = await loadAccount(server, issuerKp.publicKey());

  const builder = new TransactionBuilder(issuerAccount, {
    fee: BASE_FEE,
    networkPassphrase: NETWORK_PASSPHRASE,
  }).addOperation(
    Operation.payment({
      destination: distributorKp.publicKey(),
      asset,
      amount: ISSUE_AMOUNT,
    }),
  );

  const hash = await submitTransaction(server, builder, issuerKp);
  console.log(`  [${assetCode}] Issuance complete.    TX: ${explorerLink(hash)}`);
  await sleep(5000);
}

async function createInitialOffer(
  server: Horizon.Server,
  distributorKp: Keypair,
  asset: Asset,
  assetCode: string,
): Promise<void> {
  const { xlmPerToken, offerAmount } = INITIAL_OFFERS[assetCode];
  console.log(
    `  [${assetCode}] Creating DEX offer: sell ${offerAmount} ${assetCode} @ ${xlmPerToken} XLM/token…`,
  );

  const distAccount = await loadAccount(server, distributorKp.publicKey());

  // manageSellOffer: sell `assetCode` for XLM
  //   price = XLM per unit of selling asset
  const builder = new TransactionBuilder(distAccount, {
    fee: BASE_FEE,
    networkPassphrase: NETWORK_PASSPHRASE,
  }).addOperation(
    Operation.manageSellOffer({
      selling: asset,
      buying:  Asset.native(),
      amount:  offerAmount,
      price:   xlmPerToken,
      offerId: '0', // 0 = create new
    }),
  );

  const hash = await submitTransaction(server, builder, distributorKp);
  console.log(`  [${assetCode}] DEX offer placed.     TX: ${explorerLink(hash)}`);
  await sleep(5000);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  console.log('╔══════════════════════════════════════════════════════╗');
  console.log('║  Proyecto Centurion – Asset Issuance                  ║');
  console.log('╚══════════════════════════════════════════════════════╝');

  // Load keypairs
  const data = loadAccounts();
  const { accounts } = data;

  // Initialise Horizon server
  const server = new Horizon.Server(HORIZON_URL);

  const assetCodes = ['MXN', 'USD', 'GOLD'] as const;

  for (const code of assetCodes) {
    console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`  Processing asset: ${code}`);
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);

    const issuerKp      = getKeypair(accounts, code, 'issuer');
    const distributorKp = getKeypair(accounts, code, 'distributor');
    const asset         = new Asset(code, issuerKp.publicKey());

    console.log(`  Issuer:      ${issuerKp.publicKey()}`);
    console.log(`  Distributor: ${distributorKp.publicKey()}`);

    // 1. Trustline
    await createTrustline(server, distributorKp, asset, code);

    // 2. Issue tokens
    await issueTokens(server, issuerKp, distributorKp, asset, code);

    // 3. Initial DEX offer
    await createInitialOffer(server, distributorKp, asset, code);
  }

  console.log('\n');
  console.log('╔══════════════════════════════════════════════════════╗');
  console.log('║  All assets issued successfully!                      ║');
  console.log('║                                                        ║');
  console.log('║  Next steps:                                           ║');
  console.log('║    npm run liquidity  ← add more DEX depth            ║');
  console.log('║    npm run verify     ← test path payment routes      ║');
  console.log('╚══════════════════════════════════════════════════════╝');
}

main().catch(err => {
  console.error('\nFatal error in issue-assets:', err);
  process.exit(1);
});
