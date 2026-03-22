import { Horizon, Networks } from '@stellar/stellar-sdk';
import { config } from './env';

export function getHorizonServer(): Horizon.Server {
  const url =
    config.STELLAR_NETWORK === 'mainnet'
      ? config.HORIZON_MAINNET_URL
      : config.HORIZON_TESTNET_URL;
  return new Horizon.Server(url);
}

export function getNetworkPassphrase(): string {
  return config.STELLAR_NETWORK === 'mainnet'
    ? Networks.PUBLIC
    : Networks.TESTNET;
}

export const HORIZON_URL =
  config.STELLAR_NETWORK === 'mainnet'
    ? config.HORIZON_MAINNET_URL
    : config.HORIZON_TESTNET_URL;
