import React, { useState, useCallback, CSSProperties } from 'react'
import { useNavigate } from 'react-router-dom'
import { QRScanner } from '../components/QRDisplay/QRScanner'
import { NFCReader } from '../components/NFCPayment/NFCReader'
import { ConfirmPayment } from '../components/PaymentFlow/ConfirmPayment'
import { PaymentResult } from '../components/PaymentFlow/PaymentResult'
import { usePathPayment } from '../hooks/usePathPayment'
import { useStore } from '../store'
import type { PathQuote } from '../types/payment'

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

type Stage = 'select' | 'scanning' | 'nfc' | 'confirm' | 'settled' | 'failed'

interface ParsedPayment {
  token: string
  merchant: string
  amount: string
}

function parseQRUrl(url: string): ParsedPayment | null {
  try {
    const u = new URL(url)
    const token = u.searchParams.get('token')
    const merchant = u.searchParams.get('merchant')
    const amount = u.searchParams.get('amount')
    if (token && merchant && amount) return { token, merchant, amount }
  } catch {
    // Try parsing as plain JSON QR payload
    try {
      const parsed = JSON.parse(url) as Partial<ParsedPayment>
      if (parsed.token && parsed.merchant && parsed.amount) {
        return parsed as ParsedPayment
      }
    } catch {
      // Not JSON either
    }
  }
  return null
}

export const Receive: React.FC = () => {
  const navigate = useNavigate()
  const { address, network } = useStore((s) => ({
    address: s.address,
    network: s.network
  }))

  const [stage, setStage] = useState<Stage>('select')
  const [sourceAsset, setSourceAsset] = useState('USD')
  const [parsedPayment, setParsedPayment] = useState<ParsedPayment | null>(null)
  const [quote, setQuote] = useState<PathQuote | null>(null)
  const [txHash, setTxHash] = useState<string | null>(null)
  const [localError, setLocalError] = useState<string | null>(null)

  const { getQuoteForPayment, buildUnsignedTx, signLocally, submitSigned, isLoading, error: paymentError } =
    usePathPayment()

  const secretKey = useStore((s) => s.secretKey)

  const handleScanned = useCallback(
    async (rawData: string) => {
      setStage('select') // close scanner UI first

      const parsed = parseQRUrl(rawData)
      if (!parsed) {
        setLocalError('Invalid QR code. Please scan a Centurion payment QR.')
        return
      }

      setParsedPayment(parsed)
      setLocalError(null)

      // Get quote immediately
      const q = await getQuoteForPayment(sourceAsset, parsed.amount)
      if (q) {
        setQuote(q)
        setStage('confirm')
      } else {
        setStage('failed')
      }
    },
    [getQuoteForPayment, sourceAsset]
  )

  const handleNFCDetected = useCallback(
    async (token: string, merchant: string, amount: string) => {
      const parsed: ParsedPayment = { token, merchant, amount }
      setParsedPayment(parsed)
      setLocalError(null)

      const q = await getQuoteForPayment(sourceAsset, amount)
      if (q) {
        setQuote(q)
        setStage('confirm')
      } else {
        setStage('failed')
      }
    },
    [getQuoteForPayment, sourceAsset]
  )

  const handleConfirm = async () => {
    if (!quote || !parsedPayment || !address) return

    const built = await buildUnsignedTx(quote, address, parsedPayment.merchant)
    if (!built) {
      setStage('failed')
      return
    }

    const sk = secretKey || ''
    if (!sk) {
      setLocalError('No secret key set. Please configure it in Settings.')
      setStage('failed')
      return
    }

    const signed = await signLocally(built.unsignedXdr, sk)
    const hash = await submitSigned(signed, built.paymentId)

    if (hash) {
      setTxHash(hash)
      setStage('settled')
    } else {
      setStage('failed')
    }
  }

  const handleReset = () => {
    setParsedPayment(null)
    setQuote(null)
    setTxHash(null)
    setLocalError(null)
    setStage('select')
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

  // ── QR Scanner overlay ──
  if (stage === 'scanning') {
    return (
      <QRScanner
        onScan={handleScanned}
        onError={(err) => {
          setLocalError(err)
          setStage('select')
        }}
        onClose={() => setStage('select')}
      />
    )
  }

  // ── NFC Reader overlay ──
  if (stage === 'nfc') {
    return (
      <div style={containerStyle}>
        <div style={headerStyle}>
          <button
            onClick={() => setStage('select')}
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
            NFC Payment
          </div>
        </div>
        <div style={{ padding: '24px 20px' }}>
          <NFCReader
            onPaymentDetected={handleNFCDetected}
            onError={(err) => {
              setLocalError(err)
              setStage('select')
            }}
            onClose={() => setStage('select')}
          />
        </div>
      </div>
    )
  }

  // ── Confirm payment sheet ──
  if (stage === 'confirm' && quote && parsedPayment) {
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
            Review Payment
          </div>
        </div>
        <div style={{ padding: '24px 20px' }}>
          <ConfirmPayment
            quote={quote}
            senderAsset={sourceAsset}
            merchantAddress={parsedPayment.merchant}
            isLoading={isLoading}
            error={localError || paymentError}
            onConfirm={handleConfirm}
            onCancel={handleReset}
          />
        </div>
      </div>
    )
  }

  // ── Result stages ──
  if (stage === 'settled' || stage === 'failed') {
    return (
      <div style={containerStyle}>
        <div style={{ padding: '24px 20px' }}>
          <PaymentResult
            status={stage}
            txHash={txHash}
            error={paymentError || localError}
            amount={parsedPayment?.amount}
            asset="MXN"
            network={network}
            onRetry={stage === 'failed' ? handleReset : undefined}
            onDone={() => navigate('/')}
          />
        </div>
      </div>
    )
  }

  // ── Select method stage ──
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
          Make a Payment
        </div>
      </div>

      <div style={{ padding: '28px 20px', display: 'flex', flexDirection: 'column', gap: 20 }}>
        {/* Source asset selector */}
        <div
          style={{
            background: THEME.card,
            borderRadius: 16,
            padding: 20,
            border: `1px solid ${THEME.border}`
          }}
        >
          <div
            style={{
              fontSize: 12,
              color: THEME.muted,
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              marginBottom: 12
            }}
          >
            Pay From
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            {['USD', 'GOLD', 'XLM'].map((asset) => (
              <button
                key={asset}
                onClick={() => setSourceAsset(asset)}
                style={{
                  flex: 1,
                  background:
                    sourceAsset === asset
                      ? `${THEME.primary}30`
                      : 'transparent',
                  border: `1px solid ${
                    sourceAsset === asset ? THEME.primary : THEME.border
                  }`,
                  borderRadius: 12,
                  color: sourceAsset === asset ? THEME.text : THEME.muted,
                  padding: '12px 0',
                  fontSize: 14,
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

        {localError && (
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
            {localError}
          </div>
        )}

        {/* Scan QR button */}
        <button
          onClick={() => {
            setLocalError(null)
            setStage('scanning')
          }}
          style={{
            background: `linear-gradient(135deg, ${THEME.primary}, #7c3aed)`,
            border: 'none',
            borderRadius: 18,
            color: '#fff',
            padding: '22px 0',
            fontSize: 18,
            fontWeight: 700,
            cursor: 'pointer',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 8,
            boxShadow: `0 4px 24px ${THEME.primary}50`
          }}
        >
          <span style={{ fontSize: 32 }}>▦</span>
          <span>Scan QR Code</span>
        </button>

        {/* Tap NFC button */}
        <button
          onClick={() => {
            setLocalError(null)
            setStage('nfc')
          }}
          style={{
            background: THEME.card,
            border: `1px solid ${THEME.border}`,
            borderRadius: 18,
            color: THEME.text,
            padding: '22px 0',
            fontSize: 18,
            fontWeight: 600,
            cursor: 'pointer',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 8
          }}
        >
          <span style={{ fontSize: 32 }}>📳</span>
          <span>Tap NFC</span>
          <span style={{ fontSize: 11, color: THEME.muted, fontWeight: 400 }}>
            Android Chrome only
          </span>
        </button>
      </div>
    </div>
  )
}

export default Receive
