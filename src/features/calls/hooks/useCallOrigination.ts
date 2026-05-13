import { useEffect, useRef, useState } from 'react'
import { useOriginateCall } from './useCall'
import { useCallWebSocket } from './useCallWebSocket'
import { useAuth } from '@/features/auth/hooks/useAuth'
import { useCallStore } from '@/stores/callStore'
import type { CallType } from '@/pages/ClientManagement/components/CallDialogModal'

export function useCallOrigination() {
  const CALL_ERROR_COOLDOWN_MS = 3000
  const { user } = useAuth()
  const { mutate: originateCall, isPending: isOriginatingCall } = useOriginateCall()
  const { setOpenCallModal } = useCallStore()
  const [isCallModalOpen, setIsCallModalOpen] = useState(false)
  const [currentCallId, setCurrentCallId] = useState<string | null>(null)
  const [callError, setCallError] = useState<string | null>(null)
  const [activeCallType, setActiveCallType] = useState<CallType>('white-line')
  const [isCallCooldown, setIsCallCooldown] = useState(false)
  const [cooldownSecondsRemaining, setCooldownSecondsRemaining] = useState(0)
  const cooldownIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const cooldownTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // WebSocket for real-time call updates
  const connectionStatus = useCallWebSocket(user?.asterisk_extension || null)
  const isTelephonyUnavailable = connectionStatus.serviceUnavailable

  useEffect(() => {
    return () => {
      if (cooldownIntervalRef.current) {
        clearInterval(cooldownIntervalRef.current)
      }
      if (cooldownTimeoutRef.current) {
        clearTimeout(cooldownTimeoutRef.current)
      }
    }
  }, [])

  const handleClearCallError = () => setCallError(null)

  const startCallErrorCooldown = () => {
    if (cooldownIntervalRef.current) {
      clearInterval(cooldownIntervalRef.current)
    }
    if (cooldownTimeoutRef.current) {
      clearTimeout(cooldownTimeoutRef.current)
    }

    setIsCallCooldown(true)
    setCooldownSecondsRemaining(3)

    const cooldownStartedAt = Date.now()
    cooldownIntervalRef.current = setInterval(() => {
      const elapsed = Date.now() - cooldownStartedAt
      const remainingMs = Math.max(0, CALL_ERROR_COOLDOWN_MS - elapsed)
      const nextSeconds = Math.ceil(remainingMs / 1000)
      setCooldownSecondsRemaining(nextSeconds)
    }, 250)

    cooldownTimeoutRef.current = setTimeout(() => {
      setIsCallCooldown(false)
      setCooldownSecondsRemaining(0)
      if (cooldownIntervalRef.current) {
        clearInterval(cooldownIntervalRef.current)
        cooldownIntervalRef.current = null
      }
      cooldownTimeoutRef.current = null
    }, CALL_ERROR_COOLDOWN_MS)
  }

  const getOriginateErrorMessage = (err: unknown): string => {
    if (!err || typeof err !== 'object') {
      return 'Failed to initiate call. Please try again.'
    }

    const errorObject = err as {
      message?: string
      code?: string
      response?: { status?: number; data?: { message?: string; detail?: unknown } }
      request?: unknown
    }
    const status = errorObject.response?.status
    const backendMessage = errorObject.response?.data?.message
    const detail = errorObject.response?.data?.detail
    const normalizedMessage = (errorObject.message || '').toLowerCase()

    if (status === 404) return 'Call failed: no route'
    if (status === 429) return 'Too many attempts'
    if (status && status >= 500) return 'Call service unavailable'
    if (errorObject.code === 'ECONNABORTED' || normalizedMessage.includes('timeout')) {
      return 'Call service unavailable'
    }
    if (!status && errorObject.request) {
      return 'Call service unavailable'
    }

    if (typeof backendMessage === 'string' && backendMessage.trim().length > 0) {
      return backendMessage
    }
    if (typeof detail === 'string' && detail.trim().length > 0) {
      return detail
    }
    if (detail && typeof detail === 'object' && 'message' in detail) {
      const nestedMessage = (detail as { message?: unknown }).message
      if (typeof nestedMessage === 'string' && nestedMessage.trim().length > 0) {
        return nestedMessage
      }
    }

    return 'Failed to initiate call. Please try again.'
  }

  const handleOriginateCall = (
    phoneNumber: string,
    clientName: string,
    clientId: string,
    callType: CallType
  ): Promise<string | null> => {
    if (isCallCooldown) {
      return Promise.resolve(null)
    }

    if (!user?.asterisk_extension) {
      setCallError('Your account is not configured for calling. Please contact administrator.')
      startCallErrorCooldown()
      return Promise.resolve(null)
    }
    setCallError(null)
    setActiveCallType(callType)

    const context = callType === 'gray-line' ? 'outbound-gray' : 'outbound-white'

    return new Promise<string | null>((resolve) => {
      originateCall(
        {
          agent_extension: user.asterisk_extension!,
          customer_number: phoneNumber,
          caller_id_name: 'CRM Call',
          client_id: Number(clientId) || undefined,
          campaign_id: user.active_project_id ?? undefined,
          metadata: { client_name: clientName },
          context,
        },
        {
          onSuccess: (data) => {
            setCurrentCallId(data.call_id)
            resolve(data.call_id)
          },
          onError: (err: unknown) => {
            setCallError(getOriginateErrorMessage(err))
            startCallErrorCooldown()
            resolve(null)
          },
        }
      )
    })
  }

  const handleCloseCallModal = () => {
    setOpenCallModal(null)
    setIsCallModalOpen(false)
    setCurrentCallId(null)
    setActiveCallType('white-line')
    handleClearCallError()
  }

  const handleCallEnd = () => {
    setOpenCallModal(null)
    setCurrentCallId(null)
    setActiveCallType('white-line')
  }

  return {
    user,
    isCallModalOpen,
    setIsCallModalOpen,
    currentCallId,
    activeCallType,
    callError,
    isOriginatingCall,
    isCallCooldown,
    cooldownSecondsRemaining,
    isTelephonyUnavailable,
    handleOriginateCall,
    handleClearCallError,
    handleCloseCallModal,
    handleCallEnd,
  }
}
