import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Icons } from '@/lib/icons'
import { useHasPermission } from '@/hooks'
import { useAuthStore } from '@/stores/authStore'
import { useOperators } from '@/features/users/hooks'
import {
  useArchiveDrill,
  useAssignDrill,
  useCreateDrill,
  useDrills,
} from '@/features/training/hooks/useDrills'
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
  const [assignTarget, setAssignTarget] = useState<DrillCardData | null>(null)

  const filters = useMemo(() => ({}), [])
  const { data, isLoading, isError } = useDrills(filters)
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
            <DrillCard key={d.id} drill={d} onAssign={() => setAssignTarget(d)} />
          ))}
        </div>
      )}

      {createOpen ? <CreateDrillDialog onClose={() => setCreateOpen(false)} /> : null}
      {assignTarget ? (
        <AssignDrillDialog drill={assignTarget} onClose={() => setAssignTarget(null)} />
      ) : null}
    </div>
  )
}

function DrillCard({ drill, onAssign }: { drill: DrillCardData; onAssign: () => void }) {
  const { t } = useTranslation('common')
  const canManage = useHasPermission('manage_drills')
  const archiveDrill = useArchiveDrill()

  return (
    <div className="overflow-hidden rounded-xl border border-[#EBECE8] bg-white shadow-[0px_1px_2px_rgba(0,0,0,0.04)]">
      <div className="relative h-[60px] w-full bg-gradient-to-br from-[#F3FAF9] to-[#E3F6F3]">
        <span className="absolute top-3 left-4 flex h-8 w-8 items-center justify-center rounded-full bg-white shadow-[0px_1px_6px_rgba(0,0,0,0.05)]">
          <Icons.Activity01 size={16} className="text-[#7ACEC5]" />
        </span>
      </div>
      <div className="flex flex-col gap-3 p-4">
        <div className="flex flex-col gap-0.5">
          <h3 className="text-sm font-semibold text-[#05040D]">{drill.title}</h3>
          {drill.difficulty ? (
            <span className="text-[11px] text-[#6B7280]">
              {t('pages.training.drills.skill', 'Skill')}: {drill.difficulty}
            </span>
          ) : null}
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div className="flex flex-col items-center rounded-lg bg-[#F7F7F7] py-2">
            <span className="text-xs font-semibold text-[#05040D]">
              {drill.duration_minutes ?? '—'} {t('common.minutes', 'min')}
            </span>
            <span className="text-[9px] text-[#6B7280] uppercase">
              {t('pages.training.drills.timeToComplete', 'Time to Complete')}
            </span>
          </div>
          <div className="flex flex-col items-center rounded-lg bg-[#F7F7F7] py-2">
            <span className="text-xs font-semibold text-[#05040D]">{drill.attempt_count}</span>
            <span className="text-[9px] text-[#6B7280] uppercase">
              {t('pages.training.drills.performances', 'Performances')}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onAssign}
            disabled={!canManage}
            className="inline-flex flex-1 items-center justify-center gap-1 rounded-md bg-[#204E4D] px-3 py-2 text-xs font-medium text-white hover:bg-[#1a3f3e] disabled:opacity-50"
          >
            {t('pages.training.drills.assign', 'Assign')}
            <Icons.ArrowUp size={12} className="rotate-45 text-white" />
          </button>
          {canManage ? (
            <button
              type="button"
              onClick={() => archiveDrill.mutate(drill.id)}
              aria-label={t('common.archive', 'Archive')}
              title={t('common.archive', 'Archive')}
              className="rounded-md border border-[#EDEDED] bg-white px-2.5 py-2 text-xs font-medium text-[#05040D] hover:bg-[#F7F7F7]"
            >
              <Icons.Delete size={14} className="text-[#6B7280]" />
            </button>
          ) : null}
        </div>
      </div>
    </div>
  )
}

function AssignDrillDialog({ drill, onClose }: { drill: DrillCardData; onClose: () => void }) {
  const { t } = useTranslation('common')
  const assign = useAssignDrill()
  const activeProjectId = useAuthStore((s) => s.user?.active_project_id)
  const projectIdNum = activeProjectId ? Number(activeProjectId) : null
  const { data: operators = [] } = useOperators(projectIdNum)
  const [selected, setSelected] = useState<number[]>([])

  const toggle = (id: number) =>
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]))

  const submit = () => {
    if (selected.length === 0) return
    assign.mutate(
      { drillId: drill.id, operatorIds: selected },
      {
        onSuccess: () => {
          toast.success(t('pages.training.drills.assigned', 'Drill assigned.'))
          onClose()
        },
        onError: (err) => {
          const detail =
            err instanceof Error
              ? err.message
              : t('pages.training.drills.assignFailed', 'Could not assign the drill.')
          toast.error(detail)
        },
      }
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
      <div className="flex max-h-[80vh] w-full max-w-md flex-col rounded-xl bg-white p-5 shadow-xl">
        <h3 className="mb-1 text-sm font-semibold text-[#05040D]">
          {t('pages.training.drills.assign', 'Assign')}: {drill.title}
        </h3>
        <p className="mb-3 text-[11px] text-[#676767]">
          {t('pages.training.drills.assignHint', 'Select operators to assign this drill to.')}
        </p>
        <div className="flex-1 overflow-y-auto rounded-lg border border-[#EBECE8]">
          {operators.map((op) => (
            <label
              key={op.id}
              className="flex cursor-pointer items-center gap-2 border-b border-[#F3F4F6] px-3 py-2 text-xs last:border-b-0 hover:bg-[#FAFAFA]"
            >
              <input
                type="checkbox"
                checked={selected.includes(op.id)}
                onChange={() => toggle(op.id)}
              />
              <span className="text-[#05040D]">{op.full_name}</span>
            </label>
          ))}
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-[#EDEDED] bg-white px-3 py-2 text-xs font-medium text-[#05040D] hover:bg-[#F7F7F7]"
          >
            {t('common.cancel', 'Cancel')}
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={selected.length === 0 || assign.isPending}
            className="rounded-md bg-[#204E4D] px-3 py-2 text-xs font-medium text-white hover:bg-[#1a3f3e] disabled:opacity-50"
          >
            {t('pages.training.drills.assignCta', 'Assign')} ({selected.length})
          </button>
        </div>
      </div>
    </div>
  )
}

const DRILL_DIFFICULTIES: { value: string; key: string; fallback: string }[] = [
  { value: 'Easy', key: 'pages.training.drills.difficulty.easy', fallback: 'Easy' },
  { value: 'Medium', key: 'pages.training.drills.difficulty.medium', fallback: 'Medium' },
  { value: 'Hard', key: 'pages.training.drills.difficulty.hard', fallback: 'Hard' },
]

function CreateDrillDialog({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation('common')
  const createDrill = useCreateDrill()

  const [title, setTitle] = useState('')
  const [difficulty, setDifficulty] = useState('')
  const [durationMinutes, setDurationMinutes] = useState('')
  const [description, setDescription] = useState('')

  const canSubmit = title.trim().length > 0
  const field =
    'h-9 rounded-lg border border-[#EBECE8] bg-white px-3 text-xs text-[#05040D] focus:outline-none'

  const submit = () => {
    if (!canSubmit) return
    const duration = durationMinutes.trim() ? Number(durationMinutes) : null
    createDrill.mutate(
      {
        title: title.trim(),
        difficulty: difficulty.trim() || null,
        duration_minutes:
          duration != null && Number.isFinite(duration) && duration >= 0 ? duration : null,
        description: description.trim() || null,
      },
      {
        onSuccess: () => {
          toast.success(t('pages.training.drills.created', 'Drill created.'))
          onClose()
        },
        onError: (err) => {
          const detail =
            err instanceof Error
              ? err.message
              : t('pages.training.drills.createFailed', 'Could not create the drill.')
          toast.error(detail)
        },
      }
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
              {t('pages.training.drills.titleLabel', 'Title')}
            </span>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={t(
                'pages.training.drills.titlePlaceholder',
                'e.g. Objection handling — price'
              )}
              className={field}
            />
          </label>

          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1">
              <span className="text-xs font-medium text-[#05040D]">
                {t('pages.training.drills.difficultyLabel', 'Difficulty')}
              </span>
              <select
                value={difficulty}
                onChange={(e) => setDifficulty(e.target.value)}
                className={field}
              >
                <option value="">{t('pages.training.drills.noDifficulty', 'None')}</option>
                {DRILL_DIFFICULTIES.map((d) => (
                  <option key={d.value} value={d.value}>
                    {t(d.key, d.fallback)}
                  </option>
                ))}
              </select>
            </label>

            <label className="flex flex-col gap-1">
              <span className="text-xs font-medium text-[#05040D]">
                {t('pages.training.drills.duration', 'Duration')} ({t('common.minutes', 'min')})
              </span>
              <input
                type="number"
                min={0}
                value={durationMinutes}
                onChange={(e) => setDurationMinutes(e.target.value)}
                className={field}
              />
            </label>
          </div>

          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-[#05040D]">
              {t('pages.training.drills.descriptionLabel', 'Description')}
            </span>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder={t(
                'pages.training.drills.descriptionPlaceholder',
                'What this drill practises…'
              )}
              className="rounded-lg border border-[#EBECE8] px-3 py-2 text-xs text-[#05040D] focus:outline-none"
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
            disabled={!canSubmit || createDrill.isPending}
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
