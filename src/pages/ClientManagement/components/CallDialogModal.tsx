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

import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { useQueryClient } from '@tanstack/react-query'
import { Modal, ModalHeader, ModalContent, ModalFooter } from '../../../components/ui/Modal'
import { Button } from '../../../components/ui/Button'
import { Checkbox } from '@/components/ui/Checkbox'
import { RadioGroup, RadioItem } from '../../../components/ui/Radio'
import { Icons } from '@/lib/icons'
import { cn } from '@/lib/utils'
import { useCallStore } from '@/stores/callStore'
import type { IncomingModalLoan } from '@/stores/callStore'
import { useCallDetails, useHangupCall, useRejectCall } from '@/features/calls/hooks/useCall'
import type { IncomingCallClient } from '@/features/calls/types'
import { useCallStateUpdates } from '@/features/calls/hooks/useCallStateUpdates'
import { useSetLastCallResultFromCall } from '@/features/contactTags/hooks/useContactTags'
import { useAuth } from '@/features/auth/hooks/useAuth'
import { formatMoneyUAHTwoDecimals } from '@/lib/formatters'
import {
  CALL_MODAL_AUTO_CLOSE_SECONDS,
  CALL_MODAL_AUTO_CLOSE_MAX_WAIT_MS,
} from '@/features/calls/constants/callModal'

export type CallState = 'initial' | 'dialing' | 'connected' | 'ended' | 'failed' | 'incoming'
export type CallType = 'white-line' | 'gray-line' | 'spam-calls'
export type CallStatus = 'answered' | 'missed' | 'rejected'

export interface CallDialogModalProps {
  open: boolean
  onClose: () => void
  clientId?: number | null
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
  onCallStart?: (callType: CallType, dialPhoneNumber: string) => void | Promise<string | null>
  onCallEnd?: (duration: number, status: CallStatus) => void
  onAnswer?: () => void
  onReject?: () => void
  onMinimize?: () => void
  onRetry?: () => void // Callback to retry failed call
  onSpamCall?: (phone: string) => void // Callback to add phone to spam call history
  /** When false, spam-calls option is hidden. Default true. */
  spamOptionEnabled?: boolean
  // For incoming call
  loans?: IncomingModalLoan[]
  /** Screen-pop context for the ringing state: annotation, responsible, history. */
  incomingContext?: IncomingCallClient | null
  /** Every client the calling number resolved to. Length drives the ringing UI:
   *  0 → "client not found", 1 → context only, >1 → the operator picks one. */
  incomingClients?: IncomingCallClient[]
  selectedIncomingClientId?: number | null
  onSelectIncomingClient?: (clientId: number) => void
  /** Opens the client list pre-seeded with the calling number. */
  onSearchByPhone?: () => void
  /** Answering has no backend path yet, so the control stays hidden by default. */
  answerEnabled?: boolean
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
  clientId,
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
  spamOptionEnabled = true,
  loans = [],
  incomingContext = null,
  incomingClients = [],
  selectedIncomingClientId = null,
  onSelectIncomingClient,
  onSearchByPhone,
  answerEnabled = false,
}: CallDialogModalProps) {
  const { t } = useTranslation('common')
  const queryClient = useQueryClient()
  const { setMinimizedCall, setOpenCallModal, minimizedCall } = useCallStore()
  const { user: authUser } = useAuth()

  // Fetch call details with polling if callId is provided
  const { data: callDetails } = useCallDetails(callId || null)
  const setLastCallResult = useSetLastCallResultFromCall(clientId ?? null)
  const lastCallResultSyncedRef = useRef<string | null>(null)

  // Listen for real-time call state updates via Socket.IO
  const agentExtension = authUser?.asterisk_extension || null
  useCallStateUpdates(agentExtension, callId || null, clientId)

  // Hangup mutation
  const hangupMutation = useHangupCall(clientId)
  // The operator's own extension identifies which of the queue's ringing legs
  // to drop; without it the backend can only guess at the first one rung.
  const rejectMutation = useRejectCall(clientId, agentExtension)
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
  const [autoCloseCountdown, setAutoCloseCountdown] = useState(CALL_MODAL_AUTO_CLOSE_SECONDS)
  const [manualPhoneEnabled, setManualPhoneEnabled] = useState(initialManualPhoneEnabled)
  const [manualPhoneDigits, setManualPhoneDigits] = useState(initialManualPhoneDigits)
  /** Number shown during / after outbound call (includes manual entry). */
  const [dialDisplayPhone, setDialDisplayPhone] = useState<string | null>(null)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const autoCloseMaxWaitRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const autoCloseStartedRef = useRef(false)
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
      setCallType(
        !spamOptionEnabled && initialCallType === 'spam-calls' ? 'white-line' : initialCallType
      )
      setIsMuted(false)
      setIsOnHold(false)
      setAutoCloseCountdown(CALL_MODAL_AUTO_CLOSE_SECONDS)
      autoCloseStartedRef.current = false
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
      if (autoCloseMaxWaitRef.current) {
        clearTimeout(autoCloseMaxWaitRef.current)
        autoCloseMaxWaitRef.current = null
      }
      autoCloseStartedRef.current = false
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
    spamOptionEnabled,
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

  const syncLastCallResult = (outcome: string, phone: string, syncKey: string) => {
    if (!clientId || !phone || !outcome) return
    if (lastCallResultSyncedRef.current === syncKey) return
    lastCallResultSyncedRef.current = syncKey
    setLastCallResult.mutate({ phone, outcome })
  }

  const resolveTelephonyOutcome = (): string | null => {
    if (callDetails?.outcome) {
      return callDetails.outcome
    }
    if (callDetails?.talk_duration && callDetails.talk_duration > 0) {
      return 'answered'
    }
    if (callDetails?.answered_at) {
      return 'answered'
    }
    if (callState === 'connected' || callState === 'ended') {
      return elapsedTime > 0 ? 'answered' : 'no_answer'
    }
    if (callDetails?.state === 'FAILED') {
      return 'failed'
    }
    return 'no_answer'
  }

  // Keep Last Call Result contact tag in sync when a call completes.
  useEffect(() => {
    if (!open || !clientId || !callDetails) return
    if (callDetails.state !== 'COMPLETED' && callDetails.state !== 'FAILED') return

    const outcome = resolveTelephonyOutcome()
    if (!outcome) return

    const phone = callDetails.customer_number || displayPhone
    const syncKey = `${callDetails.call_id}:${outcome}:${phone}`
    syncLastCallResult(outcome, phone, syncKey)
  }, [open, clientId, callDetails, displayPhone, callState, elapsedTime]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!open) {
      lastCallResultSyncedRef.current = null
    }
  }, [open])

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

  const clearAutoCloseTimers = () => {
    if (countdownRef.current) {
      clearInterval(countdownRef.current)
      countdownRef.current = null
    }
    if (autoCloseMaxWaitRef.current) {
      clearTimeout(autoCloseMaxWaitRef.current)
      autoCloseMaxWaitRef.current = null
    }
  }

  const finalizeAutoClose = () => {
    clearAutoCloseTimers()
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
    setCallState(initialState)
    setElapsedTime(0)
    setIsMuted(false)
    setIsOnHold(false)
    setAutoCloseCountdown(CALL_MODAL_AUTO_CLOSE_SECONDS)
    autoCloseStartedRef.current = false
    onCloseRef.current()
  }

  const startAutoCloseCountdown = () => {
    if (autoCloseStartedRef.current) return
    autoCloseStartedRef.current = true
    setAutoCloseCountdown(CALL_MODAL_AUTO_CLOSE_SECONDS)

    countdownRef.current = setInterval(() => {
      setAutoCloseCountdown((prev) => {
        if (prev <= 1) {
          finalizeAutoClose()
          return 0
        }
        return prev - 1
      })
    }, 1000)
  }

  const clearAutoCloseTimersRef = useRef(clearAutoCloseTimers)
  const startAutoCloseCountdownRef = useRef(startAutoCloseCountdown)
  useEffect(() => {
    clearAutoCloseTimersRef.current = clearAutoCloseTimers
    startAutoCloseCountdownRef.current = startAutoCloseCountdown
  })

  // Nudge call details while the ended summary is visible (parent keeps callId until modal closes).
  useEffect(() => {
    if (callState === 'ended' && open && callId) {
      void queryClient.invalidateQueries({ queryKey: ['callDetails', callId] })
    }
  }, [callState, open, callId, queryClient])

  // Auto-close after backend logging reaches a terminal state (see onCloseRef for stable onClose).
  useEffect(() => {
    if (callState !== 'ended' || !open) {
      autoCloseStartedRef.current = false
      clearAutoCloseTimersRef.current()
      return
    }

    const loggingComplete =
      !callId || callDetails?.state === 'COMPLETED' || callDetails?.state === 'FAILED'

    if (loggingComplete) {
      const startTimerId = window.setTimeout(() => {
        startAutoCloseCountdownRef.current()
      }, 0)
      return () => {
        clearTimeout(startTimerId)
        clearAutoCloseTimersRef.current()
      }
    }

    autoCloseMaxWaitRef.current = setTimeout(() => {
      startAutoCloseCountdownRef.current()
    }, CALL_MODAL_AUTO_CLOSE_MAX_WAIT_MS)

    return () => clearAutoCloseTimersRef.current()
  }, [callState, open, callId, callDetails?.state])

  const handleCallNow = () => {
    if (!canPlaceCall) return
    const dialPhone = manualPhoneEnabled ? manualPhoneDigits : String(phoneNumber).trim()
    setDialDisplayPhone(dialPhone)
    setCallState('dialing')
    setElapsedTime(0)
    const result = onCallStart?.(callType, dialPhone)
    // Collapse the modal immediately on click — the operator returns to
    // the client card without waiting on the origination round-trip.
    const snapshotId = handleMinimize({ callState: 'dialing', elapsedTime: 0 })
    // Patch the snapshot once origination resolves so the bar can poll
    // call state and use the real call_id for hang-up. Skipped when the
    // callsite doesn't return a Promise (legacy void-return callers).
    if (result && typeof (result as Promise<string | null>).then === 'function') {
      void (result as Promise<string | null>).then((callId) => {
        const current = useCallStore.getState().minimizedCall
        // If the snapshot has been replaced (operator started another
        // call), don't trample the newer state.
        if (!current || current.id !== snapshotId || current.type !== 'call-dialog') return
        if (callId) {
          if (!current.callId) setMinimizedCall({ ...current, callId })
        } else {
          // Origination failed — flip to 'failed' so the bar's auto-dismiss
          // timer fires and the operator's bar clears itself. The global
          // toast from useOriginateCall surfaces the human-readable error.
          setMinimizedCall({ ...current, callState: 'failed' })
        }
      })
    }
  }

  const handleAnswer = () => {
    if (onAnswer) {
      onAnswer()
    }
    setCallState('connected')
    setElapsedTime(0)
  }

  const handleReject = () => {
    if (rejectMutation.isPending) return
    // Reject rather than hangup: the backend records this as declined by the
    // operator, which the client history has to tell apart from a missed call.
    if (callId) {
      rejectMutation.mutate(callId)
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
    const telephonyOutcome = status === 'answered' ? 'answered' : 'no_answer'
    const syncKey = `${callId ?? 'local'}:${telephonyOutcome}:${displayPhone}`

    // Send hangup command to Asterisk if we have a call ID
    if (callId) {
      hangupMutation.mutate(callId, {
        onSuccess: () => {
          syncLastCallResult(telephonyOutcome, displayPhone, syncKey)
          if (onCallEnd) onCallEnd(elapsedTime, status)
          setCallState('ended')
        },
        onError: () => {
          // Hangup failed (AMI unavailable, call already ended, etc.)
          // Force end the call on the frontend regardless
          syncLastCallResult(telephonyOutcome, displayPhone, syncKey)
          if (onCallEnd) onCallEnd(elapsedTime, status)
          setCallState('ended')
        },
      })
    } else {
      // No callId — just end locally
      syncLastCallResult(telephonyOutcome, displayPhone, syncKey)
      if (onCallEnd) onCallEnd(elapsedTime, status)
      setCallState('ended')
    }
  }

  const handleMinimize = useCallback(
    (overrides?: { callId?: string; callState?: CallState; elapsedTime?: number }): string => {
      const id = `call-dialog-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
      setMinimizedCall({
        id,
        type: 'call-dialog',
        clientName,
        // Always store the ORIGINAL client phone here so restoring and
        // un-checking "manual phone entry" falls back to the correct number.
        phoneNumber,
        // Separate field for what the minimized-bubble tooltip should show.
        displayPhone,
        clientId,
        callId: overrides?.callId ?? callId ?? null,
        callState: overrides?.callState ?? callState,
        callType,
        elapsedTime: overrides?.elapsedTime ?? elapsedTime,
        manualPhoneEnabled,
        manualPhoneDigits,
        loans,
        incomingContext,
        incomingClients,
        timestamp: Date.now(),
      })
      // If onMinimize is provided, use it instead of onClose
      // This prevents clearing the minimized state when restoring and re-minimizing
      if (onMinimize) {
        onMinimize()
      } else {
        onClose()
      }
      return id
    },
    [
      setMinimizedCall,
      clientName,
      phoneNumber,
      displayPhone,
      clientId,
      callId,
      callState,
      callType,
      elapsedTime,
      manualPhoneEnabled,
      manualPhoneDigits,
      loans,
      incomingContext,
      incomingClients,
      onMinimize,
      onClose,
    ]
  )

  const handleClose = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
    if (countdownRef.current) {
      clearInterval(countdownRef.current)
      countdownRef.current = null
    }
    if (autoCloseMaxWaitRef.current) {
      clearTimeout(autoCloseMaxWaitRef.current)
      autoCloseMaxWaitRef.current = null
    }
    autoCloseStartedRef.current = false
    if (dialingTimeoutRef.current) {
      clearTimeout(dialingTimeoutRef.current)
      dialingTimeoutRef.current = null
    }
    setCallState(initialState)
    setElapsedTime(0)
    setIsMuted(false)
    setIsOnHold(false)
    setAutoCloseCountdown(CALL_MODAL_AUTO_CLOSE_SECONDS)
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
          onClick={() => handleMinimize()}
          className="hover:bg-muted absolute top-2 right-2 flex h-8 w-8 items-center justify-center rounded-md transition-colors sm:top-4 sm:right-12"
          aria-label="Minimize modal"
        >
          <Icons.Remove02 size={20} className="text-foreground" strokeWidth={1.5} />
        </button>
        <div className="flex flex-col gap-4 sm:gap-6">
          {telephonyUnavailable && (
            <div
              role="alert"
              className="border-warning-500/40 bg-warning-50 text-warning-500 rounded-lg border px-3 py-2 text-sm font-medium"
            >
              Telephony is temporarily unavailable
            </div>
          )}

          {/* Call Info */}
          <div className="flex flex-col items-center gap-2 sm:gap-3">
            <div className="border-border bg-muted flex h-16 w-16 items-center justify-center rounded-full border-2 sm:h-20 sm:w-20">
              <Icons.Headset size={32} className="text-foreground sm:size-10" strokeWidth={1.5} />
            </div>
            <div className="text-foreground text-center text-xl font-semibold sm:text-2xl">
              {phoneNumber}
            </div>
            <div className="bg-primary flex items-center gap-2 rounded-full px-3 py-1 sm:px-4 sm:py-1.5">
              <div className="bg-primary-foreground h-2 w-2 rounded-full" />
              <span className="text-primary-foreground text-xs font-medium sm:text-sm">
                {t('pages.clients.modals.callDialog.incomingCall')}
              </span>
            </div>
          </div>

          {/* Guard on the context too: a call restored from minimized carries the
              resolved client but not the full candidate list, and must not be
              mistaken for an unresolved caller. */}
          {incomingClients.length === 0 && !incomingContext ? (
            <IncomingCallerNotFound onSearchByPhone={onSearchByPhone} t={t} />
          ) : (
            <>
              {incomingClients.length > 1 && (
                <IncomingClientPicker
                  clients={incomingClients}
                  selectedClientId={incomingContext?.client_id ?? selectedIncomingClientId}
                  onSelect={onSelectIncomingClient}
                  t={t}
                />
              )}
              <IncomingCallContext context={incomingContext} clientId={clientId} t={t} />
            </>
          )}

          {/* Loans Information */}
          {loans.length > 0 && (
            <div className="flex flex-col gap-3 sm:gap-4">
              {/* Primary loans */}
              {loans.filter((loan) => loan.priority === 'Critical').length > 0 && (
                <div className="flex flex-col gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="bg-error-500 text-primary-foreground rounded-full px-2 py-1 text-xs font-medium sm:px-3">
                      {t('pages.clients.modals.callDialog.primary')}
                    </span>
                    <span className="text-foreground text-xs font-medium sm:text-sm">
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
                    <span className="bg-warning-500 text-primary-foreground rounded-full px-2 py-1 text-xs font-medium sm:px-3">
                      {t('pages.clients.priorities.high')}
                    </span>
                    <span className="text-foreground text-xs font-medium sm:text-sm">
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

              <button className="text-primary-700 flex items-center justify-center gap-1 text-xs font-medium sm:text-sm">
                {t('pages.clients.modals.callDialog.viewAllLoans')}{' '}
                <Icons.ArrowDown size={14} className="sm:size-4" />
              </button>
            </div>
          )}

          {/* Call Actions */}
          <div className="flex flex-col gap-2 sm:gap-3">
            <div className="bg-muted flex items-center gap-2 rounded-lg px-3 py-2 sm:px-4">
              <Icons.StopWatch size={14} className="text-muted-foreground sm:size-4" />
              <span className="text-muted-foreground text-xs sm:text-sm">
                {t('pages.clients.modals.callDialog.ringing')} {formatTime(elapsedTime)}
              </span>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row sm:gap-3">
              <Button
                variant="danger"
                size="sm"
                onClick={handleReject}
                disabled={rejectMutation.isPending}
                className="w-full rounded-md"
              >
                <Icons.Cancel01 size={18} className="mr-2 sm:size-5" />
                {t('pages.clients.modals.callDialog.reject')}
              </Button>
              {answerEnabled && (
                <Button
                  variant="primary"
                  size="sm"
                  onClick={handleAnswer}
                  className="w-full rounded-md"
                >
                  <Icons.HeadphoneMute size={18} className="mr-2 sm:size-5" />
                  {t('pages.clients.modals.callDialog.answerCall')}
                </Button>
              )}
            </div>
            {!answerEnabled && (
              <p className="text-muted-foreground text-center text-xs">
                {t(
                  'pages.clients.modals.callDialog.answerOnSoftphone',
                  'Answer the call on your softphone'
                )}
              </p>
            )}
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
        onClick={() => handleMinimize()}
        className="hover:bg-muted absolute top-2 right-2 flex h-8 w-8 items-center justify-center rounded-md transition-colors sm:top-4 sm:right-12"
        aria-label="Minimize modal"
      >
        <Icons.Remove02 size={20} className="text-foreground" strokeWidth={1.5} />
      </button>
      <div className="flex flex-col gap-4 sm:gap-6">
        {telephonyUnavailable && (
          <div
            role="alert"
            className="border-warning-500/40 bg-warning-50 text-warning-500 rounded-lg border px-3 py-2 text-sm font-medium"
          >
            Telephony is temporarily unavailable
          </div>
        )}

        {/* Content based on state */}
        {callState === 'initial' && (
          <>
            <ModalHeader
              icon={
                <div className="bg-primary flex h-10 w-10 items-center justify-center rounded-full sm:h-12 sm:w-12">
                  <Icons.Headset
                    size={20}
                    className="text-primary-foreground sm:size-6"
                    strokeWidth={1.5}
                  />
                </div>
              }
              title={t('pages.clients.modals.callDialog.callClient')}
            />
            <ModalContent>
              <div className="flex flex-col gap-4 sm:gap-6">
                {/* Client Name */}
                <div className="flex flex-col gap-2">
                  <label className="text-foreground text-sm font-light">
                    {t('pages.clients.modals.callDialog.clientName')}:
                  </label>
                  <input
                    type="text"
                    value={clientName}
                    readOnly
                    className={cn(
                      'text-foreground focus:border-primary focus:ring-primary/20 border-border bg-card w-full rounded-lg border px-3 py-2 text-sm font-light focus:ring-2 focus:outline-none'
                    )}
                  />
                </div>

                {/* Phone Number */}
                <div className="flex flex-col gap-2">
                  <label className="text-foreground text-sm font-light">
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
                      'text-foreground focus:border-primary focus:ring-primary/20 border-border bg-card w-full rounded-lg border px-3 py-2 text-sm font-light focus:ring-2 focus:outline-none',
                      manualPhoneEnabled && 'font-mono tracking-wide tabular-nums',
                      !manualPhoneEnabled && 'bg-muted'
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
                    <span className="text-foreground text-sm font-light">
                      {t('pages.clients.modals.callDialog.manualPhoneEntry')}
                    </span>
                  </label>
                  {manualPhoneEnabled && (
                    <p className="text-muted-foreground text-xs">
                      {t('pages.clients.modals.callDialog.manualPhoneHint')}
                    </p>
                  )}
                </div>

                {/* Call Type */}
                <div className="flex flex-col gap-2">
                  <label className="text-foreground text-sm font-light">
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
                          ? 'border-primary bg-primary/10'
                          : 'border-border bg-card hover:border-muted-foreground/40'
                      )}
                    >
                      <RadioItem value="white-line" id="white-line" />
                      <span className="text-foreground text-xs font-light sm:text-sm">
                        {t('pages.clients.modals.callDialog.whiteLine')}
                      </span>
                    </label>
                    <label
                      className={cn(
                        'flex cursor-pointer items-center gap-2 rounded-lg border-2 px-3 py-2 transition-colors sm:px-4',
                        callType === 'gray-line'
                          ? 'border-primary bg-primary/10'
                          : 'border-border bg-card hover:border-muted-foreground/40'
                      )}
                    >
                      <RadioItem value="gray-line" id="gray-line" />
                      <span className="text-foreground text-xs font-light sm:text-sm">
                        {t('pages.clients.modals.callDialog.grayLine')}
                      </span>
                    </label>
                    {spamOptionEnabled && (
                      <label
                        className={cn(
                          'flex cursor-pointer items-center gap-2 rounded-lg border-2 px-3 py-2 transition-colors sm:px-4',
                          callType === 'spam-calls'
                            ? 'border-primary bg-primary/10'
                            : 'border-border bg-card hover:border-muted-foreground/40'
                        )}
                      >
                        <RadioItem value="spam-calls" id="spam-calls" />
                        <span className="text-foreground text-xs font-light sm:text-sm">
                          {t('pages.clients.modals.callDialog.spamCalls')}
                        </span>
                      </label>
                    )}
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
              <div className="border-border bg-muted flex h-16 w-16 items-center justify-center rounded-full border-2 sm:h-20 sm:w-20">
                <Icons.Headset size={32} className="text-foreground sm:size-10" strokeWidth={1.5} />
              </div>
              <div className="text-foreground text-center text-xl font-semibold sm:text-2xl">
                {clientName}
              </div>
              <div
                className={cn(
                  'flex items-center gap-2 rounded-full px-3 py-1 sm:px-4 sm:py-1.5',
                  callState === 'dialing'
                    ? 'bg-primary'
                    : callState === 'connected'
                      ? 'bg-success-500'
                      : callState === 'failed'
                        ? 'bg-error-500'
                        : 'bg-muted-foreground'
                )}
              >
                <div
                  className={cn(
                    'h-2 w-2 rounded-full',
                    callState === 'dialing' ? 'bg-primary-foreground' : 'bg-card'
                  )}
                />
                <span className="text-primary-foreground text-xs font-medium sm:text-sm">
                  {callState === 'dialing'
                    ? t('pages.clients.modals.callDialog.calling')
                    : callState === 'connected'
                      ? t('pages.clients.modals.callDialog.connected')
                      : callState === 'failed'
                        ? t('pages.clients.modals.callDialog.callFailed')
                        : t('pages.clients.modals.callDialog.callEnded')}
                </span>
              </div>
              <div className="text-foreground text-xs sm:text-sm">{displayPhone}</div>
            </div>

            {/* Call Details Card */}
            {(callState === 'dialing' || callState === 'connected') && (
              <div className="border-border bg-card flex flex-col items-center justify-center gap-2 rounded-lg border p-4">
                <div className="flex items-center gap-2">
                  <Icons.StopWatch size={16} className="text-muted-foreground" />
                  <span className="text-foreground text-sm font-medium">
                    {callState === 'dialing'
                      ? t('pages.clients.modals.callDialog.elapsedTime')
                      : t('pages.clients.modals.callDialog.talkTime')}
                    : <span className="font-semibold">{formatTime(elapsedTime)}</span>
                  </span>
                </div>
                <div className="text-muted-foreground mt-1 text-sm">
                  {callState === 'dialing'
                    ? t('pages.clients.modals.callDialog.dialing')
                    : t('pages.clients.modals.callDialog.activeCall')}
                </div>
                <div className="text-muted-foreground flex items-center gap-2 text-sm">
                  <Icons.Phone size={14} className="text-muted-foreground" />
                  <span>
                    {t('pages.clients.modals.callDialog.callType')}: {callLineLabel}
                  </span>
                </div>
              </div>
            )}

            {callState === 'ended' && (
              <>
                <div className="border-border bg-card flex flex-col items-center justify-center gap-2 rounded-lg border p-4">
                  <div className="flex items-center gap-2">
                    <Icons.StopWatch size={16} className="text-muted-foreground" />
                    <span className="text-foreground text-sm font-medium">
                      {t('pages.clients.modals.callDialog.duration')}:{' '}
                      <span className="font-semibold">{formatTime(elapsedTime)}</span>
                    </span>
                  </div>
                  <div className="text-success-500 mt-1 text-sm font-medium">
                    {t('pages.clients.modals.callDialog.answered')}
                  </div>
                  <div className="text-muted-foreground flex items-center gap-2 text-sm">
                    <Icons.Phone size={14} className="text-muted-foreground" />
                    <span>
                      {t('pages.clients.modals.callDialog.callType')}: {callLineLabel}
                    </span>
                  </div>
                </div>
                <div className="text-foreground mt-2 text-center text-sm">
                  {t('pages.clients.modals.callDialog.autoClosingIn')}{' '}
                  <span className="font-semibold">{autoCloseCountdown}</span>{' '}
                  {t('pages.clients.modals.callDialog.seconds')}...
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleClose}
                  className="text-foreground border-border mt-3 w-full rounded-md"
                >
                  {t('actions.close')}
                </Button>
              </>
            )}

            {callState === 'failed' && (
              <>
                <div className="border-error-500/40 bg-error-50 flex flex-col items-center justify-center gap-3 rounded-lg border p-4">
                  <div className="bg-error-500/15 flex h-12 w-12 items-center justify-center rounded-full">
                    <Icons.Cancel01 size={24} className="text-error-500" />
                  </div>
                  <div className="text-error-500 text-center text-sm font-medium">
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
                      ? 'bg-error-500 hover:bg-error-600 text-primary-foreground'
                      : 'text-foreground border-border bg-card hover:bg-muted',
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
                    'text-foreground border-border bg-card hover:bg-muted w-full rounded-md',
                    isOnHold && 'bg-muted-foreground text-primary-foreground',
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
                  className="w-full rounded-md"
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
type TFn = (key: string, fallback: string) => string

/**
 * Shown when the calling number belongs to more than one client. The operator's
 * choice anchors the popup and becomes the context any interaction is filed
 * against, so nothing is assumed on their behalf.
 */
function IncomingClientPicker({
  clients,
  selectedClientId,
  onSelect,
  t,
}: {
  clients: IncomingCallClient[]
  selectedClientId?: number | null
  onSelect?: (clientId: number) => void
  t: TFn
}) {
  return (
    <div className="border-border flex flex-col gap-3 rounded-lg border p-3">
      <div className="flex flex-col gap-1">
        <span className="text-foreground text-sm font-semibold">
          {t('pages.clients.modals.callDialog.multipleClientsTitle', 'Several clients found')}
        </span>
        <span className="text-muted-foreground text-xs">
          {t(
            'pages.clients.modals.callDialog.multipleClientsHint',
            'Choose who is calling — the interaction will be filed against this client.'
          )}
        </span>
      </div>

      <RadioGroup
        value={selectedClientId != null ? String(selectedClientId) : undefined}
        onValueChange={(value) => onSelect?.(Number(value))}
      >
        {clients.map((candidate) => (
          <div
            key={candidate.client_id}
            className="border-border flex items-center justify-between gap-2 rounded-md border p-2"
          >
            <label
              htmlFor={`incoming-client-${candidate.client_id}`}
              className="flex cursor-pointer items-center gap-2"
            >
              <RadioItem
                value={String(candidate.client_id)}
                id={`incoming-client-${candidate.client_id}`}
              />
              <span className="text-foreground text-xs font-medium sm:text-sm">
                {candidate.client_name}
              </span>
            </label>
            <a
              href={`/dashboard/clients/${candidate.client_id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary-700 shrink-0 text-xs font-medium"
            >
              {t('pages.clients.modals.callDialog.viewClient', 'View Client')}
            </a>
          </div>
        ))}
      </RadioGroup>
    </div>
  )
}

/**
 * Shown when the number matched nobody in the operator's projects — including a
 * client of another brand, which is deliberately indistinguishable from absent.
 * No interaction can be filed without a client, so only the search route out is
 * offered.
 */
function IncomingCallerNotFound({ onSearchByPhone, t }: { onSearchByPhone?: () => void; t: TFn }) {
  return (
    <div className="border-border flex flex-col items-center gap-2 rounded-lg border border-dashed p-4 text-center">
      <Icons.UserSearch01 size={24} className="text-muted-foreground" strokeWidth={1.5} />
      <span className="text-foreground text-sm font-medium">
        {t('pages.clients.modals.callDialog.clientNotFound', 'Client not found')}
      </span>
      <span className="text-muted-foreground text-xs">
        {t(
          'pages.clients.modals.callDialog.clientNotFoundHint',
          'This number is not linked to any client in your projects.'
        )}
      </span>
      {onSearchByPhone && (
        <Button variant="secondary" size="sm" onClick={onSearchByPhone} className="mt-1">
          {t('pages.clients.modals.callDialog.searchByNumber', 'Search by this number')}
        </Button>
      )}
    </div>
  )
}

/**
 * The caller context the screen-pop is required to show beyond the debts:
 * how the number is annotated, whose number it is, who is responsible, and the
 * client's recent history. Renders nothing when the caller is unresolved.
 */
function IncomingCallContext({
  context,
  clientId,
  t,
}: {
  context: IncomingCallClient | null
  clientId?: number | null
  t: TFn
}) {
  if (!context) return null

  const interactions = context.recent_interactions ?? []
  const targetClientId = context.client_id ?? clientId

  return (
    <div className="border-border flex flex-col gap-3 rounded-lg border p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-foreground text-sm font-semibold">{context.client_name}</span>
        {targetClientId ? (
          <a
            href={`/dashboard/clients/${targetClientId}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary-700 text-xs font-medium sm:text-sm"
          >
            {t('pages.clients.modals.callDialog.viewClient', 'View Client')}
          </a>
        ) : null}
      </div>

      <dl className="grid grid-cols-1 gap-2 text-xs sm:grid-cols-2 sm:text-sm">
        {context.contact_type_name ? (
          <div className="flex gap-2">
            <dt className="text-muted-foreground">
              {t('pages.clients.modals.callDialog.numberBelongsTo', 'Number belongs to')}:
            </dt>
            <dd className="text-foreground font-medium">
              {context.contact_source
                ? `${context.contact_type_name} (${context.contact_source})`
                : context.contact_type_name}
            </dd>
          </div>
        ) : null}
        {context.responsible_employee_id ? (
          <div className="flex gap-2">
            <dt className="text-muted-foreground">
              {t('pages.clients.modals.callDialog.responsible', 'Responsible')}:
            </dt>
            <dd className="text-foreground font-medium">#{context.responsible_employee_id}</dd>
          </div>
        ) : null}
        {context.contact_comment ? (
          <div className="flex gap-2 sm:col-span-2">
            <dt className="text-muted-foreground">
              {t('pages.clients.modals.callDialog.numberComment', 'Comment')}:
            </dt>
            <dd className="text-foreground">{context.contact_comment}</dd>
          </div>
        ) : null}
      </dl>

      {interactions.length > 0 && (
        <div className="flex flex-col gap-1">
          <span className="text-muted-foreground text-xs font-medium">
            {t('pages.clients.modals.callDialog.recentInteractions', 'Recent interactions')}
          </span>
          <ul className="flex flex-col gap-1">
            {interactions.map((interaction) => (
              <li
                key={interaction.id}
                className="text-foreground flex flex-wrap gap-2 text-xs sm:text-sm"
              >
                <span className="text-muted-foreground">
                  {interaction.interaction_date
                    ? new Date(interaction.interaction_date).toLocaleDateString()
                    : '—'}
                </span>
                <span className="font-medium">{interaction.type_name ?? '—'}</span>
                {interaction.result_name ? <span>· {interaction.result_name}</span> : null}
                {interaction.user_name ? (
                  <span className="text-muted-foreground">· {interaction.user_name}</span>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

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
        return 'bg-muted-foreground'
      default:
        return 'bg-muted-foreground'
    }
  }

  return (
    <div className="border-border bg-card rounded-lg border p-3 sm:p-4">
      <div className="flex flex-col items-start justify-between gap-2 sm:flex-row sm:items-center sm:gap-4">
        <div className="flex items-center gap-2 sm:gap-3">
          <div
            className={cn(
              'text-primary-foreground flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold sm:h-10 sm:w-10 sm:text-sm',
              getPriorityColor(loan.priority)
            )}
          >
            {loan.score}
          </div>
          <div className="flex flex-col">
            <div className="text-foreground text-xs font-medium sm:text-sm">
              {loan.clientName} - {t('pages.clients.detail.tableHeaders.loanNumber')} #
              {loan.loanNumber}
            </div>
          </div>
        </div>
        <button className="text-primary-700 text-xs font-medium sm:text-sm">
          {t('pages.clients.modals.callDialog.viewClient')} &gt;
        </button>
      </div>
      <div className="mt-2 grid grid-cols-1 gap-2 sm:mt-3 sm:grid-cols-2 sm:gap-3">
        <div className="flex flex-col gap-1">
          <span className="text-muted-foreground text-xs">
            {t('pages.clients.detail.tableHeaders.counterparty')}:
          </span>
          <span className="text-foreground text-sm font-medium">{loan.counterparty}</span>
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-muted-foreground text-xs">
            {t('pages.clients.detail.tableHeaders.saleDate')}:
          </span>
          <span className="text-foreground text-sm font-medium">{loan.saleDate}</span>
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-muted-foreground text-xs">
            {t('pages.clients.modals.callDialog.loanPrincipal')}:
          </span>
          <span className="text-foreground text-sm font-medium">
            {formatMoneyUAHTwoDecimals(loan.loanPrincipal)}
          </span>
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-muted-foreground text-xs">
            {t('pages.clients.modals.callDialog.lastContact')}:
          </span>
          <span className="text-foreground text-sm font-medium">{loan.lastContact}</span>
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-muted-foreground text-xs">
            {t('pages.clients.detail.tableHeaders.debt')}:
          </span>
          <span className="text-foreground text-sm font-medium">
            {formatMoneyUAHTwoDecimals(loan.debt)}
          </span>
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-muted-foreground text-xs">
            {t('pages.clients.detail.tableHeaders.status')}:
          </span>
          <span className="text-foreground text-sm font-medium">{loan.status}</span>
        </div>
      </div>
    </div>
  )
}

export default CallDialogModal
