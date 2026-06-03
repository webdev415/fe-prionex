import { useTranslation } from 'react-i18next'
import { Icons } from '@/lib/icons'
import { MOCK_INTERACTIONS_KPIS } from '../../mocks/trainerWorkplaceMocks'
import { AnalyticsKpiTile } from './AnalyticsKpiTile'

/**
 * KPI strip above the Interactions sub-tab (Action Analysis Tab 1). Uses the
 * shared `AnalyticsKpiTile` with the horizontal icon-circle layout to match
 * the Figma frame:
 *   Interactions · Promises · Rejections · Missed Calls · Will Pass · Avg Gap
 */
export function InteractionsKpiStrip() {
  const { t } = useTranslation('common')
  const k = MOCK_INTERACTIONS_KPIS

  const tiles = [
    {
      key: 'interactions',
      label: t('pages.training.interactions.kpi.total', 'Interactions'),
      value: String(k.interactionsTotal),
      icon: <Icons.Activity01 size={18} />,
      iconBg: 'bg-[#F7F7F7]',
      iconTone: 'text-[#05040D]',
    },
    {
      key: 'promises',
      label: t('pages.training.interactions.kpi.promises', 'Promises'),
      value: String(k.promises),
      icon: <Icons.TransactionHistory size={18} />,
      iconBg: 'bg-[#ECFDF5]',
      iconTone: 'text-[#047857]',
    },
    {
      key: 'rejections',
      label: t('pages.training.interactions.kpi.rejections', 'Rejections'),
      value: String(k.refusals),
      icon: <Icons.Close size={18} />,
      iconBg: 'bg-[#FEF2F2]',
      iconTone: 'text-[#B91C1C]',
    },
    {
      key: 'missed-calls',
      label: t('pages.training.interactions.kpi.missedCalls', 'Missed Calls'),
      value: String(k.missedCalls),
      icon: <Icons.CallEnd size={18} />,
      iconBg: 'bg-[#FFF7ED]',
      iconTone: 'text-[#C2410C]',
    },
    {
      key: 'will-pass',
      label: t('pages.training.interactions.kpi.willPass', 'Will Pass'),
      value: String(k.willPass),
      icon: <Icons.UserCheck01 size={18} />,
      iconBg: 'bg-[#EFF6FF]',
      iconTone: 'text-[#1D4ED8]',
    },
    {
      key: 'avg-gap',
      label: t('pages.training.interactions.kpi.avgGap', 'Average Gap'),
      value: k.averageDuration,
      icon: <Icons.Clock01 size={18} />,
      iconBg: 'bg-[#F5F3FF]',
      iconTone: 'text-[#6D28D9]',
    },
  ]

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
      {tiles.map(({ key, ...tile }) => (
        <AnalyticsKpiTile key={key} {...tile} />
      ))}
    </div>
  )
}

export default InteractionsKpiStrip
