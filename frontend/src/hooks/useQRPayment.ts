import { useState, useCallback, useRef, useEffect } from 'react'
import type { QRSession } from '../types/payment'
import { createQRSession, getQRStatus, type CreateQRRequest } from '../config/api'

const POLL_INTERVAL_MS = 2_000
const TERMINAL_STATUSES: QRSession['status'][] = ['SETTLED', 'EXPIRED']

interface UseQRPaymentResult {
  session: QRSession | null
  status: QRSession['status'] | null
  isPolling: boolean
  error: string | null
  createSession: (merchantAddress: string, amountMxn: string) => Promise<QRSession | null>
  pollStatus: (token: string) => void
  cancelPolling: () => void
  reset: () => void
}

export function useQRPayment(): UseQRPaymentResult {
  const [session, setSession] = useState<QRSession | null>(null)
  const [status, setStatus] = useState<QRSession['status'] | null>(null)
  const [isPolling, setIsPolling] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const isMountedRef = useRef(true)
  const currentTokenRef = useRef<string | null>(null)

  useEffect(() => {
    isMountedRef.current = true
    return () => {
      isMountedRef.current = false
      cancelPollingInternal()
    }
  }, [])

  function cancelPollingInternal() {
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
  }

  const cancelPolling = useCallback(() => {
    cancelPollingInternal()
    if (isMountedRef.current) {
      setIsPolling(false)
    }
  }, [])

  const pollStatus = useCallback((token: string) => {
    // Cancel any existing poll
    cancelPollingInternal()
    currentTokenRef.current = token

    if (isMountedRef.current) {
      setIsPolling(true)
      setError(null)
    }

    const poll = async () => {
      if (!currentTokenRef.current) return

      try {
        const updated = await getQRStatus(currentTokenRef.current)

        if (!isMountedRef.current) return

        setSession(updated)
        setStatus(updated.status)

        // Stop polling on terminal status
        if (TERMINAL_STATUSES.includes(updated.status)) {
          cancelPollingInternal()
          setIsPolling(false)
        }
      } catch (err) {
        if (!isMountedRef.current) return
        const message = err instanceof Error ? err.message : 'Polling error'
        setError(message)
        // Don't stop polling on transient errors, but stop after too many
      }
    }

    // Immediate first poll
    poll()
    intervalRef.current = setInterval(poll, POLL_INTERVAL_MS)
  }, [])

  const createSession = useCallback(
    async (merchantAddress: string, amountMxn: string): Promise<QRSession | null> => {
      setError(null)

      const params: CreateQRRequest = { merchantAddress, amountMxn }

      try {
        const newSession = await createQRSession(params)

        if (isMountedRef.current) {
          setSession(newSession)
          setStatus(newSession.status)
        }

        // Automatically start polling
        pollStatus(newSession.token)

        return newSession
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'Failed to create QR session'
        if (isMountedRef.current) {
          setError(message)
        }
        return null
      }
    },
    [pollStatus]
  )

  const reset = useCallback(() => {
    cancelPollingInternal()
    if (isMountedRef.current) {
      setSession(null)
      setStatus(null)
      setIsPolling(false)
      setError(null)
    }
    currentTokenRef.current = null
  }, [])

  return {
    session,
    status,
    isPolling,
    error,
    createSession,
    pollStatus,
    cancelPolling,
    reset
  }
}
