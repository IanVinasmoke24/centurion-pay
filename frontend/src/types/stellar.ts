export interface AccountBalance {
  asset: string
  balance: string
  issuer?: string
}

export interface AccountInfo {
  address: string
  balances: AccountBalance[]
  sequence: string
}

export interface PaymentPath {
  sourceAmount: string
  sourceAsset: string
  path: Array<{ assetCode: string; assetIssuer: string }>
  destinationAmount: string
  destinationAsset: string
}

export interface StellarAsset {
  code: string
  issuer?: string
  isNative?: boolean
}

export interface TrustlineRequest {
  address: string
  assetCode: string
  assetIssuer: string
  limit?: string
}

export interface StellarTransaction {
  hash: string
  ledger: number
  createdAt: string
  sourceAccount: string
  fee: string
  operationCount: number
  successful: boolean
}

export interface PathFindResult {
  paths: PaymentPath[]
  bestPath?: PaymentPath
}
