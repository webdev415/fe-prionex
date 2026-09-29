/**
 * Commands of the board settings (planner story 5.10): the configuration
 * preview and save, and the explicit participants.
 *
 * Every refusal is read by its code (never the server `message`): a stale
 * version (412) puts the fresh card in the cache — the draft notices it
 * (`useConfigDraft`); the conflicts of the members path each have their own
 * sentence; the rest goes the 5.1 way (`toastPlannerError`).
 */
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import {
  deleteBoardMember,
  previewBoardConfig,
  putBoardConfig,
  putBoardMember,
  type PlannerBoard,
  type PlannerBoardConfigError,
  type PlannerBoardConfigPut,
  type PlannerBoardMemberRole,
} from '@/api/planner/plannerApi'
import { plannerBoardHistoryKey, plannerKeys } from '@/api/planner/plannerQueries'
import { readPlannerError } from '@/api/planner/plannerErrors'
import { toastPlannerError } from '../hooks/usePlannerMutations'

function isConfigError(value: unknown): value is PlannerBoardConfigError {
  if (!value || typeof value !== 'object') return false
  const error = value as Record<string, unknown>
  return typeof error.field === 'string' && typeof error.reason === 'string'
}

function isBoard(value: unknown): value is PlannerBoard {
  return Boolean(value && typeof value === 'object' && 'version' in value && 'config' in value)
}

/** A newer card after a command: in the cache, and the journal re-read. */
function useBoardApplied(code: string) {
  const queryClient = useQueryClient()
  return (board: PlannerBoard) => {
    queryClient.setQueryData(plannerKeys.board(code), board)
    void queryClient.invalidateQueries({ queryKey: plannerBoardHistoryKey(code) })
  }
}

/** 412 with `details.current`: the fresh card goes to the cache. True when it was one. */
function useStaleVersion(code: string) {
  const queryClient = useQueryClient()
  return (error: unknown): boolean => {
    const { status, code: errorCode, details } = readPlannerError(error)
    if (status !== 412 && errorCode !== 'revision_mismatch') return false
    if (isBoard(details.current)) queryClient.setQueryData(plannerKeys.board(code), details.current)
    else void queryClient.invalidateQueries({ queryKey: plannerKeys.board(code) })
    return true
  }
}

export interface ConfigCommandInput {
  version: number
  body: PlannerBoardConfigPut
}

export function useBoardConfigCommands(code: string) {
  const queryClient = useQueryClient()
  const applied = useBoardApplied(code)
  const preview = useMutation({
    mutationFn: ({ version, body }: ConfigCommandInput) => previewBoardConfig(code, version, body),
  })
  const save = useMutation({
    mutationFn: ({ version, body }: ConfigCommandInput) => putBoardConfig(code, version, body),
    onSuccess: (board) => {
      applied(board)
      // Moved tasks change columns; a renamed status changes every list.
      void queryClient.invalidateQueries({ queryKey: plannerKeys.boardTasks(code) })
      void queryClient.invalidateQueries({ queryKey: plannerKeys.myTasks() })
    },
  })
  return { preview, save }
}

/**
 * How a failed configuration command reads. Returns the validation errors of
 * a 400 (`details.errors[]`) for the caller to put on the rows.
 */
export function useConfigFailure(code: string) {
  const { t } = useTranslation('planner')
  const queryClient = useQueryClient()
  const stale = useStaleVersion(code)
  return (error: unknown): PlannerBoardConfigError[] | null => {
    if (stale(error)) {
      // The draft stays on screen (the conflict banner): not «the fresh version».
      toast.info(t('settings.toast.staleDraft'))
      return null
    }
    const { status, code: errorCode, details } = readPlannerError(error)
    if ((status === 400 || errorCode === 'validation') && Array.isArray(details.errors)) {
      toast.error(t('settings.toast.fixErrors'))
      return details.errors.filter(isConfigError)
    }
    if (status === 409 || errorCode === 'conflict') {
      if (details.reason === 'board_archived') {
        toast.error(t('settings.toast.archived'))
        return null
      }
      if (details.reason === 'board_config_changed') {
        void queryClient.invalidateQueries({ queryKey: plannerKeys.board(code) })
        toast.error(t('settings.toast.configChanged'))
        return null
      }
    }
    toastPlannerError(t, error)
    return null
  }
}

export type MemberFailure = 'already_member' | 'org_stale' | null

/** Conflicts of the members path (`409 details.reason`) with their own sentence. */
const MEMBER_CONFLICTS: Record<string, string> = {
  department_manager: 'settings.toast.departmentManager',
  org_stale: 'settings.toast.orgStale',
  last_admin: 'settings.toast.lastAdmin',
  board_archived: 'settings.toast.archived',
}

interface MemberCommandInput {
  userId: string
  version: number
}

/**
 * `PUT` / `DELETE /boards/{code}/members/{user_id}`. `onFailure` learns the
 * two refusals the screen shows in place rather than in a toast:
 * `already_member` (the add form says «Вже учасник з відділу») and `org_stale`
 * (the stale-org banner).
 */
export function useBoardMemberCommands(code: string, onFailure: (reason: MemberFailure) => void) {
  const { t } = useTranslation('planner')
  const applied = useBoardApplied(code)
  const stale = useStaleVersion(code)

  const failed = (error: unknown) => {
    if (stale(error)) {
      toast.info(t('settings.toast.stale'))
      return
    }
    const { status, code: errorCode, details } = readPlannerError(error)
    if (status === 409 || errorCode === 'conflict') {
      const reason = typeof details.reason === 'string' ? details.reason : ''
      if (reason === 'already_member') {
        onFailure('already_member')
        return
      }
      if (reason === 'org_stale') onFailure('org_stale')
      const text = MEMBER_CONFLICTS[reason]
      if (text) {
        toast.error(t(text))
        return
      }
    }
    if ((status === 400 || errorCode === 'validation') && details.field === 'user_id') {
      toast.error(t('settings.toast.personInvalid'))
      return
    }
    toastPlannerError(t, error)
  }

  const put = useMutation({
    mutationFn: ({
      userId,
      version,
      role,
    }: MemberCommandInput & { role: PlannerBoardMemberRole }) =>
      putBoardMember(code, userId, version, role),
    onSuccess: applied,
    onError: failed,
  })
  const remove = useMutation({
    mutationFn: ({ userId, version }: MemberCommandInput) =>
      deleteBoardMember(code, userId, version),
    onSuccess: (board) => {
      applied(board)
      toast.success(t('settings.toast.memberRemoved'))
    },
    onError: failed,
  })
  return { put, remove }
}
