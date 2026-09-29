/**
 * Planner commands from the CRM (planner stories 1.10, 5.1): create a task,
 * change its status. Errors are shown by `code` with our own text — never the
 * server `message` (epic 1, «Тексти») — and each way a command can fail has its
 * own phrase: no rights, a bad field, a conflict, too many requests, the
 * planner switched off, the planner failing, no connection at all.
 */
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import {
  createTask,
  patchTask,
  type PlannerTask,
  type PlannerTaskCreate,
} from '@/api/planner/plannerApi'
import { plannerKeys } from '@/api/planner/plannerQueries'
import { readPlannerError } from '@/api/planner/plannerErrors'
import type { PlannerT } from '../plannerFormat'
import { showUndoToast } from '../plannerToasts'

/** Contract field → the form label the person saw (`details.field` of a 400). */
const FIELD_LABELS: Record<string, string> = {
  title: 'create.fields.title',
  description: 'create.fields.description',
  assignee_ids: 'create.fields.assignees',
  due_date: 'create.fields.due',
  due_at: 'create.fields.due',
}

/** Toast for a failed planner command; 412 is handled by the caller first. */
export function toastPlannerError(t: PlannerT, error: unknown): void {
  const { status, code, details, unreachable } = readPlannerError(error)
  if (status === 403 || code === 'forbidden') {
    const reason = typeof details.reason === 'string' ? details.reason : undefined
    const reasonText = reason ? t(`reasons.${reason}`, { defaultValue: '' }) : ''
    toast.error(
      reasonText ? t('toast.forbidden', { reason: reasonText }) : t('toast.forbiddenGeneric')
    )
    return
  }
  if (status === 400 && typeof details.field === 'string') {
    const label = FIELD_LABELS[details.field]
    toast.error(t('toast.validation', { field: label ? t(label) : details.field }))
    return
  }
  if (status === 503 || code === 'feature_disabled') {
    toast.error(t('toast.unavailable'))
    return
  }
  if (status === 409 || code === 'conflict') {
    toast.error(t('toast.conflict'))
    return
  }
  if (status === 429 || code === 'rate_limited') {
    toast.error(t('toast.rateLimited'))
    return
  }
  if (unreachable) {
    toast.error(t('toast.network'))
    return
  }
  if (status !== undefined && status >= 500) {
    toast.error(t('toast.serverError'))
    return
  }
  toast.error(t('toast.failed'))
}

/**
 * 409 `idempotency_key_reused` on create: this form's key already created a
 * task with a different body — typically the first «Створити» reached the
 * server but its answer was lost, and the form was edited before the retry.
 * The key is spent: the form that holds it closes (`CreateTaskDialog`), since
 * every further «Створити» with it would get the same 409.
 */
export function isIdempotencyReplayConflict(error: unknown): boolean {
  const { status, code, details } = readPlannerError(error)
  return (status === 409 || code === 'conflict') && details.reason === 'idempotency_key_reused'
}

/** Every list the task can appear in, plus the task itself. */
function refreshTaskViews(
  queryClient: ReturnType<typeof useQueryClient>,
  boardCode: string,
  key: string
) {
  void queryClient.invalidateQueries({ queryKey: plannerKeys.myTasks() })
  void queryClient.invalidateQueries({ queryKey: plannerKeys.boardTasks(boardCode) })
  void queryClient.invalidateQueries({ queryKey: plannerKeys.task(key) })
}

export interface ChangeStatusInput {
  id: string
  key: string
  boardCode: string
  version: number
  statusId: string
  reason?: string
  /**
   * Offer «Скасувати» once the change is made: the status to go back to and
   * the new status's name for the toast. Absent on the undo itself, and when
   * the old status needs a reason — it cannot be restored without one.
   */
  undo?: { statusId: string; toName: string }
}

function sendStatus(input: ChangeStatusInput) {
  return patchTask(input.id, input.version, {
    status_id: input.statusId,
    ...(input.reason ? { reason: input.reason } : {}),
  })
}

/**
 * The change and its undo go through ONE mutation: the undo is a pending
 * command like any other (the chip is disabled while it runs) and fails the
 * same ways — 412 with the fresh version, the other errors as toasts. It
 * still runs when the chip that raised the toast has unmounted meanwhile (the
 * card moved to another column): the mutation's own callbacks are kept by
 * the mutation, not by the component.
 */
export function useChangeTaskStatus() {
  const { t } = useTranslation('planner')
  const queryClient = useQueryClient()

  const onFailed = (error: unknown, input: ChangeStatusInput): void => {
    const { status, code, details } = readPlannerError(error)
    if (status === 412 || code === 'revision_mismatch') {
      // Somebody else changed the task: show the fresh version, never
      // overwrite it silently (UX «Voice and Tone»).
      const current = details.current as PlannerTask | undefined
      if (current && typeof current === 'object' && 'version' in current) {
        queryClient.setQueryData(plannerKeys.task(input.key), current)
      }
      refreshTaskViews(queryClient, input.boardCode, input.key)
      toast.info(t('toast.stale'))
      return
    }
    toastPlannerError(t, error)
  }

  const onApplied = (task: PlannerTask, input: ChangeStatusInput): void => {
    queryClient.setQueryData(plannerKeys.task(input.key), task)
    refreshTaskViews(queryClient, input.boardCode, input.key)
    const { undo } = input
    if (!undo) return
    // The way back is one more PATCH under the version this change produced:
    // if somebody changed the task within the five seconds, it is a 412 and
    // the fresh version, not a silent overwrite.
    const back: ChangeStatusInput = {
      id: input.id,
      key: input.key,
      boardCode: input.boardCode,
      version: task.version,
      statusId: undo.statusId,
    }
    showUndoToast({
      message: t('toast.statusChanged', { key: input.key, status: undo.toName }),
      undoLabel: t('toast.undo'),
      onUndo: () => {
        change.mutate(back)
      },
    })
  }

  const change = useMutation({
    mutationFn: sendStatus,
    onSuccess: ({ task }, input) => onApplied(task, input),
    onError: onFailed,
  })
  return change
}

export interface CreateTaskInput {
  boardCode: string
  body: PlannerTaskCreate
  /** One key per form: a repeated «Створити» replays, it does not duplicate. */
  idempotencyKey: string
}

export function useCreatePlannerTask() {
  const { t } = useTranslation('planner')
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: CreateTaskInput) =>
      createTask(input.boardCode, input.body, input.idempotencyKey),
    onSuccess: (task, input) => {
      queryClient.setQueryData(plannerKeys.task(task.key), task)
      void queryClient.invalidateQueries({ queryKey: plannerKeys.boardTasks(input.boardCode) })
      void queryClient.invalidateQueries({ queryKey: plannerKeys.myTasks() })
    },
    onError: (error, input) => {
      if (isIdempotencyReplayConflict(error)) {
        // The task probably exists: show the board as it is now instead of
        // inviting a second attempt that would create a duplicate. The dialog
        // closes itself on this error (its key cannot be used again).
        void queryClient.invalidateQueries({ queryKey: plannerKeys.boardTasks(input.boardCode) })
        void queryClient.invalidateQueries({ queryKey: plannerKeys.myTasks() })
        toast.info(t('toast.maybeCreated'))
        return
      }
      toastPlannerError(t, error)
    },
  })
}
