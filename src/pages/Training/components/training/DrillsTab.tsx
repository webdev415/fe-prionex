import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { TFunction } from 'i18next'
import { toast } from 'sonner'
import { Icons } from '@/lib/icons'
import { useHasPermission } from '@/hooks'
import { useAuthStore } from '@/stores/authStore'
import { useOperators } from '@/features/users/hooks'
import {
  useArchiveDrill,
  useAssignDrill,
  useCreateDrill,
  useDrillAttempts,
  useDrills,
  useDrillStats,
  useTransitionAttempt,
  useUpdateDrill,
} from '@/features/training/hooks/useDrills'
import { exportDrills } from '@/features/training/api/drillsService'
import type {
  AttemptStatus,
  DrillAttemptCard,
  DrillCardData,
  DrillCategory,
  DrillCreatePayload,
  DrillListFilters,
  SkillLevel,
} from '@/features/training/types/drills'
import { TrainingPrimaryButton } from './TrainingToolbar'

const CATEGORIES: DrillCategory[] = [
  'objection_handling',
  'opening',
  'closing',
  'tone',
  'compliance',
]
const SKILL_LEVELS: SkillLevel[] = ['beginner', 'intermediate', 'advanced']

function categoryLabel(t: TFunction, c?: DrillCategory | null): string {
  if (!c) return ''
  return t(`pages.training.drills.category.${c}`, c.replace(/_/g, ' '))
}

function skillLabel(t: TFunction, s?: SkillLevel | null): string {
  if (!s) return ''
  return t(`pages.training.drills.skillLevel.${s}`, s)
}

function statusLabel(t: TFunction, s: AttemptStatus): string {
  const map: Record<AttemptStatus, string> = {
    assigned: t('pages.training.drills.attemptStatus.open', 'Open'),
    in_progress: t('pages.training.drills.attemptStatus.open', 'Open'),
    completed: t('pages.training.drills.attemptStatus.done', 'Done'),
    confirmed: t('pages.training.drills.attemptStatus.confirmed', 'Confirmed'),
    returned_for_revision: t('pages.training.drills.attemptStatus.returned', 'Returned'),
  }
  return map[s]
}

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
  const canView = useHasPermission('view_drills')
  const canManage = useHasPermission('manage_drills')

  const [createOpen, setCreateOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<DrillCardData | null>(null)
  const [assignTarget, setAssignTarget] = useState<DrillCardData | null>(null)
  const [detailsTarget, setDetailsTarget] = useState<DrillCardData | null>(null)

  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [category, setCategory] = useState<DrillCategory | ''>('')
  const [skillLevel, setSkillLevel] = useState<SkillLevel | ''>('')

  useEffect(() => {
    const id = setTimeout(() => setDebouncedSearch(search.trim()), 300)
    return () => clearTimeout(id)
  }, [search])

  const filters = useMemo<DrillListFilters>(
    () => ({
      q: debouncedSearch || undefined,
      category: category || undefined,
      skill_level: skillLevel || undefined,
    }),
    [debouncedSearch, category, skillLevel]
  )

  const { data, isLoading, isError } = useDrills(filters, canView)
  const drills = data?.data ?? []

  const control =
    'h-9 rounded-md border border-[#EBECE8] bg-white px-3 text-xs text-[#05040D] focus:outline-none'

  if (!canView) {
    return (
      <p className="py-8 text-center text-xs text-[#676767]">
        {t('pages.training.drills.noAccess', 'You do not have access to drills.')}
      </p>
    )
  }

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

      <div className="flex flex-wrap items-center gap-2">
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t('pages.training.drills.searchPlaceholder', 'Search drills…')}
          className={`${control} min-w-[180px] flex-1`}
        />
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value as DrillCategory | '')}
          className={control}
          aria-label={t('pages.training.drills.categoryLabel', 'Category')}
        >
          <option value="">{t('pages.training.drills.allCategories', 'All categories')}</option>
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {categoryLabel(t, c)}
            </option>
          ))}
        </select>
        <select
          value={skillLevel}
          onChange={(e) => setSkillLevel(e.target.value as SkillLevel | '')}
          className={control}
          aria-label={t('pages.training.drills.skillLevelLabel', 'Skill level')}
        >
          <option value="">{t('pages.training.drills.allSkillLevels', 'All levels')}</option>
          {SKILL_LEVELS.map((s) => (
            <option key={s} value={s}>
              {skillLabel(t, s)}
            </option>
          ))}
        </select>
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
              canManage={canManage}
              onAssign={() => setAssignTarget(d)}
              onEdit={() => setEditTarget(d)}
              onDetails={() => setDetailsTarget(d)}
            />
          ))}
        </div>
      )}

      {createOpen ? <DrillFormDialog onClose={() => setCreateOpen(false)} /> : null}
      {editTarget ? (
        <DrillFormDialog drill={editTarget} onClose={() => setEditTarget(null)} />
      ) : null}
      {assignTarget ? (
        <AssignDrillDialog drill={assignTarget} onClose={() => setAssignTarget(null)} />
      ) : null}
      {detailsTarget ? (
        <DrillDetailsDialog
          drill={detailsTarget}
          canManage={canManage}
          onClose={() => setDetailsTarget(null)}
        />
      ) : null}
    </div>
  )
}

function DrillCard({
  drill,
  canManage,
  onAssign,
  onEdit,
  onDetails,
}: {
  drill: DrillCardData
  canManage: boolean
  onAssign: () => void
  onEdit: () => void
  onDetails: () => void
}) {
  const { t } = useTranslation('common')
  const archiveDrill = useArchiveDrill()

  const badge = 'rounded-full px-2 py-0.5 text-[10px] font-medium'

  return (
    <div className="overflow-hidden rounded-xl border border-[#EBECE8] bg-white shadow-[0px_1px_2px_rgba(0,0,0,0.04)]">
      <div className="relative h-[60px] w-full bg-gradient-to-br from-[#F3FAF9] to-[#E3F6F3]">
        <span className="absolute top-3 left-4 flex h-8 w-8 items-center justify-center rounded-full bg-white shadow-[0px_1px_6px_rgba(0,0,0,0.05)]">
          <Icons.Activity01 size={16} className="text-[#7ACEC5]" />
        </span>
      </div>
      <div className="flex flex-col gap-3 p-4">
        <div className="flex flex-col gap-1.5">
          <h3 className="text-sm font-semibold text-[#05040D]">{drill.title}</h3>
          <div className="flex flex-wrap gap-1.5">
            {drill.category ? (
              <span className={`${badge} bg-[#EEF6FF] text-[#2563EB]`}>
                {categoryLabel(t, drill.category)}
              </span>
            ) : null}
            {drill.skill_level ? (
              <span className={`${badge} bg-[#F3FAF9] text-[#0F766E]`}>
                {skillLabel(t, drill.skill_level)}
              </span>
            ) : null}
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2">
          <Stat value={`${drill.duration_minutes ?? '—'}`} label={t('common.minutes', 'min')} />
          <Stat
            value={`${drill.attempt_count}`}
            label={t('pages.training.drills.assignments', 'Assigned')}
          />
          <Stat
            value={drill.completion_pct != null ? `${drill.completion_pct}%` : '—'}
            label={t('pages.training.drills.completion', 'Done')}
          />
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onDetails}
            className="inline-flex flex-1 items-center justify-center rounded-md border border-[#EDEDED] bg-white px-3 py-2 text-xs font-medium text-[#05040D] hover:bg-[#F7F7F7]"
          >
            {t('pages.training.drills.details', 'Details')}
          </button>
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
            <>
              <button
                type="button"
                onClick={onEdit}
                className="rounded-md border border-[#EDEDED] bg-white px-3 py-2 text-xs font-medium text-[#05040D] hover:bg-[#F7F7F7]"
              >
                {t('common.edit', 'Edit')}
              </button>
              <button
                type="button"
                onClick={() => archiveDrill.mutate(drill.id)}
                disabled={archiveDrill.isPending}
                aria-label={t('common.archive', 'Archive')}
                title={t('common.archive', 'Archive')}
                className="rounded-md border border-[#EDEDED] bg-white px-2.5 py-2 text-xs font-medium text-[#05040D] hover:bg-[#F7F7F7] disabled:opacity-50"
              >
                <Icons.Delete size={14} className="text-[#6B7280]" />
              </button>
            </>
          ) : null}
        </div>
      </div>
    </div>
  )
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="flex flex-col items-center rounded-lg bg-[#F7F7F7] py-2">
      <span className="text-xs font-semibold text-[#05040D]">{value}</span>
      <span className="text-[9px] text-[#6B7280] uppercase">{label}</span>
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
  const [deadline, setDeadline] = useState('')
  const [note, setNote] = useState('')

  const toggle = (id: number) =>
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]))

  const canAssign = selected.length > 0 && deadline !== ''

  const submit = () => {
    if (!canAssign) return
    assign.mutate(
      {
        drillId: drill.id,
        payload: {
          operator_ids: selected,
          deadline: new Date(deadline).toISOString(),
          note: note.trim() || null,
        },
      },
      {
        onSuccess: () => {
          toast.success(t('pages.training.drills.assigned', 'Drill assigned.'))
          onClose()
        },
        onError: (err) =>
          toast.error(
            err instanceof Error
              ? err.message
              : t('pages.training.drills.assignFailed', 'Could not assign the drill.')
          ),
      }
    )
  }

  const field =
    'rounded-lg border border-[#EBECE8] bg-white px-3 py-2 text-xs text-[#05040D] focus:outline-none'

  return (
    <DialogShell
      onClose={onClose}
      title={`${t('pages.training.drills.assign', 'Assign')}: ${drill.title}`}
    >
      <div className="flex flex-col gap-3">
        <p className="text-[11px] text-[#676767]">
          {t('pages.training.drills.assignHint', 'Select operators to assign this drill to.')}
        </p>
        <div className="max-h-[240px] overflow-y-auto rounded-lg border border-[#EBECE8]">
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
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-[#05040D]">
            {t('pages.training.drills.deadline', 'Deadline')} *
          </span>
          <input
            type="datetime-local"
            value={deadline}
            onChange={(e) => setDeadline(e.target.value)}
            required
            className={field}
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-[#05040D]">
            {t('pages.training.drills.note', 'Comment (optional)')}
          </span>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={2}
            className={field}
          />
        </label>
      </div>
      <div className="mt-4 flex justify-end gap-2">
        <SecondaryButton onClick={onClose}>{t('common.cancel', 'Cancel')}</SecondaryButton>
        <button
          type="button"
          onClick={submit}
          disabled={!canAssign || assign.isPending}
          className="rounded-md bg-[#204E4D] px-3 py-2 text-xs font-medium text-white hover:bg-[#1a3f3e] disabled:opacity-50"
        >
          {t('pages.training.drills.assignCta', 'Assign')} ({selected.length})
        </button>
      </div>
    </DialogShell>
  )
}

function DrillFormDialog({ drill, onClose }: { drill?: DrillCardData; onClose: () => void }) {
  const { t } = useTranslation('common')
  const createDrill = useCreateDrill()
  const updateDrill = useUpdateDrill()
  const isEdit = drill != null

  const [title, setTitle] = useState(drill?.title ?? '')
  const [category, setCategory] = useState<DrillCategory | ''>(drill?.category ?? '')
  const [skillLevel, setSkillLevel] = useState<SkillLevel | ''>(drill?.skill_level ?? '')
  const [durationMinutes, setDurationMinutes] = useState(
    drill?.duration_minutes != null ? String(drill.duration_minutes) : ''
  )
  const [successCriteria, setSuccessCriteria] = useState(drill?.success_criteria ?? '')
  const [description, setDescription] = useState(drill?.description ?? '')

  const canSubmit = title.trim().length > 0
  const pending = createDrill.isPending || updateDrill.isPending
  const field =
    'h-9 rounded-lg border border-[#EBECE8] bg-white px-3 text-xs text-[#05040D] focus:outline-none'

  const submit = () => {
    if (!canSubmit) return
    const duration = durationMinutes.trim() ? Number(durationMinutes) : null
    const payload: DrillCreatePayload = {
      title: title.trim(),
      category: category || null,
      skill_level: skillLevel || null,
      duration_minutes:
        duration != null && Number.isFinite(duration) && duration >= 0 ? duration : null,
      success_criteria: successCriteria.trim() || null,
      description: description.trim() || null,
    }
    const onDone = {
      onSuccess: () => {
        toast.success(
          isEdit
            ? t('pages.training.drills.updated', 'Drill updated.')
            : t('pages.training.drills.created', 'Drill created.')
        )
        onClose()
      },
      onError: (err: unknown) =>
        toast.error(
          err instanceof Error
            ? err.message
            : t('pages.training.drills.saveFailed', 'Could not save the drill.')
        ),
    }
    if (isEdit && drill) {
      updateDrill.mutate({ id: drill.id, payload }, onDone)
    } else {
      createDrill.mutate(payload, onDone)
    }
  }

  return (
    <DialogShell
      onClose={onClose}
      title={
        isEdit
          ? t('pages.training.drills.editTitle', 'Edit drill')
          : t('pages.training.drills.create', 'Create a Drill')
      }
    >
      <div className="flex flex-col gap-4">
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
              {t('pages.training.drills.categoryLabel', 'Category')}
            </span>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as DrillCategory | '')}
              className={field}
            >
              <option value="">{t('pages.training.drills.noCategory', 'None')}</option>
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {categoryLabel(t, c)}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-[#05040D]">
              {t('pages.training.drills.skillLevelLabel', 'Skill level')}
            </span>
            <select
              value={skillLevel}
              onChange={(e) => setSkillLevel(e.target.value as SkillLevel | '')}
              className={field}
            >
              <option value="">{t('pages.training.drills.noSkillLevel', 'None')}</option>
              {SKILL_LEVELS.map((s) => (
                <option key={s} value={s}>
                  {skillLabel(t, s)}
                </option>
              ))}
            </select>
          </label>
        </div>

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

        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-[#05040D]">
            {t('pages.training.drills.successCriteriaLabel', 'Success criteria')}
          </span>
          <textarea
            value={successCriteria}
            onChange={(e) => setSuccessCriteria(e.target.value)}
            rows={2}
            placeholder={t(
              'pages.training.drills.successCriteriaPlaceholder',
              'What good looks like…'
            )}
            className="rounded-lg border border-[#EBECE8] px-3 py-2 text-xs text-[#05040D] focus:outline-none"
          />
        </label>

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

      <div className="mt-4 flex justify-end gap-2">
        <SecondaryButton onClick={onClose}>{t('common.cancel', 'Cancel')}</SecondaryButton>
        <button
          type="button"
          onClick={submit}
          disabled={!canSubmit || pending}
          className="rounded-md bg-[#BBFB5B] px-5 py-2 text-xs font-semibold text-[#05040D] hover:bg-[#a9e94f] disabled:opacity-50"
        >
          {isEdit ? t('common.save', 'Save') : t('common.create', 'Create')}
        </button>
      </div>
    </DialogShell>
  )
}

function DrillDetailsDialog({
  drill,
  canManage,
  onClose,
}: {
  drill: DrillCardData
  canManage: boolean
  onClose: () => void
}) {
  const { t } = useTranslation('common')
  const { data: stats } = useDrillStats(drill.id)
  const { data: attempts = [], isLoading } = useDrillAttempts(drill.id)
  const activeProjectId = useAuthStore((s) => s.user?.active_project_id)
  const projectIdNum = activeProjectId ? Number(activeProjectId) : null
  const { data: operators = [] } = useOperators(projectIdNum)
  const operatorNames = useMemo(
    () => new Map(operators.map((op) => [op.id, op.full_name])),
    [operators]
  )
  const transition = useTransitionAttempt()
  const [returnFor, setReturnFor] = useState<number | null>(null)
  const [returnComment, setReturnComment] = useState('')

  const runTransition = (attempt: DrillAttemptCard, to: AttemptStatus, comment?: string) => {
    transition.mutate(
      { attemptId: attempt.id, payload: { to_status: to, comment: comment ?? null } },
      {
        onSuccess: () => {
          toast.success(t('pages.training.drills.reviewSaved', 'Review saved.'))
          setReturnFor(null)
          setReturnComment('')
        },
        onError: (err) =>
          toast.error(
            err instanceof Error
              ? err.message
              : t('pages.training.drills.reviewFailed', 'Could not save the review.')
          ),
      }
    )
  }

  return (
    <DialogShell onClose={onClose} title={drill.title}>
      {stats ? (
        <div className="mb-3 grid grid-cols-4 gap-2">
          <Stat
            value={`${stats.total}`}
            label={t('pages.training.drills.assignments', 'Assigned')}
          />
          <Stat
            value={`${stats.completion_pct}%`}
            label={t('pages.training.drills.completion', 'Done')}
          />
          <Stat value={`${stats.overdue}`} label={t('pages.training.drills.overdue', 'Overdue')} />
          <Stat
            value={
              stats.avg_complete_minutes != null ? `${Math.round(stats.avg_complete_minutes)}` : '—'
            }
            label={t('pages.training.drills.avgMinutes', 'Avg min')}
          />
        </div>
      ) : null}

      <h4 className="mb-2 text-xs font-semibold text-[#05040D]">
        {t('pages.training.drills.assignmentHistory', 'Assignment history')}
      </h4>
      {isLoading ? (
        <p className="py-4 text-center text-xs text-[#676767]">{t('common.loading', 'Loading…')}</p>
      ) : attempts.length === 0 ? (
        <p className="py-4 text-center text-xs text-[#676767]">
          {t('pages.training.drills.noAssignments', 'Not assigned to anyone yet.')}
        </p>
      ) : (
        <div className="flex max-h-[320px] flex-col gap-2 overflow-y-auto">
          {attempts.map((a) => (
            <div key={a.id} className="rounded-lg border border-[#EBECE8] px-3 py-2 text-xs">
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium text-[#05040D]">
                  {operatorNames.get(a.operator_id) ??
                    `${t('pages.training.drills.operator', 'Operator')} #${a.operator_id}`}
                </span>
                <div className="flex items-center gap-1.5">
                  {a.is_overdue ? (
                    <span className="rounded-full bg-[#FEECEC] px-2 py-0.5 text-[10px] font-medium text-[#EF4444]">
                      {t('pages.training.drills.overdue', 'Overdue')}
                    </span>
                  ) : null}
                  <span className="rounded-full bg-[#F3F4F6] px-2 py-0.5 text-[10px] font-medium text-[#374151]">
                    {statusLabel(t, a.status)}
                  </span>
                </div>
              </div>
              {a.deadline ? (
                <p className="mt-1 text-[11px] text-[#6B7280]">
                  {t('pages.training.drills.deadline', 'Deadline')}:{' '}
                  {new Date(a.deadline).toLocaleString()}
                </p>
              ) : null}
              {a.reflection ? (
                <p className="mt-1 text-[11px] text-[#374151]">“{a.reflection}”</p>
              ) : null}

              {canManage && a.status === 'completed' ? (
                returnFor === a.id ? (
                  <div className="mt-2 flex flex-col gap-2">
                    <textarea
                      value={returnComment}
                      onChange={(e) => setReturnComment(e.target.value)}
                      rows={2}
                      placeholder={t('pages.training.drills.returnReason', 'Reason for revision…')}
                      className="rounded-md border border-[#EBECE8] px-2 py-1.5 text-[11px] focus:outline-none"
                    />
                    <div className="flex justify-end gap-2">
                      <SecondaryButton onClick={() => setReturnFor(null)}>
                        {t('common.cancel', 'Cancel')}
                      </SecondaryButton>
                      <button
                        type="button"
                        onClick={() =>
                          runTransition(a, 'returned_for_revision', returnComment.trim())
                        }
                        disabled={transition.isPending}
                        className="rounded-md bg-[#EF4444] px-3 py-1.5 text-[11px] font-medium text-white hover:bg-[#dc3d3d] disabled:opacity-50"
                      >
                        {t('pages.training.drills.return', 'Return')}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="mt-2 flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setReturnFor(a.id)}
                      className="rounded-md border border-[#EDEDED] bg-white px-3 py-1.5 text-[11px] font-medium text-[#05040D] hover:bg-[#F7F7F7]"
                    >
                      {t('pages.training.drills.return', 'Return')}
                    </button>
                    <button
                      type="button"
                      onClick={() => runTransition(a, 'confirmed')}
                      disabled={transition.isPending}
                      className="rounded-md bg-[#204E4D] px-3 py-1.5 text-[11px] font-medium text-white hover:bg-[#1a3f3e] disabled:opacity-50"
                    >
                      {t('pages.training.drills.confirm', 'Confirm')}
                    </button>
                  </div>
                )
              ) : null}
            </div>
          ))}
        </div>
      )}

      <div className="mt-4 flex justify-end">
        <SecondaryButton onClick={onClose}>{t('common.close', 'Close')}</SecondaryButton>
      </div>
    </DialogShell>
  )
}

function DialogShell({
  title,
  children,
  onClose,
}: {
  title: string
  children: React.ReactNode
  onClose: () => void
}) {
  const { t } = useTranslation('common')
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
      <div className="flex max-h-[90vh] w-full max-w-md flex-col rounded-xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-[#EBECE8] px-5 py-4">
          <h3 className="text-base font-semibold text-[#05040D]">{title}</h3>
          <button type="button" onClick={onClose} aria-label={t('common.close', 'Close')}>
            <Icons.Close size={18} className="text-[#676767]" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
      </div>
    </div>
  )
}

function SecondaryButton({
  children,
  onClick,
}: {
  children: React.ReactNode
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-md border border-[#EDEDED] bg-white px-3 py-2 text-xs font-medium text-[#05040D] hover:bg-[#F7F7F7]"
    >
      {children}
    </button>
  )
}

export default DrillsTab
