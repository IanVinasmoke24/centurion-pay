import React, { useState, useEffect, CSSProperties } from 'react'

interface AmountInputProps {
  value: string
  onChange: (value: string) => void
  sourceAsset: string
  onSourceAssetChange: (asset: string) => void
  rateToMxn?: Record<string, number>
  disabled?: boolean
  onSubmit?: () => void
}

const THEME = {
  card: '#1a1a2e',
  cardInner: '#16213e',
  primary: '#4f46e5',
  gold: '#f59e0b',
  success: '#10b981',
  text: '#e2e8f0',
  muted: '#64748b',
  border: 'rgba(255,255,255,0.08)'
}

const SOURCE_ASSETS = ['USD', 'GOLD', 'XLM']

const ASSET_DISPLAY: Record<string, { symbol: string; label: string; color: string }> = {
  USD: { symbol: '$', label: 'US Dollar', color: '#10b981' },
  GOLD: { symbol: 'Au', label: 'Digital Gold', color: '#f59e0b' },
  XLM: { symbol: '✦', label: 'Stellar Lumens', color: '#7c3aed' }
}

export const AmountInput: React.FC<AmountInputProps> = ({
  value,
  onChange,
  sourceAsset,
  onSourceAssetChange,
  rateToMxn = { USD: 17.5, GOLD: 890.0, XLM: 0.18 },
  disabled = false,
  onSubmit
}) => {
  const [isFocused, setIsFocused] = useState(false)

  const mxnAmount = parseFloat(value) || 0
  const rate = rateToMxn[sourceAsset] || 1
  const sourceAmount = rate > 0 ? (mxnAmount / rate).toFixed(6) : '0'
  const displaySourceAmount =
    parseFloat(sourceAmount) < 0.0001
      ? '—'
      : parseFloat(sourceAmount).toLocaleString(undefined, {
          minimumFractionDigits: 2,
          maximumFractionDigits: 6
        })

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && onSubmit) onSubmit()
  }

  const assetInfo = ASSET_DISPLAY[sourceAsset] || ASSET_DISPLAY['USD']

  const containerStyle: CSSProperties = {
    background: THEME.card,
    borderRadius: 20,
    padding: 24,
    maxWidth: 420,
    width: '100%',
    margin: '0 auto'
  }

  const inputWrapperStyle: CSSProperties = {
    background: THEME.cardInner,
    borderRadius: 16,
    border: `2px solid ${isFocused ? THEME.primary : THEME.border}`,
    padding: '16px 20px',
    marginBottom: 16,
    transition: 'border-color 0.2s'
  }

  return (
    <div style={containerStyle}>
      {/* Destination: MXN */}
      <div style={{ marginBottom: 8 }}>
        <div
          style={{
            fontSize: 12,
            color: THEME.muted,
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
            marginBottom: 8
          }}
        >
          Merchant Receives (MXN)
        </div>
        <div style={inputWrapperStyle}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span
              style={{
                fontSize: 28,
                fontWeight: 700,
                color: THEME.muted
              }}
            >
              $
            </span>
            <input
              type="number"
              inputMode="decimal"
              value={value}
              onChange={(e) => onChange(e.target.value)}
              onFocus={() => setIsFocused(true)}
              onBlur={() => setIsFocused(false)}
              onKeyDown={handleKeyDown}
              placeholder="0.00"
              disabled={disabled}
              min="0"
              step="0.01"
              style={{
                background: 'transparent',
                border: 'none',
                outline: 'none',
                color: THEME.text,
                fontSize: 40,
                fontWeight: 800,
                width: '100%',
                letterSpacing: '-0.02em',
                caretColor: THEME.primary,
                opacity: disabled ? 0.5 : 1
              }}
            />
            <div
              style={{
                background: `${THEME.gold}20`,
                color: THEME.gold,
                borderRadius: 8,
                padding: '6px 12px',
                fontSize: 14,
                fontWeight: 700,
                whiteSpace: 'nowrap'
              }}
            >
              MXN
            </div>
          </div>
        </div>
      </div>

      {/* Conversion arrow */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          marginBottom: 16,
          padding: '0 8px'
        }}
      >
        <div style={{ flex: 1, height: 1, background: THEME.border }} />
        <div
          style={{
            color: THEME.muted,
            fontSize: 18,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 2
          }}
        >
          <span style={{ transform: 'rotate(90deg)', display: 'block' }}>⇄</span>
          <span style={{ fontSize: 10, letterSpacing: '0.05em' }}>PATH PAYMENT</span>
        </div>
        <div style={{ flex: 1, height: 1, background: THEME.border }} />
      </div>

      {/* Source: user pays */}
      <div>
        <div
          style={{
            fontSize: 12,
            color: THEME.muted,
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
            marginBottom: 8
          }}
        >
          You Pay (estimated)
        </div>
        <div
          style={{
            background: THEME.cardInner,
            borderRadius: 16,
            border: `1px solid ${THEME.border}`,
            padding: '16px 20px'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span
              style={{
                fontSize: 20,
                fontWeight: 800,
                color: assetInfo.color,
                width: 32,
                textAlign: 'center'
              }}
            >
              {assetInfo.symbol}
            </span>
            <div
              style={{
                fontSize: 34,
                fontWeight: 700,
                color: value ? THEME.text : THEME.muted,
                flex: 1,
                letterSpacing: '-0.02em'
              }}
            >
              {value ? displaySourceAmount : '—'}
            </div>

            {/* Asset selector */}
            <div style={{ display: 'flex', gap: 6 }}>
              {SOURCE_ASSETS.map((asset) => (
                <button
                  key={asset}
                  onClick={() => onSourceAssetChange(asset)}
                  style={{
                    background:
                      sourceAsset === asset
                        ? `${ASSET_DISPLAY[asset]?.color || THEME.primary}20`
                        : 'transparent',
                    border: `1px solid ${
                      sourceAsset === asset
                        ? ASSET_DISPLAY[asset]?.color || THEME.primary
                        : THEME.border
                    }`,
                    borderRadius: 8,
                    color:
                      sourceAsset === asset
                        ? ASSET_DISPLAY[asset]?.color || THEME.primary
                        : THEME.muted,
                    padding: '6px 10px',
                    fontSize: 12,
                    fontWeight: sourceAsset === asset ? 700 : 400,
                    cursor: 'pointer',
                    transition: 'all 0.2s'
                  }}
                >
                  {asset}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Rate info */}
      {value && parseFloat(value) > 0 && (
        <div
          style={{
            marginTop: 16,
            padding: '10px 16px',
            background: `${THEME.primary}10`,
            borderRadius: 10,
            display: 'flex',
            justifyContent: 'space-between',
            fontSize: 12,
            color: THEME.muted
          }}
        >
          <span>Exchange rate</span>
          <span style={{ color: THEME.text, fontWeight: 600 }}>
            1 {sourceAsset} = {rate.toFixed(2)} MXN
          </span>
        </div>
      )}
    </div>
  )
}

export default AmountInput
