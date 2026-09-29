/**
 * Where the focus goes after a row of the board settings is removed (planner
 * story 5.10; EXPERIENCE.md, Accessibility Floor): the removed row took the
 * focused «Видалити» with it, so the focus moves to the neighbour instead of
 * falling to the page.
 */
import { useEffect } from 'react'

/**
 * The last «Видалити» pressed. Its row leaves the DOM (at once, or after the
 * page asked the server and «Перенести N задач у…»), the browser drops the
 * focus on `body`, and `useFocusAfterRemove` puts it on the next row's
 * «Видалити» — or the previous one, or the list's «+ …» (EXPERIENCE.md,
 * Accessibility Floor: the focus never falls to the page).
 */
let pendingRemoval: {
  button: HTMLElement
  list: HTMLElement
  /** The list's container, where its «+ …» is (the list may unmount when empty). */
  scope: HTMLElement | null
  index: number
} | null = null
let restoreTimer: number | undefined

const REMOVE = '[data-settings-remove]'
const ADD = '[data-settings-add]'
const DIALOG = '[role="dialog"], [role="alertdialog"]'

/** «Видалити» buttons of this list only — not of the lists nested in its rows. */
function removeButtonsOf(list: HTMLElement): HTMLElement[] {
  return [...list.querySelectorAll<HTMLElement>(REMOVE)].filter(
    (button) => button.closest('ol, ul') === list
  )
}

/** Called by «Видалити» (`RemoveButton`) before its row is removed. */
export function rememberRemoval(button: HTMLElement) {
  const list = button.closest<HTMLElement>('ol, ul')
  if (!list) return
  pendingRemoval = {
    button,
    list,
    scope: list.parentElement,
    index: removeButtonsOf(list).indexOf(button),
  }
}

function restoreFocus(attempt: number) {
  const pending = pendingRemoval
  if (!pending) return
  // The row is still there: the removal is being checked, or was refused.
  if (pending.button.isConnected) return
  const active = document.activeElement
  // A dialog is closing (its exit animation): its focus return comes first.
  if (active?.closest(DIALOG) && attempt < 20) {
    restoreTimer = window.setTimeout(() => restoreFocus(attempt + 1), 50)
    return
  }
  pendingRemoval = null
  // The person moved on — leave the focus where it is.
  if (active && active !== document.body) return
  const enabled = (button: HTMLElement | null | undefined) =>
    button && !(button as HTMLButtonElement).disabled ? button : undefined
  let target: HTMLElement | undefined
  if (pending.list.isConnected) {
    const buttons = removeButtonsOf(pending.list).filter((button) => enabled(button))
    target = buttons[pending.index] ?? buttons[pending.index - 1]
  }
  if (!target) {
    const { list, scope } = pending
    // The «+ …» after the list (a field row has its own «+ Значення» inside).
    const follows = (button: HTMLElement) =>
      !list.isConnected ||
      (!list.contains(button) &&
        Boolean(list.compareDocumentPosition(button) & Node.DOCUMENT_POSITION_FOLLOWING))
    const candidates = scope?.isConnected ? [...scope.querySelectorAll<HTMLElement>(ADD)] : []
    target = candidates.find((button) => follows(button) && enabled(button))
  }
  target?.focus()
}

/**
 * After each render of the editor: if the row of the last «Видалити» is gone
 * and the focus fell to `body`, move it to the neighbour (see `pendingRemoval`).
 */
export function useFocusAfterRemove() {
  useEffect(() => {
    window.clearTimeout(restoreTimer)
    restoreTimer = window.setTimeout(() => restoreFocus(0), 0)
  })
  useEffect(
    () => () => {
      window.clearTimeout(restoreTimer)
      pendingRemoval = null
    },
    []
  )
}
