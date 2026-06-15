import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Icons } from '@/lib/icons'
import { useAuthStore } from '@/stores/authStore'
import { useInteractionMonitoring } from '@/features/training/hooks/useInteractionMonitoring'
import type {
  InteractionMonitoringFilters,
  InteractionMonitoringItem,
} from '@/features/training/types'
import { AnalyticsKpiTile } from './AnalyticsKpiTile'

/**
 * KPI strip above the Interactions sub-tab (KAN-731 Block 1 — wired to the
 * same /api/v1/interactions endpoint the sub-tab consumes, using a wider
 * page_size for the count breakdown).
 *
 * Layout matches the Figma frame: Interactions · Promises · Rejections ·
 * Missed Calls · Will Pass · Avg Gap. `total` drives the headline count;
 * per-result counters bucket the page sample by keyword (en/uk/ru aliases).
 * Avg Gap requires a dedicated aggregate endpoint and renders `—` for now.
 */

const COUNTER_KEYWORDS = {
  promises: ['promise', 'обіцянк', 'обещание', 'pay'],
  refusals: ['refus', 'відмов', 'отказ'],
  missed: ['missed', 'no answer', 'no_answer', 'пропущ', 'без відпов', 'без ответа'],
  willPass: ['will pass', 'will_pass', 'передаст', 'передасть'],
} as const

type CounterKey = keyof typeof COUNTER_KEYWORDS

function bucket(items: InteractionMonitoringItem[]): Record<CounterKey, number> {
  const counts: Record<CounterKey, number> = {
    promises: 0,
    refusals: 0,
    missed: 0,
    willPass: 0,
  }
  for (const item of items) {
    const name = (item.result_name ?? '').toLowerCase()
    if (!name) continue
    for (const key of Object.keys(COUNTER_KEYWORDS) as CounterKey[]) {
      if (COUNTER_KEYWORDS[key].some((kw) => name.includes(kw))) {
        counts[key] += 1
        break
      }
    }
  }
  return counts
}

export function InteractionsKpiStrip() {
  const { t } = useTranslation('common')
  const activeProjectId = useAuthStore((s) => s.user?.active_project_id)
  const projectIdNum = activeProjectId ? Number(activeProjectId) : null

  // Independent query from the sub-tab table — same endpoint, wider window
  // (page_size=500) so the per-result buckets cover more than one page of
  // table data. Reuses the BE default-period guard so the totals match
  // "today" out of the box.
  const filters = useMemo<InteractionMonitoringFilters>(
    () => ({
      period: 'today',
      sort_by: 'date',
      sort_dir: 'desc',
      page: 1,
      page_size: 500,
    }),
    []
  )
  const interactionsQuery = useInteractionMonitoring(filters, projectIdNum != null)

  const total = interactionsQuery.data?.total ?? 0
  const counts = useMemo(
    () => bucket(interactionsQuery.data?.items ?? []),
    [interactionsQuery.data]
  )

  const tiles = [
    {
      key: 'interactions',
      label: t('pages.training.interactions.kpi.total', 'Interactions'),
      value: String(total),
      icon: <Icons.Activity01 size={18} />,
      iconBg: 'bg-[#F7F7F7]',
      iconTone: 'text-[#05040D]',
    },
    {
      key: 'promises',
      label: t('pages.training.interactions.kpi.promises', 'Promises'),
      value: String(counts.promises),
      icon: <Icons.TransactionHistory size={18} />,
      iconBg: 'bg-[#ECFDF5]',
      iconTone: 'text-[#047857]',
    },
    {
      key: 'rejections',
      label: t('pages.training.interactions.kpi.rejections', 'Rejections'),
      value: String(counts.refusals),
      icon: <Icons.Close size={18} />,
      iconBg: 'bg-[#FEF2F2]',
      iconTone: 'text-[#B91C1C]',
    },
    {
      key: 'missed-calls',
      label: t('pages.training.interactions.kpi.missedCalls', 'Missed Calls'),
      value: String(counts.missed),
      icon: <Icons.CallEnd size={18} />,
      iconBg: 'bg-[#FFF7ED]',
      iconTone: 'text-[#C2410C]',
    },
    {
      key: 'will-pass',
      label: t('pages.training.interactions.kpi.willPass', 'Will Pass'),
      value: String(counts.willPass),
      icon: <Icons.UserCheck01 size={18} />,
      iconBg: 'bg-[#EFF6FF]',
      iconTone: 'text-[#1D4ED8]',
    },
    {
      // Average gap (between interactions) needs a dedicated aggregate
      // endpoint; the list response doesn't carry the right field. Show `—`
      // until a /interactions/summary lands as a follow-up.
      key: 'avg-gap',
      label: t('pages.training.interactions.kpi.avgGap', 'Average Gap'),
      value: '—',
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
