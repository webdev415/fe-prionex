/**
 * Plain-language reasons a debt is excluded from calling (KAN-791).
 *
 * "Do not call" on its own is an unexplained block on a debt the operator can
 * see is owed — the natural reaction is to assume the system is wrong and call
 * anyway. Naming the ground turns it into an instruction they can act on, and
 * gives an auditor the reason the exclusion was applied.
 */

export const EXIT_REASON_LABELS: Record<string, string> = {
  deceased: 'Client has died',
  fraud: 'Marked as fraud',
  lawsuit: 'Case is in court',
  paid_off: 'Debt is paid off',
  closed: 'Debt is closed',
}

/** Human text for an exit reason, or a safe fallback when it is unknown. */
export function exitReasonLabel(reason?: string | null): string {
  if (!reason) return 'Excluded by a compliance rule'
  return EXIT_REASON_LABELS[reason] ?? `Excluded: ${reason}`
}
