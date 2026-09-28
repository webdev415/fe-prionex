/**
 * Общие панели карточек раздела — рамка с заголовком и три состояния данных.
 *
 * Вынесены из карточки кредита переносом без правки: панели операций рельса
 * нужна та же рамка и те же три состояния, а импорт из страницы замкнул бы
 * страницу и компонент друг на друга. Копия рядом разошлась бы с оригиналом
 * при первой же правке одного из них.
 *
 * Здесь же — пилюля состояния операции рельса: её рисуют и панель выплаты, и
 * строка операции. Карта тонов не экспортируется: из `.tsx` правило
 * `react-refresh/only-export-components` пропускает только компоненты и
 * примитивные константы, а вторая копия карты разошлась бы с первой.
 */
import { useTranslation } from 'react-i18next'
import { Alert } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'
import { TableSkeleton } from '@/components/ui/TableSkeleton'
import type { CreditDisbursement } from '@/features/credit/api/types'

/** Тона выплаты — своим словарём, а не через `CreditStatusBadge`.
 *  Там `cancelled` уже занят статусом кредита и покрашен красным, а отозванная
 *  выплата — предупреждение: общий словарь дал бы одному слову два смысла. */
const DISBURSEMENT_TONE: Record<CreditDisbursement['state'], string> = {
  pending: 'bg-muted text-muted-foreground',
  settled: 'bg-success-100 text-success-700',
  failed: 'bg-error-100 text-error-700',
  reversed: 'bg-error-100 text-error-700',
  cancelled: 'bg-warning-100 text-warning-800',
  unknown: 'bg-error-100 text-error-700',
}

/** Пилюля состояния операции рельса. Текст приходит от вызывающего: у выплаты
 *  и у строки операции словари разные, а тон — один. */
export function CreditRailStateBadge({
  state,
  children,
}: {
  state: CreditDisbursement['state']
  children: React.ReactNode
}) {
  return (
    <span
      className={`inline-flex h-7 items-center gap-1.5 rounded-full px-3 text-xs font-medium ${DISBURSEMENT_TONE[state]}`}
    >
      <span className="h-2 w-2 rounded-full bg-current opacity-70" />
      {children}
    </span>
  )
}

export function Panel({
  title,
  children,
  footer,
}: {
  title: string
  children: React.ReactNode
  footer?: React.ReactNode
}) {
  return (
    <section className="border-border bg-card mb-4 rounded-xl border shadow-sm">
      <h2 className="border-border flex min-h-[49px] items-center border-b px-4 text-sm font-semibold">
        {title}
      </h2>
      <div className="p-4">{children}</div>
      {footer && (
        <div className="border-border text-muted-foreground border-t px-4 py-2 text-xs">
          {footer}
        </div>
      )}
    </section>
  )
}

/**
 * Загрузка / ошибка / пусто — три РАЗНЫХ состояния.
 * Смешивать ошибку с пустотой нельзя: это не «данных нет», это «мы не знаем».
 */
export function AsyncPanel({
  title,
  isLoading,
  error,
  isEmpty,
  emptyText,
  onRetry,
  children,
  footer,
}: {
  title: string
  isLoading: boolean
  error: unknown
  isEmpty: boolean
  emptyText: string
  onRetry: () => void
  children: React.ReactNode
  footer?: React.ReactNode
}) {
  const { t } = useTranslation('common')
  if (isLoading) {
    return (
      <Panel title={title}>
        <TableSkeleton columns={5} rows={4} />
      </Panel>
    )
  }
  if (error) {
    return (
      <Panel title={title}>
        <Alert variant="error" className="mb-3">
          {(error as Error).message || t('credit.card.loadFailed')}
        </Alert>
        <Button size="sm" variant="white-secondary" onClick={onRetry}>
          {t('credit.actions.retry')}
        </Button>
      </Panel>
    )
  }
  if (isEmpty) {
    return (
      <Panel title={title}>
        <p className="text-muted-foreground text-sm">{emptyText}</p>
      </Panel>
    )
  }
  return (
    <Panel title={title} footer={footer}>
      {children}
    </Panel>
  )
}
