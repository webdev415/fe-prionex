/**
 * Display resolution for the `last_call_at` / `last_call_outcome` pair the
 * report FEEDS carry.
 *
 * Shared by the «Серчер без відпрацювання» (Card 123) and «Вхід без
 * відпрацювання» (Card 122) tabs: both migrate the SAME nine-column source
 * shape, both get their pair from the same call-service endpoint, and both must
 * name the three states identically — a second copy could only drift. (The
 * backend made the same extraction for the guards these two feeds share.)
 *
 * The Metabase cards conflated three different states into one column (their
 * Ukrainian CASE collapsed NULL to an empty string); the API keeps them apart
 * and this helper is where the UI names each one:
 *
 * - `last_call_at` AND `last_call_outcome` both null → no call at all (never
 *   called, or the employee has no telephony seat) → "—";
 * - `last_call_at` set, `last_call_outcome` null (or blank — the column is a
 *   free VARCHAR, and an empty string carries exactly as much information as
 *   NULL) → a call happened but its outcome was never recorded → the
 *   localised "Unknown" label;
 * - a recognised outcome → the label of the app-wide classifier
 *   (`classifyCallOutcome`, src/lib/callOutcome.ts) — the same i18n keys the
 *   call log and monitoring tables already use, so the feeds speak the same
 *   language as the rest of the app and inherit labels for every outcome
 *   call-service emits (missed, rejected, unavailable, failed, …), not just
 *   the ones observed on a production probe;
 * - an UNRECOGNISED non-blank outcome → the raw value, verbatim (the
 *   classifier's own fallback contract). The backend deliberately does not
 *   enum-validate the column, so a future value must neither crash a tab
 *   nor masquerade as "Unknown" — "Unknown" means "a call with no recorded
 *   outcome", and stamping it on a real (just untranslated) outcome would be
 *   a lie an operator acts on. A raw `voicemail` is ugly but truthful.
 *
 * The feeds carry no call direction, so the direction-sensitive outcomes
 * (`cancel`, `no_answer`) get the classifier's outbound wording — its
 * documented default for calls of unknown provenance.
 *
 * Pure data → decision here; the component maps the decision to `t()` keys, so
 * each feed keeps its own "unknown" string in its own i18n subtree.
 * The edge the contracts call impossible — an outcome WITHOUT `last_call_at`
 * — still renders the outcome (showing data beats hiding it).
 */

import { classifyCallOutcome } from '@/lib/callOutcome'

export type CallOutcomeDisplay =
  /** No call at all — render the shared "—" placeholder. */
  | { kind: 'none' }
  /** A call whose outcome was never recorded — render the "unknown" label. */
  | { kind: 'unknown' }
  /** A call with a recognised outcome — render `t(labelKey, fallback)`. */
  | { kind: 'known'; labelKey: string; fallback: string }
  /** A call with an outcome the classifier has no label for — render it verbatim. */
  | { kind: 'raw'; value: string }

export function resolveCallOutcomeDisplay(
  lastCallAt: string | null,
  lastCallOutcome: string | null
): CallOutcomeDisplay {
  if (lastCallOutcome === null || lastCallOutcome.trim() === '') {
    return lastCallAt === null ? { kind: 'none' } : { kind: 'unknown' }
  }
  const { labelKey, fallback } = classifyCallOutcome(lastCallOutcome)
  return labelKey === ''
    ? { kind: 'raw', value: lastCallOutcome }
    : { kind: 'known', labelKey, fallback }
}
