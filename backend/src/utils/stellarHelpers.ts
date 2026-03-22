import { Memo, StrKey } from '@stellar/stellar-sdk';

const STROOPS_PER_XLM = 10_000_000;

export function stroopsToXLM(stroops: string | number): string {
  const val = typeof stroops === 'string' ? parseInt(stroops, 10) : stroops;
  return (val / STROOPS_PER_XLM).toFixed(7);
}

export function xlmToStroops(xlm: string | number): string {
  const val = typeof xlm === 'string' ? parseFloat(xlm) : xlm;
  return Math.round(val * STROOPS_PER_XLM).toString();
}

export function formatAmount(amount: string, decimals: number): string {
  const parsed = parseFloat(amount);
  if (isNaN(parsed)) return '0';
  return parsed.toFixed(decimals);
}

export function isValidStellarAddress(address: string): boolean {
  try {
    return StrKey.isValidEd25519PublicKey(address);
  } catch {
    return false;
  }
}

export function decodeMemo(memo: Memo): string | null {
  switch (memo.type) {
    case 'text':
      return typeof memo.value === 'string'
        ? memo.value
        : memo.value?.toString('utf-8') ?? null;
    case 'id':
      return memo.value?.toString() ?? null;
    case 'hash':
    case 'return':
      return memo.value
        ? Buffer.from(memo.value as Buffer).toString('hex')
        : null;
    case 'none':
    default:
      return null;
  }
}

export function truncateAddress(address: string, chars = 6): string {
  if (address.length <= chars * 2 + 3) return address;
  return `${address.slice(0, chars)}...${address.slice(-chars)}`;
}

export function parseAssetString(assetString: string): {
  code: string;
  issuer?: string;
} {
  if (assetString === 'XLM' || assetString === 'native') {
    return { code: 'XLM' };
  }
  const parts = assetString.split(':');
  return { code: parts[0], issuer: parts[1] };
}
