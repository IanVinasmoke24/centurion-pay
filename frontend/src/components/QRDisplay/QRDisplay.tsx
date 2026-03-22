import React, { useEffect, useState, CSSProperties } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import type { QRSession } from '../../types/payment'

interface QRDisplayProps {
  session: QRSession
  onSettled?: () => void
}

const THEME = {
  bg: '#0a0a1a',
  card: '#1a1a2e',
  cardInner: '#16213e',
  primary: '#4f46e5',
  gold: '#f59e0b',
  success: '#10b981',
  error: '#ef4444',
  text: '#e2e8f0',
  muted: '#64748b'
}

function useCountdown(expiresAt: string) {
  const [secondsLeft, setSecondsLeft] = useState(0)

  useEffect(() => {
    const update = () => {
      const diff = Math.max(
        0,
        Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000)
      )
      setSecondsLeft(diff)
    }
    update()
    const id = setInterval(update, 1000)
    return () => clearInterval(id)
  }, [expiresAt])

  const minutes = Math.floor(secondsLeft / 60)
  const seconds = secondsLeft % 60
  const label = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
  return { secondsLeft, label }
}

export const QRDisplay: React.FC<QRDisplayProps> = ({ session, onSettled }) => {
  const { secondsLeft, label } = useCountdown(session.expiresAt)
  const isExpired = session.status === 'EXPIRED' || secondsLeft === 0
  const isSettled = session.status === 'SETTLED'

  useEffect(() => {
    if (isSettled && onSettled) {
      onSettled()
    }
  }, [isSettled, onSettled])

  // Build QR value: use backend-generated image URL or encode token as URL
  const qrValue = `https://pay.centurion.app/pay?token=${session.token}&amount=${session.amountMxn}&merchant=${session.merchantAddr}`

  const containerStyle: CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '20px',
    padding: '28px 24px',
    background: THEME.card,
    borderRadius: '20px',
    border: `1px solid ${isSettled ? THEME.success : isExpired ? THEME.error : THEME.primary}40`,
    maxWidth: '380px',
    width: '100%',
    margin: '0 auto',
    boxShadow: `0 0 40px ${isSettled ? THEME.success : THEME.primary}20`
  }

  if (isSettled) {
    return (
      <div style={containerStyle}>
        <div
          style={{
            width: 80,
            height: 80,
            borderRadius: '50%',
            background: `${THEME.success}20`,
            border: `3px solid ${THEME.success}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 40,
            animation: 'pop 0.3s ease'
          }}
        >
          ✓
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 22, fontWeight: 700, color: THEME.success }}>
            Payment Settled!
          </div>
          <div style={{ fontSize: 14, color: THEME.muted, marginTop: 6 }}>
            {session.amountMxn} MXN received
          </div>
        </div>
        <style>{`@keyframes pop { 0%{transform:scale(0.5);opacity:0} 80%{transform:scale(1.1)} 100%{transform:scale(1);opacity:1} }`}</style>
      </div>
    )
  }

  if (isExpired) {
    return (
      <div style={containerStyle}>
        <div
          style={{
            width: 80,
            height: 80,
            borderRadius: '50%',
            background: `${THEME.error}20`,
            border: `3px solid ${THEME.error}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 36
          }}
        >
          ⏱
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 20, fontWeight: 700, color: THEME.error }}>
            QR Expired
          </div>
          <div style={{ fontSize: 13, color: THEME.muted, marginTop: 6 }}>
            Please generate a new QR code
          </div>
        </div>
      </div>
    )
  }

  return (
    <div style={containerStyle}>
      {/* Header */}
      <div style={{ textAlign: 'center', width: '100%' }}>
        <div
          style={{
            fontSize: 13,
            color: THEME.muted,
            textTransform: 'uppercase',
            letterSpacing: '0.1em',
            marginBottom: 4
          }}
        >
          Amount Due
        </div>
        <div
          style={{
            fontSize: 36,
            fontWeight: 800,
            color: THEME.gold,
            letterSpacing: '-0.02em'
          }}
        >
          ${parseFloat(session.amountMxn).toFixed(2)}
          <span style={{ fontSize: 16, color: THEME.muted, marginLeft: 6 }}>MXN</span>
        </div>
      </div>

      {/* QR Code */}
      <div
        style={{
          background: '#fff',
          padding: 16,
          borderRadius: 16,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          position: 'relative'
        }}
      >
        <QRCodeSVG
          value={qrValue}
          size={220}
          level="H"
          includeMargin={false}
          fgColor="#0a0a1a"
          bgColor="#ffffff"
        />
        {/* Center logo overlay */}
        <div
          style={{
            position: 'absolute',
            width: 44,
            height: 44,
            background: THEME.primary,
            borderRadius: 8,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#fff',
            fontSize: 20,
            fontWeight: 800,
            boxShadow: '0 2px 8px rgba(0,0,0,0.4)'
          }}
        >
          C
        </div>
      </div>

      {/* Status row */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          color: THEME.muted,
          fontSize: 14
        }}
      >
        <SpinnerDots />
        <span>
          {session.status === 'SCANNED' ? 'Processing payment...' : 'Waiting for payment...'}
        </span>
      </div>

      {/* Countdown */}
      <div
        style={{
          width: '100%',
          background: THEME.cardInner,
          borderRadius: 12,
          padding: '12px 16px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}
      >
        <span style={{ fontSize: 12, color: THEME.muted }}>Expires in</span>
        <span
          style={{
            fontSize: 18,
            fontWeight: 700,
            color: secondsLeft < 30 ? THEME.error : THEME.text,
            fontVariantNumeric: 'tabular-nums'
          }}
        >
          {label}
        </span>
      </div>

      {/* Merchant address */}
      <div
        style={{
          fontSize: 11,
          color: THEME.muted,
          textAlign: 'center',
          wordBreak: 'break-all'
        }}
      >
        {session.merchantAddr.slice(0, 8)}...{session.merchantAddr.slice(-8)}
      </div>
    </div>
  )
}

function SpinnerDots() {
  return (
    <>
      <style>{`
        @keyframes blink {
          0%, 80%, 100% { opacity: 0.2; transform: scale(0.8); }
          40% { opacity: 1; transform: scale(1); }
        }
        .dot { width:6px; height:6px; border-radius:50%; background:#4f46e5; display:inline-block; }
        .dot:nth-child(1) { animation: blink 1.4s infinite 0s; }
        .dot:nth-child(2) { animation: blink 1.4s infinite 0.2s; }
        .dot:nth-child(3) { animation: blink 1.4s infinite 0.4s; }
      `}</style>
      <span style={{ display: 'inline-flex', gap: 3, alignItems: 'center' }}>
        <span className="dot" />
        <span className="dot" />
        <span className="dot" />
      </span>
    </>
  )
}

export default QRDisplay
