import { useState, type ReactElement } from 'react'
import { useTranslation } from 'react-i18next'
import { Icons } from '@/lib/icons'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { MOCK_HEADER_KPIS } from '../../mocks/trainerWorkplaceMocks'

/**
 * Header strip for the Trainer Workplace redesign â€” search input, KPI tiles,
 * Quick Action button. Mock-data variant; the eventual hook-backed version
 * lives in `chrome/HeaderKpiStrip.tsx`.
 *
 * Layout per the Figma frames (all top-tabs share the strip): rounded pills,
 * subtle gradient backgrounds for the KPI tiles, primary-green accents.
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
  icon: (props: { size?: number; className?: string }) => ReactElement
}

export function TrainerHeaderStrip({ onQuickAction }: TrainerHeaderStripProps) {
  const { t } = useTranslation('common')
  const [query, setQuery] = useState('')

  const k = MOCK_HEADER_KPIS

  const tiles: KpiTileConfig[] = [
    {
      key: 'in-progress',
      label: t('pages.training.inbox.headerKpis.inProgress', 'In progress'),
      value: String(k.inProgress),
      accent: 'bg-amber-50 text-amber-700',
      icon: Icons.Clock01,
    },
    {
      key: 'avg-score',
      label: t('pages.training.inbox.headerKpis.averageScore', 'Average score'),
      value: `${k.averageScore}/${k.averageScoreOutOf}`,
      delta: `+${k.averageScoreDeltaPct}%`,
      accent: 'bg-emerald-50 text-emerald-700',
      icon: Icons.ChartRing,
    },
    {
      key: 'team-plan',
      label: t('pages.training.inbox.headerKpis.teamPlan', 'Team plan'),
      value: `${k.teamPlanPct}%`,
      delta: `+${k.teamPlanDeltaPct}%`,
      accent: 'bg-violet-50 text-violet-700',
      icon: Icons.PieChart02,
    },
    {
      key: 'tasks-today',
      label: t('pages.training.inbox.headerKpis.tasksToday', 'Tasks today'),
      value: String(k.tasksToday),
      accent: 'bg-blue-50 text-blue-700',
      icon: Icons.Brochure,
    },
    {
      key: 'one-on-one-today',
      label: t('pages.training.inbox.headerKpis.oneOnOneToday', '1-on-1 today'),
      value: String(k.oneOnOneToday),
      accent: 'bg-pink-50 text-pink-700',
      icon: Icons.Calendar,
    },
  ]

  return (
    <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
      {/* Search box (left) */}
      <div className="flex flex-1 items-center gap-2">
        <form
          onSubmit={(e) => e.preventDefault()}
          className="relative flex w-full max-w-[320px] items-center"
        >
          <Icons.Search
            size={16}
            className="absolute top-1/2 left-3 -translate-y-1/2 text-gray-400"
          />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t(
              'pages.training.inbox.searchPlaceholder',
              'Operator name or phone number'
            )}
            className="h-[44px] w-full rounded-full bg-white pl-9 text-xs shadow-sm"
          />
          <button
            type="button"
            className="bg-primary-500 absolute top-1/2 right-1.5 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full text-white"
            aria-label="search"
          >
            <Icons.Search size={14} className="text-white" />
          </button>
        </form>
      </div>

      {/* KPI tiles + Quick Action (right) */}
      <div className="flex flex-wrap items-center gap-2">
        {tiles.map((tile) => {
          const TileIcon = tile.icon
          return (
            <div
              key={tile.key}
              className="flex h-[60px] min-w-[140px] items-center gap-2 rounded-2xl bg-white px-3 shadow-sm"
            >
              <div
                className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl ${tile.accent}`}
              >
                <TileIcon size={18} />
              </div>
              <div className="flex flex-col leading-tight">
                <span className="text-[11px] text-gray-500">{tile.label}</span>
                <div className="flex items-baseline gap-1">
                  <span className="text-dark-500 text-sm font-semibold">{tile.value}</span>
                  {tile.delta ? (
                    <span className="text-primary-600 text-[10px] font-medium">
                      â†— {tile.delta}
                    </span>
                  ) : null}
                </div>
              </div>
            </div>
          )
        })}

        <Button
          variant="primary"
          size="md"
          onClick={onQuickAction}
          leftIcon={<Icons.Add size={16} className="text-white" />}
          className="h-[44px] rounded-full px-5 text-xs"
        >
          {t('pages.training.inbox.quickActions.button', 'Quick Action')}
        </Button>
      </div>
    </div>
  )
}

export default TrainerHeaderStrip
