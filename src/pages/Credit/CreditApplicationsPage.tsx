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
import { DataTable, type Column, type SortOrder } from '@/components/ui/DataTable'
import { TableSkeleton } from '@/components/ui/TableSkeleton'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { Alert } from '@/components/ui/Alert'
import { useURLState } from '@/hooks/useURLState'
import { Pagination } from '@/components/ui/Pagination'
import { sortConfigFromParam, sortParamFrom } from '@/features/credit/api/sorting'
import {
  CREDIT_PAGE_SIZE_OPTIONS,
  cursorForPage,
  parsePage,
  parsePageSize,
  totalPagesOf,
} from '@/features/credit/api/pagination'
import { useCreditApplications, useCreditOverview } from '@/features/credit/hooks/useCredit'
import { buildApplicationMetrics } from '@/features/credit/api/metrics'
import { formatCreditMoney } from '@/features/credit/api/money'
import {
  CREDIT_APPLICATION_STATUSES,
  type CreditApplicationStatus,
  type CreditApplicationSummary,
} from '@/features/credit/api/types'
import { CreditStatusBadge } from './components/CreditStatusBadge'
import { CreditMetricCards } from './components/CreditMetricCards'
import { CreditModuleUnavailable } from './components/CreditModuleUnavailable'
import { formatDateTime } from '@/lib/formatters'
import { formatIdle, idleMinutes } from '@/features/credit/api/idle'
import { useNowTick } from '@/features/credit/hooks/useNowTick'

/** Строка таблицы = строка контракта + `id`, которого требует DataTable. */
type ApplicationRow = CreditApplicationSummary & { id: string }

const formatMoney = formatCreditMoney

export function CreditApplicationsPage() {
  const { t } = useTranslation('common')
  const navigate = useNavigate()

  const [statusParam, setStatusParam] = useURLState<string>('status', '')
  const [query, setQuery] = useURLState<string>('q', '')
  const [searchDraft, setSearchDraft] = useState(query)
  // Страница и её размер живут в URL: ссылку на «третью страницу отказов»
  // можно переслать коллеге, как и любой другой фильтр раздела.
  const [pageParam, setPageParam] = useURLState<string>('page', '1')
  const [pageSizeParam, setPageSizeParam] = useURLState<string>('pageSize', '')
  const [sortParam, setSortParam] = useURLState<string>('sort', '')
  const page = parsePage(pageParam)
  const pageSize = parsePageSize(pageSizeParam)

  const statuses = useMemo(
    () =>
      statusParam
        ? (statusParam.split(',').filter(Boolean) as CreditApplicationStatus[])
        : ([] as CreditApplicationStatus[]),
    [statusParam]
  )

  const { data: overview, error: overviewError } = useCreditOverview()
  const {
    data: pageData,
    isLoading,
    error,
  } = useCreditApplications({
    status: statuses.length ? statuses : undefined,
    query: query || undefined,
    sort: sortParam || undefined,
    limit: pageSize,
    cursor: cursorForPage(page, pageSize),
  })

  // Мемоизуем сам массив: `page?.items ?? []` создаёт новую ссылку на каждый
  // рендер и заставляет метрики пересчитываться вхолостую.
  const items = useMemo(() => pageData?.items ?? [], [pageData])
  const page_total = pageData?.total
  const metrics = useMemo(
    () => buildApplicationMetrics(overview, items, statuses),
    [overview, items, statuses]
  )

  const toggleStatus = (status: string) => {
    const next = new Set(statuses as string[])
    if (next.has(status)) next.delete(status)
    else next.add(status)
    setStatusParam([...next].join(','))
    setPageParam('1')
  }

  // DataTable требует у строки поле `id` (на нём держится выделение и ключи).
  // У модуля идентификатор называется application_id — добавляем алиас, а не
  // переименовываем поле контракта.
  // Тик минуты: список держат открытым — без него простой замрёт.
  const now = useNowTick()

  const rows: ApplicationRow[] = useMemo(
    () => items.map((row) => ({ ...row, id: row.application_id })),
    [items]
  )

  // Колонку «Крок» показываем, только когда модуль реально отдаёт шаг:
  // столбец из одних прочерков хуже отсутствующего. Поле приезжает вместе с
  // лентой переходов (коммит модуля 452cc71) и на стенде пока не развёрнуто —
  // колонка включится сама, без правки кода, как только данные придут.
  const hasStep = rows.some((row) => Boolean(row.resume_step))
  // Время на шаге показываем отдельно от «останнього руху» и НЕ вместо него:
  // «клиент стоит здесь» и «строку не трогали» — разные факты, и оператор,
  // привыкший к первому, молча прочитал бы второе как первое.
  const hasStepTime = rows.some((row) => Boolean(row.step_entered_at))

  const columns: Column<ApplicationRow>[] = [
    {
      key: 'number',
      sortable: true,
      sortKey: 'number',
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
      sortable: true,
      sortKey: 'requested_amount_minor',
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
    ...(hasStep
      ? [
          {
            // Лекарство от очереди из неразличимых «Заповнюється»: статус
            // говорит, что заявка не дошла, шаг — где именно она встала.
            // Несортируемая осознанно: `step_entered_at` в сортировке модуля
            // нет (APPLICATION_SORT_FIELDS — created_at, updated_at,
            // requested_amount_minor), а сортировка на клиенте соврала бы
            // порядком в пределах страницы.
            key: 'step',
            header: t('credit.columns.step'),
            render: (row: ApplicationRow) =>
              row.resume_step ? (
                t(`credit.blocks.${row.resume_step}`, row.resume_step)
              ) : (
                <span className="text-muted-foreground">—</span>
              ),
          } as Column<ApplicationRow>,
        ]
      : []),
    ...(hasStepTime
      ? [
          {
            key: 'onStep',
            sortable: true,
            sortKey: 'step_entered_at',
            header: t('credit.columns.onStep'),
            render: (row: ApplicationRow) => {
              const minutes = idleMinutes(row.step_entered_at ?? undefined, now)
              if (minutes === null) return <span className="text-muted-foreground text-xs">—</span>
              // Подстановка времени создания — не измерение. Подписываем её
              // прямо в ячейке: без подписи «40 дн» читается как «клиент стоит
              // сорок дней», хотя правда — «ленты переходов тогда не было».
              const guessed = row.step_entered_at_source === 'created'
              return (
                <span className="text-muted-foreground text-xs">
                  {formatIdle(minutes, t)}
                  {guessed && <> ({t('credit.idle.sinceCreated')})</>}
                </span>
              )
            },
          } as Column<ApplicationRow>,
        ]
      : []),
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
      sortable: true,
      sortKey: 'created_at',
      header: t('credit.columns.created'),
      render: (row) => (
        <span className="text-muted-foreground text-xs">{formatDateTime(row.created_at)}</span>
      ),
    },
    {
      // «Кто висит дольше всех» — вопрос очереди, а не отдельной карточки.
      // Сортировка серверная: `updated_at` есть в APPLICATION_SORT_FIELDS
      // модуля, иначе колонка врала бы порядком в пределах страницы.
      key: 'idle',
      sortable: true,
      sortKey: 'updated_at',
      header: t('credit.columns.lastActivity'),
      render: (row) => {
        const minutes = idleMinutes(row.updated_at, now)
        return (
          <span className="text-muted-foreground text-xs" title={formatDateTime(row.updated_at)}>
            {minutes === null ? '—' : formatIdle(minutes, t)}
          </span>
        )
      },
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
        <h1 className="text-foreground text-xl font-semibold">{t('credit.applications.title')}</h1>
        <span className="text-muted-foreground text-sm">
          {t('credit.applications.total', { count: page_total ?? items.length })}
        </span>
      </div>

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
            setPageParam('1')
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
            emptyMessage={t('credit.applications.empty')}
            onRowClick={(row) => navigate(`/dashboard/credit/applications/${row.application_id}`)}
            sortConfig={sortConfigFromParam(sortParam || undefined)}
            onSort={(key: string, order: SortOrder) => {
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

export default CreditApplicationsPage
