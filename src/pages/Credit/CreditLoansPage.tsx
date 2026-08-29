/**
 * Кредиты модуля — список раздела «Кредитный модуль».
 *
 * Балансы в строку списка НЕ тянем: точная цифра требует replay ядра на
 * каждый кредит. В таблице — паспортные поля и кэш просрочки, истина — в
 * карточке (`/loans/{id}/state`). Так же устроен и сам контракт.
 */
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { DataTable, type Column } from '@/components/ui/DataTable'
import { TableSkeleton } from '@/components/ui/TableSkeleton'
import { Button } from '@/components/ui/Button'
import { Alert } from '@/components/ui/Alert'
import { useURLState } from '@/hooks/useURLState'
import { Pagination } from '@/components/ui/Pagination'
import {
  CREDIT_PAGE_SIZE_OPTIONS,
  cursorForPage,
  parsePage,
  parsePageSize,
  totalPagesOf,
} from '@/features/credit/api/pagination'
import { useCreditLoans, useCreditOverview } from '@/features/credit/hooks/useCredit'
import { buildLoanMetrics } from '@/features/credit/api/metrics'
import type { CreditLoanStatus, CreditLoanSummary } from '@/features/credit/api/types'
import { CreditStatusBadge } from './components/CreditStatusBadge'
import { CreditMetricCards } from './components/CreditMetricCards'
import { CreditStandBanner } from './components/CreditStandBanner'
import { formatDate } from '@/lib/formatters'

/** Строка таблицы = строка контракта + `id`, которого требует DataTable. */
type LoanRow = CreditLoanSummary & { id: string }

function money(minor: number | null | undefined, currency?: string): string {
  if (minor === null || minor === undefined) return '—'
  const value = (minor / 100).toLocaleString('ru-RU', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
  return currency ? `${value} ${currency}` : value
}

export function CreditLoansPage() {
  const { t } = useTranslation('common')
  const navigate = useNavigate()
  const [statusParam, setStatusParam] = useURLState<string>('status', '')
  const [pageParam, setPageParam] = useURLState<string>('page', '1')
  const [pageSizeParam, setPageSizeParam] = useURLState<string>('pageSize', '')
  const page = parsePage(pageParam)
  const pageSize = parsePageSize(pageSizeParam)

  const statuses = useMemo(
    () =>
      statusParam
        ? (statusParam.split(',').filter(Boolean) as CreditLoanStatus[])
        : ([] as CreditLoanStatus[]),
    [statusParam]
  )

  const { data: overview } = useCreditOverview()
  const {
    data: pageData,
    isLoading,
    error,
  } = useCreditLoans({
    status: statuses.length ? statuses : undefined,
    limit: pageSize,
    cursor: cursorForPage(page, pageSize),
  })

  const items = useMemo(() => pageData?.items ?? [], [pageData])
  const page_total = pageData?.total
  const metrics = useMemo(() => buildLoanMetrics(overview, items), [overview, items])

  const toggleStatus = (status: string) => {
    const next = new Set(statuses as string[])
    if (next.has(status)) next.delete(status)
    else next.add(status)
    setStatusParam([...next].join(','))
    setPageParam('1')
  }

  // См. комментарий в CreditApplicationsPage: DataTable ключуется по `id`.
  const rows: LoanRow[] = useMemo(() => items.map((row) => ({ ...row, id: row.loan_id })), [items])

  const columns: Column<LoanRow>[] = [
    {
      key: 'contract',
      header: t('credit.columns.contract'),
      render: (row) => <span className="font-mono text-xs">{row.contract_number}</span>,
    },
    {
      key: 'status',
      header: t('credit.columns.status'),
      render: (row) => <CreditStatusBadge status={row.status} namespace="loanStatus" />,
    },
    {
      key: 'principal',
      header: t('credit.columns.principal'),
      align: 'right',
      render: (row) => (
        <span className="tabular-nums">{money(row.principal_minor, row.currency)}</span>
      ),
    },
    {
      key: 'payable',
      header: t('credit.columns.payable'),
      align: 'right',
      render: (row) => (
        <span className="tabular-nums">{money(row.total_payable_minor, row.currency)}</span>
      ),
    },
    {
      key: 'dpd',
      header: t('credit.columns.dpd'),
      align: 'right',
      render: (row) =>
        row.delinquency_days > 0 ? (
          <span className="bg-error-100 text-error-700 rounded-full px-2 py-0.5 text-xs font-medium">
            {row.delinquency_days}
          </span>
        ) : (
          <span className="text-muted-foreground text-xs">0</span>
        ),
    },
    {
      key: 'client',
      header: t('credit.columns.client'),
      render: (row) => row.client_email ?? '—',
    },
    {
      key: 'maturity',
      header: t('credit.columns.maturity'),
      render: (row) => (
        <span className="text-muted-foreground text-xs">{formatDate(row.maturity_date)}</span>
      ),
    },
  ]

  return (
    <div className="p-6">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-foreground text-xl font-semibold">{t('credit.loans.title')}</h1>
        <span className="text-muted-foreground text-sm">
          {t('credit.loans.total', { count: page_total ?? items.length })}
        </span>
      </div>

      <CreditStandBanner overview={overview} />

      <CreditMetricCards
        metrics={metrics}
        activeStatuses={statuses}
        onToggleStatus={toggleStatus}
      />

      {statuses.length > 0 && (
        <div className="mb-3">
          <Button size="sm" variant="ghost" onClick={() => setStatusParam('')}>
            {t('credit.actions.showAll')}
          </Button>
        </div>
      )}

      {error && (
        <Alert variant="error" className="mb-4">
          {(error as Error).message}
        </Alert>
      )}

      {isLoading ? (
        <TableSkeleton columns={columns.length} rows={8} />
      ) : (
        <>
          <DataTable
            columns={columns}
            data={rows}
            emptyMessage={t('credit.loans.empty')}
            onRowClick={(row) => navigate(`/dashboard/credit/loans/${row.loan_id}`)}
          />
          <div className="mt-4">
            <Pagination
              currentPage={page}
              totalPages={totalPagesOf(page_total, pageSize)}
              pageSize={pageSize}
              pageSizeOptions={CREDIT_PAGE_SIZE_OPTIONS}
              onPageChange={(next) => setPageParam(String(next))}
              onPageSizeChange={(size) => {
                setPageSizeParam(String(size))
                setPageParam('1')
              }}
            />
          </div>
        </>
      )}
    </div>
  )
}

export default CreditLoansPage
