import React from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { useCallStore } from '@/stores/callStore'
import { Icons } from '@/lib/icons'

function cn(...parts: Array<string | undefined | false>) {
  return parts.filter(Boolean).join(' ')
}

type CallData = {
  type: string
  clientName: string
  date: string
  time: string
  operator: string
  duration: string
  phone: string
  call_id?: string
}

type SMSData = {
  date: string
  time: string
  template: string
  operator: string
  status: string
  message: string
  phone: string
  sent_at?: string
  delivered_at?: string
}

type CallLogCardProps = {
  title?: string
  time?: string
  date?: string
  duration?: string
  status?: string
  message?: string
  template?: string
  operator?: string
  type?: string
  phone?: string
  line?: string
  className?: string
  clientName?: string
  icon?: React.ReactNode
  call_id?: string
  sent_at?: string
  delivered_at?: string
  setSelectedCallData?: React.Dispatch<React.SetStateAction<CallData | null>>
  setIsCallRecordingModalOpen?: (open: boolean) => void
  setSelectedSMSData?: React.Dispatch<React.SetStateAction<SMSData | null>>
  setIsViewSMSModalOpen?: (open: boolean) => void
}

/**
 * CallLogCard Component
 *
 * Displays call or SMS log cards in a clean grid layout matching the design:
 * - Call cards: Show direction, status, time, duration, and phone number
 * - SMS cards: Show status, message title, and message content
 *
 * Layout:
 * - Left: Icon in light grey square container
 * - Middle: Content (varies by type)
 * - Right: Date, Time, and Agent name (right-aligned)
 */
export function CallLogCard({
  title: _title, // Not used in new design - kept for backward compatibility
  time,
  date,
  duration,
  status,
  message,
  template,
  operator,
  type,
  phone,
  line,
  icon,
  clientName,
  className,
  call_id,
  sent_at,
  delivered_at,
  setSelectedCallData,
  setIsCallRecordingModalOpen,
  setSelectedSMSData,
  setIsViewSMSModalOpen,
}: CallLogCardProps) {
  const { t } = useTranslation('common')
  const { isCallActive, setOpenCallModal } = useCallStore()

  const getTranslatedStatus = (status: string) => {
    switch (status) {
      case 'Answered':
        return t('pages.clients.statuses.answered')
      case 'No Answer':
        return t('pages.clients.statuses.noAnswer')
      case 'Delivered':
        return t('pages.clients.statuses.delivered')
      case 'Failed':
        return t('pages.clients.statuses.failed')
      case 'Pending':
        return t('pages.clients.statuses.pending')
      default:
        return status
    }
  }

  const getTranslatedCallType = (callType: string) => {
    switch (callType) {
      case 'Incoming':
        return t('pages.clients.modals.callLogCard.callTypes.incoming')
      case 'Outgoing':
        return t('pages.clients.modals.callLogCard.callTypes.outgoing')
      default:
        return callType
    }
  }

  // Determine status dot color
  const getStatusDotColor = () => {
    if (status === 'Answered' || status === 'Delivered') {
      return 'bg-success-500'
    }
    if (status === 'No Answer' || status === 'Failed') {
      return 'bg-error-500'
    }
    return 'bg-gray-500'
  }
  const getStatusBorderColor = () => {
    if (status === 'Answered' || status === 'Delivered') {
      return 'bg-success-200'
    }
    if (status === 'No Answer' || status === 'Failed') {
      return 'bg-error-200'
    }
    return 'bg-gray-200'
  }

  // Get status text color
  const getStatusTextColor = () => {
    if (status === 'Answered' || status === 'Delivered') {
      return 'text-success-500'
    }
    if (status === 'No Answer' || status === 'Failed') {
      return 'text-error-500'
    }
    return 'text-gray-500'
  }

  // Handle card click
  const handleCardClick = () => {
    if (type) {
      // Call card clicked
      if (isCallActive()) {
        toast.warning(
          t('pages.clients.modals.callDialog.callInProgress') ||
            'Another call or recording is already in progress. Please finish or close it first.'
        )
        return
      }
      setSelectedCallData?.({
        type:
          type === 'Incoming'
            ? t('pages.clients.modals.callLogCard.callTypes.incomingCall')
            : getTranslatedCallType(type),
        clientName: clientName || '',
        date: date || '',
        time: time || '',
        operator: operator || '',
        duration: duration || '',
        phone: phone || '',
        call_id: call_id,
      })
      setOpenCallModal('call-recording')
      setIsCallRecordingModalOpen?.(true)
    } else {
      // SMS card clicked
      setSelectedSMSData?.({
        date: date || '',
        time: time || '',
        template: template || t('pages.clients.modals.sendSMS.customMessage') || 'Custom Message',
        operator: operator || '',
        status: status || '',
        message: message || '',
        phone: phone || '',
        sent_at: sent_at,
        delivered_at: delivered_at,
      })
      setIsViewSMSModalOpen?.(true)
    }
  }

  const isCall = !!type

  return (
    <button
      onClick={handleCardClick}
      className={cn(
        'group relative w-full cursor-pointer rounded-lg border border-[#E0E0E0] bg-white p-3 text-left transition-shadow hover:shadow-md md:p-4',
        className
      )}
    >
      <div className="flex h-full min-w-0 items-start gap-2 md:gap-4">
        {/* Left Section - Icon */}
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-[#F0F0F0] md:h-10 md:w-10">
          <div className="text-secondary-800/50 group-hover:text-secondary-800">{icon}</div>
        </div>

        {/* Middle Section - Content */}
        <div className="flex min-w-0 flex-1 flex-col gap-0.5 overflow-hidden md:gap-1">
          {isCall ? (
            /* Call Card Content */
            <>
              {/* Line 1: Direction + Status */}
              <div className="flex min-w-0 items-center gap-2">
                <span className="flex shrink-0 flex-row items-center gap-1 text-sm text-[#666666]">
                  <span>
                    {type === 'Incoming' ? (
                      <Icons.CallIncoming04
                        size={16}
                        className="text-secondary-800"
                        aria-hidden="true"
                        focusable="false"
                      />
                    ) : (
                      <Icons.CallOutgoing04
                        size={16}
                        className="text-secondary-800"
                        aria-hidden="true"
                        focusable="false"
                      />
                    )}
                  </span>
                  <span>{getTranslatedCallType(type || '')}</span>
                </span>
                <span
                  className={cn(
                    'flex h-3 w-3 shrink-0 items-center justify-center rounded-full',
                    getStatusBorderColor()
                  )}
                >
                  <span className={cn('h-1.5 w-1.5 rounded-full', getStatusDotColor())} />
                </span>
                <span className={cn('shrink-0 text-sm', getStatusTextColor())}>
                  {status ? getTranslatedStatus(status) : ''}
                </span>
              </div>

              {/* Line 2: Time + Duration */}
              <div className="flex min-w-0 items-center gap-2">
                <span className="shrink-0 text-sm font-bold text-[#333333]">{time}</span>
                <span className="shrink-0 text-sm text-[#666666]">
                  {duration ? `(${duration})` : ''}
                </span>
              </div>

              {/* Line 3: Phone Number */}
              <div className="truncate text-sm text-[#666666]">{phone}</div>

              {/* Line 4: Line Information */}
              {line && <div className="truncate text-sm text-[#666666]">{line}</div>}
            </>
          ) : (
            /* SMS Card Content */
            <>
              {/* Line 1: Status */}
              <div className="flex min-w-0 shrink-0 items-center gap-2">
                <span
                  className={cn(
                    'flex h-3 w-3 shrink-0 items-center justify-center rounded-full',
                    getStatusBorderColor()
                  )}
                >
                  <span className={cn('h-1.5 w-1.5 rounded-full', getStatusDotColor())} />
                </span>
                <span className={cn('shrink-0 text-sm', getStatusTextColor())}>
                  {status ? getTranslatedStatus(status) : ''}
                </span>
              </div>

              {/* Line 2: Message Title (Template) */}
              <div className="truncate text-sm font-bold text-[#333333]">
                {template || t('pages.clients.modals.sendSMS.customMessage') || 'Custom Message'}
              </div>

              {/* Line 3: Message Content */}
              <div className="line-clamp-2 overflow-hidden text-sm break-words text-[#666666]">
                {message}
              </div>
            </>
          )}
        </div>

        {/* Right Section - Metadata */}
        <div className="flex shrink-0 flex-col items-end gap-0.5 md:gap-1">
          {/* Date */}
          {date && (
            <div className="text-[10px] whitespace-nowrap text-[#888888] md:text-xs">{date}</div>
          )}

          {/* Time */}
          {time && (
            <div className="text-[10px] whitespace-nowrap text-[#888888] md:text-xs">{time}</div>
          )}

          {/* Agent/Operator Name */}
          {operator && (
            <div className="mt-auto text-[10px] font-medium whitespace-nowrap text-[#333333] md:text-xs">
              {operator}
            </div>
          )}
        </div>
      </div>
    </button>
  )
}
