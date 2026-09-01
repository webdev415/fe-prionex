/**
 * Shared vocabularies + styling for the Call QA listening-rules editors.
 *
 * The label lookups go through i18n keys (`pages.qaRules.*`); an unknown
 * value coming back from the pipeline renders as its raw key rather than
 * blanking out — the categories/severities are an OPEN set on read.
 */
import type {
  BlockerCategory,
  BlockerLang,
  BlockerSeverity,
  CriterionScale,
  RubricTelephonyType,
} from '../../types'
import {
  BLOCKER_CATEGORIES,
  BLOCKER_LANGS,
  BLOCKER_SEVERITIES,
  RUBRIC_TELEPHONY_TYPES,
} from '../../types'

export const BLOCKER_CATEGORY_OPTIONS: BlockerCategory[] = [...BLOCKER_CATEGORIES]
export const BLOCKER_SEVERITY_OPTIONS: BlockerSeverity[] = [...BLOCKER_SEVERITIES]
export const BLOCKER_LANG_OPTIONS: BlockerLang[] = [...BLOCKER_LANGS]
/**
 * Scales a trainer may pick. `binary_critical` is deliberately absent: the API
 * accepts only `binary` and `0-5`, and expresses "failing this caps the call"
 * through the separate `critical` flag. Offering it here produced a 422 on
 * save — the one scale a trainer would reach for to mark a blocking rule.
 */
export const CRITERION_SCALE_OPTIONS: CriterionScale[] = ['binary', '0-5']

/**
 * Outbound lines a rubric can be pinned to. «Any line» is the absence of a
 * value (null), so it is not a member here — the selects render it as their
 * empty option.
 */
export const RUBRIC_TELEPHONY_OPTIONS: RubricTelephonyType[] = [...RUBRIC_TELEPHONY_TYPES]

export const SEVERITY_TONE: Record<string, string> = {
  low: 'bg-[#F3F4F6] text-[#374151]',
  medium: 'bg-[#FEF3C7] text-[#B45309]',
  high: 'bg-[#FFEDD5] text-[#C2410C]',
  critical: 'bg-[#FEE2E2] text-[#B91C1C]',
}

/** i18n key for a blocker category; the raw value is the fallback. */
export function categoryKey(value: string): string {
  return `pages.qaRules.category.${value}`
}

export function severityKey(value: string): string {
  return `pages.qaRules.severity.${value}`
}

export function langKey(value: string): string {
  return `pages.qaRules.lang.${value}`
}

export function scaleKey(value: string): string {
  return `pages.qaRules.scale.${value}`
}

/** i18n key for an outbound line ('white' | 'grey'). */
export function telephonyKey(value: string): string {
  return `pages.qaRules.rubrics.telephony.${value}`
}

/** Shared control styling — matches the trainer surfaces' compact inputs. */
export const QA_INPUT_CLS =
  'h-9 rounded-lg border border-[#DFDFDF] bg-white px-3 text-xs text-[#05040D] focus:outline-none'

/**
 * Prose fields inside a rubric: the AI instruction and the speech examples.
 *
 * Deliberately not `QA_INPUT_CLS`: those carry a fixed `h-9`, and the
 * trainers' checklist puts paragraphs here — one `examples` value runs past
 * 600 characters over several numbered lines. Wrapping is soft and the box
 * grows (see AutoTextarea), so a long value never turns into a horizontal
 * scrollbar inside the card.
 */
export const QA_TEXTAREA_CLS =
  'w-full resize-y overflow-hidden rounded-lg border border-[#DFDFDF] bg-white px-3 py-2 text-xs leading-relaxed break-words text-[#05040D] focus:outline-none'
