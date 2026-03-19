import { useEffect, useRef, useState, useCallback } from 'react'
import { io, Socket } from 'socket.io-client'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import type { CallStateEvent, ConnectionStatus } from '../types'

const WS_URL = import.meta.env.VITE_WS_URL || 'http://localhost:8005'
const MAX_RECONNECT_ATTEMPTS = 10

export function useCallWebSocket(agentExtension: string | null) {
  const queryClient = useQueryClient()
  const socketRef = useRef<Socket | null>(null)
  const reconnectAttempts = useRef(0)
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>({
    connected: false,
    reconnecting: false,
    failedAttempts: 0,
    usingPollingFallback: false,
  })

  const enablePollingFallback = useCallback(() => {
    setConnectionStatus((prev) => ({
      ...prev,
      usingPollingFallback: true,
      reconnecting: false,
    }))
    toast.warning('Using fallback mode for call updates')
  }, [])

  const disablePollingFallback = useCallback(() => {
    setConnectionStatus((prev) => ({
      ...prev,
      usingPollingFallback: false,
    }))
  }, [])

  useEffect(() => {
    if (!agentExtension) {
      // Clean up socket if agent extension is removed
      if (socketRef.current) {
        socketRef.current.disconnect()
        socketRef.current = null
      }
      return
    }

    // Connect to WebSocket
    const socket: Socket = io(WS_URL, {
      transports: ['websocket'],
      query: { agent_extension: agentExtension },
    })

    socketRef.current = socket

    // Connection established
    socket.on('connect', () => {
      reconnectAttempts.current = 0
      setConnectionStatus({
        connected: true,
        reconnecting: false,
        failedAttempts: 0,
        usingPollingFallback: false,
      })

      // Join room for this agent's calls
      socket.emit('join', { agent_extension: agentExtension })

      // Show success notification if reconnected after failure
      if (connectionStatus.reconnecting || connectionStatus.usingPollingFallback) {
        toast.success('Connected to call service')
        disablePollingFallback()
      }
    })

    // Listen for call state updates
    socket.on('call.state.changed', (event: CallStateEvent) => {
      // Invalidate call details query to trigger refetch
      queryClient.invalidateQueries({
        queryKey: ['callDetails', event.call_id],
      })

      // Update call/SMS history on client detail page
      queryClient.invalidateQueries({
        queryKey: ['clients', 'detail'],
        exact: false,
      })
    })

    // Handle disconnection
    socket.on('disconnect', () => {
      setConnectionStatus((prev) => ({
        ...prev,
        connected: false,
      }))
    })

    // Handle reconnection attempts
    socket.io.on('reconnect_attempt', (attemptNumber: number) => {
      reconnectAttempts.current = attemptNumber
      setConnectionStatus((prev) => ({
        ...prev,
        reconnecting: true,
        failedAttempts: attemptNumber,
      }))

      // Show reconnecting notification after 3 failed attempts
      if (attemptNumber === 3) {
        toast.info('Reconnecting to call service...')
      }

      // If max attempts reached, switch to polling fallback
      if (attemptNumber > MAX_RECONNECT_ATTEMPTS) {
        enablePollingFallback()
        socket.disconnect()
      }
    })

    // Successful reconnection
    socket.io.on('reconnect', () => {
      reconnectAttempts.current = 0
      disablePollingFallback()
      toast.success('Connected to call service')
    })

    // Reconnection error
    socket.io.on('reconnect_error', (error: Error) => {
      console.error('Reconnection error:', error)
    })

    // Reconnection failed
    socket.io.on('reconnect_failed', () => {
      console.error('Reconnection failed after max attempts')
      enablePollingFallback()
    })

    // Cleanup on unmount
    return () => {
      socket.disconnect()
      socketRef.current = null
    }
  }, [
    agentExtension,
    queryClient,
    connectionStatus.reconnecting,
    connectionStatus.usingPollingFallback,
    disablePollingFallback,
    enablePollingFallback,
  ])

  return connectionStatus
}
