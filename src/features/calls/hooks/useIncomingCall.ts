import { useEffect, useRef, useState, useCallback } from 'react'
import { io, Socket } from 'socket.io-client'
import type { IncomingCallData, IncomingCallEvent } from '../types'

const WS_URL = import.meta.env.VITE_WS_URL || 'http://localhost:8005'

export function useIncomingCall(agentExtension: string | null) {
  const socketRef = useRef<Socket | null>(null)
  const [incomingCall, setIncomingCall] = useState<IncomingCallData | null>(null)

  const dismissIncomingCall = useCallback(() => {
    setIncomingCall(null)
  }, [])

  useEffect(() => {
    if (!agentExtension) {
      // Clean up socket if agent extension is removed
      if (socketRef.current) {
        socketRef.current.off('call.incoming')
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
    }

    const socket = socketRef.current

    // Listen for incoming call events
    const handleIncomingCall = (event: IncomingCallEvent) => {
      setIncomingCall(event.data)
    }

    // Listen for call state changes to dismiss popup when call ends/rejected
    const handleCallStateChanged = (event: { data?: { call_id?: string; state?: string } }) => {
      const state = event.data?.state?.toUpperCase()
      // Dismiss popup when call is completed, failed, or cancelled
      if (state === 'COMPLETED' || state === 'FAILED' || state === 'CANCELLED') {
        setIncomingCall(null)
      }
    }

    socket.on('call.incoming', handleIncomingCall)
    socket.on('call.state_changed', handleCallStateChanged)

    // Cleanup on unmount or when agent extension changes
    return () => {
      socket.off('call.incoming', handleIncomingCall)
      socket.off('call.state_changed', handleCallStateChanged)
    }
  }, [agentExtension])

  return {
    incomingCall,
    hasIncomingCall: incomingCall !== null,
    dismissIncomingCall,
  }
}
