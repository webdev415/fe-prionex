import { useTranslation } from 'react-i18next'
import { Icons } from '@/lib/icons'
import { HeaderKpiTile } from '../chrome/HeaderKpiTile'
import { MOCK_INTERACTIONS_KPIS } from '../../mocks/trainerWorkplaceMocks'

/**
 * KPI strip above the Interactions sub-tab (Action Analysis tab 1). Mirrors
 * Figma "Work Type" tiles in `ACTION ANALYSIS/css1.md`.
 */
export function InteractionsKpiStrip() {
  const { t } = useTranslation('common')
  const k = MOCK_INTERACTIONS_KPIS

  const tiles = [
    {
      key: 'interactions',
      label: t('pages.training.interactions.kpi.total', 'Interactions'),
      value: String(k.interactionsTotal),
      icon: Icons.Activity01,
      iconColor: 'text-[#204E4D]',
      iconBg: 'bg-white',
      accentColor: '#204E4D',
    },
    {
      key: 'promises',
      label: t('pages.training.interactions.kpi.promises', 'Promises'),
      value: String(k.promises),
      icon: Icons.TransactionHistory,
      iconColor: 'text-[#22C55E]',
      iconBg: 'bg-white',
      accentColor: '#22C55E',
    },
    {
      key: 'refusals',
      label: t('pages.training.interactions.kpi.refusals', 'Refusals'),
      value: String(k.refusals),
      icon: Icons.Close,
      iconColor: 'text-[#EF4444]',
      iconBg: 'bg-white',
      accentColor: '#EF4444',
    },
    {
      key: 'will-pass',
      label: t('pages.training.interactions.kpi.willPass', 'Will Pass'),
      value: String(k.willPass),
      icon: Icons.UserCheck01,
      iconColor: 'text-[#8B5CF6]',
      iconBg: 'bg-white',
      accentColor: '#8B5CF6',
    },
    {
      key: 'avg-duration',
      label: t('pages.training.interactions.kpi.avgDuration', 'Average duration'),
      value: k.averageDuration,
      icon: Icons.Clock01,
      iconColor: 'text-[#3B82F6]',
      iconBg: 'bg-white',
      accentColor: '#3B82F6',
    },
  ]

  return (
    <div className="flex flex-wrap gap-3">
      {tiles.map(({ key, ...tile }) => (
        <HeaderKpiTile key={key} {...tile} />
      ))}
    </div>
  )
}

export default InteractionsKpiStrip
