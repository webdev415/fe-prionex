/**
 * Очередь ручного разбора — раздел «Кредитный модуль».
 *
 * Ради чего экран существует: заявки, которые машина не решила сама, ждут
 * человека, и до этой страницы их не видел никто — метод клиента
 * (`creditApi.underwritingQueue`) был объявлен и не вызывался ни одним файлом,
 * ключ кэша `creditKeys.queue` не использовался ни одним `useQuery`. На стенде
 * в этом состоянии стоял 31 разбор.
 *
 * Главная колонка здесь — ПРИЧИНА разбора: очередь без оснований отвечает
 * «кто-то ждёт», но не отвечает «что от меня требуется», а именно за вторым
 * оператор сюда и приходит.
 *
 * ПОЧЕМУ ЗДЕСЬ НЕТ СОРТИРОВКИ И СТРАНИЦ (не забыты — их нет на сервере).
 * Ручка `GET /underwriting/queue` принимает единственный параметр `status`.
 * `limit`, `cursor` и `sort` в её сигнатуре отсутствуют и молча отбрасываются:
 * проверено живьём 31.08.2026 — `?limit=5`, `?cursor=abc`, `?sort=-referred_at`
 * и даже `?sort=bogus` дают 200 и все 31 строку, тогда как `/applications`
 * на `?sort=bogus` отвечает 422. Порядок задан в модуле жёстко
 * (`decided_at DESC, id DESC`), `next_cursor` захардкожен `null`, `total` не
 * приходит никогда.
 *
 * Значит, кликабельный заголовок отсортировал бы только загруженную страницу и
 * соврал бы оператору, попросившему «самых старых наверх», а `Pagination` при
 * `next_cursor: null` рисовал бы одну страницу из одной. Ни `sortable`, ни
 * `sortKey`, ни `Pagination` на этом экране появиться не должны, пока модуль
 * не научится сортировать и листать; за это держится
 * `CreditUnderwritingQueuePage.test.tsx`.
 *
 * Правило 28: данные берём только из API модуля.
 */
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { DataTable, type Column } from '@/components/ui/DataTable'
import { TableSkeleton } from '@/components/ui/TableSkeleton'
import { Alert } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'
import { useURLState } from '@/hooks/useURLState'
import { useCreditOverview, useCreditUnderwritingQueue } from '@/features/credit/hooks/useCredit'
import { formatCreditMoney } from '@/features/credit/api/money'
import { CREDIT_QUEUE_STATUSES } from '@/features/credit/api/enums'
import type { CreditQueueItem, CreditQueueStatus } from '@/features/credit/api/types'
import { CreditStatusBadge } from './components/CreditStatusBadge'
import { CreditModuleUnavailable } from './components/CreditModuleUnavailable'
import { formatDateTime } from '@/lib/formatters'
import { formatIdle, idleMinutes } from '@/features/credit/api/idle'
import { useNowTick } from '@/features/credit/hooks/useNowTick'

/**
 * Строка таблицы = строка контракта + `id`, которого требует DataTable.
 *
 * Ключ строим по `decision_id`, а не по `application_id`: очередь считается по
 * решениям, и два referred-решения по одной заявке дадут ДВЕ строки — модуль
 * этого не запрещает. На стенде дублей нет, но одинаковый ключ у двух строк
 * ломал бы список ровно в тот день, когда заявку отправят на разбор повторно.
 */
type QueueRow = CreditQueueItem & { id: string }

/** `''` в URL — «все статусы»: у ручки это отсутствие параметра, а не значение. */
function parseStatus(raw: string): CreditQueueStatus | undefined {
  return (CREDIT_QUEUE_STATUSES as readonly string[]).includes(raw)
    ? (raw as CreditQueueStatus)
    : undefined
}

export function CreditUnderwritingQueuePage() {
  const { t } = useTranslation('common')
  const navigate = useNavigate()

  // По умолчанию открываем `pending`: очередь — рабочий список того, что ждёт
  // решения СЕЙЧАС, а не архив разобранного. Состояние живёт в URL, чтобы
  // ссылку на «разобранные» можно было переслать коллеге.
  const [statusParam, setStatusParam] = useURLState<string>('status', 'pending')
  const status = parseStatus(statusParam)

  const { error: overviewError } = useCreditOverview()
  const { data, isLoading, error } = useCreditUnderwritingQueue(status)

  // Мемоизуем сам массив: `data?.items ?? []` создаёт новую ссылку на каждый
  // рендер и заставляет строки пересобираться вхолостую.
  const items = useMemo(() => data?.items ?? [], [data])

  const rows: QueueRow[] = useMemo(
    () =>
      items.map((row, index) => ({
        ...row,
        id: row.decision_id ?? `${row.application_id}:${index}`,
      })),
    [items]
  )

  // Тик минуты: очередь держат открытой весь день — без него «в очереди N»
  // замрёт на времени загрузки страницы.
  const now = useNowTick()

  const columns: Column<QueueRow>[] = [
    {
      key: 'application',
      header: t('credit.columns.application'),
      // Ручка отдаёт только UUID — ни номера заявки (`CA-000182`), ни почты
      // клиента в ответе нет (правка заказана в модуль, Б11). Показываем
      // начало идентификатора, полный — в подсказке: колонка из 36-символьных
      // UUID вытесняет с экрана всё остальное, а прочитать её всё равно нельзя.
      render: (row) => (
        <span className="font-mono text-xs" title={row.application_id}>
          {row.application_id.slice(0, 8)}…
        </span>
      ),
    },
    {
      key: 'status',
      header: t('credit.columns.status'),
      render: (row) => <CreditStatusBadge status={row.status} namespace="queueStatus" />,
    },
    {
      key: 'reasons',
      header: t('credit.columns.reasons'),
      render: (row) => {
        const reasons = row.review_reasons ?? []
        // Пустой список у модуля возможен НАМЕРЕННО: разбор объявлен, причины
        // не названы. Прочерк вместо строки — честный ответ; прятать такую
        // строку из очереди нельзя, её всё равно кто-то должен разобрать.
        if (!reasons.length) return <span className="text-muted-foreground">—</span>
        return (
          <span className="flex flex-wrap gap-1.5">
            {reasons.map((reason) => (
              <span
                key={reason}
                className="bg-muted text-muted-foreground inline-flex h-6 items-center rounded-full px-2.5 text-xs"
              >
                {/* Второй аргумент — фолбэк на сам код: перечень причин живёт
                    только в коде модуля, и незнакомое значение лучше показать
                    как есть, чем потерять. Полноту словаря стережёт
                    CREDIT_REVIEW_REASONS в i18nKeys.test.ts. */}
                {t(`credit.referralReason.${reason}`, reason)}
              </span>
            ))}
          </span>
        )
      },
    },
    {
      key: 'referred',
      header: t('credit.columns.referred'),
      render: (row) => (
        <span className="text-muted-foreground text-xs">{formatDateTime(row.referred_at)}</span>
      ),
    },
    {
      key: 'waiting',
      header: t('credit.columns.waiting'),
      render: (row) => {
        // Для `done` возраст посчитать НЕЛЬЗЯ: `resolved_at` в ответе нет, и
        // «в очереди 4 дн» у разобранной позиции означало бы «столько прошло с
        // направления», а прочитано было бы как «столько её не разбирали».
        if (row.status === 'done') return <span className="text-muted-foreground text-xs">—</span>
        const minutes = idleMinutes(row.referred_at, now)
        return (
          <span className="text-muted-foreground text-xs" title={formatDateTime(row.referred_at)}>
            {minutes === null ? '—' : formatIdle(minutes, t)}
          </span>
        )
      },
    },
    {
      key: 'requested',
      header: t('credit.columns.requested'),
      align: 'right',
      render: (row) => (
        <span className="tabular-nums">
          {formatCreditMoney(row.requested_amount_minor, row.currency)}
        </span>
      ),
    },
    {
      key: 'product',
      header: t('credit.columns.product'),
      render: (row) => row.product_code ?? '—',
    },
    {
      key: 'assigned',
      header: t('credit.columns.assigned'),
      // Колонку показываем всегда, хотя на стенде она пуста у всех 31 строки:
      // назначение — это ответ на «кто этим занимается», и его отсутствие тоже
      // ответ. Почему пусто, объяснено подписью над таблицей — пустая колонка
      // без объяснения читается как поломка. Разрешить id в ФИО пока нечем:
      // ручка отдаёт число, а справочника операторов у модуля до WS-20 нет.
      render: (row) =>
        row.assigned_to === null || row.assigned_to === undefined ? (
          <span className="text-muted-foreground">—</span>
        ) : (
          <span className="font-mono text-xs">#{row.assigned_to}</span>
        ),
    },
  ]

  // Сводка не ответила — модуля на этом стенде нет: строить список не из чего,
  // а текст Kong оператору ничего не объясняет. Тот же вход, что у соседних
  // экранов раздела.
  if (overviewError) return <CreditModuleUnavailable error={overviewError} />

  return (
    <div className="p-6">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-foreground text-xl font-semibold">{t('credit.queue.title')}</h1>
        {/* Считаем по `items.length`, а не по `total`: обёртка `CreditPage`
            обещает `total`, но эта ручка не отдаёт его НИКОГДА — на экране
            было бы «усього undefined». Список приходит целиком, так что длина
            и есть весь размер очереди. */}
        <span className="text-muted-foreground text-sm">
          {t('credit.queue.total', { count: items.length })}
        </span>
      </div>

      <div className="border-border bg-card mb-4 rounded-xl border p-4 shadow-sm">
        <div className="flex flex-wrap gap-2">
          {CREDIT_QUEUE_STATUSES.map((value) => {
            const active = status === value
            return (
              <button
                key={value}
                type="button"
                // Повторный клик по активной кнопке снимает фильтр: у ручки
                // «все» — это отсутствие параметра, отдельного значения нет.
                onClick={() => setStatusParam(active ? '' : value)}
                aria-pressed={active}
                className={`h-8 rounded-full border px-3.5 text-xs font-medium transition-colors ${
                  active
                    ? 'bg-secondary-800 border-secondary-800 text-white'
                    : 'border-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground'
                }`}
              >
                {t(`credit.queueStatus.${value}`, value)}
              </button>
            )
          })}
          <Button type="button" variant="ghost" onClick={() => setStatusParam('')}>
            {t('credit.actions.showAll')}
          </Button>
        </div>
        {/* Три вещи, которых у ручки нет. Без подписи каждая читается как
            поломка фронта: колонка «Призначено» пуста у всех, заявка названа
            обрубком UUID, а заголовки не откликаются на клик. */}
        <ul className="text-muted-foreground mt-3 space-y-1 text-xs">
          <li>{t('credit.queue.noNumberHint')}</li>
          <li>{t('credit.queue.noAssignmentHint')}</li>
          <li>{t('credit.queue.noSortingHint')}</li>
        </ul>
      </div>

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
          emptyMessage={t('credit.queue.empty')}
          onRowClick={(row) => navigate(`/dashboard/credit/applications/${row.application_id}`)}
        />
      )}
    </div>
  )
}

export default CreditUnderwritingQueuePage
