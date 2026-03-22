import { Keypair } from '@stellar/stellar-sdk'

const KEY_STORAGE = 'centurion_keypair'

export function generateWallet(): { publicKey: string; secretKey: string } {
  const kp = Keypair.random()
  const wallet = { publicKey: kp.publicKey(), secretKey: kp.secret() }
  localStorage.setItem(KEY_STORAGE, JSON.stringify(wallet))
  return wallet
}

export function loadWallet(): { publicKey: string; secretKey: string } | null {
  const raw = localStorage.getItem(KEY_STORAGE)
  if (!raw) return null
  try {
    return JSON.parse(raw)
  } catch {
    return null
  }
}

export function importWallet(secret: string): { publicKey: string; secretKey: string } | null {
  try {
    const kp = Keypair.fromSecret(secret.trim())
    const wallet = { publicKey: kp.publicKey(), secretKey: kp.secret() }
    localStorage.setItem(KEY_STORAGE, JSON.stringify(wallet))
    return wallet
  } catch {
    return null
  }
}

export function clearWallet(): void {
  localStorage.removeItem(KEY_STORAGE)
}
