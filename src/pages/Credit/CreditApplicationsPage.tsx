/**
 * Заявки кредитного модуля — список раздела «Кредитный модуль».
 *
 * Канон списков CRM: фильтры сверху → карточки метрик → DataTable →
 * Pagination. Состояние фильтров живёт в URL, чтобы ссылку на отфильтрованную
 * очередь можно было переслать коллеге.
 *
 * Данные — API кредитного модуля (`/api/v1/credit/*`). Прямых обращений в
 * credit_db нет и быть не может (правило 28).
 */
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { DataTable, type Column } from '@/components/ui/DataTable'
import { TableSkeleton } from '@/components/ui/TableSkeleton'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { Alert } from '@/components/ui/Alert'
import { useURLState } from '@/hooks/useURLState'
import { useCreditApplications, useCreditOverview } from '@/features/credit/hooks/useCredit'
import { buildApplicationMetrics } from '@/features/credit/api/metrics'
import {
  CREDIT_APPLICATION_STATUSES,
  type CreditApplicationStatus,
  type CreditApplicationSummary,
} from '@/features/credit/api/types'
import { CreditStatusBadge } from './components/CreditStatusBadge'
import { CreditMetricCards } from './components/CreditMetricCards'
import { CreditStandBanner } from './components/CreditStandBanner'
import { formatDateTime } from '@/lib/formatters'

const PAGE_SIZE = 25

/** Строка таблицы = строка контракта + `id`, которого требует DataTable. */
type ApplicationRow = CreditApplicationSummary & { id: string }

function formatMoney(minor: number | null | undefined, currency?: string): string {
  if (minor === null || minor === undefined) return '—'
  const value = (minor / 100).toLocaleString('ru-RU', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
  return currency ? `${value} ${currency}` : value
}

export function CreditApplicationsPage() {
  const { t } = useTranslation('common')
  const navigate = useNavigate()

  const [statusParam, setStatusParam] = useURLState<string>('status', '')
  const [query, setQuery] = useURLState<string>('q', '')
  const [searchDraft, setSearchDraft] = useState(query)

  const statuses = useMemo(
    () =>
      statusParam
        ? (statusParam.split(',').filter(Boolean) as CreditApplicationStatus[])
        : ([] as CreditApplicationStatus[]),
    [statusParam]
  )

  const { data: overview } = useCreditOverview()
  const {
    data: page,
    isLoading,
    error,
  } = useCreditApplications({
    status: statuses.length ? statuses : undefined,
    query: query || undefined,
    limit: PAGE_SIZE,
  })

  // Мемоизуем сам массив: `page?.items ?? []` создаёт новую ссылку на каждый
  // рендер и заставляет метрики пересчитываться вхолостую.
  const items = useMemo(() => page?.items ?? [], [page])
  const metrics = useMemo(
    () => buildApplicationMetrics(overview, items, statuses),
    [overview, items, statuses]
  )

  const toggleStatus = (status: string) => {
    const next = new Set(statuses as string[])
    if (next.has(status)) next.delete(status)
    else next.add(status)
    setStatusParam([...next].join(','))
  }

  // DataTable требует у строки поле `id` (на нём держится выделение и ключи).
  // У модуля идентификатор называется application_id — добавляем алиас, а не
  // переименовываем поле контракта.
  const rows: ApplicationRow[] = useMemo(
    () => items.map((row) => ({ ...row, id: row.application_id })),
    [items]
  )

  const columns: Column<ApplicationRow>[] = [
    {
      key: 'number',
      header: t('credit.columns.number'),
      render: (row) => <span className="font-mono text-xs">{row.number}</span>,
    },
    {
      key: 'status',
      header: t('credit.columns.status'),
      render: (row) => <CreditStatusBadge status={row.status} />,
    },
    {
      key: 'product',
      header: t('credit.columns.product'),
      render: (row) => row.product_code,
    },
    {
      key: 'requested',
      header: t('credit.columns.requested'),
      align: 'right',
      render: (row) => (
        <span className="tabular-nums">
          {formatMoney(row.requested_amount_minor, row.currency)}
        </span>
      ),
    },
    {
      key: 'client',
      header: t('credit.columns.client'),
      render: (row) => row.client_email ?? '—',
    },
    {
      key: 'decision',
      header: t('credit.columns.decision'),
      render: (row) =>
        row.decision_outcome ? (
          <span className="flex items-center gap-2">
            <CreditStatusBadge status={row.decision_outcome} />
            {row.decision_mode === 'manual' && (
              <span className="text-muted-foreground text-xs">{t('credit.decision.manual')}</span>
            )}
          </span>
        ) : (
          <span className="text-muted-foreground text-xs">{t('credit.decision.none')}</span>
        ),
    },
    {
      key: 'created',
      header: t('credit.columns.created'),
      render: (row) => (
        <span className="text-muted-foreground text-xs">{formatDateTime(row.created_at)}</span>
      ),
    },
  ]

  return (
    <div className="p-6">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-foreground text-xl font-semibold">{t('credit.applications.title')}</h1>
        <span className="text-muted-foreground text-sm">
          {t('credit.applications.total', { count: page?.total ?? items.length })}
        </span>
      </div>

      <CreditStandBanner overview={overview} />

      <div className="border-border bg-card mb-4 rounded-xl border p-4 shadow-sm">
        <div className="mb-3 flex flex-wrap gap-2">
          {CREDIT_APPLICATION_STATUSES.map((status) => {
            const active = statuses.includes(status)
            return (
              <button
                key={status}
                type="button"
                onClick={() => toggleStatus(status)}
                aria-pressed={active}
                className={`h-8 rounded-full border px-3.5 text-xs font-medium transition-colors ${
                  active
                    ? 'bg-secondary-800 border-secondary-800 text-white'
                    : 'border-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground'
                }`}
              >
                {t(`credit.status.${status}`, status)}
              </button>
            )
          })}
        </div>
        <form
          className="flex flex-wrap items-end gap-2"
          onSubmit={(event) => {
            event.preventDefault()
            setQuery(searchDraft.trim())
          }}
        >
          <div className="min-w-[260px] flex-1">
            <Input
              value={searchDraft}
              onChange={(event) => setSearchDraft(event.target.value)}
              placeholder={t('credit.applications.searchPlaceholder')}
            />
          </div>
          <Button type="submit" variant="white-secondary">
            {t('credit.actions.search')}
          </Button>
          <Button
            type="button"
            variant="ghost"
            onClick={() => {
              setSearchDraft('')
              setQuery('')
              setStatusParam('')
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

      {error && (
        <Alert variant="error" className="mb-4">
          {(error as Error).message}
        </Alert>
      )}

      {isLoading ? (
        <TableSkeleton columns={columns.length} rows={8} />
      ) : (
        <DataTable
          columns={columns}
          data={rows}
          emptyMessage={t('credit.applications.empty')}
          onRowClick={(row) => navigate(`/dashboard/credit/applications/${row.application_id}`)}
        />
      )}
    </div>
  )
}

export default CreditApplicationsPage
