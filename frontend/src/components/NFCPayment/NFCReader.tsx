import React, { useState, useEffect, useRef, CSSProperties } from 'react'
import { useNFC } from '../../hooks/useNFC'

interface NFCReaderProps {
  onPaymentDetected: (token: string, merchant: string, amount: string) => void
  onError?: (error: string) => void
  onClose?: () => void
}

const THEME = {
  card: '#1a1a2e',
  primary: '#4f46e5',
  gold: '#f59e0b',
  success: '#10b981',
  error: '#ef4444',
  text: '#e2e8f0',
  muted: '#64748b'
}

type ReaderState = 'idle' | 'scanning' | 'detected' | 'error'

function parsePaymentUrl(url: string): { token: string; merchant: string; amount: string } | null {
  try {
    const parsed = new URL(url)
    const token = parsed.searchParams.get('token')
    const merchant = parsed.searchParams.get('merchant')
    const amount = parsed.searchParams.get('amount')
    if (token && merchant && amount) return { token, merchant, amount }
    return null
  } catch {
    return null
  }
}

export const NFCReader: React.FC<NFCReaderProps> = ({
  onPaymentDetected,
  onError,
  onClose
}) => {
  const { isSupported, startReading } = useNFC()
  const [state, setState] = useState<ReaderState>('idle')
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const cleanupRef = useRef<(() => void) | null>(null)

  useEffect(() => {
    return () => {
      if (cleanupRef.current) cleanupRef.current()
    }
  }, [])

  const handleStartScan = async () => {
    setState('scanning')
    setErrorMsg(null)

    try {
      const cleanup = await startReading((url: string) => {
        const payment = parsePaymentUrl(url)
        if (payment) {
          setState('detected')
          if (cleanupRef.current) cleanupRef.current()
          onPaymentDetected(payment.token, payment.merchant, payment.amount)
        } else {
          setState('error')
          setErrorMsg('Invalid payment tag. Please try a Centurion NFC tag.')
        }
      })
      cleanupRef.current = cleanup
    } catch (err) {
      const message = err instanceof Error ? err.message : 'NFC scan failed'
      setState('error')
      setErrorMsg(message)
      if (onError) onError(message)
    }
  }

  const handleCancel = () => {
    if (cleanupRef.current) {
      cleanupRef.current()
      cleanupRef.current = null
    }
    setState('idle')
  }

  const containerStyle: CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 24,
    padding: 32,
    background: THEME.card,
    borderRadius: 20,
    border: `1px solid ${THEME.primary}40`,
    maxWidth: 380,
    width: '100%',
    margin: '0 auto'
  }

  if (!isSupported) {
    return (
      <div style={containerStyle}>
        <div style={{ fontSize: 48 }}>📵</div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 18, fontWeight: 700, color: THEME.text }}>
            NFC Not Supported
          </div>
          <div style={{ fontSize: 14, color: THEME.muted, marginTop: 8, lineHeight: 1.6 }}>
            WebNFC is only available on Android devices using Chrome. Please use the
            QR scanner instead.
          </div>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            style={{
              background: THEME.primary,
              color: '#fff',
              border: 'none',
              borderRadius: 12,
              padding: '14px 28px',
              fontSize: 15,
              fontWeight: 600,
              cursor: 'pointer',
              width: '100%'
            }}
          >
            Use QR Instead
          </button>
        )}
      </div>
    )
  }

  return (
    <div style={containerStyle}>
      {/* Title */}
      <div style={{ textAlign: 'center', width: '100%' }}>
        <div
          style={{
            fontSize: 20,
            fontWeight: 700,
            color: THEME.text
          }}
        >
          NFC Payment
        </div>
        <div style={{ fontSize: 13, color: THEME.muted, marginTop: 4 }}>
          Customer side
        </div>
      </div>

      {/* Animation area */}
      <div
        style={{
          position: 'relative',
          width: 180,
          height: 180,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}
      >
        {state === 'scanning' && (
          <>
            <style>{`
              @keyframes nfcPulse {
                0% { transform: scale(1); opacity: 0.6; }
                50% { transform: scale(1.3); opacity: 0.2; }
                100% { transform: scale(1); opacity: 0.6; }
              }
              @keyframes nfcRing {
                0% { transform: scale(0.8); opacity: 0.8; }
                100% { transform: scale(1.8); opacity: 0; }
              }
            `}</style>
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                style={{
                  position: 'absolute',
                  width: 90,
                  height: 90,
                  borderRadius: '50%',
                  border: `2px solid ${THEME.primary}`,
                  animation: `nfcRing 2s ease-out infinite`,
                  animationDelay: `${i * 0.6}s`
                }}
              />
            ))}
          </>
        )}

        <div
          style={{
            width: 110,
            height: 110,
            borderRadius: '50%',
            background:
              state === 'detected'
                ? `${THEME.success}20`
                : state === 'error'
                ? `${THEME.error}20`
                : `${THEME.primary}20`,
            border: `3px solid ${
              state === 'detected'
                ? THEME.success
                : state === 'error'
                ? THEME.error
                : THEME.primary
            }`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 50,
            zIndex: 1,
            transition: 'all 0.4s ease'
          }}
        >
          {state === 'detected'
            ? '✓'
            : state === 'error'
            ? '✕'
            : state === 'scanning'
            ? '📡'
            : '📳'}
        </div>
      </div>

      {/* Instruction text */}
      <div style={{ textAlign: 'center' }}>
        {state === 'idle' && (
          <>
            <div style={{ fontSize: 20, fontWeight: 700, color: THEME.text }}>
              Tap Your Phone to Pay
            </div>
            <div style={{ fontSize: 14, color: THEME.muted, marginTop: 8 }}>
              Hold your phone near the merchant's NFC tag to complete payment
            </div>
          </>
        )}
        {state === 'scanning' && (
          <>
            <div style={{ fontSize: 18, fontWeight: 600, color: THEME.primary }}>
              Ready to Scan
            </div>
            <div style={{ fontSize: 14, color: THEME.muted, marginTop: 6 }}>
              Tap your phone against the merchant's device or NFC tag
            </div>
          </>
        )}
        {state === 'detected' && (
          <div style={{ fontSize: 17, fontWeight: 600, color: THEME.success }}>
            Payment tag detected! Processing...
          </div>
        )}
        {state === 'error' && (
          <div style={{ fontSize: 14, color: THEME.error }}>
            {errorMsg || 'Could not read NFC tag'}
          </div>
        )}
      </div>

      {/* Action buttons */}
      {state === 'idle' && (
        <button
          onClick={handleStartScan}
          style={{
            background: `linear-gradient(135deg, ${THEME.primary}, #7c3aed)`,
            color: '#fff',
            border: 'none',
            borderRadius: 14,
            padding: '16px 32px',
            fontSize: 16,
            fontWeight: 700,
            cursor: 'pointer',
            width: '100%',
            boxShadow: `0 4px 20px ${THEME.primary}40`
          }}
        >
          Start NFC Scan
        </button>
      )}

      {state === 'scanning' && (
        <button
          onClick={handleCancel}
          style={{
            background: 'transparent',
            color: THEME.muted,
            border: `1px solid ${THEME.muted}40`,
            borderRadius: 12,
            padding: '14px 28px',
            fontSize: 14,
            cursor: 'pointer',
            width: '100%'
          }}
        >
          Cancel
        </button>
      )}

      {state === 'error' && (
        <button
          onClick={() => setState('idle')}
          style={{
            background: THEME.primary,
            color: '#fff',
            border: 'none',
            borderRadius: 12,
            padding: '14px 28px',
            fontSize: 15,
            fontWeight: 600,
            cursor: 'pointer',
            width: '100%'
          }}
        >
          Try Again
        </button>
      )}
    </div>
  )
}

export default NFCReader
