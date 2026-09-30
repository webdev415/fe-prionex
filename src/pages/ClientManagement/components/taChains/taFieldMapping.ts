/**
 * Pure helpers for mapping TA-interaction `step_data` to display/edit fields.
 *
 * Two bugs these guard against (field-mapping family, cf. KAN-453):
 *  - Bug 1: a date value (e.g. "2026-05-15T10:30:00") was treated as a phone
 *    and shown in the Phone column of the interaction history.
 *  - Bug 2: an empty loan/credit step inherited another step's value (a phone)
 *    in the edit modal, because the value was looked up by target_action_id
 *    (not step-specific) and could collide across steps that share a TA.
 */

import { legacyKeyIsUnambiguous, readStepValue } from '@/lib/taStepValue'

export interface StepLike {
  step_order: number
  target_action_id: number
  target_action_field_type?: string | null
}

/**
 * Whether a value looks like a phone number.
 *
 * A phone may only contain digits and phone formatting (space, `+`, `-`,
 * parentheses) and have 10–15 digits. Anything else — commas (debt-id lists),
 * colons/slashes/`T` (date & datetime values), or letters (dropdown labels) —
 * is rejected up front. This is what stops a datetime like
 * "2026-05-15T10:30:00" (14 digits) from being mistaken for a phone.
 */
export function isPhoneShaped(val: string): boolean {
  if (typeof val !== 'string') return false
  if (/[^\d\s()+-]/.test(val)) return false
  const digits = val.replace(/\D/g, '')
  return digits.length >= 10 && digits.length <= 15
}

/**
 * Extract the phone number(s) to show in the interaction-history Phone column.
 *
 * Pulls values from contact-typed steps (preferred), plus a drift-recovery
 * scan of all values (covers a step retyped away from contact). Every value is
 * shape-checked, so dates / dropdown labels / debt ids never leak in.
 */
export function extractPhones(
  stepData: Record<string, unknown> | null | undefined,
  steps: StepLike[]
): string[] {
  if (!stepData) return []
  const phones = new Set<string>()
  const ordered = [...steps].sort((a, b) => a.step_order - b.step_order)
  for (const step of ordered) {
    if (step.target_action_field_type !== 'contact') continue
    const val = readStepValue(stepData, step, ordered)
    if (typeof val === 'string' && isPhoneShaped(val)) phones.add(val)
  }
  for (const val of Object.values(stepData)) {
    if (typeof val === 'string' && isPhoneShaped(val)) phones.add(val)
  }
  return Array.from(phones)
}

export interface DebtLike {
  id: number
  status?: string | null
}

/**
 * Filter the debt list for a credit step's picker in the edit modal.
 *
 * Hides closed debts unless the step's `show_closed_credits` flag is set — but
 * always keeps a closed debt that is **already selected** on the interaction,
 * so editing never silently drops a previously-chosen credit. Mirrors the
 * recording flow (ChainExecutor) so both screens stay consistent (Bug 4).
 */
export function visibleCredits<T extends DebtLike>(
  debts: T[],
  showClosedCredits: boolean | undefined,
  selectedIds: Array<string | number> = []
): T[] {
  if (showClosedCredits) return debts
  const selected = new Set(selectedIds.map(String))
  return debts.filter(
    (d) => (d.status ?? '').toLowerCase() !== 'closed' || selected.has(String(d.id))
  )
}

function unwrapValue(raw: unknown): string {
  if (raw == null) return ''
  if (typeof raw === 'object') {
    const inner = (raw as Record<string, unknown>).value
    return inner != null ? String(inner) : ''
  }
  return String(raw)
}

/**
 * Resolve a single step's saved value for the edit modal, step-specifically.
 *
 * Order of preference:
 *   1. wizard snapshot (`instanceStepData`) keyed by step_order
 *   2. `interactionStepData` keyed by step_order
 *   3. legacy `interactionStepData` keyed by target_action_id — but only where
 *      that key unambiguously names this step. `legacyKeyIsUnambiguous` owns
 *      that rule; when it declines, the honest answer is '' rather than another
 *      step's value.
 */
export function resolveStepValue(
  step: StepLike,
  allSteps: StepLike[],
  instanceStepData: Record<string, unknown> | null | undefined,
  interactionStepData: Record<string, unknown> | null | undefined
): string {
  const snap = instanceStepData?.[String(step.step_order)]
  if (snap && typeof snap === 'object') {
    const v = (snap as { value?: unknown }).value
    if (v != null && String(v) !== '') return String(v)
  }

  const byOrder = unwrapValue(interactionStepData?.[String(step.step_order)])
  if (byOrder !== '') return byOrder

  if (legacyKeyIsUnambiguous(step, allSteps)) {
    return unwrapValue(interactionStepData?.[String(step.target_action_id)])
  }
  return ''
}

export interface CreditStepLike {
  step_order: number
  field_type?: string | null
}

/**
 * The credit ids an interaction actually recorded, taken ONLY from the
 * chain's credit-type steps.
 *
 * Why "credit-type steps only": a debt id can drift into a non-credit step's
 * slot (a phantom). The history used to surface any debt-id-shaped value from
 * any step as a credit, so a stray id in an empty dropdown step showed up as a
 * second credit — making a one-credit-step chain look like it had two
 * (KAN-744). Reading only the credit steps mirrors what the Edit modal shows.
 *
 * `resolvedStepData` must already be snapshot-first (see resolveStepValue), so
 * a credit step that holds several picks (e.g. "162040,257867") returns every
 * one, while a non-credit step's drifted value is ignored. Ids are returned in
 * step order, de-duplicated, preserving multi-select.
 */
export function creditIdsFromCreditSteps(
  steps: CreditStepLike[],
  resolvedStepData: Record<string, string>
): string[] {
  const out: string[] = []
  const seen = new Set<string>()
  for (const step of [...steps].sort((a, b) => a.step_order - b.step_order)) {
    if (step.field_type !== 'credit') continue
    const value = resolvedStepData[String(step.step_order)]
    if (!value) continue
    for (const id of value
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)) {
      if (seen.has(id)) continue
      seen.add(id)
      out.push(id)
    }
  }
  return out
}
