/**
 * Planner commands from the CRM (planner story 1.10): create a task, change its
 * status. Errors are shown by `code` with our own text — never the server
 * `message` (epic 1, «Тексти»).
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

type TFunction = ReturnType<typeof useTranslation>['t']

/** Contract field → the form label the person saw (`details.field` of a 400). */
const FIELD_LABELS: Record<string, string> = {
  title: 'create.fields.title',
  description: 'create.fields.description',
  assignee_ids: 'create.fields.assignees',
  due_date: 'create.fields.due',
  due_at: 'create.fields.due',
}

/** Toast for a failed planner command; 412 is handled by the caller first. */
export function toastPlannerError(t: TFunction, error: unknown): void {
  const { status, code, details } = readPlannerError(error)
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
  toast.error(t('toast.failed'))
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
}

export function useChangeTaskStatus() {
  const { t } = useTranslation('planner')
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: ChangeStatusInput) =>
      patchTask(input.id, input.version, {
        status_id: input.statusId,
        ...(input.reason ? { reason: input.reason } : {}),
      }),
    onSuccess: ({ task }, input) => {
      queryClient.setQueryData(plannerKeys.task(input.key), task)
      refreshTaskViews(queryClient, input.boardCode, input.key)
    },
    onError: (error, input) => {
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
    },
  })
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
    onError: (error) => toastPlannerError(t, error),
  })
}
