/**
 * Кредиты модуля — список раздела «Кредитный модуль».
 *
 * Балансы в строку списка НЕ тянем: точная цифра требует replay ядра на
 * каждый кредит. В таблице — паспортные поля и кэш просрочки, истина — в
 * карточке (`/loans/{id}/state`). Так же устроен и сам контракт.
 */
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { DataTable, type Column, type SortOrder } from '@/components/ui/DataTable'
import { TableSkeleton } from '@/components/ui/TableSkeleton'
import { Button } from '@/components/ui/Button'
import { Alert } from '@/components/ui/Alert'
import { useURLState } from '@/hooks/useURLState'
import { Pagination } from '@/components/ui/Pagination'
import { Input } from '@/components/ui/Input'
import { sortConfigFromParam, sortParamFrom } from '@/features/credit/api/sorting'
import {
  CREDIT_PAGE_SIZE_OPTIONS,
  cursorForPage,
  parsePage,
  parsePageSize,
  totalPagesOf,
} from '@/features/credit/api/pagination'
import { useCreditLoans, useCreditOverview } from '@/features/credit/hooks/useCredit'
import { buildLoanMetrics } from '@/features/credit/api/metrics'
import { formatCreditMoney } from '@/features/credit/api/money'
import type { CreditLoanStatus, CreditLoanSummary } from '@/features/credit/api/types'
import { CreditStatusBadge } from './components/CreditStatusBadge'
import { CreditMetricCards } from './components/CreditMetricCards'
import { CreditModuleUnavailable } from './components/CreditModuleUnavailable'
import { formatDate } from '@/lib/formatters'

/** Строка таблицы = строка контракта + `id`, которого требует DataTable. */
type LoanRow = CreditLoanSummary & { id: string }

const money = formatCreditMoney

export function CreditLoansPage() {
  const { t } = useTranslation('common')
  const navigate = useNavigate()
  const [statusParam, setStatusParam] = useURLState<string>('status', '')
  const [pageParam, setPageParam] = useURLState<string>('page', '1')
  const [pageSizeParam, setPageSizeParam] = useURLState<string>('pageSize', '')
  const [sortParam, setSortParam] = useURLState<string>('sort', '')
  const [queryParam, setQueryParam] = useURLState<string>('q', '')
  const [dpdParam, setDpdParam] = useURLState<string>('dpd', '')
  const [searchDraft, setSearchDraft] = useState(queryParam)
  const page = parsePage(pageParam)
  const pageSize = parsePageSize(pageSizeParam)

  const statuses = useMemo(
    () =>
      statusParam
        ? (statusParam.split(',').filter(Boolean) as CreditLoanStatus[])
        : ([] as CreditLoanStatus[]),
    [statusParam]
  )

  const { data: overview, error: overviewError } = useCreditOverview()
  const {
    data: pageData,
    isLoading,
    error,
  } = useCreditLoans({
    status: statuses.length ? statuses : undefined,
    query: queryParam || undefined,
    dpd_min: dpdParam ? Number(dpdParam) : undefined,
    sort: sortParam || undefined,
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
      sortable: true,
      sortKey: 'contract_number',
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
      sortable: true,
      sortKey: 'principal_minor',
      header: t('credit.columns.principal'),
      align: 'right',
      render: (row) => (
        <span className="tabular-nums">{money(row.principal_minor, row.currency)}</span>
      ),
    },
    {
      key: 'payable',
      sortable: true,
      sortKey: 'total_payable_minor',
      header: t('credit.columns.payable'),
      align: 'right',
      render: (row) => (
        <span className="tabular-nums">{money(row.total_payable_minor, row.currency)}</span>
      ),
    },
    {
      key: 'dpd',
      sortable: true,
      sortKey: 'delinquency_days',
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
      // Дата выдачи в списке не показывалась вовсе, хотя сервис по ней
      // сортирует (`LOAN_SORTABLE`): вопрос «какие кредиты выданы вчера» и
      // «самый старый непогашенный» решался открыванием карточек подряд.
      // Днями возраст здесь НЕ пишем: в списке нет среза `as_of`, от которого
      // он считается в карточке, и два разных отсчёта на двух экранах — это
      // разговор «у вас цифры не сходятся».
      key: 'disbursed',
      sortable: true,
      sortKey: 'disbursed_at',
      header: t('credit.columns.disbursed'),
      render: (row) => (
        <span className="text-muted-foreground text-xs">{formatDate(row.disbursed_at)}</span>
      ),
    },
    {
      key: 'maturity',
      sortable: true,
      sortKey: 'maturity_date',
      header: t('credit.columns.maturity'),
      render: (row) => (
        <span className="text-muted-foreground text-xs">{formatDate(row.maturity_date)}</span>
      ),
    },
  ]

  // Полноэкранная подмена — ТОЛЬКО когда показывать нечего. «Нечего» — это не
  // «запрос отказал», а «данных на экране нет»: у списка стоит
  // `placeholderData`, и прежний успешный ответ переживает упавший рефетч,
  // поэтому состояние «строки есть И ошибка есть» штатное. Подменить экран в
  // нём значило бы стереть видимые строки — ровно то, что правило запрещает.
  //
  // Сцена подмены: «модуля на стенде нет» (Kong 404), «пропуск не принят»
  // (401), «прав не хватило» (403). Её разбирает CreditModuleUnavailable по
  // статусу ошибки, и она сохраняется.
  //
  // Отказ ОДНОГО обзора страницу не трогает. Шапка при этом деградирует
  // частично: счётчики ПО СТАТУСАМ из сводки не строятся (`metrics.ts` берёт
  // их из `overview`, которого нет), а денежные карточки по загруженной
  // странице остаются — они посчитаны по своим строкам и к обзору отношения
  // не имеют. CreditMetricCards исчезает целиком только на пустом списке.
  if (overviewError && error && !pageData) return <CreditModuleUnavailable error={overviewError} />

  return (
    <div className="p-6">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-foreground text-xl font-semibold">{t('credit.loans.title')}</h1>
        <span className="text-muted-foreground text-sm">
          {t('credit.loans.total', { count: page_total ?? items.length })}
        </span>
      </div>

      <div className="border-border bg-card mb-4 rounded-xl border p-4 shadow-sm">
        <form
          className="flex flex-wrap items-end gap-2"
          onSubmit={(event) => {
            event.preventDefault()
            setQueryParam(searchDraft.trim())
            setPageParam('1')
          }}
        >
          <div className="min-w-[260px] flex-1">
            <Input
              value={searchDraft}
              onChange={(event) => setSearchDraft(event.target.value)}
              placeholder={t('credit.loans.searchPlaceholder')}
            />
          </div>
          <label className="text-muted-foreground flex flex-col gap-1.5 text-xs">
            {t('credit.filters.dpdFrom')}
            <select
              className="border-input-border bg-card text-foreground h-10 rounded-md border px-3 text-sm"
              value={dpdParam}
              onChange={(event) => {
                setDpdParam(event.target.value)
                setPageParam('1')
              }}
            >
              <option value="">{t('credit.filters.any')}</option>
              <option value="1">1+</option>
              <option value="8">8+</option>
              <option value="31">31+</option>
              <option value="61">61+</option>
              <option value="91">91+</option>
            </select>
          </label>
          <Button type="submit" variant="white-secondary">
            {t('credit.actions.search')}
          </Button>
          <Button
            type="button"
            variant="ghost"
            onClick={() => {
              setSearchDraft('')
              setQueryParam('')
              setDpdParam('')
              setStatusParam('')
              setSortParam('')
              setPageParam('1')
            }}
          >
            {t('credit.actions.reset')}
          </Button>
        </form>
      </div>

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
            sortConfig={sortConfigFromParam(sortParam || undefined)}
            onSort={(key: string, order: SortOrder) => {
              // Сортировка меняет ВЕСЬ набор, а не порядок на странице —
              // значит и страницу надо вернуть на первую.
              setSortParam(sortParamFrom(key, order))
              setPageParam('1')
            }}
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
