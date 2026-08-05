import { useEffect, useRef, useState, useCallback } from 'react'
import { io, Socket } from 'socket.io-client'
import { getAccessToken } from '@/lib/api'
import { CALL_STATE_CHANGED_EVENT } from '../types'
import type { CallStateEvent, IncomingCallData, IncomingCallEvent } from '../types'

const WS_URL =
  import.meta.env.VITE_WS_URL !== undefined ? import.meta.env.VITE_WS_URL : 'http://localhost:8005'

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
    }

    const socket = socketRef.current

    // Listen for incoming call events
    const handleIncomingCall = (event: IncomingCallEvent) => {
      setIncomingCall(event.data)
    }

    // Listen for call state changes to dismiss popup when call ends/rejected
    const handleCallStateChanged = (event: CallStateEvent) => {
      const state = event.data?.state?.toUpperCase()
      // Dismiss popup when call is completed, failed, or cancelled
      if (state === 'COMPLETED' || state === 'FAILED' || state === 'CANCELLED') {
        setIncomingCall(null)
        return
      }

      // A queue rings several operators at once. Once one of them answers, the
      // others are looking at a call they can no longer take — close it for
      // them, but leave it open for whoever actually took it.
      if (state === 'ACTIVE') {
        const answeredBy = event.data?.agent_extension
        const someoneElseAnswered = typeof answeredBy === 'string' && answeredBy !== agentExtension
        if (someoneElseAnswered) {
          setIncomingCall(null)
        }
      }
    }

    socket.on('call.incoming', handleIncomingCall)
    socket.on(CALL_STATE_CHANGED_EVENT, handleCallStateChanged)

    // Cleanup on unmount or when agent extension changes — disconnect so an
    // authenticated socket does not keep receiving call PII after the consumer
    // unmounts or the agent changes.
    return () => {
      socket.off('call.incoming', handleIncomingCall)
      socket.off(CALL_STATE_CHANGED_EVENT, handleCallStateChanged)
      socket.disconnect()
      socketRef.current = null
    }
  }, [agentExtension])

  return {
    incomingCall,
    hasIncomingCall: incomingCall !== null,
    dismissIncomingCall,
  }
}
