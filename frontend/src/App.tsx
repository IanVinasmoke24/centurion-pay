import React, { useState, CSSProperties } from 'react'
import { BrowserRouter, Routes, Route, useLocation, useNavigate } from 'react-router-dom'
import { Home } from './pages/Home'
import { Pay } from './pages/Pay'
import { Receive } from './pages/Receive'
import { Settings } from './pages/Settings'
import { useStore } from './store'

const THEME = {
  bg: '#0a0a1a',
  card: '#1a1a2e',
  primary: '#4f46e5',
  gold: '#f59e0b',
  text: '#e2e8f0',
  muted: '#64748b',
  border: 'rgba(255,255,255,0.08)'
}

// ─── Address setup screen shown when no address is configured ──────────────

const AddressSetup: React.FC = () => {
  const setAddress = useStore((s) => s.setAddress)
  const [input, setInput] = useState('')
  const [error, setError] = useState<string | null>(null)

  const handleContinue = () => {
    const trimmed = input.trim()
    if (!trimmed.startsWith('G') || trimmed.length !== 56) {
      setError('Please enter a valid Stellar address (starts with G, 56 chars).')
      return
    }
    setError(null)
    setAddress(trimmed)
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        background: THEME.bg,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px 20px'
      }}
    >
      {/* Logo */}
      <div
        style={{
          width: 80,
          height: 80,
          borderRadius: 20,
          background: `linear-gradient(135deg, ${THEME.primary}, #7c3aed)`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 42,
          fontWeight: 900,
          color: '#fff',
          marginBottom: 24,
          boxShadow: `0 8px 32px ${THEME.primary}60`
        }}
      >
        C
      </div>

      <div style={{ textAlign: 'center', marginBottom: 40, maxWidth: 300 }}>
        <h1
          style={{
            fontSize: 28,
            fontWeight: 800,
            color: THEME.text,
            margin: '0 0 8px',
            letterSpacing: '-0.02em'
          }}
        >
          Centurion Pay
        </h1>
        <p style={{ fontSize: 15, color: THEME.muted, margin: 0, lineHeight: 1.5 }}>
          Stellar-powered payments. Fast, borderless, secure.
        </p>
      </div>

      <div
        style={{
          background: THEME.card,
          borderRadius: 20,
          padding: '28px 24px',
          width: '100%',
          maxWidth: 400,
          border: `1px solid ${THEME.border}`
        }}
      >
        <div
          style={{
            fontSize: 14,
            fontWeight: 600,
            color: THEME.text,
            marginBottom: 10
          }}
        >
          Enter your Stellar Address
        </div>
        <input
          type="text"
          value={input}
          onChange={(e) => {
            setInput(e.target.value)
            setError(null)
          }}
          placeholder="GABC...XYZ (56 characters)"
          style={{
            width: '100%',
            background: '#16213e',
            border: `1px solid ${error ? '#ef4444' : THEME.border}`,
            borderRadius: 12,
            padding: '14px 16px',
            color: THEME.text,
            fontSize: 14,
            fontFamily: 'monospace',
            outline: 'none',
            boxSizing: 'border-box',
            marginBottom: 8
          }}
        />
        {error && (
          <div style={{ fontSize: 12, color: '#ef4444', marginBottom: 12 }}>{error}</div>
        )}
        <div style={{ fontSize: 12, color: THEME.muted, marginBottom: 20, lineHeight: 1.5 }}>
          Use your Stellar testnet address to get started. You can change this in Settings.
        </div>
        <button
          onClick={handleContinue}
          style={{
            width: '100%',
            background: `linear-gradient(135deg, ${THEME.primary}, #7c3aed)`,
            border: 'none',
            borderRadius: 14,
            color: '#fff',
            padding: '16px 0',
            fontSize: 16,
            fontWeight: 700,
            cursor: 'pointer',
            boxShadow: `0 4px 20px ${THEME.primary}40`
          }}
        >
          Continue →
        </button>

        {/* Demo address button */}
        <button
          onClick={() => {
            setInput('GAHTJRC6ZHFVMQJWVZQIIG3AMHPPCQVKW6RJTDOQJSMCLC6L3ZKMAEF')
            setError(null)
          }}
          style={{
            width: '100%',
            background: 'transparent',
            border: `1px solid ${THEME.border}`,
            borderRadius: 12,
            color: THEME.muted,
            padding: '12px 0',
            fontSize: 13,
            cursor: 'pointer',
            marginTop: 10
          }}
        >
          Use Demo Address (Testnet)
        </button>
      </div>
    </div>
  )
}

// ─── Bottom navigation bar ─────────────────────────────────────────────────

interface NavItem {
  path: string
  label: string
  icon: string
  activeIcon: string
}

const NAV_ITEMS: NavItem[] = [
  { path: '/', label: 'Home', icon: '⌂', activeIcon: '⌂' },
  { path: '/pay', label: 'Pay', icon: '↑', activeIcon: '↑' },
  { path: '/receive', label: 'Receive', icon: '↓', activeIcon: '↓' },
  { path: '/settings', label: 'Settings', icon: '⚙', activeIcon: '⚙' }
]

const BottomNav: React.FC = () => {
  const location = useLocation()
  const navigate = useNavigate()

  const navStyle: CSSProperties = {
    position: 'fixed',
    bottom: 0,
    left: 0,
    right: 0,
    background: THEME.card,
    borderTop: `1px solid ${THEME.border}`,
    display: 'flex',
    padding: '8px 0 calc(8px + env(safe-area-inset-bottom, 0))',
    zIndex: 100,
    backdropFilter: 'blur(20px)',
    WebkitBackdropFilter: 'blur(20px)'
  }

  return (
    <nav style={navStyle}>
      {NAV_ITEMS.map((item) => {
        const isActive = location.pathname === item.path
        return (
          <button
            key={item.path}
            onClick={() => navigate(item.path)}
            style={{
              flex: 1,
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 4,
              padding: '6px 0',
              color: isActive ? THEME.primary : THEME.muted,
              transition: 'color 0.2s'
            }}
          >
            <span
              style={{
                fontSize: 22,
                lineHeight: 1,
                display: 'block'
              }}
            >
              {isActive ? item.activeIcon : item.icon}
            </span>
            <span
              style={{
                fontSize: 10,
                fontWeight: isActive ? 700 : 400,
                letterSpacing: '0.02em'
              }}
            >
              {item.label}
            </span>
            {isActive && (
              <div
                style={{
                  position: 'absolute',
                  bottom: 0,
                  width: 32,
                  height: 3,
                  background: THEME.primary,
                  borderRadius: '3px 3px 0 0'
                }}
              />
            )}
          </button>
        )
      })}
    </nav>
  )
}

// ─── App shell ─────────────────────────────────────────────────────────────

const AppShell: React.FC = () => {
  const address = useStore((s) => s.address)

  if (!address) {
    return <AddressSetup />
  }

  return (
    <div
      style={{
        height: '100vh',
        display: 'flex',
        flexDirection: 'column',
        background: THEME.bg,
        overflow: 'hidden'
      }}
    >
      <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden' }}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/pay" element={<Pay />} />
          <Route path="/receive" element={<Receive />} />
          <Route path="/settings" element={<Settings />} />
          {/* Fallback */}
          <Route path="*" element={<Home />} />
        </Routes>
      </div>
      <BottomNav />
    </div>
  )
}

// ─── Root App component ────────────────────────────────────────────────────

const App: React.FC = () => {
  return (
    <>
      <style>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }
        html, body, #root {
          height: 100%;
          background: #0a0a1a;
          color: #e2e8f0;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
          -webkit-font-smoothing: antialiased;
          -moz-osx-font-smoothing: grayscale;
        }
        input[type=number]::-webkit-inner-spin-button,
        input[type=number]::-webkit-outer-spin-button {
          -webkit-appearance: none;
          margin: 0;
        }
        input[type=number] { -moz-appearance: textfield; }
        ::-webkit-scrollbar { width: 4px; height: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.15); border-radius: 2px; }
        ::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.25); }
        button { font-family: inherit; }
        a { color: inherit; }
      `}</style>
      <BrowserRouter>
        <AppShell />
      </BrowserRouter>
    </>
  )
}

export default App
