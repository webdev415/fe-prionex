/**
 * KAN-973 — the document-level keydown listener behind TA hotkey quick-launch.
 *
 * Thin by design. Every rule lives in the pure modules next door
 * (`hotkey.ts`, `decideHotkeyLaunch.ts`) where it is unit-tested; this hook
 * only wires them to a real event and a real toast.
 *
 * Listens on `document` rather than a page element because the operator will
 * not have focused anything in particular — they are looking at the client card
 * and reaching for a key. The focus rule that makes that safe is
 * `isTypingTarget`, applied inside `resolveHotkeyTarget`.
 */
import { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { useChainExecutorStore } from '@/stores/chainExecutorStore'
import { decideHotkeyLaunch } from './decideHotkeyLaunch'
import { useTAHotkeyBindings } from './hooks/useTAHotkeys'
import { resolveHotkeyTarget, TA_EXECUTOR_DIALOG_SELECTOR } from './hotkey'

export function useTAHotkeyLaunch(params: {
  /** False on pages/states where quick-launch must not apply (e.g. no client). */
  enabled: boolean
  isExecutorOpen: boolean
  onLaunch: (templateId: number) => void
}): void {
  const { enabled, isExecutorOpen, onLaunch } = params
  const { t } = useTranslation()
  const bindings = useTAHotkeyBindings()
  const hasMinimizedSession = useChainExecutorStore((s) => s.minimized !== null)

  // The listener is attached once and reads current values through this ref.
  // Re-attaching on every change would be correct but noisy, and a stale
  // closure over `isExecutorOpen` would defeat the single-modal guard outright.
  const latest = useRef({ bindings, isExecutorOpen, hasMinimizedSession, onLaunch, t })
  useEffect(() => {
    latest.current = { bindings, isExecutorOpen, hasMinimizedSession, onLaunch, t }
  })

  useEffect(() => {
    if (!enabled) return

    const handleKeyDown = (event: KeyboardEvent) => {
      const current = latest.current
      // The executor's own dialog is exempt from the "inside a dialog counts as
      // typing" rule: otherwise the press is dropped here, the single-modal
      // guard below never runs, and the operator gets silence where the ticket
      // asks for an explanation.
      const templateId = resolveHotkeyTarget(event, current.bindings, {
        exemptDialogSelector: TA_EXECUTOR_DIALOG_SELECTOR,
      })

      // Unassigned, or the operator is typing: leave the keystroke completely
      // alone, including its default behaviour. Bare-key bindings mean most
      // keys reaching this point are not ours.
      if (templateId === null) return

      // From here the combination IS ours, so the browser must not also act on
      // it — Ctrl+1 would otherwise switch tabs while we open a modal. This
      // happens even when the launch is refused below, so a bound key behaves
      // consistently whatever the modal state.
      event.preventDefault()

      // Only now may a repeat be dropped. A held key fires keydown over and
      // over; the first press is the instruction and the rest would either
      // stack up "finish or close the open target action first" toasts or,
      // before the state settles, attempt a second launch. This bails AFTER
      // preventDefault deliberately — bailing first would let every repeat of
      // a bound combination through to the browser, so holding Ctrl+1 opened
      // the modal once and then switched tabs, contradicting the guarantee
      // stated just above.
      if (event.repeat) return

      const decision = decideHotkeyLaunch({
        template: templateId,
        isExecutorOpen: current.isExecutorOpen,
        hasMinimizedSession: current.hasMinimizedSession,
      })

      if (decision.blocked === 'open') {
        toast.info(
          current.t(
            'pages.clientChains.hotkeys.blockedOpen',
            'Finish or close the open target action first'
          )
        )
        return
      }
      if (decision.blocked === 'minimized') {
        toast.info(
          current.t(
            'pages.clientChains.hotkeys.blockedMinimized',
            'Restore or finish the minimized target action first'
          )
        )
        return
      }
      if (decision.launch === null) return

      current.onLaunch(decision.launch)
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [enabled])
}
