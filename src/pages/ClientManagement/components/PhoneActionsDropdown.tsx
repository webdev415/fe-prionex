import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import { Icons } from '@/lib/icons'
import { cn } from '@/lib/utils'
import { piiProps } from '@/lib/openreplay/pii'
import { formatDateTime } from '@/lib/localeFormat'
import { useAuthStore } from '@/stores/authStore'
import type { PhoneHighlightState } from '@/features/clients/utils/phoneHighlight'

/** Gap between the highlighted number and the panel, in px. */
const GAP = 4
/** Keep the panel this far from the viewport edges when clamping. */
const EDGE = 8

export interface PhoneActionsDropdownProps {
  /** The number as it appears in the comment — bare `380` + 9 digits. */
  phone: string
  /** Decides the tag and whether "Add contact" is offered. */
  state: PhoneHighlightState
  /** The highlighted `<span>` the panel is positioned against. */
  anchor: HTMLElement
  /** ISO instant of the last call, or null when nobody has ever called. */
  lastCallAt: string | null
  /** True while the last-call lookup is still in flight. */
  isLoadingLastCall?: boolean
  onCall: () => void
  onAddContact: () => void
  onCopy: () => void
  onClose: () => void
}

interface Position {
  top: number
  left: number
}

/**
 * The panel opened by clicking a highlighted number in the primary creditor's
 * comment (KAN-1212).
 *
 * Presentational on purpose: it knows the number, what the number IS, and when
 * it was last called — nothing about calling, contacts or tabs. Every action is
 * a callback, so the page keeps its own guards (a call already in progress, the
 * calling-window block) rather than this component growing a second copy of
 * them.
 *
 * Not built on the Radix ``DropdownMenu``: that is trigger-driven, and the
 * trigger here is a ``<span>`` injected into ``dangerouslySetInnerHTML`` output,
 * so there is no React child to hang a ``<Trigger>`` on. The panel is portaled
 * and positioned from the anchor's rect instead, which is also what the
 * flip-above rule needs.
 */
export function PhoneActionsDropdown({
  phone,
  state,
  anchor,
  lastCallAt,
  isLoadingLastCall = false,
  onCall,
  onAddContact,
  onCopy,
  onClose,
}: PhoneActionsDropdownProps) {
  const { t, i18n } = useTranslation('common')
  const user = useAuthStore((state) => state.user)
  const panelRef = useRef<HTMLDivElement>(null)
  const [position, setPosition] = useState<Position | null>(null)

  // Measured after mount, not during: the flip decision needs the panel's own
  // height, which only exists once it has rendered. Until then it is rendered
  // hidden (below) so the measurement never flashes in the wrong place.
  useLayoutEffect(() => {
    const panel = panelRef.current
    if (!panel) return

    // A detached anchor measures as all zeros, and the clamp below turns that
    // into top:4 left:8 — the panel silently parks in the top-left corner,
    // pointing at a number that is no longer on the page. Close instead: there
    // is nothing left to anchor to.
    if (!anchor.isConnected) {
      onClose()
      return
    }

    const rect = anchor.getBoundingClientRect()
    const { offsetHeight: height, offsetWidth: width } = panel

    // Flip above only when there is genuinely room there; a number near the
    // bottom of a short viewport would otherwise flip into an even smaller gap.
    const fitsBelow = window.innerHeight - rect.bottom >= height + GAP
    const fitsAbove = rect.top >= height + GAP
    const top = !fitsBelow && fitsAbove ? rect.top - height - GAP : rect.bottom + GAP

    const left = Math.min(
      Math.max(rect.left, EDGE),
      Math.max(window.innerWidth - width - EDGE, EDGE)
    )

    setPosition({ top, left })
  }, [anchor, onClose])

  useEffect(() => {
    // Outside click, resize and scroll all close it. Scroll is listened for in
    // the CAPTURE phase: the comment sits in a nested scroll container, and a
    // bubbling listener on window never sees that element's own scroll events.
    // Without it the panel — position:fixed against a rect measured once —
    // would stay pinned to the viewport while its number slides away.
    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as Node
      if (panelRef.current?.contains(target)) return
      // A click on the number itself is the caller's to interpret (it toggles),
      // so it is not treated as "outside" here.
      if (anchor.contains(target)) return
      onClose()
    }
    const onEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }

    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('keydown', onEscape)
    window.addEventListener('resize', onClose)
    window.addEventListener('scroll', onClose, true)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('keydown', onEscape)
      window.removeEventListener('resize', onClose)
      window.removeEventListener('scroll', onClose, true)
    }
  }, [anchor, onClose])

  const lastCallLabel = (() => {
    if (isLoadingLastCall) return '…'
    if (!lastCallAt) return t('pages.client.commentPhones.never', 'Never')
    // The shared formatter, not a fixed pattern: the instant is stamped by the
    // backend, so it must be read in the operator's PROFILE timezone rather
    // than whatever zone their browser happens to be in. Locale-aware, so uk
    // renders 12.03.2026, 16:05 and en 03/12/2026, 16:05.
    return formatDateTime(lastCallAt, i18n.language, user?.timezone)
  })()

  const isKnown = state === 'known'

  return createPortal(
    <div
      ref={panelRef}
      role="dialog"
      // Deliberately NOT the number: OpenReplay sends title/aria-label/alt
      // verbatim even from obscured nodes, so putting the phone in either
      // would leak exactly what piiProps is masking on the node below.
      aria-label={t('pages.client.commentPhones.panelAria', 'Phone number actions')}
      className="border-border bg-card text-foreground fixed z-[200] min-w-[14rem] overflow-hidden rounded-md border p-1 shadow-md"
      style={{
        top: position?.top ?? 0,
        left: position?.left ?? 0,
        visibility: position ? 'visible' : 'hidden',
      }}
    >
      <div className="border-border border-b px-2 py-1.5">
        <div className="text-sm font-semibold" {...piiProps}>
          {phone}
        </div>
        <div className="text-muted-foreground mt-0.5 text-xs">
          {t('pages.client.commentPhones.lastCall', 'Last call')}: {lastCallLabel}
        </div>
        <span
          className={cn(
            'mt-1.5 inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
            isKnown ? 'bg-green-100 text-green-800' : 'bg-orange-100 text-orange-800'
          )}
        >
          {isKnown
            ? t('pages.client.commentPhones.savedContact', 'Saved contact')
            : t('pages.client.commentPhones.notContact', 'Not a contact')}
        </span>
      </div>

      <div className="pt-1">
        <button
          type="button"
          onClick={onCall}
          className="focus:bg-muted hover:bg-muted flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm transition-colors outline-none"
        >
          <Icons.Phone size={16} />
          {/* The page's existing label, not a second copy of it. */}
          {t('pages.clients.detail.call', 'Call')}
        </button>

        {/* AC: offered for new numbers only — a saved contact has nothing to add. */}
        {!isKnown && (
          <button
            type="button"
            onClick={onAddContact}
            className="focus:bg-muted hover:bg-muted flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm transition-colors outline-none"
          >
            <Icons.Add size={16} />
            {t('pages.clients.editModal.addContact', 'Add Contact')}
          </button>
        )}

        <button
          type="button"
          onClick={onCopy}
          className="focus:bg-muted hover:bg-muted flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm transition-colors outline-none"
        >
          <Icons.Copy size={16} />
          {t('pages.client.commentPhones.copyPhone', 'Copy phone')}
        </button>
      </div>
    </div>,
    document.body
  )
}
