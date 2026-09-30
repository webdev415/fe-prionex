/**
 * Kanban card (planner stories 1.10, 5.1, 5.3; UX «Карточка задачи»,
 * UX-DR19, UX-DR46).
 *
 * The content is 1.10/5.1's: number and title (masked for session recording,
 * `piiProps`), the status chip, the due and SLA pills, origin, priority and the
 * assignee avatars. 5.3 adds:
 *
 * - **dragging** — with `change_status` or `reorder` the card can be picked up
 *   (a grip shows it); without either it has no grip and does not move. While
 *   it is dragged its place shows it at 40 % (DESIGN «Elevation»); a card it
 *   hovers shows the 2 px insertion line on its closer edge;
 * - **one Tab stop** — the «номер · назва» button: `Enter` opens the task. The
 *   card's other controls are reached with ← → (Home / End) inside the card;
 *   `Shift+F10` or the context-menu key opens `⋯` from anywhere in it;
 * - **`⋯`** — «Відкрити», «Перемістити в…», «Змінити порядок», «Копіювати
 *   посилання» (`CardMenu`).
 */
import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react'
import { MdDragIndicator } from 'react-icons/md'
import { combine } from '@atlaskit/pragmatic-drag-and-drop/combine'
import {
  draggable,
  dropTargetForElements,
} from '@atlaskit/pragmatic-drag-and-drop/adapter/element-adapter'
import { attachClosestEdge } from '@atlaskit/pragmatic-drag-and-drop-hitbox/closest-edge/attach-closest-edge'
import { extractClosestEdge } from '@atlaskit/pragmatic-drag-and-drop-hitbox/closest-edge/extract-closest-edge'
import { piiProps } from '@/lib/openreplay/pii'
import { cn } from '@/lib/utils'
import type { PlannerTaskCard } from '@/api/planner/plannerApi'
import { StatusChip } from '../components/StatusChip'
import { DuePill, SlaPill } from '../components/TaskPills'
import { AvatarStack } from '../components/PersonAvatar'
import { OriginChip } from '../components/OriginChip'
import { PriorityIcon } from '../components/PriorityIcon'
import { InsideKanbanCard } from '../components/cardFocus'
import { CardMenu, type CardMoveActions } from './CardMenu'
import { cardRights, type DropEdge } from './kanbanMove'
import { CARD_DRAG, CARD_TARGET, cardAccepts, isCardDrag, type CardDragData } from './dnd'

interface KanbanCardProps {
  task: PlannerTaskCard
  onOpen: (key: string) => void
  /** The board's `tzid`, already at hand on the board screen. */
  timeZone?: string
  /** Id of the board's keyboard hint (one per board). */
  describedBy?: string
  /** Moves of `⋯`; absent — the menu only opens the task and copies its link. */
  actions?: CardMoveActions
  /** Drag and drop on the board; absent — the card is static. */
  draggableIn?: { statusId: string }
  /**
   * The card was just moved from its `⋯` (the keyboard path): moving it
   * re-mounts or re-inserts its node and the focus falls to the page. While
   * this holds, a lost focus comes back to the card's «номер · назва». The
   * board holds it only around the move (`REFOCUS_HOLD_MS` after it settles).
   */
  restoreFocus?: boolean
}

/** How long after the menu key its trailing browser `contextmenu` is expected. */
const MENU_KEY_CONTEXTMENU_MS = 1500

/** Elements of the card reachable with ← → (all out of the Tab order but the first). */
const CARD_STOPS = 'button:not([disabled]), a[href], [tabindex]'

function DropLine({ edge }: { edge: DropEdge }) {
  return (
    <span
      aria-hidden="true"
      data-drop-indicator={edge}
      className={cn(
        'bg-secondary-600 pointer-events-none absolute right-0 left-0 h-0.5 rounded-full',
        edge === 'top' ? '-top-[5px]' : '-bottom-[5px]'
      )}
    />
  )
}

export function KanbanCard({
  task,
  onOpen,
  timeZone,
  describedBy,
  actions,
  draggableIn,
  restoreFocus = false,
}: KanbanCardProps) {
  const ref = useRef<HTMLElement>(null)
  const titleRef = useRef<HTMLButtonElement>(null)
  const [menuOpen, setMenuOpen] = useState(false)
  // When the menu key opened `⋯`: the browser's own `contextmenu` that follows
  // it (on Windows after keyup, so the keydown's preventDefault misses it) is
  // swallowed; a right click of the mouse is left alone.
  const menuKeyAt = useRef(0)
  const [dragging, setDragging] = useState(false)
  const [edge, setEdge] = useState<DropEdge | null>(null)
  const titleId = useId()
  const rights = cardRights(task)
  const movable = Boolean(draggableIn) && (rights.changeStatus || rights.reorder)
  const statusId = draggableIn?.statusId

  useEffect(() => {
    const element = ref.current
    if (!element || !statusId) return
    const source: CardDragData = {
      type: CARD_DRAG,
      taskId: task.id,
      statusId,
      changeStatus: rights.changeStatus,
      reorder: rights.reorder,
    }
    // Every card is a place to drop next to; only a card with rights moves.
    // The dragged card is a target over itself too: letting go where it was
    // picked up is no move (`planDrop`), not a fall-through to the column —
    // whose free space means «to the end». Sticky: in the 8 px gap between two
    // cards the last card under the pointer, with its edge, stays the target.
    const target = dropTargetForElements({
      element,
      canDrop: ({ source: dragged }) =>
        isCardDrag(dragged.data) &&
        (dragged.data.taskId === task.id || cardAccepts(dragged.data, statusId)),
      getIsSticky: () => true,
      getData: ({ input }) =>
        attachClosestEdge(
          { type: CARD_TARGET, taskId: task.id, statusId },
          { element, input, allowedEdges: ['top', 'bottom'] }
        ),
      onDrag: ({ self, source: dragged }) => {
        // No insertion line on the card itself: it stays where it is.
        const closest = dragged.data.taskId === task.id ? null : extractClosestEdge(self.data)
        setEdge(closest === 'top' || closest === 'bottom' ? closest : null)
      },
      onDragLeave: () => setEdge(null),
      onDrop: () => setEdge(null),
    })
    if (!rights.changeStatus && !rights.reorder) return target
    return combine(
      draggable({
        element,
        getInitialData: () => source,
        onDragStart: () => setDragging(true),
        onDrop: () => setDragging(false),
      }),
      target
    )
  }, [task.id, statusId, rights.changeStatus, rights.reorder])

  // After every render while asked: a move (and its rollback) takes the
  // focused node out of the document, and the menu's exit animation drops its
  // focus later still — outside this card's props, so no dependency list
  // would see it. Focus that is elsewhere is left alone; the hold itself is
  // short (the board releases it `REFOCUS_HOLD_MS` after the move settles).
  useEffect(() => {
    if (!restoreFocus) return
    const active = document.activeElement
    if (active && active !== document.body && active.isConnected) return
    titleRef.current?.focus()
  })

  const onKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    const card = event.currentTarget
    // Keys typed in the open menu bubble here through React's tree (the menu
    // is a portal); only the card's own elements count.
    if (!(event.target instanceof Node) || !card.contains(event.target)) return
    if ((event.shiftKey && event.key === 'F10') || event.key === 'ContextMenu') {
      event.preventDefault()
      menuKeyAt.current = Date.now()
      setMenuOpen(true)
      return
    }
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return
    const stops = Array.from(card.querySelectorAll<HTMLElement>(CARD_STOPS))
    const at = stops.findIndex(
      (stop) => stop === event.target || stop.contains(event.target as Node)
    )
    if (at < 0 || stops.length === 0) return
    const next =
      event.key === 'Home'
        ? 0
        : event.key === 'End'
          ? stops.length - 1
          : Math.max(0, Math.min(stops.length - 1, at + (event.key === 'ArrowRight' ? 1 : -1)))
    event.preventDefault()
    stops[next].focus()
  }

  return (
    <InsideKanbanCard.Provider value={true}>
      {/* The card is not a control itself: it routes keys between its own
          controls (← → Home End) and opens its menu (Shift+F10) — the
          composite keyboard pattern of one Tab stop per card (UX-DR46). */}
      {/* eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions */}
      <article
        ref={ref}
        aria-labelledby={titleId}
        data-task-id={task.id}
        onKeyDown={onKeyDown}
        onContextMenu={(event) => {
          // Also reached from the open menu (a portal) through React's tree.
          if (Date.now() - menuKeyAt.current > MENU_KEY_CONTEXTMENU_MS) return
          menuKeyAt.current = 0
          event.preventDefault()
        }}
        className={cn(
          'border-border bg-card relative space-y-2 rounded-lg border p-3 shadow-sm',
          movable && 'cursor-grab active:cursor-grabbing',
          dragging && 'opacity-40'
        )}
      >
        {edge === 'top' && <DropLine edge="top" />}
        <div className="flex items-start gap-1">
          <button
            ref={titleRef}
            type="button"
            id={titleId}
            className="focus-visible:ring-ring block min-w-0 flex-1 rounded text-left focus-visible:ring-2 focus-visible:outline-none"
            aria-describedby={describedBy}
            onClick={() => onOpen(task.key)}
          >
            <span className="text-muted-foreground block font-mono text-xs tabular-nums">
              {task.key}
            </span>{' '}
            <span
              className="text-foreground line-clamp-2 block text-sm font-medium break-words"
              {...piiProps}
            >
              {task.title}
            </span>
          </button>
          {movable && (
            <MdDragIndicator
              aria-hidden="true"
              data-drag-handle=""
              className="text-muted-foreground mt-0.5 h-4 w-4 shrink-0"
            />
          )}
          <CardMenu
            task={task}
            open={menuOpen}
            onOpenChange={setMenuOpen}
            onOpenTask={onOpen}
            actions={actions}
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <StatusChip task={task} />
          <DuePill task={task} timeZone={timeZone} />
          <SlaPill task={task} />
        </div>
        <div className="flex items-center gap-2">
          <OriginChip origin={task.origin} />
          <PriorityIcon task={task} />
          <span className="ml-auto">
            <AvatarStack people={task.assignees} />
          </span>
        </div>
        {edge === 'bottom' && <DropLine edge="bottom" />}
      </article>
    </InsideKanbanCard.Provider>
  )
}

export default KanbanCard
