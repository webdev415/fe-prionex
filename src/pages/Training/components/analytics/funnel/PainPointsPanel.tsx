import { useTranslation } from 'react-i18next'
import { Icons } from '@/lib/icons'
import type { PainPointDto, PainPoints } from '@/features/quality'

/**
 * Pain Points panel (KAN-503) — funnel-derived, NOT from the old auto-flag
 * engines. Three columns: Critical (red bands, with "operators below
 * threshold"), Warning (yellow bands), Stable (green bands).
 */

type Severity = 'critical' | 'warning' | 'stable'

const SEVERITY_STYLE: Record<Severity, { card: string; chip: string; dot: string }> = {
  critical: {
    card: 'border-[#FECACA] bg-[#FEF2F2]',
    chip: 'bg-[#FEE2E2] text-[#B91C1C]',
    dot: 'bg-[#EF4444]',
  },
  warning: {
    card: 'border-[#FDE68A] bg-[#FEFCE8]',
    chip: 'bg-[#FEF9C3] text-[#A16207]',
    dot: 'bg-[#F59E0B]',
  },
  stable: {
    card: 'border-[#BBF7D0] bg-[#F0FDF4]',
    chip: 'bg-[#DCFCE7] text-[#047857]',
    dot: 'bg-[#22C55E]',
  },
}

interface Props {
  painPoints: PainPoints
}

export function PainPointsPanel({ painPoints }: Props) {
  const { t } = useTranslation('common')

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <PainColumn
        severity="critical"
        title={t('pages.training.funnel.pain.critical', 'Critical')}
        points={painPoints.critical}
        emptyLabel={t('pages.training.funnel.pain.noCritical', 'No critical stages')}
      />
      <PainColumn
        severity="warning"
        title={t('pages.training.funnel.pain.warning', 'Warning')}
        points={painPoints.warning}
        emptyLabel={t('pages.training.funnel.pain.noWarning', 'No warnings')}
      />
      <PainColumn
        severity="stable"
        title={t('pages.training.funnel.pain.stable', 'Stable')}
        points={painPoints.stable}
        emptyLabel={t('pages.training.funnel.pain.noStable', 'No stable stages')}
      />
    </div>
  )
}

function PainColumn({
  severity,
  title,
  points,
  emptyLabel,
}: {
  severity: Severity
  title: string
  points: PainPointDto[]
  emptyLabel: string
}) {
  const style = SEVERITY_STYLE[severity]
  return (
    <div className={`flex flex-col gap-2 rounded-xl border p-3 ${style.card}`}>
      <div className="flex items-center gap-2">
        <span className={`h-2 w-2 flex-shrink-0 rounded-full ${style.dot}`} />
        <h4 className="text-xs font-semibold text-[#05040D]">{title}</h4>
        <span
          className={`ml-auto rounded-full px-2 py-0.5 text-[10px] font-semibold ${style.chip}`}
        >
          {points.length}
        </span>
      </div>
      {points.length === 0 ? (
        <p className="text-[11px] text-[#676767]">{emptyLabel}</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {points.map((point) => (
            <PainCard key={point.stage} point={point} severity={severity} />
          ))}
        </ul>
      )}
    </div>
  )
}

function PainCard({ point, severity }: { point: PainPointDto; severity: Severity }) {
  const { t, i18n } = useTranslation('common')
  const label = i18n.language?.startsWith('uk') ? point.label_uk : point.label_en
  return (
    <li className="rounded-lg bg-white/70 p-2.5">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium text-[#05040D]">{label}</span>
        <span className="text-[11px] font-semibold text-[#B91C1C]">▼ {point.drop_pct}%</span>
      </div>
      {severity === 'critical' && point.operators_below != null ? (
        <p className="mt-1 flex items-center gap-1 text-[10px] text-[#676767]">
          <Icons.Warning size={11} className="text-[#EF4444]" />
          {t('pages.training.funnel.pain.operatorsBelow', '{{count}} operators below threshold', {
            count: point.operators_below,
          })}
        </p>
      ) : null}
      <p className="mt-1 text-[10px] leading-snug text-[#676767]">{point.recommendation}</p>
    </li>
  )
}

export default PainPointsPanel
