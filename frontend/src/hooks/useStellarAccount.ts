import { useState, useEffect, useCallback, useRef } from 'react'
import type { AccountBalance } from '../types/stellar'
import { getAccount } from '../config/api'

interface UseStellarAccountResult {
  balances: AccountBalance[]
  isLoading: boolean
  error: string | null
  refetch: () => Promise<void>
}

const POLL_INTERVAL_MS = 10_000

export function useStellarAccount(address: string | null): UseStellarAccountResult {
  const [balances, setBalances] = useState<AccountBalance[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const isMountedRef = useRef(true)

  const fetchData = useCallback(async () => {
    if (!address) return

    setIsLoading(true)
    setError(null)

    try {
      const info = await getAccount(address)
      if (isMountedRef.current) {
        setBalances(info.balances)
      }
    } catch (err) {
      if (isMountedRef.current) {
        const message =
          err instanceof Error ? err.message : 'Failed to fetch account'
        setError(message)
      }
    } finally {
      if (isMountedRef.current) {
        setIsLoading(false)
      }
    }
  }, [address])

  useEffect(() => {
    isMountedRef.current = true

    if (!address) {
      setBalances([])
      setError(null)
      return
    }

    fetchData()

    intervalRef.current = setInterval(fetchData, POLL_INTERVAL_MS)

    return () => {
      isMountedRef.current = false
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
    }
  }, [address, fetchData])

  return { balances, isLoading, error, refetch: fetchData }
}
