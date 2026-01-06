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

import { useState, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { Modal, ModalHeader, ModalContent, ModalFooter } from '../../../components/ui/Modal'
import { Button } from '../../../components/ui/Button'
import { RadioGroup, RadioItem } from '../../../components/ui/Radio'
import { Icons } from '@/lib/icons'
import { cn } from '@/lib/utils'
import { useCallStore } from '@/stores/callStore'

export type CallState = 'initial' | 'dialing' | 'connected' | 'ended' | 'incoming'
export type CallType = 'white-line' | 'gray-line' | 'spam-calls'
export type CallStatus = 'answered' | 'missed' | 'rejected'

export interface CallDialogModalProps {
  open: boolean
  onClose: () => void
  clientName: string
  phoneNumber: string
  initialState?: CallState
  onCallStart?: (callType: CallType) => void
  onCallEnd?: (duration: number, status: CallStatus) => void
  onAnswer?: () => void
  onReject?: () => void
  onMinimize?: () => void
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

export function CallDialogModal({
  open,
  onClose,
  clientName,
  phoneNumber,
  initialState = 'initial',
  onCallStart,
  onCallEnd,
  onAnswer,
  onReject,
  onMinimize,
  loans = [],
}: CallDialogModalProps) {
  const { t } = useTranslation('common')
  const { setMinimizedCall, setOpenCallModal } = useCallStore()

  // Track modal open state
  useEffect(() => {
    if (open) {
      setOpenCallModal('call-dialog')
    } else {
      setOpenCallModal(null)
    }
  }, [open, setOpenCallModal])
  const [callState, setCallState] = useState<CallState>(initialState)
  const [callType, setCallType] = useState<CallType>('white-line')
  const [elapsedTime, setElapsedTime] = useState(0)
  const [isMuted, setIsMuted] = useState(false)
  const [isOnHold, setIsOnHold] = useState(false)
  const [autoCloseCountdown, setAutoCloseCountdown] = useState(3)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const countdownRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const dialingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Reset state when modal opens/closes
  useEffect(() => {
    if (open) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setCallState(initialState)
      setElapsedTime(0)
      setIsMuted(false)
      setIsOnHold(false)
      setAutoCloseCountdown(3)
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
  }, [open, initialState])

  // Auto-transition from dialing to connected (for testing/demo)
  useEffect(() => {
    if (callState === 'dialing' && open) {
      // Auto-connect after 3 seconds for demo purposes
      dialingTimeoutRef.current = setTimeout(() => {
        setCallState('connected')
        setElapsedTime(0) // Reset timer when connected
      }, 3000)
    } else {
      if (dialingTimeoutRef.current) {
        clearTimeout(dialingTimeoutRef.current)
        dialingTimeoutRef.current = null
      }
    }

    return () => {
      if (dialingTimeoutRef.current) {
        clearTimeout(dialingTimeoutRef.current)
      }
    }
  }, [callState, open])

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

  // Auto-close countdown for ended state
  useEffect(() => {
    if (callState === 'ended' && open) {
      countdownRef.current = setInterval(() => {
        setAutoCloseCountdown((prev) => {
          if (prev <= 1) {
            // Close modal when countdown reaches 0
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
            onClose()
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
  }, [callState, open, initialState, onClose])

  const handleCallNow = () => {
    if (onCallStart) {
      onCallStart(callType)
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
    if (onReject) {
      onReject()
    }
    if (onCallEnd) {
      onCallEnd(0, 'rejected')
    }
    handleClose()
  }

  const handleHangUp = () => {
    const status: CallStatus = callState === 'connected' ? 'answered' : 'missed'
    if (onCallEnd) {
      onCallEnd(elapsedTime, status)
    }
    setCallState('ended')
  }

  const handleMinimize = () => {
    setMinimizedCall({
      id: `call-dialog-${Date.now()}`,
      type: 'call-dialog',
      clientName,
      phoneNumber,
      callState,
      callType,
      elapsedTime,
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
    onClose()
  }

  // Incoming call popup (different layout)
  if (callState === 'incoming') {
    return (
      <Modal open={open} onClose={handleClose} maxWidth="xl" className="p-6">
        {/* Minimize Button */}
        <button
          onClick={handleMinimize}
          className="absolute top-4 right-12 flex h-8 w-8 items-center justify-center rounded-md transition-colors hover:bg-gray-100"
          aria-label="Minimize modal"
        >
          <Icons.Remove02 size={20} className="text-dark-500" strokeWidth={1.5} />
        </button>
        <div className="flex flex-col gap-6">
          {/* Call Info */}
          <div className="flex flex-col items-center gap-3">
            <div className="flex h-20 w-20 items-center justify-center rounded-full border-2 border-gray-300 bg-white">
              <Icons.Headset size={40} className="text-gray-700" strokeWidth={1.5} />
            </div>
            <div className="text-dark-500 text-center text-2xl font-semibold">{phoneNumber}</div>
            <div className="bg-primary-300 flex items-center gap-2 rounded-full px-4 py-1.5">
              <div className="bg-primary-500 h-2 w-2 rounded-full" />
              <span className="text-dark-500 text-sm font-medium">
                {t('pages.clients.modals.callDialog.incomingCall')}
              </span>
            </div>
          </div>

          {/* Loans Information */}
          {loans.length > 0 && (
            <div className="flex flex-col gap-4">
              {/* Primary loans */}
              {loans.filter((loan) => loan.priority === 'Critical').length > 0 && (
                <div className="flex flex-col gap-2">
                  <div className="flex items-center gap-2">
                    <span className="bg-error-500 rounded-full px-3 py-1 text-xs font-medium text-white">
                      {t('pages.clients.modals.callDialog.primary')}
                    </span>
                    <span className="text-dark-500 text-sm font-medium">
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
                  <div className="flex items-center gap-2">
                    <span className="bg-warning-500 rounded-full px-3 py-1 text-xs font-medium text-white">
                      {t('pages.clients.priorities.high')}
                    </span>
                    <span className="text-dark-500 text-sm font-medium">
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

              <button className="text-primary-300 flex items-center justify-center gap-1 text-sm font-medium">
                {t('pages.clients.modals.callDialog.viewAllLoans')} <Icons.ArrowDown size={16} />
              </button>
            </div>
          )}

          {/* Call Actions */}
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-2 rounded-lg bg-gray-100 px-4 py-2">
              <Icons.StopWatch size={16} className="text-gray-600" />
              <span className="text-sm text-gray-600">
                {t('pages.clients.modals.callDialog.ringing')} {formatTime(elapsedTime)}
              </span>
            </div>
            <div className="flex gap-3">
              <Button
                variant="danger"
                size="md"
                onClick={handleReject}
                className="bg-error-500 hover:bg-error-600 flex-1 text-white"
              >
                <Icons.Cancel01 size={20} className="mr-2" />
                {t('pages.clients.modals.callDialog.reject')}
              </Button>
              <Button
                variant="primary"
                size="md"
                onClick={handleAnswer}
                className="bg-primary-300 text-dark-500 hover:bg-primary-400 flex-1"
              >
                <Icons.HeadphoneMute size={20} className="mr-2" />
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
    <Modal open={open} onClose={handleClose} maxWidth="xl" className="p-10">
      {/* Minimize Button */}
      <button
        onClick={handleMinimize}
        className="absolute top-4 right-12 flex h-8 w-8 items-center justify-center rounded-md transition-colors hover:bg-gray-100"
        aria-label="Minimize modal"
      >
        <Icons.Remove02 size={20} className="text-dark-500" strokeWidth={1.5} />
      </button>
      <div className="flex flex-col gap-6">
        {/* Content based on state */}
        {callState === 'initial' && (
          <>
            <ModalHeader
              icon={
                <div className="bg-primary-300 flex h-12 w-12 items-center justify-center rounded-full">
                  <Icons.Headset size={24} className="text-dark-500" strokeWidth={1.5} />
                </div>
              }
              title={t('pages.clients.modals.callDialog.callClient')}
            />
            <ModalContent>
              <div className="flex flex-col gap-6">
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
                    value={phoneNumber}
                    readOnly
                    className="text-dark-500 focus:ring-primary-300/20 focus:border-primary-300 w-full rounded-lg border border-gray-400 bg-white px-3 py-2 text-sm font-light focus:ring-2 focus:outline-none"
                  />
                </div>

                {/* Call Type */}
                <div className="flex flex-col gap-2">
                  <label className="text-dark-500 text-sm font-light">
                    {t('pages.clients.modals.callDialog.callType')}:
                  </label>
                  <RadioGroup
                    value={callType}
                    onValueChange={(value) => setCallType(value as CallType)}
                    className="flex flex-row gap-3"
                  >
                    <label
                      className={cn(
                        'flex cursor-pointer items-center gap-2 rounded-lg border-2 px-4 py-2 transition-colors',
                        callType === 'white-line'
                          ? 'border-primary-300 bg-primary-100'
                          : 'border-gray-300 bg-white hover:border-gray-400'
                      )}
                    >
                      <RadioItem value="white-line" id="white-line" />
                      <span className="text-dark-500 text-sm font-light">
                        {t('pages.clients.modals.callDialog.whiteLine')}
                      </span>
                    </label>
                    <label
                      className={cn(
                        'flex cursor-pointer items-center gap-2 rounded-lg border-2 px-4 py-2 transition-colors',
                        callType === 'gray-line'
                          ? 'border-primary-300 bg-primary-100'
                          : 'border-gray-300 bg-white hover:border-gray-400'
                      )}
                    >
                      <RadioItem value="gray-line" id="gray-line" />
                      <span className="text-dark-500 text-sm font-light">
                        {t('pages.clients.modals.callDialog.grayLine')}
                      </span>
                    </label>
                    <label
                      className={cn(
                        'flex cursor-pointer items-center gap-2 rounded-lg border-2 px-4 py-2 transition-colors',
                        callType === 'spam-calls'
                          ? 'border-primary-300 bg-primary-100'
                          : 'border-gray-300 bg-white hover:border-gray-400'
                      )}
                    >
                      <RadioItem value="spam-calls" id="spam-calls" />
                      <span className="text-dark-500 text-sm font-light">
                        {t('pages.clients.modals.callDialog.spamCalls')}
                      </span>
                    </label>
                  </RadioGroup>
                </div>
              </div>
            </ModalContent>
            <ModalFooter>
              <Button variant="cancel" size="md" onClick={handleClose} className="flex-1">
                {t('actions.cancel')}
              </Button>
              <Button
                variant="primary"
                size="md"
                onClick={handleCallNow}
                className="flex-1"
                leftIcon={<Icons.Headset size={20} />}
              >
                {t('pages.clients.modals.callDialog.callNow')}
              </Button>
            </ModalFooter>
          </>
        )}

        {(callState === 'dialing' || callState === 'connected' || callState === 'ended') && (
          <>
            {/* Contact Info */}
            <div className="flex flex-col items-center gap-3">
              <div className="flex h-20 w-20 items-center justify-center rounded-full border-2 border-gray-300 bg-white">
                <Icons.Headset size={40} className="text-gray-700" strokeWidth={1.5} />
              </div>
              <div className="text-dark-500 text-center text-2xl font-semibold">{clientName}</div>
              <div
                className={cn(
                  'flex items-center gap-2 rounded-full px-4 py-1.5',
                  callState === 'dialing'
                    ? 'bg-primary-300'
                    : callState === 'connected'
                      ? 'bg-success-500'
                      : 'bg-gray-800'
                )}
              >
                <div
                  className={cn(
                    'h-2 w-2 rounded-full',
                    callState === 'dialing'
                      ? 'bg-primary-500'
                      : callState === 'connected'
                        ? 'bg-white'
                        : 'bg-white'
                  )}
                />
                <span
                  className={cn(
                    'text-sm font-medium',
                    callState === 'dialing' || callState === 'ended'
                      ? 'text-dark-500'
                      : 'text-white'
                  )}
                >
                  {callState === 'dialing'
                    ? t('pages.clients.modals.callDialog.calling')
                    : callState === 'connected'
                      ? t('pages.clients.modals.callDialog.connected')
                      : t('pages.clients.modals.callDialog.callEnded')}
                </span>
              </div>
              <div className="text-dark-500 text-sm">{phoneNumber}</div>
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
                </div>
                <div className="text-dark-500 mt-2 text-center text-sm">
                  {t('pages.clients.modals.callDialog.autoClosingIn')}{' '}
                  <span className="font-semibold">{autoCloseCountdown}</span>{' '}
                  {t('pages.clients.modals.callDialog.seconds')}...
                </div>
              </>
            )}

            {/* Action Buttons */}
            {callState !== 'ended' && (
              <div className="flex gap-3">
                <Button
                  variant={isMuted ? 'danger' : 'outline'}
                  size="md"
                  onClick={() => setIsMuted(!isMuted)}
                  className={cn(
                    'flex-1',
                    isMuted
                      ? 'bg-error-500 hover:bg-error-600 text-white'
                      : 'text-dark-500 border-gray-400 bg-white hover:bg-gray-50'
                  )}
                >
                  <Icons.HeadphoneMute size={20} className="mr-2" />
                  {t('pages.clients.modals.callDialog.mute')}
                </Button>
                <Button
                  variant="outline"
                  size="md"
                  onClick={() => setIsOnHold(!isOnHold)}
                  className={cn(
                    'text-dark-500 flex-1 border-gray-400 bg-white hover:bg-gray-50',
                    isOnHold && 'bg-gray-800 text-white'
                  )}
                >
                  <Icons.Pause size={20} className="mr-2" />
                  {t('pages.clients.modals.callDialog.hold')}
                </Button>
                <Button
                  variant="primary"
                  size="md"
                  onClick={handleHangUp}
                  className="bg-primary-300 text-dark-500 hover:bg-primary-400 flex-1"
                >
                  <Icons.Call02 size={20} className="mr-2" />
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
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('uk-UA', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
      useGrouping: true,
    })
      .format(amount)
      .replace(/,/g, ' ')
  }

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
    <div className="rounded-lg border border-gray-200 bg-white p-4">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div
            className={cn(
              'flex h-10 w-10 items-center justify-center rounded-full text-sm font-semibold text-white',
              getPriorityColor(loan.priority)
            )}
          >
            {loan.score}
          </div>
          <div className="flex flex-col">
            <div className="text-dark-500 text-sm font-medium">
              {loan.clientName} - {t('pages.clients.detail.tableHeaders.loanNumber')} #
              {loan.loanNumber}
            </div>
          </div>
        </div>
        <button className="text-primary-300 text-sm font-medium">
          {t('pages.clients.modals.callDialog.viewClient')} &gt;
        </button>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-3">
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
            ₴ {formatCurrency(loan.loanPrincipal)}
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
          <span className="text-dark-500 text-sm font-medium">₴ {formatCurrency(loan.debt)}</span>
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
