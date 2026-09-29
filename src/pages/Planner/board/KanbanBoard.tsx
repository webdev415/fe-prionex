/**
 * The kanban of a board (planner story 5.3, AC1–AC3; UX-DR18, UX-DR19,
 * UX-DR46; FR-12, FR-26).
 *
 * Columns are the board's statuses in configuration order, standing as soon as
 * the board is read (5.1 loading); their cards and counts come from
 * `GET /boards/{code}/kanban` under the filters of the address — the server
 * counts, cuts at 50 per column and keeps «готово» to the last 7 days.
 *
 * Moving a card — dragging it, or «Перемістити в…» / «Змінити порядок» in its
 * `⋯` — is one path (`useMoveTask`): the plan is made from the cached kanban
 * (`kanbanMove.ts`), a status that needs a reason asks for it first, and the
 * outcome is said in the `aria-live` line under the board. One move at a time:
 * while the server confirms one, another waits for it (a second move of the
 * same card would carry a stale version). A move that is not taken — another
 * is being saved, or the board is being re-read under new filters and still
 * shows the previous columns (the placeholder is not in the cache) — is said
 * on screen and in `aria-live`, never dropped in silence.
 *
 * Horizontal scrolling with a navigator; while a card is dragged the board
 * scrolls itself near its edges (`-auto-scroll`).
 */
import { useEffect, useId, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { monitorForElements } from '@atlaskit/pragmatic-drag-and-drop/adapter/element-adapter'
import { combine } from '@atlaskit/pragmatic-drag-and-drop/combine'
import {
  autoScrollForElements,
  autoScrollWindowForElements,
} from '@atlaskit/pragmatic-drag-and-drop-auto-scroll/element'
import { extractClosestEdge } from '@atlaskit/pragmatic-drag-and-drop-hitbox/closest-edge/extract-closest-edge'
import { Button } from '@/components/ui/Button'
import { plannerKeys, usePlannerBoardKanban } from '@/api/planner/plannerQueries'
import { readPlannerError } from '@/api/planner/plannerErrors'
import type {
  PlannerBoard,
  PlannerBoardFilterParams,
  PlannerBoardKanban,
  PlannerBoardStatus,
  PlannerTaskCard,
} from '@/api/planner/plannerApi'
import { PlannerEmptyState } from '../components/PlannerStates'
import { StatusReasonDialog } from '../components/StatusReasonDialog'
import { useMoveTask, type MoveTaskInput } from '../hooks/useMoveTask'
import { BoardScrollNavigator } from './BoardScrollNavigator'
import { KanbanCard } from './KanbanCard'
import { KanbanColumn } from './KanbanColumn'
import {
  cardRights,
  currentPosition,
  findCard,
  isSamePlace,
  planDrop,
  planPatch,
  planReorder,
  type MovePlan,
  type ReorderStep,
} from './kanbanMove'
import { columnAccepts, isCardDrag, isCardTarget, isColumnTarget, type CardDragData } from './dnd'

interface KanbanBoardProps {
  board: PlannerBoard
  /** Filters for the server; `null` while «Мої» waits for `GET /me`. */
  filters: PlannerBoardFilterParams | null
  filtersActive: boolean
  onResetFilters: () => void
  onCreate: () => void
  onOpenTask: (key: string) => void
}

const NO_FILTERS: PlannerBoardFilterParams = {}

/**
 * How long after a move from `⋯` settles its card still takes a lost focus
 * back: long enough for the re-read that follows the answer, not so long that
 * a later poll pulls the page back to the card.
 */
export const REFOCUS_HOLD_MS = 1500

type TargetStatus = Pick<
  PlannerBoardStatus,
  'id' | 'name' | 'category' | 'notify_author' | 'requires_reason'
>

export function KanbanBoard({
  board,
  filters,
  filtersActive,
  onResetFilters,
  onCreate,
  onOpenTask,
}: KanbanBoardProps) {
  const { t } = useTranslation('planner')
  const queryClient = useQueryClient()
  const params = filters ?? NO_FILTERS
  const kanban = usePlannerBoardKanban(board.code, params, filters !== null)
  const kanbanKey = plannerKeys.boardKanban(board.code, params)
  const [announcement, setAnnouncement] = useState('')
  // The same outcome twice in a row (two refusals of one card) is still said
  // twice: the line changes by a trailing no-break space.
  const announce = (text: string) =>
    setAnnouncement((said) => (said === text ? `${text}\u00a0` : text))
  // A move not taken snaps the card back like a refusal: say why, on screen
  // as well as to screen readers.
  const sayNotTaken = (text: string) => {
    announce(text)
    toast.info(text)
  }
  // The card being dragged (its rights): a column invites the drop only if
  // it would take it.
  const [dragSource, setDragSource] = useState<CardDragData | null>(null)
  const [pendingReason, setPendingReason] = useState<MoveTaskInput | null>(null)
  // The card moved from its `⋯`: its focus comes back after the move (UX-DR46).
  const [refocusTaskId, setRefocusTaskId] = useState<string | null>(null)
  const move = useMoveTask({ onAnnounce: announce })
  const scrollRef = useRef<HTMLDivElement>(null)
  const hintId = useId()

  const statuses = [...board.config.statuses].sort((a, b) => a.position - b.position)
  const statusById = new Map(statuses.map((status) => [status.id, status]))
  const columns = new Map((kanban.data?.columns ?? []).map((column) => [column.status.id, column]))
  const canCreate = board.allowed_actions.includes('create_task')
  const loading = kanban.isPending || filters === null
  const allEmpty = kanban.data ? kanban.data.columns.every((column) => column.total === 0) : false

  /**
   * Plan → command → (reason) → move; from the cache, never from a placeholder.
   * `makePlan` reads the cached kanban; `statusOnly` — «Перемістити в…», which
   * sends no place. The card's rights are the cached card's.
   */
  const requestMove = (
    taskId: string,
    makePlan: (kanban: PlannerBoardKanban) => MovePlan | null,
    { statusOnly = false }: { statusOnly?: boolean } = {}
  ) => {
    const cached = queryClient.getQueryData<PlannerBoardKanban>(kanbanKey)
    const from = cached && findCard(cached, taskId)
    // The columns on screen are the previous filters' (a placeholder until the
    // new answer), or the card has just left them: nothing to move from.
    if (!cached || !from) {
      sayNotTaken(t('move.notReady'))
      return
    }
    const plan = makePlan(cached)
    if (!plan) return // its own place: no move
    if (move.isPending) {
      // The card goes back where it was: say why (one move at a time).
      sayNotTaken(t('move.busy'))
      return
    }
    const rights = cardRights(from.card)
    const planned = planPatch(cached, plan, statusOnly ? { ...rights, reorder: false } : rights)
    if (!planned) {
      // Its own place is no move; anything else the re-read card no longer allows.
      if (!isSamePlace(cached, plan)) sayNotTaken(t('move.notReady'))
      return
    }
    const fromStatus = statusById.get(from.statusId)
    // A status the loaded configuration does not know yet (added meanwhile):
    // the column's own name and category, no «повідомити автора», no reason.
    const columnStatus = cached.columns.find((c) => c.status.id === planned.plan.toStatusId)?.status
    const target: TargetStatus | undefined =
      statusById.get(planned.plan.toStatusId) ??
      (columnStatus && { ...columnStatus, notify_author: false, requires_reason: false })
    if (!target) {
      sayNotTaken(t('move.notReady'))
      return
    }
    const statusChange = planned.patch.status_id !== undefined
    const back = currentPosition(cached, taskId)
    const input: MoveTaskInput = {
      card: from.card,
      boardCode: board.code,
      kanbanKey,
      plan: planned.plan,
      patch: planned.patch,
      toStatus: target,
      // Leaving a status that needs a reason cannot be undone without one (5.1).
      // The way back names the old neighbour when the card may be reordered at
      // all — «Перемістити в…» itself sends no place, its undo still does.
      undo:
        statusChange && fromStatus && !fromStatus.requires_reason
          ? {
              status: from.card.status,
              position: rights.reorder ? back?.position : undefined,
            }
          : undefined,
    }
    if (statusChange && target.requires_reason) {
      setPendingReason(input)
      return
    }
    move.mutate(input)
  }

  // The drop handler reads this render's state; the monitor is registered once.
  const onDropRef = useRef<(taskId: string, target: Record<string, unknown>) => void>(() => {})
  useEffect(() => {
    onDropRef.current = (taskId, target) => {
      const edge = extractClosestEdge(target)
      requestMove(taskId, (cached) =>
        isCardTarget(target)
          ? planDrop(cached, taskId, {
              statusId: target.statusId,
              overTaskId: target.taskId,
              edge: edge === 'top' || edge === 'bottom' ? edge : null,
            })
          : isColumnTarget(target)
            ? planDrop(cached, taskId, { statusId: target.statusId })
            : null
      )
    }
  })

  useEffect(() => {
    const scroller = scrollRef.current
    if (!scroller) return
    return combine(
      monitorForElements({
        canMonitor: ({ source }) => isCardDrag(source.data),
        onDragStart: ({ source }) => setDragSource(isCardDrag(source.data) ? source.data : null),
        onDrop: ({ source, location }) => {
          setDragSource(null)
          const target = location.current.dropTargets[0]
          if (!target || !isCardDrag(source.data)) return
          onDropRef.current(source.data.taskId, target.data)
        },
      }),
      autoScrollForElements({
        element: scroller,
        canScroll: ({ source }) => isCardDrag(source.data),
      }),
      autoScrollWindowForElements({ canScroll: ({ source }) => isCardDrag(source.data) })
    )
  }, [])

  // The focus comes back until the person goes elsewhere: a click, or the
  // focus entering anything but that card's «номер · назва».
  useEffect(() => {
    if (!refocusTaskId) return
    const release = () => setRefocusTaskId(null)
    const onFocusIn = (event: FocusEvent) => {
      const card = event.target instanceof Element ? event.target.closest('[data-task-id]') : null
      const title = card?.querySelector('button[id]')
      if (card?.getAttribute('data-task-id') !== refocusTaskId || event.target !== title) release()
    }
    document.addEventListener('pointerdown', release, true)
    document.addEventListener('focusin', onFocusIn)
    return () => {
      document.removeEventListener('pointerdown', release, true)
      document.removeEventListener('focusin', onFocusIn)
    }
  }, [refocusTaskId])

  // …and not for ever: once the move has settled (and no reason is being
  // typed), the hold ends after a short while.
  useEffect(() => {
    if (!refocusTaskId || move.isPending || pendingReason) return
    const timer = window.setTimeout(() => setRefocusTaskId(null), REFOCUS_HOLD_MS)
    return () => window.clearTimeout(timer)
  }, [refocusTaskId, move.isPending, pendingReason])

  const cardActions = (card: PlannerTaskCard, index: number, count: number) => {
    const rights = cardRights(card)
    return {
      targets: rights.changeStatus ? statuses.filter((s) => s.id !== card.status.id) : [],
      onMoveTo: (status: PlannerBoardStatus) => {
        setRefocusTaskId(card.id)
        // «Перемістити в…» puts the card at the end of the column: status only.
        requestMove(
          card.id,
          () => ({
            taskId: card.id,
            fromStatusId: card.status.id,
            toStatusId: status.id,
            toIndex: Number.MAX_SAFE_INTEGER,
          }),
          { statusOnly: true }
        )
      },
      reorder: rights.reorder
        ? {
            canUp: index > 0,
            canDown: index < count - 1,
            onReorder: (step: ReorderStep) => {
              setRefocusTaskId(card.id)
              requestMove(card.id, (cached) => planReorder(cached, card.id, step))
            },
          }
        : undefined,
    }
  }

  let notice = null
  if (kanban.isError && !kanban.data) {
    const { status } = readPlannerError(kanban.error)
    notice =
      status === 400 && filtersActive ? (
        <PlannerEmptyState
          text={t('kanban.invalidFilter')}
          action={
            <Button variant="outline" size="sm" onClick={onResetFilters}>
              {t('kanban.resetFilters')}
            </Button>
          }
        />
      ) : (
        <p className="text-foreground text-sm">{t('board.error')}</p>
      )
  } else if (allEmpty && filtersActive) {
    notice = (
      <PlannerEmptyState
        text={t('kanban.nothingFound')}
        action={
          <Button variant="outline" size="sm" onClick={onResetFilters}>
            {t('kanban.resetFilters')}
          </Button>
        }
      />
    )
  } else if (allEmpty) {
    // One CTA per screen: «+ Задача» stays in the header, the empty state only says it.
    notice = <PlannerEmptyState text={t('board.empty')} />
  }

  return (
    <div className="space-y-2">
      {notice}
      <p id={hintId} className="sr-only">
        {t('kanban.keyboardHint')}
      </p>
      <BoardScrollNavigator
        scrollRef={scrollRef}
        columns={statuses.map((status) => ({ id: status.id, name: status.name }))}
      />
      <div ref={scrollRef} className="flex gap-3 overflow-x-auto pb-2">
        {statuses.map((status) => {
          const column = columns.get(status.id)
          const items = column?.items ?? []
          return (
            <KanbanColumn
              key={status.id}
              status={status}
              column={column}
              loading={loading}
              boardEmpty={allEmpty}
              dropInvited={dragSource !== null && columnAccepts(dragSource, status.id)}
              canCreate={canCreate}
              onCreate={onCreate}
            >
              {items.map((card, index) => (
                <KanbanCard
                  key={card.id}
                  task={card}
                  onOpen={onOpenTask}
                  timeZone={board.tzid}
                  describedBy={hintId}
                  actions={cardActions(card, index, items.length)}
                  draggableIn={{ statusId: status.id }}
                  restoreFocus={refocusTaskId === card.id}
                />
              ))}
            </KanbanColumn>
          )
        })}
      </div>
      <p role="status" aria-live="polite" className="sr-only">
        {announcement}
      </p>

      <StatusReasonDialog
        open={pendingReason !== null}
        title={pendingReason ? `${pendingReason.card.key} → ${pendingReason.toStatus.name}` : ''}
        onCancel={() => setPendingReason(null)}
        onConfirm={(reason) => {
          if (pendingReason) {
            // The dialog hands the focus back; the move then takes it away.
            setRefocusTaskId(pendingReason.card.id)
            move.mutate({ ...pendingReason, reason })
          }
          setPendingReason(null)
        }}
      />
    </div>
  )
}

export default KanbanBoard
