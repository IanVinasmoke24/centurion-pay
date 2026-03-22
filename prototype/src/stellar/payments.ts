import {
  Keypair,
  TransactionBuilder,
  Operation,
  Asset,
  Memo,
  BASE_FEE,
  Account,
} from '@stellar/stellar-sdk'
import { HORIZON_URL, NETWORK } from './config'

async function loadAccount(publicKey: string): Promise<Account> {
  const res = await fetch(`${HORIZON_URL}/accounts/${publicKey}`)
  if (!res.ok) throw new Error('Cuenta no encontrada en la red')
  const data = await res.json() as { account_id: string; sequence: string }
  return new Account(data.account_id, data.sequence)
}

export async function buildAndSubmitPayment({
  senderSecret,
  destination,
  amount,
  asset,
  memo,
}: {
  senderSecret: string
  destination: string
  amount: string
  asset: Asset
  memo?: string
}): Promise<string> {
  const kp = Keypair.fromSecret(senderSecret)
  const account = await loadAccount(kp.publicKey())

  const builder = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase: NETWORK,
  })

  builder.addOperation(
    Operation.payment({
      destination,
      asset,
      amount,
    })
  )

  if (memo) builder.addMemo(Memo.text(memo.substring(0, 28)))
  builder.setTimeout(30)

  const tx = builder.build()
  tx.sign(kp)

  const res = await fetch(`${HORIZON_URL}/transactions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ tx: tx.toXDR() }),
  })

  const result = await res.json() as { successful?: boolean; hash?: string; extras?: { result_codes?: { transaction?: string; operations?: string[] } } }
  if (result.successful === false) {
    const code = result.extras?.result_codes?.transaction || result.extras?.result_codes?.operations?.[0] || 'Transacción fallida'
    throw new Error(friendlyError(code))
  }
  return result.hash ?? ''
}

export async function buildAndSubmitPathPayment({
  senderSecret,
  destination,
  sendAsset,
  sendMax,
  destAsset,
  destAmount,
  path,
  memo,
}: {
  senderSecret: string
  destination: string
  sendAsset: Asset
  sendMax: string
  destAsset: Asset
  destAmount: string
  path: Asset[]
  memo?: string
}): Promise<string> {
  const kp = Keypair.fromSecret(senderSecret)
  const account = await loadAccount(kp.publicKey())

  const builder = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase: NETWORK,
  })

  builder.addOperation(
    Operation.pathPaymentStrictReceive({
      sendAsset,
      sendMax,
      destination,
      destAsset,
      destAmount,
      path,
    })
  )

  if (memo) builder.addMemo(Memo.text(memo.substring(0, 28)))
  builder.setTimeout(30)

  const tx = builder.build()
  tx.sign(kp)

  const res = await fetch(`${HORIZON_URL}/transactions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ tx: tx.toXDR() }),
  })

  const result = await res.json() as { successful?: boolean; hash?: string; extras?: { result_codes?: { transaction?: string; operations?: string[] } } }
  if (result.successful === false) {
    const code = result.extras?.result_codes?.transaction || result.extras?.result_codes?.operations?.[0] || 'Transacción fallida'
    throw new Error(friendlyError(code))
  }
  return result.hash ?? ''
}

export async function setupTrustlines(senderSecret: string, assets: Asset[]): Promise<string> {
  const kp = Keypair.fromSecret(senderSecret)
  const account = await loadAccount(kp.publicKey())

  const builder = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase: NETWORK,
  })

  assets.forEach(asset => {
    builder.addOperation(Operation.changeTrust({ asset, limit: '1000000' }))
  })

  builder.setTimeout(30)
  const tx = builder.build()
  tx.sign(kp)

  const res = await fetch(`${HORIZON_URL}/transactions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ tx: tx.toXDR() }),
  })

  const result = await res.json() as { successful?: boolean; hash?: string; extras?: { result_codes?: { transaction?: string } } }
  if (result.successful === false) throw new Error('Error configurando trustlines')
  return result.hash ?? ''
}

function friendlyError(code: string): string {
  const map: Record<string, string> = {
    'tx_insufficient_balance': 'Saldo insuficiente para cubrir la transacción y la comisión',
    'op_underfunded': 'Saldo insuficiente en la cuenta',
    'op_no_destination': 'La cuenta destino no existe en la red',
    'op_no_trust': 'El destino no tiene trustline para este activo',
    'op_line_full': 'La cuenta destino ha alcanzado su límite de trustline',
    'op_no_issuer': 'El emisor del activo no existe',
    'tx_bad_seq': 'Error de secuencia, por favor intenta de nuevo',
    'op_too_few_offers': 'No hay suficiente liquidez en el DEX para esta ruta',
  }
  return map[code] || `Error: ${code}`
}
