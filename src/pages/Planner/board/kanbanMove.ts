/**
 * Moving a card on the kanban (planner story 5.3, AC3; UX-DR19) — pure logic,
 * no React, no HTTP.
 *
 * The server keeps the order of a column; the client never computes a
 * position. A place is said by a neighbour of the target column — `before_id`
 * of the card that will follow, or `after_id` of the card that will precede
 * (conventions «Команды задачи», AA-71). Which keys go out follows the card's
 * rights: `change_status` sends `status_id`, `reorder` sends `position`; a
 * move the rights do not cover is no move at all.
 *
 * The optimistic picture is the same move applied to the cached kanban: the
 * card leaves its column and stands at its new index at once; the server's
 * answer (or the next poll) brings the truth.
 */
import type {
  PlannerBoardKanban,
  PlannerTaskCard,
  PlannerTaskPatch,
} from '@/api/planner/plannerApi'

export type TaskPosition = NonNullable<PlannerTaskPatch['position']>
type StatusRef = PlannerTaskCard['status']

/** A requested move: the card and where it should stand. */
export interface MovePlan {
  taskId: string
  fromStatusId: string
  toStatusId: string
  /** Index among the target column's cards once the card itself is taken out. */
  toIndex: number
}

export interface CardRights {
  changeStatus: boolean
  reorder: boolean
}

export function cardRights(card: Pick<PlannerTaskCard, 'allowed_actions'>): CardRights {
  return {
    changeStatus: card.allowed_actions.includes('change_status'),
    reorder: card.allowed_actions.includes('reorder'),
  }
}

/** A card can be picked up at all: it may change status or order. */
export function canMoveCard(card: Pick<PlannerTaskCard, 'allowed_actions'>): boolean {
  const rights = cardRights(card)
  return rights.changeStatus || rights.reorder
}

export interface CardLocation {
  card: PlannerTaskCard
  statusId: string
  index: number
}

export function findCard(kanban: PlannerBoardKanban, taskId: string): CardLocation | undefined {
  for (const column of kanban.columns) {
    const index = column.items.findIndex((card) => card.id === taskId)
    if (index >= 0) return { card: column.items[index], statusId: column.status.id, index }
  }
  return undefined
}

/** The cards of a column without the moving card. */
function itemsWithout(kanban: PlannerBoardKanban, statusId: string, taskId: string) {
  const column = kanban.columns.find((c) => c.status.id === statusId)
  return (column?.items ?? []).filter((card) => card.id !== taskId)
}

/**
 * The neighbour that says «stand here» for index `index` of `items` (the
 * target column without the card): the card now at that index follows it, or
 * — at the end — the last card precedes it. An empty column needs none: the
 * status alone puts the card there.
 */
export function positionAt(items: PlannerTaskCard[], index: number): TaskPosition | undefined {
  if (items.length === 0) return undefined
  if (index < items.length) return { before_id: items[Math.max(0, index)].id }
  return { after_id: items[items.length - 1].id }
}

/** Where a neighbour-given place is in `items` now; unknown neighbour — the end. */
export function indexForPosition(
  items: PlannerTaskCard[],
  position: TaskPosition | undefined
): number {
  if (position?.before_id) {
    const at = items.findIndex((card) => card.id === position.before_id)
    if (at >= 0) return at
  }
  if (position?.after_id) {
    const at = items.findIndex((card) => card.id === position.after_id)
    if (at >= 0) return at + 1
  }
  return items.length
}

/**
 * The command for a plan under the card's rights, or `null` when there is
 * nothing to send: a drop on its own place, a status change without
 * `change_status`, a reorder without `reorder`. Without `reorder` a card may
 * still change column — then only `status_id` goes out and the server puts it
 * at the end of the column, so the plan's index is moved there too.
 */
export function planPatch(
  kanban: PlannerBoardKanban,
  plan: MovePlan,
  rights: CardRights
): { plan: MovePlan; patch: Pick<PlannerTaskPatch, 'status_id' | 'position'> } | null {
  const from = findCard(kanban, plan.taskId)
  if (!from) return null
  const target = itemsWithout(kanban, plan.toStatusId, plan.taskId)
  const toIndex = Math.max(0, Math.min(plan.toIndex, target.length))
  if (plan.toStatusId === from.statusId) {
    if (!rights.reorder || toIndex === from.index) return null
    const position = positionAt(target, toIndex)
    if (!position) return null
    return { plan: { ...plan, fromStatusId: from.statusId, toIndex }, patch: { position } }
  }
  if (!rights.changeStatus) return null
  if (!rights.reorder) {
    return {
      plan: { ...plan, fromStatusId: from.statusId, toIndex: target.length },
      patch: { status_id: plan.toStatusId },
    }
  }
  const position = positionAt(target, toIndex)
  return {
    plan: { ...plan, fromStatusId: from.statusId, toIndex },
    patch: { status_id: plan.toStatusId, ...(position ? { position } : {}) },
  }
}

/**
 * The same move on the cached kanban: the card leaves its column (whose
 * `total` drops by one) and stands at `toIndex` of the target (whose `total`
 * grows), carrying the target's status. Nothing else changes.
 */
export function applyMove(
  kanban: PlannerBoardKanban,
  plan: MovePlan,
  toStatus: StatusRef
): PlannerBoardKanban {
  const from = findCard(kanban, plan.taskId)
  if (!from) return kanban
  const moved: PlannerTaskCard = { ...from.card, status: toStatus }
  const sameColumn = from.statusId === plan.toStatusId
  return {
    ...kanban,
    columns: kanban.columns.map((column) => {
      const isSource = column.status.id === from.statusId
      const isTarget = column.status.id === plan.toStatusId
      if (!isSource && !isTarget) return column
      const items = column.items.filter((card) => card.id !== plan.taskId)
      if (isTarget) {
        const at = Math.max(0, Math.min(plan.toIndex, items.length))
        items.splice(at, 0, moved)
      }
      const total = sameColumn ? column.total : column.total + (isTarget ? 1 : -1)
      return { ...column, items, total: Math.max(total, items.length) }
    }),
  }
}

/**
 * Where the card stands now, as a neighbour — the way back for «Скасувати».
 * Taken before the move: after it, the old neighbours may have moved on.
 */
export function currentPosition(
  kanban: PlannerBoardKanban,
  taskId: string
): { statusId: string; position: TaskPosition | undefined } | undefined {
  const at = findCard(kanban, taskId)
  if (!at) return undefined
  const rest = itemsWithout(kanban, at.statusId, taskId)
  return { statusId: at.statusId, position: positionAt(rest, at.index) }
}

/** A plan that puts the card back at a neighbour-given place of a column. */
export function planBack(
  kanban: PlannerBoardKanban,
  taskId: string,
  statusId: string,
  position: TaskPosition | undefined
): MovePlan | undefined {
  const at = findCard(kanban, taskId)
  if (!at) return undefined
  const target = itemsWithout(kanban, statusId, taskId)
  return {
    taskId,
    fromStatusId: at.statusId,
    toStatusId: statusId,
    toIndex: indexForPosition(target, position),
  }
}

export type DropEdge = 'top' | 'bottom'

/**
 * A drop under the pointer, as a plan: over a card — before or after it by the
 * closest edge; over a column's free space — at its end. A drop on the card
 * itself is no move.
 */
export function planDrop(
  kanban: PlannerBoardKanban,
  taskId: string,
  target: { statusId: string; overTaskId?: string; edge?: DropEdge | null }
): MovePlan | null {
  const from = findCard(kanban, taskId)
  if (!from) return null
  const rest = itemsWithout(kanban, target.statusId, taskId)
  if (!target.overTaskId) {
    return {
      taskId,
      fromStatusId: from.statusId,
      toStatusId: target.statusId,
      toIndex: rest.length,
    }
  }
  if (target.overTaskId === taskId) return null
  const over = rest.findIndex((card) => card.id === target.overTaskId)
  if (over < 0) return null
  return {
    taskId,
    fromStatusId: from.statusId,
    toStatusId: target.statusId,
    toIndex: target.edge === 'bottom' ? over + 1 : over,
  }
}

export type ReorderStep = 'up' | 'down' | 'top'

/**
 * «Змінити порядок» from the card menu (U-10): one place up, one down, or the
 * head of the column. `null` when the card is already there.
 */
export function planReorder(
  kanban: PlannerBoardKanban,
  taskId: string,
  step: ReorderStep
): MovePlan | null {
  const from = findCard(kanban, taskId)
  if (!from) return null
  const column = kanban.columns.find((c) => c.status.id === from.statusId)
  const last = (column?.items.length ?? 1) - 1
  const toIndex = step === 'up' ? from.index - 1 : step === 'down' ? from.index + 1 : 0
  if (toIndex < 0 || toIndex > last || toIndex === from.index) return null
  return { taskId, fromStatusId: from.statusId, toStatusId: from.statusId, toIndex }
}
