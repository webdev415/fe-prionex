import { useEffect, useRef } from 'react'
import { io, Socket } from 'socket.io-client'
import { useQueryClient } from '@tanstack/react-query'
import { getAccessToken } from '@/lib/api'
import { CALL_STATE_CHANGED_EVENT } from '../types'
import type { CallStateEvent } from '../types'
import {
  getClientIdFromCallEventData,
  invalidateCallRelatedQueries,
} from '../utils/queryInvalidation'

const WS_URL =
  import.meta.env.VITE_WS_URL !== undefined ? import.meta.env.VITE_WS_URL : 'http://localhost:8005'

/**
 * Hook to listen for real-time call state updates via Socket.IO
 * and invalidate the query cache to trigger re-fetching of call details
 */
export function useCallStateUpdates(
  agentExtension: string | null,
  callId: string | null,
  clientId?: number | null
) {
  const socketRef = useRef<Socket | null>(null)
  const queryClient = useQueryClient()

  useEffect(() => {
    if (!agentExtension || !callId) {
      // Clean up socket if required parameters are missing
      if (socketRef.current) {
        socketRef.current.disconnect()
        socketRef.current = null
      }
      return
    }

    // Connect to WebSocket (reuse existing connection if available)
    if (!socketRef.current) {
      // The call-service Socket.IO handshake requires a JWT; without one the
      // server refuses the connection. Pass it via the auth payload (not the
      // query string) to keep the token out of URLs/access logs.
      const token = getAccessToken()
      if (!token) return

      const socket: Socket = io(WS_URL, {
        transports: ['websocket'],
        query: { agent_extension: agentExtension },
        auth: { token },
      })

      socketRef.current = socket

      // Join room for this agent's calls
      socket.on('connect', () => {
        socket.emit('join', { agent_extension: agentExtension })
      })

      socket.on('disconnect', () => {
        // no-op
      })
    }

    const socket = socketRef.current

    // Listen for call state change events
    const handleCallStateChanged = (event: CallStateEvent) => {
      // Extract data from the event (backend wraps payload in 'data' field)
      const eventData = event.data

      // Only handle events for the current call
      if (eventData?.call_id === callId) {
        // Invalidate the call details query to trigger immediate re-fetch
        queryClient.invalidateQueries({ queryKey: ['callDetails', callId] })

        invalidateCallRelatedQueries(
          queryClient,
          clientId ?? getClientIdFromCallEventData(eventData)
        )
      }
    }

    socket.on(CALL_STATE_CHANGED_EVENT, handleCallStateChanged)

    // Cleanup on unmount or when parameters change — disconnect so an
    // authenticated socket does not keep receiving call events after the
    // consumer unmounts or its parameters change.
    return () => {
      socket.off(CALL_STATE_CHANGED_EVENT, handleCallStateChanged)
      socket.disconnect()
      socketRef.current = null
    }
  }, [agentExtension, callId, clientId, queryClient])
}
