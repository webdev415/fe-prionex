import { useTranslation } from 'react-i18next'
import type { FunnelBand, StageDto } from '@/features/quality'

/**
 * One stage row of the Script Stage Funnel (KAN-503).
 *
 * Renders a grey "expected" track sized to the stage's expected count
 * (relative to the top of the funnel, so the funnel visibly tapers) with a
 * coloured "actual" overlay on top. The drop badge is coloured by the
 * server-computed band — the FE never re-derives the band thresholds.
 */

const BAND_FILL: Record<FunnelBand, string> = {
  green: '#22C55E',
  yellow: '#F59E0B',
  red: '#EF4444',
}

const BAND_BADGE: Record<FunnelBand, string> = {
  green: 'bg-[#ECFDF5] text-[#047857]',
  yellow: 'bg-[#FEF9C3] text-[#A16207]',
  red: 'bg-[#FEF2F2] text-[#B91C1C]',
}

interface Props {
  stage: StageDto
  /** Top-of-funnel count (evaluated_calls) — the 100% width reference. */
  maxExpected: number
}

export function StageBar({ stage, maxExpected }: Props) {
  const { t, i18n } = useTranslation('common')
  const label = i18n.language?.startsWith('uk') ? stage.label_uk : stage.label_en

  const ref = maxExpected > 0 ? maxExpected : 1
  const expectedPct = Math.max(0, Math.min(100, (stage.expected / ref) * 100))
  const actualPct = Math.max(0, Math.min(100, (stage.actual / ref) * 100))

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between gap-3">
        <span className="flex items-center gap-2 text-xs font-medium text-[#05040D]">
          <span className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-[#F3F4F6] text-[10px] font-semibold text-[#676767]">
            {stage.order}
          </span>
          {label}
        </span>
        <span className="flex items-center gap-2">
          <span className="text-xs font-medium text-[#05040D]">
            {stage.actual}
            <span className="text-[#9CA3AF]"> / {stage.expected}</span>
          </span>
          <span
            className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${BAND_BADGE[stage.band]}`}
            title={t('pages.training.funnel.dropTooltip', 'Drop-off vs previous stage')}
          >
            ▼ {stage.drop_pct}%
          </span>
        </span>
      </div>

      {/* Grey expected track + coloured actual overlay */}
      <div className="relative h-6 w-full overflow-hidden rounded-md bg-[#F3F4F6]">
        <div
          className="absolute inset-y-0 left-0 rounded-md bg-[#E5E7EB]"
          style={{ width: `${expectedPct}%` }}
          aria-hidden
        />
        <div
          className="absolute inset-y-0 left-0 rounded-md transition-[width]"
          style={{ width: `${actualPct}%`, backgroundColor: BAND_FILL[stage.band] }}
          aria-hidden
        />
      </div>
    </div>
  )
}

export default StageBar
