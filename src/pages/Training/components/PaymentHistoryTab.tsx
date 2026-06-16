import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useSearchParams } from 'react-router-dom'
import { useAuthStore } from '@/stores/authStore'
import { useOperators } from '@/features/users/hooks'
import { usePaymentMonitoring, type PaymentMonitoringSort } from '@/features/training'
import { Pagination } from '@/components/ui/Pagination'
import { TableSkeleton } from '@/components/ui/TableSkeleton'
import { defaultCustomDateRange } from '../lib/dateRange'
import {
  PAYMENT_HISTORY_FILTERS_DEFAULT,
  readPaymentHistoryUrlState,
  writePaymentHistoryUrlState,
  toPaymentMonitoringQuery,
  type PaymentHistoryBarState,
} from '../lib/paymentHistoryUrlState'
import { useScopedUserIds } from '../lib/scope'
import { PaymentHistoryFiltersBar } from './PaymentHistoryFiltersBar'
import { PaymentHistoryTable } from './PaymentHistoryTable'

function formatMoney(value: string | undefined): string {
  if (!value) return '0.00'
  const n = Number(value)
  if (!Number.isFinite(n)) return value
  return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export function PaymentHistoryTab() {
  const { t } = useTranslation('common')
  const [searchParams, setSearchParams] = useSearchParams()

  const activeProjectId = useAuthStore((s) => s.user?.active_project_id)
  const userTimezone = useAuthStore((s) => s.user?.timezone)
  const { data: operators = [] } = useOperators(activeProjectId ? Number(activeProjectId) : null)

  const barState = useMemo(() => readPaymentHistoryUrlState(searchParams), [searchParams])

  // Mirror Task History's custom-period bootstrap: when the URL says
  // `period=custom` without dates, fill them with the default window so the
  // DateRange picker doesn't render with blank inputs.
  useEffect(() => {
    if (searchParams.get('period') !== 'custom') return
    if (searchParams.get('from_date') && searchParams.get('to_date')) return
    const s = readPaymentHistoryUrlState(searchParams)
    const d = defaultCustomDateRange(userTimezone)
    setSearchParams(
      writePaymentHistoryUrlState(new URLSearchParams(searchParams), {
        ...s,
        customFromDate: d.from,
        customToDate: d.to,
      }),
      { replace: true }
    )
  }, [searchParams, setSearchParams, userTimezone])

  const scoped = useScopedUserIds(operators)

  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)

  const queryFilters = useMemo(
    () => toPaymentMonitoringQuery(barState, scoped.userIds, { page, limit: pageSize }),
    [barState, scoped.userIds, page, pageSize]
  )

  // Don't fire the request when the scope or refinement resolves to an empty
  // user-id list — the backend would 200 with 0 rows; we render the empty
  // state ourselves with a clearer "no matching scope" message.
  const isEmptyByScope =
    scoped.isEmptyResolution ||
    (queryFilters.user_ids != null && queryFilters.user_ids.length === 0)

  const queryEnabled =
    (barState.period !== 'custom' || !!(barState.customFromDate && barState.customToDate)) &&
    !isEmptyByScope

  const { data, error, isPending } = usePaymentMonitoring(queryFilters, queryEnabled)

  const handleApply = (next: PaymentHistoryBarState) => {
    let out: PaymentHistoryBarState = next
    if (next.period === 'custom' && (!next.customFromDate || !next.customToDate)) {
      const d = defaultCustomDateRange(userTimezone)
      out = {
        ...next,
        customFromDate: next.customFromDate || d.from,
        customToDate: next.customToDate || d.to,
      }
    }
    if (next.period !== 'custom') {
      out = { ...next, customFromDate: undefined, customToDate: undefined }
    }
    setSearchParams(writePaymentHistoryUrlState(new URLSearchParams(searchParams), out), {
      replace: true,
    })
    setPage(1)
  }

  const handleClear = () => {
    setSearchParams(
      writePaymentHistoryUrlState(
        new URLSearchParams(searchParams),
        PAYMENT_HISTORY_FILTERS_DEFAULT
      ),
      { replace: true }
    )
    setPage(1)
  }

  const handleSortChange = (sort: PaymentMonitoringSort) => {
    setSearchParams(
      writePaymentHistoryUrlState(new URLSearchParams(searchParams), {
        ...barState,
        sort,
      }),
      { replace: true }
    )
    setPage(1)
  }

  const items = isEmptyByScope ? [] : (data?.items ?? [])
  const total = isEmptyByScope ? 0 : (data?.total ?? 0)
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const summary = isEmptyByScope ? null : data?.summary

  return (
    <div className="flex flex-col gap-4">
      <PaymentHistoryFiltersBar
        value={barState}
        operators={operators}
        onApply={handleApply}
        onClear={handleClear}
        userTimezone={userTimezone}
        scope={scoped}
      />

      <div className="flex flex-wrap gap-4 text-sm text-gray-700">
        <span>
          <span className="font-medium">{summary?.total_payments ?? 0}</span>{' '}
          {t('pages.training.paymentHistorySummary.totalPayments', 'payments')}
        </span>
        <span>
          <span className="font-medium">{formatMoney(summary?.total_amount)}</span>{' '}
          {t('pages.training.paymentHistorySummary.totalAmount', 'total')}
        </span>
        <span>
          <span className="text-success-700 font-medium">
            {formatMoney(summary?.verified_amount)}
          </span>{' '}
          {t('pages.training.paymentHistorySummary.verified', 'confirmed')}
        </span>
        <span>
          <span className="font-medium text-gray-600">{formatMoney(summary?.pending_amount)}</span>{' '}
          {t('pages.training.paymentHistorySummary.pending', 'pending')}
        </span>
      </div>

      {isEmptyByScope ? (
        <div className="rounded-md border border-gray-200 bg-gray-50 p-3 text-sm text-gray-700">
          {t(
            'pages.training.errors.departmentNoOperators',
            'No operators in this department for the current project.'
          )}
        </div>
      ) : error ? (
        <div className="border-error-200 bg-error-50 text-error-700 rounded-md border p-3 text-sm">
          {t('pages.training.errors.loadPaymentHistoryFailed', 'Failed to load payment history')}
        </div>
      ) : (
        <>
          {queryEnabled && isPending ? (
            <TableSkeleton columns={10} rows={pageSize} className="w-full" />
          ) : (
            <PaymentHistoryTable
              data={items}
              userTimezone={userTimezone}
              sort={barState.sort}
              onSortChange={handleSortChange}
            />
          )}
          {total > pageSize && (
            <Pagination
              currentPage={page}
              totalPages={totalPages}
              pageSize={pageSize}
              onPageChange={setPage}
              onPageSizeChange={setPageSize}
            />
          )}
        </>
      )}
    </div>
  )
}

export default PaymentHistoryTab
