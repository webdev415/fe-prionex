/**
 * The «Скасувати» toast of a reversible planner action (planner story 5.1,
 * AC4; UX-DR13): the change is already made, and for five seconds the toast
 * offers to undo it — instead of a confirmation before it. Irreversible
 * actions (delete, cancel an event, archive a board) ask first with the CRM
 * `useConfirm` dialog and get no undo toast.
 *
 * The timer is sonner's own: it lives with the toast, not with the component
 * that raised it, so nothing is left running when a card unmounts.
 */
import { toast } from 'sonner'

export const PLANNER_UNDO_MS = 5000

interface UndoToast {
  message: string
  undoLabel: string
  onUndo: () => void
}

export function showUndoToast({ message, undoLabel, onUndo }: UndoToast): void {
  toast.success(message, {
    duration: PLANNER_UNDO_MS,
    action: { label: undoLabel, onClick: onUndo },
  })
}
