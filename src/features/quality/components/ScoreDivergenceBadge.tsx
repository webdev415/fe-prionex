import { useTranslation } from 'react-i18next'
import { scoreDivergence } from '../lib/dispute'

export interface ScoreDivergenceBadgeProps {
  /** AI's score at the time the scorecard was created, 0-100. */
  aiScore100: number | null | undefined
  /** The trainer's own score, 0-100. */
  trainerScore100: number | null | undefined
  /** Divergence above which the disagreement is worth explaining, in points. */
  threshold: number
  className?: string
}

/**
 * `AI 0 → Trainer 45` — the two scores read as one statement.
 *
 * Renders nothing unless **both** numbers exist: without a trainer score there
 * is no second opinion to show, and printing a lone AI number here would only
 * duplicate the review card below.
 *
 * The emphasis grows with the gap, but deliberately stays in neutral tones. A
 * trainer disagreeing with the model is the system working, not an error, and
 * a red badge would train people to read their own judgement as a fault.
 *
 * Only the two labels are translated; the numbers stay outside interpolation
 * so they are one text node the reader (and a test) can see directly.
 */
export function ScoreDivergenceBadge({
  aiScore100,
  trainerScore100,
  threshold,
  className,
}: ScoreDivergenceBadgeProps) {
  const { t } = useTranslation('common')
  const delta = scoreDivergence(aiScore100, trainerScore100)
  if (delta == null) return null

  const magnitude = Math.abs(delta)
  // Three steps of emphasis rather than a colour ramp: within the threshold is
  // background noise, past it is worth a glance, far past it is worth reading.
  const tone =
    magnitude > threshold * 2
      ? 'border-[#204E4D] bg-[#204E4D] text-white'
      : magnitude > threshold
        ? 'border-[#204E4D] bg-[#F7FFE5] text-[#204E4D]'
        : 'border-[#EBECE8] bg-white text-[#6B7280]'

  const rounded = Math.round(delta)
  const signed = rounded > 0 ? `+${rounded}` : String(rounded)

  return (
    <span
      data-testid="score-divergence-badge"
      data-delta={rounded}
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium whitespace-nowrap ${tone} ${className ?? ''}`}
    >
      <span className="tabular-nums">
        {t('pages.training.scorecard.divergenceAi', 'AI')} {Math.round(aiScore100 as number)}
      </span>
      <span aria-hidden="true">→</span>
      <span className="tabular-nums">
        {t('pages.training.scorecard.divergenceTrainer', 'Trainer')}{' '}
        {Math.round(trainerScore100 as number)}
      </span>
      {rounded !== 0 ? (
        <span data-testid="score-divergence-delta" className="tabular-nums opacity-80">
          ({signed})
        </span>
      ) : null}
    </span>
  )
}

export default ScoreDivergenceBadge
