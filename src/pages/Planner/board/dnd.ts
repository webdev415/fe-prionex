/**
 * Data carried by a drag on the kanban (planner story 5.3; library
 * `@atlaskit/pragmatic-drag-and-drop`, U-37 — native HTML5 drag and drop, the
 * same mechanism as the CRM legal kanban).
 *
 * The dragged card says which moves its rights allow; every drop target asks
 * that before it lights up, so a place the server would refuse is never
 * offered: another column needs `change_status`, a place inside the card's
 * own column needs `reorder`, and a place between two cards of another column
 * needs both (without `reorder` the server puts the card at the end — the
 * column itself takes it then, not a line between cards).
 */
export const CARD_DRAG = 'planner-card'
export const CARD_TARGET = 'planner-card-target'
export const COLUMN_TARGET = 'planner-column'

export interface CardDragData {
  [key: string]: unknown
  type: typeof CARD_DRAG
  taskId: string
  statusId: string
  changeStatus: boolean
  reorder: boolean
}

export interface CardTargetData {
  [key: string]: unknown
  type: typeof CARD_TARGET
  taskId: string
  statusId: string
}

export interface ColumnTargetData {
  [key: string]: unknown
  type: typeof COLUMN_TARGET
  statusId: string
}

export function isCardDrag(data: Record<string, unknown>): data is CardDragData {
  return data.type === CARD_DRAG && typeof data.taskId === 'string'
}

export function isCardTarget(data: Record<string, unknown>): data is CardTargetData {
  return data.type === CARD_TARGET && typeof data.taskId === 'string'
}

export function isColumnTarget(data: Record<string, unknown>): data is ColumnTargetData {
  return data.type === COLUMN_TARGET && typeof data.statusId === 'string'
}

/** May the dragged card land in this column at all (its free space, its end)? */
export function columnAccepts(source: CardDragData, statusId: string): boolean {
  return source.statusId === statusId ? source.reorder : source.changeStatus
}

/** May it land next to a card of this column (a line between two cards)? */
export function cardAccepts(source: CardDragData, statusId: string): boolean {
  if (!source.reorder) return false
  return source.statusId === statusId || source.changeStatus
}
