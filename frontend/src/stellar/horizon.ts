import { HORIZON_URL, FRIENDBOT_URL } from './config'

export interface Balance {
  asset: string
  code: string
  amount: number
  issuer?: string
}

export interface StellarTransaction {
  id: string
  type: 'sent' | 'received' | 'path_payment'
  amount: number
  asset: string
  from: string
  to: string
  memo?: string
  createdAt: string
  hash: string
  path: string[]
}

export async function fundViaFriendbot(publicKey: string): Promise<void> {
  const res = await fetch(`${FRIENDBOT_URL}?addr=${publicKey}`)
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    const detail = (body as { detail?: string }).detail || 'Friendbot falló'
    throw new Error(detail)
  }
}

export async function getAccount(publicKey: string): Promise<Record<string, unknown>> {
  const res = await fetch(`${HORIZON_URL}/accounts/${publicKey}`)
  if (!res.ok) throw new Error('Cuenta no encontrada')
  return res.json()
}

export async function getBalances(publicKey: string): Promise<Balance[]> {
  try {
    const account = await getAccount(publicKey)
    const balances = account.balances as Array<{
      asset_type: string
      asset_code?: string
      asset_issuer?: string
      balance: string
    }>
    return balances.map(b => ({
      asset: b.asset_type === 'native' ? 'XLM' : `${b.asset_code}:${b.asset_issuer}`,
      code: b.asset_type === 'native' ? 'XLM' : (b.asset_code ?? ''),
      amount: parseFloat(b.balance),
      issuer: b.asset_issuer,
    }))
  } catch {
    return []
  }
}

export async function findPaths(
  sourceAccount: string,
  destAmount: string,
  destAssetCode: string,
  destAssetIssuer: string | null
): Promise<unknown[]> {
  const destParam =
    destAssetCode === 'XLM'
      ? 'destination_asset_type=native'
      : `destination_asset_type=credit_alphanum4&destination_asset_code=${destAssetCode}&destination_asset_issuer=${destAssetIssuer}`
  const url = `${HORIZON_URL}/paths/strict-receive?${destParam}&destination_amount=${destAmount}&source_account=${sourceAccount}`
  try {
    const res = await fetch(url)
    if (!res.ok) return []
    const data = await res.json() as { _embedded?: { records?: unknown[] } }
    return data._embedded?.records || []
  } catch {
    return []
  }
}

export async function getTransactions(publicKey: string, limit = 20): Promise<StellarTransaction[]> {
  try {
    const res = await fetch(
      `${HORIZON_URL}/accounts/${publicKey}/payments?limit=${limit}&order=desc`
    )
    if (!res.ok) return []
    const data = await res.json() as {
      _embedded?: {
        records?: Array<{
          id: string
          type: string
          amount?: string
          destination_amount?: string
          asset_code?: string
          from?: string
          to?: string
          source_account?: string
          account?: string
          created_at: string
          transaction_hash: string
          path?: Array<{ asset_code?: string }>
        }>
      }
    }
    return (data._embedded?.records || []).map(r => ({
      id: r.id,
      type:
        r.type === 'path_payment_strict_receive'
          ? 'path_payment'
          : (r.from === publicKey || r.source_account === publicKey)
          ? 'sent'
          : 'received',
      amount: parseFloat(r.amount || r.destination_amount || '0'),
      asset: r.asset_code || 'XLM',
      from: r.from || r.source_account || '',
      to: r.to || r.account || '',
      createdAt: r.created_at,
      hash: r.transaction_hash,
      path: (r.path || []).map(p => p.asset_code || 'XLM'),
    }))
  } catch {
    return []
  }
}

export async function getRecentPayments(
  publicKey: string,
  limit = 5
): Promise<Array<{ id: string; amount: string; asset_code?: string; from?: string; transaction_hash: string; created_at: string }>> {
  try {
    const res = await fetch(
      `${HORIZON_URL}/accounts/${publicKey}/payments?limit=${limit}&order=desc`
    )
    if (!res.ok) return []
    const data = await res.json() as { _embedded?: { records?: unknown[] } }
    return (data._embedded?.records || []) as Array<{ id: string; amount: string; asset_code?: string; from?: string; transaction_hash: string; created_at: string }>
  } catch {
    return []
  }
}

export async function getLatestLedger(): Promise<number> {
  try {
    const res = await fetch(`${HORIZON_URL}/ledgers?order=desc&limit=1`)
    if (!res.ok) return 0
    const data = await res.json() as { _embedded?: { records?: Array<{ sequence: number }> } }
    return data._embedded?.records?.[0]?.sequence || 0
  } catch {
    return 0
  }
}

// Stream incoming payments in real-time via Horizon SSE
// Returns a cleanup function to close the stream
export function streamPayments(publicKey: string, onPayment: () => void): () => void {
  const url = `${HORIZON_URL}/accounts/${publicKey}/payments?cursor=now`
  const es = new EventSource(url)
  es.onmessage = () => onPayment()
  es.onerror = () => {} // silently reconnect
  return () => es.close()
}
