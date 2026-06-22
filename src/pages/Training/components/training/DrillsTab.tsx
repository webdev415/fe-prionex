import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Icons } from '@/lib/icons'
import { useHasPermission } from '@/hooks'
import {
  useArchiveDrill,
  useCreateDrill,
  useDrills,
  useSubmitAttempt,
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
  const [query, setQuery] = useState('')
  const [createOpen, setCreateOpen] = useState(false)

  const filters = useMemo(() => ({ q: query || undefined }), [query])
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

function CreateDrillDialog({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation('common')
  const createDrill = useCreateDrill()
  const [title, setTitle] = useState('')
  const [difficulty, setDifficulty] = useState('')
  const [duration, setDuration] = useState('')

  const submit = () => {
    if (!title.trim()) return
    createDrill.mutate(
      {
        title: title.trim(),
        difficulty: difficulty.trim() || null,
        duration_minutes: duration ? Number(duration) : null,
      },
      { onSuccess: onClose }
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
      <div className="w-full max-w-md rounded-xl bg-white p-5 shadow-xl">
        <h3 className="mb-4 text-sm font-semibold text-[#05040D]">
          {t('pages.training.drills.create', 'Create a drill')}
        </h3>
        <div className="flex flex-col gap-3">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={t('pages.training.drills.fieldTitle', 'Title')}
            className="h-9 rounded-lg border border-[#EBECE8] px-3 text-xs focus:outline-none"
          />
          <input
            value={difficulty}
            onChange={(e) => setDifficulty(e.target.value)}
            placeholder={t('pages.training.drills.fieldDifficulty', 'Difficulty (e.g. easy)')}
            className="h-9 rounded-lg border border-[#EBECE8] px-3 text-xs focus:outline-none"
          />
          <input
            value={duration}
            onChange={(e) => setDuration(e.target.value)}
            type="number"
            placeholder={t('pages.training.drills.fieldDuration', 'Duration (minutes)')}
            className="h-9 rounded-lg border border-[#EBECE8] px-3 text-xs focus:outline-none"
          />
        </div>
        <div className="mt-5 flex justify-end gap-2">
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
            disabled={!title.trim() || createDrill.isPending}
            className="rounded-md bg-[#204E4D] px-3 py-2 text-xs font-medium text-white hover:bg-[#1a3f3e] disabled:opacity-50"
          >
            {t('common.create', 'Create')}
          </button>
        </div>
      </div>
    </div>
  )
}

export default DrillsTab
