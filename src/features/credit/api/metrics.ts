/**
 * Метрики разделов «Заявки» и «Кредиты».
 *
 * ЭТАП 1: считаются на фронте — из счётчиков `/admin/overview` и текущей
 * страницы списка. Это осознанный компромисс: агрегатов в контракте пока нет.
 *
 * ЭТАП 2: WS-05 заводит `getApplicationsSummary` / `getLoansSummary`, и тогда
 * заменяется ТОЛЬКО тело функций ниже — страницы их не заметят. Ради этого
 * агрегация вынесена сюда и нигде больше не дублируется.
 */
import type {
  CreditApplicationStatus,
  CreditApplicationSummary,
  CreditLoanSummary,
  CreditOverview,
} from './types'

export interface CreditMetric {
  /** Ключ метрики: статус (кликабельный фильтр) или сводный показатель. */
  key: string
  labelKey: string
  value: string
  /** Статус, который ставится в фильтр по клику; без него карточка не кликабельна. */
  status?: string
  tone?: 'default' | 'ok' | 'warn' | 'danger'
}

const STATUS_TONE: Record<string, CreditMetric['tone']> = {
  scoring: 'default',
  referred: 'warn',
  approved: 'ok',
  declined: 'danger',
  disbursed: 'ok',
  contracted: 'ok',
  in_progress: 'default',
  active: 'ok',
  delinquent: 'danger',
  closed: 'default',
  cancelled: 'danger',
}

function formatCount(value: number): string {
  return value.toLocaleString('ru-RU')
}

/** Сумма в major units без дробной части — для крупных агрегатов. */
export function formatMinorTotal(minor: number, currency?: string): string {
  const major = Math.round(minor / 100)
  return `${major.toLocaleString('ru-RU')}${currency ? ` ${currency}` : ''}`
}

/**
 * Карточки над списком заявок: сколько в каком статусе + деньги и конверсия
 * по загруженной странице.
 */
export function buildApplicationMetrics(
  overview: CreditOverview | undefined,
  page: CreditApplicationSummary[],
  visibleStatuses: CreditApplicationStatus[]
): CreditMetric[] {
  const counts = overview?.applications ?? {}
  const statuses = (
    visibleStatuses.length ? visibleStatuses : (overview?.application_statuses ?? [])
  ).filter((status) => (counts[status] ?? 0) > 0)

  const metrics: CreditMetric[] = statuses.map((status) => ({
    key: `status:${status}`,
    labelKey: `credit.status.${status}`,
    value: formatCount(counts[status] ?? 0),
    status,
    tone: STATUS_TONE[status] ?? 'default',
  }))

  if (page.length) {
    const currency = page[0]?.currency
    const requested = page.reduce((sum, row) => sum + (row.requested_amount_minor || 0), 0)
    const approved = page.reduce((sum, row) => sum + (row.final_amount_minor || 0), 0)
    metrics.push({
      key: 'sum:requested',
      labelKey: 'credit.metrics.requested',
      value: formatMinorTotal(requested, currency),
    })
    if (approved > 0) {
      metrics.push({
        key: 'sum:approved',
        labelKey: 'credit.metrics.approved',
        value: formatMinorTotal(approved, currency),
      })
    }
  }

  const decided = (counts.approved ?? 0) + (counts.declined ?? 0) + (counts.disbursed ?? 0)
  const issued = counts.disbursed ?? 0
  if (decided > 0) {
    metrics.push({
      key: 'rate:conversion',
      labelKey: 'credit.metrics.conversion',
      value: `${Math.round((issued / decided) * 100)}%`,
    })
  }
  return metrics
}

/** Карточки над списком кредитов: портфель и качество. */
export function buildLoanMetrics(
  overview: CreditOverview | undefined,
  page: CreditLoanSummary[]
): CreditMetric[] {
  const counts = overview?.loans ?? {}
  const metrics: CreditMetric[] = Object.entries(counts)
    .filter(([, value]) => value > 0)
    .map(([status, value]) => ({
      key: `status:${status}`,
      labelKey: `credit.loanStatus.${status}`,
      value: formatCount(value),
      status,
      tone: STATUS_TONE[status] ?? 'default',
    }))

  if (page.length) {
    const currency = page[0]?.currency
    const principal = page.reduce((sum, row) => sum + (row.principal_minor || 0), 0)
    const payable = page.reduce((sum, row) => sum + (row.total_payable_minor || 0), 0)
    const overdue = page.filter((row) => (row.delinquency_days || 0) > 0)
    metrics.push(
      {
        key: 'sum:principal',
        labelKey: 'credit.metrics.principal',
        value: formatMinorTotal(principal, currency),
      },
      {
        key: 'sum:payable',
        labelKey: 'credit.metrics.payable',
        value: formatMinorTotal(payable, currency),
      }
    )
    if (overdue.length) {
      const averageDpd = Math.round(
        overdue.reduce((sum, row) => sum + row.delinquency_days, 0) / overdue.length
      )
      metrics.push({
        key: 'avg:dpd',
        labelKey: 'credit.metrics.averageDpd',
        value: String(averageDpd),
        tone: 'danger',
      })
    }
  }
  return metrics
}
