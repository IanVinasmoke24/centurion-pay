import {
  Asset,
  Keypair,
  Operation,
  TransactionBuilder,
  BASE_FEE,
} from '@stellar/stellar-sdk';
import { getHorizonServer, getNetworkPassphrase } from '../config/stellar';
import { logger } from '../utils/logger';

export async function createTrustline(
  accountKeypair: Keypair,
  asset: Asset
): Promise<string> {
  const server = getHorizonServer();
  const networkPassphrase = getNetworkPassphrase();
  const account = await server.loadAccount(accountKeypair.publicKey());

  const tx = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase,
  })
    .addOperation(
      Operation.changeTrust({
        asset,
        limit: '999999999',
      })
    )
    .setTimeout(30)
    .build();

  tx.sign(accountKeypair);
  const result = await server.submitTransaction(tx);

  logger.info('Trustline created', {
    account: accountKeypair.publicKey(),
    asset: `${asset.getCode()}:${asset.getIssuer()}`,
    hash: result.hash,
  });

  return result.hash;
}

export async function issueAsset(
  issuerKeypair: Keypair,
  distributorKeypair: Keypair,
  assetCode: string,
  amount: string
): Promise<{ trustlineHash: string; paymentHash: string }> {
  const server = getHorizonServer();
  const networkPassphrase = getNetworkPassphrase();
  const asset = new Asset(assetCode, issuerKeypair.publicKey());

  // Step 1: Distributor creates trustline for the asset
  const trustlineHash = await createTrustline(distributorKeypair, asset);

  // Step 2: Issuer sends asset to distributor
  const issuerAccount = await server.loadAccount(issuerKeypair.publicKey());

  const paymentTx = new TransactionBuilder(issuerAccount, {
    fee: BASE_FEE,
    networkPassphrase,
  })
    .addOperation(
      Operation.payment({
        destination: distributorKeypair.publicKey(),
        asset,
        amount,
      })
    )
    .setTimeout(30)
    .build();

  paymentTx.sign(issuerKeypair);
  const paymentResult = await server.submitTransaction(paymentTx);

  logger.info('Asset issued', {
    assetCode,
    issuer: issuerKeypair.publicKey(),
    distributor: distributorKeypair.publicKey(),
    amount,
    paymentHash: paymentResult.hash,
  });

  return {
    trustlineHash,
    paymentHash: paymentResult.hash,
  };
}

export async function createDEXOffer(
  distributorKeypair: Keypair,
  sellAsset: Asset,
  buyAsset: Asset,
  price: string,
  amount: string
): Promise<string> {
  const server = getHorizonServer();
  const networkPassphrase = getNetworkPassphrase();
  const account = await server.loadAccount(distributorKeypair.publicKey());

  const tx = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase,
  })
    .addOperation(
      Operation.manageSellOffer({
        selling: sellAsset,
        buying: buyAsset,
        amount,
        price,
        offerId: 0,
      })
    )
    .setTimeout(30)
    .build();

  tx.sign(distributorKeypair);
  const result = await server.submitTransaction(tx);

  logger.info('DEX offer created', {
    distributor: distributorKeypair.publicKey(),
    sellAsset: sellAsset.getCode(),
    buyAsset: buyAsset.getCode(),
    price,
    amount,
    hash: result.hash,
  });

  return result.hash;
}

export async function setHomeDomain(
  issuerKeypair: Keypair,
  homeDomain: string
): Promise<string> {
  const server = getHorizonServer();
  const networkPassphrase = getNetworkPassphrase();
  const account = await server.loadAccount(issuerKeypair.publicKey());

  const tx = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase,
  })
    .addOperation(
      Operation.setOptions({
        homeDomain,
      })
    )
    .setTimeout(30)
    .build();

  tx.sign(issuerKeypair);
  const result = await server.submitTransaction(tx);

  logger.info('Home domain set', {
    issuer: issuerKeypair.publicKey(),
    homeDomain,
    hash: result.hash,
  });

  return result.hash;
}
