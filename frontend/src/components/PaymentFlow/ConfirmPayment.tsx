import React, { CSSProperties } from 'react'
import type { PathQuote } from '../../types/payment'
import { PathPreview } from './PathPreview'

interface ConfirmPaymentProps {
  quote: PathQuote
  senderAsset: string
  merchantAddress: string
  isLoading: boolean
  error: string | null
  onConfirm: () => void
  onCancel: () => void
}

const THEME = {
  bg: '#0a0a1a',
  card: '#1a1a2e',
  primary: '#4f46e5',
  gold: '#f59e0b',
  success: '#10b981',
  error: '#ef4444',
  text: '#e2e8f0',
  muted: '#64748b',
  border: 'rgba(255,255,255,0.08)'
}

function Spinner() {
  return (
    <>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
      <div
        style={{
          width: 20,
          height: 20,
          border: '2px solid rgba(255,255,255,0.2)',
          borderTopColor: '#fff',
          borderRadius: '50%',
          animation: 'spin 0.7s linear infinite'
        }}
      />
    </>
  )
}

export const ConfirmPayment: React.FC<ConfirmPaymentProps> = ({
  quote,
  senderAsset,
  merchantAddress,
  isLoading,
  error,
  onConfirm,
  onCancel
}) => {
  const overlayStyle: CSSProperties = {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,0.8)',
    display: 'flex',
    alignItems: 'flex-end',
    justifyContent: 'center',
    zIndex: 500,
    padding: '0 0 env(safe-area-inset-bottom, 0)'
  }

  const sheetStyle: CSSProperties = {
    background: THEME.card,
    borderRadius: '24px 24px 0 0',
    width: '100%',
    maxWidth: 480,
    padding: '24px 20px',
    display: 'flex',
    flexDirection: 'column',
    gap: 16,
    maxHeight: '92vh',
    overflowY: 'auto'
  }

  return (
    <div style={overlayStyle} onClick={(e) => e.target === e.currentTarget && onCancel()}>
      <div style={sheetStyle}>
        {/* Handle bar */}
        <div
          style={{
            width: 40,
            height: 4,
            background: THEME.border,
            borderRadius: 2,
            margin: '0 auto 8px'
          }}
        />

        {/* Title */}
        <div style={{ textAlign: 'center', marginBottom: 4 }}>
          <div style={{ fontSize: 20, fontWeight: 700, color: THEME.text }}>
            Confirm Payment
          </div>
          <div
            style={{
              fontSize: 12,
              color: THEME.muted,
              marginTop: 4,
              wordBreak: 'break-all'
            }}
          >
            To: {merchantAddress.slice(0, 10)}...{merchantAddress.slice(-8)}
          </div>
        </div>

        {/* Path preview */}
        <PathPreview quote={quote} senderAsset={senderAsset} />

        {/* Error */}
        {error && (
          <div
            style={{
              padding: '12px 16px',
              background: `${THEME.error}15`,
              border: `1px solid ${THEME.error}40`,
              borderRadius: 12,
              color: THEME.error,
              fontSize: 14,
              display: 'flex',
              gap: 10,
              alignItems: 'flex-start'
            }}
          >
            <span style={{ fontSize: 18, flexShrink: 0 }}>⚠</span>
            <span>{error}</span>
          </div>
        )}

        {/* Loading stages */}
        {isLoading && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              padding: '12px 16px',
              background: `${THEME.primary}15`,
              borderRadius: 12,
              color: THEME.text,
              fontSize: 14
            }}
          >
            <Spinner />
            <span>Processing payment on Stellar network...</span>
          </div>
        )}

        {/* Buttons */}
        <div style={{ display: 'flex', gap: 12, marginTop: 4 }}>
          <button
            onClick={onCancel}
            disabled={isLoading}
            style={{
              flex: 1,
              background: 'transparent',
              color: THEME.muted,
              border: `1px solid ${THEME.border}`,
              borderRadius: 14,
              padding: '16px 0',
              fontSize: 16,
              fontWeight: 600,
              cursor: isLoading ? 'not-allowed' : 'pointer',
              opacity: isLoading ? 0.5 : 1
            }}
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={isLoading}
            style={{
              flex: 2,
              background: isLoading
                ? `${THEME.primary}80`
                : `linear-gradient(135deg, ${THEME.primary}, #7c3aed)`,
              color: '#fff',
              border: 'none',
              borderRadius: 14,
              padding: '16px 0',
              fontSize: 16,
              fontWeight: 700,
              cursor: isLoading ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 10,
              boxShadow: isLoading ? 'none' : `0 4px 20px ${THEME.primary}40`,
              transition: 'all 0.2s'
            }}
          >
            {isLoading ? (
              <>
                <Spinner />
                <span>Confirming...</span>
              </>
            ) : (
              'Confirm & Pay'
            )}
          </button>
        </div>

        {/* Security note */}
        <div
          style={{
            textAlign: 'center',
            fontSize: 11,
            color: THEME.muted,
            paddingBottom: 4
          }}
        >
          🔒 Secured by Stellar blockchain
        </div>
      </div>
    </div>
  )
}

export default ConfirmPayment
