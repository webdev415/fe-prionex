import { useState } from 'react'
import { useOriginateCall } from './useCall'
import { useCallWebSocket } from './useCallWebSocket'
import { useAuth } from '@/features/auth/hooks/useAuth'
import { useCallStore } from '@/stores/callStore'
import type { CallType } from '@/pages/ClientManagement/components/CallDialogModal'

export function useCallOrigination() {
  const { user } = useAuth()
  const { mutate: originateCall, isPending: isOriginatingCall } = useOriginateCall()
  const { setOpenCallModal } = useCallStore()
  const [isCallModalOpen, setIsCallModalOpen] = useState(false)
  const [currentCallId, setCurrentCallId] = useState<string | null>(null)
  const [callError, setCallError] = useState<string | null>(null)
  const [activeCallType, setActiveCallType] = useState<CallType>('white-line')

  // WebSocket for real-time call updates
  useCallWebSocket(user?.asterisk_extension || null)

  const handleClearCallError = () => setCallError(null)

  const handleOriginateCall = (
    phoneNumber: string,
    clientName: string,
    clientId: string,
    callType: CallType
  ) => {
    if (!user?.asterisk_extension) {
      setCallError('Your account is not configured for calling. Please contact administrator.')
      return
    }
    setCallError(null)
    setActiveCallType(callType)

    const context = callType === 'gray-line' ? 'outbound-gray' : 'outbound-white'

    originateCall(
      {
        agent_extension: user.asterisk_extension,
        customer_number: phoneNumber,
        caller_id_name: 'CRM Call',
        client_id: Number(clientId) || undefined,
        campaign_id: user.active_project_id ?? undefined,
        metadata: { client_name: clientName },
        context,
      },
      {
        onSuccess: (data) => setCurrentCallId(data.call_id),
        onError: (err: unknown) => {
          let message: string | undefined
          if (err && typeof err === 'object' && 'response' in err) {
            const response = (
              err as { response?: { data?: { message?: string; detail?: unknown } } }
            ).response
            const data = response?.data
            if (data?.message) {
              message = data.message
            } else if (data?.detail) {
              if (typeof data.detail === 'string') {
                message = data.detail
              } else if (typeof data.detail === 'object' && data.detail !== null) {
                message = (data.detail as { message?: string }).message
              }
            }
          }
          setCallError(message || 'Failed to initiate call. Please try again.')
        },
      }
    )
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
    handleOriginateCall,
    handleClearCallError,
    handleCloseCallModal,
    handleCallEnd,
  }
}
