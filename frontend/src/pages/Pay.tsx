import React, { useState, useEffect, CSSProperties } from 'react'
import { useNavigate } from 'react-router-dom'
import { AmountInput } from '../components/PaymentFlow/AmountInput'
import { QRDisplay } from '../components/QRDisplay/QRDisplay'
import { NFCWriter } from '../components/NFCPayment/NFCWriter'
import { PaymentResult } from '../components/PaymentFlow/PaymentResult'
import { useQRPayment } from '../hooks/useQRPayment'
import { useWebSocket } from '../hooks/useWebSocket'
import { useStore } from '../store'

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

type Tab = 'qr' | 'nfc'
type Stage = 'amount' | 'display' | 'settled'

export const Pay: React.FC = () => {
  const navigate = useNavigate()
  const address = useStore((s) => s.address)

  const [stage, setStage] = useState<Stage>('amount')
  const [activeTab, setActiveTab] = useState<Tab>('qr')
  const [amountMxn, setAmountMxn] = useState('')
  const [sourceAsset, setSourceAsset] = useState('USD')
  const [error, setError] = useState<string | null>(null)

  const { session, createSession, reset: resetQR } = useQRPayment()
  const { lastMessage } = useWebSocket()

  // Listen for settlement via WebSocket
  useEffect(() => {
    if (
      lastMessage?.type === 'QR_SETTLED' &&
      session?.token &&
      (lastMessage.payload as { token?: string })?.token === session.token
    ) {
      setStage('settled')
    }
  }, [lastMessage, session])

  const handleGenerateQR = async () => {
    if (!address) {
      setError('No merchant address configured. Please set it in Settings.')
      return
    }
    if (!amountMxn || parseFloat(amountMxn) <= 0) {
      setError('Please enter a valid amount.')
      return
    }
    setError(null)

    const s = await createSession(address, amountMxn)
    if (s) setStage('display')
    else setError('Failed to create payment session. Check your connection.')
  }

  const handleReset = () => {
    resetQR()
    setAmountMxn('')
    setStage('amount')
    setError(null)
  }

  const containerStyle: CSSProperties = {
    minHeight: '100%',
    background: THEME.bg,
    paddingBottom: 80
  }

  const headerStyle: CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    padding: '20px 20px 16px',
    borderBottom: `1px solid ${THEME.border}`
  }

  // ── Amount entry stage ──
  if (stage === 'amount') {
    return (
      <div style={containerStyle}>
        <div style={headerStyle}>
          <button
            onClick={() => navigate('/')}
            style={{
              background: 'transparent',
              border: 'none',
              color: THEME.muted,
              fontSize: 22,
              cursor: 'pointer',
              padding: 0
            }}
          >
            ←
          </button>
          <div style={{ fontSize: 18, fontWeight: 700, color: THEME.text }}>
            New Payment
          </div>
        </div>

        <div style={{ padding: '24px 20px', display: 'flex', flexDirection: 'column', gap: 20 }}>
          <AmountInput
            value={amountMxn}
            onChange={setAmountMxn}
            sourceAsset={sourceAsset}
            onSourceAssetChange={setSourceAsset}
            onSubmit={handleGenerateQR}
          />

          {error && (
            <div
              style={{
                padding: '12px 16px',
                background: `${THEME.error}15`,
                border: `1px solid ${THEME.error}40`,
                borderRadius: 12,
                color: THEME.error,
                fontSize: 14
              }}
            >
              {error}
            </div>
          )}

          {/* Tab selector */}
          <div
            style={{
              background: THEME.card,
              borderRadius: 14,
              padding: 4,
              display: 'flex',
              gap: 4
            }}
          >
            {(['qr', 'nfc'] as Tab[]).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                style={{
                  flex: 1,
                  background: activeTab === tab ? THEME.primary : 'transparent',
                  border: 'none',
                  borderRadius: 10,
                  color: activeTab === tab ? '#fff' : THEME.muted,
                  padding: '12px 0',
                  fontSize: 15,
                  fontWeight: activeTab === tab ? 700 : 400,
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8
                }}
              >
                {tab === 'qr' ? '▦ QR Code' : '📲 NFC Tag'}
              </button>
            ))}
          </div>

          <button
            onClick={handleGenerateQR}
            disabled={!amountMxn || parseFloat(amountMxn) <= 0}
            style={{
              background:
                !amountMxn || parseFloat(amountMxn) <= 0
                  ? `${THEME.primary}40`
                  : `linear-gradient(135deg, ${THEME.primary}, #7c3aed)`,
              border: 'none',
              borderRadius: 16,
              color: '#fff',
              padding: '18px 0',
              fontSize: 17,
              fontWeight: 700,
              cursor:
                !amountMxn || parseFloat(amountMxn) <= 0 ? 'not-allowed' : 'pointer',
              boxShadow:
                !amountMxn || parseFloat(amountMxn) <= 0
                  ? 'none'
                  : `0 4px 24px ${THEME.primary}50`
            }}
          >
            {activeTab === 'qr' ? 'Generate QR Code' : 'Activate NFC'}
          </button>
        </div>
      </div>
    )
  }

  // ── Display stage ──
  if (stage === 'display' && session) {
    return (
      <div style={containerStyle}>
        <div style={headerStyle}>
          <button
            onClick={handleReset}
            style={{
              background: 'transparent',
              border: 'none',
              color: THEME.muted,
              fontSize: 22,
              cursor: 'pointer',
              padding: 0
            }}
          >
            ←
          </button>
          <div style={{ fontSize: 18, fontWeight: 700, color: THEME.text }}>
            {activeTab === 'qr' ? 'Show QR to Customer' : 'NFC Payment'}
          </div>
        </div>

        <div style={{ padding: '24px 20px' }}>
          {/* Tabs */}
          <div
            style={{
              background: THEME.card,
              borderRadius: 14,
              padding: 4,
              display: 'flex',
              gap: 4,
              marginBottom: 24
            }}
          >
            {(['qr', 'nfc'] as Tab[]).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                style={{
                  flex: 1,
                  background: activeTab === tab ? THEME.primary : 'transparent',
                  border: 'none',
                  borderRadius: 10,
                  color: activeTab === tab ? '#fff' : THEME.muted,
                  padding: '12px 0',
                  fontSize: 14,
                  fontWeight: activeTab === tab ? 700 : 400,
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
              >
                {tab === 'qr' ? '▦ QR Code' : '📲 NFC'}
              </button>
            ))}
          </div>

          {activeTab === 'qr' && (
            <QRDisplay session={session} onSettled={() => setStage('settled')} />
          )}

          {activeTab === 'nfc' && (
            <NFCWriter
              payload={{
                token: session.token,
                merchant: session.merchantAddr,
                amount: session.amountMxn
              }}
              session={session}
              onSuccess={() => setStage('settled')}
            />
          )}
        </div>
      </div>
    )
  }

  // ── Settled stage ──
  if (stage === 'settled') {
    return (
      <div style={containerStyle}>
        <div style={{ padding: '24px 20px' }}>
          <PaymentResult
            status="settled"
            amount={session?.amountMxn || amountMxn}
            asset="MXN"
            txHash={null}
            onDone={handleReset}
          />
        </div>
      </div>
    )
  }

  return null
}

export default Pay
