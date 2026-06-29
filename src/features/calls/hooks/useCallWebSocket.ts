import { useEffect, useRef, useState, useCallback } from 'react'
import { io, Socket } from 'socket.io-client'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { getAccessToken } from '@/lib/api'
import type { CallStateEvent, ConnectionStatus } from '../types'
import {
  getClientIdFromCallEventData,
  invalidateCallRelatedQueries,
} from '../utils/queryInvalidation'

const WS_URL =
  import.meta.env.VITE_WS_URL !== undefined ? import.meta.env.VITE_WS_URL : 'http://localhost:8005'
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
    serviceUnavailable: false,
  })

  // Mirror the latest status into a ref so the socket effect can read it
  // (inside the 'connect' handler) WITHOUT listing status fields in its deps.
  // Previously `connectionStatus.reconnecting` / `usingPollingFallback` were in
  // the effect deps, so every reconnect attempt changed them, re-ran the effect,
  // and tore down + recreated the socket — a self-sustaining reconnect loop.
  const statusRef = useRef(connectionStatus)
  useEffect(() => {
    statusRef.current = connectionStatus
  }, [connectionStatus])

  const enablePollingFallback = useCallback(() => {
    setConnectionStatus((prev) => ({
      ...prev,
      usingPollingFallback: true,
      reconnecting: false,
      serviceUnavailable: true,
    }))
    toast.warning('Using fallback mode for call updates')
  }, [])

  const disablePollingFallback = useCallback(() => {
    setConnectionStatus((prev) => ({
      ...prev,
      usingPollingFallback: false,
      serviceUnavailable: false,
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

    // The call-service Socket.IO handshake requires a JWT; without one the
    // server refuses the connection. Pass it via the auth payload (not the
    // query string) to keep the token out of URLs/access logs.
    const token = getAccessToken()
    if (!token) return

    // Connect to WebSocket
    const socket: Socket = io(WS_URL, {
      transports: ['websocket'],
      query: { agent_extension: agentExtension },
      auth: { token },
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
        serviceUnavailable: false,
      })

      // Join room for this agent's calls
      socket.emit('join', { agent_extension: agentExtension })

      // Show success notification if reconnected after failure
      if (statusRef.current.reconnecting || statusRef.current.usingPollingFallback) {
        toast.success('Connected to call service')
        disablePollingFallback()
      }
    })

    // Listen for call state updates.
    // NOTE: the call-service socket.io server emits "call.state_changed"
    // (underscore) — see services/call/app/services/event_listener.py.
    // Listening on the dotted "call.state.changed" silently dropped every
    // call-completion event, so the call modal/minimized bubble never cleared
    // and isCallActive() stayed true — blocking the next call until reload.
    socket.on('call.state_changed', (event: CallStateEvent) => {
      // Invalidate call details query to trigger refetch
      queryClient.invalidateQueries({
        queryKey: ['callDetails', event.call_id],
      })

      invalidateCallRelatedQueries(queryClient, getClientIdFromCallEventData(event.data))
    })

    // Handle disconnection
    socket.on('disconnect', () => {
      setConnectionStatus((prev) => ({
        ...prev,
        connected: false,
        serviceUnavailable: true,
      }))
    })

    // Handle reconnection attempts
    socket.io.on('reconnect_attempt', (attemptNumber: number) => {
      reconnectAttempts.current = attemptNumber
      setConnectionStatus((prev) => ({
        ...prev,
        reconnecting: true,
        failedAttempts: attemptNumber,
        serviceUnavailable: true,
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
      setConnectionStatus((prev) => ({
        ...prev,
        connected: true,
        reconnecting: false,
        serviceUnavailable: false,
      }))
      toast.success('Connected to call service')
    })

    // Reconnection error
    socket.io.on('reconnect_error', (error: Error) => {
      console.error('Reconnection error:', error)
      setConnectionStatus((prev) => ({
        ...prev,
        connected: false,
        serviceUnavailable: true,
      }))
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
  }, [agentExtension, queryClient, disablePollingFallback, enablePollingFallback])

  return connectionStatus
}
