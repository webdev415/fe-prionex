import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useHeaderKpis } from '@/features/quality/coaching/hooks'
import type { HeaderKpisFilters } from '@/features/quality/coaching/types'
import { Icons } from '@/lib/icons'
import { Input } from '@/components/ui/Input'
import { QuickActionOverlay } from './QuickActionOverlay'

/**
 * Trainer Workplace header strip (KAN-413, plan §1.5 / §3.4).
 *
 * Mounted above the top-tab strip on ActionAnalysisPage. Renders:
 *   - Search box (operator name or phone)
 *   - In-progress count badge
 *   - Average score / Team plan / Tasks today / 1-on-1 today KPI tiles
 *   - Quick Action button (opens the overlay)
 *
 * KPIs come from a single `GET /coaching/header-kpis` call. The strip is
 * inert when the user lacks `view_inbox` — parent decides whether to render
 * it at all by passing `enabled`.
 */
export interface HeaderKpiStripProps {
  filters: HeaderKpisFilters
  enabled?: boolean
  onAssignTask?: () => void
  onScheduleOneOnOne?: () => void
  onAssignMaterial?: () => void
  onRateDialogue?: () => void
  onSearchSubmit?: (query: string) => void
}

function formatDeltaPct(delta: number | null | undefined): string | null {
  if (delta == null) return null
  const sign = delta > 0 ? '+' : ''
  return `${sign}${delta.toFixed(0)}%`
}

interface KpiTileProps {
  label: string
  value: string
  delta?: string | null
  isLoading?: boolean
}

function KpiTile({ label, value, delta, isLoading }: KpiTileProps) {
  return (
    <div className="flex min-w-[120px] flex-col items-start rounded-2xl bg-white/60 px-4 py-2 shadow-sm">
      <span className="text-[10px] font-medium tracking-wide text-gray-500 uppercase">{label}</span>
      <div className="flex items-baseline gap-2">
        <span className="text-dark-500 text-lg font-semibold">{isLoading ? '…' : value}</span>
        {delta ? (
          <span
            className={`text-[11px] font-medium ${
              delta.startsWith('+') ? 'text-primary-600' : 'text-red-500'
            }`}
          >
            {delta}
          </span>
        ) : null}
      </div>
    </div>
  )
}

export function HeaderKpiStrip({
  filters,
  enabled = true,
  onAssignTask,
  onScheduleOneOnOne,
  onAssignMaterial,
  onRateDialogue,
  onSearchSubmit,
}: HeaderKpiStripProps) {
  const { t } = useTranslation('common')
  const [searchQuery, setSearchQuery] = useState('')

  const { data, isLoading } = useHeaderKpis(filters, enabled)

  const inProgress = data?.in_progress_count ?? 0
  const averageScore = data?.average_score ?? 0
  const teamPlan = data?.team_plan_pct ?? 0
  const tasksToday = data?.tasks_today_count ?? 0
  const oneOnOneToday = data?.one_on_one_today_count ?? 0

  return (
    <div className="flex flex-col gap-3 rounded-2xl bg-gray-50/70 p-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex flex-wrap items-center gap-2">
        <form
          onSubmit={(e) => {
            e.preventDefault()
            onSearchSubmit?.(searchQuery.trim())
          }}
          className="flex items-center"
        >
          <div className="relative">
            <Icons.Search
              size={16}
              className="absolute top-1/2 left-3 -translate-y-1/2 text-gray-400"
            />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t(
                'pages.actionAnalysis.inbox.searchPlaceholder',
                'Operator name or phone number'
              )}
              className="h-[40px] w-[280px] rounded-full pl-9 text-xs"
            />
          </div>
        </form>

        <div className="bg-primary-50 text-primary-700 flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium">
          <span className="bg-primary-500 inline-block h-1.5 w-1.5 rounded-full" />
          {t('pages.actionAnalysis.inbox.headerKpis.inProgress', 'In progress')}
          <span className="ml-1 font-semibold">{inProgress}</span>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <KpiTile
          label={t('pages.actionAnalysis.inbox.headerKpis.averageScore', 'Average score')}
          value={`${averageScore}/100`}
          delta={formatDeltaPct(data?.average_score_delta_pct)}
          isLoading={isLoading}
        />
        <KpiTile
          label={t('pages.actionAnalysis.inbox.headerKpis.teamPlan', 'Team plan')}
          value={`${teamPlan}%`}
          delta={formatDeltaPct(data?.team_plan_delta_pct)}
          isLoading={isLoading}
        />
        <KpiTile
          label={t('pages.actionAnalysis.inbox.headerKpis.tasksToday', 'Tasks today')}
          value={String(tasksToday)}
          isLoading={isLoading}
        />
        <KpiTile
          label={t('pages.actionAnalysis.inbox.headerKpis.oneOnOneToday', '1-on-1 today')}
          value={String(oneOnOneToday)}
          isLoading={isLoading}
        />

        <QuickActionOverlay
          onAssignTask={onAssignTask}
          onScheduleOneOnOne={onScheduleOneOnOne}
          onAssignMaterial={onAssignMaterial}
          onRateDialogue={onRateDialogue}
        />
      </div>
    </div>
  )
}

export default HeaderKpiStrip
