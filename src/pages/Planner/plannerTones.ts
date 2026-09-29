/**
 * Colour roles of the planner section (planner story 5.1; DESIGN.md «Colors»,
 * UX-DR50) spelled as theme classes — the one table the components render and
 * the contrast guard measures (`__tests__/plannerTones.test.ts` resolves each
 * class to its CSS variable in all four theme bases).
 *
 * Only variables of the CRM theme engine: never a hex value and never the
 * Tailwind dark variant (it follows the OS, not `data-theme`). A role is never
 * colour alone — every pill carries an icon and a word next to it.
 */
import type { PlannerTaskCard } from '@/api/planner/plannerApi'

export const PLANNER_TONES = {
  /** Past the due or the SLA moment (FR-26): the only red of the planner. */
  overdue: { ink: 'text-error-700', bg: 'bg-error-50' },
  /** Due soon / SLA soon: amber. */
  soon: { ink: 'text-warning-700', bg: 'bg-warning-50' },
  /** A plain due date, SLA running: neutral. */
  normal: { ink: 'text-gray-900', bg: 'bg-gray-50' },
  /** SLA on pause: calm information blue — time stands still, nothing burns. */
  paused: { ink: 'text-information-700', bg: 'bg-information-50' },
} as const

export type PlannerTone = keyof typeof PLANNER_TONES

export function toneClass(tone: PlannerTone): string {
  return `${PLANNER_TONES[tone].ink} ${PLANNER_TONES[tone].bg}`
}

type Category = PlannerTaskCard['status']['category']

/** The 8px dot of a status category (DESIGN.md `cat-*`), ≥ 3:1 against the card. */
export const CATEGORY_DOT: Record<Category, string> = {
  todo: 'bg-gray-600',
  in_progress: 'bg-secondary-500',
  done: 'bg-success-600',
}

/** The top level of a board's priority scale is the only coloured one (U-35). */
export const PRIORITY_TOP_INK = PLANNER_TONES.soon.ink
