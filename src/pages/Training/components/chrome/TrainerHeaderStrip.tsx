import { type ReactElement } from 'react'
import { useTranslation } from 'react-i18next'
import { Icons } from '@/lib/icons'
import { MOCK_HEADER_KPIS } from '../../mocks/trainerWorkplaceMocks'
import { HeaderKpiTile } from './HeaderKpiTile'

/**
 * Header KPI strip — five Figma "Work Type" metric cards.
 * Quick Action lives on the tab row (TrainingPage).
 */
export interface TrainerHeaderStripProps {
  onQuickAction?: () => void
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

export function TrainerHeaderStrip(_props: TrainerHeaderStripProps) {
  const { t } = useTranslation('common')
  const k = MOCK_HEADER_KPIS

  const tiles: KpiTileConfig[] = [
    {
      key: 'in-progress',
      label: t('pages.training.inbox.headerKpis.inProgress', 'In progress'),
      value: String(k.inProgress),
      delta: `+${k.averageScoreDeltaPct}%`,
      icon: Icons.Briefcase01,
      iconColor: 'text-[#EAB308]',
      iconBg: 'bg-[#EAB308]/10',
      accentColor: '#EAB308',
    },
    {
      key: 'avg-score',
      label: t('pages.training.inbox.headerKpis.averageScore', 'Average score'),
      value: `${k.averageScore}/${k.averageScoreOutOf}`,
      delta: `+${k.averageScoreDeltaPct}%`,
      icon: Icons.ChartRing,
      iconColor: 'text-[#359791]',
      iconBg: 'bg-[#359791]/10',
      accentColor: '#359791',
    },
    {
      key: 'team-plan',
      label: t('pages.training.inbox.headerKpis.teamPlan', 'Team plan'),
      value: `${k.teamPlanPct}%`,
      delta: `+${k.teamPlanDeltaPct}%`,
      icon: Icons.PieChart02,
      iconColor: 'text-[#8B5CF6]',
      iconBg: 'bg-[#8B5CF6]/10',
      accentColor: '#8B5CF6',
    },
    {
      key: 'tasks-today',
      label: t('pages.training.inbox.headerKpis.tasksToday', 'Tasks today'),
      value: String(k.tasksToday),
      icon: Icons.Brochure,
      iconColor: 'text-[#3B82F6]',
      iconBg: 'bg-[#3B82F6]/10',
      accentColor: '#3B82F6',
    },
    {
      key: 'one-on-one-today',
      label: t('pages.training.inbox.headerKpis.oneOnOneToday', '1-on-1 today'),
      value: String(k.oneOnOneToday),
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
