/**
 * Client-wide write-off list (KAN-245).
 *
 * Renders ONE DataTable spanning every loan of the client, so the layout
 * matches the legacy "Writes-off" table style — operators can scan
 * entries across loans without paging through per-loan cards.
 *
 * Per-loan API: ``GET /api/v1/debts/{debtId}/writeoffs`` (one query per
 * loan, fanned out via useQueries). The two Active / Cancelled tabs
 * filter via the ``status`` query param; switching tabs invalidates the
 * relevant queries automatically.
 *
 * Per-row actions (Edit / Cancel) are permission-gated identically to
 * the per-loan DebtWriteoffSection — REQUIREMENTS §7.2 / §9.5.
 */

import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useQueries } from '@tanstack/react-query'

import { Button } from '@/components/ui/Button'
import { DataTable, type Column } from '@/components/ui/DataTable'
import { PERMISSIONS } from '@/constants/permissions'
import { useHasPermission } from '@/hooks/usePermissions'
import { Icons } from '@/lib/icons'
import { formatMoneyUAHTwoDecimals } from '@/lib/formatters'

import { writeoffsApi } from '@/features/writeoffs/api/writeoffsApi'
import type { WriteoffEntry } from '@/features/writeoffs/api/types'
import { writeoffKeys } from '@/features/writeoffs/hooks/useWriteoffs'

import { WriteoffCancelDialog } from './WriteoffCancelDialog'
import { WriteoffEditDialog } from './WriteoffEditDialog'

export interface ClientWriteoffsTableLoan {
  id: number
  loanNumber: string
  counterparty: string
  saleDate: string
}

export interface ClientWriteoffsTableProps {
  loans: ClientWriteoffsTableLoan[]
}

type Tab = 'active' | 'cancelled'

/** Row shape rendered in the table — entry + parent-loan metadata.
 *
 * Keeps the entry's numeric ``id`` as the DataTable key (entry ids come
 * from a single serial sequence in ``debt_writeoff_entries`` so they're
 * globally unique without compounding loan_id). The Cancel/Edit
 * dialogs receive this object directly; their ``entry.id`` is therefore
 * the integer the backend expects in the URL path.
 */
type Row = WriteoffEntry & {
  loanNumber: string
  counterparty: string
  saleDate: string
}

export function ClientWriteoffsTable({ loans }: ClientWriteoffsTableProps) {
  const { t, i18n } = useTranslation('common')
  const canCancel = useHasPermission(PERMISSIONS.WRITEOFFS.CANCEL)
  const canEdit = useHasPermission(PERMISSIONS.WRITEOFFS.EDIT)

  const [tab, setTab] = useState<Tab>('active')
  const [cancelTarget, setCancelTarget] = useState<WriteoffEntry | null>(null)
  const [editTarget, setEditTarget] = useState<WriteoffEntry | null>(null)

  // Fan out one query per loan, scoped by the current tab. Reuses the
  // same query keys as useWriteoffsForDebt so the create/edit/cancel
  // mutations' invalidations land here too.
  const queries = useQueries({
    queries: loans.map((loan) => ({
      queryKey: writeoffKeys.list(loan.id, { status: tab, page_size: 200 }),
      queryFn: () => writeoffsApi.listWriteoffsForDebt(loan.id, { status: tab, page_size: 200 }),
      enabled: !!loan.id,
      staleTime: 15_000,
    })),
  })

  // DataTable has no built-in `loading` prop; we render an inline
  // notice above the table while the per-loan queries are in flight so
  // the operator knows the empty state isn't real yet.
  const isLoading = queries.some((q) => q.isLoading)
  const hasError = queries.some((q) => q.error)

  const rows: Row[] = useMemo(() => {
    const out: Row[] = []
    loans.forEach((loan, idx) => {
      const items = queries[idx]?.data?.items ?? []
      items.forEach((entry) => {
        out.push({
          ...entry,
          loanNumber: loan.loanNumber,
          counterparty: loan.counterparty,
          saleDate: loan.saleDate,
        })
      })
    })
    // Newest first by created_at.
    out.sort((a, b) => (a.created_at < b.created_at ? 1 : -1))
    return out
  }, [loans, queries])

  const dateLocale = i18n.language === 'uk' ? 'uk-UA' : 'en-US'

  // Columns mirror the legacy ``writeOffColumns`` layout (loan / seller /
  // sale date / write-off date / amount / method / employee) plus an
  // Actions column for Edit/Cancel.
  const columns: Column<Row>[] = useMemo(() => {
    const base: Column<Row>[] = [
      {
        key: 'loanNumber',
        header: t('pages.clients.detail.tableHeaders.loanNumber'),
        align: 'left',
      },
      {
        key: 'counterparty',
        header: t('pages.clients.detail.tableHeaders.counterparty'),
        align: 'left',
      },
      {
        key: 'saleDate',
        header: t('pages.clients.detail.tableHeaders.saleDate'),
        align: 'left',
      },
      {
        key: 'writeOffDate',
        header: t('pages.clients.detail.tableHeaders.writeOffDate'),
        align: 'left',
        render: (r) =>
          r.status === 'cancelled' && r.cancelled_at
            ? new Date(r.cancelled_at).toLocaleDateString(dateLocale)
            : new Date(r.cancellation_date).toLocaleDateString(dateLocale),
      },
      {
        key: 'amount',
        header: t('pages.clients.detail.tableHeaders.amount'),
        align: 'right',
        render: (r) => formatMoneyUAHTwoDecimals(Number(r.amount)),
      },
      {
        key: 'writeOffMethod',
        header: t('pages.clients.detail.tableHeaders.writeOffMethod'),
        align: 'left',
        render: (r) => {
          const accrual = t(`pages.clients.detail.writeOffModal.components.${r.accrual_type}`)
          if (r.status === 'cancelled') {
            const src = t(
              `pages.clients.detail.writeOffSection.cancellationSource.${
                r.cancellation_source ?? 'manual'
              }`
            )
            return `${accrual} (${src})`
          }
          return accrual
        },
      },
      {
        key: 'employee',
        header: t('pages.clients.detail.tableHeaders.fixationOnEmployee'),
        align: 'left',
        render: (r) => r.created_by.name ?? `#${r.created_by.user_id}`,
      },
    ]

    // Actions column only when at least one per-row action is gated on.
    // Hidden for cancelled rows (terminal state — no Edit / no re-Cancel).
    if (canEdit || canCancel) {
      base.push({
        key: 'actions',
        header: '',
        align: 'right',
        render: (r) => {
          if (r.status !== 'active') return null
          return (
            <div className="flex justify-end gap-2">
              {canEdit && (
                <Button
                  variant="outline"
                  size="xs"
                  leftIcon={<Icons.PencilEdit02 size={14} strokeWidth={1.5} />}
                  onClick={(e) => {
                    e.stopPropagation()
                    setEditTarget(r)
                  }}
                >
                  {t('common.edit')}
                </Button>
              )}
              {canCancel && (
                <Button
                  variant="danger"
                  size="xs"
                  leftIcon={<Icons.Delete size={14} strokeWidth={2} />}
                  onClick={(e) => {
                    e.stopPropagation()
                    setCancelTarget(r)
                  }}
                >
                  {t('common.cancel')}
                </Button>
              )}
            </div>
          )
        },
      })
    }

    return base
  }, [t, dateLocale, canEdit, canCancel])

  return (
    <div className="flex w-full flex-col gap-3">
      {/* Active / Cancelled tabs */}
      <div className="flex gap-2">
        <button
          type="button"
          className={`rounded px-3 py-1 text-xs ${
            tab === 'active'
              ? 'bg-secondary-800 text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
          onClick={() => setTab('active')}
        >
          {t('pages.clients.detail.writeOffSection.tabActive')}
        </button>
        <button
          type="button"
          className={`rounded px-3 py-1 text-xs ${
            tab === 'cancelled'
              ? 'bg-secondary-800 text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
          onClick={() => setTab('cancelled')}
        >
          {t('pages.clients.detail.writeOffSection.tabCancelled')}
        </button>
      </div>

      {hasError && (
        <p className="text-error-500 text-sm">
          {t('pages.clients.detail.writeOffSection.loadError')}
        </p>
      )}

      {isLoading && <p className="text-sm text-gray-500">{t('common.loading')}</p>}
      <DataTable columns={columns} data={rows} className="w-full" />

      {cancelTarget && (
        <WriteoffCancelDialog
          open={!!cancelTarget}
          onClose={() => setCancelTarget(null)}
          entry={cancelTarget}
        />
      )}
      {editTarget && (
        <WriteoffEditDialog
          open={!!editTarget}
          onClose={() => setEditTarget(null)}
          entry={editTarget}
        />
      )}
    </div>
  )
}
