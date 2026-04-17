import { useEffect, useRef, useState } from 'react'
import { io, Socket } from 'socket.io-client'
import { useQueryClient } from '@tanstack/react-query'

import type { NotificationItem } from '../types'

const WS_URL =
  import.meta.env.VITE_WS_URL !== undefined ? import.meta.env.VITE_WS_URL : 'http://localhost:8005'

const MAX_RECONNECT_ATTEMPTS = 10

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
      query: { token },
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: MAX_RECONNECT_ATTEMPTS,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 30000,
    })

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
      queryClient.invalidateQueries({ queryKey: ['notifications'] })
      callbackRef.current?.(notification)
    })

    socket.on('notification.count', () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] })
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
