/**
 * One Tab stop per kanban card (planner story 5.3; UX-DR46, tail of 5.1).
 *
 * A board of 200 cards must not cost a keyboard user a thousand Tab presses:
 * inside a card only the card's own «номер · назва» button is in the Tab
 * order. Its other controls — the status chip, `⋯`, the SLA pill and the
 * priority icon with their tooltips, the origin link, the avatars — leave the
 * order (`tabIndex = -1`) and are reached with ← → inside the card. Outside a
 * card (a list row, the task panel) nothing changes.
 */
import { createContext, useContext } from 'react'

export const InsideKanbanCard = createContext(false)

/** `-1` inside a kanban card, `undefined` elsewhere (the control's own default). */
export function useCardTabIndex(): -1 | undefined {
  return useContext(InsideKanbanCard) ? -1 : undefined
}
