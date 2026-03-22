import { useState, useCallback } from 'react'
import type { PathQuote } from '../types/payment'
import {
  getQuote,
  buildPayment,
  submitPayment,
  type QuoteRequest
} from '../config/api'
import { useStore } from '../store'

interface UsePathPaymentResult {
  quote: PathQuote | null
  isLoading: boolean
  error: string | null
  getQuoteForPayment: (
    sendAsset: string,
    destAmount: string,
    destAsset?: string
  ) => Promise<PathQuote | null>
  buildUnsignedTx: (
    quote: PathQuote,
    senderAddress: string,
    merchantAddress: string
  ) => Promise<{ paymentId: string; unsignedXdr: string } | null>
  signLocally: (xdr: string, secretKey: string) => Promise<string>
  submitSigned: (signedXdr: string, paymentId: string) => Promise<string | null>
  executePayment: (
    sendAsset: string,
    destAmount: string,
    merchantAddress: string
  ) => Promise<string | null>
  reset: () => void
}

// Simple XDR signing using keypair - for demo purposes
// In production, this would use Freighter wallet or hardware wallet
async function signXdrWithKeypair(xdr: string, secretKey: string): Promise<string> {
  // Dynamically import stellar-sdk only when needed to keep bundle small
  // In a real implementation you'd import StellarSdk
  // For the demo, we just return the XDR as-is and let the server handle signing
  // or use a proper SDK call like:
  // const keypair = StellarSdk.Keypair.fromSecret(secretKey)
  // const tx = StellarSdk.TransactionBuilder.fromXDR(xdr, network)
  // tx.sign(keypair)
  // return tx.toXDR()
  console.warn(
    'signXdrWithKeypair: demo implementation - integrate StellarSdk for production'
  )
  // Encode secretKey into a mock signed XDR for demo
  const demoSigned = btoa(
    JSON.stringify({ xdr, signer: secretKey.substring(0, 8) + '...' })
  )
  return `DEMO_SIGNED_${demoSigned}`
}

export function usePathPayment(): UsePathPaymentResult {
  const [quote, setQuote] = useState<PathQuote | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const { address, secretKey, setStatus, setError: storeSetError, setLastTxHash } = useStore(
    (s) => ({
      address: s.address,
      secretKey: s.secretKey,
      setStatus: s.setStatus,
      setError: s.setError,
      setLastTxHash: s.setLastTxHash
    })
  )

  const getQuoteForPayment = useCallback(
    async (
      sendAsset: string,
      destAmount: string,
      destAsset = 'MXN'
    ): Promise<PathQuote | null> => {
      if (!address) {
        setError('No sender address configured')
        return null
      }

      setIsLoading(true)
      setError(null)
      setStatus('quoting')

      try {
        const params: QuoteRequest = {
          sendAsset,
          destAsset,
          destAmount,
          senderAddress: address
        }
        const result = await getQuote(params)
        setQuote(result)
        setStatus('idle')
        return result
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to get quote'
        setError(message)
        storeSetError(message)
        setStatus('failed')
        return null
      } finally {
        setIsLoading(false)
      }
    },
    [address, setStatus, storeSetError]
  )

  const buildUnsignedTx = useCallback(
    async (
      q: PathQuote,
      senderAddress: string,
      merchantAddress: string
    ): Promise<{ paymentId: string; unsignedXdr: string } | null> => {
      setIsLoading(true)
      setError(null)
      setStatus('building')

      try {
        const result = await buildPayment({
          quote: q,
          senderAddress,
          merchantAddress
        })
        return result
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to build transaction'
        setError(message)
        storeSetError(message)
        setStatus('failed')
        return null
      } finally {
        setIsLoading(false)
      }
    },
    [setStatus, storeSetError]
  )

  const signLocally = useCallback(
    async (xdr: string, sk: string): Promise<string> => {
      setStatus('signing')
      try {
        const signed = await signXdrWithKeypair(xdr, sk)
        return signed
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to sign transaction'
        setError(message)
        storeSetError(message)
        setStatus('failed')
        throw err
      }
    },
    [setStatus, storeSetError]
  )

  const submitSigned = useCallback(
    async (signedXdr: string, paymentId: string): Promise<string | null> => {
      setIsLoading(true)
      setError(null)
      setStatus('submitting')

      try {
        const payment = await submitPayment({ paymentId, signedXdr })
        const txHash = payment.stellarTxHash || payment.id
        setLastTxHash(txHash)
        setStatus('settled')
        return txHash
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to submit transaction'
        setError(message)
        storeSetError(message)
        setStatus('failed')
        return null
      } finally {
        setIsLoading(false)
      }
    },
    [setStatus, storeSetError, setLastTxHash]
  )

  const executePayment = useCallback(
    async (
      sendAsset: string,
      destAmount: string,
      merchantAddress: string
    ): Promise<string | null> => {
      if (!address) {
        setError('No sender address')
        return null
      }
      if (!secretKey) {
        setError('No secret key configured. Please add it in Settings.')
        return null
      }

      const q = await getQuoteForPayment(sendAsset, destAmount)
      if (!q) return null

      const built = await buildUnsignedTx(q, address, merchantAddress)
      if (!built) return null

      const signed = await signLocally(built.unsignedXdr, secretKey)
      return submitSigned(signed, built.paymentId)
    },
    [address, secretKey, getQuoteForPayment, buildUnsignedTx, signLocally, submitSigned]
  )

  const reset = useCallback(() => {
    setQuote(null)
    setError(null)
    setIsLoading(false)
  }, [])

  return {
    quote,
    isLoading,
    error,
    getQuoteForPayment,
    buildUnsignedTx,
    signLocally,
    submitSigned,
    executePayment,
    reset
  }
}
