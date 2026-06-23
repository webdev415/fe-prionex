import { useTranslation } from 'react-i18next'
import { Icons } from '@/lib/icons'
import { AnalyticsKpiTile } from './AnalyticsKpiTile'

/**
 * KPI strip above the Interactions sub-tab (KAN-731 Block 1 — wired via
 * props from the parent `InteractionsSubTab`).
 *
 * Before the 2026-06-15 perf pass this component fetched
 * /api/v1/interactions independently with page_size=500 just to bucket
 * counts client-side. That doubled the HTTP call per render and pulled
 * 10× the data the table needed. The strip now consumes only the table's
 * `total` field (the one accurate summary value the BE returns today).
 * Per-result bucket counters render `—` until a dedicated
 * /interactions/summary aggregate endpoint ships — accurate but
 * incomplete is preferable to "first 500 rows bucketed locally".
 *
 * Layout (Figma): Interactions · Promises · Rejections · Missed Calls ·
 * Will Pass · Avg Gap.
 */

export interface InteractionsKpiStripProps {
  total: number
  isLoading: boolean
  isError: boolean
}

export function InteractionsKpiStrip({ total, isLoading, isError }: InteractionsKpiStripProps) {
  const { t } = useTranslation('common')

  // Headline `total` reflects the full filtered set (BE returns `total` in
  // the list response envelope alongside `items`). Bucket counters need a
  // dedicated aggregate endpoint — render `—` for now.
  const headline = isLoading ? '…' : isError ? '—' : String(total)
  const placeholder = '—'

  const tiles = [
    {
      key: 'interactions',
      label: t('pages.training.interactions.kpi.total', 'Interactions'),
      value: headline,
      icon: <Icons.Activity01 size={18} />,
      iconBg: 'bg-[#F7F7F7]',
      iconTone: 'text-[#05040D]',
    },
    {
      key: 'promises',
      label: t('pages.training.interactions.kpi.promises', 'Promises'),
      value: placeholder,
      icon: <Icons.TransactionHistory size={18} />,
      iconBg: 'bg-[#ECFDF5]',
      iconTone: 'text-[#047857]',
    },
    {
      key: 'rejections',
      label: t('pages.training.interactions.kpi.rejections', 'Rejections'),
      value: placeholder,
      icon: <Icons.Close size={18} />,
      iconBg: 'bg-[#FEF2F2]',
      iconTone: 'text-[#B91C1C]',
    },
    {
      key: 'missed-calls',
      label: t('pages.training.interactions.kpi.missedCalls', 'Missed Calls'),
      value: placeholder,
      icon: <Icons.CallEnd size={18} />,
      iconBg: 'bg-[#FFF7ED]',
      iconTone: 'text-[#C2410C]',
    },
    {
      key: 'will-pass',
      label: t('pages.training.interactions.kpi.willPass', 'Will Pass'),
      value: placeholder,
      icon: <Icons.UserCheck01 size={18} />,
      iconBg: 'bg-[#EFF6FF]',
      iconTone: 'text-[#1D4ED8]',
    },
    {
      // Average gap (between interactions) needs a dedicated aggregate
      // endpoint; the list response doesn't carry the right field.
      key: 'avg-gap',
      label: t('pages.training.interactions.kpi.avgGap', 'Average Gap'),
      value: placeholder,
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
