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
 * modal on every pick. ``SearchableSelect``, the control this replaces, is
 * absolutely positioned inside its own wrapper for the same reason.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { useOperatorPins, usePinOperator, useUnpinOperator } from '@/features/users'
import { Icons } from '@/lib/icons'
import { cn } from '@/lib/utils'
import { AssigneeOptionList, type AssigneeOption } from './AssigneeOptionList'

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
        <span className="min-w-0 flex-1">
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
        <div className="border-border bg-card absolute top-[calc(100%+4px)] right-0 left-0 z-[200] rounded-lg border p-1.5 shadow-lg">
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
