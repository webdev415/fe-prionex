/**
 * Карточки метрик над списками раздела — аналог PriorityCards у клиентов:
 * клик по карточке ставит фильтр, повторный клик снимает. Фильтр по карточке
 * включает страница, передав `onToggleStatus`; без него карточки только
 * показывают (у заявок статус переключают «таблетки» над списком).
 *
 * Сами метрики считает `features/credit/api/metrics.ts`; здесь только показ,
 * поэтому переход на серверные агрегаты (этап 2) этот файл не затронет.
 */
import { useTranslation } from 'react-i18next'
import type { CreditMetric } from '@/features/credit/api/metrics'

const TONE_CLASS: Record<string, string> = {
  default: 'text-foreground',
  ok: 'text-success-700',
  warn: 'text-warning-800',
  danger: 'text-error-700',
}

interface CreditMetricCardsProps {
  metrics: CreditMetric[]
  activeStatuses?: string[]
  onToggleStatus?: (status: string) => void
}

export function CreditMetricCards({
  metrics,
  activeStatuses,
  onToggleStatus,
}: CreditMetricCardsProps) {
  const { t } = useTranslation('common')
  if (!metrics.length) return null

  return (
    <div className="mb-4 flex flex-wrap gap-2">
      {metrics.map((metric) => {
        const clickable = Boolean(metric.status && onToggleStatus)
        const active = Boolean(metric.status && activeStatuses?.includes(metric.status))
        const content = (
          <>
            <span className="text-muted-foreground block text-xs">{t(metric.labelKey)}</span>
            <span
              className={`block text-xl font-semibold tabular-nums ${TONE_CLASS[metric.tone ?? 'default']}`}
            >
              {metric.value}
            </span>
          </>
        )
        const base =
          'border-border bg-card min-w-[128px] rounded-lg border px-4 py-2.5 text-left transition-colors'
        return clickable ? (
          <button
            key={metric.key}
            type="button"
            onClick={() => onToggleStatus?.(metric.status as string)}
            aria-pressed={active}
            className={`${base} hover:border-gray-400 hover:bg-gray-50 ${
              active ? 'border-secondary-800 ring-secondary-800/20 ring-2' : ''
            }`}
          >
            {content}
          </button>
        ) : (
          <div key={metric.key} className={base}>
            {content}
          </div>
        )
      })}
    </div>
  )
}

export default CreditMetricCards
