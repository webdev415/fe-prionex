/**
 * Pure helpers for the 31B conclusion block («Заключення AI», step B):
 * tolerant normalisation of `review.conclusion` into a renderable view
 * model, splitting of free text into clickable `utt N` references, and
 * adjustment formatting for the «рубрика → корекція → бал» line.
 *
 * TOLERANT READER: older reviews have no conclusion at all, and every field
 * inside is optional with OPEN enums — helpers accept hostile shapes and
 * return null/empty instead of throwing; the block renders per available
 * part and disappears entirely when nothing is renderable.
 */
import type { CallAiReview, ConclusionDivergence, ReviewConclusion } from '../types'

// ---- Raw selectors ----

export function getConclusion(review: CallAiReview | null | undefined): ReviewConclusion | null {
  const conclusion = review?.conclusion
  if (!conclusion || typeof conclusion !== 'object' || Array.isArray(conclusion)) return null
  return conclusion
}

function finiteOrNull(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function nonEmptyString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() !== '' ? value : null
}

function stringList(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.filter((item): item is string => typeof item === 'string' && item.trim() !== '')
}

// ---- Recommendations ----

export interface NormalizedRecommendation {
  text: string
  /** Free-text anchor («utt 12») — rendered through splitUttReferences. */
  evidence: string | null
  /** Open set; 'high' and 'normal' get translated labels, others render raw. */
  priority: string | null
}

/** Objects are current; bare strings tolerated (legacy recommendations). */
export function normalizeConclusionRecommendations(value: unknown): NormalizedRecommendation[] {
  if (!Array.isArray(value)) return []
  const result: NormalizedRecommendation[] = []
  for (const entry of value) {
    if (typeof entry === 'string') {
      if (entry.trim() !== '') result.push({ text: entry, evidence: null, priority: null })
      continue
    }
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) continue
    const { text, evidence, priority } = entry as {
      text?: unknown
      evidence?: unknown
      priority?: unknown
    }
    const textValue = nonEmptyString(text)
    if (!textValue) continue
    result.push({
      text: textValue,
      evidence: nonEmptyString(evidence),
      priority: nonEmptyString(priority),
    })
  }
  return result
}

// ---- Tone vs words ----

export interface NormalizedConclusionDivergence {
  /** null when the index is missing/invalid — rendered without the anchor. */
  utt: number | null
  said: string
  sounded: string
  interpretation: string | null
  reliability: string | null
}

function normalizeConclusionDivergences(value: unknown): NormalizedConclusionDivergence[] {
  if (!Array.isArray(value)) return []
  const result: NormalizedConclusionDivergence[] = []
  for (const entry of value) {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) continue
    const { utt, said, sounded, interpretation, reliability } = entry as ConclusionDivergence
    const saidValue = nonEmptyString(said) ?? ''
    const soundedValue = nonEmptyString(sounded) ?? ''
    if (!saidValue && !soundedValue) continue
    result.push({
      utt: typeof utt === 'number' && Number.isInteger(utt) && utt >= 0 ? utt : null,
      said: saidValue,
      sounded: soundedValue,
      interpretation: nonEmptyString(interpretation),
      reliability: nonEmptyString(reliability),
    })
  }
  return result
}

// ---- View model ----

export interface NormalizedConclusion {
  grade: string | null
  score: number | null
  oneLiner: string | null
  justification: string | null
  /** «рубрика → корекція → бал» line parts; null hides the line. */
  rubricScoreInput: number | null
  adjustment: number | null
  adjustmentReason: string | null
  /** Final score of the assessment chain (falls back to overall.score). */
  assessmentScore: number | null
  strengths: string[]
  weaknesses: string[]
  keyFindings: string[]
  /** Non-empty only when the 31B flagged the call as NOT consistent. */
  divergences: NormalizedConclusionDivergence[]
  recommendations: NormalizedRecommendation[]
  confidenceOverall: number | null
  limitedBy: string[]
  model: string | null
  promptVersion: string | null
}

/**
 * `review.conclusion` → renderable view model, or null when the conclusion
 * is absent/malformed or carries nothing worth a block.
 */
export function normalizeConclusion(
  review: CallAiReview | null | undefined
): NormalizedConclusion | null {
  const conclusion = getConclusion(review)
  if (!conclusion) return null

  const overall =
    conclusion.overall && typeof conclusion.overall === 'object' ? conclusion.overall : null
  const assessment =
    conclusion.operator_assessment && typeof conclusion.operator_assessment === 'object'
      ? conclusion.operator_assessment
      : null
  const toneVsWords =
    conclusion.tone_vs_words && typeof conclusion.tone_vs_words === 'object'
      ? conclusion.tone_vs_words
      : null
  const confidence =
    conclusion.confidence && typeof conclusion.confidence === 'object'
      ? conclusion.confidence
      : null

  const score = finiteOrNull(overall?.score)
  const normalized: NormalizedConclusion = {
    grade: nonEmptyString(overall?.grade),
    score,
    oneLiner: nonEmptyString(overall?.one_liner),
    justification: nonEmptyString(assessment?.justification),
    rubricScoreInput: finiteOrNull(assessment?.rubric_score_input),
    adjustment: finiteOrNull(assessment?.adjustment),
    adjustmentReason: nonEmptyString(assessment?.adjustment_reason),
    assessmentScore: finiteOrNull(assessment?.score) ?? score,
    strengths: stringList(assessment?.strengths),
    weaknesses: stringList(assessment?.weaknesses),
    keyFindings: stringList(conclusion.key_findings),
    // ТЗ gate: only a call flagged as inconsistent shows the subsection —
    // a missing `consistent` with shipped divergences counts as flagged.
    divergences:
      toneVsWords?.consistent === true
        ? []
        : normalizeConclusionDivergences(toneVsWords?.divergences),
    recommendations: normalizeConclusionRecommendations(conclusion.recommendations),
    confidenceOverall: finiteOrNull(confidence?.overall),
    limitedBy: stringList(confidence?.limited_by),
    model: nonEmptyString(conclusion.model),
    promptVersion: nonEmptyString(conclusion.conclusion_prompt_version),
  }

  const hasContent =
    normalized.grade != null ||
    normalized.score != null ||
    normalized.oneLiner != null ||
    normalized.justification != null ||
    (normalized.rubricScoreInput != null && normalized.adjustment != null) ||
    normalized.strengths.length > 0 ||
    normalized.weaknesses.length > 0 ||
    normalized.keyFindings.length > 0 ||
    normalized.divergences.length > 0 ||
    normalized.recommendations.length > 0
  return hasContent ? normalized : null
}

/** Adjustment for the calc line: explicit sign for positives («+5», «-5»). */
export function formatAdjustment(adjustment: number): string {
  if (!Number.isFinite(adjustment)) return '0'
  const bare = Number.isInteger(adjustment) ? String(adjustment) : adjustment.toFixed(1)
  return adjustment > 0 ? `+${bare}` : bare
}

/**
 * Confidence for the meta line: a 0..1 score renders as a whole percent
 * («0.95» → «95%»). Out-of-range values render as-is — the brain occasionally
 * ships a raw 0..100 number, and tolerant means never mangling it.
 */
export function formatConfidence(overall: number): string {
  if (!Number.isFinite(overall)) return String(overall)
  return overall >= 0 && overall <= 1 ? `${Math.round(overall * 100)}%` : String(overall)
}

// ---- Clickable `utt N` references ----

export type UttSegment =
  | { kind: 'text'; text: string }
  /** `label` keeps the original wording («utt 33») for display. */
  | { kind: 'utt'; utt: number; label: string }

/**
 * Split free 31B text («Погроза виїздом (utt 33)») into plain text and
 * `utt N` references the UI turns into seek buttons. References outside the
 * rendered feed stay plain text (the caller decides — it knows the feed).
 */
export function splitUttReferences(text: string): UttSegment[] {
  const segments: UttSegment[] = []
  let cursor = 0
  for (const match of text.matchAll(/\butt\s*(\d+)\b/gi)) {
    const at = match.index
    if (at > cursor) segments.push({ kind: 'text', text: text.slice(cursor, at) })
    segments.push({ kind: 'utt', utt: Number(match[1]), label: match[0] })
    cursor = at + match[0].length
  }
  if (cursor < text.length) segments.push({ kind: 'text', text: text.slice(cursor) })
  return segments
}

/** Known `limited_by` values with translated labels; others render raw. */
export const KNOWN_LIMITATIONS = new Set(['no_audio_layer', 'fallback_26b'])
