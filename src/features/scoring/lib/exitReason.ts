/**
 * Plain-language reasons a debt is excluded from calling (KAN-791).
 *
 * "Do not call" on its own is an unexplained block on a debt the operator can
 * see is owed — the natural reaction is to assume the system is wrong and call
 * anyway. Naming the ground turns it into an instruction they can act on, and
 * gives an auditor the reason the exclusion was applied.
 */

import i18n from '@/lib/i18n'

export const EXIT_REASON_LABELS: Record<string, string> = {
  deceased: 'Client has died',
  fraud: 'Marked as fraud',
  lawsuit: 'Case is in court',
  paid_off: 'Debt is paid off',
  closed: 'Debt is closed',
}

/** Human text for an exit reason, or a safe fallback when it is unknown. */
export function exitReasonLabel(reason?: string | null): string {
  if (!reason) {
    return i18n.t('pages.scoringV3.exitReasons.unknown', {
      defaultValue: 'Excluded by a compliance rule',
    })
  }
  if (reason in EXIT_REASON_LABELS) {
    return i18n.t(`pages.scoringV3.exitReasons.${reason}`, {
      defaultValue: EXIT_REASON_LABELS[reason],
    })
  }
  return i18n.t('pages.scoringV3.exitReasons.other', {
    reason,
    defaultValue: `Excluded: ${reason}`,
  })
}
