import { useState, type ReactElement } from 'react'
import { useTranslation } from 'react-i18next'
import { Icons } from '@/lib/icons'
import { Input } from '@/components/ui/Input'
import { MOCK_HEADER_KPIS } from '../../mocks/trainerWorkplaceMocks'

/**
 * Header strip — search + KPI tiles per Figma Training/Inbox frames.
 * Quick Action lives on the top-tab row (TrainingPage), not here.
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
  const [query, setQuery] = useState('')

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
    <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
      <form
        onSubmit={(e) => e.preventDefault()}
        className="relative flex w-full max-w-[480px] items-center"
      >
        <select
          className="absolute top-1/2 left-3 z-10 -translate-y-1/2 rounded border-0 bg-transparent pr-1 text-xs text-gray-600 outline-none"
          defaultValue="phone"
          aria-label={t('pages.training.inbox.searchType', 'Search type')}
        >
          <option value="phone">
            {t('pages.training.inbox.searchTypePhone', 'Phone number')}
          </option>
        </select>
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t(
            'pages.training.inbox.searchPlaceholder',
            'Search operator, department, call…'
          )}
          className="h-11 w-full rounded-full border border-gray-200 bg-white pl-28 pr-12 text-xs shadow-sm"
        />
        <button
          type="button"
          className="absolute top-1/2 right-1.5 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-[#BBFB5B] text-[#05040D]"
          aria-label="search"
        >
          <Icons.Search size={14} />
        </button>
      </form>

      <div className="flex flex-wrap items-center gap-2">
        {tiles.map((tile) => {
          const TileIcon = tile.icon
          return (
            <div
              key={tile.key}
              className={`flex h-[72px] min-w-[130px] flex-col justify-between rounded-xl border-b-4 bg-white px-3 py-2 shadow-sm ${tile.borderAccent}`}
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
    </div>
  )
}

export default TrainerHeaderStrip
