/**
 * Client-wide payment reversals (storno) table — KAN-334.
 *
 * Renders every reversal operation for the client (grouped across its five
 * charge-type rows). Columns per the ticket's "Table 2: Reversals":
 *   Reversal ID · Original Payment ID (link) · Credit ID · Client Full Name ·
 *   Operation Date · User · net amounts by type · Comment.
 *
 * Cross-linking: clicking the Original Payment ID calls ``onPaymentClick`` so
 * the parent can jump to that payment in the main Payments table.
 */

import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'

import { DataTable, type Column } from '@/components/ui/DataTable'
import { formatMoneyUAHTwoDecimals } from '@/lib/formatters'
import { useReversals } from '@/features/reversals/hooks/useReversals'
import type { Reversal } from '@/features/reversals/api/types'

export interface ClientReversalsTableProps {
  clientId: number
  /** This client's full name (the table is client-scoped). */
  clientFullName?: string
  /** Jump to the source payment in the main Payments table. */
  onPaymentClick?: (paymentId: number) => void
  /** Map a user id → display name (parent resolves from its operator lists). */
  resolveUserName?: (userId: number | null | undefined) => string
  /** Map a credit/debt id → its loan (contract) number, resolved by the parent. */
  resolveLoanNumber?: (creditId: number) => string | undefined
  /** Highlight the reversal whose source payment matches (cross-navigation). */
  highlightPaymentId?: number | null
  enabled?: boolean
}

type Row = Reversal & { id: string }

export function ClientReversalsTable({
  clientId,
  clientFullName,
  onPaymentClick,
  resolveUserName,
  resolveLoanNumber,
  highlightPaymentId = null,
  enabled = true,
}: ClientReversalsTableProps) {
  const { t, i18n } = useTranslation('common')
  const { data, isLoading, error } = useReversals({ client_id: clientId }, enabled)

  const dateLocale = i18n.language === 'uk' ? 'uk-UA' : 'en-US'

  const rows: Row[] = useMemo(
    () => (data?.items ?? []).map((r) => ({ ...r, id: r.reversal_group_id })),
    [data]
  )

  const columns: Column<Row>[] = useMemo(() => {
    const money = (v: string) => formatMoneyUAHTwoDecimals(Number(v))
    return [
      {
        key: 'reversalId',
        header: t('pages.clients.detail.reversalsTable.reversalId'),
        align: 'left',
        render: (r) => (
          <span title={r.reversal_group_id} className="font-mono text-xs">
            {r.reversal_group_id.slice(0, 8)}
          </span>
        ),
      },
      {
        key: 'originalPaymentId',
        header: t('pages.clients.detail.reversalsTable.originalPaymentId'),
        align: 'left',
        render: (r) =>
          onPaymentClick ? (
            <button
              type="button"
              className="text-foreground hover:underline"
              onClick={() => onPaymentClick(r.original_payment_id)}
            >
              {r.payment_number ?? `#${r.original_payment_id}`}
            </button>
          ) : (
            (r.payment_number ?? `#${r.original_payment_id}`)
          ),
      },
      {
        key: 'loanNumber',
        header: t('pages.clients.detail.tableHeaders.loanNumber'),
        align: 'left',
        render: (r) => resolveLoanNumber?.(r.credit_id) ?? String(r.credit_id),
      },
      {
        key: 'clientFullName',
        header: t('pages.clients.detail.reversalsTable.clientFullName'),
        align: 'left',
        obscured: true,
        render: (r) => r.client_full_name ?? clientFullName ?? '-',
      },
      {
        key: 'operationDate',
        header: t('pages.clients.detail.reversalsTable.operationDate'),
        align: 'left',
        render: (r) => new Date(r.reversal_date).toLocaleDateString(dateLocale),
      },
      {
        key: 'user',
        header: t('pages.clients.detail.reversalsTable.user'),
        align: 'left',
        obscured: true,
        render: (r) =>
          r.user_full_name ??
          resolveUserName?.(r.user_id) ??
          (r.user_id != null ? `#${r.user_id}` : '-'),
      },
      {
        key: 'principal',
        header: t('pages.clients.detail.reversalModal.components.principal'),
        align: 'right',
        render: (r) => money(r.principal),
      },
      {
        key: 'interest',
        header: t('pages.clients.detail.reversalModal.components.interest'),
        align: 'right',
        render: (r) => money(r.interest),
      },
      {
        key: 'fine',
        header: t('pages.clients.detail.reversalModal.components.fine'),
        align: 'right',
        render: (r) => money(r.fine),
      },
      {
        key: 'penalty',
        header: t('pages.clients.detail.reversalModal.components.penalty'),
        align: 'right',
        render: (r) => money(r.penalty),
      },
      {
        key: 'commission',
        header: t('pages.clients.detail.reversalModal.components.commission'),
        align: 'right',
        render: (r) => money(r.commission),
      },
      {
        key: 'comment',
        header: t('pages.clients.detail.reversalsTable.comment'),
        align: 'left',
        render: (r) => r.comment ?? '-',
      },
    ]
  }, [t, dateLocale, onPaymentClick, resolveUserName, resolveLoanNumber, clientFullName])

  return (
    <div className="flex w-full flex-col gap-3">
      {error && (
        <p className="text-error-500 text-sm">
          {t('pages.clients.detail.reversalsTable.loadError')}
        </p>
      )}
      {isLoading && <p className="text-muted-foreground text-sm">{t('common.loading')}</p>}
      <DataTable
        columns={columns}
        data={rows}
        className="w-full"
        emptyMessage={t('pages.clients.detail.reversalsTable.empty')}
        rowClassName={(row) =>
          highlightPaymentId != null && row.original_payment_id === highlightPaymentId
            ? 'bg-primary-100/60 ring-primary-300 ring-1'
            : undefined
        }
      />
    </div>
  )
}
