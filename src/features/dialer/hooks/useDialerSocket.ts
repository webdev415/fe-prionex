import { useCallback, useEffect, useRef, useState } from 'react'
import { io, type Socket } from 'socket.io-client'

import { getAccessToken } from '@/lib/api'

import type { RoutedCall } from '../types'

const WS_URL =
  import.meta.env.VITE_WS_URL !== undefined ? import.meta.env.VITE_WS_URL : 'http://localhost:8000'

const SOCKET_PATH = '/ws/dialer'

interface DialerEvent<T> {
  event_type: string
  timestamp: string
  data: T
}

export interface DialerSocketState {
  routedCall: RoutedCall | null
  queueComplete: boolean
  clearRoutedCall: () => void
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
