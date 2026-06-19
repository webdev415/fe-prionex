import React from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { useCallStore } from '@/stores/callStore'
import { TelephonyTypeBadge } from '@/components/ui/TelephonyTypeBadge'
import { Icons } from '@/lib/icons'
import { classifyCallOutcome, OUTCOME_PALETTE_CLASSES } from '@/lib/callOutcome'

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
  direction?: string | null
  telephony_type?: string | null
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
  recording_path?: string | null
  sent_at?: string
  delivered_at?: string
  direction?: string | null
  telephony_type?: string | null
  setSelectedCallData?: React.Dispatch<React.SetStateAction<CallData | null>>
  setIsCallRecordingModalOpen?: (open: boolean) => void
  setSelectedSMSData?: React.Dispatch<React.SetStateAction<SMSData | null>>
  setIsViewSMSModalOpen?: (open: boolean) => void
  /** When set (and not a call card), click invokes this instead of the legacy SMS modal. */
  onSelect?: () => void
  /** e.g. "Client" / "Referrer" — shown with phone on message cards. */
  destinationOwnerLabel?: string
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
  recording_path,
  sent_at,
  delivered_at,
  direction,
  telephony_type,
  setSelectedCallData,
  setIsCallRecordingModalOpen,
  setSelectedSMSData,
  setIsViewSMSModalOpen,
  onSelect,
  destinationOwnerLabel,
}: CallLogCardProps) {
  const { t } = useTranslation('common')
  const { isCallActive, setOpenCallModal } = useCallStore()
  const isCall = !!type

  // KAN-490: outcome classification is centralised in @/lib/callOutcome.
  const outcomeRender = classifyCallOutcome(status)
  const palette = OUTCOME_PALETTE_CLASSES[outcomeRender.palette]
  const translatedStatus = outcomeRender.labelKey
    ? t(outcomeRender.labelKey, outcomeRender.fallback)
    : outcomeRender.fallback

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

  // Handle card click
  const handleCardClick = () => {
    if (type) {
      if (isCallActive()) {
        toast.warning(
          t('pages.clients.modals.callDialog.callInProgress') ||
            'Another call or recording is already in progress. Please finish or close it first.'
        )
        return
      }

      if (!recording_path) {
        toast.info(
          t('pages.clients.modals.callLogCard.noRecording') ||
            'No recording available for this call'
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
        direction: direction ?? (type === 'Incoming' ? 'inbound' : 'outbound'),
        telephony_type: telephony_type ?? null,
      })
      setOpenCallModal('call-recording')
      setIsCallRecordingModalOpen?.(true)
    } else if (onSelect) {
      onSelect()
    } else {
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

  return (
    <button
      onClick={handleCardClick}
      className={cn(
        'group relative w-full cursor-pointer rounded-lg border border-[#E0E0E0] bg-white p-3 text-left transition-shadow hover:shadow-md md:p-4',
        className
      )}
    >
      <div className="flex h-full min-w-0 items-start gap-2 md:gap-4">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-[#F0F0F0] md:h-10 md:w-10">
          <div className="text-secondary-800/50 group-hover:text-secondary-800">{icon}</div>
        </div>

        <div className="flex min-w-0 flex-1 flex-col gap-0.5 overflow-hidden md:gap-1">
          {isCall ? (
            <>
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
                    palette.ring
                  )}
                >
                  <span className={cn('h-1.5 w-1.5 rounded-full', palette.dot)} />
                </span>
                <span className={cn('shrink-0 text-sm', palette.text)}>
                  {status ? translatedStatus : ''}
                </span>
                <TelephonyTypeBadge
                  type={telephony_type}
                  direction={direction ?? (type === 'Incoming' ? 'inbound' : 'outbound')}
                />
              </div>

              <div className="flex min-w-0 items-center gap-2">
                <span className="shrink-0 text-sm font-bold text-[#333333]">{time}</span>
                <span className="shrink-0 text-sm text-[#666666]">
                  {duration ? `(${duration})` : ''}
                </span>
              </div>

              <div className="truncate text-sm text-[#666666]">{phone}</div>

              {line && <div className="truncate text-sm text-[#666666]">{line}</div>}
            </>
          ) : (
            <>
              <div className="flex min-w-0 shrink-0 items-center gap-2">
                <span
                  className={cn(
                    'flex h-3 w-3 shrink-0 items-center justify-center rounded-full',
                    palette.ring
                  )}
                >
                  <span className={cn('h-1.5 w-1.5 rounded-full', palette.dot)} />
                </span>
                <span className={cn('shrink-0 text-sm', palette.text)}>
                  {status ? translatedStatus : ''}
                </span>
              </div>

              <div className="truncate text-sm font-bold text-[#333333]">
                {template || t('pages.clients.modals.sendSMS.customMessage') || 'Custom Message'}
              </div>

              <div className="line-clamp-2 overflow-hidden text-sm break-words text-[#666666]">
                {message}
              </div>
              {phone && phone !== '-' && (
                <div className="truncate text-sm text-[#666666]">
                  {phone}
                  {destinationOwnerLabel ? (
                    <span className="text-[#888888]"> · {destinationOwnerLabel}</span>
                  ) : null}
                </div>
              )}
            </>
          )}
        </div>

        <div className="flex shrink-0 flex-col items-end gap-0.5 md:gap-1">
          {date && (
            <div className="text-[10px] whitespace-nowrap text-[#888888] md:text-xs">{date}</div>
          )}

          {time && (
            <div className="text-[10px] whitespace-nowrap text-[#888888] md:text-xs">{time}</div>
          )}

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
