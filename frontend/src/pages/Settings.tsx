import React, { useState, CSSProperties } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../store'
import { apiClient } from '../config/api'

const THEME = {
  bg: '#0a0a1a',
  card: '#1a1a2e',
  cardInner: '#16213e',
  primary: '#4f46e5',
  gold: '#f59e0b',
  success: '#10b981',
  error: '#ef4444',
  warning: '#f59e0b',
  text: '#e2e8f0',
  muted: '#64748b',
  border: 'rgba(255,255,255,0.08)'
}

const ASSET_ISSUERS: Record<string, { testnet: string; mainnet: string }> = {
  MXN: {
    testnet: 'GDVKY2GU2DRXWTBEYJJWSFXIGBZV6AZNBVVSUHEPZI54LIS6BA7DVVSP',
    mainnet: 'GDUKMGUGDZQK6YHYA5Z6AY2G4XDSZPSZ3SW5UN3ARVMO6QSRDWP5YWU'
  },
  USD: {
    testnet: 'GDUKMGUGDZQK6YHYA5Z6AY2G4XDSZPSZ3SW5UN3ARVMO6QSRDWP5YWU',
    mainnet: 'GDUKMGUGDZQK6YHYA5Z6AY2G4XDSZPSZ3SW5UN3ARVMO6QSRDWP5YWU'
  },
  GOLD: {
    testnet: 'GDVKY2GU2DRXWTBEYJJWSFXIGBZV6AZNBVVSUHEPZI54LIS6BA7DVVSP',
    mainnet: 'GDVKY2GU2DRXWTBEYJJWSFXIGBZV6AZNBVVSUHEPZI54LIS6BA7DVVSP'
  }
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        fontSize: 12,
        fontWeight: 700,
        color: THEME.muted,
        textTransform: 'uppercase',
        letterSpacing: '0.08em',
        marginBottom: 10,
        marginTop: 4
      }}
    >
      {children}
    </div>
  )
}

function SettingCard({ children, style }: { children: React.ReactNode; style?: CSSProperties }) {
  return (
    <div
      style={{
        background: THEME.card,
        borderRadius: 16,
        border: `1px solid ${THEME.border}`,
        overflow: 'hidden',
        ...style
      }}
    >
      {children}
    </div>
  )
}

export const Settings: React.FC = () => {
  const navigate = useNavigate()
  const { address, network, secretKey, setAddress, setNetwork, setSecretKey, clearAccount } =
    useStore((s) => ({
      address: s.address,
      network: s.network,
      secretKey: s.secretKey,
      setAddress: s.setAddress,
      setNetwork: s.setNetwork,
      setSecretKey: s.setSecretKey,
      clearAccount: s.clearAccount
    }))

  const [addrInput, setAddrInput] = useState(address || '')
  const [skInput, setSkInput] = useState(secretKey || '')
  const [showSK, setShowSK] = useState(false)
  const [showNetworkWarning, setShowNetworkWarning] = useState(false)
  const [pendingNetwork, setPendingNetwork] = useState<'testnet' | 'mainnet' | null>(null)
  const [trustlineStatus, setTrustlineStatus] = useState<Record<string, string>>({})
  const [saved, setSaved] = useState(false)

  const handleSaveAddress = () => {
    if (addrInput.trim().length > 0) {
      setAddress(addrInput.trim())
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    }
  }

  const handleSaveSecretKey = () => {
    setSecretKey(skInput.trim() || null)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const handleNetworkToggle = (newNetwork: 'testnet' | 'mainnet') => {
    if (newNetwork === network) return
    if (newNetwork === 'mainnet') {
      setPendingNetwork('mainnet')
      setShowNetworkWarning(true)
    } else {
      setNetwork(newNetwork)
    }
  }

  const handleConfirmMainnet = () => {
    if (pendingNetwork) setNetwork(pendingNetwork)
    setShowNetworkWarning(false)
    setPendingNetwork(null)
  }

  const handleAddTrustline = async (assetCode: string) => {
    if (!address) {
      setTrustlineStatus((s) => ({ ...s, [assetCode]: 'error:No address configured' }))
      return
    }
    setTrustlineStatus((s) => ({ ...s, [assetCode]: 'loading' }))
    try {
      const issuer = ASSET_ISSUERS[assetCode]?.[network]
      await apiClient.post('/account/trustline', {
        address,
        assetCode,
        assetIssuer: issuer,
        secretKey: secretKey
      })
      setTrustlineStatus((s) => ({ ...s, [assetCode]: 'success' }))
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed'
      setTrustlineStatus((s) => ({ ...s, [assetCode]: `error:${msg}` }))
    }
  }

  const containerStyle: CSSProperties = {
    minHeight: '100%',
    background: THEME.bg,
    paddingBottom: 80
  }

  const inputStyle: CSSProperties = {
    width: '100%',
    background: THEME.cardInner,
    border: `1px solid ${THEME.border}`,
    borderRadius: 10,
    padding: '12px 14px',
    color: THEME.text,
    fontSize: 13,
    fontFamily: 'monospace',
    outline: 'none',
    boxSizing: 'border-box'
  }

  const rowStyle: CSSProperties = {
    padding: '14px 16px',
    borderBottom: `1px solid ${THEME.border}`,
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center'
  }

  const badgeStyle = (ok: boolean): CSSProperties => ({
    fontSize: 12,
    fontWeight: 600,
    padding: '4px 10px',
    borderRadius: 8,
    background: ok ? `${THEME.success}20` : `${THEME.muted}20`,
    color: ok ? THEME.success : THEME.muted
  })

  return (
    <div style={containerStyle}>
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: '20px 20px 16px',
          borderBottom: `1px solid ${THEME.border}`
        }}
      >
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
          Settings
        </div>
      </div>

      <div style={{ padding: '24px 20px', display: 'flex', flexDirection: 'column', gap: 24 }}>

        {/* Account */}
        <div>
          <SectionTitle>Stellar Account</SectionTitle>
          <SettingCard>
            <div style={{ padding: '16px' }}>
              <div style={{ fontSize: 13, color: THEME.muted, marginBottom: 8 }}>
                Public Address (G...)
              </div>
              <input
                type="text"
                value={addrInput}
                onChange={(e) => setAddrInput(e.target.value)}
                placeholder="GABC...XYZ"
                style={inputStyle}
              />
              <button
                onClick={handleSaveAddress}
                style={{
                  marginTop: 12,
                  background: saved ? `${THEME.success}20` : `${THEME.primary}20`,
                  border: `1px solid ${saved ? THEME.success : THEME.primary}`,
                  borderRadius: 10,
                  color: saved ? THEME.success : THEME.primary,
                  padding: '10px 20px',
                  fontSize: 14,
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
              >
                {saved ? '✓ Saved' : 'Save Address'}
              </button>
            </div>
          </SettingCard>
        </div>

        {/* Secret Key */}
        <div>
          <SectionTitle>Secret Key (Demo Only)</SectionTitle>
          <div
            style={{
              background: `${THEME.warning}15`,
              border: `1px solid ${THEME.warning}40`,
              borderRadius: 12,
              padding: '12px 14px',
              marginBottom: 10,
              display: 'flex',
              gap: 10,
              alignItems: 'flex-start'
            }}
          >
            <span style={{ fontSize: 18, flexShrink: 0 }}>⚠️</span>
            <div style={{ fontSize: 12, color: THEME.warning, lineHeight: 1.6 }}>
              <strong>Security Warning:</strong> Never store real secret keys in a web app.
              This is for demo/testnet use only. Use Freighter wallet in production.
            </div>
          </div>
          <SettingCard>
            <div style={{ padding: '16px' }}>
              <div style={{ fontSize: 13, color: THEME.muted, marginBottom: 8 }}>
                Secret Key (S...)
              </div>
              <div style={{ position: 'relative' }}>
                <input
                  type={showSK ? 'text' : 'password'}
                  value={skInput}
                  onChange={(e) => setSkInput(e.target.value)}
                  placeholder="SABC...XYZ"
                  style={{ ...inputStyle, paddingRight: 44 }}
                />
                <button
                  onClick={() => setShowSK((v) => !v)}
                  style={{
                    position: 'absolute',
                    right: 12,
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none',
                    border: 'none',
                    color: THEME.muted,
                    cursor: 'pointer',
                    fontSize: 16
                  }}
                >
                  {showSK ? '🙈' : '👁'}
                </button>
              </div>
              <button
                onClick={handleSaveSecretKey}
                style={{
                  marginTop: 12,
                  background: `${THEME.primary}20`,
                  border: `1px solid ${THEME.primary}`,
                  borderRadius: 10,
                  color: THEME.primary,
                  padding: '10px 20px',
                  fontSize: 14,
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                Save Key
              </button>
            </div>
          </SettingCard>
        </div>

        {/* Network */}
        <div>
          <SectionTitle>Network</SectionTitle>
          <SettingCard>
            <div style={rowStyle}>
              <div>
                <div style={{ fontSize: 15, fontWeight: 600, color: THEME.text }}>
                  Testnet
                </div>
                <div style={{ fontSize: 12, color: THEME.muted }}>
                  Safe for development
                </div>
              </div>
              <button
                onClick={() => handleNetworkToggle('testnet')}
                style={{
                  width: 52,
                  height: 28,
                  borderRadius: 14,
                  background: network === 'testnet' ? THEME.success : THEME.cardInner,
                  border: `1px solid ${network === 'testnet' ? THEME.success : THEME.border}`,
                  cursor: 'pointer',
                  position: 'relative',
                  transition: 'all 0.2s'
                }}
              >
                <div
                  style={{
                    position: 'absolute',
                    top: 3,
                    left: network === 'testnet' ? 26 : 3,
                    width: 20,
                    height: 20,
                    borderRadius: '50%',
                    background: '#fff',
                    transition: 'left 0.2s'
                  }}
                />
              </button>
            </div>
            <div style={{ ...rowStyle, borderBottom: 'none' }}>
              <div>
                <div style={{ fontSize: 15, fontWeight: 600, color: THEME.text }}>
                  Mainnet
                </div>
                <div style={{ fontSize: 12, color: THEME.error }}>
                  Real funds — use with caution
                </div>
              </div>
              <button
                onClick={() => handleNetworkToggle('mainnet')}
                style={{
                  width: 52,
                  height: 28,
                  borderRadius: 14,
                  background: network === 'mainnet' ? THEME.error : THEME.cardInner,
                  border: `1px solid ${network === 'mainnet' ? THEME.error : THEME.border}`,
                  cursor: 'pointer',
                  position: 'relative',
                  transition: 'all 0.2s'
                }}
              >
                <div
                  style={{
                    position: 'absolute',
                    top: 3,
                    left: network === 'mainnet' ? 26 : 3,
                    width: 20,
                    height: 20,
                    borderRadius: '50%',
                    background: '#fff',
                    transition: 'left 0.2s'
                  }}
                />
              </button>
            </div>
          </SettingCard>
        </div>

        {/* Trustlines */}
        <div>
          <SectionTitle>Asset Trustlines</SectionTitle>
          <SettingCard>
            {['MXN', 'USD', 'GOLD'].map((asset, i, arr) => {
              const st = trustlineStatus[asset]
              const isLoading = st === 'loading'
              const isSuccess = st === 'success'
              const isError = st?.startsWith('error:')
              const errorMsg = isError ? st.slice(6) : null
              return (
                <div
                  key={asset}
                  style={{
                    ...rowStyle,
                    flexDirection: 'column',
                    alignItems: 'stretch',
                    borderBottom: i < arr.length - 1 ? `1px solid ${THEME.border}` : 'none'
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center'
                    }}
                  >
                    <div>
                      <div style={{ fontSize: 15, fontWeight: 600, color: THEME.text }}>
                        {asset}
                      </div>
                      <div style={{ fontSize: 12, color: THEME.muted }}>
                        Enable {asset} balance
                      </div>
                    </div>
                    {isSuccess ? (
                      <span style={badgeStyle(true)}>✓ Active</span>
                    ) : (
                      <button
                        onClick={() => handleAddTrustline(asset)}
                        disabled={isLoading}
                        style={{
                          background: `${THEME.primary}20`,
                          border: `1px solid ${THEME.primary}`,
                          borderRadius: 10,
                          color: THEME.primary,
                          padding: '8px 14px',
                          fontSize: 13,
                          fontWeight: 600,
                          cursor: isLoading ? 'not-allowed' : 'pointer',
                          opacity: isLoading ? 0.6 : 1
                        }}
                      >
                        {isLoading ? 'Adding...' : 'Add Trustline'}
                      </button>
                    )}
                  </div>
                  {isError && (
                    <div style={{ fontSize: 12, color: THEME.error, marginTop: 6 }}>
                      {errorMsg}
                    </div>
                  )}
                </div>
              )
            })}
          </SettingCard>
        </div>

        {/* Danger zone */}
        <div>
          <SectionTitle>Account</SectionTitle>
          <SettingCard>
            <div style={{ ...rowStyle, borderBottom: 'none' }}>
              <div>
                <div style={{ fontSize: 15, fontWeight: 600, color: THEME.error }}>
                  Disconnect Account
                </div>
                <div style={{ fontSize: 12, color: THEME.muted }}>
                  Clear all saved data
                </div>
              </div>
              <button
                onClick={() => {
                  clearAccount()
                  setSecretKey(null)
                  setAddrInput('')
                  setSkInput('')
                }}
                style={{
                  background: `${THEME.error}20`,
                  border: `1px solid ${THEME.error}40`,
                  borderRadius: 10,
                  color: THEME.error,
                  padding: '8px 14px',
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                Disconnect
              </button>
            </div>
          </SettingCard>
        </div>

        {/* App info */}
        <div style={{ textAlign: 'center', fontSize: 12, color: THEME.muted, paddingBottom: 8 }}>
          Centurion Pay v1.0.0 · Stellar Network · {network}
        </div>
      </div>

      {/* Network warning modal */}
      {showNetworkWarning && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.85)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 999,
            padding: 20
          }}
        >
          <div
            style={{
              background: THEME.card,
              borderRadius: 20,
              padding: 28,
              maxWidth: 340,
              width: '100%',
              border: `2px solid ${THEME.error}60`
            }}
          >
            <div style={{ fontSize: 36, textAlign: 'center', marginBottom: 16 }}>⚠️</div>
            <div
              style={{
                fontSize: 18,
                fontWeight: 700,
                color: THEME.text,
                textAlign: 'center',
                marginBottom: 12
              }}
            >
              Switch to Mainnet?
            </div>
            <div
              style={{
                fontSize: 14,
                color: THEME.muted,
                textAlign: 'center',
                lineHeight: 1.6,
                marginBottom: 24
              }}
            >
              Mainnet uses <strong style={{ color: THEME.error }}>real funds</strong>. All
              transactions are irreversible. Proceed only if you know what you're doing.
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                onClick={() => {
                  setShowNetworkWarning(false)
                  setPendingNetwork(null)
                }}
                style={{
                  flex: 1,
                  background: 'transparent',
                  border: `1px solid ${THEME.border}`,
                  borderRadius: 12,
                  color: THEME.muted,
                  padding: '14px 0',
                  fontSize: 15,
                  cursor: 'pointer'
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmMainnet}
                style={{
                  flex: 1,
                  background: THEME.error,
                  border: 'none',
                  borderRadius: 12,
                  color: '#fff',
                  padding: '14px 0',
                  fontSize: 15,
                  fontWeight: 700,
                  cursor: 'pointer'
                }}
              >
                Switch to Mainnet
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default Settings
