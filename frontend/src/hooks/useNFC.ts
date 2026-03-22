import { useCallback } from 'react'
import type { NFCPayload } from '../types/payment'

// Extend Window type for NDEFReader (WebNFC API - Chrome for Android only)
declare global {
  interface Window {
    NDEFReader?: new () => NDEFReaderInstance
  }
}

interface NDEFReadingEvent {
  message: {
    records: Array<{
      recordType: string
      data: DataView
      toText?: () => string
      encoding?: string
      lang?: string
    }>
  }
  serialNumber: string
}

interface NDEFReaderInstance {
  scan: (options?: { signal?: AbortSignal }) => Promise<void>
  write: (
    message: string | NDEFMessageInit,
    options?: { signal?: AbortSignal }
  ) => Promise<void>
  addEventListener: (
    type: 'reading' | 'readingerror',
    listener: (event: NDEFReadingEvent) => void
  ) => void
  removeEventListener: (
    type: 'reading' | 'readingerror',
    listener: (event: NDEFReadingEvent) => void
  ) => void
}

interface NDEFMessageInit {
  records: Array<{
    recordType: string
    data?: string | BufferSource
    mediaType?: string
    id?: string
    encoding?: string
    lang?: string
  }>
}

interface UseNFCResult {
  isSupported: boolean
  writePaymentTag: (payload: NFCPayload) => Promise<void>
  startReading: (onRead: (url: string) => void) => Promise<() => void>
}

const PAYMENT_BASE_URL = import.meta.env.VITE_PAYMENT_BASE_URL || 'https://pay.centurion.app'

export function useNFC(): UseNFCResult {
  const isSupported = typeof window !== 'undefined' && 'NDEFReader' in window

  const writePaymentTag = useCallback(async (payload: NFCPayload): Promise<void> => {
    if (!isSupported || !window.NDEFReader) {
      throw new Error(
        'WebNFC is not supported on this device. Please use Android Chrome.'
      )
    }

    const ndef = new window.NDEFReader()
    const controller = new AbortController()

    // Build payment URL: centurion://pay?token=...&merchant=...&amount=...
    const params = new URLSearchParams({
      token: payload.token,
      merchant: payload.merchant,
      amount: payload.amount
    })
    const paymentUrl = `${PAYMENT_BASE_URL}/pay?${params.toString()}`

    try {
      await ndef.write(
        {
          records: [
            {
              recordType: 'url',
              data: paymentUrl
            }
          ]
        },
        { signal: controller.signal }
      )
    } catch (err) {
      controller.abort()
      if (err instanceof Error) {
        if (err.name === 'AbortError') return
        throw new Error(`Failed to write NFC tag: ${err.message}`)
      }
      throw err
    }
  }, [isSupported])

  const startReading = useCallback(
    async (onRead: (url: string) => void): Promise<() => void> => {
      if (!isSupported || !window.NDEFReader) {
        throw new Error(
          'WebNFC is not supported on this device. Please use Android Chrome.'
        )
      }

      const ndef = new window.NDEFReader()
      const controller = new AbortController()

      const handleReading = (event: NDEFReadingEvent) => {
        for (const record of event.message.records) {
          if (record.recordType === 'url') {
            const decoder = new TextDecoder()
            const url = decoder.decode(record.data)
            onRead(url)
            break
          }
          // Also handle text records that might contain a URL
          if (record.recordType === 'text' && record.toText) {
            const text = record.toText()
            if (text.startsWith('http') || text.startsWith('centurion://')) {
              onRead(text)
              break
            }
          }
        }
      }

      const handleError = (event: NDEFReadingEvent) => {
        console.error('NFC reading error:', event)
      }

      ndef.addEventListener('reading', handleReading)
      ndef.addEventListener('readingerror', handleError)

      try {
        await ndef.scan({ signal: controller.signal })
      } catch (err) {
        if (err instanceof Error && err.name !== 'AbortError') {
          throw new Error(`Failed to start NFC scan: ${err.message}`)
        }
      }

      // Return cleanup function
      return () => {
        controller.abort()
        ndef.removeEventListener('reading', handleReading)
        ndef.removeEventListener('readingerror', handleError)
      }
    },
    [isSupported]
  )

  return { isSupported, writePaymentTag, startReading }
}
