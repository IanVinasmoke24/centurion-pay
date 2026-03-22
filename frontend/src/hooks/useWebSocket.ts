import { useState, useEffect, useRef, useCallback } from 'react'

export type WSConnectionStatus = 'connecting' | 'connected' | 'disconnected' | 'error'

export interface WSMessage {
  type: 'PAYMENT_SETTLED' | 'QR_SETTLED' | 'RATE_UPDATE' | string
  payload: Record<string, unknown>
  timestamp: number
}

interface UseWebSocketResult {
  lastMessage: WSMessage | null
  connectionStatus: WSConnectionStatus
  sendMessage: (msg: Record<string, unknown>) => void
}

const WS_URL = import.meta.env.VITE_WS_URL || 'ws://localhost:3001'
const RECONNECT_DELAY_MS = 3_000
const MAX_RECONNECT_ATTEMPTS = 10

export function useWebSocket(url: string = WS_URL): UseWebSocketResult {
  const [lastMessage, setLastMessage] = useState<WSMessage | null>(null)
  const [connectionStatus, setConnectionStatus] =
    useState<WSConnectionStatus>('connecting')

  const wsRef = useRef<WebSocket | null>(null)
  const reconnectAttemptsRef = useRef(0)
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const isMountedRef = useRef(true)

  const connect = useCallback(() => {
    if (!isMountedRef.current) return
    if (wsRef.current?.readyState === WebSocket.OPEN) return

    setConnectionStatus('connecting')

    try {
      const ws = new WebSocket(url)
      wsRef.current = ws

      ws.onopen = () => {
        if (!isMountedRef.current) return
        reconnectAttemptsRef.current = 0
        setConnectionStatus('connected')
        // Send client hello
        ws.send(JSON.stringify({ type: 'HELLO', client: 'centurion-pwa' }))
      }

      ws.onmessage = (event: MessageEvent) => {
        if (!isMountedRef.current) return
        try {
          const data = JSON.parse(event.data as string) as WSMessage
          setLastMessage({ ...data, timestamp: data.timestamp ?? Date.now() })
        } catch {
          // Non-JSON message, ignore
        }
      }

      ws.onerror = () => {
        if (!isMountedRef.current) return
        setConnectionStatus('error')
      }

      ws.onclose = () => {
        if (!isMountedRef.current) return
        setConnectionStatus('disconnected')
        wsRef.current = null

        // Auto-reconnect with backoff
        if (reconnectAttemptsRef.current < MAX_RECONNECT_ATTEMPTS) {
          const delay =
            RECONNECT_DELAY_MS * Math.min(reconnectAttemptsRef.current + 1, 5)
          reconnectAttemptsRef.current++
          reconnectTimerRef.current = setTimeout(connect, delay)
        }
      }
    } catch {
      setConnectionStatus('error')
    }
  }, [url])

  useEffect(() => {
    isMountedRef.current = true
    connect()

    return () => {
      isMountedRef.current = false
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current)
      }
      if (wsRef.current) {
        wsRef.current.onclose = null // Prevent reconnect on intentional close
        wsRef.current.close()
        wsRef.current = null
      }
    }
  }, [connect])

  const sendMessage = useCallback((msg: Record<string, unknown>) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(msg))
    } else {
      console.warn('WebSocket not connected, cannot send message')
    }
  }, [])

  return { lastMessage, connectionStatus, sendMessage }
}
