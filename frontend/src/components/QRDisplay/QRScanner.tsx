import React, { useEffect, useRef, useState, CSSProperties } from 'react'
import { BrowserQRCodeReader } from '@zxing/library'

interface QRScannerProps {
  onScan: (data: string) => void
  onError?: (error: string) => void
  onClose?: () => void
}

const THEME = {
  bg: '#0a0a1a',
  card: '#1a1a2e',
  primary: '#4f46e5',
  gold: '#f59e0b',
  error: '#ef4444',
  text: '#e2e8f0',
  muted: '#64748b'
}

export const QRScanner: React.FC<QRScannerProps> = ({ onScan, onError, onClose }) => {
  const videoRef = useRef<HTMLVideoElement>(null)
  const readerRef = useRef<BrowserQRCodeReader | null>(null)
  const [permissionState, setPermissionState] = useState<
    'requesting' | 'granted' | 'denied' | 'error'
  >('requesting')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [scanned, setScanned] = useState(false)
  const hasScannedRef = useRef(false)

  useEffect(() => {
    let cancelled = false

    const startScanner = async () => {
      try {
        // Check camera permission
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment' }
        })
        stream.getTracks().forEach((t) => t.stop()) // Release immediately, ZXing will re-acquire

        if (cancelled) return

        setPermissionState('granted')

        const reader = new BrowserQRCodeReader()
        readerRef.current = reader

        const allDevices = await navigator.mediaDevices.enumerateDevices()
        const devices = allDevices.filter((d) => d.kind === 'videoinput')
        // Prefer back camera
        const backCamera =
          devices.find(
            (d: MediaDeviceInfo) =>
              d.label.toLowerCase().includes('back') ||
              d.label.toLowerCase().includes('rear') ||
              d.label.toLowerCase().includes('environment')
          ) || devices[0]

        if (!backCamera && devices.length === 0) {
          throw new Error('No camera found on this device')
        }

        const deviceId = backCamera?.deviceId

        await reader.decodeFromVideoDevice(
          deviceId,
          videoRef.current!,
          (result, err) => {
            if (cancelled) return
            if (result && !hasScannedRef.current) {
              hasScannedRef.current = true
              setScanned(true)
              reader.reset()
              onScan(result.getText())
            }
            if (err && err.name !== 'NotFoundException') {
              // NotFoundException is normal when no QR in frame
              console.debug('QR scan error:', err.message)
            }
          }
        )
      } catch (err) {
        if (cancelled) return
        const message =
          err instanceof Error ? err.message : 'Camera access failed'
        if (
          message.includes('Permission denied') ||
          message.includes('NotAllowedError') ||
          message.includes('denied')
        ) {
          setPermissionState('denied')
          setErrorMessage(
            'Camera permission denied. Please allow camera access in your browser settings.'
          )
        } else {
          setPermissionState('error')
          setErrorMessage(message)
        }
        if (onError) onError(message)
      }
    }

    startScanner()

    return () => {
      cancelled = true
      if (readerRef.current) {
        readerRef.current.reset()
        readerRef.current = null
      }
    }
  }, [onScan, onError])

  const overlayStyle: CSSProperties = {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,0.95)',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000
  }

  const videoContainerStyle: CSSProperties = {
    position: 'relative',
    width: '100%',
    maxWidth: 400,
    borderRadius: 16,
    overflow: 'hidden'
  }

  if (permissionState === 'requesting') {
    return (
      <div style={overlayStyle}>
        <div style={{ textAlign: 'center', color: THEME.text }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>📷</div>
          <div style={{ fontSize: 18, fontWeight: 600 }}>Requesting Camera...</div>
          <div style={{ fontSize: 14, color: THEME.muted, marginTop: 8 }}>
            Please allow camera access when prompted
          </div>
        </div>
      </div>
    )
  }

  if (permissionState === 'denied' || permissionState === 'error') {
    return (
      <div style={overlayStyle}>
        <div
          style={{
            background: THEME.card,
            borderRadius: 20,
            padding: 32,
            maxWidth: 340,
            textAlign: 'center',
            margin: 20
          }}
        >
          <div style={{ fontSize: 48, marginBottom: 16 }}>
            {permissionState === 'denied' ? '🚫' : '⚠️'}
          </div>
          <div style={{ fontSize: 18, fontWeight: 600, color: THEME.text, marginBottom: 12 }}>
            {permissionState === 'denied' ? 'Camera Access Denied' : 'Camera Error'}
          </div>
          <div style={{ fontSize: 14, color: THEME.muted, marginBottom: 24, lineHeight: 1.6 }}>
            {errorMessage}
          </div>
          {onClose && (
            <button
              onClick={onClose}
              style={{
                background: THEME.primary,
                color: '#fff',
                border: 'none',
                borderRadius: 12,
                padding: '12px 28px',
                fontSize: 15,
                fontWeight: 600,
                cursor: 'pointer',
                width: '100%'
              }}
            >
              Go Back
            </button>
          )}
        </div>
      </div>
    )
  }

  return (
    <div style={overlayStyle}>
      <div style={{ width: '100%', maxWidth: 420, padding: '0 20px' }}>
        {/* Header */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 20
          }}
        >
          <div style={{ color: THEME.text, fontSize: 18, fontWeight: 700 }}>
            Scan QR Code
          </div>
          {onClose && (
            <button
              onClick={onClose}
              style={{
                background: 'rgba(255,255,255,0.1)',
                border: 'none',
                borderRadius: '50%',
                width: 36,
                height: 36,
                color: THEME.text,
                fontSize: 18,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              ✕
            </button>
          )}
        </div>

        {/* Video container */}
        <div style={videoContainerStyle}>
          <video
            ref={videoRef}
            style={{
              width: '100%',
              display: 'block',
              borderRadius: 16,
              border: `2px solid ${scanned ? THEME.gold : THEME.primary}`
            }}
            autoPlay
            muted
            playsInline
          />
          {/* Scanning corners overlay */}
          <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
            {['topLeft', 'topRight', 'bottomLeft', 'bottomRight'].map((corner) => (
              <div
                key={corner}
                style={{
                  position: 'absolute',
                  width: 28,
                  height: 28,
                  ...(corner.includes('top') ? { top: 16 } : { bottom: 16 }),
                  ...(corner.includes('Left') ? { left: 16 } : { right: 16 }),
                  borderColor: scanned ? THEME.gold : THEME.primary,
                  borderStyle: 'solid',
                  borderWidth: 0,
                  borderTopWidth: corner.includes('top') ? 3 : 0,
                  borderBottomWidth: corner.includes('bottom') ? 3 : 0,
                  borderLeftWidth: corner.includes('Left') ? 3 : 0,
                  borderRightWidth: corner.includes('Right') ? 3 : 0,
                  borderRadius:
                    corner === 'topLeft'
                      ? '4px 0 0 0'
                      : corner === 'topRight'
                      ? '0 4px 0 0'
                      : corner === 'bottomLeft'
                      ? '0 0 0 4px'
                      : '0 0 4px 0'
                }}
              />
            ))}
          </div>
          {/* Scan line animation */}
          {!scanned && (
            <div
              style={{
                position: 'absolute',
                left: 0,
                right: 0,
                height: 2,
                background: `linear-gradient(90deg, transparent, ${THEME.primary}, transparent)`,
                animation: 'scanLine 2s linear infinite'
              }}
            />
          )}
        </div>

        <div style={{ textAlign: 'center', marginTop: 20, color: THEME.muted, fontSize: 14 }}>
          {scanned ? (
            <span style={{ color: THEME.gold }}>QR code detected!</span>
          ) : (
            'Point the camera at a Centurion QR code'
          )}
        </div>
      </div>
      <style>{`
        @keyframes scanLine {
          0% { top: 10%; }
          50% { top: 85%; }
          100% { top: 10%; }
        }
      `}</style>
    </div>
  )
}

export default QRScanner
