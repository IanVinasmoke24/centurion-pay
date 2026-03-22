import React, { CSSProperties } from 'react'

interface BalanceCardProps {
  asset: 'MXN' | 'USD' | 'GOLD' | 'XLM' | string
  balance: string
  mxnEquivalent?: string
  change24h?: string
  isLoading?: boolean
  onClick?: () => void
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

interface AssetConfig {
  symbol: string
  gradient: string
  accentColor: string
  icon: string
  description: string
}

const ASSET_CONFIGS: Record<string, AssetConfig> = {
  MXN: {
    symbol: '$',
    gradient: 'linear-gradient(135deg, #065f46, #064e3b)',
    accentColor: THEME.success,
    icon: '🇲🇽',
    description: 'Mexican Peso'
  },
  USD: {
    symbol: '$',
    gradient: 'linear-gradient(135deg, #1e3a5f, #1e3a8a)',
    accentColor: '#60a5fa',
    icon: '🇺🇸',
    description: 'US Dollar'
  },
  GOLD: {
    symbol: 'Au',
    gradient: 'linear-gradient(135deg, #78350f, #92400e)',
    accentColor: THEME.gold,
    icon: '🥇',
    description: 'Digital Gold'
  },
  XLM: {
    symbol: '✦',
    gradient: 'linear-gradient(135deg, #3b1f6e, #4c1d95)',
    accentColor: '#a78bfa',
    icon: '⭐',
    description: 'Stellar Lumens'
  }
}

const DEFAULT_CONFIG: AssetConfig = {
  symbol: '◎',
  gradient: 'linear-gradient(135deg, #1a1a2e, #16213e)',
  accentColor: THEME.muted,
  icon: '💰',
  description: 'Asset'
}

function SkeletonLine({ width = '100%', height = 16 }: { width?: string; height?: number }) {
  return (
    <>
      <style>{`
        @keyframes shimmer {
          0% { background-position: -200% 0; }
          100% { background-position: 200% 0; }
        }
      `}</style>
      <div
        style={{
          width,
          height,
          borderRadius: 4,
          background:
            'linear-gradient(90deg, rgba(255,255,255,0.05) 25%, rgba(255,255,255,0.1) 50%, rgba(255,255,255,0.05) 75%)',
          backgroundSize: '200% 100%',
          animation: 'shimmer 1.5s infinite'
        }}
      />
    </>
  )
}

export const BalanceCard: React.FC<BalanceCardProps> = ({
  asset,
  balance,
  mxnEquivalent,
  change24h,
  isLoading = false,
  onClick
}) => {
  const config = ASSET_CONFIGS[asset] || DEFAULT_CONFIG
  const changeNum = parseFloat(change24h || '0')
  const isPositive = changeNum >= 0
  const formattedBalance = parseFloat(balance || '0').toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: asset === 'XLM' || asset === 'GOLD' ? 6 : 2
  })
  const formattedMxn = mxnEquivalent
    ? parseFloat(mxnEquivalent).toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      })
    : null

  const cardStyle: CSSProperties = {
    background: config.gradient,
    borderRadius: 20,
    padding: '20px',
    border: `1px solid ${config.accentColor}25`,
    cursor: onClick ? 'pointer' : 'default',
    transition: 'transform 0.15s, box-shadow 0.15s',
    position: 'relative',
    overflow: 'hidden',
    minHeight: 140,
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'space-between',
    boxShadow: `0 4px 20px rgba(0,0,0,0.3), inset 0 1px 0 ${config.accentColor}20`
  }

  return (
    <div
      style={cardStyle}
      onClick={onClick}
      onMouseEnter={(e) => {
        if (onClick) {
          ;(e.currentTarget as HTMLDivElement).style.transform = 'translateY(-2px)'
          ;(e.currentTarget as HTMLDivElement).style.boxShadow = `0 8px 30px rgba(0,0,0,0.4), inset 0 1px 0 ${config.accentColor}20`
        }
      }}
      onMouseLeave={(e) => {
        if (onClick) {
          ;(e.currentTarget as HTMLDivElement).style.transform = 'translateY(0)'
          ;(e.currentTarget as HTMLDivElement).style.boxShadow = `0 4px 20px rgba(0,0,0,0.3), inset 0 1px 0 ${config.accentColor}20`
        }
      }}
    >
      {/* Decorative circle */}
      <div
        style={{
          position: 'absolute',
          right: -20,
          top: -20,
          width: 100,
          height: 100,
          borderRadius: '50%',
          background: `${config.accentColor}15`,
          pointerEvents: 'none'
        }}
      />

      {/* Top row: icon + asset + change */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 24, lineHeight: 1 }}>{config.icon}</span>
          <div>
            <div
              style={{ fontSize: 16, fontWeight: 800, color: config.accentColor }}
            >
              {asset}
            </div>
            <div style={{ fontSize: 11, color: THEME.muted }}>{config.description}</div>
          </div>
        </div>

        {/* 24h change */}
        {change24h !== undefined && !isLoading && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 3,
              background: `${isPositive ? THEME.success : THEME.error}20`,
              border: `1px solid ${isPositive ? THEME.success : THEME.error}40`,
              borderRadius: 8,
              padding: '4px 8px',
              fontSize: 12,
              fontWeight: 700,
              color: isPositive ? THEME.success : THEME.error
            }}
          >
            <span>{isPositive ? '↑' : '↓'}</span>
            <span>{Math.abs(changeNum).toFixed(2)}%</span>
          </div>
        )}
      </div>

      {/* Balance */}
      <div>
        {isLoading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <SkeletonLine width="80%" height={28} />
            <SkeletonLine width="50%" height={14} />
          </div>
        ) : (
          <>
            <div
              style={{
                fontSize: 28,
                fontWeight: 800,
                color: THEME.text,
                letterSpacing: '-0.02em',
                lineHeight: 1.1
              }}
            >
              {config.symbol !== asset ? config.symbol : ''}{formattedBalance}
            </div>
            {formattedMxn && asset !== 'MXN' && (
              <div style={{ fontSize: 13, color: THEME.muted, marginTop: 4 }}>
                ≈ ${formattedMxn} MXN
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

export default BalanceCard
