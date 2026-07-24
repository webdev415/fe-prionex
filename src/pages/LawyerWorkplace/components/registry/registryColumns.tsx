import type { TFunction } from 'i18next'
import { Link } from 'react-router-dom'
import type { Column } from '@/components/ui/DataTable'
import type { IncomingRegistryItem, OutgoingRegistryItem } from '@/features/lawyerWorkplace'
import { formatDateTime } from '@/lib/formatters'
import { Icons } from '@/lib/icons'
import { RegistryCategoryBadge } from './RegistryCategoryBadge'

const DASH = '—'

function dateCell(value: string | null | undefined, timezone?: string | null) {
  return (
    <span className="text-foreground text-xs whitespace-nowrap">
      {value ? formatDateTime(value, timezone) : DASH}
    </span>
  )
}

/**
 * Column config for the incoming correspondence registry (вхідний реєстр).
 * Order is fixed by the ТЗ: date · № · sender email · short summary (with the
 * category badge and, when present, the linked client).
 */
export function buildIncomingColumns(
  t: TFunction<'common'>,
  timezone?: string | null
): Column<IncomingRegistryItem>[] {
  return [
    {
      key: 'received_date',
      header: t('pages.lawyerWorkplace.registry.columns.receivedDate', 'Received date'),
      render: (row) => dateCell(row.received_date, timezone),
    },
    {
      key: 'number',
      header: t('pages.lawyerWorkplace.registry.columns.number', 'No.'),
      render: (row) => (
        <span className="text-muted-foreground text-xs font-medium">{row.number || DASH}</span>
      ),
    },
    {
      key: 'sender_email',
      header: t('pages.lawyerWorkplace.registry.columns.senderEmail', 'Sender email'),
      render: (row) => (
        <span className="text-foreground text-xs break-all">{row.sender_email || DASH}</span>
      ),
    },
    {
      key: 'summary',
      header: t('pages.lawyerWorkplace.registry.columns.summary', 'Summary'),
      render: (row) => (
        <div className="flex min-w-[200px] flex-col gap-1">
          <span className="text-foreground text-xs">{row.summary || DASH}</span>
          {(row.letter_type || row.client) && (
            <div className="flex flex-wrap items-center gap-1.5">
              {row.letter_type && <RegistryCategoryBadge letterType={row.letter_type} />}
              {row.client && (
                <Link
                  to={`/dashboard/clients/${row.client.id}`}
                  className="text-primary-600 text-[11px] font-medium hover:underline"
                >
                  {row.client.name}
                </Link>
              )}
            </div>
          )}
        </div>
      ),
    },
  ]
}

/**
 * Column config for the outgoing correspondence registry (вихідний реєстр).
 * Order is fixed by the ТЗ: request date · email (from → to) · category ·
 * client/institution · outgoing № · response date · responsible lawyer.
 */
export function buildOutgoingColumns(
  t: TFunction<'common'>,
  timezone?: string | null
): Column<OutgoingRegistryItem>[] {
  return [
    {
      key: 'request_received_at',
      header: t('pages.lawyerWorkplace.registry.columns.requestReceivedAt', 'Request received'),
      render: (row) => dateCell(row.request_received_at, timezone),
    },
    {
      key: 'email',
      header: t('pages.lawyerWorkplace.registry.columns.email', 'Email'),
      render: (row) => (
        <div className="flex min-w-[180px] items-center gap-1.5 text-xs">
          <span className="text-muted-foreground break-all">{row.sender_email || DASH}</span>
          <Icons.ArrowRight
            size={12}
            strokeWidth={1.5}
            className="text-muted-foreground shrink-0"
            aria-hidden="true"
          />
          <span className="text-foreground break-all">{row.recipient_email || DASH}</span>
        </div>
      ),
    },
    {
      key: 'category',
      header: t('pages.lawyerWorkplace.registry.columns.category', 'Category'),
      render: (row) =>
        row.letter_type ? (
          <RegistryCategoryBadge letterType={row.letter_type} />
        ) : (
          <span className="text-muted-foreground text-xs">{DASH}</span>
        ),
    },
    {
      key: 'party',
      header: t('pages.lawyerWorkplace.registry.columns.partyName', 'Full name / Institution'),
      render: (row) => (
        <span className="text-foreground text-xs">
          {row.client_name || row.institution_name || DASH}
        </span>
      ),
    },
    {
      key: 'number',
      header: t('pages.lawyerWorkplace.registry.columns.outgoingNumber', 'Outgoing No.'),
      render: (row) => (
        <span className="text-muted-foreground text-xs font-medium whitespace-nowrap">
          {row.number || DASH}
        </span>
      ),
    },
    {
      key: 'issued_date',
      header: t('pages.lawyerWorkplace.registry.columns.responseDate', 'Response date'),
      render: (row) => dateCell(row.issued_date, timezone),
    },
    {
      key: 'lawyer',
      header: t('pages.lawyerWorkplace.registry.columns.responsible', 'Responsible'),
      render: (row) => <span className="text-foreground text-xs">{row.lawyer?.name || DASH}</span>,
    },
  ]
}
