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
import { resolveHotkeyTarget } from './hotkey'
import { useTAHotkeyBindings } from './TEMPORARY_bindingsSource'

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
      const templateId = resolveHotkeyTarget(event, current.bindings)

      // Unassigned, or the operator is typing: leave the keystroke completely
      // alone, including its default behaviour. Bare-key bindings mean most
      // keys reaching this point are not ours.
      if (templateId === null) return

      // From here the combination IS ours, so the browser must not also act on
      // it — Ctrl+1 would otherwise switch tabs while we open a modal. This
      // happens even when the launch is refused below, so a bound key behaves
      // consistently whatever the modal state.
      event.preventDefault()

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
