#!/usr/bin/env ts-node
// ============================================================
// Proyecto Centurion – DEX Liquidity Creation
// Adds multiple-sized offers for better price discovery and
// cross-pair USD/MXN offers for direct path efficiency.
// Run AFTER issue-assets.ts.
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

const HORIZON_URL        = 'https://horizon-testnet.stellar.org';
const NETWORK_PASSPHRASE = Networks.TESTNET;
const ACCOUNTS_FILE      = path.join(__dirname, 'testnet-accounts.json');
const STELLAR_EXPERT     = 'https://stellar.expert/explorer/testnet/tx';
const BASE_FEE           = '100';

/**
 * Offer tiers for XLM-based pairs.
 * Each tier represents a progressively larger sell order at the same price.
 * Having multiple offer sizes simulates an order book with depth.
 *
 * price = XLM per 1 unit of the custom asset (selling custom asset for XLM)
 */
const XLM_OFFERS: Record<
  string,
  { price: string; tiers: string[] }
> = {
  MXN: {
    price: '0.0588235',  // 1 MXN  = 0.0588 XLM  (17 MXN / XLM)
    tiers: ['1000', '10000', '100000'],
  },
  USD: {
    price: '10.000000',  // 1 USD  = 10.00  XLM  (0.10 USD / XLM)
    tiers: ['500', '5000', '25000'],
  },
  GOLD: {
    price: '200.00000',  // 1 GOLD = 200.00 XLM  (0.005 GOLD / XLM)
    tiers: ['25', '250', '1000'],
  },
};

/**
 * Direct cross-pair USD/MXN offers.
 * Selling USD for MXN at approximately market rate.
 * price = MXN per 1 USD
 */
const USD_MXN_OFFERS = {
  price: '17.000000',   // 1 USD = 17 MXN
  tiers: ['1000', '10000', '50000'],  // amounts in USD
};

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

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function explorerLink(hash: string): string {
  return `${STELLAR_EXPERT}/${hash}`;
}

function loadAccounts(): TestnetAccounts {
  if (!fs.existsSync(ACCOUNTS_FILE)) {
    throw new Error(
      `${ACCOUNTS_FILE} not found. Run 'npm run setup' and 'npm run issue' first.`,
    );
  }
  return JSON.parse(fs.readFileSync(ACCOUNTS_FILE, 'utf8')) as TestnetAccounts;
}

function getKeypair(accounts: AccountEntry[], asset: string, role: string): Keypair {
  const entry = accounts.find(a => a.asset === asset && a.role === role);
  if (!entry) throw new Error(`Keypair not found: ${asset} ${role}`);
  return Keypair.fromSecret(entry.secretKey);
}

async function submitTx(
  server: Horizon.Server,
  builder: TransactionBuilder,
  signer: Keypair,
): Promise<string> {
  const tx = builder.setTimeout(30).build();
  tx.sign(signer);
  const result = await server.submitTransaction(tx);
  return result.hash;
}

// ---------------------------------------------------------------------------
// Offer creation helpers
// ---------------------------------------------------------------------------

/**
 * Places a manageSellOffer: selling `sellingAsset` for `buyingAsset`.
 * price is expressed as (buying asset units per 1 selling asset unit).
 */
async function placeOffer(
  server: Horizon.Server,
  signerKp: Keypair,
  sellingAsset: Asset,
  buyingAsset: Asset,
  amount: string,
  price: string,
  label: string,
): Promise<string> {
  const account = await server.loadAccount(signerKp.publicKey());
  const builder = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase: NETWORK_PASSPHRASE,
  }).addOperation(
    Operation.manageSellOffer({
      selling: sellingAsset,
      buying:  buyingAsset,
      amount,
      price,
      offerId: '0',
    }),
  );

  const hash = await submitTx(server, builder, signerKp);
  console.log(`    [${label}] Sell ${amount} @ ${price} → TX: ${explorerLink(hash)}`);
  return hash;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  console.log('╔══════════════════════════════════════════════════════╗');
  console.log('║  Proyecto Centurion – DEX Liquidity Creation          ║');
  console.log('╚══════════════════════════════════════════════════════╝');

  const data    = loadAccounts();
  const { accounts } = data;
  const server  = new Horizon.Server(HORIZON_URL);

  const mxnIssuerKp   = getKeypair(accounts, 'MXN',  'issuer');
  const usdIssuerKp   = getKeypair(accounts, 'USD',  'issuer');
  const goldIssuerKp  = getKeypair(accounts, 'GOLD', 'issuer');

  const mxnDistKp     = getKeypair(accounts, 'MXN',  'distributor');
  const usdDistKp     = getKeypair(accounts, 'USD',  'distributor');
  const goldDistKp    = getKeypair(accounts, 'GOLD', 'distributor');

  const mxnAsset  = new Asset('MXN',  mxnIssuerKp.publicKey());
  const usdAsset  = new Asset('USD',  usdIssuerKp.publicKey());
  const goldAsset = new Asset('GOLD', goldIssuerKp.publicKey());
  const xlmAsset  = Asset.native();

  // ── 1. MXN / XLM tiered offers ──────────────────────────────────────────
  console.log('\n━━━  MXN / XLM Offers (Distributor sells MXN for XLM)');
  const mxnCfg = XLM_OFFERS['MXN'];
  for (const tier of mxnCfg.tiers) {
    await placeOffer(server, mxnDistKp, mxnAsset, xlmAsset, tier, mxnCfg.price, 'MXN/XLM');
    await sleep(4000);
  }

  // Also place reverse offers (buying MXN for XLM, i.e., XLM→MXN)
  console.log('\n  Reverse XLM→MXN offers (distributor buys MXN with XLM)');
  // Buy MXN by selling XLM: price = MXN per XLM = 1/0.0588 ≈ 17.0
  // We use manageBuyOffer for the reverse side
  for (const tier of mxnCfg.tiers) {
    const account = await server.loadAccount(mxnDistKp.publicKey());
    const builder = new TransactionBuilder(account, {
      fee: BASE_FEE,
      networkPassphrase: NETWORK_PASSPHRASE,
    }).addOperation(
      Operation.manageBuyOffer({
        selling: xlmAsset,
        buying:  mxnAsset,
        buyAmount: tier,
        price: '0.0588235',  // XLM per MXN
        offerId: '0',
      }),
    );
    const hash = await submitTx(server, builder, mxnDistKp);
    console.log(`    [XLM→MXN] Buy ${tier} MXN with XLM → TX: ${explorerLink(hash)}`);
    await sleep(4000);
  }

  // ── 2. USD / XLM tiered offers ──────────────────────────────────────────
  console.log('\n━━━  USD / XLM Offers (Distributor sells USD for XLM)');
  const usdCfg = XLM_OFFERS['USD'];
  for (const tier of usdCfg.tiers) {
    await placeOffer(server, usdDistKp, usdAsset, xlmAsset, tier, usdCfg.price, 'USD/XLM');
    await sleep(4000);
  }

  // Reverse: distributor buys USD with XLM
  console.log('\n  Reverse XLM→USD offers');
  for (const tier of usdCfg.tiers) {
    const account = await server.loadAccount(usdDistKp.publicKey());
    const builder = new TransactionBuilder(account, {
      fee: BASE_FEE,
      networkPassphrase: NETWORK_PASSPHRASE,
    }).addOperation(
      Operation.manageBuyOffer({
        selling: xlmAsset,
        buying:  usdAsset,
        buyAmount: tier,
        price: '10.000000',  // XLM per USD
        offerId: '0',
      }),
    );
    const hash = await submitTx(server, builder, usdDistKp);
    console.log(`    [XLM→USD] Buy ${tier} USD with XLM → TX: ${explorerLink(hash)}`);
    await sleep(4000);
  }

  // ── 3. GOLD / XLM tiered offers ─────────────────────────────────────────
  console.log('\n━━━  GOLD / XLM Offers (Distributor sells GOLD for XLM)');
  const goldCfg = XLM_OFFERS['GOLD'];
  for (const tier of goldCfg.tiers) {
    await placeOffer(server, goldDistKp, goldAsset, xlmAsset, tier, goldCfg.price, 'GOLD/XLM');
    await sleep(4000);
  }

  // Reverse: distributor buys GOLD with XLM
  console.log('\n  Reverse XLM→GOLD offers');
  for (const tier of goldCfg.tiers) {
    const account = await server.loadAccount(goldDistKp.publicKey());
    const builder = new TransactionBuilder(account, {
      fee: BASE_FEE,
      networkPassphrase: NETWORK_PASSPHRASE,
    }).addOperation(
      Operation.manageBuyOffer({
        selling: xlmAsset,
        buying:  goldAsset,
        buyAmount: tier,
        price: '200.00000',  // XLM per GOLD
        offerId: '0',
      }),
    );
    const hash = await submitTx(server, builder, goldDistKp);
    console.log(`    [XLM→GOLD] Buy ${tier} GOLD with XLM → TX: ${explorerLink(hash)}`);
    await sleep(4000);
  }

  // ── 4. USD / MXN direct cross-pair offers ───────────────────────────────
  // For this the USD distributor needs a MXN trustline first
  console.log('\n━━━  USD / MXN Direct Cross-Pair Offers');
  console.log('  Setting up MXN trustline on USD distributor…');

  try {
    const usdDistAccount = await server.loadAccount(usdDistKp.publicKey());
    const trustBuilder = new TransactionBuilder(usdDistAccount, {
      fee: BASE_FEE,
      networkPassphrase: NETWORK_PASSPHRASE,
    }).addOperation(
      Operation.changeTrust({ asset: mxnAsset, limit: '5000000' }),
    );
    const trustHash = await submitTx(server, trustBuilder, usdDistKp);
    console.log(`  MXN trustline on USD distributor → TX: ${explorerLink(trustHash)}`);
    await sleep(5000);

    // Now place USD→MXN tiered sell offers (selling USD for MXN)
    console.log('  Placing USD→MXN sell offers…');
    for (const tier of USD_MXN_OFFERS.tiers) {
      await placeOffer(
        server, usdDistKp, usdAsset, mxnAsset,
        tier, USD_MXN_OFFERS.price, 'USD/MXN direct',
      );
      await sleep(4000);
    }

    // Reverse: MXN distributor sells MXN for USD
    console.log('\n  Setting up USD trustline on MXN distributor…');
    const mxnDistAccount2 = await server.loadAccount(mxnDistKp.publicKey());
    const trustBuilder2 = new TransactionBuilder(mxnDistAccount2, {
      fee: BASE_FEE,
      networkPassphrase: NETWORK_PASSPHRASE,
    }).addOperation(
      Operation.changeTrust({ asset: usdAsset, limit: '1000000' }),
    );
    const trustHash2 = await submitTx(server, trustBuilder2, mxnDistKp);
    console.log(`  USD trustline on MXN distributor → TX: ${explorerLink(trustHash2)}`);
    await sleep(5000);

    // price for selling MXN for USD = 1/17 ≈ 0.0588235 USD per MXN
    console.log('  Placing MXN→USD reverse sell offers…');
    const mxnForUsdTiers = ['17000', '170000', '850000']; // MXN amounts
    for (const tier of mxnForUsdTiers) {
      await placeOffer(
        server, mxnDistKp, mxnAsset, usdAsset,
        tier, '0.0588235', 'MXN/USD direct',
      );
      await sleep(4000);
    }
  } catch (err) {
    console.warn(
      '  Warning: Failed to create direct USD/MXN cross-pair offers:',
      (err as Error).message,
    );
    console.warn('  Path payments via XLM will still work.');
  }

  // ── Summary ───────────────────────────────────────────────────────────────
  console.log('\n');
  console.log('╔══════════════════════════════════════════════════════╗');
  console.log('║  DEX Liquidity Created Successfully!                  ║');
  console.log('║                                                        ║');
  console.log('║  Liquidity pairs active:                               ║');
  console.log('║    MXN  ↔ XLM  (3 tiers each direction)              ║');
  console.log('║    USD  ↔ XLM  (3 tiers each direction)              ║');
  console.log('║    GOLD ↔ XLM  (3 tiers each direction)              ║');
  console.log('║    USD  ↔ MXN  (direct, 3 tiers)                     ║');
  console.log('║                                                        ║');
  console.log('║  Next: npm run verify                                  ║');
  console.log('╚══════════════════════════════════════════════════════╝');
}

main().catch(err => {
  console.error('\nFatal error in create-liquidity:', err);
  process.exit(1);
});
