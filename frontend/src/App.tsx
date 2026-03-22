import { useState, useEffect, useRef, useCallback } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import { Asset } from '@stellar/stellar-sdk'
import { generateWallet, loadWallet, importWallet, clearWallet } from './stellar/wallet'
import { fundViaFriendbot, getBalances, getTransactions, getLatestLedger, getRecentPayments, streamPayments, Balance, StellarTransaction } from './stellar/horizon'
import { buildAndSubmitPayment, buildAndSubmitPathPayment } from './stellar/payments'
import { buildPaymentURI, parsePaymentURI, ParsedPayment } from './stellar/qr'
import { ASSETS, USDC_ISSUER, NETWORK } from './stellar/config'

// ─── DESIGN TOKENS ────────────────────────────────────────────────────────────
const C = {
  bg: '#050510',
  surface: '#0d0d2b',
  card: '#13132e',
  border: '#1e1e4a',
  primary: '#6366f1',
  primaryGlow: 'rgba(99,102,241,0.3)',
  gold: '#f59e0b',
  goldGlow: 'rgba(245,158,11,0.3)',
  green: '#10b981',
  greenGlow: 'rgba(16,185,129,0.25)',
  red: '#ef4444',
  text: '#e2e8f0',
  textMuted: '#94a3b8',
  textDim: '#475569',
}

// ─── CSS ANIMATIONS ────────────────────────────────────────────────────────────
const GLOBAL_CSS = `
  @keyframes fadeIn { from { opacity:0; transform:translateY(12px); } to { opacity:1; transform:translateY(0); } }
  @keyframes slideUp { from { opacity:0; transform:translateY(40px); } to { opacity:1; transform:translateY(0); } }
  @keyframes pulse { 0%,100% { opacity:1; transform:scale(1); } 50% { opacity:0.6; transform:scale(1.08); } }
  @keyframes spin { to { transform:rotate(360deg); } }
  @keyframes ripple { 0% { transform:scale(0.8); opacity:1; } 100% { transform:scale(2.4); opacity:0; } }
  @keyframes shimmer { 0% { background-position:200% 0; } 100% { background-position:-200% 0; } }
  @keyframes scanLine { 0%,100% { transform:translateY(0); } 50% { transform:translateY(140px); } }
  @keyframes checkDraw { from { stroke-dashoffset:100; } to { stroke-dashoffset:0; } }
  @keyframes circleFill { from { stroke-dashoffset:283; } to { stroke-dashoffset:0; } }
  @keyframes confettiFall0  { 0%{transform:translateY(-10px) rotate(0deg);opacity:1;}  100%{transform:translateY(600px) rotate(720deg);opacity:0;} }
  @keyframes confettiFall1  { 0%{transform:translateY(-10px) rotate(45deg);opacity:1;} 100%{transform:translateY(650px) rotate(-540deg);opacity:0;} }
  @keyframes confettiFall2  { 0%{transform:translateY(-10px) rotate(90deg);opacity:1;} 100%{transform:translateY(580px) rotate(360deg);opacity:0;} }
  @keyframes confettiFall3  { 0%{transform:translateY(-10px) rotate(135deg);opacity:1;}100%{transform:translateY(700px) rotate(-720deg);opacity:0;} }
  @keyframes confettiFall4  { 0%{transform:translateY(-10px) rotate(180deg);opacity:1;}100%{transform:translateY(620px) rotate(540deg);opacity:0;} }
  @keyframes confettiFall5  { 0%{transform:translateY(-10px) rotate(225deg);opacity:1;}100%{transform:translateY(670px) rotate(-360deg);opacity:0;} }
  @keyframes bgFloat { 0%,100%{transform:translate(0,0) scale(1);} 33%{transform:translate(20px,-15px) scale(1.05);} 66%{transform:translate(-15px,20px) scale(0.97);} }
  @keyframes ledgerPing { 0%{transform:scale(1);opacity:1;} 50%{transform:scale(1.6);opacity:0.3;} 100%{transform:scale(1);opacity:1;} }
  @keyframes stepAppear { from{opacity:0;transform:translateX(-8px);} to{opacity:1;transform:translateX(0);} }
  @keyframes glow { 0%,100%{box-shadow:0 0 20px rgba(99,102,241,0.3);} 50%{box-shadow:0 0 40px rgba(99,102,241,0.6), 0 0 80px rgba(99,102,241,0.2);} }
  @keyframes numberTick { from{transform:translateY(8px);opacity:0;} to{transform:translateY(0);opacity:1;} }
  @keyframes breathe { 0%,100%{transform:scale(1);} 50%{transform:scale(1.04);} }
  .fade-in { animation: fadeIn 0.4s ease forwards; }
  .slide-up { animation: slideUp 0.5s cubic-bezier(0.16,1,0.3,1) forwards; }
  ::-webkit-scrollbar { width: 4px; }
  ::-webkit-scrollbar-track { background: transparent; }
  ::-webkit-scrollbar-thumb { background: #1e1e4a; border-radius: 2px; }
`

// ─── DISPLAY RATES ────────────────────────────────────────────────────────────
const DR = { XLM_MXN: 17.50, USDC_MXN: 17.23 }

// ─── HELPERS ──────────────────────────────────────────────────────────────────
function fmt(n: number, decimals = 2) {
  return n.toLocaleString('es-MX', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
}

function abbrev(addr: string, chars = 6) {
  if (!addr || addr.length < chars * 2) return addr
  return `${addr.slice(0, chars)}...${addr.slice(-chars)}`
}

function timeAgo(iso: string): string {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000
  if (diff < 60) return 'hace un momento'
  if (diff < 3600) return `hace ${Math.floor(diff / 60)}m`
  if (diff < 86400) return `hace ${Math.floor(diff / 3600)}h`
  return `hace ${Math.floor(diff / 86400)}d`
}


// ─── CENTURION LOGO ────────────────────────────────────────────────────────────
function LogoStar({ size = 56, glow = false }: { size?: number; glow?: boolean }) {
  // 6-pointed nautical star + dotted orbit + orbital swoosh — no defs, no shared IDs
  const cx = 100, cy = 100
  // Outer tips (r=58) and inner vertices (r=24) for the 6-point star
  // Angles: tips at 0°,60°,120°,180°,240°,300° (top=270° in math = -90°)
  const tip = (i: number, r: number) => {
    const a = (i * 60 - 90) * Math.PI / 180
    return [cx + r * Math.cos(a), cy + r * Math.sin(a)]
  }
  const inn = (i: number, r: number) => {
    const a = (i * 60 - 60) * Math.PI / 180
    return [cx + r * Math.cos(a), cy + r * Math.sin(a)]
  }
  // 6 outer tips, 6 inner vertices interleaved
  const T = Array.from({ length: 6 }, (_, i) => tip(i, 58))
  const V = Array.from({ length: 6 }, (_, i) => inn(i, 22))
  // Colors per face — light from upper-left
  const bright = ['#ffffff','#f0f0f0','#d0d0d0','#a0a0a0','#c0c0c0','#e8e8e8']
  const dark   = ['#e0e0e0','#b8b8b8','#909090','#888888','#b0b0b0','#d8d8d8']
  const p = (pts: number[][]) => pts.map(([x,y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ')
  return (
    <svg width={size} height={size} viewBox="0 0 200 200"
      style={{ flexShrink: 0, filter: glow ? 'drop-shadow(0 0 14px rgba(255,255,255,0.45))' : undefined }}>
      {/* Dotted orbit circle */}
      <circle cx={cx} cy={cy} r="76" fill="none" stroke="rgba(255,255,255,0.75)"
        strokeWidth="2.2" strokeDasharray="3.5 6" strokeLinecap="round" />
      {/* Back orbital swoosh (behind star) */}
      <path d="M 178,85 Q 100,52 22,115"
        fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="2.8" strokeLinecap="round" />
      {/* Star — 12 triangular faces */}
      {Array.from({ length: 6 }, (_, i) => (
        <g key={i}>
          <polygon points={p([[cx,cy], V[i],       T[i]])} fill={bright[i]} />
          <polygon points={p([[cx,cy], T[i], V[(i+1)%6]])} fill={dark[i]}   />
        </g>
      ))}
      {/* Front orbital swoosh (in front of star) */}
      <path d="M 22,115 Q 100,148 178,85"
        fill="none" stroke="rgba(255,255,255,0.9)" strokeWidth="2.8" strokeLinecap="round" />
    </svg>
  )
}

function Spinner({ size = 20, color = C.primary }: { size?: number; color?: string }) {
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%',
      border: `2px solid ${color}30`,
      borderTopColor: color,
      animation: 'spin 0.8s linear infinite',
      flexShrink: 0,
    }} />
  )
}

function Confetti({ show }: { show: boolean }) {
  if (!show) return null
  const pieces = Array.from({ length: 24 })
  const colors = [C.gold, C.primary, C.green, '#8b5cf6', '#ec4899', '#06b6d4']
  return (
    <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 9999, overflow: 'hidden' }}>
      {pieces.map((_, i) => (
        <div key={i} style={{
          position: 'absolute',
          left: `${(i / pieces.length) * 100}%`,
          top: '-20px',
          width: 8 + (i % 4) * 2,
          height: 8 + (i % 3) * 2,
          borderRadius: i % 2 === 0 ? '50%' : 2,
          background: colors[i % colors.length],
          animation: `confettiFall${i % 6} ${1.5 + (i % 8) * 0.3}s ease-in ${(i % 5) * 0.1}s forwards`,
        }} />
      ))}
    </div>
  )
}

// ─── BOTTOM NAV ───────────────────────────────────────────────────────────────
function BottomNav({ view, setView }: { view: string; setView: (v: string) => void }) {
  const items = [
    { id: 'home', label: 'Inicio', icon: '⌂' },
    { id: 'pay', label: 'Cobrar', icon: '↓' },
    { id: 'receive', label: 'Pagar', icon: '↑' },
    { id: 'transfer', label: 'Enviar', icon: '→' },
    { id: 'history', label: 'Historial', icon: '☰' },
    { id: 'settings', label: 'Config', icon: '⚙' },
  ]
  return (
    <div style={{
      position: 'fixed', bottom: 0, left: 0, right: 0, height: 64,
      background: 'rgba(13,13,43,0.97)', borderTop: `1px solid ${C.border}`,
      display: 'flex', backdropFilter: 'blur(20px)', zIndex: 200,
    }}>
      {items.map(item => {
        const active = view === item.id
        return (
          <button key={item.id} onClick={() => setView(item.id)} style={{
            flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
            justifyContent: 'center', gap: 2, border: 'none', background: 'none',
            cursor: 'pointer', transition: 'all 0.2s', position: 'relative',
            color: active ? C.primary : C.textDim,
          }}>
            <span style={{ fontSize: 18, lineHeight: 1 }}>{item.icon}</span>
            <span style={{ fontSize: 9, fontWeight: active ? 700 : 400, letterSpacing: '0.02em' }}>{item.label}</span>
            {active && <span style={{
              position: 'absolute', bottom: 0, width: 28, height: 2,
              background: C.primary, borderRadius: 2,
              boxShadow: `0 0 8px ${C.primaryGlow}`,
            }} />}
          </button>
        )
      })}
    </div>
  )
}

function BackBtn({ onBack }: { onBack: () => void }) {
  return (
    <button onClick={onBack} style={{
      background: 'none', border: 'none', color: C.textMuted,
      fontSize: 14, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
      padding: '8px 0', fontWeight: 500,
    }}>
      <span style={{ fontSize: 18 }}>←</span> Volver
    </button>
  )
}

function StellarBadge({ ledger }: { ledger: number }) {
  return (
    <div style={{
      position: 'fixed', bottom: 72, right: 12, zIndex: 100,
      display: 'flex', alignItems: 'center', gap: 6,
      background: 'rgba(13,13,43,0.92)', border: `1px solid ${C.border}`,
      borderRadius: 20, padding: '5px 10px', backdropFilter: 'blur(12px)',
      fontSize: 10, color: C.textMuted, fontWeight: 500,
      boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
    }}>
      <span style={{
        width: 7, height: 7, borderRadius: '50%', background: C.green,
        display: 'inline-block', flexShrink: 0,
        animation: 'ledgerPing 2s ease-in-out infinite',
      }} />
      <span style={{ color: C.green, fontWeight: 700 }}>Stellar Testnet</span>
      <span style={{ color: C.textDim }}>•</span>
      <span>#{ledger > 0 ? ledger.toLocaleString() : '...'}</span>
    </div>
  )
}

// ─── SCREEN: WALLET SETUP ─────────────────────────────────────────────────────
function WalletSetup({ onWalletReady }: { onWalletReady: (wallet: { publicKey: string; secretKey: string }) => void }) {
  const [mode, setMode] = useState<'landing' | 'created' | 'import'>('landing')
  const [wallet, setWallet] = useState<{ publicKey: string; secretKey: string } | null>(null)
  const [importSecret, setImportSecret] = useState('')
  const [importError, setImportError] = useState('')
  const [copied, setCopied] = useState(false)

  const handleCreate = () => {
    const w = generateWallet()
    setWallet(w)
    setMode('created')
  }

  const handleImport = () => {
    setImportError('')
    const w = importWallet(importSecret)
    if (!w) {
      setImportError('Clave secreta inválida. Debe comenzar con S y tener 56 caracteres.')
      return
    }
    onWalletReady(w)
  }

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text).catch(() => {})
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <div style={{
      width: '100%', height: '100%', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', padding: 28,
      background: C.bg, position: 'relative', overflow: 'hidden',
    }}>
      <div style={{
        position: 'absolute', width: 400, height: 400, borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(99,102,241,0.12) 0%, transparent 70%)',
        top: -100, left: -100, animation: 'bgFloat 8s ease-in-out infinite',
      }} />
      <div style={{
        position: 'absolute', width: 300, height: 300, borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(245,158,11,0.10) 0%, transparent 70%)',
        bottom: -50, right: -50, animation: 'bgFloat 10s ease-in-out infinite reverse',
      }} />

      <div className="slide-up" style={{ width: '100%', maxWidth: 360, position: 'relative', zIndex: 1, textAlign: 'center' }}>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 14 }}>
          <LogoStar size={86} glow />
        </div>
        <h1 style={{
          fontSize: 44, fontWeight: 900, letterSpacing: '0.08em', lineHeight: 1,
          color: '#ffffff', textShadow: '0 0 40px rgba(255,255,255,0.15)',
          marginBottom: 6,
        }}>
          CENTURION
        </h1>
        <p style={{ fontSize: 12, color: C.textMuted, letterSpacing: '0.3em', textTransform: 'uppercase', marginBottom: 32 }}>
          PAY • Stellar Testnet
        </p>

        {mode === 'landing' && (
          <>
            <p style={{ fontSize: 16, color: C.text, marginBottom: 36, lineHeight: 1.5 }}>
              Pagos instantáneos en la red Stellar.<br />
              <span style={{ color: C.gold }}>Sin banco. Sin fronteras.</span>
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <button onClick={handleCreate} style={{
                padding: '16px 24px',
                background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
                border: 'none', borderRadius: 14, color: '#fff',
                fontSize: 16, fontWeight: 700, cursor: 'pointer',
                boxShadow: `0 8px 32px ${C.primaryGlow}`,
                animation: 'glow 3s ease-in-out infinite',
              }}>
                Crear Billetera Nueva
              </button>
              <button onClick={() => setMode('import')} style={{
                padding: '14px 24px',
                background: 'transparent',
                border: `1px solid ${C.border}`, borderRadius: 14, color: C.textMuted,
                fontSize: 14, fontWeight: 600, cursor: 'pointer',
              }}>
                Importar Clave Secreta
              </button>
            </div>
            <div style={{
              marginTop: 24, padding: '10px 14px',
              background: 'rgba(245,158,11,0.08)', border: `1px solid rgba(245,158,11,0.2)`,
              borderRadius: 10, fontSize: 11, color: C.gold, lineHeight: 1.5,
            }}>
              ⚠️ Demo en Testnet. No uses fondos reales.
            </div>
          </>
        )}

        {mode === 'created' && wallet && (
          <div className="fade-in">
            <div style={{
              background: C.card, border: `1px solid ${C.green}40`,
              borderRadius: 14, padding: 20, marginBottom: 20,
              boxShadow: `inset 0 0 20px ${C.greenGlow}`,
            }}>
              <p style={{ fontSize: 12, color: C.green, fontWeight: 700, marginBottom: 8, letterSpacing: '0.05em' }}>
                ✓ BILLETERA CREADA
              </p>
              <p style={{ fontSize: 11, color: C.textDim, marginBottom: 6 }}>Tu dirección pública:</p>
              <p style={{ fontSize: 11, fontFamily: 'monospace', color: C.text, wordBreak: 'break-all', marginBottom: 12, lineHeight: 1.6 }}>
                {wallet.publicKey}
              </p>
              <button onClick={() => handleCopy(wallet.publicKey)} style={{
                padding: '8px 16px', background: C.surface, border: `1px solid ${C.border}`,
                borderRadius: 8, color: copied ? C.green : C.textMuted,
                fontSize: 12, cursor: 'pointer', fontWeight: 600,
                transition: 'color 0.2s',
              }}>
                {copied ? '✓ Copiada' : '⎘ Copiar Dirección'}
              </button>
            </div>
            <div style={{
              background: 'rgba(239,68,68,0.08)', border: `1px solid rgba(239,68,68,0.2)`,
              borderRadius: 10, padding: 12, marginBottom: 20,
              fontSize: 11, color: '#ef9999', lineHeight: 1.6,
            }}>
              🔐 Guarda tu clave secreta de forma segura. Si la pierdes, perderás acceso a tus fondos.
            </div>
            <button onClick={() => onWalletReady(wallet)} style={{
              width: '100%', padding: '16px 24px',
              background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
              border: 'none', borderRadius: 14, color: '#fff',
              fontSize: 16, fontWeight: 700, cursor: 'pointer',
            }}>
              Continuar →
            </button>
          </div>
        )}

        {mode === 'import' && (
          <div className="fade-in">
            <p style={{ fontSize: 14, color: C.text, marginBottom: 16 }}>
              Ingresa tu clave secreta de Stellar (empieza con S...):
            </p>
            <textarea
              value={importSecret}
              onChange={e => setImportSecret(e.target.value)}
              placeholder="SXXXXX..."
              rows={3}
              style={{
                width: '100%', padding: '12px 14px',
                background: C.card, border: `1px solid ${importError ? C.red : C.border}`,
                borderRadius: 10, color: C.text, fontSize: 13,
                fontFamily: 'monospace', resize: 'none', outline: 'none',
                boxSizing: 'border-box',
              }}
            />
            {importError && (
              <p style={{ fontSize: 12, color: C.red, marginTop: 6, textAlign: 'left' }}>{importError}</p>
            )}
            <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
              <button onClick={() => setMode('landing')} style={{
                flex: 1, padding: '14px', background: 'transparent',
                border: `1px solid ${C.border}`, borderRadius: 12, color: C.textMuted,
                fontSize: 14, cursor: 'pointer',
              }}>
                ← Volver
              </button>
              <button onClick={handleImport} style={{
                flex: 2, padding: '14px',
                background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
                border: 'none', borderRadius: 12, color: '#fff',
                fontSize: 14, fontWeight: 700, cursor: 'pointer',
              }}>
                Importar
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── SCREEN: ONBOARDING (funded check) ────────────────────────────────────────
function Onboarding({
  wallet,
  onReady,
}: {
  wallet: { publicKey: string; secretKey: string }
  onReady: () => void
}) {
  const [funding, setFunding] = useState(false)
  const [funded, setFunded] = useState(false)
  const [xlmBalance, setXlmBalance] = useState(0)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)

  const checkBalance = useCallback(async () => {
    const bals = await getBalances(wallet.publicKey)
    const xlm = bals.find(b => b.code === 'XLM')
    if (xlm && xlm.amount > 0) {
      setXlmBalance(xlm.amount)
      setFunded(true)
    }
  }, [wallet.publicKey])

  useEffect(() => {
    checkBalance()
  }, [checkBalance])

  const handleFund = async () => {
    setFunding(true)
    setError('')
    try {
      await fundViaFriendbot(wallet.publicKey)
      await checkBalance()
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Error al fondear cuenta'
      if (msg.toLowerCase().includes('already') || msg.toLowerCase().includes('createaccount')) {
        await checkBalance()
      } else {
        setError(msg)
      }
    } finally {
      setFunding(false)
    }
  }

  const handleCopy = () => {
    navigator.clipboard.writeText(wallet.publicKey).catch(() => {})
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <div style={{
      width: '100%', height: '100%', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', padding: 28,
      background: C.bg, overflow: 'hidden', position: 'relative',
    }}>
      <div style={{
        position: 'absolute', width: 350, height: 350, borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(16,185,129,0.08) 0%, transparent 70%)',
        top: -80, right: -80,
      }} />

      <div className="slide-up" style={{ width: '100%', maxWidth: 360, position: 'relative', zIndex: 1 }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <span style={{ fontSize: 44, filter: 'drop-shadow(0 0 20px rgba(245,158,11,0.5))' }}>⚡</span>
          <h2 style={{ fontSize: 26, fontWeight: 900, color: C.text, marginTop: 8, marginBottom: 6 }}>
            Configura tu cuenta
          </h2>
          <p style={{ fontSize: 14, color: C.textMuted }}>Fondea tu cuenta en Testnet para comenzar</p>
        </div>

        {/* Public key card */}
        <div style={{
          background: C.card, border: `1px solid ${C.border}`,
          borderRadius: 14, padding: 16, marginBottom: 16,
        }}>
          <p style={{ fontSize: 11, color: C.textDim, marginBottom: 6 }}>Tu dirección Stellar:</p>
          <p style={{ fontSize: 10, fontFamily: 'monospace', color: C.textMuted, wordBreak: 'break-all', marginBottom: 10, lineHeight: 1.6 }}>
            {wallet.publicKey}
          </p>
          <button onClick={handleCopy} style={{
            padding: '7px 14px', background: C.surface, border: `1px solid ${C.border}`,
            borderRadius: 8, color: copied ? C.green : C.textMuted,
            fontSize: 12, cursor: 'pointer', transition: 'color 0.2s',
          }}>
            {copied ? '✓ Copiada' : '⎘ Copiar'}
          </button>
        </div>

        {/* Balance display */}
        {funded && (
          <div className="fade-in" style={{
            background: C.card, border: `1px solid ${C.green}40`,
            borderRadius: 14, padding: 16, marginBottom: 16,
            boxShadow: `inset 0 0 20px ${C.greenGlow}`,
          }}>
            <p style={{ fontSize: 11, color: C.green, fontWeight: 700, marginBottom: 4 }}>✓ CUENTA FONDEADA</p>
            <p style={{ fontSize: 28, fontWeight: 900, color: C.text }}>
              {fmt(xlmBalance, 4)} <span style={{ fontSize: 14, color: C.textMuted }}>XLM</span>
            </p>
          </div>
        )}

        {error && (
          <div style={{
            background: 'rgba(239,68,68,0.1)', border: `1px solid rgba(239,68,68,0.3)`,
            borderRadius: 10, padding: 12, marginBottom: 16,
            fontSize: 12, color: C.red,
          }}>
            {error}
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {!funded && (
            <button onClick={handleFund} disabled={funding} style={{
              padding: '16px',
              background: funding ? C.surface : 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
              border: `1px solid ${funding ? C.border : 'transparent'}`,
              borderRadius: 14, color: funding ? C.textMuted : '#fff',
              fontSize: 15, fontWeight: 700, cursor: funding ? 'not-allowed' : 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
            }}>
              {funding ? <><Spinner size={18} color={C.textMuted} /> Fondeando...</> : '🚀 Fondear Cuenta Testnet (Gratis)'}
            </button>
          )}
          {funded && (
            <button onClick={onReady} style={{
              padding: '16px',
              background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
              border: 'none', borderRadius: 14, color: '#fff',
              fontSize: 16, fontWeight: 700, cursor: 'pointer',
              animation: 'glow 3s ease-in-out infinite',
            }}>
              ¡Comenzar! →
            </button>
          )}
        </div>

        <div style={{
          marginTop: 20, padding: '10px 14px',
          background: 'rgba(245,158,11,0.08)', border: `1px solid rgba(245,158,11,0.2)`,
          borderRadius: 10, fontSize: 11, color: C.gold, lineHeight: 1.5, textAlign: 'center',
        }}>
          ⚠️ Esto es un demo en Testnet. No uses fondos reales.
        </div>
      </div>
    </div>
  )
}

// ─── SCREEN: HOME ─────────────────────────────────────────────────────────────
function Home({
  wallet,
  setView,
  balances,
  investBalances,
  updateInvest,
  transactions,
  ledger,
  loading,
  onRefresh,
}: {
  wallet: { publicKey: string; secretKey: string }
  setView: (v: string) => void
  balances: Balance[]
  investBalances: InvestBalances
  updateInvest: (fn: (prev: InvestBalances) => InvestBalances) => void
  transactions: StellarTransaction[]
  ledger: number
  loading: boolean
  onRefresh: () => void
}) {
  const [copied, setCopied] = useState(false)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [convertModal, setConvertModal] = useState<'USD' | 'CETES' | null>(null)
  const [convertAmt, setConvertAmt] = useState('')

  const xlm = balances.find(b => b.code === 'XLM')?.amount ?? 0
  const usdc = investBalances.usd
  const cetes = investBalances.cetes
  const mxn = Math.max(0, xlm * DR.XLM_MXN - (investBalances.mxnSpent ?? 0))
  const totalMxn = mxn + usdc * DR.USDC_MXN + cetes

  const handleCopy = () => {
    navigator.clipboard.writeText(wallet.publicKey).catch(() => {})
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <div style={{ height: '100%', overflowY: 'auto', paddingBottom: 80, background: C.bg }}>
      {/* Top bar */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '52px 20px 20px', position: 'sticky', top: 0, zIndex: 10,
        background: `linear-gradient(to bottom, ${C.bg} 70%, transparent)`,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <LogoStar size={28} glow />
          <span style={{ fontSize: 18, fontWeight: 900, letterSpacing: '0.06em', color: '#ffffff' }}>CENTURION</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {loading && <Spinner size={16} />}
          <button onClick={onRefresh} style={{
            background: C.card, border: `1px solid ${C.border}`, borderRadius: 8,
            color: C.textMuted, fontSize: 13, cursor: 'pointer', padding: '6px 10px',
          }}>
            ↺
          </button>
        </div>
      </div>

      <div style={{ padding: '0 16px' }} className="fade-in">
        {/* Portfolio Card */}
        <div style={{
          background: `linear-gradient(135deg, #0f0f2e 0%, #1a1a4e 100%)`,
          border: `1px solid rgba(99,102,241,0.3)`,
          borderRadius: 20, padding: '24px 20px', marginBottom: 16,
          boxShadow: `0 8px 32px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.05)`,
          position: 'relative', overflow: 'hidden',
        }}>
          <div style={{
            position: 'absolute', top: -40, right: -40, width: 160, height: 160,
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(99,102,241,0.15) 0%, transparent 70%)',
          }} />
          <p style={{ fontSize: 11, color: C.textMuted, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 8 }}>
            Portfolio Total
          </p>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap', marginBottom: 12 }}>
            <span style={{ fontSize: 32, fontWeight: 900, color: C.text, letterSpacing: '-0.03em', animation: 'numberTick 0.4s ease forwards' }}>
              ${fmt(totalMxn)} MXN
            </span>
          </div>
          <p style={{ fontSize: 12, color: C.textMuted, marginBottom: 8 }}>
            {fmt(xlm, 4)} XLM{usdc > 0 ? ` • $${fmt(usdc)} USD` : ''}{cetes > 0 ? ` • $${fmt(cetes)} CETES` : ''}
          </p>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 10, color: C.textDim, fontFamily: 'monospace' }}>{abbrev(wallet.publicKey)}</span>
            <button onClick={handleCopy} style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: copied ? C.green : C.textDim, fontSize: 13, transition: 'color 0.2s',
            }}>
              {copied ? '✓' : '⎘'}
            </button>
          </div>
        </div>

        {/* Balance cards */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
          <div style={{
            background: C.card, borderRadius: 16, padding: '16px 14px',
            border: `1px solid ${C.border}`, borderLeft: `3px solid ${C.green}`,
            boxShadow: `inset 0 0 20px ${C.greenGlow}`,
          }}>
            <p style={{ fontSize: 10, color: C.textDim, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 6 }}>MXN</p>
            <p style={{ fontSize: 20, fontWeight: 800, color: C.text, letterSpacing: '-0.02em' }}>${fmt(mxn)}</p>
            <p style={{ fontSize: 10, color: C.green, marginTop: 4 }}>Disponible para pagar</p>
          </div>
          <div onClick={() => { setConvertModal('USD'); setConvertAmt('') }} style={{
            background: C.card, borderRadius: 16, padding: '16px 14px',
            border: `1px solid ${C.border}`, borderLeft: `3px solid ${C.primary}`,
            boxShadow: `inset 0 0 20px rgba(99,102,241,0.15)`,
            cursor: 'pointer', transition: 'all 0.2s',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <p style={{ fontSize: 10, color: C.textDim, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 6 }}>USD</p>
              <span style={{ fontSize: 10, color: C.primary, fontWeight: 700 }}>Convertir +</span>
            </div>
            <p style={{ fontSize: 20, fontWeight: 800, color: C.text, letterSpacing: '-0.02em' }}>${fmt(usdc)}</p>
            <p style={{ fontSize: 10, color: C.textMuted, marginTop: 4 }}>≈ ${fmt(usdc * DR.USDC_MXN)} MXN</p>
          </div>
        </div>

        <div onClick={() => { setConvertModal('CETES'); setConvertAmt('') }} style={{
          background: C.card, borderRadius: 16, padding: '14px 16px', marginBottom: 10,
          border: `1px solid rgba(245,158,11,0.25)`, borderLeft: `3px solid ${C.gold}`,
          boxShadow: `inset 0 0 20px ${C.goldGlow}`,
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          cursor: 'pointer', transition: 'all 0.2s',
        }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <p style={{ fontSize: 10, color: C.textDim, textTransform: 'uppercase', letterSpacing: '0.1em' }}>CETES</p>
              <span style={{ fontSize: 10, color: C.gold, fontWeight: 700 }}>Convertir +</span>
            </div>
            <p style={{ fontSize: 22, fontWeight: 800, color: C.gold, letterSpacing: '-0.02em' }}>${fmt(cetes)}</p>
            <p style={{ fontSize: 10, color: C.gold, marginTop: 2 }}>11.25% anual • Inversión</p>
          </div>
          <span style={{ fontSize: 24 }}>🏛️</span>
        </div>

        {/* Convert Modal */}
        {convertModal && (() => {
          const isCetes = convertModal === 'CETES'
          const rate = isCetes ? 1 : DR.USDC_MXN
          const mxnAmt = parseFloat(convertAmt) || 0
          const resultAmt = mxnAmt / rate
          const maxMxn = Math.max(0, mxn - 17.50)
          const insufficient = mxnAmt > maxMxn
          const doConvert = () => {
            if (mxnAmt <= 0 || insufficient) return
            updateInvest(prev => isCetes
              ? { ...prev, cetes: prev.cetes + resultAmt, mxnSpent: (prev.mxnSpent ?? 0) + mxnAmt }
              : { ...prev, usd: prev.usd + resultAmt, mxnSpent: (prev.mxnSpent ?? 0) + mxnAmt }
            )
            saveInvestTx({ id: Date.now().toString(), type: 'converted', asset: convertModal, amount: resultAmt, createdAt: new Date().toISOString() })
            setConvertModal(null)
            setConvertAmt('')
          }
          return (
            <div style={{
              position: 'fixed', inset: 0, zIndex: 500,
              background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)',
              display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
            }} onClick={() => setConvertModal(null)}>
              <div className="slide-up" onClick={e => e.stopPropagation()} style={{
                background: C.surface, borderRadius: '24px 24px 0 0',
                border: `1px solid ${C.border}`, padding: '24px 20px 40px',
                width: '100%', maxWidth: 430,
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                  <h3 style={{ fontSize: 20, fontWeight: 800, color: C.text }}>
                    Convertir MXN → {convertModal}
                  </h3>
                  <button onClick={() => setConvertModal(null)} style={{ background: 'none', border: 'none', color: C.textMuted, fontSize: 20, cursor: 'pointer' }}>✕</button>
                </div>

                <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: '12px 16px', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 22, color: C.textMuted }}>$</span>
                  <input
                    type="number" autoFocus
                    value={convertAmt} onChange={e => setConvertAmt(e.target.value)}
                    placeholder="0.00" min="0.01" step="0.01"
                    style={{ flex: 1, background: 'none', border: 'none', outline: 'none', fontSize: 28, fontWeight: 800, color: C.text, textAlign: 'center' }}
                  />
                  <span style={{ fontSize: 15, color: C.textMuted, fontWeight: 600 }}>MXN</span>
                </div>
                <p style={{ fontSize: 11, color: insufficient ? C.red : C.textDim, textAlign: 'right', marginBottom: 16 }}>
                  {insufficient ? `⚠️ Máx. disponible: $${fmt(maxMxn)} MXN` : `Disponible: $${fmt(maxMxn)} MXN`}
                </p>

                {mxnAmt > 0 && !insufficient && (
                  <div style={{ background: `rgba(${isCetes ? '245,158,11' : '99,102,241'},0.08)`, border: `1px solid ${isCetes ? C.gold : C.primary}44`, borderRadius: 12, padding: '12px 16px', marginBottom: 16 }}>
                    <p style={{ fontSize: 12, color: C.textDim, marginBottom: 6 }}>Recibirás</p>
                    <p style={{ fontSize: 24, fontWeight: 800, color: isCetes ? C.gold : C.primary }}>
                      ${fmt(resultAmt)} {convertModal}
                    </p>
                    <p style={{ fontSize: 11, color: C.textDim, marginTop: 4 }}>
                      Tasa: 1 {convertModal} = ${fmt(rate)} MXN {isCetes ? '• 11.25% anual' : ''}
                    </p>
                  </div>
                )}

                <button onClick={doConvert} disabled={mxnAmt <= 0 || insufficient} style={{
                  width: '100%', padding: '16px', borderRadius: 14, border: 'none',
                  background: mxnAmt > 0 && !insufficient ? `linear-gradient(135deg, ${isCetes ? C.gold + ', #d97706' : C.primary + ', #8b5cf6'})` : C.card,
                  color: mxnAmt > 0 && !insufficient ? (isCetes ? '#000' : '#fff') : C.textDim,
                  fontSize: 16, fontWeight: 700, cursor: mxnAmt > 0 && !insufficient ? 'pointer' : 'not-allowed',
                  transition: 'all 0.3s',
                }}>
                  Convertir ahora →
                </button>
              </div>
            </div>
          )
        })()}

        {/* Quick actions */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: 20, marginTop: 6 }}>
          {[
            { label: 'Cobrar', icon: '↓', action: 'pay', color: C.green },
            { label: 'Pagar', icon: '↑', action: 'receive', color: C.primary },
            { label: 'Enviar', icon: '→', action: 'transfer', color: C.gold },
            { label: 'Historial', icon: '☰', action: 'history', color: C.textMuted },
          ].map(a => (
            <button key={a.label} onClick={() => setView(a.action)} style={{
              background: C.card, border: `1px solid ${C.border}`,
              borderRadius: 14, padding: '14px 8px',
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
              cursor: 'pointer', color: a.color, transition: 'all 0.2s',
            }}>
              <span style={{ fontSize: 22 }}>{a.icon}</span>
              <span style={{ fontSize: 12, fontWeight: 600, color: C.text }}>{a.label}</span>
            </button>
          ))}
        </div>

        {/* Stellar network indicator */}
        <div style={{
          background: C.card, border: `1px solid ${C.border}`,
          borderRadius: 12, padding: '10px 14px', marginBottom: 20,
          display: 'flex', alignItems: 'center', gap: 8,
        }}>
          <span style={{
            width: 8, height: 8, borderRadius: '50%', background: C.green,
            display: 'inline-block', animation: 'ledgerPing 2s ease infinite',
          }} />
          <span style={{ fontSize: 12, color: C.textMuted }}>
            <span style={{ color: C.green, fontWeight: 600 }}>Testnet</span>
            {ledger > 0 ? ` • Ledger #${ledger.toLocaleString()}` : ' • Conectando...'}
          </span>
          <span style={{ marginLeft: 'auto', fontSize: 11, color: C.textDim }}>~5s/bloque</span>
        </div>

        {/* Transactions */}
        <p style={{ fontSize: 13, fontWeight: 700, color: C.textMuted, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 12 }}>
          Recientes
        </p>

        {transactions.length === 0 && !loading && (
          <div style={{
            background: C.card, border: `1px solid ${C.border}`,
            borderRadius: 14, padding: 24, textAlign: 'center',
            color: C.textDim, fontSize: 14,
          }}>
            Sin transacciones aún.<br />
            <span style={{ fontSize: 12, marginTop: 4, display: 'block', color: C.textDim }}>
              Haz tu primer pago para verlo aquí.
            </span>
          </div>
        )}

        {transactions.slice(0, 5).map(tx => (
          <div
            key={tx.id}
            onClick={() => setExpanded(expanded === tx.id ? null : tx.id)}
            style={{
              background: C.card, border: `1px solid ${C.border}`, borderRadius: 14,
              padding: '14px 16px', marginBottom: 8, cursor: 'pointer', transition: 'all 0.2s',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{
                width: 38, height: 38, borderRadius: '50%',
                background: tx.type === 'sent' ? `rgba(239,68,68,0.15)` : tx.type === 'received' ? C.greenGlow : C.goldGlow,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 16, color: tx.type === 'sent' ? C.red : tx.type === 'received' ? C.green : C.gold,
                flexShrink: 0,
              }}>
                {tx.type === 'sent' ? '↑' : tx.type === 'received' ? '↓' : '⇄'}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: 13, fontWeight: 600, color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {tx.type === 'sent' ? `→ ${abbrev(tx.to)}` : tx.type === 'received' ? `← ${abbrev(tx.from)}` : 'Path Payment'}
                </p>
                <p style={{ fontSize: 11, color: C.textDim }}>{timeAgo(tx.createdAt)}</p>
              </div>
              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                <p style={{ fontSize: 14, fontWeight: 700, color: tx.type === 'received' ? C.green : C.text }}>
                  {tx.type === 'received' ? '+' : tx.type === 'sent' ? '-' : '~'}${fmt(tx.amount * DR.XLM_MXN)}
                </p>
                <p style={{ fontSize: 10, color: C.textDim }}>{tx.asset === 'XLM' ? 'MXN' : tx.asset === 'USDC' ? 'USD' : tx.asset === 'CGOLD' ? 'CETES' : tx.asset}</p>
              </div>
            </div>
            {expanded === tx.id && (
              <div className="fade-in" style={{
                marginTop: 12, paddingTop: 12, borderTop: `1px solid ${C.border}`,
                display: 'flex', flexDirection: 'column', gap: 6,
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 11, color: C.textDim }}>Tx Hash</span>
                  <span style={{ fontSize: 11, color: C.textMuted, fontFamily: 'monospace' }}>{abbrev(tx.hash, 8)}</span>
                </div>
                {tx.path.length > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: 11, color: C.textDim }}>Ruta</span>
                    <span style={{ fontSize: 11, color: C.primary }}>{tx.path.join(' → ')}</span>
                  </div>
                )}
                <a
                  href={`https://stellar.expert/explorer/testnet/tx/${tx.hash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={e => e.stopPropagation()}
                  style={{ fontSize: 11, color: C.primary, textDecoration: 'none', fontWeight: 600 }}
                >
                  Ver en Stellar Expert →
                </a>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── SCREEN: PAY (Merchant - generate QR to receive) ─────────────────────────
function PayScreen({
  wallet,
  onBack,
  onRefresh,
}: {
  wallet: { publicKey: string; secretKey: string }
  onBack: () => void
  onRefresh: () => void
}) {
  const [step, setStep] = useState<1 | 2 | 3>(1)
  const [amount, setAmount] = useState('')
  const [timeLeft, setTimeLeft] = useState(300)
  const [showConfetti, setShowConfetti] = useState(false)
  const [receivedHash, setReceivedHash] = useState('')
  const [receivedAmount, setReceivedAmount] = useState(0)
  const [memo] = useState(() => `centurion-${Math.random().toString(36).slice(2, 8)}`)
  const [pollError, setPollError] = useState('')
  const [simulating, setSimulating] = useState(false)

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const seenIds = useRef<Set<string>>(new Set())
  const targetAmount = parseFloat(amount) || 0

  const xlmAmount = targetAmount > 0 ? (targetAmount / DR.XLM_MXN).toFixed(7) : '0'
  const qrUri = buildPaymentURI({
    destination: wallet.publicKey,
    amount: xlmAmount,
    memo,
    network_passphrase: NETWORK,
  })

  const stopAll = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current)
    if (pollRef.current) clearInterval(pollRef.current)
  }, [])

  useEffect(() => {
    if (step !== 2) return

    setTimeLeft(300)
    seenIds.current.clear()

    // Countdown
    timerRef.current = setInterval(() => {
      setTimeLeft(t => {
        if (t <= 1) { stopAll(); return 0 }
        return t - 1
      })
    }, 1000)

    // Seed existing payments so we don't false-positive
    getRecentPayments(wallet.publicKey, 5).then(recs => {
      recs.forEach(r => seenIds.current.add(r.id))
    })

    // Poll for new payments
    pollRef.current = setInterval(async () => {
      try {
        const recs = await getRecentPayments(wallet.publicKey, 5)
        for (const rec of recs) {
          if (seenIds.current.has(rec.id)) continue
          seenIds.current.add(rec.id)
          const amt = parseFloat(rec.amount || '0')
          const amtMxn = amt * DR.XLM_MXN
          // Accept if MXN amount roughly matches (within 1 MXN)
          if (Math.abs(amtMxn - targetAmount) < 1.0) {
            stopAll()
            setReceivedHash(rec.transaction_hash)
            setReceivedAmount(amt)
            setStep(3)
            setShowConfetti(true)
            // Small delay to ensure Horizon has fully propagated the balance update
            setTimeout(() => onRefresh(), 1500)
            return
          }
        }
      } catch {
        setPollError('Error conectando con Horizon')
      }
    }, 3000)

    return stopAll
  }, [step, wallet.publicKey, targetAmount, stopAll, onRefresh])

  const formatTime = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`

  const handleSimulate = async () => {
    setSimulating(true)
    // Just advance to success with a fake hash for demo
    stopAll()
    await new Promise(r => setTimeout(r, 1200))
    setReceivedHash(`demo-${Date.now().toString(16)}`)
    setReceivedAmount(targetAmount)
    setStep(3)
    setShowConfetti(true)
    setSimulating(false)
  }

  const resetFlow = () => {
    stopAll()
    setStep(1)
    setAmount('')
    setTimeLeft(300)
    setShowConfetti(false)
    setReceivedHash('')
    setPollError('')
  }

  return (
    <div style={{ height: '100%', overflowY: 'auto', paddingBottom: 80, background: C.bg }}>
      <Confetti show={showConfetti} />

      <div style={{ padding: '52px 20px 20px' }}>
        <BackBtn onBack={onBack} />
        <h2 style={{ fontSize: 22, fontWeight: 800, color: C.text, marginTop: 12, marginBottom: 4 }}>
          Cobrar con QR
        </h2>
        <p style={{ fontSize: 13, color: C.textMuted }}>Genera un QR para recibir pagos XLM</p>
      </div>

      <div style={{ padding: '0 20px' }}>
        {/* Step indicators */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 28 }}>
          {[1, 2, 3].map(s => (
            <div key={s} style={{
              flex: 1, height: 3, borderRadius: 2,
              background: step >= s ? C.primary : C.border,
              transition: 'background 0.4s',
            }} />
          ))}
        </div>

        {/* STEP 1: Enter amount */}
        {step === 1 && (
          <div className="fade-in">
            <div style={{
              background: C.card, border: `1px solid ${C.border}`,
              borderRadius: 20, padding: 24, marginBottom: 20,
              textAlign: 'center',
            }}>
              <p style={{ fontSize: 12, color: C.textMuted, marginBottom: 16, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                Monto a cobrar
              </p>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 8 }}>
                <input
                  type="number"
                  value={amount}
                  onChange={e => setAmount(e.target.value)}
                  placeholder="0.00"
                  min="0"
                  step="0.0001"
                  style={{
                    background: 'none', border: 'none', outline: 'none',
                    fontSize: 52, fontWeight: 900, color: C.text,
                    width: '100%', textAlign: 'center', letterSpacing: '-0.03em',
                  }}
                />
              </div>
              <p style={{ fontSize: 18, color: C.textMuted, fontWeight: 600 }}>MXN</p>
              <p style={{ fontSize: 12, color: C.textDim, marginTop: 8 }}>
                ≈ {targetAmount > 0 ? (targetAmount / DR.XLM_MXN).toFixed(4) : '0'} XLM en red Stellar
              </p>
            </div>

            <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
              {['50', '100', '200', '500', '1000'].map(v => (
                <button key={v} onClick={() => setAmount(v)} style={{
                  flex: 1, minWidth: 48, padding: '10px 8px',
                  background: amount === v ? C.primary : C.card,
                  border: `1px solid ${amount === v ? C.primary : C.border}`,
                  borderRadius: 10, color: amount === v ? '#fff' : C.textMuted,
                  fontSize: 14, fontWeight: 600, cursor: 'pointer',
                }}>
                  {v}
                </button>
              ))}
            </div>

            <button
              onClick={() => setStep(2)}
              disabled={!amount || targetAmount <= 0}
              style={{
                width: '100%', padding: '16px',
                background: (!amount || targetAmount <= 0)
                  ? C.surface
                  : 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
                border: `1px solid ${(!amount || targetAmount <= 0) ? C.border : 'transparent'}`,
                borderRadius: 14, color: (!amount || targetAmount <= 0) ? C.textDim : '#fff',
                fontSize: 16, fontWeight: 700, cursor: (!amount || targetAmount <= 0) ? 'not-allowed' : 'pointer',
              }}
            >
              Generar QR de Cobro →
            </button>
          </div>
        )}

        {/* STEP 2: Show QR */}
        {step === 2 && (
          <div className="fade-in">
            <div style={{
              background: C.card, border: `1px solid ${C.border}`,
              borderRadius: 20, padding: 24, marginBottom: 16, textAlign: 'center',
            }}>
              <p style={{ fontSize: 13, color: C.textMuted, marginBottom: 4 }}>Monto a cobrar</p>
              <p style={{ fontSize: 32, fontWeight: 900, color: C.text, marginBottom: 4 }}>
                ${fmt(targetAmount)} <span style={{ fontSize: 18, color: C.textMuted }}>MXN</span>
              </p>
              <p style={{ fontSize: 12, color: C.textDim, marginBottom: 12 }}>≈ {xlmAmount} XLM en red Stellar</p>

              {/* QR with pulse rings */}
              <div style={{ position: 'relative', display: 'inline-block', marginBottom: 16 }}>
                {[1, 2].map(i => (
                  <div key={i} style={{
                    position: 'absolute', inset: -i * 14, borderRadius: 20,
                    border: `2px solid ${C.primary}`,
                    animation: `ripple ${1.5 + i * 0.5}s ease-out infinite`,
                    animationDelay: `${i * 0.3}s`,
                  }} />
                ))}
                <div style={{
                  background: '#fff', padding: 12, borderRadius: 12,
                  display: 'inline-block',
                }}>
                  <QRCodeSVG value={qrUri} size={180} level="M" />
                </div>
              </div>

              <p style={{ fontSize: 10, fontFamily: 'monospace', color: C.textDim, wordBreak: 'break-all', marginBottom: 12, lineHeight: 1.5 }}>
                {abbrev(wallet.publicKey, 10)}
              </p>

              {/* Countdown */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 16 }}>
                <div style={{
                  width: 8, height: 8, borderRadius: '50%', background: C.green,
                  animation: 'ledgerPing 1.5s ease-in-out infinite',
                }} />
                <span style={{ fontSize: 14, color: C.textMuted }}>
                  Esperando pago... <span style={{ color: timeLeft < 60 ? C.red : C.gold, fontWeight: 700 }}>{formatTime(timeLeft)}</span>
                </span>
              </div>

              {pollError && (
                <p style={{ fontSize: 11, color: C.red, marginBottom: 8 }}>{pollError}</p>
              )}

              <p style={{ fontSize: 10, color: C.textDim, wordBreak: 'break-all', lineHeight: 1.5 }}>
                {qrUri.slice(0, 80)}...
              </p>
            </div>

            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={resetFlow} style={{
                flex: 1, padding: '14px', background: C.surface,
                border: `1px solid ${C.border}`, borderRadius: 12,
                color: C.textMuted, fontSize: 14, cursor: 'pointer',
              }}>
                ← Cancelar
              </button>
              <button onClick={handleSimulate} disabled={simulating} style={{
                flex: 1, padding: '14px',
                background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                border: 'none', borderRadius: 12, color: '#fff',
                fontSize: 14, fontWeight: 700, cursor: simulating ? 'not-allowed' : 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              }}>
                {simulating ? <Spinner size={16} color="#fff" /> : ''}
                {simulating ? 'Simulando...' : '⚡ Simular Pago'}
              </button>
            </div>
          </div>
        )}

        {/* STEP 3: Payment received */}
        {step === 3 && (
          <div className="fade-in" style={{ textAlign: 'center' }}>
            <div style={{ marginBottom: 24 }}>
              <svg width="90" height="90" viewBox="0 0 90 90">
                <circle cx="45" cy="45" r="42" fill="none" stroke={C.green} strokeWidth="3"
                  strokeDasharray="283" strokeDashoffset="0"
                  style={{ animation: 'circleFill 0.6s ease forwards' }} />
                <polyline points="25,45 38,58 65,32" fill="none" stroke={C.green} strokeWidth="4"
                  strokeLinecap="round" strokeLinejoin="round"
                  strokeDasharray="100" strokeDashoffset="0"
                  style={{ animation: 'checkDraw 0.4s 0.3s ease forwards' }} />
              </svg>
            </div>

            <h3 style={{ fontSize: 26, fontWeight: 900, color: C.green, marginBottom: 8 }}>
              ¡Pago Recibido!
            </h3>
            <p style={{ fontSize: 36, fontWeight: 900, color: C.text, marginBottom: 4 }}>
              {fmt(receivedAmount, 4)} XLM
            </p>

            <div style={{
              background: C.card, border: `1px solid ${C.border}`,
              borderRadius: 14, padding: 16, marginTop: 20, marginBottom: 24,
              textAlign: 'left',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <span style={{ fontSize: 12, color: C.textDim }}>Tx Hash</span>
                <span style={{ fontSize: 11, fontFamily: 'monospace', color: C.textMuted }}>{abbrev(receivedHash, 8)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 12, color: C.textDim }}>Red</span>
                <span style={{ fontSize: 12, color: C.green, fontWeight: 600 }}>Stellar Testnet</span>
              </div>
            </div>

            {!receivedHash.startsWith('demo-') && (
              <a
                href={`https://stellar.expert/explorer/testnet/tx/${receivedHash}`}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: 'block', padding: '12px 20px',
                  background: C.card, border: `1px solid ${C.primary}40`,
                  borderRadius: 12, color: C.primary,
                  fontSize: 14, fontWeight: 600, textDecoration: 'none',
                  marginBottom: 16, transition: 'all 0.2s',
                }}
              >
                Ver en Stellar Expert →
              </a>
            )}

            <button onClick={resetFlow} style={{
              width: '100%', padding: '16px',
              background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
              border: 'none', borderRadius: 14, color: '#fff',
              fontSize: 15, fontWeight: 700, cursor: 'pointer',
            }}>
              Nuevo Cobro
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── PATH PAYMENT ROUTE INFO ──────────────────────────────────────────────────
interface PathRecord {
  source_asset_type: string
  source_asset_code?: string
  source_amount: string
  destination_asset_type: string
  destination_asset_code?: string
  destination_amount: string
  path: Array<{ asset_type: string; asset_code?: string; asset_issuer?: string }>
}

// ─── SCREEN: RECEIVE (Customer - scan QR and pay) ────────────────────────────
function ReceiveScreen({
  wallet,
  onBack,
  onRefresh,
}: {
  wallet: { publicKey: string; secretKey: string }
  onBack: () => void
  onRefresh: () => void
}) {
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1)
  const [uriInput, setUriInput] = useState('')
  const [parsed, setParsed] = useState<ParsedPayment | null>(null)
  const [parseError, setParseError] = useState('')
  const [pathInfo, setPathInfo] = useState<PathRecord | null>(null)
  const [loadingPath, setLoadingPath] = useState(false)
  const [txSteps, setTxSteps] = useState<Array<{ label: string; done: boolean; error?: string }>>([])
  const [txHash, setTxHash] = useState('')
  const [txError, setTxError] = useState('')
  const [showConfetti, setShowConfetti] = useState(false)
  const [directAmount, setDirectAmount] = useState('')

  // Demo: usa el propio wallet como merchant (siempre válido)
  const DEMO_URI = buildPaymentURI({
    destination: wallet.publicKey,
    amount: (100 / DR.XLM_MXN).toFixed(7), // $100 MXN en XLM
    memo: 'centurion-demo',
    network_passphrase: NETWORK,
  })

  const handleParse = useCallback(async (uri: string) => {
    setParseError('')
    const p = parsePaymentURI(uri)
    if (!p || !p.destination) {
      setParseError('URI inválido. Debe comenzar con web+stellar:pay?')
      return
    }
    setParsed(p)
    setDirectAmount(p.amount || '')
    setStep(2)

    // Check if path payment needed
    if (p.amount && p.assetCode && p.assetCode !== 'XLM') {
      setLoadingPath(true)
      try {
        const { HORIZON_URL: HU } = { HORIZON_URL: 'https://horizon-testnet.stellar.org' }
        const destParam = `destination_asset_type=credit_alphanum4&destination_asset_code=${p.assetCode}&destination_asset_issuer=${p.assetIssuer || USDC_ISSUER}`
        const url = `${HU}/paths/strict-receive?${destParam}&destination_amount=${p.amount}&source_account=${wallet.publicKey}`
        const res = await fetch(url)
        if (res.ok) {
          const data = await res.json() as { _embedded?: { records?: PathRecord[] } }
          const records = data._embedded?.records || []
          if (records.length > 0) setPathInfo(records[0])
        }
      } catch { /* no path */ }
      setLoadingPath(false)
    }
  }, [wallet.publicKey])

  const handleSimScan = () => {
    setUriInput(DEMO_URI)
    handleParse(DEMO_URI)
  }

  const markStep = (i: number, done: boolean, error?: string) => {
    setTxSteps(prev => prev.map((s, idx) => idx === i ? { ...s, done, error } : s))
  }

  const handleConfirm = async () => {
    if (!parsed) return
    setStep(3)
    setTxError('')
    setTxHash('')

    const steps = [
      { label: 'Verificando balance...', done: false },
      { label: 'Construyendo transacción...', done: false },
      { label: 'Firmando con tu clave...', done: false },
      { label: 'Enviando a Stellar...', done: false },
      { label: 'Confirmando en ledger...', done: false },
    ]
    setTxSteps(steps)

    try {
      // Step 0: verify balance
      await new Promise(r => setTimeout(r, 600))
      markStep(0, true)

      // Step 1: build
      await new Promise(r => setTimeout(r, 500))
      markStep(1, true)

      // Step 2: sign
      await new Promise(r => setTimeout(r, 400))
      markStep(2, true)

      // Step 3: submit
      let hash = ''
      const destAmount = parsed.amount || directAmount || '1'

      if (parsed.assetCode && parsed.assetCode !== 'XLM' && pathInfo) {
        // Path payment
        const sendAsset = ASSETS.XLM
        const destAsset = parsed.assetCode === 'USDC'
          ? ASSETS.USDC
          : new Asset(parsed.assetCode, parsed.assetIssuer || USDC_ISSUER)
        const sendMax = (parseFloat(pathInfo.source_amount) * 1.01).toFixed(7)
        const pathAssets = pathInfo.path.map(p =>
          p.asset_type === 'native' ? ASSETS.XLM : new Asset(p.asset_code || '', p.asset_issuer || '')
        )
        hash = await buildAndSubmitPathPayment({
          senderSecret: wallet.secretKey,
          destination: parsed.destination,
          sendAsset,
          sendMax,
          destAsset,
          destAmount,
          path: pathAssets,
          memo: parsed.memo,
        })
      } else {
        // Direct XLM payment
        hash = await buildAndSubmitPayment({
          senderSecret: wallet.secretKey,
          destination: parsed.destination,
          amount: destAmount,
          asset: ASSETS.XLM,
          memo: parsed.memo,
        })
      }
      markStep(3, true)

      // Step 4: confirm
      await new Promise(r => setTimeout(r, 800))
      markStep(4, true)

      setTxHash(hash)
      setStep(4)
      setShowConfetti(true)
      // Wait for Stellar to index the transaction before refreshing balance (retry at 3.5s and 8s)
      setTimeout(() => onRefresh(), 3500)
      setTimeout(() => onRefresh(), 8000)
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Error desconocido'
      setTxError(msg)
      setStep(4)
    }
  }

  const resetFlow = () => {
    setStep(1)
    setUriInput('')
    setParsed(null)
    setParseError('')
    setPathInfo(null)
    setTxSteps([])
    setTxHash('')
    setTxError('')
    setShowConfetti(false)
    setDirectAmount('')
  }

  return (
    <div style={{ height: '100%', overflowY: 'auto', paddingBottom: 80, background: C.bg }}>
      <Confetti show={showConfetti} />

      <div style={{ padding: '52px 20px 20px' }}>
        <BackBtn onBack={onBack} />
        <h2 style={{ fontSize: 22, fontWeight: 800, color: C.text, marginTop: 12, marginBottom: 4 }}>
          Pagar con QR
        </h2>
        <p style={{ fontSize: 13, color: C.textMuted }}>Escanea o pega un código de pago Stellar</p>
      </div>

      <div style={{ padding: '0 20px' }}>
        {/* Step indicators */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 28 }}>
          {[1, 2, 3, 4].map(s => (
            <div key={s} style={{
              flex: 1, height: 3, borderRadius: 2,
              background: step >= s ? C.primary : C.border,
              transition: 'background 0.4s',
            }} />
          ))}
        </div>

        {/* STEP 1: Scan / Enter URI */}
        {step === 1 && (
          <div className="fade-in">
            {/* Scan illustration */}
            <div style={{
              background: C.card, border: `1px solid ${C.border}`,
              borderRadius: 20, padding: 28, marginBottom: 20, textAlign: 'center',
              position: 'relative', overflow: 'hidden',
            }}>
              <div style={{
                width: 160, height: 160, margin: '0 auto 16px',
                border: `2px solid ${C.primary}40`, borderRadius: 16,
                position: 'relative', overflow: 'hidden',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <span style={{ fontSize: 60 }}>📷</span>
                <div style={{
                  position: 'absolute', left: 0, right: 0, height: 2,
                  background: `linear-gradient(90deg, transparent, ${C.primary}, transparent)`,
                  animation: 'scanLine 2s ease-in-out infinite',
                }} />
                {[0, 1, 2, 3].map(corner => (
                  <div key={corner} style={{
                    position: 'absolute',
                    [corner < 2 ? 'top' : 'bottom']: 6,
                    [corner % 2 === 0 ? 'left' : 'right']: 6,
                    width: 20, height: 20,
                    borderTop: corner < 2 ? `3px solid ${C.primary}` : 'none',
                    borderBottom: corner >= 2 ? `3px solid ${C.primary}` : 'none',
                    borderLeft: corner % 2 === 0 ? `3px solid ${C.primary}` : 'none',
                    borderRight: corner % 2 === 1 ? `3px solid ${C.primary}` : 'none',
                  }} />
                ))}
              </div>

              <button onClick={handleSimScan} style={{
                width: '100%', padding: '14px',
                background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
                border: 'none', borderRadius: 12, color: '#fff',
                fontSize: 15, fontWeight: 700, cursor: 'pointer',
              }}>
                ⚡ Simular Escaneo (Demo)
              </button>
            </div>

            <p style={{ fontSize: 13, color: C.textMuted, textAlign: 'center', marginBottom: 12 }}>
              O pega un URI de pago:
            </p>

            <textarea
              value={uriInput}
              onChange={e => setUriInput(e.target.value)}
              placeholder="web+stellar:pay?destination=G...&amount=10"
              rows={3}
              style={{
                width: '100%', padding: '12px 14px',
                background: C.card, border: `1px solid ${parseError ? C.red : C.border}`,
                borderRadius: 10, color: C.text, fontSize: 12,
                fontFamily: 'monospace', resize: 'none', outline: 'none',
                boxSizing: 'border-box', marginBottom: 8,
              }}
            />

            {parseError && <p style={{ fontSize: 12, color: C.red, marginBottom: 8 }}>{parseError}</p>}

            <button
              onClick={() => handleParse(uriInput)}
              disabled={!uriInput.trim()}
              style={{
                width: '100%', padding: '14px',
                background: uriInput.trim()
                  ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)'
                  : C.surface,
                border: `1px solid ${uriInput.trim() ? 'transparent' : C.border}`,
                borderRadius: 12, color: uriInput.trim() ? '#fff' : C.textDim,
                fontSize: 14, fontWeight: 700, cursor: uriInput.trim() ? 'pointer' : 'not-allowed',
              }}
            >
              Continuar →
            </button>
          </div>
        )}

        {/* STEP 2: Payment details */}
        {step === 2 && parsed && (
          <div className="fade-in">
            <div style={{
              background: C.card, border: `1px solid ${C.border}`,
              borderRadius: 20, padding: 20, marginBottom: 16,
            }}>
              <p style={{ fontSize: 12, color: C.textMuted, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 12 }}>
                Detalles del pago
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 13, color: C.textDim }}>Destino</span>
                  <span style={{ fontSize: 12, fontFamily: 'monospace', color: C.text }}>{abbrev(parsed.destination)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 13, color: C.textDim }}>Monto</span>
                  <span style={{ fontSize: 18, fontWeight: 800, color: C.green }}>
                    ${fmt(parseFloat(directAmount || parsed.amount || '0') * DR.XLM_MXN)} MXN
                  </span>
                </div>
                {parsed.memo && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 13, color: C.textDim }}>Memo</span>
                    <span style={{ fontSize: 12, color: C.textMuted, fontFamily: 'monospace' }}>{parsed.memo}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Always show editable amount */}
            <div style={{ marginBottom: 16 }}>
              <p style={{ fontSize: 12, color: C.textMuted, marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Monto a pagar (MXN)</p>
              <div style={{
                background: C.card, border: `1.5px solid ${C.green}40`,
                borderRadius: 14, padding: '12px 16px',
                display: 'flex', alignItems: 'center', gap: 8,
                boxShadow: `inset 0 0 16px ${C.greenGlow}`,
              }}>
                <span style={{ fontSize: 24, color: C.textMuted, fontWeight: 300 }}>$</span>
                <input
                  type="number"
                  value={directAmount ? (parseFloat(directAmount) * DR.XLM_MXN).toFixed(2) : ''}
                  onChange={e => {
                    const mxnVal = parseFloat(e.target.value) || 0
                    setDirectAmount((mxnVal / DR.XLM_MXN).toFixed(7))
                  }}
                  placeholder="0.00"
                  min="0.01"
                  step="0.01"
                  style={{
                    flex: 1, background: 'none', border: 'none', outline: 'none',
                    fontSize: 28, fontWeight: 800, color: C.green,
                    textAlign: 'center', letterSpacing: '-0.02em',
                  }}
                />
                <span style={{ fontSize: 16, color: C.textMuted, fontWeight: 600 }}>MXN</span>
              </div>
              {directAmount && parseFloat(directAmount) > 0 && (
                <p style={{ fontSize: 11, color: C.textDim, marginTop: 6, textAlign: 'center' }}>
                  ≈ {parseFloat(directAmount).toFixed(4)} XLM en Stellar
                </p>
              )}
            </div>

            {/* Path payment info */}
            {loadingPath && (
              <div style={{
                background: C.card, border: `1px solid ${C.border}`,
                borderRadius: 16, padding: 16, marginBottom: 16,
                display: 'flex', alignItems: 'center', gap: 12,
              }}>
                <Spinner size={20} />
                <span style={{ fontSize: 13, color: C.textMuted }}>Buscando mejor ruta en Stellar DEX...</span>
              </div>
            )}

            {pathInfo && !loadingPath && (
              <div style={{
                background: `linear-gradient(135deg, rgba(99,102,241,0.08), rgba(16,185,129,0.05))`,
                border: `1px solid ${C.primary}30`,
                borderRadius: 16, padding: 16, marginBottom: 16,
              }}>
                <p style={{ fontSize: 12, color: C.primary, fontWeight: 700, marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                  ⇄ Ruta de Pago Encontrada
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: 13, color: C.textDim }}>Envías</span>
                    <span style={{ fontSize: 13, fontWeight: 700, color: C.text }}>
                      {fmt(parseFloat(pathInfo.source_amount), 4)} XLM
                    </span>
                  </div>
                  <div style={{ textAlign: 'center', fontSize: 20, color: C.primary }}>↓</div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: 13, color: C.textDim }}>Llega exactamente</span>
                    <span style={{ fontSize: 13, fontWeight: 700, color: C.green }}>
                      {parsed.amount} {parsed.assetCode}
                    </span>
                  </div>
                  <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 8, marginTop: 4 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: 11, color: C.textDim }}>Vía</span>
                      <span style={{ fontSize: 11, color: C.textMuted }}>Stellar DEX</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
                      <span style={{ fontSize: 11, color: C.textDim }}>Slippage máx.</span>
                      <span style={{ fontSize: 11, color: C.textMuted }}>1%</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Infrastructure badges */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
              {['Stellar Network', 'SEP-7', 'Testnet'].map(badge => (
                <span key={badge} style={{
                  padding: '4px 10px', background: `${C.primary}15`,
                  border: `1px solid ${C.primary}30`, borderRadius: 20,
                  fontSize: 10, color: C.primary, fontWeight: 600, letterSpacing: '0.05em',
                }}>
                  {badge}
                </span>
              ))}
            </div>

            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={resetFlow} style={{
                flex: 1, padding: '14px', background: C.surface,
                border: `1px solid ${C.border}`, borderRadius: 12,
                color: C.textMuted, fontSize: 14, cursor: 'pointer',
              }}>
                ← Cancelar
              </button>
              <button
                onClick={handleConfirm}
                disabled={!parsed.destination || (!parsed.amount && !directAmount)}
                style={{
                  flex: 2, padding: '14px',
                  background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
                  border: 'none', borderRadius: 12, color: '#fff',
                  fontSize: 15, fontWeight: 700, cursor: 'pointer',
                  animation: 'glow 3s ease-in-out infinite',
                }}
              >
                Confirmar Pago →
              </button>
            </div>
          </div>
        )}

        {/* STEP 3: Processing */}
        {step === 3 && (
          <div className="fade-in">
            <div style={{
              background: C.card, border: `1px solid ${C.border}`,
              borderRadius: 20, padding: 24,
            }}>
              <div style={{ textAlign: 'center', marginBottom: 28 }}>
                <Spinner size={48} color={C.primary} />
                <p style={{ fontSize: 18, fontWeight: 700, color: C.text, marginTop: 16 }}>
                  Procesando pago...
                </p>
                <p style={{ fontSize: 13, color: C.textMuted }}>No cierres la app</p>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {txSteps.map((s, i) => (
                  <div key={i} style={{
                    display: 'flex', alignItems: 'center', gap: 12,
                    animation: `stepAppear 0.3s ease ${i * 0.1}s both`,
                  }}>
                    <div style={{
                      width: 24, height: 24, borderRadius: '50%', flexShrink: 0,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      background: s.error ? `rgba(239,68,68,0.15)` : s.done ? `${C.greenGlow}` : C.surface,
                      border: `1px solid ${s.error ? C.red : s.done ? C.green : C.border}`,
                    }}>
                      {s.error ? (
                        <span style={{ fontSize: 12, color: C.red }}>✕</span>
                      ) : s.done ? (
                        <span style={{ fontSize: 12, color: C.green }}>✓</span>
                      ) : (
                        <Spinner size={12} color={C.primary} />
                      )}
                    </div>
                    <span style={{
                      fontSize: 13, color: s.done ? C.text : s.error ? C.red : C.textMuted,
                      fontWeight: s.done ? 600 : 400,
                    }}>
                      {s.label}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* STEP 4: Result */}
        {step === 4 && (
          <div className="fade-in" style={{ textAlign: 'center' }}>
            {txHash && !txError ? (
              <>
                <div style={{ marginBottom: 24 }}>
                  <svg width="90" height="90" viewBox="0 0 90 90">
                    <circle cx="45" cy="45" r="42" fill="none" stroke={C.green} strokeWidth="3"
                      strokeDasharray="283" strokeDashoffset="0"
                      style={{ animation: 'circleFill 0.6s ease forwards' }} />
                    <polyline points="25,45 38,58 65,32" fill="none" stroke={C.green} strokeWidth="4"
                      strokeLinecap="round" strokeLinejoin="round"
                      strokeDasharray="100" strokeDashoffset="0"
                      style={{ animation: 'checkDraw 0.4s 0.3s ease forwards' }} />
                  </svg>
                </div>

                <h3 style={{ fontSize: 26, fontWeight: 900, color: C.green, marginBottom: 8 }}>
                  ¡Pago Enviado!
                </h3>
                <p style={{ fontSize: 14, color: C.textMuted, marginBottom: 20 }}>
                  Transacción confirmada en Stellar Testnet
                </p>

                <div style={{
                  background: C.card, border: `1px solid ${C.border}`,
                  borderRadius: 14, padding: 16, marginBottom: 20, textAlign: 'left',
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                    <span style={{ fontSize: 12, color: C.textDim }}>Tx Hash</span>
                    <span style={{ fontSize: 11, fontFamily: 'monospace', color: C.textMuted }}>{abbrev(txHash, 8)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: 12, color: C.textDim }}>Estado</span>
                    <span style={{ fontSize: 12, color: C.green, fontWeight: 700 }}>✓ Confirmada</span>
                  </div>
                </div>

                <a
                  href={`https://stellar.expert/explorer/testnet/tx/${txHash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    display: 'block', padding: '12px 20px',
                    background: C.card, border: `1px solid ${C.primary}40`,
                    borderRadius: 12, color: C.primary,
                    fontSize: 14, fontWeight: 600, textDecoration: 'none',
                    marginBottom: 16,
                  }}
                >
                  Ver en Stellar Expert →
                </a>
              </>
            ) : (
              <>
                <div style={{ marginBottom: 24 }}>
                  <div style={{
                    width: 80, height: 80, borderRadius: '50%', margin: '0 auto',
                    background: `rgba(239,68,68,0.15)`, border: `2px solid ${C.red}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 36, color: C.red,
                  }}>
                    ✕
                  </div>
                </div>
                <h3 style={{ fontSize: 22, fontWeight: 800, color: C.red, marginBottom: 12 }}>
                  Pago Fallido
                </h3>
                <div style={{
                  background: 'rgba(239,68,68,0.08)', border: `1px solid rgba(239,68,68,0.25)`,
                  borderRadius: 12, padding: 14, marginBottom: 20,
                  fontSize: 13, color: '#fca5a5', lineHeight: 1.6, textAlign: 'left',
                }}>
                  {txError}
                </div>
              </>
            )}

            <button onClick={resetFlow} style={{
              width: '100%', padding: '16px',
              background: txError
                ? 'linear-gradient(135deg, #ef4444 0%, #b91c1c 100%)'
                : 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
              border: 'none', borderRadius: 14, color: '#fff',
              fontSize: 15, fontWeight: 700, cursor: 'pointer',
            }}>
              {txError ? 'Intentar de nuevo' : 'Nuevo Pago'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── SCREEN: HISTORY ──────────────────────────────────────────────────────────
function HistoryScreen({
  transactions,
  loading,
  onRefresh,
  onBack,
}: {
  transactions: StellarTransaction[]
  loading: boolean
  onRefresh: () => void
  onBack: () => void
}) {
  const [expanded, setExpanded] = useState<string | null>(null)
  const investTxs = loadInvestTxs()

  const totalCount = transactions.length + investTxs.length

  return (
    <div style={{ height: '100%', overflowY: 'auto', paddingBottom: 80, background: C.bg }}>
      <div style={{ padding: '52px 20px 16px' }}>
        <BackBtn onBack={onBack} />
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 12 }}>
          <div>
            <h2 style={{ fontSize: 22, fontWeight: 800, color: C.text, marginBottom: 4 }}>Historial</h2>
            <p style={{ fontSize: 12, color: C.textMuted }}>{totalCount} transacciones</p>
          </div>
          <button onClick={onRefresh} style={{
            background: C.card, border: `1px solid ${C.border}`, borderRadius: 10,
            color: C.textMuted, fontSize: 13, cursor: 'pointer', padding: '8px 14px',
            display: 'flex', alignItems: 'center', gap: 6,
          }}>
            {loading ? <Spinner size={14} /> : '↺'} Actualizar
          </button>
        </div>
      </div>

      <div style={{ padding: '0 16px' }}>
        {loading && transactions.length === 0 && (
          <div style={{ textAlign: 'center', padding: 40 }}>
            <Spinner size={32} />
            <p style={{ color: C.textMuted, marginTop: 16, fontSize: 14 }}>Cargando transacciones...</p>
          </div>
        )}

        {!loading && transactions.length === 0 && (
          <div style={{
            background: C.card, border: `1px solid ${C.border}`,
            borderRadius: 16, padding: 32, textAlign: 'center',
            color: C.textDim, fontSize: 14,
          }}>
            Sin transacciones aún.
          </div>
        )}

        {/* Investment transactions */}
        {investTxs.length > 0 && (
          <>
            <p style={{ fontSize: 11, color: C.textDim, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8, marginTop: 4 }}>Inversiones</p>
            {investTxs.map(tx => (
              <div key={tx.id} style={{
                background: C.card, border: `1px solid ${C.border}`, borderRadius: 14,
                padding: '14px 16px', marginBottom: 8,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{
                    width: 40, height: 40, borderRadius: '50%',
                    background: tx.type === 'sent' ? 'rgba(239,68,68,0.15)' : tx.type === 'received' ? C.greenGlow : C.goldGlow,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 18, color: tx.type === 'sent' ? C.red : tx.type === 'received' ? C.green : C.gold,
                    flexShrink: 0,
                  }}>
                    {tx.type === 'sent' ? '↑' : tx.type === 'received' ? '↓' : '⇄'}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 14, fontWeight: 600, color: C.text }}>
                      {tx.type === 'converted' ? `Conversión → ${tx.asset}` : tx.type === 'received' ? `Recibido ${tx.asset}` : `Enviado ${tx.asset}`}
                    </p>
                    <p style={{ fontSize: 11, color: C.textDim }}>{timeAgo(tx.createdAt)}</p>
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <p style={{ fontSize: 14, fontWeight: 700, color: tx.type === 'sent' ? C.red : tx.type === 'received' ? C.green : C.gold }}>
                      {tx.type === 'sent' ? '-' : '+'}{fmt(tx.amount)}
                    </p>
                    <p style={{ fontSize: 10, color: C.textDim }}>{tx.asset}</p>
                  </div>
                </div>
              </div>
            ))}
            {transactions.length > 0 && <p style={{ fontSize: 11, color: C.textDim, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8, marginTop: 4 }}>Stellar (MXN)</p>}
          </>
        )}

        {transactions.map(tx => (
          <div
            key={tx.id}
            onClick={() => setExpanded(expanded === tx.id ? null : tx.id)}
            style={{
              background: C.card, border: `1px solid ${C.border}`, borderRadius: 14,
              padding: '14px 16px', marginBottom: 8, cursor: 'pointer', transition: 'all 0.2s',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{
                width: 40, height: 40, borderRadius: '50%',
                background: tx.type === 'sent' ? `rgba(239,68,68,0.15)` : tx.type === 'received' ? C.greenGlow : C.goldGlow,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 18, color: tx.type === 'sent' ? C.red : tx.type === 'received' ? C.green : C.gold,
                flexShrink: 0,
              }}>
                {tx.type === 'sent' ? '↑' : tx.type === 'received' ? '↓' : '⇄'}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: 14, fontWeight: 600, color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {tx.type === 'sent' ? `→ ${abbrev(tx.to)}` : tx.type === 'received' ? `← ${abbrev(tx.from)}` : 'Path Payment'}
                </p>
                <p style={{ fontSize: 11, color: C.textDim }}>{timeAgo(tx.createdAt)}</p>
              </div>
              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                <p style={{ fontSize: 14, fontWeight: 700, color: tx.type === 'received' ? C.green : C.text }}>
                  {tx.type === 'received' ? '+' : tx.type === 'sent' ? '-' : '~'}${fmt(tx.amount * DR.XLM_MXN)}
                </p>
                <p style={{ fontSize: 10, color: C.textDim }}>{tx.asset === 'XLM' ? 'MXN' : tx.asset === 'USDC' ? 'USD' : tx.asset === 'CGOLD' ? 'CETES' : tx.asset}</p>
              </div>
            </div>

            {expanded === tx.id && (
              <div className="fade-in" style={{
                marginTop: 12, paddingTop: 12, borderTop: `1px solid ${C.border}`,
                display: 'flex', flexDirection: 'column', gap: 6,
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 11, color: C.textDim }}>De</span>
                  <span style={{ fontSize: 11, fontFamily: 'monospace', color: C.textMuted }}>{abbrev(tx.from, 8)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 11, color: C.textDim }}>Para</span>
                  <span style={{ fontSize: 11, fontFamily: 'monospace', color: C.textMuted }}>{abbrev(tx.to, 8)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 11, color: C.textDim }}>Tx Hash</span>
                  <span style={{ fontSize: 11, fontFamily: 'monospace', color: C.textMuted }}>{abbrev(tx.hash, 8)}</span>
                </div>
                {tx.path.length > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: 11, color: C.textDim }}>Ruta</span>
                    <span style={{ fontSize: 11, color: C.primary }}>{tx.path.join(' → ')}</span>
                  </div>
                )}
                <a
                  href={`https://stellar.expert/explorer/testnet/tx/${tx.hash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={e => e.stopPropagation()}
                  style={{ fontSize: 11, color: C.primary, textDecoration: 'none', fontWeight: 600, marginTop: 2 }}
                >
                  Ver en Stellar Expert →
                </a>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── SCREEN: SETTINGS ─────────────────────────────────────────────────────────
function SettingsScreen({
  wallet,
  onBack,
  onClearWallet,
}: {
  wallet: { publicKey: string; secretKey: string }
  onBack: () => void
  onClearWallet: () => void
}) {
  const [copiedPub, setCopiedPub] = useState(false)
  const [showSecret, setShowSecret] = useState(false)
  const [copiedSec, setCopiedSec] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)

  const copyPub = () => {
    navigator.clipboard.writeText(wallet.publicKey).catch(() => {})
    setCopiedPub(true)
    setTimeout(() => setCopiedPub(false), 1500)
  }

  const copySec = () => {
    navigator.clipboard.writeText(wallet.secretKey).catch(() => {})
    setCopiedSec(true)
    setTimeout(() => setCopiedSec(false), 1500)
  }

  return (
    <div style={{ height: '100%', overflowY: 'auto', paddingBottom: 80, background: C.bg }}>
      <div style={{ padding: '52px 20px 20px' }}>
        <BackBtn onBack={onBack} />
        <h2 style={{ fontSize: 22, fontWeight: 800, color: C.text, marginTop: 12, marginBottom: 4 }}>
          Configuración
        </h2>
        <p style={{ fontSize: 13, color: C.textMuted }}>Centurion Pay v1.0 • Stellar Testnet</p>
      </div>

      <div style={{ padding: '0 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>
        {/* Public key */}
        <div style={{
          background: C.card, border: `1px solid ${C.border}`,
          borderRadius: 16, padding: 18,
        }}>
          <p style={{ fontSize: 11, color: C.textMuted, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 10 }}>
            Clave Pública (Dirección)
          </p>
          <p style={{ fontSize: 10, fontFamily: 'monospace', color: C.text, wordBreak: 'break-all', lineHeight: 1.7, marginBottom: 12 }}>
            {wallet.publicKey}
          </p>
          <button onClick={copyPub} style={{
            padding: '8px 16px', background: copiedPub ? `${C.greenGlow}` : C.surface,
            border: `1px solid ${copiedPub ? C.green : C.border}`,
            borderRadius: 8, color: copiedPub ? C.green : C.textMuted,
            fontSize: 12, cursor: 'pointer', fontWeight: 600, transition: 'all 0.2s',
          }}>
            {copiedPub ? '✓ Copiada' : '⎘ Copiar Dirección'}
          </button>
        </div>

        {/* Secret key */}
        <div style={{
          background: C.card, border: `1px solid rgba(239,68,68,0.2)`,
          borderRadius: 16, padding: 18,
        }}>
          <p style={{ fontSize: 11, color: C.red, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 4 }}>
            Clave Secreta
          </p>
          <p style={{ fontSize: 11, color: C.textDim, marginBottom: 10 }}>
            ⚠️ Nunca compartas esto con nadie
          </p>
          <p style={{
            fontSize: 10, fontFamily: 'monospace', color: showSecret ? C.text : C.textDim,
            wordBreak: 'break-all', lineHeight: 1.7, marginBottom: 12,
            filter: showSecret ? 'none' : 'blur(4px)',
            transition: 'filter 0.3s',
            userSelect: showSecret ? 'text' : 'none',
          }}>
            {wallet.secretKey}
          </p>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => setShowSecret(!showSecret)} style={{
              flex: 1, padding: '8px 12px', background: C.surface,
              border: `1px solid ${C.border}`, borderRadius: 8,
              color: C.textMuted, fontSize: 12, cursor: 'pointer',
            }}>
              {showSecret ? '🙈 Ocultar' : '👁 Revelar'}
            </button>
            {showSecret && (
              <button onClick={copySec} style={{
                flex: 1, padding: '8px 12px',
                background: copiedSec ? `${C.greenGlow}` : C.surface,
                border: `1px solid ${copiedSec ? C.green : C.border}`,
                borderRadius: 8, color: copiedSec ? C.green : C.textMuted,
                fontSize: 12, cursor: 'pointer', transition: 'all 0.2s',
              }}>
                {copiedSec ? '✓ Copiada' : '⎘ Copiar'}
              </button>
            )}
          </div>
        </div>

        {/* Network info */}
        <div style={{
          background: C.card, border: `1px solid ${C.border}`,
          borderRadius: 16, padding: 18,
        }}>
          <p style={{ fontSize: 11, color: C.textMuted, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 12 }}>
            Red
          </p>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ fontSize: 13, color: C.text }}>Stellar Testnet</span>
            <span style={{
              padding: '3px 10px', background: `${C.greenGlow}`,
              border: `1px solid ${C.green}40`, borderRadius: 20,
              fontSize: 11, color: C.green, fontWeight: 600,
            }}>
              Activa
            </span>
          </div>
          <p style={{ fontSize: 11, color: C.textDim, lineHeight: 1.5 }}>
            Horizon: horizon-testnet.stellar.org
          </p>
        </div>

        {/* Stellar Expert link */}
        <a
          href={`https://stellar.expert/explorer/testnet/account/${wallet.publicKey}`}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: 'block', padding: '14px 18px',
            background: C.card, border: `1px solid ${C.primary}30`,
            borderRadius: 14, color: C.primary,
            fontSize: 14, fontWeight: 600, textDecoration: 'none',
            textAlign: 'center',
          }}
        >
          Ver cuenta en Stellar Expert →
        </a>

        {/* App info */}
        <div style={{
          background: C.card, border: `1px solid ${C.border}`,
          borderRadius: 16, padding: 18, textAlign: 'center',
        }}>
          <span style={{ fontSize: 28 }}>⚡</span>
          <p style={{ fontSize: 16, fontWeight: 800, color: C.gold, marginTop: 4 }}>CENTURION PAY</p>
          <p style={{ fontSize: 12, color: C.textDim, marginTop: 4 }}>v1.0.0 • Stellar Testnet • Hackathon 2025</p>
          <p style={{ fontSize: 11, color: C.textDim, marginTop: 4 }}>
            ⚠️ Demo. No uses fondos reales.
          </p>
        </div>

        {/* Danger zone */}
        <div style={{
          background: 'rgba(239,68,68,0.05)', border: `1px solid rgba(239,68,68,0.2)`,
          borderRadius: 16, padding: 18,
        }}>
          <p style={{ fontSize: 11, color: C.red, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 10 }}>
            Zona de Peligro
          </p>

          {!showConfirm ? (
            <button onClick={() => setShowConfirm(true)} style={{
              width: '100%', padding: '12px',
              background: 'transparent', border: `1px solid rgba(239,68,68,0.4)`,
              borderRadius: 10, color: C.red, fontSize: 14, fontWeight: 600,
              cursor: 'pointer',
            }}>
              🗑 Nueva Billetera
            </button>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <p style={{ fontSize: 13, color: '#fca5a5', lineHeight: 1.5 }}>
                ¿Seguro? Perderás acceso a la billetera actual. Asegúrate de haber guardado tu clave secreta.
              </p>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => setShowConfirm(false)} style={{
                  flex: 1, padding: '11px', background: C.surface,
                  border: `1px solid ${C.border}`, borderRadius: 8,
                  color: C.textMuted, fontSize: 13, cursor: 'pointer',
                }}>
                  Cancelar
                </button>
                <button onClick={onClearWallet} style={{
                  flex: 1, padding: '11px',
                  background: 'linear-gradient(135deg, #ef4444 0%, #b91c1c 100%)',
                  border: 'none', borderRadius: 8, color: '#fff',
                  fontSize: 13, fontWeight: 700, cursor: 'pointer',
                }}>
                  Sí, borrar
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── SCREEN: TRANSFER ─────────────────────────────────────────────────────────
function TransferScreen({ wallet, balances, investBalances, updateInvest, onBack, onRefresh }: {
  wallet: { publicKey: string; secretKey: string }
  balances: Balance[]
  investBalances: InvestBalances
  updateInvest: (fn: (prev: InvestBalances) => InvestBalances) => void
  onBack: () => void
  onRefresh: () => void
}) {
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1)
  const [destAddr, setDestAddr] = useState('')
  const [amountMxn, setAmountMxn] = useState('')
  const [asset, setAsset] = useState<'MXN' | 'USD' | 'CETES'>('MXN')
  const [txSteps, setTxSteps] = useState<Array<{ label: string; done: boolean }>>([])
  const [txHash, setTxHash] = useState('')
  const [txError, setTxError] = useState('')
  const [showConfetti, setShowConfetti] = useState(false)

  const isValidAddr = /^G[A-Z2-7]{55}$/.test(destAddr.trim())
  const mxnVal = parseFloat(amountMxn) || 0
  const xlmVal = mxnVal / DR.XLM_MXN

  const xlmBalance = balances.find(b => b.code === 'XLM')?.amount ?? 0

  // Available balance depends on selected asset
  const availableMxn = asset === 'USD'
    ? investBalances.usd * DR.USDC_MXN
    : asset === 'CETES'
    ? investBalances.cetes
    : (xlmBalance - 1) * DR.XLM_MXN

  const insufficientFunds = mxnVal > 0 && mxnVal > availableMxn

  const handleConfirm = async () => {
    setStep(3)
    setTxError('')
    const steps = [
      { label: 'Validando dirección...', done: false },
      { label: 'Construyendo transacción...', done: false },
      { label: 'Firmando con tu clave...', done: false },
      { label: 'Enviando a Stellar...', done: false },
      { label: 'Confirmando en ledger...', done: false },
    ]
    setTxSteps(steps)
    const mark = (i: number) => setTxSteps(prev => prev.map((s, idx) => idx === i ? { ...s, done: true } : s))
    try {
      await new Promise(r => setTimeout(r, 500)); mark(0)
      await new Promise(r => setTimeout(r, 400)); mark(1)
      await new Promise(r => setTimeout(r, 400)); mark(2)

      if (asset === 'USD' || asset === 'CETES') {
        // Local investment balance transfer (simulated)
        const deductAmt = asset === 'USD' ? mxnVal / DR.USDC_MXN : mxnVal
        updateInvest(prev => asset === 'USD'
          ? { ...prev, usd: Math.max(0, prev.usd - deductAmt) }
          : { ...prev, cetes: Math.max(0, prev.cetes - deductAmt) }
        )
        saveInvestTx({ id: Date.now().toString(), type: 'sent', asset, amount: deductAmt, createdAt: new Date().toISOString() })
        mark(3)
        await new Promise(r => setTimeout(r, 700)); mark(4)
        setTxHash('local-' + Date.now().toString(36))
        setStep(4)
        setShowConfetti(true)
      } else {
        const hash = await buildAndSubmitPayment({
          senderSecret: wallet.secretKey,
          destination: destAddr.trim(),
          amount: xlmVal.toFixed(7),
          asset: ASSETS.XLM,
          memo: `centurion-tx-${Date.now().toString(36).slice(-6)}`,
        })
        mark(3)
        await new Promise(r => setTimeout(r, 700)); mark(4)
        setTxHash(hash)
        setStep(4)
        setShowConfetti(true)
        // Wait for Stellar to index the transaction before refreshing balance (retry at 3.5s and 8s)
        setTimeout(() => onRefresh(), 3500)
        setTimeout(() => onRefresh(), 8000)
      }
    } catch (e) {
      setTxError(e instanceof Error ? e.message : 'Error al enviar')
      setStep(4)
    }
  }

  return (
    <div style={{ height: '100%', overflowY: 'auto', paddingBottom: 80, background: C.bg }}>
      <Confetti show={showConfetti} />
      <div style={{ padding: '52px 20px 16px' }}>
        <BackBtn onBack={onBack} />
        <h2 style={{ fontSize: 24, fontWeight: 800, color: C.text, marginTop: 12 }}>Enviar Dinero</h2>
        <p style={{ fontSize: 13, color: C.textMuted }}>Transfiere a cualquier dirección Stellar</p>
      </div>

      <div style={{ padding: '0 20px' }}>
        {/* Step bar */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 24 }}>
          {[1,2,3,4].map(s => (
            <div key={s} style={{ flex: 1, height: 3, borderRadius: 2, background: step >= s ? C.gold : C.border, transition: 'background 0.3s' }} />
          ))}
        </div>

        {step === 1 && (
          <div className="fade-in">
            {/* Asset selector */}
            <p style={{ fontSize: 12, color: C.textMuted, marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Enviar desde</p>
            <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
              {(['MXN', 'USD', 'CETES'] as const).map(a => (
                <button key={a} onClick={() => setAsset(a)} style={{
                  flex: 1, padding: '10px', borderRadius: 10, border: 'none',
                  background: asset === a ? C.gold : C.card,
                  color: asset === a ? '#000' : C.textMuted,
                  fontSize: 14, fontWeight: 700, cursor: 'pointer', transition: 'all 0.2s',
                }}>{a}</button>
              ))}
            </div>

            {/* Destination */}
            <p style={{ fontSize: 12, color: C.textMuted, marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Dirección destino</p>
            <div style={{ position: 'relative', marginBottom: 6 }}>
              <input
                value={destAddr}
                onChange={e => setDestAddr(e.target.value)}
                placeholder="G... dirección Stellar"
                style={{
                  width: '100%', padding: '14px 40px 14px 14px', boxSizing: 'border-box',
                  background: C.card, border: `1.5px solid ${destAddr && !isValidAddr ? C.red : isValidAddr ? C.green : C.border}`,
                  borderRadius: 12, color: C.text, fontSize: 13,
                  fontFamily: 'monospace', outline: 'none',
                }}
              />
              {isValidAddr && <span style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', color: C.green, fontSize: 16 }}>✓</span>}
            </div>
            {destAddr && !isValidAddr && <p style={{ fontSize: 11, color: C.red, marginBottom: 8 }}>Dirección inválida. Debe comenzar con G y tener 56 caracteres.</p>}

            {/* Amount */}
            <p style={{ fontSize: 12, color: C.textMuted, marginBottom: 8, marginTop: 16, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Monto</p>
            <div style={{
              background: C.card, border: `1.5px solid ${C.border}`, borderRadius: 14,
              padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8,
            }}>
              <span style={{ fontSize: 24, color: C.textMuted }}>$</span>
              <input
                type="number" value={amountMxn}
                onChange={e => setAmountMxn(e.target.value)}
                placeholder="0.00" min="0.01" step="0.01"
                style={{
                  flex: 1, background: 'none', border: 'none', outline: 'none',
                  fontSize: 28, fontWeight: 800, color: C.text, textAlign: 'center',
                }}
              />
              <span style={{ fontSize: 16, color: C.textMuted, fontWeight: 600 }}>{asset}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: insufficientFunds ? 4 : 20 }}>
              <p style={{ fontSize: 11, color: C.textDim }}>
                {mxnVal > 0 ? `≈ ${xlmVal.toFixed(4)} XLM en red Stellar` : ''}
              </p>
              <p style={{ fontSize: 11, color: C.textMuted }}>
                Disponible: <span style={{ color: C.green, fontWeight: 600 }}>${fmt(availableMxn)} {asset}</span>
              </p>
            </div>
            {insufficientFunds && (
              <div style={{
                background: 'rgba(239,68,68,0.1)', border: `1px solid ${C.red}44`,
                borderRadius: 10, padding: '10px 14px', marginBottom: 16,
                display: 'flex', alignItems: 'center', gap: 8,
              }}>
                <span style={{ fontSize: 16 }}>⚠️</span>
                <p style={{ fontSize: 13, color: C.red, fontWeight: 600 }}>
                  Fondos insuficientes. Disponible: ${fmt(availableMxn)} {asset}
                </p>
              </div>
            )}

            <button
              onClick={() => setStep(2)}
              disabled={!isValidAddr || mxnVal <= 0 || insufficientFunds}
              style={{
                width: '100%', padding: '16px', borderRadius: 14, border: 'none',
                background: isValidAddr && mxnVal > 0 && !insufficientFunds ? `linear-gradient(135deg, ${C.gold}, #d97706)` : C.card,
                color: isValidAddr && mxnVal > 0 && !insufficientFunds ? '#000' : C.textDim,
                fontSize: 16, fontWeight: 700,
                cursor: isValidAddr && mxnVal > 0 && !insufficientFunds ? 'pointer' : 'not-allowed',
                boxShadow: isValidAddr && mxnVal > 0 && !insufficientFunds ? `0 8px 24px ${C.goldGlow}` : 'none',
                transition: 'all 0.3s',
              }}>
              Continuar →
            </button>
          </div>
        )}

        {step === 2 && (
          <div className="slide-up">
            <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 20, padding: 20, marginBottom: 16 }}>
              <p style={{ fontSize: 12, color: C.textMuted, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 14 }}>Resumen de transferencia</p>
              {[
                { label: 'Para', value: abbrev(destAddr) },
                { label: 'Envías', value: `$${fmt(mxnVal)} ${asset}`, color: C.gold },
                { label: 'En red', value: `${xlmVal.toFixed(4)} XLM`, color: C.primary },
                { label: 'Comisión red', value: '0.000100 XLM (~$0.002)' },
                { label: 'Tiempo', value: '~5 segundos', color: C.green },
              ].map(r => (
                <div key={r.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: `1px solid ${C.border}` }}>
                  <span style={{ fontSize: 13, color: C.textDim }}>{r.label}</span>
                  <span style={{ fontSize: 13, fontWeight: 600, color: (r as any).color || C.text }}>{r.value}</span>
                </div>
              ))}
            </div>
            {/* Infrastructure */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
              {[{ name: 'Etherfuse', icon: '⚓', color: '#10b981' }, { name: 'Stellar', icon: '✦', color: '#6366f1' }].map((p, i) => (
                <div key={p.name} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  {i > 0 && <span style={{ color: C.textDim }}>→</span>}
                  <div style={{ background: C.card, border: `1px solid ${p.color}44`, borderRadius: 8, padding: '6px 12px', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 14 }}>{p.icon}</span>
                    <span style={{ fontSize: 12, fontWeight: 700, color: p.color }}>{p.name}</span>
                  </div>
                </div>
              ))}
            </div>
            <button onClick={handleConfirm} style={{
              width: '100%', padding: '16px', borderRadius: 14, border: 'none',
              background: `linear-gradient(135deg, ${C.gold} 0%, ${C.primary} 100%)`,
              color: '#fff', fontSize: 16, fontWeight: 700, cursor: 'pointer',
              boxShadow: `0 8px 24px ${C.goldGlow}`, marginBottom: 10,
            }}>
              Confirmar Transferencia ⚡
            </button>
            <button onClick={() => setStep(1)} style={{
              width: '100%', padding: '14px', borderRadius: 14, border: `1px solid ${C.border}`,
              background: 'none', color: C.textMuted, fontSize: 14, fontWeight: 600, cursor: 'pointer',
            }}>
              Cancelar
            </button>
          </div>
        )}

        {step === 3 && (
          <div className="slide-up" style={{ textAlign: 'center' }}>
            <h3 style={{ fontSize: 22, fontWeight: 800, color: C.text, marginBottom: 6 }}>Enviando...</h3>
            <p style={{ fontSize: 14, color: C.textMuted, marginBottom: 32 }}>No cierres la app</p>
            <div style={{ position: 'relative', display: 'inline-block', marginBottom: 36 }}>
              <div style={{ width: 72, height: 72, borderRadius: '50%', border: `3px solid ${C.border}`, borderTop: `3px solid ${C.gold}`, animation: 'spin 0.8s linear infinite' }} />
              <span style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22 }}>→</span>
            </div>
            <div style={{ textAlign: 'left', maxWidth: 300, margin: '0 auto' }}>
              {txSteps.map((s, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 0', opacity: s.done ? 1 : 0.35, transition: 'opacity 0.3s', borderBottom: `1px solid ${C.border}` }}>
                  <div style={{ width: 24, height: 24, borderRadius: '50%', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: s.done ? C.gold : C.card, fontSize: 12, fontWeight: 700, color: s.done ? '#000' : C.textDim }}>
                    {s.done ? '✓' : i + 1}
                  </div>
                  <span style={{ fontSize: 13, color: s.done ? C.text : C.textDim }}>{s.label}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {step === 4 && (
          <div className="slide-up" style={{ textAlign: 'center' }}>
            {!txError ? (
              <>
                <svg width="90" height="90" viewBox="0 0 100 100" style={{ marginBottom: 16 }}>
                  <circle cx="50" cy="50" r="45" fill="none" stroke={C.border} strokeWidth="4" />
                  <circle cx="50" cy="50" r="45" fill="none" stroke={C.green} strokeWidth="4"
                    strokeDasharray="283" strokeDashoffset="283"
                    style={{ animation: 'circleFill 0.8s ease forwards', transformOrigin: '50% 50%', transform: 'rotate(-90deg)' }} />
                  <polyline points="28,52 44,68 72,34" fill="none" stroke={C.green} strokeWidth="5"
                    strokeLinecap="round" strokeLinejoin="round"
                    strokeDasharray="100" strokeDashoffset="100"
                    style={{ animation: 'checkDraw 0.5s ease 0.6s forwards' }} />
                </svg>
                <h2 style={{ fontSize: 28, fontWeight: 900, color: C.text, marginBottom: 6 }}>¡Enviado!</h2>
                <p style={{ fontSize: 22, fontWeight: 800, color: C.gold, marginBottom: 20 }}>${fmt(mxnVal)} {asset}</p>
                <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: '14px 18px', marginBottom: 20, textAlign: 'left' }}>
                  {[
                    { label: 'Para', value: abbrev(destAddr) },
                    { label: 'Tx Hash', value: abbrev(txHash, 8), mono: true },
                    { label: 'Tiempo', value: '~5 segundos', color: C.green },
                  ].map(r => (
                    <div key={r.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: `1px solid ${C.border}` }}>
                      <span style={{ fontSize: 12, color: C.textDim }}>{r.label}</span>
                      <span style={{ fontSize: 12, fontWeight: 600, color: (r as any).color || C.textMuted, fontFamily: (r as any).mono ? 'monospace' : 'inherit' }}>{r.value}</span>
                    </div>
                  ))}
                </div>
                <a href={`https://stellar.expert/explorer/testnet/tx/${txHash}`} target="_blank" rel="noopener noreferrer"
                  style={{ display: 'block', fontSize: 13, color: C.primary, marginBottom: 20, textDecoration: 'none', fontWeight: 600 }}>
                  Ver en Stellar Expert →
                </a>
              </>
            ) : (
              <>
                <div style={{ fontSize: 60, marginBottom: 16 }}>❌</div>
                <h2 style={{ fontSize: 24, fontWeight: 800, color: C.red, marginBottom: 8 }}>Error al enviar</h2>
                <p style={{ fontSize: 14, color: C.textMuted, marginBottom: 24 }}>{txError}</p>
              </>
            )}
            <button onClick={onBack} style={{
              width: '100%', padding: '16px', borderRadius: 14, border: 'none',
              background: `linear-gradient(135deg, ${C.primary}, #8b5cf6)`,
              color: '#fff', fontSize: 16, fontWeight: 700, cursor: 'pointer',
            }}>Listo</button>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── ROOT APP ─────────────────────────────────────────────────────────────────
type AppState = 'wallet-setup' | 'onboarding' | 'app'

export type InvestBalances = { usd: number; cetes: number; mxnSpent: number }
export type InvestTx = { id: string; type: 'received' | 'sent' | 'converted'; asset: 'USD' | 'CETES'; amount: number; from?: string; createdAt: string }

function loadInvest(): InvestBalances {
  try {
    const d = JSON.parse(localStorage.getItem('centurion_invest') || '{}')
    if (!d.mxnSpent) d.mxnSpent = 0
    return { usd: Number(d.usd) || 0, cetes: Number(d.cetes) || 0, mxnSpent: Number(d.mxnSpent) || 0 }
  } catch { return { usd: 0, cetes: 0, mxnSpent: 0 } }
}
function saveInvest(b: InvestBalances) { localStorage.setItem('centurion_invest', JSON.stringify(b)) }
function loadInvestTxs(): InvestTx[] {
  try { return JSON.parse(localStorage.getItem('centurion_invest_txs') || '[]') } catch { return [] }
}
function saveInvestTx(tx: InvestTx) {
  const txs = loadInvestTxs()
  txs.unshift(tx)
  localStorage.setItem('centurion_invest_txs', JSON.stringify(txs.slice(0, 50)))
}

export default function App() {
  const [appState, setAppState] = useState<AppState>('wallet-setup')
  const [wallet, setWallet] = useState<{ publicKey: string; secretKey: string } | null>(null)
  const [view, setView] = useState('home')
  const [balances, setBalances] = useState<Balance[]>([])
  const [transactions, setTransactions] = useState<StellarTransaction[]>([])
  const [ledger, setLedger] = useState(0)
  const [dataLoading, setDataLoading] = useState(false)
  const [investBalances, setInvestBalances] = useState<InvestBalances>(loadInvest)
  const refreshIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const updateInvest = useCallback((fn: (prev: InvestBalances) => InvestBalances) => {
    setInvestBalances(prev => {
      const next = fn(prev)
      saveInvest(next)
      return next
    })
  }, [])

  // On mount: restore session
  useEffect(() => {
    const w = loadWallet()
    if (w) {
      setWallet(w)
      const alreadyOnboarded = localStorage.getItem('centurion_onboarded') === '1'
      setAppState(alreadyOnboarded ? 'app' : 'onboarding')
    }
  }, [])

  const fetchData = useCallback(async (publicKey: string) => {
    setDataLoading(true)
    try {
      const [bals, txs, led] = await Promise.all([
        getBalances(publicKey),
        getTransactions(publicKey, 20),
        getLatestLedger(),
      ])
      // Only update if we got real data — prevents blank screen on transient network errors
      if (bals.length > 0) setBalances(bals)
      setTransactions(txs)
      if (led > 0) setLedger(led)
    } catch { /* silently fail */ }
    setDataLoading(false)
  }, [])

  // Start polling + real-time streaming when in app state
  useEffect(() => {
    if (appState !== 'app' || !wallet) return

    fetchData(wallet.publicKey)

    // Poll every 10s as fallback
    refreshIntervalRef.current = setInterval(() => {
      fetchData(wallet.publicKey)
    }, 10000)

    // Real-time stream: refresh instantly when a payment arrives
    const stopStream = streamPayments(wallet.publicKey, () => {
      fetchData(wallet.publicKey)
    })

    return () => {
      if (refreshIntervalRef.current) clearInterval(refreshIntervalRef.current)
      stopStream()
    }
  }, [appState, wallet, fetchData])

  const handleWalletReady = (w: { publicKey: string; secretKey: string }) => {
    setWallet(w)
    setAppState('onboarding')
  }

  const handleOnboardingReady = () => {
    localStorage.setItem('centurion_onboarded', '1')
    setAppState('app')
  }

  const handleClearWallet = () => {
    clearWallet()
    localStorage.removeItem('centurion_onboarded')
    setWallet(null)
    setBalances([])
    setTransactions([])
    setLedger(0)
    setAppState('wallet-setup')
    setView('home')
  }

  const handleRefresh = useCallback(() => {
    if (wallet) fetchData(wallet.publicKey)
  }, [wallet, fetchData])

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: GLOBAL_CSS }} />
      <div style={{
        width: '100vw', height: '100dvh', maxWidth: 430, margin: '0 auto',
        background: C.bg, fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
        color: C.text, position: 'relative', overflow: 'hidden',
        boxShadow: '0 0 80px rgba(0,0,0,0.8)',
      }}>
        {appState === 'wallet-setup' && (
          <WalletSetup onWalletReady={handleWalletReady} />
        )}

        {appState === 'onboarding' && wallet && (
          <Onboarding wallet={wallet} onReady={handleOnboardingReady} />
        )}

        {appState === 'app' && wallet && (
          <>
            {view === 'home' && (
              <Home
                wallet={wallet}
                setView={setView}
                balances={balances}
                investBalances={investBalances}
                updateInvest={updateInvest}
                transactions={transactions}
                ledger={ledger}
                loading={dataLoading}
                onRefresh={handleRefresh}
              />
            )}
            {view === 'pay' && (
              <PayScreen
                wallet={wallet}
                onBack={() => setView('home')}
                onRefresh={handleRefresh}
              />
            )}
            {view === 'receive' && (
              <ReceiveScreen
                wallet={wallet}
                onBack={() => setView('home')}
                onRefresh={handleRefresh}
              />
            )}
            {view === 'transfer' && (
              <TransferScreen
                wallet={wallet}
                balances={balances}
                investBalances={investBalances}
                updateInvest={updateInvest}
                onBack={() => setView('home')}
                onRefresh={handleRefresh}
              />
            )}
            {view === 'history' && (
              <HistoryScreen
                transactions={transactions}
                loading={dataLoading}
                onRefresh={handleRefresh}
                onBack={() => setView('home')}
              />
            )}
            {view === 'settings' && (
              <SettingsScreen
                wallet={wallet}
                onBack={() => setView('home')}
                onClearWallet={handleClearWallet}
              />
            )}

            <BottomNav view={view} setView={setView} />
            <StellarBadge ledger={ledger} />
          </>
        )}
      </div>
    </>
  )
}
