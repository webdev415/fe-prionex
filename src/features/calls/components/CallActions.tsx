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
  /** Dismiss the interaction form without filing anything. Connected only. */
  onIgnoreInteraction?: () => void
  acceptPending?: boolean
  holdPending?: boolean
  cancelPending?: boolean
  /** True once an interaction has been filed, so there is nothing left to skip. */
  interactionSettled?: boolean
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
  onIgnoreInteraction,
  acceptPending = false,
  holdPending = false,
  cancelPending = false,
  interactionSettled = false,
}: CallActionsProps) {
  const { t } = useTranslation('common')

  return (
    <div className="flex shrink-0 flex-col gap-2 sm:gap-3">
      {phase === 'connected' && onIgnoreInteraction && !interactionSettled && (
        <button
          type="button"
          onClick={onIgnoreInteraction}
          className="text-muted-foreground hover:text-foreground text-xs font-medium underline-offset-2 hover:underline"
        >
          {t('pages.clients.modals.callDialog.ignoreInteraction', 'Ignore Interaction')}
        </button>
      )}

      <div className="flex flex-col gap-2 sm:flex-row sm:gap-3">
        <Button
          variant="danger"
          size="sm"
          onClick={onCancel}
          disabled={cancelPending}
          className="w-full rounded-md"
        >
          <Icons.Cancel01 size={18} className="mr-2 sm:size-5" aria-hidden />
          {t('pages.clients.modals.callDialog.reject', 'Cancel')}
        </Button>

        {phase === 'ringing' && onAccept && (
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
    </div>
  )
}
