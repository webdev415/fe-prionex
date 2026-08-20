/**
 * Shared vocabularies + styling for the Call QA listening-rules editors.
 *
 * The label lookups go through i18n keys (`pages.qaRules.*`); an unknown
 * value coming back from the pipeline renders as its raw key rather than
 * blanking out — the categories/severities are an OPEN set on read.
 */
import type { BlockerCategory, BlockerLang, BlockerSeverity, CriterionScale } from '../../types'
import { BLOCKER_CATEGORIES, BLOCKER_LANGS, BLOCKER_SEVERITIES } from '../../types'

export const BLOCKER_CATEGORY_OPTIONS: BlockerCategory[] = [...BLOCKER_CATEGORIES]
export const BLOCKER_SEVERITY_OPTIONS: BlockerSeverity[] = [...BLOCKER_SEVERITIES]
export const BLOCKER_LANG_OPTIONS: BlockerLang[] = [...BLOCKER_LANGS]
export const CRITERION_SCALE_OPTIONS: CriterionScale[] = ['binary', '0-5', 'binary_critical']

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

/** Shared control styling — matches the trainer surfaces' compact inputs. */
export const QA_INPUT_CLS =
  'h-9 rounded-lg border border-[#DFDFDF] bg-white px-3 text-xs text-[#05040D] focus:outline-none'
