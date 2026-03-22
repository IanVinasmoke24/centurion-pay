// SEP-7: web+stellar:pay?destination=...&amount=...&asset_code=...&memo=...

export function buildPaymentURI({
  destination,
  amount,
  assetCode,
  assetIssuer,
  memo,
  network_passphrase,
}: {
  destination: string
  amount: string
  assetCode?: string
  assetIssuer?: string
  memo?: string
  network_passphrase?: string
}): string {
  const params = new URLSearchParams()
  params.set('destination', destination)
  params.set('amount', amount)
  if (assetCode && assetCode !== 'XLM') {
    params.set('asset_code', assetCode)
    if (assetIssuer) params.set('asset_issuer', assetIssuer)
  }
  if (memo) params.set('memo', memo)
  if (network_passphrase) params.set('network_passphrase', network_passphrase)
  return `web+stellar:pay?${params.toString()}`
}

export interface ParsedPayment {
  destination: string
  amount?: string
  assetCode?: string
  assetIssuer?: string
  memo?: string
}

export function parsePaymentURI(uri: string): ParsedPayment | null {
  try {
    const trimmed = uri.trim()
    if (!trimmed.startsWith('web+stellar:pay?')) return null
    const queryString = trimmed.slice('web+stellar:pay?'.length)
    const params = new URLSearchParams(queryString)
    const destination = params.get('destination')
    if (!destination) return null
    return {
      destination,
      amount: params.get('amount') || undefined,
      assetCode: params.get('asset_code') || undefined,
      assetIssuer: params.get('asset_issuer') || undefined,
      memo: params.get('memo') || undefined,
    }
  } catch {
    return null
  }
}
