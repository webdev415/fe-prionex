/**
 * Moving a card on the kanban — drag and drop, «Перемістити в…» and «Змінити
 * порядок» (planner story 5.3, AC3; UX-DR19, U-9).
 *
 * One command: `PATCH /tasks/{id}` with `status_id` and/or `position` under
 * `If-Match`. The card stands in its new place at once (the cached kanban is
 * changed before the request) and goes back if the server refuses:
 *
 * - 412 — somebody changed the task: the fresh version is shown, a toast says
 *   who — «Задачу змінив {Ім'я}. Показано свіжу версію» — when the task's
 *   journal names the author of exactly that version (its row written at the
 *   fresh `updated_at`: one transaction, one `now()`); otherwise, or when the
 *   journal cannot be read, the toast says it without a name. The journal has
 *   no paging in contract 0.24.0 (up to 500 rows), so it is read at most once
 *   per fresh version and given `CHANGED_BY_BUDGET_MS`: a slower answer is
 *   aborted and the toast goes out without the name;
 * - 409 `position_exhausted`, 400 on `position.*` — no room at that place, or
 *   the neighbour is gone: «Не вдалося поставити задачу на це місце»;
 * - anything else — the reason by path (`toastPlannerError`, 5.1).
 *
 * A status change says what happened in a toast with a 5 s «Скасувати» (like
 * the status chip): «SKL-2 → «В роботі»», «SKL-2 закрито» for a «готово»
 * column, plus «Замовника повідомлено» for a status that notifies the author.
 * The undo takes the card back to its status AND its place (the neighbour it
 * had before the move). A card leaving a status that needs a reason gets no
 * undo — going back would need a reason nobody typed. A change of order alone
 * is visible where it happened and raises no toast; every outcome is also said
 * to screen readers through the board's `aria-live` line (`onAnnounce`).
 */
import { createElement } from 'react'
import { useMutation, useQueryClient, type QueryKey } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { piiProps } from '@/lib/openreplay/pii'
import {
  getTaskHistory,
  patchTask,
  type PlannerBoardKanban,
  type PlannerBoardStatus,
  type PlannerTask,
  type PlannerTaskCard,
} from '@/api/planner/plannerApi'
import { plannerKeys } from '@/api/planner/plannerQueries'
import { readPlannerError } from '@/api/planner/plannerErrors'
import { toastPlannerError } from './usePlannerMutations'
import { showUndoToast } from '../plannerToasts'
import { applyMove, planBack, type MovePlan, type TaskPosition } from '../board/kanbanMove'

export interface MoveTaskInput {
  /** The card as it was before the move (id, key, version). */
  card: Pick<PlannerTaskCard, 'id' | 'key' | 'version' | 'status'>
  boardCode: string
  /** The kanban query the card is drawn from (the filters of the address). */
  kanbanKey: QueryKey
  plan: MovePlan
  patch: { status_id?: string; position?: TaskPosition }
  /** The target status (of the board's configuration: category, «повідомити автора»). */
  toStatus: Pick<PlannerBoardStatus, 'id' | 'name' | 'category' | 'notify_author'>
  reason?: string
  /** How to go back: the old status and neighbour; absent — no «Скасувати». */
  undo?: { status: PlannerTaskCard['status']; position: TaskPosition | undefined }
  /** This move IS the undo: it only goes back, it says nothing but `aria-live`. */
  isUndo?: boolean
}

/** Fields a task answer refreshes on its card; labels stay the kanban's (first three). */
function cardFromTask(card: PlannerTaskCard, task: PlannerTask): PlannerTaskCard {
  return {
    ...card,
    status: task.status,
    version: task.version,
    allowed_actions: task.allowed_actions,
    assignees: task.assignees,
    due_date: task.due_date,
    due_at: task.due_at,
    due_deadline_at: task.due_deadline_at,
    due_state: task.due_state,
    sla_state: task.sla_state,
    sla_deadline_at: task.sla_deadline_at,
    needs_triage: task.needs_triage,
  }
}

function withTask(kanban: PlannerBoardKanban, task: PlannerTask): PlannerBoardKanban {
  return {
    ...kanban,
    columns: kanban.columns.map((column) =>
      column.items.some((card) => card.id === task.id)
        ? {
            ...column,
            items: column.items.map((card) =>
              card.id === task.id ? cardFromTask(card, task) : card
            ),
          }
        : column
    ),
  }
}

function isPlaceRefused(error: unknown): boolean {
  const { status, code, details } = readPlannerError(error)
  if ((status === 409 || code === 'conflict') && details.reason === 'position_exhausted')
    return true
  return status === 400 && typeof details.field === 'string' && details.field.startsWith('position')
}

/** One move at a time across the board: the undo in a toast asks this too. */
export const MOVE_TASK_KEY = ['planner', 'moveTask'] as const

/**
 * How long a 412 waits for the name of whoever changed the task. The journal
 * is unpaged (contract 0.24.0): a slow answer is aborted, not waited for.
 */
export const CHANGED_BY_BUDGET_MS = 1000

/** Runs `request` with an abort signal; past `ms` it is aborted and rejects. */
function withinBudget<T>(request: (signal: AbortSignal) => Promise<T>, ms: number): Promise<T> {
  const controller = new AbortController()
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      controller.abort()
      reject(new Error('changed_by_budget'))
    }, ms)
    request(controller.signal).then(
      (value) => {
        clearTimeout(timer)
        resolve(value)
      },
      (error: unknown) => {
        clearTimeout(timer)
        reject(error)
      }
    )
  })
}

/**
 * Who made the task's current version: the journal row written in the same
 * transaction as `updated_at` (both `now()`), by a person with a name. A
 * change without a journal row, by the system, an unreadable journal or one
 * slower than the budget — no name.
 */
async function changedBy(task: PlannerTask): Promise<string | null> {
  const at = Date.parse(task.updated_at)
  if (Number.isNaN(at)) return null
  try {
    const history = await withinBudget(
      (signal) => getTaskHistory(task.id, { signal }),
      CHANGED_BY_BUDGET_MS
    )
    const row = [...(history?.items ?? [])].reverse().find((entry) => Date.parse(entry.at) === at)
    return row?.actor?.full_name ?? null
  } catch {
    return null
  }
}

interface Options {
  /** Says the outcome to screen readers (the board's `aria-live` line). */
  onAnnounce?: (text: string) => void
}

export function useMoveTask({ onAnnounce }: Options = {}) {
  const { t } = useTranslation('planner')
  const queryClient = useQueryClient()

  const refresh = (input: MoveTaskInput) => {
    void queryClient.invalidateQueries({ queryKey: plannerKeys.boardTasks(input.boardCode) })
    void queryClient.invalidateQueries({ queryKey: plannerKeys.myTasks() })
    void queryClient.invalidateQueries({ queryKey: plannerKeys.task(input.card.key) })
  }

  const move = useMutation({
    mutationKey: MOVE_TASK_KEY,
    mutationFn: (input: MoveTaskInput) =>
      patchTask(input.card.id, input.card.version, {
        ...input.patch,
        ...(input.reason ? { reason: input.reason } : {}),
      }),
    onMutate: async (input) => {
      await queryClient.cancelQueries({ queryKey: input.kanbanKey })
      const before = queryClient.getQueryData<PlannerBoardKanban>(input.kanbanKey)
      if (before) {
        const toStatus = {
          id: input.toStatus.id,
          name: input.toStatus.name,
          category: input.toStatus.category,
        }
        queryClient.setQueryData(input.kanbanKey, applyMove(before, input.plan, toStatus))
      }
      return { before }
    },
    onError: (error, input, context) => {
      if (context?.before) queryClient.setQueryData(input.kanbanKey, context.before)
      const { status, code, details } = readPlannerError(error)
      if (status === 412 || code === 'revision_mismatch') {
        const current = details.current as PlannerTask | undefined
        if (current && typeof current === 'object' && 'version' in current) {
          queryClient.setQueryData(plannerKeys.task(input.card.key), current)
          // One journal read per fresh version: a retry against the same
          // conflict (the kanban not re-read yet) reuses the name.
          void queryClient
            .fetchQuery({
              queryKey: [...MOVE_TASK_KEY, 'changedBy', current.id, current.version],
              queryFn: () => changedBy(current),
              staleTime: Infinity,
            })
            .then((name) =>
              toast.info(
                name
                  ? // The name is a person's: masked in session recordings.
                    createElement('span', piiProps, t('move.staleBy', { name }))
                  : t('toast.stale')
              )
            )
        } else {
          toast.info(t('toast.stale'))
        }
      } else if (isPlaceRefused(error)) {
        toast.error(t('move.placeRefused'))
      } else {
        toastPlannerError(t, error)
      }
      onAnnounce?.(t('move.announceFailed', { key: input.card.key }))
      refresh(input)
    },
    onSuccess: ({ task }, input) => {
      queryClient.setQueryData(plannerKeys.task(input.card.key), task)
      queryClient.setQueryData<PlannerBoardKanban>(input.kanbanKey, (kanban) =>
        kanban ? withTask(kanban, task) : kanban
      )
      const statusChanged = input.patch.status_id !== undefined
      if (!statusChanged) {
        onAnnounce?.(t('move.announceReordered', { key: input.card.key }))
        refresh(input)
        return
      }
      const closed = input.toStatus.category === 'done'
      const said = closed
        ? t('move.closed', { key: input.card.key })
        : t('toast.statusChanged', { key: input.card.key, status: input.toStatus.name })
      const message = input.toStatus.notify_author ? `${said} · ${t('move.authorNotified')}` : said
      onAnnounce?.(message)
      refresh(input)
      if (input.isUndo) return
      const { undo } = input
      if (!undo) {
        toast.success(message)
        return
      }
      showUndoToast({
        message,
        undoLabel: t('toast.undo'),
        onUndo: () => {
          // Another move is on its way: this undo would carry a stale version.
          if (queryClient.isMutating({ mutationKey: MOVE_TASK_KEY }) > 0) {
            // Said on screen too: the card simply stays, as after a refusal.
            onAnnounce?.(t('move.busy'))
            toast.info(t('move.busy'))
            return
          }
          const kanban = queryClient.getQueryData<PlannerBoardKanban>(input.kanbanKey)
          const plan = kanban && planBack(kanban, task.id, undo.status.id, undo.position)
          move.mutate({
            card: { id: task.id, key: task.key, version: task.version, status: task.status },
            boardCode: input.boardCode,
            kanbanKey: input.kanbanKey,
            plan: plan ?? {
              taskId: task.id,
              fromStatusId: task.status.id,
              toStatusId: undo.status.id,
              toIndex: Number.MAX_SAFE_INTEGER,
            },
            patch: {
              status_id: undo.status.id,
              ...(undo.position ? { position: undo.position } : {}),
            },
            toStatus: { ...undo.status, notify_author: false },
            isUndo: true,
          })
        },
      })
    },
  })
  return move
}
