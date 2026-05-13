import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import type { TaskHistoryAnalyticsBucket } from '@/features/actionAnalysis'

interface Props {
  buckets: TaskHistoryAnalyticsBucket[]
  total: number
  isLoading?: boolean
}

const BAR_FILL = 'fill-primary-500'
const BAR_FILL_HOVER = 'hover:fill-primary-600'

/**
 * Tasks-due-by-date histogram. Inline SVG keeps the dependency surface
 * small and matches the lightweight chart style used elsewhere in
 * Action Analysis. (Activity heatmap uses inline SVG too.)
 */
export function TaskHistoryAnalytics({ buckets, total, isLoading }: Props) {
  const { t } = useTranslation('common')

  const max = useMemo(() => buckets.reduce((m, b) => (b.count > m ? b.count : m), 0), [buckets])

  const isEmpty = !isLoading && (buckets.length === 0 || max === 0)

  // Sizing: viewBox is unit-free so the chart scales to its parent width.
  // 24px per bar plus padding feels right for daily granularity.
  const BAR_W = 24
  const GAP = 6
  const CHART_H = 110
  const PAD_Y = 14
  const innerW = buckets.length * BAR_W + Math.max(0, buckets.length - 1) * GAP
  const viewW = Math.max(120, innerW)

  return (
    <div className="rounded-xl bg-white/50 p-4 shadow-sm sm:p-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-dark-500 text-sm font-medium sm:text-base">
            {t('pages.actionAnalysis.taskHistoryAnalytics.title', 'Tasks due by date')}
          </h2>
          <p className="mt-0.5 text-xs text-gray-500">
            {t(
              'pages.actionAnalysis.taskHistoryAnalytics.subtitle',
              'Total tasks due within the current filter range.'
            )}
          </p>
        </div>
        <div className="text-right">
          <div className="text-dark-500 text-2xl leading-none font-light">
            {isLoading ? '…' : total.toLocaleString()}
          </div>
          <div className="mt-1 text-[11px] tracking-wide text-gray-500 uppercase">
            {t('pages.actionAnalysis.taskHistoryAnalytics.totalLabel', 'tasks due')}
          </div>
        </div>
      </div>

      <div className="mt-4 w-full overflow-x-auto">
        {isEmpty ? (
          <div className="rounded-md border border-dashed border-gray-200 bg-gray-50 px-3 py-6 text-center text-xs text-gray-500">
            {t(
              'pages.actionAnalysis.taskHistoryAnalytics.empty',
              'No tasks due in the selected range.'
            )}
          </div>
        ) : (
          <svg
            viewBox={`0 0 ${viewW} ${CHART_H}`}
            preserveAspectRatio="xMinYMax meet"
            className="h-[110px] w-full min-w-[200px]"
            role="img"
            aria-label={t('pages.actionAnalysis.taskHistoryAnalytics.title', 'Tasks due by date')}
          >
            {buckets.map((b, i) => {
              const ratio = max > 0 ? b.count / max : 0
              const h = Math.max(2, ratio * (CHART_H - PAD_Y * 2))
              const x = i * (BAR_W + GAP)
              const y = CHART_H - PAD_Y - h
              return (
                <g key={`${b.date}-${i}`}>
                  <rect
                    x={x}
                    y={y}
                    width={BAR_W}
                    height={h}
                    rx={3}
                    className={`${BAR_FILL} ${BAR_FILL_HOVER} transition-colors`}
                  >
                    <title>{`${b.date}: ${b.count}`}</title>
                  </rect>
                  <text
                    x={x + BAR_W / 2}
                    y={y - 3}
                    textAnchor="middle"
                    className="fill-gray-600"
                    fontSize={9}
                  >
                    {b.count}
                  </text>
                  <text
                    x={x + BAR_W / 2}
                    y={CHART_H - 2}
                    textAnchor="middle"
                    className="fill-gray-500"
                    fontSize={8}
                  >
                    {b.date.slice(5)}
                  </text>
                </g>
              )
            })}
          </svg>
        )}
      </div>
    </div>
  )
}
