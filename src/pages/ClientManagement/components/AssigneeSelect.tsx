/**
 * The employee picker used inside the assign modals.
 *
 * Same list as the client card's inline popover — search, name over department,
 * a tick on the current choice — so there is one operator list in the product
 * rather than one per control. What differs is what a click means: here it
 * only fills the field, and the modal's own Assign button still decides when
 * anything is saved.
 *
 * Rendered INLINE rather than through a portal, unlike the card's popover. The
 * modals are Radix dialogs that close on a pointer-down outside their content,
 * and a portalled panel is outside it — so portalling would dismiss the whole
 * modal on every pick.
 *
 * It is positioned with ``strategy: 'fixed'`` rather than ``absolute``, though,
 * because the modals' body scrolls: an absolute panel is clipped by that scroll
 * box, and near its bottom most of the list was cut off. A fixed panel is laid
 * out against the dialog box itself (whose transform makes it the containing
 * block), which the scroll box cannot clip. It stays a DOM child of this
 * wrapper, so the dialog still counts it as inside. ``flip`` opens it upward
 * when there is no room below, and ``size`` caps it to the space there is.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { autoUpdate, flip, offset, shift, size, useFloating } from '@floating-ui/react'

import { useOperatorPins, usePinOperator, useUnpinOperator } from '@/features/users'
import { Icons } from '@/lib/icons'
import { piiProps } from '@/lib/openreplay/pii'
import { cn } from '@/lib/utils'
import { AssigneeOptionList, type AssigneeOption } from './AssigneeOptionList'

/** Keeps the panel off the very edge of the space it is measured against. */
const PANEL_EDGE_PADDING = 8
/** Below this the list is unusable; better to overlap than to shrink further. */
const PANEL_MIN_HEIGHT = 160

interface Props {
  id?: string
  operators: AssigneeOption[]
  isLoading?: boolean
  /** The staged selection, as the modals hold it: an id string, or '' for none. */
  value: string
  onValueChange: (value: string) => void
  placeholder?: string
  disabled?: boolean
}

export function AssigneeSelect({
  id,
  operators,
  isLoading = false,
  value,
  onValueChange,
  placeholder,
  disabled = false,
}: Props) {
  const { t } = useTranslation('common')
  const [isOpen, setIsOpen] = useState(false)
  const wrapperRef = useRef<HTMLDivElement | null>(null)

  // Fetched here rather than passed down, so the modals that host this control
  // need no changes to gain pinning — the requirement that both use the same
  // dropdown is then satisfied by construction rather than by wiring.
  const { data: pinnedIds } = useOperatorPins(isOpen)
  const pinOperator = usePinOperator()
  const unpinOperator = useUnpinOperator()

  const selectedId = value ? Number(value) : null
  const selected = operators.find((o) => o.id === selectedId) ?? null

  const close = useCallback(() => setIsOpen(false), [])

  const { refs, floatingStyles } = useFloating({
    open: isOpen,
    placement: 'bottom-start',
    strategy: 'fixed',
    middleware: [
      offset(4),
      flip({ padding: PANEL_EDGE_PADDING }),
      shift({ padding: PANEL_EDGE_PADDING }),
      size({
        padding: PANEL_EDGE_PADDING,
        apply({ rects, availableHeight, elements }) {
          Object.assign(elements.floating.style, {
            width: `${rects.reference.width}px`,
            maxHeight: `${Math.max(availableHeight, PANEL_MIN_HEIGHT)}px`,
          })
        },
      }),
    ],
    whileElementsMounted: autoUpdate,
  })

  // Closing on an outside press is scoped to this wrapper, so a click on the
  // other row's picker closes this one and opens that one in a single gesture.
  useEffect(() => {
    if (!isOpen) return
    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node | null
      if (target && wrapperRef.current?.contains(target)) return
      close()
    }
    document.addEventListener('pointerdown', handlePointerDown)
    return () => document.removeEventListener('pointerdown', handlePointerDown)
  }, [isOpen, close])

  // Escape closes the picker only. Radix would otherwise take the same key as
  // "close the modal", losing the operator's half-finished form. Radix listens
  // on `document` in the capture phase and registered first (when the dialog
  // opened), so a `document` listener here would run too late; `window` capture
  // runs before any `document` listener.
  useEffect(() => {
    if (!isOpen) return
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      event.preventDefault()
      event.stopPropagation()
      close()
    }
    window.addEventListener('keydown', handleKeyDown, true)
    return () => window.removeEventListener('keydown', handleKeyDown, true)
  }, [isOpen, close])

  return (
    <div ref={wrapperRef} className="relative w-full">
      <button
        ref={refs.setReference}
        id={id}
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen((open) => !open)}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        className={cn(
          'border-border bg-card flex h-[45px] w-full items-center justify-between gap-2 rounded-md border px-3 text-left',
          disabled && 'cursor-not-allowed opacity-60'
        )}
      >
        {/* The chosen operator's name is masked in session recordings; the
            placeholder is not personal data and stays readable. */}
        <span className="min-w-0 flex-1" {...(selected ? piiProps : {})}>
          {selected ? (
            <>
              <span className="text-foreground block truncate text-sm">{selected.full_name}</span>
              <span className="text-muted-foreground block truncate text-[10px] font-light">
                {selected.department_name || '—'}
              </span>
            </>
          ) : (
            <span className="text-muted-foreground truncate text-sm">
              {placeholder ?? t('pages.clients.assignee.searchPlaceholder', 'Search employee')}
            </span>
          )}
        </span>
        <Icons.ArrowDown size={16} className="text-muted-foreground shrink-0" />
      </button>

      {isOpen && (
        <div
          /* eslint-disable-next-line react-hooks/refs -- Floating UI's
             `setFloating` is a callback ref, not a ref object, so nothing is
             read during render; same false positive as in AssigneeDropdown. */
          ref={refs.setFloating}
          style={floatingStyles}
          className="border-border bg-card z-[200] overflow-y-auto rounded-lg border p-1.5 shadow-lg"
        >
          <AssigneeOptionList
            operators={operators}
            isLoading={isLoading}
            selectedId={selectedId}
            autoFocusSearch
            listLabel={placeholder}
            pinnedIds={pinnedIds}
            onTogglePin={(operatorId, nextPinned) =>
              nextPinned ? pinOperator.mutate(operatorId) : unpinOperator.mutate(operatorId)
            }
            onSelect={(operatorId) => {
              onValueChange(String(operatorId))
              // Only the picker closes. The modal stays open with its Cancel /
              // Assign buttons, which is the behaviour the ticket keeps.
              close()
            }}
          />
        </div>
      )}
    </div>
  )
}
