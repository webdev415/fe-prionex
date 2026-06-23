import { type ReactElement } from 'react'
import { useTranslation } from 'react-i18next'
import { Icons } from '@/lib/icons'
import { useHeaderKpis } from '@/features/quality/coaching/hooks'
import type { HeaderKpisFilters } from '@/features/quality/coaching/types'
import { HeaderKpiTile } from './HeaderKpiTile'

/**
 * Header KPI strip — five Figma "Work Type" metric cards (KAN-413 §1.5).
 *
 * KPI data comes from `GET /api/v1/quality/coaching/header-kpis`. Filters
 * (period, scope) are owned by the parent so the strip stays in sync with
 * whatever Inbox / Team / Action Analysis view is active.
 *
 * `enabled` lets the parent suppress the call when the user lacks
 * `view_inbox` — the tiles still render to preserve layout but show '—'.
 * Quick Action lives on the tab row (TrainingPage), not in this strip.
 */
export interface TrainerHeaderStripProps {
  filters: HeaderKpisFilters
  enabled?: boolean
}

interface KpiTileConfig {
  key: string
  label: string
  value: string
  delta?: string
  icon: (props: { size?: number; className?: string }) => ReactElement
  iconColor: string
  iconBg: string
  accentColor: string
}

function formatDeltaPct(delta: number | null | undefined): string | undefined {
  if (delta == null) return undefined
  const sign = delta > 0 ? '+' : ''
  return `${sign}${delta.toFixed(0)}%`
}

export function TrainerHeaderStrip({ filters, enabled = true }: TrainerHeaderStripProps) {
  const { t } = useTranslation('common')
  const { data, isLoading } = useHeaderKpis(filters, enabled)

  const placeholder = isLoading ? '…' : '—'
  const inProgress = data ? String(data.in_progress_count) : placeholder
  const averageScore = data ? `${data.average_score}/100` : placeholder
  const teamPlan = data ? `${data.team_plan_pct}%` : placeholder
  const tasksToday = data ? String(data.tasks_today_count) : placeholder
  const oneOnOneToday = data ? String(data.one_on_one_today_count) : placeholder

  const tiles: KpiTileConfig[] = [
    {
      key: 'in-progress',
      label: t('pages.training.inbox.headerKpis.inProgress', 'In progress'),
      value: inProgress,
      icon: Icons.Briefcase01,
      iconColor: 'text-[#EAB308]',
      iconBg: 'bg-[#EAB308]/10',
      accentColor: '#EAB308',
    },
    {
      key: 'avg-score',
      label: t('pages.training.inbox.headerKpis.averageScore', 'Average score'),
      value: averageScore,
      delta: formatDeltaPct(data?.average_score_delta_pct),
      icon: Icons.ChartRing,
      iconColor: 'text-[#359791]',
      iconBg: 'bg-[#359791]/10',
      accentColor: '#359791',
    },
    {
      key: 'team-plan',
      label: t('pages.training.inbox.headerKpis.teamPlan', 'Team plan'),
      value: teamPlan,
      delta: formatDeltaPct(data?.team_plan_delta_pct),
      icon: Icons.PieChart02,
      iconColor: 'text-[#8B5CF6]',
      iconBg: 'bg-[#8B5CF6]/10',
      accentColor: '#8B5CF6',
    },
    {
      key: 'tasks-today',
      label: t('pages.training.inbox.headerKpis.tasksToday', 'Tasks today'),
      value: tasksToday,
      icon: Icons.Brochure,
      iconColor: 'text-[#3B82F6]',
      iconBg: 'bg-[#3B82F6]/10',
      accentColor: '#3B82F6',
    },
    {
      key: 'one-on-one-today',
      label: t('pages.training.inbox.headerKpis.oneOnOneToday', '1-on-1 today'),
      value: oneOnOneToday,
      icon: Icons.Calendar,
      iconColor: 'text-[#22C55E]',
      iconBg: 'bg-[#22C55E]/10',
      accentColor: '#22C55E',
    },
  ]

  return (
    <div className="flex flex-wrap items-stretch gap-3">
      {tiles.map((tile) => (
        <HeaderKpiTile
          key={tile.key}
          label={tile.label}
          value={tile.value}
          delta={tile.delta}
          icon={tile.icon}
          iconColor={tile.iconColor}
          iconBg={tile.iconBg}
          accentColor={tile.accentColor}
        />
      ))}
    </div>
  )
}

export default TrainerHeaderStrip
