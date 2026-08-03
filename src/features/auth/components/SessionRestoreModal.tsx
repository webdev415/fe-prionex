/**
 * KAN-585 — Session Restore Modal.
 *
 * Shown by GuestRoute immediately after login when the user has
 * stored tabs from a previous session.
 *
 * Q6 lock: ALWAYS shown when stored tabs exist (regardless of
 *   returnUrl in the URL). Restore discards returnUrl; Start Fresh
 *   honors returnUrl.
 * Q8 lock: Blocking modal — no Escape, no background-click dismissal.
 *   User must click one of the two buttons.
 * Q9 lock: Count + 2 buttons only. No URL list.
 */

import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/Button'

interface Props {
  count: number
  isExecuting?: boolean
  onRestore: () => void
  onStartFresh: () => void
}

export function SessionRestoreModal({ count, isExecuting, onRestore, onStartFresh }: Props) {
  const { t } = useTranslation('common')
  const p = 'auth.sessionRestore'

  // Q8 lock: backdrop is purely visual. No click/key handlers — the
  // modal can ONLY be dismissed by clicking one of the two buttons.
  return (
    <div
      className="bg-overlay fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="session-restore-modal-title"
    >
      <div className="bg-card text-card-foreground w-full max-w-md rounded-xl p-6 shadow-xl sm:p-8">
        <h2 id="session-restore-modal-title" className="text-foreground mb-3 text-lg font-medium">
          {t(`${p}.title`, 'Resume previous session?')}
        </h2>
        <p className="text-muted-foreground mb-6 text-sm">
          {t(`${p}.body`, {
            defaultValue:
              'You have {{count}} open tabs from your previous session. Would you like to continue?',
            count,
          })}
        </p>
        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <Button variant="cancel" size="md" onClick={onStartFresh} disabled={isExecuting}>
            {t(`${p}.startFreshButton`, 'Start Fresh')}
          </Button>
          <Button
            variant="primary"
            size="md"
            onClick={onRestore}
            disabled={isExecuting}
            isLoading={isExecuting}
          >
            {t(`${p}.restoreButton`, 'Restore Session')}
          </Button>
        </div>
      </div>
    </div>
  )
}
