import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Icons } from '@/lib/icons'
import { useHasPermission } from '@/hooks'
import { useAuthStore } from '@/stores/authStore'
import { useOperators } from '@/features/users/hooks'
import {
  useCallMonitoring,
  useCreateCorrectionTask,
  type CorrectionTaskType,
} from '@/features/training'
import { useArchiveDrill, useDrills, useSubmitAttempt } from '@/features/training/hooks/useDrills'
import { exportDrills } from '@/features/training/api/drillsService'
import type { DrillCardData } from '@/features/training/types/drills'
import { TrainingPrimaryButton } from './TrainingToolbar'

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}

export function DrillsTab() {
  const { t } = useTranslation('common')
  const canManage = useHasPermission('manage_drills')
  const [createOpen, setCreateOpen] = useState(false)

  const filters = useMemo(() => ({}), [])
  const { data, isLoading, isError } = useDrills(filters)
  const submitAttempt = useSubmitAttempt()
  const drills = data?.data ?? []

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-base font-semibold text-[#05040D]">
          {t('pages.training.drills.title', 'Short drills')}
        </h2>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => exportDrills(filters).then((b) => triggerDownload(b, 'drills.xlsx'))}
            className="inline-flex items-center gap-1 rounded-md border border-[#EDEDED] bg-white px-3 py-2 text-xs font-medium text-[#05040D] hover:bg-[#F7F7F7]"
          >
            {t('common.export', 'Export')}
          </button>
          {canManage ? (
            <TrainingPrimaryButton
              onClick={() => setCreateOpen(true)}
              leftIcon={<Icons.Add size={14} className="text-white" />}
            >
              {t('pages.training.drills.create', 'Create a drill')}
            </TrainingPrimaryButton>
          ) : null}
        </div>
      </div>

      {isLoading ? (
        <p className="py-8 text-center text-xs text-[#676767]">{t('common.loading', 'Loading…')}</p>
      ) : isError ? (
        <p className="py-8 text-center text-xs text-[#EF4444]">
          {t('pages.training.drills.loadFailed', 'Failed to load drills.')}
        </p>
      ) : drills.length === 0 ? (
        <p className="py-8 text-center text-xs text-[#676767]">
          {t('pages.training.drills.empty', 'No drills yet.')}
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {drills.map((d) => (
            <DrillCard
              key={d.id}
              drill={d}
              onStart={() => submitAttempt.mutate({ drillId: d.id })}
            />
          ))}
        </div>
      )}

      {createOpen ? <CreateDrillDialog onClose={() => setCreateOpen(false)} /> : null}
    </div>
  )
}

function DrillCard({ drill, onStart }: { drill: DrillCardData; onStart: () => void }) {
  const { t } = useTranslation('common')
  const canManage = useHasPermission('manage_drills')
  const archiveDrill = useArchiveDrill()

  return (
    <div className="overflow-hidden rounded-xl border border-[#EBECE8] bg-white shadow-[0px_1px_2px_rgba(0,0,0,0.04)]">
      <div className="h-[60px] w-full bg-gradient-to-br from-[#F3FAF9] to-[#E3F6F3]" />
      <div className="flex flex-col gap-3 p-4">
        <div className="flex items-start justify-between gap-2">
          <h3 className="text-sm font-semibold text-[#05040D]">{drill.title}</h3>
          {drill.difficulty ? (
            <span className="rounded-full bg-[#F0FDF4] px-2 py-0.5 text-[10px] font-medium text-[#15803D]">
              {drill.difficulty}
            </span>
          ) : null}
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div className="flex flex-col items-center rounded-lg bg-[#F7F7F7] py-2">
            <span className="text-xs font-semibold text-[#05040D]">
              {drill.duration_minutes ?? '—'} min
            </span>
            <span className="text-[9px] text-[#6B7280] uppercase">
              {t('pages.training.drills.duration', 'Duration')}
            </span>
          </div>
          <div className="flex flex-col items-center rounded-lg bg-[#F7F7F7] py-2">
            <span className="text-xs font-semibold text-[#05040D]">{drill.attempt_count}</span>
            <span className="text-[9px] text-[#6B7280] uppercase">
              {t('pages.training.drills.attempts', 'Attempts')}
            </span>
          </div>
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={onStart}
            className="inline-flex flex-1 items-center justify-center gap-1 rounded-md bg-[#204E4D] px-3 py-2 text-xs font-medium text-white hover:bg-[#1a3f3e]"
          >
            <Icons.Play size={12} className="text-white" />
            {t('pages.training.drills.start', 'Start')}
          </button>
          {canManage ? (
            <button
              type="button"
              onClick={() => archiveDrill.mutate(drill.id)}
              className="rounded-md border border-[#EDEDED] bg-white px-3 py-2 text-xs font-medium text-[#05040D] hover:bg-[#F7F7F7]"
            >
              {t('common.archive', 'Archive')}
            </button>
          ) : null}
        </div>
      </div>
    </div>
  )
}

const DRILL_TASK_TYPES: { id: CorrectionTaskType; key: string; fallback: string }[] = [
  {
    id: 'listen_reflect',
    key: 'pages.training.drills.taskType.listen',
    fallback: 'Listen and analyze',
  },
  {
    id: 'practice_next_call',
    key: 'pages.training.drills.taskType.practice',
    fallback: 'Work on it in the next call',
  },
  {
    id: 'study_material',
    key: 'pages.training.drills.taskType.study',
    fallback: 'Study the material',
  },
]

function CreateDrillDialog({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation('common')
  const createTask = useCreateCorrectionTask()
  const activeProjectId = useAuthStore((s) => s.user?.active_project_id)
  const projectIdNum = activeProjectId ? Number(activeProjectId) : null
  const { data: operators = [] } = useOperators(projectIdNum)

  const [operatorId, setOperatorId] = useState('')
  const [callId, setCallId] = useState('')
  const [comment, setComment] = useState('')
  const [taskType, setTaskType] = useState<CorrectionTaskType>('listen_reflect')
  const [deadline, setDeadline] = useState('')

  const operator = operatorId ? operators.find((o) => o.id === Number(operatorId)) : undefined
  const extension = operator?.asterisk_extension ?? null
  const { data: callsData, isLoading: callsLoading } = useCallMonitoring(
    {
      agent_extensions: extension ? [extension] : [],
      period: 'last_30d',
      sort: 'date_desc',
      limit: 20,
    },
    !!extension
  )
  const calls = useMemo(() => callsData?.calls ?? [], [callsData])

  const canSubmit = operatorId && callId && comment.trim()
  const field =
    'h-9 rounded-lg border border-[#EBECE8] bg-white px-3 text-xs text-[#05040D] focus:outline-none'

  const submit = () => {
    if (!canSubmit) return
    createTask.mutate(
      {
        operator_id: Number(operatorId),
        call_id: callId,
        task_type: taskType,
        title: comment.trim().slice(0, 200),
        description: comment.trim(),
        due_date: deadline ? new Date(`${deadline}T23:59:59`).toISOString() : undefined,
        priority: 'normal',
      },
      { onSuccess: onClose }
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
      <div className="flex max-h-[90vh] w-full max-w-md flex-col rounded-xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-[#EBECE8] px-5 py-4">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#BBFB5B]">
              <Icons.Activity01 size={18} className="text-[#05040D]" />
            </span>
            <h3 className="text-xl font-semibold text-[#05040D]">
              {t('pages.training.drills.create', 'Create a Drill')}
            </h3>
          </div>
          <button type="button" onClick={onClose} aria-label="Close">
            <Icons.Close size={18} className="text-[#676767]" />
          </button>
        </div>

        <div className="flex flex-1 flex-col gap-4 overflow-y-auto px-5 py-4">
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-[#05040D]">
              {t('pages.training.drills.operator', 'Operator')}
            </span>
            <select
              value={operatorId}
              onChange={(e) => {
                setOperatorId(e.target.value)
                setCallId('')
              }}
              className={field}
            >
              <option value="">{t('common.select', 'Select…')}</option>
              {operators.map((op) => (
                <option key={op.id} value={op.id}>
                  {op.full_name}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-[#05040D]">
              {t('pages.training.drills.call', 'Call')}
            </span>
            <select
              value={callId}
              onChange={(e) => setCallId(e.target.value)}
              disabled={!extension || callsLoading}
              className={field}
            >
              <option value="">
                {!operatorId
                  ? t('pages.training.drills.pickOperatorFirst', 'Select an operator first')
                  : callsLoading
                    ? t('common.loading', 'Loading…')
                    : t('pages.training.drills.pickCall', 'Pick a call')}
              </option>
              {calls.map((call) => {
                const when = call.initiated_at ? new Date(call.initiated_at).toLocaleString() : '—'
                return (
                  <option key={call.call_id} value={call.call_id}>
                    {when} · {call.customer_number}
                  </option>
                )
              })}
            </select>
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-[#05040D]">
              {t('pages.training.drills.errorComment', 'Error / comment')}
            </span>
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              rows={3}
              placeholder={t('pages.training.drills.errorPlaceholder', 'Objection not worked out…')}
              className="rounded-lg border border-[#EBECE8] px-3 py-2 text-xs text-[#05040D] focus:outline-none"
            />
          </label>

          <div className="flex flex-col gap-2">
            <span className="text-xs font-medium text-[#05040D]">
              {t('pages.training.drills.taskTypeLabel', 'Task type')}
            </span>
            {DRILL_TASK_TYPES.map((opt) => (
              <label
                key={opt.id}
                className="flex cursor-pointer items-center gap-2 text-xs text-[#05040D]"
              >
                <input
                  type="radio"
                  name="drill-task-type"
                  checked={taskType === opt.id}
                  onChange={() => setTaskType(opt.id)}
                />
                {t(opt.key, opt.fallback)}
              </label>
            ))}
          </div>

          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-[#05040D]">
              {t('pages.training.drills.deadline', 'Deadline')}
            </span>
            <input
              type="date"
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
              className={field}
            />
          </label>
        </div>

        <div className="flex justify-end gap-2 border-t border-[#EBECE8] px-5 py-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md bg-[#9CA3AF] px-5 py-2 text-xs font-medium text-white hover:bg-[#8b909c]"
          >
            {t('common.cancel', 'Cancel')}
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={!canSubmit || createTask.isPending}
            className="rounded-md bg-[#BBFB5B] px-5 py-2 text-xs font-semibold text-[#05040D] hover:bg-[#a9e94f] disabled:opacity-50"
          >
            {t('common.create', 'Create')}
          </button>
        </div>
      </div>
    </div>
  )
}

export default DrillsTab
