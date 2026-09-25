/**
 * View SMS Modal Component
 *
 * Modal for viewing detailed SMS information.
 */

import { useTranslation } from 'react-i18next'
import { dateSeparator } from '@/lib/formatters'
import { Modal, ModalHeader, ModalContent, ModalFooter } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Icons } from '@/lib/icons'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/stores/authStore'

export interface ViewSMSModalProps {
  open: boolean
  onClose: () => void
  smsData: {
    date: string // UTC datetime string (ISO format) or date string
    time?: string // Optional time string (for backward compatibility)
    template: string
    operator: string
    status: string
    message: string
    phone: string
    sent_at?: string // UTC datetime string from API
    delivered_at?: string // UTC datetime string from API
  }
}

const formatDateTime = (
  utcDateTimeStr: string,
  userTimezone?: string,
  _t?: (key: string) => string
): string => {
  if (!utcDateTimeStr) return '—'

  try {
    const date = new Date(utcDateTimeStr)
    if (isNaN(date.getTime())) return utcDateTimeStr

    const parts = new Intl.DateTimeFormat('en-GB', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
      timeZone: userTimezone || undefined,
    }).formatToParts(date)

    const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '00'
    const sep = dateSeparator()
    return `${get('day')}${sep}${get('month')}${sep}${get('year')} ${get('hour')}:${get('minute')}:${get('second')}`
  } catch (error) {
    console.error('Error formatting datetime:', error, utcDateTimeStr)
    return utcDateTimeStr
  }
}

const calculateSMSParts = (message: string): number => {
  // Standard SMS: 160 characters for single-byte, 70 for multi-byte (Cyrillic)
  // For simplicity, assume Cyrillic if message contains Cyrillic characters
  const hasCyrillic = /[\u0400-\u04FF]/.test(message)
  const maxLength = hasCyrillic ? 70 : 120
  return Math.ceil(message.length / maxLength)
}

const getStatusColor = (status: string) => {
  switch (status) {
    case 'Delivered':
      return 'bg-success-100 text-success-700'
    case 'Failed':
      return 'bg-error-100 text-error-700'
    case 'Pending':
      return 'bg-warning-100 text-warning-700'
    default:
      return 'bg-muted text-foreground'
  }
}

export function ViewSMSModal({ open, onClose, smsData }: ViewSMSModalProps) {
  const { t } = useTranslation('common')
  const userTimezone = useAuthStore((state) => state.user?.timezone)

  // Use sent_at if available (UTC datetime), otherwise fallback to date+time
  const sentDateTimeStr =
    smsData.sent_at || (smsData.time ? `${smsData.date}T${smsData.time}` : smsData.date)
  const deliveredDateTimeStr = smsData.delivered_at || sentDateTimeStr

  const dateTime = formatDateTime(sentDateTimeStr, userTimezone, t)
  const deliveredDateTime = formatDateTime(deliveredDateTimeStr, userTimezone, t)
  const smsParts = calculateSMSParts(smsData.message)
  const hasCyrillic = /[\u0400-\u04FF]/.test(smsData.message)
  const maxChars = hasCyrillic ? 70 : 120
  const charCount = smsData.message.length

  return (
    <Modal open={open} onClose={onClose} maxWidth="xl" className="p-4 sm:p-6">
      <div className="flex flex-col gap-4 sm:gap-6">
        {/* Header */}
        <ModalHeader
          icon={
            <div className="bg-primary flex h-10 w-10 items-center justify-center rounded-full sm:h-12 sm:w-12">
              <Icons.ChatFeedback01
                size={20}
                className="text-primary-foreground sm:size-6"
                strokeWidth={1.5}
              />
            </div>
          }
          title={t('pages.clients.modals.viewSMS.title')}
        />

        {/* SMS Details */}
        <ModalContent>
          <div className="flex flex-col gap-3 sm:gap-4">
            {/* Date/Time, Phone, Template, Operator, Status */}
            <div className="flex flex-col items-start gap-2 self-stretch sm:gap-3">
              <div className="flex flex-col items-start gap-2 self-stretch sm:flex-row sm:gap-6">
                <span className="text-foreground w-full shrink-0 text-xs leading-[155%] font-light tracking-[-0.32px] sm:w-[120px] sm:text-base">
                  {t('pages.clients.modals.viewSMS.dateTime')}:
                </span>
                <span className="text-foreground flex-1 text-xs leading-[155%] font-medium tracking-[-0.32px] sm:text-base">
                  {dateTime}
                </span>
              </div>
              <div className="flex flex-col items-start gap-2 self-stretch sm:flex-row sm:gap-6">
                <span className="text-foreground w-full shrink-0 text-xs leading-[155%] font-light tracking-[-0.32px] sm:w-[120px] sm:text-base">
                  {t('pages.clients.modals.viewSMS.phone')}:
                </span>
                <span className="text-foreground flex-1 text-xs leading-[155%] font-medium tracking-[-0.32px] sm:text-base">
                  {smsData.phone || '-'}
                </span>
              </div>
              <div className="flex flex-col items-start gap-2 self-stretch sm:flex-row sm:gap-6">
                <span className="text-foreground w-full shrink-0 text-xs leading-[155%] font-light tracking-[-0.32px] sm:w-[120px] sm:text-base">
                  {t('pages.clients.modals.viewSMS.template')}:
                </span>
                <span className="text-foreground flex-1 text-xs leading-[155%] font-medium tracking-[-0.32px] sm:text-base">
                  {smsData.template}
                </span>
              </div>
              <div className="flex flex-col items-start gap-2 self-stretch sm:flex-row sm:gap-6">
                <span className="text-foreground w-full shrink-0 text-xs leading-[155%] font-light tracking-[-0.32px] sm:w-[120px] sm:text-base">
                  {t('pages.clients.modals.viewSMS.operator')}:
                </span>
                <span className="text-foreground flex-1 text-xs leading-[155%] font-medium tracking-[-0.32px] sm:text-base">
                  {smsData.operator}
                </span>
              </div>
              <div className="flex flex-col items-start gap-2 self-stretch sm:flex-row sm:gap-6">
                <span className="text-foreground w-full shrink-0 text-xs leading-[155%] font-light tracking-[-0.32px] sm:w-[120px] sm:text-base">
                  {t('pages.clients.modals.viewSMS.status')}:
                </span>
                <span
                  className={cn(
                    'flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium',
                    getStatusColor(smsData.status)
                  )}
                >
                  <span
                    className={cn(
                      'h-2 w-2 rounded-full',
                      smsData.status === 'Delivered'
                        ? 'bg-success-500'
                        : smsData.status === 'Failed'
                          ? 'bg-error-500'
                          : 'bg-warning-500'
                    )}
                  />
                  {(() => {
                    switch (smsData.status) {
                      case 'Delivered':
                        return t('pages.clients.statuses.delivered')
                      case 'Failed':
                        return t('pages.clients.statuses.failed')
                      case 'Pending':
                        return t('pages.clients.statuses.pending')
                      default:
                        return smsData.status
                    }
                  })()}
                </span>
              </div>
            </div>
            <div className="bg-muted flex h-px flex-col items-start gap-2.5 self-stretch p-0"></div>
            {/* Message Content */}
            <div className="flex flex-col gap-2">
              <label className="text-foreground text-xs font-light sm:text-sm">
                {t('pages.clients.modals.viewSMS.message')}:
              </label>
              <textarea
                readOnly
                value={smsData.message}
                className="text-foreground focus:ring-primary-300/20 focus:border-primary-300 border-border bg-card min-h-[80px] resize-none rounded-lg border px-3 py-2 text-xs font-light focus:ring-2 focus:outline-none sm:min-h-[100px] sm:text-sm"
              />
            </div>

            {/* Message Metrics */}
            <div className="border-border bg-muted flex flex-row justify-between rounded-lg border p-3 sm:p-4">
              <div className="flex items-center gap-2">
                <span className="bg-success-500 h-2 w-2 rounded-full" />
                <span className="text-foreground text-xs font-light sm:text-sm">
                  {charCount}/{maxChars} {t('pages.clients.modals.viewSMS.characters')}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Icons.File size={14} className="text-muted-foreground sm:size-4" />
                <span className="text-foreground text-xs font-light sm:text-sm">
                  {t('pages.clients.modals.viewSMS.script')}:{' '}
                  <span className="text-foreground font-semibold">
                    {hasCyrillic
                      ? t('pages.clients.modals.viewSMS.cyrillic')
                      : t('pages.clients.modals.viewSMS.latin')}
                  </span>
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Icons.Mail size={14} className="text-muted-foreground sm:size-4" />
                <span className="text-foreground text-xs font-light sm:text-sm">
                  {smsParts}{' '}
                  {smsParts !== 1
                    ? t('pages.clients.modals.viewSMS.smsParts')
                    : t('pages.clients.modals.viewSMS.smsPart')}
                </span>
              </div>
              {/* <div className="flex items-center gap-2">
                  <Icons.MoneyRemove01 size={14} className="text-muted-foreground sm:size-4" />
                  <span className="text-xs font-light text-foreground sm:text-sm">
                    {t('pages.clients.modals.viewSMS.cost')}:{' '}
                    <span className="text-foreground font-semibold">
                      {formatMoneyUAHTwoDecimals(cost)}
                    </span>
                  </span>
                </div> */}
            </div>

            {/* Delivery Timestamps */}
            <div className="flex flex-col items-start gap-2 self-stretch sm:flex-row sm:items-center sm:gap-3">
              <div className="flex w-full flex-1 items-center gap-2 sm:w-auto">
                <span className="text-foreground text-xs leading-[155%] font-light tracking-[-0.32px] sm:text-base">
                  {t('pages.clients.modals.viewSMS.sent')}:
                </span>
                <span className="text-foreground flex-1 text-xs leading-[150%] font-medium tracking-[-0.28px] sm:text-sm">
                  {dateTime}
                </span>
              </div>
              <div className="flex w-full flex-1 items-center gap-2 sm:w-auto">
                <span className="text-foreground text-xs leading-[155%] font-light tracking-[-0.32px] sm:text-base">
                  {t('pages.clients.modals.viewSMS.delivered')}:
                </span>
                <span className="text-foreground flex-1 text-xs leading-[150%] font-medium tracking-[-0.28px] sm:text-sm">
                  {deliveredDateTime}
                </span>
              </div>
            </div>
          </div>
        </ModalContent>

        {/* Footer */}
        <ModalFooter className="flex-col gap-2 sm:flex-row sm:gap-3">
          <Button variant="cancel" size="sm" onClick={onClose} className="w-full rounded-md">
            {t('actions.close')}
          </Button>
        </ModalFooter>
      </div>
    </Modal>
  )
}

export default ViewSMSModal
