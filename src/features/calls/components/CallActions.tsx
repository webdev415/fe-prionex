import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/Button'
import { Icons } from '@/lib/icons'

export type CallPhase = 'ringing' | 'connected'

interface CallActionsProps {
  phase: CallPhase
  /** Take the call. Ringing only. */
  onAccept?: () => void
  /** Hang up, from either phase. */
  onCancel: () => void
  /** Park the caller. Connected only. */
  onHold?: () => void
  acceptPending?: boolean
  holdPending?: boolean
  cancelPending?: boolean
}

/**
 * The call's own controls, below the interaction form.
 *
 * There is no close button in either phase by design: the window must not be
 * dismissable while the line is up, so leaving is Cancel (hang up) or minimise.
 */
export function CallActions({
  phase,
  onAccept,
  onCancel,
  onHold,
  acceptPending = false,
  holdPending = false,
  cancelPending = false,
}: CallActionsProps) {
  const { t } = useTranslation('common')
  // Answering from the CRM needs an Asterisk dialplan that not every deployment
  // has; without it the operator picks up on their handset as before. Hiding
  // the button is the honest state — one that 503s reads as a broken feature.
  const canAccept = phase === 'ringing' && Boolean(onAccept)

  return (
    <div className="flex shrink-0 flex-col gap-2 sm:gap-3">
      {/* No "skip saving" control: filing nothing is simply hanging up without
          having saved, and an interaction cannot be revised once filed. */}
      <div className="flex flex-col gap-2 sm:flex-row sm:gap-3">
        <Button
          variant="danger"
          size="sm"
          onClick={onCancel}
          disabled={cancelPending}
          className="w-full rounded-md"
        >
          <Icons.Cancel01 size={18} className="mr-2 sm:size-5" aria-hidden />
          {t('pages.clients.modals.callDialog.cancel', 'Cancel')}
        </Button>

        {canAccept && (
          <Button
            variant="success"
            size="sm"
            onClick={onAccept}
            disabled={acceptPending}
            className="w-full rounded-md"
          >
            <Icons.Phone size={18} className="mr-2 sm:size-5" aria-hidden />
            {t('pages.clients.modals.callDialog.accept', 'Accept')}
          </Button>
        )}

        {phase === 'connected' && onHold && (
          <Button
            variant="secondary"
            size="sm"
            onClick={onHold}
            disabled={holdPending}
            className="bg-foreground text-background hover:bg-foreground/90 w-full rounded-md"
          >
            <Icons.Pause size={18} className="mr-2 sm:size-5" aria-hidden />
            {t('pages.clients.modals.callDialog.hold', 'Hold')}
          </Button>
        )}
      </div>

      {phase === 'ringing' && !canAccept && (
        <p className="text-muted-foreground text-center text-xs">
          {t(
            'pages.clients.modals.callDialog.answerOnSoftphone',
            'Answer the call on your softphone'
          )}
        </p>
      )}
    </div>
  )
}
