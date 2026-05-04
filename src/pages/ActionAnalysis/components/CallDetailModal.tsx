import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { Modal, ModalContent, ModalFooter, ModalHeader } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Icons } from '@/lib/icons'
import { cn } from '@/lib/utils'
import { formatDateTime } from '@/lib/formatters'
import { formatUkrainePhoneForDisplay } from '@/lib/phone'
import type { CallMonitoringItem } from '@/features/actionAnalysis'

interface CallDetailModalProps {
  open: boolean
  onClose: () => void
  call: CallMonitoringItem | null
  /** Resolve agent_extension → full name (looked up from operators in the parent). */
  operatorName?: string
}

function formatDuration(seconds: number | null | undefined): string {
  if (seconds == null) return '—'
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

function isAnswered(c: CallMonitoringItem): boolean {
  return c.outcome === 'answered' || c.state === 'COMPLETED'
}

interface FieldRowProps {
  label: string
  children: React.ReactNode
}

function FieldRow({ label, children }: FieldRowProps) {
  return (
    <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-3">
      <span className="text-xs font-medium tracking-[-0.24px] text-gray-600 sm:w-[140px] sm:text-sm sm:tracking-[-0.28px]">
        {label}
      </span>
      <div className="text-dark-500 min-w-0 flex-1 text-sm">{children}</div>
    </div>
  )
}

export function CallDetailModal({ open, onClose, call, operatorName }: CallDetailModalProps) {
  const { t } = useTranslation('common')

  if (!call) return null

  const answered = isAnswered(call)
  const isInbound = call.direction === 'inbound'

  return (
    <Modal open={open} onClose={onClose} maxWidth="lg">
      <ModalHeader
        icon={<Icons.Headset size={24} className="text-dark-500" strokeWidth={1.5} />}
        title={t('pages.actionAnalysis.callDetail.title', 'Call details')}
      />
      <ModalContent>
        <div className="flex flex-col gap-3 sm:gap-4">
          <FieldRow label={t('pages.actionAnalysis.callDetail.fields.dateTime', 'Date / Time')}>
            {formatDateTime(call.initiated_at)}
          </FieldRow>

          <FieldRow label={t('pages.actionAnalysis.callDetail.fields.status', 'Status')}>
            <span
              className={cn(
                'inline-flex rounded-full px-2 py-0.5 text-xs font-medium',
                answered ? 'bg-success-50 text-success-700' : 'bg-gray-100 text-gray-700'
              )}
            >
              {answered
                ? t('pages.actionAnalysis.filters.statuses.answered', 'Answered')
                : t('pages.actionAnalysis.filters.statuses.notAnswered', 'Not answered')}
            </span>
          </FieldRow>

          <FieldRow label={t('pages.actionAnalysis.callDetail.fields.callType', 'Call type')}>
            <span className="inline-flex items-center gap-1.5">
              {isInbound ? (
                <Icons.CallIncoming04
                  size={16}
                  className="text-information-500"
                  strokeWidth={1.5}
                />
              ) : (
                <Icons.CallOutgoing04 size={16} className="text-secondary-500" strokeWidth={1.5} />
              )}
              {isInbound
                ? t('pages.actionAnalysis.callType.incoming', 'Incoming')
                : t('pages.actionAnalysis.callType.outgoing', 'Outgoing')}
            </span>
          </FieldRow>

          <FieldRow label={t('pages.actionAnalysis.callDetail.fields.employee', 'Employee')}>
            {operatorName ?? call.agent_extension}
          </FieldRow>

          <FieldRow label={t('pages.actionAnalysis.callDetail.fields.phone', 'Phone')}>
            {formatUkrainePhoneForDisplay(call.customer_number, call.customer_number)}
          </FieldRow>

          <FieldRow label={t('pages.actionAnalysis.callDetail.fields.duration', 'Duration')}>
            {formatDuration(call.talk_duration)}
          </FieldRow>

          {call.client_id != null && (
            <FieldRow label={t('pages.actionAnalysis.callDetail.fields.client', 'Client')}>
              <Link
                to={`/dashboard/clients/${call.client_id}`}
                className="text-primary-600 hover:underline"
                onClick={onClose}
              >
                #{call.client_id}
              </Link>
            </FieldRow>
          )}

          <FieldRow label={t('pages.actionAnalysis.callDetail.fields.callId', 'Call ID')}>
            <span className="font-mono text-xs break-all text-gray-600">{call.call_id}</span>
          </FieldRow>
        </div>
      </ModalContent>
      <ModalFooter>
        <Button variant="outline" onClick={onClose}>
          {t('actions.close', 'Close')}
        </Button>
      </ModalFooter>
    </Modal>
  )
}
