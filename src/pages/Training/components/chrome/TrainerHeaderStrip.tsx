import { type ReactElement } from 'react'
import { useTranslation } from 'react-i18next'
import { Icons } from '@/lib/icons'
import { MOCK_HEADER_KPIS } from '../../mocks/trainerWorkplaceMocks'

/**
 * Header KPI strip for the Trainer Workplace — five metric cards only.
 * Global operator search lives in the app shell (DashboardLayout), not here.
 * Quick Action lives on the top-tab row (TrainingPage).
 */
export interface TrainerHeaderStripProps {
  onQuickAction?: () => void
}

interface KpiTileConfig {
  key: string
  label: string
  value: string
  delta?: string
  accent: string
  borderAccent: string
  icon: (props: { size?: number; className?: string }) => ReactElement
}

export function TrainerHeaderStrip(_props: TrainerHeaderStripProps) {
  const { t } = useTranslation('common')
  const k = MOCK_HEADER_KPIS

  const tiles: KpiTileConfig[] = [
    {
      key: 'in-progress',
      label: t('pages.training.inbox.headerKpis.inProgress', 'In progress'),
      value: String(k.inProgress),
      delta: `+${k.averageScoreDeltaPct}%`,
      accent: 'bg-amber-50 text-amber-700',
      borderAccent: 'border-b-amber-400',
      icon: Icons.Briefcase01,
    },
    {
      key: 'avg-score',
      label: t('pages.training.inbox.headerKpis.averageScore', 'Average score'),
      value: `${k.averageScore}/${k.averageScoreOutOf}`,
      delta: `+${k.averageScoreDeltaPct}%`,
      accent: 'bg-cyan-50 text-cyan-700',
      borderAccent: 'border-b-cyan-400',
      icon: Icons.ChartRing,
    },
    {
      key: 'team-plan',
      label: t('pages.training.inbox.headerKpis.teamPlan', 'Team plan'),
      value: `${k.teamPlanPct}%`,
      delta: `+${k.teamPlanDeltaPct}%`,
      accent: 'bg-violet-50 text-violet-700',
      borderAccent: 'border-b-violet-400',
      icon: Icons.PieChart02,
    },
    {
      key: 'tasks-today',
      label: t('pages.training.inbox.headerKpis.tasksToday', 'Tasks today'),
      value: String(k.tasksToday),
      accent: 'bg-blue-50 text-blue-700',
      borderAccent: 'border-b-blue-400',
      icon: Icons.Brochure,
    },
    {
      key: 'one-on-one-today',
      label: t('pages.training.inbox.headerKpis.oneOnOneToday', '1-on-1 today'),
      value: String(k.oneOnOneToday),
      accent: 'bg-emerald-50 text-emerald-700',
      borderAccent: 'border-b-emerald-400',
      icon: Icons.Calendar,
    },
  ]

  return (
    <div className="flex flex-wrap items-stretch gap-2">
      {tiles.map((tile) => {
        const TileIcon = tile.icon
        return (
          <div
            key={tile.key}
            className={`flex min-h-[72px] min-w-[140px] flex-1 flex-col justify-between rounded-xl border-b-4 bg-white px-3 py-2 shadow-sm ${tile.borderAccent}`}
          >
            <div className="flex items-center gap-2">
              <div
                className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg ${tile.accent}`}
              >
                <TileIcon size={16} />
              </div>
              <span className="text-[11px] text-gray-600">{tile.label}</span>
            </div>
            <div className="flex items-baseline gap-1 pl-10">
              <span className="text-lg font-semibold text-[#05040D]">{tile.value}</span>
              {tile.delta ? (
                <span className="text-[10px] font-medium text-emerald-600">↗ {tile.delta}</span>
              ) : null}
            </div>
          </div>
        )
      })}
    </div>
  )
}

export default TrainerHeaderStrip
