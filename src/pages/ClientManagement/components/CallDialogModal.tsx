/**
 * Call Dialog Modal Component
 *
 * Reusable modal for handling call dialogs with multiple states:
 * - Initial: Call type selection
 * - Dialing: Call in progress
 * - Connected: Active call
 * - Ended: Call completed
 * - Incoming: Incoming call popup
 */

import { useState, useEffect, useRef, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Modal, ModalHeader, ModalContent, ModalFooter } from '../../../components/ui/Modal'
import { Button } from '../../../components/ui/Button'
import { Checkbox } from '@/components/ui/Checkbox'
import { RadioGroup, RadioItem } from '../../../components/ui/Radio'
import { Icons } from '@/lib/icons'
import { cn } from '@/lib/utils'
import { useCallStore } from '@/stores/callStore'
import { useCallDetails, useHangupCall } from '@/features/calls/hooks/useCall'
import { useCallStateUpdates } from '@/features/calls/hooks/useCallStateUpdates'
import { useAuth } from '@/features/auth/hooks/useAuth'
import { formatMoneyUAHTwoDecimals } from '@/lib/formatters'

export type CallState = 'initial' | 'dialing' | 'connected' | 'ended' | 'failed' | 'incoming'
export type CallType = 'white-line' | 'gray-line' | 'spam-calls'
export type CallStatus = 'answered' | 'missed' | 'rejected'

export interface CallDialogModalProps {
  open: boolean
  onClose: () => void
  clientName: string
  phoneNumber: string
  initialCallType?: CallType
  callId?: string | null // Optional call ID for tracking real-time call state
  initialState?: CallState
  initialElapsedTime?: number // Initial elapsed time in seconds (used when restoring from minimized)
  minimizedAt?: number // Timestamp (ms) when call was minimized — used to compute extra elapsed time
  initialManualPhoneEnabled?: boolean // Restored manual-phone toggle when re-opening from minimized
  initialManualPhoneDigits?: string // Restored manually-typed digits when re-opening from minimized
  error?: string | null // Error message to display when call fails
  isLoading?: boolean // Loading state for call initiation
  isCallCooldown?: boolean
  cooldownSecondsRemaining?: number
  telephonyUnavailable?: boolean
  onCallStart?: (callType: CallType, dialPhoneNumber: string) => void
  onCallEnd?: (duration: number, status: CallStatus) => void
  onAnswer?: () => void
  onReject?: () => void
  onMinimize?: () => void
  onRetry?: () => void // Callback to retry failed call
  onSpamCall?: (phone: string) => void // Callback to add phone to spam call history
  // For incoming call
  loans?: Array<{
    id: string
    clientName: string
    loanNumber: string
    counterparty: string
    loanPrincipal: number
    debt: number
    status: string
    saleDate: string
    lastContact: string
    priority: 'Critical' | 'High' | 'Medium' | 'Low'
    score: number
  }>
}

const formatTime = (seconds: number): string => {
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
}

/** Manual entry: only digits, length 12, prefix 380 (Ukraine). */
function isValidManualDialPhone(digits: string): boolean {
  return digits.length === 12 && /^\d{12}$/.test(digits) && digits.startsWith('380')
}

export function CallDialogModal({
  open,
  onClose,
  clientName,
  phoneNumber,
  initialCallType = 'white-line',
  callId,
  initialState = 'initial',
  initialElapsedTime = 0,
  minimizedAt,
  initialManualPhoneEnabled = false,
  initialManualPhoneDigits = '',
  error,
  isLoading,
  isCallCooldown = false,
  cooldownSecondsRemaining = 0,
  telephonyUnavailable = false,
  onCallStart,
  onCallEnd,
  onAnswer,
  onReject,
  onMinimize,
  onRetry,
  onSpamCall,
  loans = [],
}: CallDialogModalProps) {
  const { t } = useTranslation('common')
  const { setMinimizedCall, setOpenCallModal, minimizedCall } = useCallStore()
  const { user: authUser } = useAuth()

  // Fetch call details with polling if callId is provided
  const { data: callDetails } = useCallDetails(callId || null)

  // Listen for real-time call state updates via Socket.IO
  const agentExtension = authUser?.asterisk_extension || null
  useCallStateUpdates(agentExtension, callId || null)

  // Hangup mutation
  const hangupMutation = useHangupCall()
  const callDetailsState = callDetails?.state

  // Track modal open state
  useEffect(() => {
    if (open) {
      setOpenCallModal('call-dialog')
    } else {
      // Only clear openCallModal if there's no minimized call
      // This prevents clearing the state when minimizing
      if (!minimizedCall || minimizedCall.type !== 'call-dialog') {
        setOpenCallModal(null)
      }
    }
  }, [open, setOpenCallModal, minimizedCall])
  const [callState, setCallState] = useState<CallState>(initialState)
  const [callType, setCallType] = useState<CallType>('white-line')
  // Lazy initializer: runs once on mount. minimizedAt lets us resume the timer
  // from where it left off when restoring a minimized call.
  const [elapsedTime, setElapsedTime] = useState(() => {
    if (minimizedAt) {
      return initialElapsedTime + Math.floor((Date.now() - minimizedAt) / 1000)
    }
    return initialElapsedTime
  })
  const [isMuted, setIsMuted] = useState(false)
  const [isOnHold, setIsOnHold] = useState(false)
  const [autoCloseCountdown, setAutoCloseCountdown] = useState(3)
  const [manualPhoneEnabled, setManualPhoneEnabled] = useState(initialManualPhoneEnabled)
  const [manualPhoneDigits, setManualPhoneDigits] = useState(initialManualPhoneDigits)
  /** Number shown during / after outbound call (includes manual entry). */
  const [dialDisplayPhone, setDialDisplayPhone] = useState<string | null>(null)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const dialingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  /** Parents often pass inline `onClose` handlers; keep latest in a ref so auto-close timers are stable. */
  const onCloseRef = useRef(onClose)
  useEffect(() => {
    onCloseRef.current = onClose
  }, [onClose])

  // Reset state when modal opens/closes
  useEffect(() => {
    if (open) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setCallState(initialState)
      // Account for time passed while minimized
      const correctedTime = minimizedAt
        ? (initialElapsedTime ?? 0) + Math.floor((Date.now() - minimizedAt) / 1000)
        : (initialElapsedTime ?? 0)
      setElapsedTime(correctedTime)
      setCallType(initialCallType)
      setIsMuted(false)
      setIsOnHold(false)
      setAutoCloseCountdown(3)
      setManualPhoneEnabled(initialManualPhoneEnabled)
      setManualPhoneDigits(initialManualPhoneDigits)
      setDialDisplayPhone(null)
    } else {
      // Cleanup intervals
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
      if (countdownRef.current) {
        clearInterval(countdownRef.current)
        countdownRef.current = null
      }
      if (dialingTimeoutRef.current) {
        clearTimeout(dialingTimeoutRef.current)
        dialingTimeoutRef.current = null
      }
    }
  }, [
    open,
    initialState,
    initialElapsedTime,
    initialCallType,
    minimizedAt,
    initialManualPhoneEnabled,
    initialManualPhoneDigits,
  ])

  const callLineLabel = useMemo(() => {
    if (callType === 'gray-line') {
      return t('pages.clients.modals.callDialog.grayLine')
    }
    return t('pages.clients.modals.callDialog.whiteLine')
  }, [callType, t])

  // Prefer the number already dialed; else what the user has typed in manual
  // mode (if any); else the client's default. Used by the minimize snapshot
  // and the active-call layout.
  const displayPhone =
    dialDisplayPhone ?? (manualPhoneEnabled && manualPhoneDigits ? manualPhoneDigits : phoneNumber)

  const canPlaceCall = !manualPhoneEnabled
    ? String(phoneNumber).trim().length > 0
    : isValidManualDialPhone(manualPhoneDigits)

  const handleManualPhoneChange = (raw: string) => {
    setManualPhoneDigits(raw.replace(/\D/g, '').slice(0, 12))
  }

  // Derive call state and elapsed time from backend state
  const derivedState = useMemo(() => {
    // If there's an error prop, show failed state
    if (error) {
      return { state: 'failed' as CallState, time: 0 }
    }

    if (!callDetails || !open) {
      return { state: callState, time: elapsedTime }
    }

    // Map backend state to frontend state
    // Backend returns UPPERCASE values: INITIATED, RINGING, ACTIVE, COMPLETED, FAILED
    switch (callDetails.state) {
      case 'INITIATED':
      case 'RINGING':
        // During dialing, keep using local timer (ring_duration may not update in real-time)
        return { state: 'dialing' as CallState, time: -1 } // -1 means "use local timer"
      case 'ACTIVE':
        // During active call, keep using local timer (talk_duration is only set when call ends)
        return { state: 'connected' as CallState, time: -1 } // -1 means "use local timer"
      case 'COMPLETED':
        return { state: 'ended' as CallState, time: callDetails.total_duration || 0 }
      case 'FAILED':
        return { state: 'failed' as CallState, time: 0 }
      default:
        return { state: callState, time: elapsedTime }
    }
  }, [callDetails, open, callState, elapsedTime, error])

  // Sync derived state to local state
  // This is intentional state synchronization with external system (backend call state)
  useEffect(() => {
    if (derivedState.state !== callState) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setCallState(derivedState.state)
    }
    // Only sync time if backend provides a valid duration (not -1)
    // During ACTIVE state, we use local timer instead of backend value
    if (derivedState.time >= 0 && derivedState.time !== elapsedTime) {
      setElapsedTime(derivedState.time)
    }
  }, [derivedState, callState, elapsedTime])

  // Direct backend state detection: if the backend says COMPLETED/FAILED,
  // force transition regardless of local state (handles Zoiper/remote hangup)
  useEffect(() => {
    if (!callDetails || !open) return
    if (
      (callDetails.state === 'COMPLETED' || callDetails.state === 'FAILED') &&
      callState !== 'ended' &&
      callState !== 'failed'
    ) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setCallState(callDetails.state === 'COMPLETED' ? 'ended' : 'failed')
      setElapsedTime(callDetails.total_duration || 0)
    }
  }, [callDetails]) // eslint-disable-line react-hooks/exhaustive-deps

  const { reset: resetHangupMutation } = hangupMutation
  useEffect(() => {
    if (callDetailsState === 'COMPLETED' || callDetailsState === 'FAILED') {
      resetHangupMutation()
    }
  }, [callDetailsState, resetHangupMutation])

  // Timer for dialing and connected states
  useEffect(() => {
    if ((callState === 'dialing' || callState === 'connected') && open) {
      intervalRef.current = setInterval(() => {
        setElapsedTime((prev) => prev + 1)
      }, 1000)
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
    }
  }, [callState, open])

  // Auto-close countdown for ended state (do not depend on `onClose` identity — see onCloseRef)
  useEffect(() => {
    if (callState === 'ended' && open) {
      countdownRef.current = setInterval(() => {
        setAutoCloseCountdown((prev) => {
          if (prev <= 1) {
            if (intervalRef.current) {
              clearInterval(intervalRef.current)
              intervalRef.current = null
            }
            if (countdownRef.current) {
              clearInterval(countdownRef.current)
              countdownRef.current = null
            }
            setCallState(initialState)
            setElapsedTime(0)
            setIsMuted(false)
            setIsOnHold(false)
            setAutoCloseCountdown(3)
            onCloseRef.current()
            return 0
          }
          return prev - 1
        })
      }, 1000)
    } else {
      if (countdownRef.current) {
        clearInterval(countdownRef.current)
        countdownRef.current = null
      }
    }

    return () => {
      if (countdownRef.current) {
        clearInterval(countdownRef.current)
      }
    }
  }, [callState, open, initialState])

  const handleCallNow = () => {
    if (!canPlaceCall) return
    const dialPhone = manualPhoneEnabled ? manualPhoneDigits : String(phoneNumber).trim()
    setDialDisplayPhone(dialPhone)
    if (onCallStart) {
      onCallStart(callType, dialPhone)
    }
    setCallState('dialing')
    setElapsedTime(0)
  }

  const handleAnswer = () => {
    if (onAnswer) {
      onAnswer()
    }
    setCallState('connected')
    setElapsedTime(0)
  }

  const handleReject = () => {
    if (hangupMutation.isPending) return
    // Send hangup command to Asterisk to reject the incoming call
    if (callId) {
      hangupMutation.mutate(callId)
    }

    if (onReject) {
      onReject()
    }
    if (onCallEnd) {
      onCallEnd(0, 'rejected')
    }
    handleClose()
  }

  const handleHangUp = () => {
    if (hangupMutation.isPending) return
    const status: CallStatus = callState === 'connected' ? 'answered' : 'missed'

    // Send hangup command to Asterisk if we have a call ID
    if (callId) {
      hangupMutation.mutate(callId, {
        onSuccess: () => {
          if (onCallEnd) onCallEnd(elapsedTime, status)
          setCallState('ended')
        },
        onError: () => {
          // Hangup failed (AMI unavailable, call already ended, etc.)
          // Force end the call on the frontend regardless
          if (onCallEnd) onCallEnd(elapsedTime, status)
          setCallState('ended')
        },
      })
    } else {
      // No callId — just end locally
      if (onCallEnd) onCallEnd(elapsedTime, status)
      setCallState('ended')
    }
  }

  const handleMinimize = () => {
    setMinimizedCall({
      id: `call-dialog-${Date.now()}`,
      type: 'call-dialog',
      clientName,
      // Always store the ORIGINAL client phone here so restoring and
      // un-checking "manual phone entry" falls back to the correct number.
      phoneNumber,
      // Separate field for what the minimized-bubble tooltip should show.
      displayPhone,
      callId: callId || null,
      callState,
      callType,
      elapsedTime,
      manualPhoneEnabled,
      manualPhoneDigits,
      timestamp: Date.now(),
    })
    // If onMinimize is provided, use it instead of onClose
    // This prevents clearing the minimized state when restoring and re-minimizing
    if (onMinimize) {
      onMinimize()
    } else {
      onClose()
    }
  }

  const handleClose = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
    if (countdownRef.current) {
      clearInterval(countdownRef.current)
      countdownRef.current = null
    }
    if (dialingTimeoutRef.current) {
      clearTimeout(dialingTimeoutRef.current)
      dialingTimeoutRef.current = null
    }
    setCallState(initialState)
    setElapsedTime(0)
    setIsMuted(false)
    setIsOnHold(false)
    setAutoCloseCountdown(3)
    setManualPhoneEnabled(false)
    setManualPhoneDigits('')
    setDialDisplayPhone(null)
    onClose()
  }

  const isCallActive =
    callState === 'dialing' || callState === 'connected' || callState === 'incoming'

  // Incoming call popup (different layout)
  if (callState === 'incoming') {
    return (
      <Modal
        open={open}
        onClose={isCallActive ? handleMinimize : handleClose}
        maxWidth="xl"
        className="p-4 sm:p-6"
        showCloseButton={false}
        preventOutsideClose={isCallActive}
      >
        {/* Minimize Button */}
        <button
          onClick={handleMinimize}
          className="absolute top-2 right-2 flex h-8 w-8 items-center justify-center rounded-md transition-colors hover:bg-gray-100 sm:top-4 sm:right-12"
          aria-label="Minimize modal"
        >
          <Icons.Remove02 size={20} className="text-dark-500" strokeWidth={1.5} />
        </button>
        <div className="flex flex-col gap-4 sm:gap-6">
          {telephonyUnavailable && (
            <div
              role="alert"
              className="border-warning-300 bg-warning-50 text-warning-900 rounded-lg border px-3 py-2 text-sm font-medium"
            >
              Telephony is temporarily unavailable
            </div>
          )}

          {/* Call Info */}
          <div className="flex flex-col items-center gap-2 sm:gap-3">
            <div className="flex h-16 w-16 items-center justify-center rounded-full border-2 border-gray-300 bg-white sm:h-20 sm:w-20">
              <Icons.Headset size={32} className="text-gray-700 sm:size-10" strokeWidth={1.5} />
            </div>
            <div className="text-dark-500 text-center text-xl font-semibold sm:text-2xl">
              {phoneNumber}
            </div>
            <div className="bg-primary-300 flex items-center gap-2 rounded-full px-3 py-1 sm:px-4 sm:py-1.5">
              <div className="bg-primary-500 h-2 w-2 rounded-full" />
              <span className="text-dark-500 text-xs font-medium sm:text-sm">
                {t('pages.clients.modals.callDialog.incomingCall')}
              </span>
            </div>
          </div>

          {/* Loans Information */}
          {loans.length > 0 && (
            <div className="flex flex-col gap-3 sm:gap-4">
              {/* Primary loans */}
              {loans.filter((loan) => loan.priority === 'Critical').length > 0 && (
                <div className="flex flex-col gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="bg-error-500 rounded-full px-2 py-1 text-xs font-medium text-white sm:px-3">
                      {t('pages.clients.modals.callDialog.primary')}
                    </span>
                    <span className="text-dark-500 text-xs font-medium sm:text-sm">
                      {t('pages.clients.modals.callDialog.primaryLoans')}
                    </span>
                  </div>
                  {loans
                    .filter((loan) => loan.priority === 'Critical')
                    .map((loan) => (
                      <LoanCard key={loan.id} loan={loan} />
                    ))}
                </div>
              )}

              {/* Third-party loans */}
              {loans.filter((loan) => loan.priority !== 'Critical').length > 0 && (
                <div className="flex flex-col gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="bg-warning-500 rounded-full px-2 py-1 text-xs font-medium text-white sm:px-3">
                      {t('pages.clients.priorities.high')}
                    </span>
                    <span className="text-dark-500 text-xs font-medium sm:text-sm">
                      {t('pages.clients.modals.callDialog.thirdPartyLoans')}
                    </span>
                  </div>
                  {loans
                    .filter((loan) => loan.priority !== 'Critical')
                    .map((loan) => (
                      <LoanCard key={loan.id} loan={loan} />
                    ))}
                </div>
              )}

              <button className="text-primary-300 flex items-center justify-center gap-1 text-xs font-medium sm:text-sm">
                {t('pages.clients.modals.callDialog.viewAllLoans')}{' '}
                <Icons.ArrowDown size={14} className="sm:size-4" />
              </button>
            </div>
          )}

          {/* Call Actions */}
          <div className="flex flex-col gap-2 sm:gap-3">
            <div className="flex items-center gap-2 rounded-lg bg-gray-100 px-3 py-2 sm:px-4">
              <Icons.StopWatch size={14} className="text-gray-600 sm:size-4" />
              <span className="text-xs text-gray-600 sm:text-sm">
                {t('pages.clients.modals.callDialog.ringing')} {formatTime(elapsedTime)}
              </span>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row sm:gap-3">
              <Button
                variant="danger"
                size="sm"
                onClick={handleReject}
                className="bg-error-500 hover:bg-error-600 w-full rounded-md text-white"
              >
                <Icons.Cancel01 size={18} className="mr-2 sm:size-5" />
                {t('pages.clients.modals.callDialog.reject')}
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={handleAnswer}
                className="bg-primary-300 text-dark-500 hover:bg-primary-400 w-full rounded-md"
              >
                <Icons.HeadphoneMute size={18} className="mr-2 sm:size-5" />
                {t('pages.clients.modals.callDialog.answerCall')}
              </Button>
            </div>
          </div>
        </div>
      </Modal>
    )
  }

  // Regular call dialog states
  return (
    <Modal
      open={open}
      onClose={isCallActive ? handleMinimize : handleClose}
      maxWidth="xl"
      className="p-4 sm:p-6 md:p-10"
      showCloseButton={false}
      preventOutsideClose={isCallActive}
    >
      {/* Minimize Button */}
      <button
        onClick={handleMinimize}
        className="absolute top-2 right-2 flex h-8 w-8 items-center justify-center rounded-md transition-colors hover:bg-gray-100 sm:top-4 sm:right-12"
        aria-label="Minimize modal"
      >
        <Icons.Remove02 size={20} className="text-dark-500" strokeWidth={1.5} />
      </button>
      <div className="flex flex-col gap-4 sm:gap-6">
        {telephonyUnavailable && (
          <div
            role="alert"
            className="border-warning-300 bg-warning-50 text-warning-900 rounded-lg border px-3 py-2 text-sm font-medium"
          >
            Telephony is temporarily unavailable
          </div>
        )}

        {/* Content based on state */}
        {callState === 'initial' && (
          <>
            <ModalHeader
              icon={
                <div className="bg-primary-300 flex h-10 w-10 items-center justify-center rounded-full sm:h-12 sm:w-12">
                  <Icons.Headset size={20} className="text-dark-500 sm:size-6" strokeWidth={1.5} />
                </div>
              }
              title={t('pages.clients.modals.callDialog.callClient')}
            />
            <ModalContent>
              <div className="flex flex-col gap-4 sm:gap-6">
                {/* Client Name */}
                <div className="flex flex-col gap-2">
                  <label className="text-dark-500 text-sm font-light">
                    {t('pages.clients.modals.callDialog.clientName')}:
                  </label>
                  <input
                    type="text"
                    value={clientName}
                    readOnly
                    className="text-dark-500 focus:ring-primary-300/20 focus:border-primary-300 w-full rounded-lg border border-gray-400 bg-white px-3 py-2 text-sm font-light focus:ring-2 focus:outline-none"
                  />
                </div>

                {/* Phone Number */}
                <div className="flex flex-col gap-2">
                  <label className="text-dark-500 text-sm font-light">
                    {t('pages.clients.modals.callDialog.phoneNumber')}:
                  </label>
                  <input
                    type="text"
                    inputMode={manualPhoneEnabled ? 'numeric' : undefined}
                    autoComplete="tel"
                    value={manualPhoneEnabled ? manualPhoneDigits : phoneNumber}
                    readOnly={!manualPhoneEnabled}
                    maxLength={manualPhoneEnabled ? 12 : undefined}
                    onChange={
                      manualPhoneEnabled
                        ? (e) => handleManualPhoneChange(e.target.value)
                        : undefined
                    }
                    placeholder={
                      manualPhoneEnabled
                        ? t('pages.clients.modals.callDialog.manualPhonePlaceholder')
                        : undefined
                    }
                    aria-invalid={
                      manualPhoneEnabled &&
                      manualPhoneDigits.length > 0 &&
                      !isValidManualDialPhone(manualPhoneDigits)
                    }
                    className={cn(
                      'text-dark-500 focus:ring-primary-300/20 focus:border-primary-300 w-full rounded-lg border border-gray-400 bg-white px-3 py-2 text-sm font-light focus:ring-2 focus:outline-none',
                      manualPhoneEnabled && 'font-mono tracking-wide tabular-nums',
                      !manualPhoneEnabled && 'bg-gray-50'
                    )}
                  />
                  <label
                    htmlFor="call-dialog-manual-phone"
                    className="flex cursor-pointer items-center gap-2"
                  >
                    <Checkbox
                      id="call-dialog-manual-phone"
                      checked={manualPhoneEnabled}
                      onCheckedChange={(v) => {
                        const on = v === true
                        setManualPhoneEnabled(on)
                        if (!on) setManualPhoneDigits('')
                      }}
                    />
                    <span className="text-dark-500 text-sm font-light">
                      {t('pages.clients.modals.callDialog.manualPhoneEntry')}
                    </span>
                  </label>
                  {manualPhoneEnabled && (
                    <p className="text-xs text-gray-500">
                      {t('pages.clients.modals.callDialog.manualPhoneHint')}
                    </p>
                  )}
                </div>

                {/* Call Type */}
                <div className="flex flex-col gap-2">
                  <label className="text-dark-500 text-sm font-light">
                    {t('pages.clients.modals.callDialog.callType')}:
                  </label>
                  <RadioGroup
                    value={callType}
                    onValueChange={(value) => setCallType(value as CallType)}
                    className="flex flex-col gap-2 sm:flex-row sm:gap-3"
                  >
                    <label
                      className={cn(
                        'flex cursor-pointer items-center gap-2 rounded-lg border-2 px-3 py-2 transition-colors sm:px-4',
                        callType === 'white-line'
                          ? 'border-primary-300 bg-primary-100'
                          : 'border-gray-300 bg-white hover:border-gray-400'
                      )}
                    >
                      <RadioItem value="white-line" id="white-line" />
                      <span className="text-dark-500 text-xs font-light sm:text-sm">
                        {t('pages.clients.modals.callDialog.whiteLine')}
                      </span>
                    </label>
                    <label
                      className={cn(
                        'flex cursor-pointer items-center gap-2 rounded-lg border-2 px-3 py-2 transition-colors sm:px-4',
                        callType === 'gray-line'
                          ? 'border-primary-300 bg-primary-100'
                          : 'border-gray-300 bg-white hover:border-gray-400'
                      )}
                    >
                      <RadioItem value="gray-line" id="gray-line" />
                      <span className="text-dark-500 text-xs font-light sm:text-sm">
                        {t('pages.clients.modals.callDialog.grayLine')}
                      </span>
                    </label>
                    <label
                      className={cn(
                        'flex cursor-pointer items-center gap-2 rounded-lg border-2 px-3 py-2 transition-colors sm:px-4',
                        callType === 'spam-calls'
                          ? 'border-primary-300 bg-primary-100'
                          : 'border-gray-300 bg-white hover:border-gray-400'
                      )}
                    >
                      <RadioItem value="spam-calls" id="spam-calls" />
                      <span className="text-dark-500 text-xs font-light sm:text-sm">
                        {t('pages.clients.modals.callDialog.spamCalls')}
                      </span>
                    </label>
                  </RadioGroup>
                </div>
              </div>
            </ModalContent>
            <ModalFooter className="flex-col gap-2 sm:flex-row sm:gap-3">
              <Button
                variant="cancel"
                size="sm"
                onClick={handleClose}
                className="w-full rounded-md"
              >
                {t('actions.cancel')}
              </Button>
              {callType === 'spam-calls' ? (
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => {
                    const target = manualPhoneEnabled ? manualPhoneDigits : phoneNumber
                    if (manualPhoneEnabled && !isValidManualDialPhone(manualPhoneDigits)) return
                    if (onSpamCall) onSpamCall(target)
                    handleClose()
                  }}
                  className="w-full rounded-md"
                  disabled={
                    manualPhoneEnabled
                      ? !isValidManualDialPhone(manualPhoneDigits)
                      : !String(phoneNumber).trim()
                  }
                  leftIcon={<Icons.Cancel01 size={18} className="sm:size-5" />}
                >
                  {t('pages.clients.modals.callDialog.markAsSpam')}
                </Button>
              ) : (
                <Button
                  variant="primary"
                  size="sm"
                  onClick={handleCallNow}
                  className="w-full rounded-md"
                  leftIcon={
                    isLoading ? undefined : <Icons.Headset size={18} className="sm:size-5" />
                  }
                  disabled={isLoading || isCallCooldown || !canPlaceCall}
                >
                  {isLoading
                    ? t('status.loading')
                    : isCallCooldown
                      ? `Try again in ${cooldownSecondsRemaining || 1}s`
                      : t('pages.clients.modals.callDialog.callNow')}
                </Button>
              )}
            </ModalFooter>
          </>
        )}

        {(callState === 'dialing' ||
          callState === 'connected' ||
          callState === 'ended' ||
          callState === 'failed') && (
          <>
            {/* Contact Info */}
            <div className="flex flex-col items-center gap-2 sm:gap-3">
              <div className="flex h-16 w-16 items-center justify-center rounded-full border-2 border-gray-300 bg-white sm:h-20 sm:w-20">
                <Icons.Headset size={32} className="text-gray-700 sm:size-10" strokeWidth={1.5} />
              </div>
              <div className="text-dark-500 text-center text-xl font-semibold sm:text-2xl">
                {clientName}
              </div>
              <div
                className={cn(
                  'flex items-center gap-2 rounded-full px-3 py-1 sm:px-4 sm:py-1.5',
                  callState === 'dialing'
                    ? 'bg-primary-300'
                    : callState === 'connected'
                      ? 'bg-success-500'
                      : callState === 'failed'
                        ? 'bg-error-500'
                        : 'bg-gray-800'
                )}
              >
                <div
                  className={cn(
                    'h-2 w-2 rounded-full',
                    callState === 'dialing' ? 'bg-primary-500' : 'bg-white'
                  )}
                />
                <span
                  className={cn(
                    'text-xs font-medium sm:text-sm',
                    callState === 'dialing' ? 'text-dark-500' : 'text-white'
                  )}
                >
                  {callState === 'dialing'
                    ? t('pages.clients.modals.callDialog.calling')
                    : callState === 'connected'
                      ? t('pages.clients.modals.callDialog.connected')
                      : callState === 'failed'
                        ? t('pages.clients.modals.callDialog.callFailed')
                        : t('pages.clients.modals.callDialog.callEnded')}
                </span>
              </div>
              <div className="text-dark-500 text-xs sm:text-sm">{displayPhone}</div>
            </div>

            {/* Call Details Card */}
            {(callState === 'dialing' || callState === 'connected') && (
              <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-gray-200 bg-white p-4">
                <div className="flex items-center gap-2">
                  <Icons.StopWatch size={16} className="text-gray-600" />
                  <span className="text-dark-500 text-sm font-medium">
                    {callState === 'dialing'
                      ? t('pages.clients.modals.callDialog.elapsedTime')
                      : t('pages.clients.modals.callDialog.talkTime')}
                    : <span className="font-semibold">{formatTime(elapsedTime)}</span>
                  </span>
                </div>
                <div className="mt-1 text-sm text-gray-600">
                  {callState === 'dialing'
                    ? t('pages.clients.modals.callDialog.dialing')
                    : t('pages.clients.modals.callDialog.activeCall')}
                </div>
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <Icons.Phone size={14} className="text-gray-500" />
                  <span>
                    {t('pages.clients.modals.callDialog.callType')}: {callLineLabel}
                  </span>
                </div>
              </div>
            )}

            {callState === 'ended' && (
              <>
                <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-gray-200 bg-white p-4">
                  <div className="flex items-center gap-2">
                    <Icons.StopWatch size={16} className="text-gray-600" />
                    <span className="text-dark-500 text-sm font-medium">
                      {t('pages.clients.modals.callDialog.duration')}:{' '}
                      <span className="font-semibold">{formatTime(elapsedTime)}</span>
                    </span>
                  </div>
                  <div className="text-success-500 mt-1 text-sm font-medium">
                    {t('pages.clients.modals.callDialog.answered')}
                  </div>
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <Icons.Phone size={14} className="text-gray-500" />
                    <span>
                      {t('pages.clients.modals.callDialog.callType')}: {callLineLabel}
                    </span>
                  </div>
                </div>
                <div className="text-dark-500 mt-2 text-center text-sm">
                  {t('pages.clients.modals.callDialog.autoClosingIn')}{' '}
                  <span className="font-semibold">{autoCloseCountdown}</span>{' '}
                  {t('pages.clients.modals.callDialog.seconds')}...
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleClose}
                  className="text-dark-500 mt-3 w-full rounded-md border-gray-400"
                >
                  {t('actions.close')}
                </Button>
              </>
            )}

            {callState === 'failed' && (
              <>
                <div className="border-error-200 bg-error-50 flex flex-col items-center justify-center gap-3 rounded-lg border p-4">
                  <div className="bg-error-100 flex h-12 w-12 items-center justify-center rounded-full">
                    <Icons.Cancel01 size={24} className="text-error-500" />
                  </div>
                  <div className="text-error-600 text-center text-sm font-medium">
                    {error || t('pages.clients.modals.callDialog.callFailedMessage')}
                  </div>
                </div>
                <div className="flex flex-col gap-2 sm:flex-row sm:gap-3">
                  <Button
                    variant="cancel"
                    size="sm"
                    onClick={handleClose}
                    className="w-full rounded-md"
                  >
                    {t('actions.close')}
                  </Button>
                  {onRetry && (
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => {
                        setDialDisplayPhone(null)
                        setCallState('initial')
                        onRetry()
                      }}
                      className="w-full rounded-md"
                      leftIcon={<Icons.Headset size={18} className="sm:size-5" />}
                    >
                      {t('pages.clients.modals.callDialog.tryAgain')}
                    </Button>
                  )}
                </div>
              </>
            )}

            {/* Action Buttons */}
            {callState !== 'ended' && callState !== 'failed' && (
              <div className="flex flex-col gap-2 sm:flex-row sm:gap-3">
                <Button
                  variant={isMuted ? 'danger' : 'outline'}
                  size="sm"
                  onClick={() => setIsMuted(!isMuted)}
                  disabled
                  className={cn(
                    'w-full rounded-md',
                    isMuted
                      ? 'bg-error-500 hover:bg-error-600 text-white'
                      : 'text-dark-500 border-gray-400 bg-white hover:bg-gray-50',
                    'cursor-not-allowed opacity-50'
                  )}
                >
                  <Icons.HeadphoneMute size={18} className="mr-2 sm:size-5" />
                  {t('pages.clients.modals.callDialog.mute')}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsOnHold(!isOnHold)}
                  disabled
                  className={cn(
                    'text-dark-500 w-full rounded-md border-gray-400 bg-white hover:bg-gray-50',
                    isOnHold && 'bg-gray-800 text-white',
                    'cursor-not-allowed opacity-50'
                  )}
                >
                  <Icons.Pause size={18} className="mr-2 sm:size-5" />
                  {t('pages.clients.modals.callDialog.hold')}
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={handleHangUp}
                  disabled={hangupMutation.isPending}
                  className="bg-primary-300 text-dark-500 hover:bg-primary-400 w-full rounded-md"
                >
                  <Icons.Call02 size={18} className="mr-2 sm:size-5" />
                  {t('pages.clients.modals.callDialog.hangUp')}
                </Button>
              </div>
            )}
          </>
        )}
      </div>
    </Modal>
  )
}

// Loan Card Component for Incoming Call
function LoanCard({
  loan,
}: {
  loan: {
    id: string
    clientName: string
    loanNumber: string
    counterparty: string
    loanPrincipal: number
    debt: number
    status: string
    saleDate: string
    lastContact: string
    priority: 'Critical' | 'High' | 'Medium' | 'Low'
    score: number
  }
}) {
  const { t } = useTranslation('common')

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'Critical':
        return 'bg-error-500'
      case 'High':
        return 'bg-warning-500'
      case 'Medium':
        return 'bg-success-500'
      case 'Low':
        return 'bg-gray-500'
      default:
        return 'bg-gray-500'
    }
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-3 sm:p-4">
      <div className="flex flex-col items-start justify-between gap-2 sm:flex-row sm:items-center sm:gap-4">
        <div className="flex items-center gap-2 sm:gap-3">
          <div
            className={cn(
              'flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold text-white sm:h-10 sm:w-10 sm:text-sm',
              getPriorityColor(loan.priority)
            )}
          >
            {loan.score}
          </div>
          <div className="flex flex-col">
            <div className="text-dark-500 text-xs font-medium sm:text-sm">
              {loan.clientName} - {t('pages.clients.detail.tableHeaders.loanNumber')} #
              {loan.loanNumber}
            </div>
          </div>
        </div>
        <button className="text-primary-300 text-xs font-medium sm:text-sm">
          {t('pages.clients.modals.callDialog.viewClient')} &gt;
        </button>
      </div>
      <div className="mt-2 grid grid-cols-1 gap-2 sm:mt-3 sm:grid-cols-2 sm:gap-3">
        <div className="flex flex-col gap-1">
          <span className="text-xs text-gray-600">
            {t('pages.clients.detail.tableHeaders.counterparty')}:
          </span>
          <span className="text-dark-500 text-sm font-medium">{loan.counterparty}</span>
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-xs text-gray-600">
            {t('pages.clients.detail.tableHeaders.saleDate')}:
          </span>
          <span className="text-dark-500 text-sm font-medium">{loan.saleDate}</span>
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-xs text-gray-600">
            {t('pages.clients.modals.callDialog.loanPrincipal')}:
          </span>
          <span className="text-dark-500 text-sm font-medium">
            {formatMoneyUAHTwoDecimals(loan.loanPrincipal)}
          </span>
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-xs text-gray-600">
            {t('pages.clients.modals.callDialog.lastContact')}:
          </span>
          <span className="text-dark-500 text-sm font-medium">{loan.lastContact}</span>
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-xs text-gray-600">
            {t('pages.clients.detail.tableHeaders.debt')}:
          </span>
          <span className="text-dark-500 text-sm font-medium">
            {formatMoneyUAHTwoDecimals(loan.debt)}
          </span>
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-xs text-gray-600">
            {t('pages.clients.detail.tableHeaders.status')}:
          </span>
          <span className="text-dark-500 text-sm font-medium">{loan.status}</span>
        </div>
      </div>
    </div>
  )
}

export default CallDialogModal
