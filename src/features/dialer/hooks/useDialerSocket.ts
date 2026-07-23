/**
 * Operator dialer socket (KAN-379) — routed live-call stream.
 *
 * Subscribes to the dialer-service Socket.IO feed and drives the operator
 * active-call panel. Mirrors `features/calls/hooks/useCallWebSocket.ts`:
 * connects through Kong (VITE_WS_URL), authenticates via the `auth.token`
 * handshake, and listens for the dialer's operator events.
 *
 * Events (envelope: `{ event_type, timestamp, data }`):
 *   - dialer.call_routed     → a live call was bridged to this operator
 *   - dialer.call_ended      → the current call finished
 *   - dialer.queue_completed → the whole queue has been dialed through (§6.1)
 *
 * The operator's room is derived server-side from the authenticated JWT
 * user_id, so no join/agent-extension handshake is needed here.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { io, type Socket } from 'socket.io-client'

import { getAccessToken } from '@/lib/api'

import type { RoutedCall } from '../types'

const WS_URL =
  import.meta.env.VITE_WS_URL !== undefined ? import.meta.env.VITE_WS_URL : 'http://localhost:8000'

/** Socket.IO path for the dialer feed (Kong route /ws/dialer). */
const SOCKET_PATH = '/ws/dialer'

interface DialerEvent<T> {
  event_type: string
  timestamp: string
  data: T
}

export interface DialerSocketState {
  /** The live call currently bridged to this operator, or null. */
  routedCall: RoutedCall | null
  /** True once the whole queue has been dialed through (ticket §6.1). */
  queueComplete: boolean
  /** Clear the current routed call (e.g. after hang-up / wait-time). */
  clearRoutedCall: () => void
  /** Whether the socket is currently connected. */
  connected: boolean
}

export function useDialerSocket(enabled: boolean): DialerSocketState {
  const socketRef = useRef<Socket | null>(null)
  const [routedCall, setRoutedCall] = useState<RoutedCall | null>(null)
  const [queueComplete, setQueueComplete] = useState(false)
  const [connected, setConnected] = useState(false)

  const clearRoutedCall = useCallback(() => setRoutedCall(null), [])

  useEffect(() => {
    if (!enabled) {
      // Disconnecting fires the socket's own 'disconnect' handler, which
      // resets `connected` — so no synchronous setState in the effect body.
      if (socketRef.current) {
        socketRef.current.disconnect()
        socketRef.current = null
      }
      return
    }

    const token = getAccessToken()
    if (!token) return

    const socket: Socket = io(WS_URL, {
      path: SOCKET_PATH,
      transports: ['websocket'],
      auth: { token },
    })
    socketRef.current = socket

    socket.on('connect', () => setConnected(true))
    socket.on('disconnect', () => setConnected(false))

    socket.on('dialer.call_routed', (event: DialerEvent<RoutedCall>) => {
      setQueueComplete(false)
      setRoutedCall(event.data)
    })

    socket.on('dialer.call_ended', () => {
      setRoutedCall(null)
    })

    socket.on('dialer.queue_completed', () => {
      setQueueComplete(true)
    })

    return () => {
      socket.disconnect()
      socketRef.current = null
    }
  }, [enabled])

  return { routedCall, queueComplete, clearRoutedCall, connected }
}
