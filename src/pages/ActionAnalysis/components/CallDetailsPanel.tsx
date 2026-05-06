import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { Icons } from '@/lib/icons'
import { cn } from '@/lib/utils'
import { formatDateTime } from '@/lib/formatters'
import { formatUkrainePhoneForDisplay } from '@/lib/phone'

/**
 * Subset of fields the panel renders. Both `CallMonitoringItem` (table row)
 * and `CallDetailResponse` (deep-link single fetch) satisfy this shape — the
 * panel is intentionally permissive so a partially-loaded detail still
 * renders gracefully.
 */
export interface CallDetailLike {
  call_id: string
  agent_extension: string
  customer_number: string
  direction?: string | null
  state?: string | null
  outcome?: string | null
  initiated_at: string
  talk_duration?: number | null
  client_id?: number | null
}

interface Props {
  detail: CallDetailLike | null | undefined
  /** Resolve agent_extension → full name (looked up from operators in the parent). */
  operatorName?: string
  /** Optional close callback for the parent modal — passed to the client link's onClick. */
  onClientLinkClick?: () => void
  /** Default-collapsed; pass `true` to open by default. */
  defaultOpen?: boolean
}

function formatDuration(seconds: number | null | undefined): string {
  if (seconds == null) return '—'
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

function isAnswered(d: CallDetailLike): boolean {
  return d.outcome === 'answered' || d.state === 'COMPLETED'
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

export function CallDetailsPanel({
  detail,
  operatorName,
  onClientLinkClick,
  defaultOpen = false,
}: Props) {
  const { t } = useTranslation('common')
  const [open, setOpen] = useState(defaultOpen)

  if (!detail) return null

  const answered = isAnswered(detail)
  const isInbound = detail.direction === 'inbound'

  return (
    <div className="rounded-md border border-gray-200 bg-white">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-2 rounded-md px-3 py-2 text-left transition-colors hover:bg-gray-50 sm:px-4"
      >
        <span className="text-dark-500 text-sm font-medium">
          {t('pages.actionAnalysis.callDetail.title', 'Call details')}
        </span>
        <Icons.ArrowDown
          size={16}
          className={cn('text-gray-500 transition-transform', open && 'rotate-180')}
          strokeWidth={1.5}
        />
      </button>

      {open && (
        <div className="flex flex-col gap-3 border-t border-gray-100 px-3 py-3 sm:gap-4 sm:px-4">
          <FieldRow label={t('pages.actionAnalysis.callDetail.fields.dateTime', 'Date / Time')}>
            {formatDateTime(detail.initiated_at)}
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
            {operatorName ?? detail.agent_extension}
          </FieldRow>

          <FieldRow label={t('pages.actionAnalysis.callDetail.fields.phone', 'Phone')}>
            {formatUkrainePhoneForDisplay(detail.customer_number, detail.customer_number)}
          </FieldRow>

          <FieldRow label={t('pages.actionAnalysis.callDetail.fields.duration', 'Duration')}>
            {formatDuration(detail.talk_duration)}
          </FieldRow>

          {detail.client_id != null && (
            <FieldRow label={t('pages.actionAnalysis.callDetail.fields.client', 'Client')}>
              <Link
                to={`/dashboard/clients/${detail.client_id}`}
                className="text-primary-600 hover:underline"
                onClick={onClientLinkClick}
              >
                #{detail.client_id}
              </Link>
            </FieldRow>
          )}

          <FieldRow label={t('pages.actionAnalysis.callDetail.fields.callId', 'Call ID')}>
            <span className="font-mono text-xs break-all text-gray-600">{detail.call_id}</span>
          </FieldRow>
        </div>
      )}
    </div>
  )
}

export default CallDetailsPanel
