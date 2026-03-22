import React, { useEffect, useState, CSSProperties } from 'react'
import type { PathQuote } from '../../types/payment'

interface PathPreviewProps {
  quote: PathQuote
  senderAsset: string
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

const QUOTE_TTL_SECONDS = 15

function ExpiryBar({ expiresAt }: { expiresAt: number }) {
  const [pct, setPct] = useState(100)
  const [secondsLeft, setSecondsLeft] = useState(QUOTE_TTL_SECONDS)

  useEffect(() => {
    const update = () => {
      const now = Date.now()
      const remaining = Math.max(0, expiresAt - now)
      const elapsed = QUOTE_TTL_SECONDS * 1000 - remaining
      const fraction = Math.max(0, 1 - elapsed / (QUOTE_TTL_SECONDS * 1000))
      setPct(Math.round(fraction * 100))
      setSecondsLeft(Math.ceil(remaining / 1000))
    }
    update()
    const id = setInterval(update, 250)
    return () => clearInterval(id)
  }, [expiresAt])

  const color = pct > 50 ? THEME.success : pct > 25 ? THEME.gold : THEME.error

  return (
    <div>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          fontSize: 12,
          color: THEME.muted,
          marginBottom: 6
        }}
      >
        <span>Quote expires</span>
        <span style={{ color, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
          {secondsLeft}s
        </span>
      </div>
      <div
        style={{
          height: 6,
          background: THEME.border,
          borderRadius: 3,
          overflow: 'hidden'
        }}
      >
        <div
          style={{
            height: '100%',
            width: `${pct}%`,
            background: color,
            borderRadius: 3,
            transition: 'width 0.25s linear, background-color 0.5s'
          }}
        />
      </div>
    </div>
  )
}

function AssetNode({
  label,
  amount,
  color,
  sub
}: {
  label: string
  amount: string
  color: string
  sub?: string
}) {
  return (
    <div style={{ textAlign: 'center' }}>
      <div
        style={{
          background: `${color}20`,
          border: `1px solid ${color}50`,
          borderRadius: 12,
          padding: '10px 16px',
          marginBottom: 4
        }}
      >
        <div style={{ fontSize: 18, fontWeight: 800, color, letterSpacing: '-0.02em' }}>
          {amount}
        </div>
        <div style={{ fontSize: 12, fontWeight: 600, color, marginTop: 2 }}>
          {label}
        </div>
      </div>
      {sub && <div style={{ fontSize: 10, color: THEME.muted }}>{sub}</div>}
    </div>
  )
}

export const PathPreview: React.FC<PathPreviewProps> = ({ quote, senderAsset }) => {
  const pathAssets = quote.path.length > 0 ? quote.path : ['XLM']
  const sendAmount = parseFloat(quote.sendMax).toFixed(6)
  const destAmount = parseFloat(quote.destAmount).toFixed(2)
  const fee = parseFloat(quote.fee || '0').toFixed(7)
  const rate = parseFloat(quote.rate || '0')

  const containerStyle: CSSProperties = {
    background: THEME.card,
    borderRadius: 20,
    padding: 24,
    border: `1px solid ${THEME.border}`,
    maxWidth: 420,
    width: '100%',
    margin: '0 auto'
  }

  const rowStyle: CSSProperties = {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '10px 0',
    borderBottom: `1px solid ${THEME.border}`,
    fontSize: 14
  }

  return (
    <div style={containerStyle}>
      <div
        style={{
          fontSize: 13,
          fontWeight: 700,
          color: THEME.muted,
          textTransform: 'uppercase',
          letterSpacing: '0.08em',
          marginBottom: 20
        }}
      >
        Payment Path
      </div>

      {/* Path visualization */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 4,
          marginBottom: 24,
          overflowX: 'auto',
          paddingBottom: 4
        }}
      >
        <AssetNode
          label={senderAsset}
          amount={sendAmount}
          color={THEME.primary}
          sub="You send"
        />

        {pathAssets.map((asset, i) => (
          <React.Fragment key={i}>
            <div style={{ flex: '0 0 auto', textAlign: 'center' }}>
              <div
                style={{
                  color: THEME.muted,
                  fontSize: 18,
                  lineHeight: 1
                }}
              >
                →
              </div>
              <div style={{ fontSize: 10, color: THEME.muted, marginTop: 2 }}>
                via
              </div>
            </div>
            <div
              style={{
                background: THEME.cardInner,
                borderRadius: 10,
                padding: '8px 12px',
                textAlign: 'center',
                flex: '0 0 auto'
              }}
            >
              <div style={{ fontSize: 13, fontWeight: 700, color: THEME.text }}>
                {asset}
              </div>
            </div>
          </React.Fragment>
        ))}

        <div style={{ flex: '0 0 auto', color: THEME.muted, fontSize: 18 }}>→</div>

        <AssetNode
          label="MXN"
          amount={`${destAmount}`}
          color={THEME.gold}
          sub="Merchant gets"
        />
      </div>

      {/* Details */}
      <div style={{ marginBottom: 20 }}>
        <div style={rowStyle}>
          <span style={{ color: THEME.muted }}>You send (max)</span>
          <span style={{ fontWeight: 700, color: THEME.text }}>
            {sendAmount} {senderAsset}
          </span>
        </div>
        <div style={rowStyle}>
          <span style={{ color: THEME.muted }}>Merchant receives</span>
          <span style={{ fontWeight: 700, color: THEME.gold }}>
            {destAmount} MXN
          </span>
        </div>
        <div style={rowStyle}>
          <span style={{ color: THEME.muted }}>Exchange rate</span>
          <span style={{ fontWeight: 600, color: THEME.text }}>
            {rate > 0
              ? `1 ${senderAsset} ≈ ${(rate).toFixed(4)} MXN`
              : '—'}
          </span>
        </div>
        <div style={{ ...rowStyle, borderBottom: 'none' }}>
          <span style={{ color: THEME.muted }}>Network fee</span>
          <span style={{ fontWeight: 600, color: THEME.text }}>
            {fee} XLM
          </span>
        </div>
      </div>

      {/* Expiry bar */}
      <ExpiryBar expiresAt={quote.expiresAt} />
    </div>
  )
}

export default PathPreview
