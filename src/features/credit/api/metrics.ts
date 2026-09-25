/**
 * Метрики разделов «Заявки» и «Кредиты».
 *
 * СЕГОДНЯ: считаются на фронте — из счётчиков `/admin/overview` и текущей
 * страницы списка. Это осознанный компромисс: агрегатов в контракте пока нет.
 *
 * ДАЛЬШЕ: WS-05 заводит `getApplicationsSummary` / `getLoansSummary`, и тогда
 * заменяется ТОЛЬКО тело функций ниже — страницы их не заметят. Ради этого
 * агрегация вынесена сюда и нигде больше не дублируется.
 */
import { formatCreditCount, formatCreditMinorTotal } from './money'
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
  return formatCreditCount(value)
}

/** Сумма в major units без дробной части — для крупных агрегатов. */
export function formatMinorTotal(minor: number, currency?: string): string {
  return formatCreditMinorTotal(minor, currency)
}

/**
 * Счёт «таблетки» статуса над списком заявок — из сводки модуля.
 *
 * Сводки нет (грузится или отказала) — числа нет вовсе: неизвестное не
 * выдаётся за ноль. Какие статусы сводка считает, говорит она сама
 * (`application_statuses`): статус вне этого перечня сводкой не агрегируется,
 * и его ноль был бы выдумкой — числа нет так же, как без сводки. Статус из
 * перечня без ключа в счётчиках — это ноль в проекте (`group by` модуля), и
 * ноль показывается.
 */
export function applicationStatusCount(
  overview: CreditOverview | undefined,
  status: CreditApplicationStatus
): string | null {
  if (!overview) return null
  if (!overview.application_statuses.includes(status)) return null
  return formatCount(overview.applications[status] ?? 0)
}

/**
 * Карточки над списком заявок: деньги по загруженной странице и конверсия.
 * Счёт статусов — `applicationStatusCount`, в «таблетках» фильтра: карточка
 * статуса была вторым рядом того же фильтра.
 */
export function buildApplicationMetrics(
  overview: CreditOverview | undefined,
  page: CreditApplicationSummary[]
): CreditMetric[] {
  const counts = overview?.applications ?? {}
  const metrics: CreditMetric[] = []

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
