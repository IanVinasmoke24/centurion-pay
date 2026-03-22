import { Asset, Networks } from '@stellar/stellar-sdk'

export const HORIZON_URL = 'https://horizon-testnet.stellar.org'
export const NETWORK = Networks.TESTNET
export const FRIENDBOT_URL = 'https://friendbot.stellar.org'

// USDC testnet issuer (official Circle testnet)
export const USDC_ISSUER = 'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5'

// Demo GOLD issuer - embedded for hackathon testnet demo only
// In production this key NEVER goes in the frontend
export const GOLD_ISSUER_SECRET = 'SCZANGBA5RLDSV7ZKPLACPJRNHPSO3GGWLOAH4UHCLA5SZSDP5FMPAKF'
export const GOLD_ISSUER_PUBLIC = 'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5'

export const ASSETS = {
  XLM: Asset.native(),
  USDC: new Asset('USDC', USDC_ISSUER),
  GOLD: new Asset('CGOLD', GOLD_ISSUER_PUBLIC),
}
