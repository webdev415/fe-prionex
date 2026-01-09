import React, { useId } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { useCallStore } from '@/stores/callStore'

function cn(...parts: Array<string | undefined | false>) {
  return parts.filter(Boolean).join(' ')
}

type SvgCardShapeProps = {
  className?: string
  fillColorClassName?: string
  strokeColorClassName?: string
}

function SvgCardShape({ className, fillColorClassName, strokeColorClassName }: SvgCardShapeProps) {
  const raw = useId()
  const uid = raw.replace(/[:]/g, '')
  const maskId = `path-1-outside-1_${uid}`

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 378 179"
      className={cn('block', className)}
      aria-hidden="true"
      focusable="false"
    >
      <mask
        id={maskId}
        maskUnits="userSpaceOnUse"
        x={0}
        y={0}
        width={378}
        height={179}
        style={{ fill: 'black' }}
      >
        <rect width={378} height={179} fill="white" />
        <path d="M240.347 1C250.288 1 258.347 9.05888 258.347 19V29C258.347 38.9411 266.406 47 276.347 47H359C368.941 47 377 55.0589 377 65V166C377 172.627 371.627 178 365 178H13C6.37258 178 1 172.627 1 166V13C1 6.37258 6.37258 1 13 1H240.347Z" />
      </mask>

      {/* Fill */}
      <path
        d="M240.347 1C250.288 1 258.347 9.05888 258.347 19V29C258.347 38.9411 266.406 47 276.347 47H359C368.941 47 377 55.0589 377 65V166C377 172.627 371.627 178 365 178H13C6.37258 178 1 172.627 1 166V13C1 6.37258 6.37258 1 13 1H240.347Z"
        className={cn('fill-white', fillColorClassName)}
      />

      {/* Outline */}
      <path
        d="M1 166H0H1ZM258.347 19H257.347V29H258.347H259.347V19H258.347ZM276.347 47V48H359V47V46H276.347V47ZM377 65H376V166H377H378V65H377ZM377 166H376C376 172.075 371.075 177 365 177V178V179C372.18 179 378 173.18 378 166H377ZM365 178V177H13V178V179H365V178ZM13 178V177C6.92487 177 2 172.075 2 166H1H0C0 173.18 5.8203 179 13 179V178ZM1 166H2V13H1H0V166H1ZM1 13H2C2 6.92487 6.92487 2 13 2V1V0C5.8203 0 0 5.8203 0 13H1ZM13 1V2H240.347V1V0H13V1ZM359 47V48C368.389 48 376 55.6112 376 65H377H378C378 54.5066 369.493 46 359 46V47ZM258.347 29H257.347C257.347 39.4934 265.853 48 276.347 48V47V46C266.958 46 259.347 38.3888 259.347 29H258.347ZM258.347 19H259.347C259.347 8.50659 250.84 0 240.347 0V1V2C249.736 2 257.347 9.61116 257.347 19H258.347Z"
        className={cn('fill-[#EDEDED]', strokeColorClassName)}
        mask={`url(#${maskId})`}
      />
    </svg>
  )
}

type CallData = {
  type: string
  clientName: string
  date: string
  time: string
  operator: string
  duration: string
  phone: string
}

type SMSData = {
  date: string
  time: string
  template: string
  operator: string
  status: string
  message: string
  phone: string
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
  setSelectedCallData?: React.Dispatch<React.SetStateAction<CallData | null>>
  setIsCallRecordingModalOpen?: (open: boolean) => void
  setSelectedSMSData?: React.Dispatch<React.SetStateAction<SMSData | null>>
  setIsViewSMSModalOpen?: (open: boolean) => void
}

/**
 * Responsive version:
 * - Use `aspect-[378/179]` so height scales with width
 * - Header becomes stacked on very small widths
 * - Body label/value stacks on mobile and becomes 2-column from `sm:`
 */
export function CallLogCard({
  title,
  time,
  date,
  duration,
  status,
  message,
  template,
  operator,
  type,
  line,
  phone,
  icon,
  clientName,
  className,
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
      case 'Incoming Call':
        return t('pages.clients.modals.callLogCard.callTypes.incomingCall')
      default:
        return callType
    }
  }

  return (
    <div
      className={cn(
        'relative aspect-[378/179] w-full',
        // Helpful defaults; override freely
        'max-w-[920px]',
        className
      )}
    >
      {/* Background shape */}
      <SvgCardShape className="absolute inset-0 h-full w-full" />

      {/* Content */}
      <div className="absolute inset-0">
        <div className="flex h-full w-full items-start gap-5 px-9 py-8">
          <div className="flex h-full flex-col gap-10">
            {/* Header */}
            <div className="flex flex-row items-center gap-14">
              {/* Time */}
              <div className="text-sm leading-[150%] font-medium tracking-[-0.28px] text-gray-700">
                {time}
              </div>

              {/* Title */}
              <button
                className="flex cursor-pointer items-start gap-2"
                onClick={() => {
                  if (type) {
                    // Check if there's an active call/recording
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
                    })
                    setOpenCallModal('call-recording')
                    setIsCallRecordingModalOpen?.(true)
                  } else {
                    setSelectedSMSData?.({
                      date: date || '',
                      time: time || '',
                      template:
                        template ||
                        t('pages.clients.modals.sendSMS.customMessage') ||
                        'Custom Message', // Show "Custom Message" if no template
                      operator: operator || 'Svitlana',
                      status: status || '',
                      message: message || 'Dear Ivan, this is a reminder about your loan payment.',
                      phone: phone || '',
                    })
                    setIsViewSMSModalOpen?.(true)
                  }
                }}
              >
                <div>{icon}</div>
                <div className="text-secondary-800 text-sm leading-[150%] font-medium tracking-[-0.28px]">
                  {title}
                </div>
              </button>
              {/* Status */}
              <div className="order-2 flex items-center justify-between gap-2">
                {/* On very small widths, align status to the right and keep title below */}
                <div className="absolute top-5 right-12 ml-auto flex items-center gap-2">
                  <span
                    className={cn(
                      'inline-flex h-5 w-5 items-center justify-center rounded-full',
                      status === 'Answered' || status === 'Delivered'
                        ? 'bg-success-100'
                        : status === 'No Answer' || status === 'Failed'
                          ? 'bg-error-100'
                          : 'bg-gray-100'
                    )}
                  >
                    <span
                      className={cn(
                        'h-3 w-3 rounded-full',
                        status === 'Answered' || status === 'Delivered'
                          ? 'bg-success-500'
                          : status === 'No Answer' || status === 'Failed'
                            ? 'bg-error-500'
                            : 'bg-gray-500'
                      )}
                    />
                  </span>
                  <div
                    className={cn(
                      'text-sm leading-[150%] font-medium tracking-[-0.28px]',
                      status === 'Answered' || status === 'Delivered'
                        ? 'text-success-500'
                        : status === 'No Answer' || status === 'Failed'
                          ? 'text-error-500'
                          : 'text-gray-500'
                    )}
                  >
                    {status ? getTranslatedStatus(status) : ''}
                  </div>
                </div>
              </div>
            </div>

            {/* Body for sms */}
            {!type && (
              <div className="flex flex-col items-start gap-4 self-stretch">
                <div className="flex items-start gap-6 self-stretch">
                  <div className="w-[70px] text-sm leading-[150%] font-light tracking-[-0.28px] text-gray-700">
                    {t('pages.clients.modals.callLogCard.message')}:
                  </div>
                  <div className="text-dark-500 line-clamp-2 flex-1 overflow-hidden text-sm leading-[150%] font-light tracking-[-0.28px]">
                    {message}
                  </div>
                </div>

                <div className="flex items-start gap-6 self-stretch">
                  <div className="w-[70px] text-sm leading-[150%] font-light tracking-[-0.28px] text-gray-700">
                    {t('pages.clients.modals.callLogCard.template')}:
                  </div>
                  <div className="text-dark-500 flex-1 text-sm leading-[150%] font-light tracking-[-0.28px]">
                    {template ||
                      t('pages.clients.modals.sendSMS.customMessage') ||
                      'Custom Message'}
                  </div>
                </div>

                <div className="flex items-start gap-6 self-stretch">
                  <div className="w-[70px] text-sm leading-[150%] font-light tracking-[-0.28px] text-gray-700">
                    {t('pages.clients.modals.callLogCard.operator')}:
                  </div>
                  <div className="text-dark-500 flex-1 text-sm leading-[150%] font-light tracking-[-0.28px]">
                    {operator}
                  </div>
                </div>
              </div>
            )}

            {/* Body for call */}
            {type && (
              <div className="flex flex-col items-start gap-4 self-stretch">
                <div className="flex items-start gap-6 self-stretch">
                  <div className="w-[70px] text-sm leading-[150%] font-light tracking-[-0.28px] text-gray-700">
                    {t('pages.clients.modals.callLogCard.type')}:
                  </div>
                  <div className="text-dark-500 flex-1 text-sm leading-[150%] font-light tracking-[-0.28px]">
                    {type ? getTranslatedCallType(type) : type}
                  </div>
                </div>

                <div className="flex items-start gap-6 self-stretch">
                  <div className="w-[70px] text-sm leading-[150%] font-light tracking-[-0.28px] text-gray-700">
                    {t('pages.clients.modals.callLogCard.operator')}:
                  </div>
                  <div className="text-dark-500 flex-1 text-sm leading-[150%] font-light tracking-[-0.28px]">
                    {operator}
                  </div>
                </div>

                <div className="flex items-start gap-6 self-stretch">
                  <div className="w-[70px] text-sm leading-[150%] font-light tracking-[-0.28px] text-gray-700">
                    {t('pages.clients.modals.callLogCard.phone')}:
                  </div>
                  <div className="text-dark-500 flex-1 text-sm leading-[150%] font-light tracking-[-0.28px]">
                    {phone}
                  </div>
                </div>

                <div className="flex items-start gap-6 self-stretch">
                  <div className="w-[70px] text-sm leading-[150%] font-light tracking-[-0.28px] text-gray-700">
                    {t('pages.clients.modals.callLogCard.line')}:
                  </div>
                  <div className="text-dark-500 flex-1 text-sm leading-[150%] font-light tracking-[-0.28px]">
                    {line}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
