import { Asset } from '@stellar/stellar-sdk';
import { config } from '../config/env';

export type AssetCode = 'MXN' | 'USD' | 'GOLD' | 'XLM';

export const NATIVE = Asset.native();

function getMXNAsset(): Asset {
  if (!config.MXN_ISSUER_PUBLIC) {
    throw new Error('MXN_ISSUER_PUBLIC is not configured');
  }
  return new Asset('MXN', config.MXN_ISSUER_PUBLIC);
}

function getUSDAsset(): Asset {
  if (!config.USD_ISSUER_PUBLIC) {
    throw new Error('USD_ISSUER_PUBLIC is not configured');
  }
  return new Asset('USD', config.USD_ISSUER_PUBLIC);
}

function getGOLDAsset(): Asset {
  if (!config.GOLD_ISSUER_PUBLIC) {
    throw new Error('GOLD_ISSUER_PUBLIC is not configured');
  }
  return new Asset('GOLD', config.GOLD_ISSUER_PUBLIC);
}

export function getAsset(code: AssetCode): Asset {
  switch (code) {
    case 'XLM':
      return NATIVE;
    case 'MXN':
      return getMXNAsset();
    case 'USD':
      return getUSDAsset();
    case 'GOLD':
      return getGOLDAsset();
  }
}

export const assetDefinitions = {
  get MXN() {
    return getMXNAsset();
  },
  get USD() {
    return getUSDAsset();
  },
  get GOLD() {
    return getGOLDAsset();
  },
  XLM: NATIVE,
};
