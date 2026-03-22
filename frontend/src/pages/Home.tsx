import React, { useEffect, CSSProperties } from 'react'
import { useNavigate } from 'react-router-dom'
import { BalanceCard } from '../components/Portfolio/BalanceCard'
import { useStore } from '../store'
import { useStellarAccount } from '../hooks/useStellarAccount'
import { useWebSocket } from '../hooks/useWebSocket'

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

const MOCK_RATES: Record<string, number> = {
  MXN: 1,
  USD: 17.5,
  GOLD: 890,
  XLM: 0.18
}

const MOCK_CHANGES: Record<string, string> = {
  MXN: '0.00',
  USD: '0.12',
  GOLD: '1.34',
  XLM: '-2.10'
}

interface TxItem {
  id: string
  type: 'sent' | 'received'
  asset: string
  amount: string
  counterparty: string
  date: string
}

const MOCK_TXS: TxItem[] = [
  { id: '1', type: 'received', asset: 'MXN', amount: '250.00', counterparty: 'GDXYZ...', date: 'Today, 3:42 PM' },
  { id: '2', type: 'sent', asset: 'USD', amount: '14.28', counterparty: 'GAABC...', date: 'Today, 1:15 PM' },
  { id: '3', type: 'received', asset: 'GOLD', amount: '0.5610', counterparty: 'GCDEF...', date: 'Yesterday' },
  { id: '4', type: 'sent', asset: 'MXN', amount: '120.00', counterparty: 'GHIJK...', date: 'Mar 18' }
]

export const Home: React.FC = () => {
  const navigate = useNavigate()
  const { address, fetchAccount } = useStore((s) => ({
    address: s.address,
    fetchAccount: s.fetchAccount
  }))

  const { balances, isLoading, refetch } = useStellarAccount(address)
  const { lastMessage } = useWebSocket()

  // Refetch when a payment settles via WebSocket
  useEffect(() => {
    if (lastMessage?.type === 'PAYMENT_SETTLED' || lastMessage?.type === 'QR_SETTLED') {
      refetch()
    }
  }, [lastMessage, refetch])

  useEffect(() => {
    if (address) fetchAccount(address)
  }, [address, fetchAccount])

  // Build balance map from fetched balances
  const balanceMap: Record<string, string> = {}
  balances.forEach((b) => {
    balanceMap[b.asset] = b.balance
  })

  const assetsToShow = ['MXN', 'USD', 'GOLD']
  const totalMxn = assetsToShow.reduce((sum, asset) => {
    const bal = parseFloat(balanceMap[asset] || '0')
    const rate = MOCK_RATES[asset] || 1
    return sum + bal * rate
  }, 0)

  const containerStyle: CSSProperties = {
    minHeight: '100%',
    background: THEME.bg,
    paddingBottom: 80
  }

  const headerStyle: CSSProperties = {
    padding: '20px 20px 0',
    background: `linear-gradient(180deg, #1a1a2e 0%, ${THEME.bg} 100%)`
  }

  const quickBtnStyle = (color: string): CSSProperties => ({
    flex: 1,
    background: `linear-gradient(135deg, ${color}, ${color}cc)`,
    border: 'none',
    borderRadius: 16,
    padding: '18px 0',
    color: '#fff',
    fontSize: 16,
    fontWeight: 700,
    cursor: 'pointer',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 6,
    boxShadow: `0 4px 20px ${color}40`
  })

  return (
    <div style={containerStyle}>
      {/* Header */}
      <div style={headerStyle}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 20
          }}
        >
          <div>
            <div style={{ fontSize: 13, color: THEME.muted }}>Total Balance</div>
            <div
              style={{
                fontSize: 34,
                fontWeight: 800,
                color: THEME.text,
                letterSpacing: '-0.02em'
              }}
            >
              ${totalMxn.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              <span style={{ fontSize: 16, color: THEME.muted, marginLeft: 6 }}>MXN</span>
            </div>
          </div>
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: '50%',
              background: `${THEME.primary}30`,
              border: `2px solid ${THEME.primary}50`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 20,
              cursor: 'pointer'
            }}
            onClick={() => navigate('/settings')}
          >
            ⚙
          </div>
        </div>

        {/* Address chip */}
        {address && (
          <div
            style={{
              background: THEME.card,
              borderRadius: 10,
              padding: '8px 14px',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              marginBottom: 20
            }}
          >
            <div
              style={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                background: THEME.success
              }}
            />
            <span
              style={{
                fontSize: 12,
                fontFamily: 'monospace',
                color: THEME.muted
              }}
            >
              {address.slice(0, 8)}...{address.slice(-8)}
            </span>
          </div>
        )}
      </div>

      <div style={{ padding: '0 20px' }}>
        {/* Quick actions */}
        <div style={{ display: 'flex', gap: 12, marginBottom: 28 }}>
          <button style={quickBtnStyle(THEME.primary)} onClick={() => navigate('/pay')}>
            <span style={{ fontSize: 24 }}>↑</span>
            <span>Pay</span>
          </button>
          <button style={quickBtnStyle('#059669')} onClick={() => navigate('/receive')}>
            <span style={{ fontSize: 24 }}>↓</span>
            <span>Receive</span>
          </button>
        </div>

        {/* Balances */}
        <div style={{ marginBottom: 28 }}>
          <div
            style={{
              fontSize: 13,
              fontWeight: 700,
              color: THEME.muted,
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              marginBottom: 12
            }}
          >
            Your Assets
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {assetsToShow.map((asset) => {
              const bal = balanceMap[asset] || '0'
              const rate = MOCK_RATES[asset] || 1
              const mxnEq = (parseFloat(bal) * rate).toFixed(2)
              return (
                <BalanceCard
                  key={asset}
                  asset={asset as 'MXN' | 'USD' | 'GOLD'}
                  balance={bal}
                  mxnEquivalent={asset !== 'MXN' ? mxnEq : undefined}
                  change24h={MOCK_CHANGES[asset]}
                  isLoading={isLoading}
                />
              )
            })}
          </div>
        </div>

        {/* Recent transactions */}
        <div>
          <div
            style={{
              fontSize: 13,
              fontWeight: 700,
              color: THEME.muted,
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              marginBottom: 12
            }}
          >
            Recent Activity
          </div>
          <div
            style={{
              background: THEME.card,
              borderRadius: 16,
              overflow: 'hidden',
              border: `1px solid ${THEME.border}`
            }}
          >
            {MOCK_TXS.map((tx, i) => (
              <div
                key={tx.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 14,
                  padding: '14px 16px',
                  borderBottom:
                    i < MOCK_TXS.length - 1 ? `1px solid ${THEME.border}` : 'none'
                }}
              >
                <div
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: '50%',
                    background: `${tx.type === 'received' ? THEME.success : THEME.primary}20`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 18,
                    flexShrink: 0
                  }}
                >
                  {tx.type === 'received' ? '↓' : '↑'}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: THEME.text }}>
                    {tx.type === 'received' ? 'Received' : 'Sent'} {tx.asset}
                  </div>
                  <div
                    style={{
                      fontSize: 12,
                      color: THEME.muted,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap'
                    }}
                  >
                    {tx.counterparty} · {tx.date}
                  </div>
                </div>
                <div
                  style={{
                    fontSize: 15,
                    fontWeight: 700,
                    color: tx.type === 'received' ? THEME.success : THEME.text,
                    flexShrink: 0
                  }}
                >
                  {tx.type === 'received' ? '+' : '-'}
                  {tx.amount} {tx.asset}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

export default Home
