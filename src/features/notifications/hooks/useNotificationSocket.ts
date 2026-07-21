import { useEffect, useRef, useState } from 'react'
import { io, Socket } from 'socket.io-client'
import { useQueryClient } from '@tanstack/react-query'

import type { NotificationItem } from '../types'

const WS_URL =
  import.meta.env.VITE_WS_URL !== undefined ? import.meta.env.VITE_WS_URL : 'http://localhost:8005'

const MAX_RECONNECT_ATTEMPTS = 10
// Hard cap on WS-driven refetches: never invalidate the bell's queries
// more than once per ``INVALIDATE_MIN_INTERVAL_MS``. Defends the FE
// against a chatty WS server or a reconnect loop.
const INVALIDATE_MIN_INTERVAL_MS = 1000

interface UseNotificationSocketReturn {
  connected: boolean
  reconnecting: boolean
}

export function useNotificationSocket(
  onNewNotification?: (notification: NotificationItem) => void
): UseNotificationSocketReturn {
  const queryClient = useQueryClient()
  const socketRef = useRef<Socket | null>(null)
  const callbackRef = useRef(onNewNotification)
  const lastInvalidateAtRef = useRef<{ list: number; count: number }>({ list: 0, count: 0 })
  const [connected, setConnected] = useState(false)
  const [reconnecting, setReconnecting] = useState(false)

  // Keep callback ref up-to-date without triggering reconnect
  useEffect(() => {
    callbackRef.current = onNewNotification
  }, [onNewNotification])

  useEffect(() => {
    const token = localStorage.getItem('prionex_token')
    if (!token) return

    const socket = io(WS_URL + '/notifications', {
      path: '/ws/notifications/socket.io',
      transports: ['websocket'],
      // Send the JWT in the handshake ``auth`` payload, NOT ``query``: a token
      // in the query string lands in the WS upgrade URL and leaks into the
      // browser console on a failed handshake (401/502) and into proxy/access
      // logs. socket.io carries ``auth`` in the CONNECT packet, off the URL.
      // Backend reads ``auth`` first with a transitional query fallback.
      auth: { token },
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: MAX_RECONNECT_ATTEMPTS,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 30000,
    })

    // Throttled invalidation — at most one refetch every
    // INVALIDATE_MIN_INTERVAL_MS per (target) query bucket.
    const throttledInvalidate = (target: 'list' | 'count') => {
      const now = Date.now()
      if (now - lastInvalidateAtRef.current[target] < INVALIDATE_MIN_INTERVAL_MS) return
      lastInvalidateAtRef.current[target] = now
      if (target === 'count') {
        queryClient.invalidateQueries({ queryKey: ['notifications', 'unread-count'] })
      } else {
        // Refetch BOTH list + count when a new notification arrives.
        queryClient.invalidateQueries({ queryKey: ['notifications'] })
        lastInvalidateAtRef.current.count = now
      }
    }

    socket.on('connect', () => {
      setConnected(true)
      setReconnecting(false)
    })

    socket.on('disconnect', () => {
      setConnected(false)
    })

    socket.io.on('reconnect_attempt', () => {
      setReconnecting(true)
    })

    socket.io.on('reconnect_failed', () => {
      setReconnecting(false)
    })

    socket.on('notification.new', (notification: NotificationItem) => {
      throttledInvalidate('list')
      callbackRef.current?.(notification)
    })

    socket.on('notification.count', () => {
      throttledInvalidate('count')
    })

    socketRef.current = socket

    return () => {
      socket.off('notification.new')
      socket.off('notification.count')
      socket.disconnect()
      socketRef.current = null
    }
  }, [queryClient])

  return { connected, reconnecting }
}
