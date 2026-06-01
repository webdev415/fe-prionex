import { useTranslation } from 'react-i18next'
import { MOCK_INTERACTIONS_KPIS } from '../../mocks/trainerWorkplaceMocks'

/**
 * KPI strip above the Interactions sub-tab (Action Analysis tab 1). Mirrors
 * the per-tab counter row in the Figma frame.
 */
export function InteractionsKpiStrip() {
  const { t } = useTranslation('common')
  const k = MOCK_INTERACTIONS_KPIS

  const tiles = [
    {
      key: 'interactions',
      label: t('pages.training.interactions.kpi.total', 'Interactions'),
      value: k.interactionsTotal,
      tone: 'text-dark-500',
    },
    {
      key: 'promises',
      label: t('pages.training.interactions.kpi.promises', 'Promises'),
      value: k.promises,
      tone: 'text-emerald-600',
    },
    {
      key: 'refusals',
      label: t('pages.training.interactions.kpi.refusals', 'Refusals'),
      value: k.refusals,
      tone: 'text-red-600',
    },
    {
      key: 'will-pass',
      label: t('pages.training.interactions.kpi.willPass', 'Will Pass'),
      value: k.willPass,
      tone: 'text-violet-600',
    },
    {
      key: 'avg-duration',
      label: t('pages.training.interactions.kpi.avgDuration', 'Average duration'),
      value: k.averageDuration,
      tone: 'text-blue-600',
    },
  ]

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
      {tiles.map((tile) => (
        <div
          key={tile.key}
          className="flex flex-col gap-1 rounded-2xl border border-gray-100 bg-white p-3 shadow-sm"
        >
          <span className="text-[10px] tracking-wide text-gray-500 uppercase">{tile.label}</span>
          <span className={`text-xl font-semibold ${tile.tone}`}>{tile.value}</span>
        </div>
      ))}
    </div>
  )
}

export default InteractionsKpiStrip
