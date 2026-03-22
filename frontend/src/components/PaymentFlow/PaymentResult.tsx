import React, { useEffect, useState, CSSProperties } from 'react'

interface PaymentResultProps {
  status: 'settled' | 'failed'
  txHash?: string | null
  error?: string | null
  amount?: string
  asset?: string
  network?: 'testnet' | 'mainnet'
  onRetry?: () => void
  onDone?: () => void
}

const THEME = {
  card: '#1a1a2e',
  cardInner: '#16213e',
  primary: '#4f46e5',
  gold: '#f59e0b',
  success: '#10b981',
  error: '#ef4444',
  text: '#e2e8f0',
  muted: '#64748b',
  border: 'rgba(255,255,255,0.08)'
}

const EXPLORER_URL: Record<string, string> = {
  testnet: 'https://stellar.expert/explorer/testnet/tx/',
  mainnet: 'https://stellar.expert/explorer/public/tx/'
}

export const PaymentResult: React.FC<PaymentResultProps> = ({
  status,
  txHash,
  error,
  amount,
  asset,
  network = 'testnet',
  onRetry,
  onDone
}) => {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    // Animate in
    const t = setTimeout(() => setVisible(true), 50)
    return () => clearTimeout(t)
  }, [])

  const isSettled = status === 'settled'
  const accentColor = isSettled ? THEME.success : THEME.error
  const explorerLink = txHash
    ? `${EXPLORER_URL[network]}${txHash}`
    : null

  const containerStyle: CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 24,
    padding: '40px 24px',
    maxWidth: 380,
    width: '100%',
    margin: '0 auto',
    opacity: visible ? 1 : 0,
    transform: visible ? 'translateY(0)' : 'translateY(20px)',
    transition: 'opacity 0.4s ease, transform 0.4s ease'
  }

  return (
    <div style={containerStyle}>
      {/* Icon */}
      <div
        style={{
          position: 'relative',
          width: 120,
          height: 120,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}
      >
        {isSettled && (
          <>
            <style>{`
              @keyframes successPop {
                0%   { transform: scale(0); opacity: 0; }
                60%  { transform: scale(1.15); opacity: 1; }
                80%  { transform: scale(0.95); }
                100% { transform: scale(1); }
              }
              @keyframes successRing {
                0%   { transform: scale(0.5); opacity: 0.8; }
                100% { transform: scale(1.8); opacity: 0; }
              }
            `}</style>
            {[0, 1].map((i) => (
              <div
                key={i}
                style={{
                  position: 'absolute',
                  width: 80,
                  height: 80,
                  borderRadius: '50%',
                  border: `2px solid ${THEME.success}`,
                  animation: `successRing 1.5s ease-out ${i * 0.4}s forwards`
                }}
              />
            ))}
          </>
        )}
        <div
          style={{
            width: 80,
            height: 80,
            borderRadius: '50%',
            background: `${accentColor}20`,
            border: `3px solid ${accentColor}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 42,
            animation: visible ? (isSettled ? 'successPop 0.5s ease' : 'none') : 'none',
            zIndex: 1
          }}
        >
          {isSettled ? '✓' : '✕'}
        </div>
      </div>

      {/* Title + amount */}
      <div style={{ textAlign: 'center' }}>
        <div
          style={{
            fontSize: 26,
            fontWeight: 800,
            color: accentColor,
            marginBottom: 6
          }}
        >
          {isSettled ? 'Payment Settled!' : 'Payment Failed'}
        </div>
        {isSettled && amount && asset && (
          <div style={{ fontSize: 15, color: THEME.muted }}>
            {amount} {asset} sent successfully
          </div>
        )}
        {!isSettled && error && (
          <div
            style={{
              fontSize: 14,
              color: THEME.muted,
              maxWidth: 280,
              lineHeight: 1.5,
              marginTop: 4
            }}
          >
            {error}
          </div>
        )}
      </div>

      {/* TX Hash */}
      {isSettled && txHash && explorerLink && (
        <div
          style={{
            background: THEME.card,
            borderRadius: 14,
            padding: '16px 20px',
            width: '100%',
            border: `1px solid ${THEME.border}`
          }}
        >
          <div
            style={{ fontSize: 12, color: THEME.muted, marginBottom: 8, letterSpacing: '0.05em' }}
          >
            TRANSACTION HASH
          </div>
          <div
            style={{
              fontSize: 12,
              fontFamily: 'monospace',
              color: THEME.text,
              wordBreak: 'break-all',
              marginBottom: 10
            }}
          >
            {txHash}
          </div>
          <a
            href={explorerLink}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              color: THEME.primary,
              textDecoration: 'none',
              fontSize: 13,
              fontWeight: 600
            }}
          >
            View on Stellar Explorer ↗
          </a>
        </div>
      )}

      {/* Success: confetti dots (pure CSS) */}
      {isSettled && (
        <div style={{ position: 'relative', width: '100%', height: 0, overflow: 'visible' }}>
          <style>{`
            @keyframes confettiFall {
              0% { transform: translateY(-60px) rotate(0deg); opacity: 1; }
              100% { transform: translateY(80px) rotate(720deg); opacity: 0; }
            }
          `}</style>
          {[...Array(8)].map((_, i) => (
            <div
              key={i}
              style={{
                position: 'absolute',
                width: 8,
                height: 8,
                borderRadius: i % 2 === 0 ? '50%' : '2px',
                background: [THEME.gold, THEME.success, THEME.primary, '#ec4899'][i % 4],
                left: `${10 + i * 11}%`,
                top: -80,
                animation: `confettiFall 1s ease-out ${i * 0.1}s forwards`
              }}
            />
          ))}
        </div>
      )}

      {/* Action buttons */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, width: '100%' }}>
        {!isSettled && onRetry && (
          <button
            onClick={onRetry}
            style={{
              background: `linear-gradient(135deg, ${THEME.primary}, #7c3aed)`,
              color: '#fff',
              border: 'none',
              borderRadius: 14,
              padding: '16px 0',
              fontSize: 16,
              fontWeight: 700,
              cursor: 'pointer',
              width: '100%',
              boxShadow: `0 4px 20px ${THEME.primary}40`
            }}
          >
            Try Again
          </button>
        )}
        {onDone && (
          <button
            onClick={onDone}
            style={{
              background: isSettled
                ? `linear-gradient(135deg, ${THEME.primary}, #7c3aed)`
                : 'transparent',
              color: isSettled ? '#fff' : THEME.muted,
              border: isSettled ? 'none' : `1px solid ${THEME.border}`,
              borderRadius: 14,
              padding: '16px 0',
              fontSize: 16,
              fontWeight: isSettled ? 700 : 400,
              cursor: 'pointer',
              width: '100%',
              boxShadow: isSettled ? `0 4px 20px ${THEME.primary}40` : 'none'
            }}
          >
            {isSettled ? 'Done' : 'Back to Home'}
          </button>
        )}
      </div>
    </div>
  )
}

export default PaymentResult
