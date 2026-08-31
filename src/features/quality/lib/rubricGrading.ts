/**
 * The unfinished-dialogue grading scale carried by an AI rubric.
 *
 * Not a criterion: bands of the *final* score for a call the client cut
 * short, each with the wording that tells the model which band a call lands
 * in. The trainers' checklist writes it once per card.
 *
 * Wire shape (quality-service, `grading_rules` beside `sections`):
 *
 *     {"grading_rules": {"incomplete_dialog": {
 *        "title": "Параметри оцінки незавершеного діалогу (для білої телефонії)",
 *        "source": "Незавершені діалоги 09.2025",
 *        "telephony_type": "white",
 *        "levels": [{"score": 50, "description": "…"}, …]
 *     }}}
 *
 * `grading_rules` is a CONTAINER keyed by rule kind — today only
 * `incomplete_dialog` — so a save must replace that one key and leave any
 * sibling kind it does not know about untouched. Rebuilding the container
 * from what this editor renders would delete a rule kind added later.
 *
 * Absent / null = «graded by the criteria alone», which is every card but
 * «AI: стягнення КЛ». The server normalises an empty container back to null
 * so «no rules» has one representation.
 */
import type { RubricTelephonyType } from '../types'
import { normalizeRubricTelephonyType } from '../types'

/** The only rule kind today; the container may grow others. */
export const GRADING_RULE_KIND = 'incomplete_dialog'

export interface GradingLevel {
  /** Final score for the band, 0..100. The top band must be exactly 100. */
  score: number
  /** What puts a call in this band. Free prose, often several lines. */
  description: string
}

export interface IncompleteDialogScale {
  /** Trainer-facing heading; rides to the model as the rule's own title. */
  title: string
  /** Name of the source sheet. Provenance, not something a trainer retypes. */
  source: string | null
  /** The line the scale applies to. null = both. Its own field, not the card's. */
  telephony_type: RubricTelephonyType | null
  levels: GradingLevel[]
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null
}

function readString(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

/**
 * Read one level. `description` is the canonical key; `text` is accepted
 * because the brain's own reader takes it and seeded data may carry it.
 *
 * A row whose score is unusable is rejected (null) rather than defaulted: a
 * band graded by a threshold no trainer wrote is worse than no band.
 */
function readLevel(raw: unknown): GradingLevel | null {
  const row = asRecord(raw)
  if (!row) return null
  const rawScore = typeof row.score === 'string' ? Number(row.score) : row.score
  if (typeof rawScore !== 'number' || !Number.isFinite(rawScore)) return null
  return {
    score: rawScore,
    description: readString(row.description) || readString(row.text),
  }
}

/**
 * Pull the unfinished-dialogue scale out of a template's `grading_rules`.
 * Returns null when the card carries none — the editor then renders no
 * section, because an empty stub reads as «there is a scale here and nobody
 * filled it in».
 */
export function readIncompleteDialogScale(raw: unknown): IncompleteDialogScale | null {
  const container = asRecord(raw)
  const scale = container ? asRecord(container[GRADING_RULE_KIND]) : null
  if (!scale) return null

  const levels = Array.isArray(scale.levels)
    ? scale.levels.map(readLevel).filter((level): level is GradingLevel => level != null)
    : []
  if (levels.length === 0) return null

  return {
    title: readString(scale.title),
    source: typeof scale.source === 'string' && scale.source ? scale.source : null,
    telephony_type: normalizeRubricTelephonyType(readString(scale.telephony_type)),
    levels,
  }
}

/**
 * Write the scale back into the container it came from.
 *
 * Sibling rule kinds are carried through untouched; `null` removes just this
 * kind, and a container left with nothing in it collapses to null, matching
 * what the server stores.
 *
 * Levels go out sorted by score. The server sorts them anyway, so sending
 * them in the trainer's typing order would only make the next read reorder
 * the rows under them.
 */
export function writeIncompleteDialogScale(
  raw: unknown,
  scale: IncompleteDialogScale | null
): Record<string, unknown> | null {
  const container = { ...(asRecord(raw) ?? {}) }

  if (scale == null) {
    delete container[GRADING_RULE_KIND]
  } else {
    container[GRADING_RULE_KIND] = {
      title: scale.title.trim(),
      source: scale.source,
      telephony_type: scale.telephony_type,
      levels: [...scale.levels]
        .sort((a, b) => a.score - b.score)
        .map((level) => ({
          score: Number(level.score) || 0,
          // trim clips the edges; the newlines inside a trainer's multi-line
          // wording are content.
          description: level.description.trim(),
        })),
    }
  }

  return Object.keys(container).length > 0 ? container : null
}

/** Lowest 0..100 score not already taken, for a freshly added band. */
export function nextFreeScore(levels: GradingLevel[]): number {
  const taken = new Set(levels.map((level) => level.score))
  for (let score = 0; score <= 100; score += 1) {
    if (!taken.has(score)) return score
  }
  return 0
}

/**
 * Everything quality-service answers 422 for, checked here first, plus the
 * one cross-field rule it enforces against the card.
 *
 * Blocking, not advisory: each of these is a refusal server-side, and the
 * one about ordering is worse than a refusal — a scale whose top band is not
 * 100 silently marks down every cut-short call against a finished one.
 *
 * Returned as i18n keys so the caller renders them in the trainer's language.
 */
export function gradingScaleIssues(
  scale: IncompleteDialogScale,
  cardTelephonyType: RubricTelephonyType | null
): string[] {
  const issues: string[] = []
  const { levels } = scale

  if (levels.length === 0) {
    issues.push('pages.qaRules.rubrics.grading.issueEmptyScale')
    return issues
  }
  if (levels.some((level) => level.score < 0 || level.score > 100)) {
    issues.push('pages.qaRules.rubrics.grading.issueRange')
  }
  if (new Set(levels.map((level) => level.score)).size !== levels.length) {
    issues.push('pages.qaRules.rubrics.grading.issueDuplicate')
  }
  if (Math.max(...levels.map((level) => level.score)) !== 100) {
    issues.push('pages.qaRules.rubrics.grading.issueTop')
  }
  if (levels.some((level) => !level.description.trim())) {
    issues.push('pages.qaRules.rubrics.grading.issueNoWording')
  }
  // The card narrows which calls reach this rubric at all. A scale pinned to
  // the other line would never fire, and the server refuses the combination.
  if (
    cardTelephonyType != null &&
    scale.telephony_type != null &&
    scale.telephony_type !== cardTelephonyType
  ) {
    issues.push('pages.qaRules.rubrics.grading.issueLineMismatch')
  }
  return issues
}
