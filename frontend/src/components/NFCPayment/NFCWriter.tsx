import React, { useState, CSSProperties } from 'react'
import { useNFC } from '../../hooks/useNFC'
import type { NFCPayload } from '../../types/payment'
import type { QRSession } from '../../types/payment'
import { QRDisplay } from '../QRDisplay/QRDisplay'

interface NFCWriterProps {
  payload: NFCPayload
  session?: QRSession
  onSuccess?: () => void
  onError?: (error: string) => void
}

const THEME = {
  bg: '#0a0a1a',
  card: '#1a1a2e',
  primary: '#4f46e5',
  gold: '#f59e0b',
  success: '#10b981',
  error: '#ef4444',
  text: '#e2e8f0',
  muted: '#64748b'
}

type WriterState = 'idle' | 'waiting' | 'writing' | 'success' | 'error'

export const NFCWriter: React.FC<NFCWriterProps> = ({
  payload,
  session,
  onSuccess,
  onError
}) => {
  const { isSupported, writePaymentTag } = useNFC()
  const [state, setState] = useState<WriterState>('idle')
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const handleTapToReceive = async () => {
    setState('waiting')
    setErrorMsg(null)
    try {
      setState('writing')
      await writePaymentTag(payload)
      setState('success')
      if (onSuccess) onSuccess()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'NFC write failed'
      setState('error')
      setErrorMsg(message)
      if (onError) onError(message)
    }
  }

  const containerStyle: CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 24,
    padding: 28,
    background: THEME.card,
    borderRadius: 20,
    border: `1px solid ${THEME.primary}40`,
    maxWidth: 380,
    width: '100%',
    margin: '0 auto'
  }

  // Fallback to QR if NFC not supported
  if (!isSupported) {
    return (
      <div style={{ width: '100%' }}>
        <div
          style={{
            textAlign: 'center',
            padding: '12px 16px',
            background: `${THEME.gold}15`,
            borderRadius: 12,
            border: `1px solid ${THEME.gold}40`,
            color: THEME.gold,
            fontSize: 13,
            marginBottom: 16
          }}
        >
          NFC not available on this device. Showing QR code instead.
        </div>
        {session && <QRDisplay session={session} onSettled={onSuccess} />}
      </div>
    )
  }

  return (
    <div style={containerStyle}>
      <div style={{ textAlign: 'center' }}>
        <div
          style={{
            fontSize: 13,
            color: THEME.muted,
            textTransform: 'uppercase',
            letterSpacing: '0.1em'
          }}
        >
          Tap to Receive
        </div>
        <div
          style={{
            fontSize: 32,
            fontWeight: 800,
            color: THEME.gold,
            marginTop: 4
          }}
        >
          ${parseFloat(payload.amount).toFixed(2)} MXN
        </div>
      </div>

      {/* NFC Animation */}
      <div
        style={{
          position: 'relative',
          width: 160,
          height: 160,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}
      >
        {state === 'waiting' || state === 'writing' ? (
          <>
            <style>{`
              @keyframes nfcRipple {
                0% { transform: scale(0.6); opacity: 0.8; }
                100% { transform: scale(1.6); opacity: 0; }
              }
            `}</style>
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                style={{
                  position: 'absolute',
                  width: 100,
                  height: 100,
                  borderRadius: '50%',
                  border: `2px solid ${THEME.primary}`,
                  animation: `nfcRipple 2s ease-out infinite`,
                  animationDelay: `${i * 0.5}s`
                }}
              />
            ))}
          </>
        ) : null}

        <div
          style={{
            width: 100,
            height: 100,
            borderRadius: '50%',
            background:
              state === 'success'
                ? `${THEME.success}20`
                : state === 'error'
                ? `${THEME.error}20`
                : `${THEME.primary}20`,
            border: `3px solid ${
              state === 'success'
                ? THEME.success
                : state === 'error'
                ? THEME.error
                : THEME.primary
            }`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 44,
            zIndex: 1,
            transition: 'all 0.3s ease'
          }}
        >
          {state === 'success' ? '✓' : state === 'error' ? '✕' : '📲'}
        </div>
      </div>

      {/* Status message */}
      <div style={{ textAlign: 'center' }}>
        {state === 'idle' && (
          <div style={{ color: THEME.muted, fontSize: 14 }}>
            Press the button below to activate NFC
          </div>
        )}
        {state === 'waiting' && (
          <div style={{ color: THEME.text, fontSize: 15, fontWeight: 500 }}>
            Hold your phone near the customer's device...
          </div>
        )}
        {state === 'writing' && (
          <div style={{ color: THEME.primary, fontSize: 15, fontWeight: 500 }}>
            Writing payment data...
          </div>
        )}
        {state === 'success' && (
          <div style={{ color: THEME.success, fontSize: 15, fontWeight: 600 }}>
            Payment tag written! Customer can tap to pay.
          </div>
        )}
        {state === 'error' && (
          <div style={{ color: THEME.error, fontSize: 14 }}>
            {errorMsg || 'Write failed. Please try again.'}
          </div>
        )}
      </div>

      {/* Action button */}
      {(state === 'idle' || state === 'error') && (
        <button
          onClick={handleTapToReceive}
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
            letterSpacing: '0.02em',
            boxShadow: `0 4px 20px ${THEME.primary}40`
          }}
        >
          {state === 'error' ? 'Try Again' : 'Activate NFC Receive'}
        </button>
      )}

      {state === 'waiting' || state === 'writing' ? (
        <button
          onClick={() => setState('idle')}
          style={{
            background: 'transparent',
            color: THEME.muted,
            border: `1px solid ${THEME.muted}40`,
            borderRadius: 12,
            padding: '12px 24px',
            fontSize: 14,
            cursor: 'pointer',
            width: '100%'
          }}
        >
          Cancel
        </button>
      ) : null}
    </div>
  )
}

export default NFCWriter
