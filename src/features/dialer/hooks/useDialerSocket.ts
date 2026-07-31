import { useCallback, useEffect, useRef, useState } from 'react'
import { io, type Socket } from 'socket.io-client'

import { getAccessToken } from '@/lib/api'

import { USE_DIALER_MOCK } from '../api/dialerService'
import { MOCK_ROUTED_CALLS } from '../mocks/fixtures'
import type { RoutedCall } from '../types'

const WS_URL =
  import.meta.env.VITE_WS_URL !== undefined ? import.meta.env.VITE_WS_URL : 'http://localhost:8000'

const SOCKET_PATH = '/ws/dialer'

const MOCK_FIRST_CALL_MS = 2500
const MOCK_NEXT_CALL_MS = 2500

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

function useRealDialerSocket(enabled: boolean): DialerSocketState {
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

function useMockDialerSocket(enabled: boolean): DialerSocketState {
  const [routedCall, setRoutedCall] = useState<RoutedCall | null>(null)
  const [queueComplete, setQueueComplete] = useState(false)
  const indexRef = useRef(0)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const scheduleNext = useCallback((delayMs: number) => {
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => {
      const idx = indexRef.current
      if (idx >= MOCK_ROUTED_CALLS.length) {
        setQueueComplete(true)
        return
      }
      indexRef.current = idx + 1
      setRoutedCall({ ...MOCK_ROUTED_CALLS[idx], started_at: new Date().toISOString() })
    }, delayMs)
  }, [])

  const clearRoutedCall = useCallback(() => {
    setRoutedCall(null)
    scheduleNext(MOCK_NEXT_CALL_MS)
  }, [scheduleNext])

  useEffect(() => {
    if (!enabled) return
    scheduleNext(MOCK_FIRST_CALL_MS)
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
      indexRef.current = 0
      setRoutedCall(null)
      setQueueComplete(false)
    }
  }, [enabled, scheduleNext])

  return { routedCall, queueComplete, clearRoutedCall, connected: enabled }
}

export const useDialerSocket = USE_DIALER_MOCK ? useMockDialerSocket : useRealDialerSocket
