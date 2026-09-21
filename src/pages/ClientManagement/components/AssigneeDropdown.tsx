/**
 * Inline assignee picker for the client card's "Responsible employee" and
 * "Responsible searcher" rows.
 *
 * Replaces the Assign Employee modal on these two rows: one click assigns, with
 * no Cancel/Assign step and no reason to choose — the reason is fixed, because
 * the field the modal asked for is not shown here.
 *
 * Saving follows the two controls that already do this on the client card (the
 * contact-tag dropdown, and the assign modal itself): the request is awaited,
 * the popover closes only once it succeeds, and a failure leaves it open with
 * the list intact so the operator can retry. The alternative — updating the row
 * and closing on click — would show a name the server never accepted, after the
 * operator has already looked away.
 *
 * Both rows render this same component; `slot` is the only difference.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  FloatingPortal,
  autoUpdate,
  flip,
  offset,
  shift,
  useClick,
  useDismiss,
  useFloating,
  useInteractions,
} from '@floating-ui/react'
import { toast } from 'sonner'

import { Icons } from '@/lib/icons'
import { cn } from '@/lib/utils'
import { useOperators, useOperatorPins, usePinOperator, useUnpinOperator } from '@/features/users'
import { useAssignClient } from '@/features/clients/hooks/useClients'
import { useAuthStore } from '@/stores/authStore'
import { useHasPermission } from '@/hooks/usePermissions'
import { useGuardedAction } from '@/hooks/useGuardedAction'
import { PERMISSIONS } from '@/constants/permissions'
import { HOTKEY_PASSTHROUGH_TRIGGER_ATTR } from '@/features/taHotkeys/hotkey'
import { ASSIGNEE_FOCUS_RING, AssigneeOptionList } from './AssigneeOptionList'

// Outside-press zones, matched with element.closest() so the check never
// depends on ref timing. Same approach as the contact-tag dropdown.
const ATTR_POPOVER = 'data-asgn-popover'
const ATTR_TRIGGER = 'data-asgn-trigger'

/** The reason the backend records for every assignment made from this control.
 *  Fixed because the popover deliberately does not ask for one. */
const FIXED_REASON = 'Reassignment'

export type AssigneeRole = 'employee' | 'searcher'

interface Props {
  clientId: number
  slot: AssigneeRole
  /** Who currently holds this slot, or null when it is empty. */
  currentUserId: number | null
  isOpen: boolean
  onOpen: () => void
  onClose: () => void
  'data-testid'?: string
}

export function AssigneeDropdown({
  clientId,
  slot,
  currentUserId,
  isOpen,
  onOpen,
  onClose,
  'data-testid': dataTestId,
}: Props) {
  const { t } = useTranslation('common')
  const activeProjectId = useAuthStore((s) => s.user?.active_project_id)

  const [isSaving, setIsSaving] = useState(false)
  const triggerRef = useRef<HTMLButtonElement | null>(null)

  // Permission model, unchanged from the modal this replaces: filling an empty
  // slot is an initial assignment (edit_clients); changing or clearing one that
  // already holds somebody is a reassignment. Clearing counts because the slot
  // held a value and no longer does.
  const hasReassignPerm = useHasPermission(PERMISSIONS.CLIENTS.REASSIGN_RESPONSIBLE)
  const guardBaseAssign = useGuardedAction(PERMISSIONS.CLIENTS.EDIT, 'errors:permissions.required')

  const { refs, floatingStyles, context } = useFloating({
    open: isOpen,
    onOpenChange: (open) => (open ? onOpen() : onClose()),
    placement: 'bottom-end',
    // flip() turns the popover upward when there is no room below; autoUpdate
    // keeps it on the trigger while the card scrolls.
    middleware: [offset(6), flip(), shift({ padding: 8 })],
    whileElementsMounted: autoUpdate,
  })

  const click = useClick(context)
  const dismiss = useDismiss(context, { outsidePress: false })
  const { getReferenceProps, getFloatingProps } = useInteractions([click, dismiss])

  // Combined ref must be stable: Floating UI updates its internal reference
  // state on every setReference call, so an inline callback (new function each
  // render) triggers detach/attach → state update → re-render → new function →
  // infinite loop. Memoized on ``refs``, which is itself stable.
  const setTriggerRef = useCallback(
    (node: HTMLButtonElement | null) => {
      refs.setReference(node)
      triggerRef.current = node
    },
    [refs]
  )

  // Held back until the popover opens. The list runs to a few hundred
  // operators, and a client card mounts two of these triggers that may never be
  // clicked. The page happens to request the same query elsewhere today, so
  // gating costs nothing now — it stops this popover from silently becoming the
  // eager fetch if that other caller is ever removed or re-keyed.
  const { data: operators = [], isLoading } = useOperators(
    activeProjectId ? Number(activeProjectId) : null,
    { enabled: isOpen }
  )
  const assignMutation = useAssignClient()

  // Held back until the popover opens, like the operator list above it. Both
  // rows on a card share one cached set, which is what makes the pins the same
  // in the employee and searcher popovers without either knowing about the other.
  const { data: pinnedIds } = useOperatorPins(isOpen)
  const pinOperator = usePinOperator()
  const unpinOperator = useUnpinOperator()

  const onCloseRef = useRef(onClose)
  useEffect(() => {
    onCloseRef.current = onClose
  }, [onClose])

  // Outside press closes without changing anything.
  useEffect(() => {
    if (!isOpen) return
    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Element | null
      if (target?.closest(`[${ATTR_TRIGGER}]`) || target?.closest(`[${ATTR_POPOVER}]`)) return
      onCloseRef.current()
    }
    document.addEventListener('pointerdown', handlePointerDown)
    return () => document.removeEventListener('pointerdown', handlePointerDown)
  }, [isOpen])

  // Focus moves to the search box on open — the list autofocuses it as it
  // mounts — and back to the trigger on close, below. The typed query needs no
  // clearing: it lives in the list, which unmounts with the popover.
  const handleClose = useCallback(() => {
    onClose()
    // Focus returns to the trigger so the control stays keyboard-operable and
    // focus is not stranded on the unmounted popover.
    triggerRef.current?.focus()
  }, [onClose])

  // Escape closes without changes, like an outside press.
  useEffect(() => {
    if (!isOpen) return
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        handleClose()
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, handleClose])

  // Resizing closes the popover rather than re-anchoring it. `autoUpdate` would
  // happily keep it glued to the trigger, so this is a deliberate choice, not a
  // gap: a resize is usually a layout change big enough that the row the
  // operator aimed at has moved somewhere else on screen, and silently
  // re-placing an open list over new content invites a mis-click. Reopening is
  // one click.
  useEffect(() => {
    if (!isOpen) return
    const handleResize = () => handleClose()
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [isOpen, handleClose])

  const save = useCallback(
    async (nextUserId: number | null) => {
      if (isSaving) return

      // Clearing a populated slot, or swapping one operator for another, is a
      // reassignment. Warned about here rather than left to fail at the server,
      // matching how the modal gated its Submit.
      const isReassignment = currentUserId !== null && nextUserId !== currentUserId
      if (isReassignment && !hasReassignPerm) {
        toast.warning(t('errors:permissions.reassignClient'))
        return
      }

      guardBaseAssign(() => {
        setIsSaving(true)
        assignMutation.mutate(
          {
            clientId,
            data: {
              // Only the slot this row owns is named. The other is omitted, not
              // nulled — omitting leaves it alone, while null would clear it.
              [slot === 'employee' ? 'responsible_employee_id' : 'responsible_searcher_id']:
                nextUserId,
              assignment_reason: FIXED_REASON,
            },
          },
          {
            // The mutation already toasts both outcomes; closing is the only
            // thing this call site decides. A failure keeps the popover open.
            onSuccess: () => {
              setIsSaving(false)
              handleClose()
            },
            onError: () => setIsSaving(false),
          }
        )
      })
    },
    [
      isSaving,
      currentUserId,
      hasReassignPerm,
      guardBaseAssign,
      assignMutation,
      clientId,
      slot,
      handleClose,
      t,
    ]
  )

  const triggerTitle =
    slot === 'employee'
      ? t('pages.clients.detail.assignEmployee', 'Assign employee')
      : t('pages.clients.detail.assignSearcher', 'Assign searcher')

  return (
    <>
      <button
        ref={setTriggerRef}
        type="button"
        data-testid={dataTestId}
        {...{ [ATTR_TRIGGER]: '', [HOTKEY_PASSTHROUGH_TRIGGER_ATTR]: '' }}
        {...getReferenceProps()}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        className={cn(
          'shrink-0 transition-colors',
          isOpen ? 'text-primary-500' : 'text-muted-foreground hover:text-foreground'
        )}
        title={triggerTitle}
      >
        <Icons.PencilEdit02 size={14} strokeWidth={1.5} />
      </button>

      {isOpen && (
        <FloatingPortal>
          <div
            /* eslint-disable-next-line react-hooks/refs -- Floating UI's
               `setFloating` is a callback ref, not a ref object, so nothing
               is read during render. The rule's inference misreads it:
               reproduced on a 28-line component containing only
               useFloating + FloatingPortal + a controlled input. */
            ref={refs.setFloating}
            style={floatingStyles}
            {...{ [ATTR_POPOVER]: '' }}
            {...getFloatingProps()}
            className="border-border bg-card z-50 w-67 rounded-lg border p-1.5 shadow-lg"
          >
            <AssigneeOptionList
              operators={operators}
              isLoading={isLoading}
              selectedId={currentUserId}
              onSelect={(operatorId) => save(operatorId)}
              disabled={isSaving}
              autoFocusSearch
              listLabel={triggerTitle}
              pinnedIds={pinnedIds}
              onTogglePin={(operatorId, nextPinned) =>
                nextPinned ? pinOperator.mutate(operatorId) : unpinOperator.mutate(operatorId)
              }
              footer={
                currentUserId !== null ? (
                  <button
                    type="button"
                    role="option"
                    aria-selected={false}
                    disabled={isSaving}
                    onClick={() => save(null)}
                    className={cn(
                      'text-muted-foreground flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs',
                      ASSIGNEE_FOCUS_RING,
                      !isSaving && 'hover:bg-muted cursor-pointer',
                      isSaving && 'cursor-wait opacity-60'
                    )}
                  >
                    <Icons.Cancel01 size={12} className="shrink-0" />
                    {t('pages.clients.assignee.unassign', 'Unassign')}
                  </button>
                ) : null
              }
            />
          </div>
        </FloatingPortal>
      )}
    </>
  )
}
