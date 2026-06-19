/**
 * Dialogue Evaluation adapter (KAN-737).
 *
 * Maps the live `Scorecard` payload from `GET /api/v1/quality/scorecards`
 * (via `useScorecards`) onto the row + criteria shapes the Figma-accurate
 * Dialogue Evaluation components consume — so the mock layout is preserved
 * verbatim while the data becomes real.
 *
 * Mirrors the `correctionTaskAdapter` pattern (operator-name lookup,
 * deterministic avatar palette, derived display fields).
 *
 * Fields the scorecards endpoint does not carry (`duration`, call `trigger`
 * flags, `scoreDelta`, `exampleLabel`, audio) are rendered as `—` / hidden by
 * the components — see KAN-737-Plan §Discrepancy 3.
 */
import type { OperatorUser } from '@/features/users/api/usersApi'
import type { Scorecard } from '@/features/quality'

export type DialogueScorecardCategory = 'New' | 'Average' | 'Risk'

export type DialogueCriterionRating = 'not_done' | 'weak' | 'normal' | 'excellent'

export interface DialogueScorecardCriterion {
  id: string
  label: string
  weight: number
  score: number
  maxScore: number
  rating: DialogueCriterionRating
}

export interface DialogueTriggerFlags {
  promise?: boolean
  refusal?: boolean
  missedCall?: boolean
  willPass?: boolean
  flagged?: boolean
}

export interface DialogueScorecardRow {
  id: number
  dateLabel: string
  operatorName: string
  operatorInitials: string
  avatarColor: string
  category: DialogueScorecardCategory
  /** True when the backend returned a numeric `weighted_score`. When false the
   *  views render a `—` ring instead of `score`. */
  hasScore: boolean
  score: number
  scoreOutOf: number
  duration: string
  trigger: string
  triggerFlags?: DialogueTriggerFlags
  scoreDelta?: number
  exampleLabel?: string
  audioDuration?: string
  criteria: DialogueScorecardCriterion[]
}

const AVATAR_PALETTE = [
  '#E0F2EC',
  '#FEF3C7',
  '#FEE4E2',
  '#E0E7FF',
  '#FCE7F3',
  '#DBEAFE',
  '#FFEDD5',
  '#D1FAE5',
] as const

function avatarColorFor(operatorId: number): string {
  return AVATAR_PALETTE[Math.abs(operatorId) % AVATAR_PALETTE.length]
}

function initialsFor(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase()
}

/** ISO timestamp → `DD.MM` (matches the Figma row label). */
function formatDayMonth(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const dd = String(d.getDate()).padStart(2, '0')
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  return `${dd}.${mm}`
}

/**
 * Derive the New / Average / Risk chip bucket from the weighted score band.
 * No backend `category` field exists — see KAN-737-Plan §Discrepancy 2
 * (Risk < 60 · Average 60–79 · New ≥ 80 / no score).
 */
export function deriveCategory(weightedScore: number | null): DialogueScorecardCategory {
  if (weightedScore == null) return 'New'
  if (weightedScore < 60) return 'Risk'
  if (weightedScore < 80) return 'Average'
  return 'New'
}

/** Map a stored criterion value onto the 4-button rating band (read-only). */
function ratingForValue(value: number | boolean | null, scale: string): DialogueCriterionRating {
  if (value == null) return 'not_done'
  if (scale === 'binary' || typeof value === 'boolean') {
    return value ? 'excellent' : 'not_done'
  }
  // '0-5' scale.
  if (value <= 0) return 'not_done'
  if (value <= 2) return 'weak'
  if (value <= 4) return 'normal'
  return 'excellent'
}

/**
 * Build the detail-panel criteria cards by flattening the template snapshot's
 * sections and joining each criterion against the `scores` JSONB payload.
 */
export function buildCriteria(scorecard: Scorecard): DialogueScorecardCriterion[] {
  const out: DialogueScorecardCriterion[] = []
  for (const section of scorecard.template_snapshot.sections ?? []) {
    for (const criterion of section.criteria ?? []) {
      const entry = scorecard.scores?.[criterion.key]
      const rawValue = entry?.value ?? null
      const isBinary = criterion.scale === 'binary'
      const maxScore = isBinary ? 1 : 5
      const numericScore =
        rawValue == null ? 0 : typeof rawValue === 'boolean' ? (rawValue ? 1 : 0) : rawValue
      out.push({
        id: `${section.key}.${criterion.key}`,
        label: criterion.name,
        weight: criterion.weight,
        score: numericScore,
        maxScore,
        rating: ratingForValue(rawValue, criterion.scale),
      })
    }
  }
  return out
}

export function buildDialogueRow(
  scorecard: Scorecard,
  operatorLookup: Map<number, string>
): DialogueScorecardRow {
  const operatorName = operatorLookup.get(scorecard.operator_id) ?? `#${scorecard.operator_id}`
  const hasScore = scorecard.weighted_score != null
  return {
    id: scorecard.id,
    dateLabel: formatDayMonth(scorecard.created_at),
    operatorName,
    operatorInitials: initialsFor(operatorName),
    avatarColor: avatarColorFor(scorecard.operator_id),
    category: deriveCategory(scorecard.weighted_score),
    hasScore,
    score: hasScore ? Math.round(scorecard.weighted_score as number) : 0,
    scoreOutOf: 100,
    // No source on the scorecards endpoint — rendered as `—` / hidden.
    duration: '—',
    trigger: '—',
    triggerFlags: undefined,
    scoreDelta: undefined,
    exampleLabel: undefined,
    audioDuration: undefined,
    criteria: buildCriteria(scorecard),
  }
}

export function buildDialogueRows(
  scorecards: Scorecard[],
  operators: OperatorUser[]
): DialogueScorecardRow[] {
  const lookup = new Map<number, string>()
  operators.forEach((op) => lookup.set(op.id, op.full_name ?? `#${op.id}`))
  return scorecards.map((sc) => buildDialogueRow(sc, lookup))
}
