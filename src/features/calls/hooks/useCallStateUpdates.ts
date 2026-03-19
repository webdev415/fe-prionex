import { useEffect, useRef } from 'react'
import { io, Socket } from 'socket.io-client'
import { useQueryClient } from '@tanstack/react-query'

const WS_URL = import.meta.env.VITE_WS_URL || 'http://localhost:8005'

interface CallStateChangedEventData {
  call_id: string
  state: string
  customer_number: string
  total_duration?: number
  hangup_cause?: number
}

interface CallStateChangedEvent {
  event_type: string
  timestamp: string
  data: CallStateChangedEventData
}

/**
 * Hook to listen for real-time call state updates via Socket.IO
 * and invalidate the query cache to trigger re-fetching of call details
 */
export function useCallStateUpdates(agentExtension: string | null, callId: string | null) {
  const socketRef = useRef<Socket | null>(null)
  const queryClient = useQueryClient()

  useEffect(() => {
    if (!agentExtension || !callId) {
      // Clean up socket if required parameters are missing
      if (socketRef.current) {
        socketRef.current.off('call.state_changed')
        socketRef.current = null
      }
      return
    }

    // Connect to WebSocket (reuse existing connection if available)
    if (!socketRef.current) {
      const socket: Socket = io(WS_URL, {
        transports: ['websocket'],
        query: { agent_extension: agentExtension },
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
    const handleCallStateChanged = (event: CallStateChangedEvent) => {
      // Extract data from the event (backend wraps payload in 'data' field)
      const eventData = event.data

      // Only handle events for the current call
      if (eventData?.call_id === callId) {
        // Invalidate the call details query to trigger immediate re-fetch
        queryClient.invalidateQueries({ queryKey: ['callDetails', callId] })

        // Also invalidate call/SMS history on client detail page
        queryClient.invalidateQueries({
          queryKey: ['clients', 'detail'],
          exact: false,
        })
      }
    }

    socket.on('call.state_changed', handleCallStateChanged)

    // Cleanup on unmount or when parameters change
    return () => {
      socket.off('call.state_changed', handleCallStateChanged)
    }
  }, [agentExtension, callId, queryClient])
}
