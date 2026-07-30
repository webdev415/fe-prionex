import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Icons } from '@/lib/icons'
import { formatDate, formatMonthDay, formatTimeShort } from '@/lib/localeFormat'
import { useHasPermission } from '@/hooks'
import { useAuthStore } from '@/stores/authStore'
import { useOperators } from '@/features/users/hooks'
import {
  useAssignGroupTraining,
  useCancelGroupTraining,
  useCreateGroupTraining,
  useGroupTrainingParticipants,
  useGroupTrainings,
  useRegisterForTraining,
  useUnregisterFromTraining,
} from '@/features/training/hooks/useGroupTrainings'
import type { GroupTrainingCardData } from '@/features/training/types/groupTrainings'
import { TrainingPrimaryButton } from './TrainingToolbar'

type NameById = Map<number, string>

function formatDateTime(iso: string, language: string): { date: string; time: string } {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return { date: iso, time: '' }
  return { date: formatMonthDay(d, language), time: formatTimeShort(d, language) }
}

export function GroupTrainingsTab() {
  const { t } = useTranslation('common')
  const canManage = useHasPermission('manage_trainings')
  const [createOpen, setCreateOpen] = useState(false)
  const [participantsTarget, setParticipantsTarget] = useState<GroupTrainingCardData | null>(null)
  const [assignTarget, setAssignTarget] = useState<GroupTrainingCardData | null>(null)

  const activeProjectId = useAuthStore((s) => s.user?.active_project_id)
  const projectIdNum = activeProjectId ? Number(activeProjectId) : null
  const { data: operators = [] } = useOperators(projectIdNum)
  const nameById = useMemo<NameById>(
    () => new Map(operators.map((op) => [op.id, op.full_name])),
    [operators]
  )

  const { data, isLoading, isError } = useGroupTrainings({})
  const trainings = data?.data ?? []

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-base font-semibold text-[#05040D]">
          {t('pages.training.groupTrainings.title', 'Group trainings')}
        </h2>
        {canManage ? (
          <TrainingPrimaryButton
            onClick={() => setCreateOpen(true)}
            leftIcon={<Icons.Add size={14} className="text-white" />}
          >
            {t('pages.training.groupTrainings.schedule', 'Schedule a training')}
          </TrainingPrimaryButton>
        ) : null}
      </div>

      {isLoading ? (
        <p className="py-8 text-center text-xs text-[#676767]">{t('common.loading', 'Loading…')}</p>
      ) : isError ? (
        <p className="py-8 text-center text-xs text-[#EF4444]">
          {t('pages.training.groupTrainings.loadFailed', 'Failed to load trainings.')}
        </p>
      ) : trainings.length === 0 ? (
        <p className="py-8 text-center text-xs text-[#676767]">
          {t('pages.training.groupTrainings.empty', 'No scheduled trainings.')}
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {trainings.map((g) => (
            <GroupTrainingCard
              key={g.id}
              training={g}
              canManage={canManage}
              trainerName={nameById.get(g.trainer_id)}
              onParticipants={() => setParticipantsTarget(g)}
              onAssign={() => setAssignTarget(g)}
            />
          ))}
        </div>
      )}

      {createOpen ? <ScheduleTrainingDialog onClose={() => setCreateOpen(false)} /> : null}
      {participantsTarget ? (
        <ParticipantsDialog
          training={participantsTarget}
          nameById={nameById}
          onClose={() => setParticipantsTarget(null)}
        />
      ) : null}
      {assignTarget ? (
        <AssignParticipantsDialog
          training={assignTarget}
          operators={operators}
          onClose={() => setAssignTarget(null)}
        />
      ) : null}
    </div>
  )
}

function GroupTrainingCard({
  training,
  canManage,
  trainerName,
  onParticipants,
  onAssign,
}: {
  training: GroupTrainingCardData
  canManage: boolean
  trainerName?: string
  onParticipants: () => void
  onAssign: () => void
}) {
  const { t, i18n } = useTranslation('common')
  const register = useRegisterForTraining()
  const unregister = useUnregisterFromTraining()
  const cancel = useCancelGroupTraining()
  const { date, time } = formatDateTime(training.scheduled_at, i18n.language)
  const seatsLeft =
    training.max_participants != null ? training.max_participants - training.registered_count : null
  const isFull = seatsLeft != null && seatsLeft <= 0
  const isCompleted = training.status === 'completed'
  const isCancelled = training.status === 'cancelled'

  // Figma subtitle: "Location · Trainer: Name" — omit missing parts.
  const subtitleParts = [
    training.location ?? undefined,
    trainerName
      ? `${t('pages.training.groupTrainings.trainer', 'Trainer')}: ${trainerName}`
      : undefined,
  ].filter(Boolean)

  const statusBadge = isCompleted
    ? {
        label: t('pages.training.groupTrainings.statusCompleted', 'Completed'),
        tone: 'bg-[#F0FDF4] text-[#15803D]',
      }
    : isCancelled
      ? {
          label: t('pages.training.groupTrainings.statusCancelled', 'Cancelled'),
          tone: 'bg-[#FEF2F2] text-[#B91C1C]',
        }
      : {
          label: t('pages.training.groupTrainings.statusScheduled', 'Scheduled'),
          tone: 'bg-[#EFF6FF] text-[#2563EB]',
        }

  return (
    <div className="overflow-hidden rounded-xl border border-[#EBECE8] bg-white shadow-[0px_1px_2px_rgba(0,0,0,0.04)]">
      <div className="relative h-20 w-full bg-gradient-to-br from-[#F3FAF9] to-[#E3F6F3]">
        <span
          className={`absolute top-3 right-3 rounded-full px-2.5 py-0.5 text-[10px] font-medium ${statusBadge.tone}`}
        >
          {statusBadge.label}
        </span>
        <div className="absolute top-3 left-3 flex flex-col text-[#204E4D]">
          <span className="text-2xl leading-none font-semibold">{date.split('.')[0]}</span>
          <span className="text-[10px]">{date}</span>
        </div>
      </div>
      <div className="flex flex-col gap-3 p-4">
        <div className="flex flex-col gap-0.5">
          <h3 className="text-sm font-semibold text-[#05040D]">{training.title}</h3>
          {subtitleParts.length > 0 ? (
            <span className="text-[11px] text-[#6B7280]">{subtitleParts.join(' · ')}</span>
          ) : null}
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div className="flex flex-col items-center rounded-lg bg-[#F7F7F7] py-2">
            <span className="text-xs font-semibold text-[#05040D]">{time}</span>
            <span className="text-[9px] text-[#6B7280] uppercase">
              {t('pages.training.groupTrainings.time', 'Time')}
            </span>
          </div>
          <div className="flex flex-col items-center rounded-lg bg-[#F7F7F7] py-2">
            <span className="text-xs font-semibold text-[#05040D]">
              {training.registered_count}
              {training.max_participants != null ? `/${training.max_participants}` : ''}
            </span>
            <span className="text-[9px] text-[#6B7280] uppercase">
              {t('pages.training.groupTrainings.participants', 'Participants')}
            </span>
          </div>
        </div>

        {!isCompleted && !isCancelled && seatsLeft != null && seatsLeft > 0 && seatsLeft <= 5 ? (
          <span className="text-[10px] font-medium text-[#D97706]">
            {t('pages.training.groupTrainings.seatsLeft', '{{count}} seats left', {
              count: seatsLeft,
            })}
          </span>
        ) : null}

        {isCompleted ? (
          /* Figma — completed sessions show a Report (attendance) button. */
          <button
            type="button"
            onClick={onParticipants}
            className="rounded-md border border-[#EDEDED] bg-white px-3 py-2 text-xs font-medium text-[#05040D] hover:bg-[#F7F7F7]"
          >
            {t('pages.training.groupTrainings.report', 'Report')}
          </button>
        ) : canManage ? (
          /* Figma — trainer view: Participants + Assign. */
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onParticipants}
              className="flex-1 rounded-md border border-[#EDEDED] bg-white px-3 py-2 text-xs font-medium text-[#05040D] hover:bg-[#F7F7F7]"
            >
              {t('pages.training.groupTrainings.participants', 'Participants')}
            </button>
            <button
              type="button"
              onClick={onAssign}
              disabled={isCancelled || isFull}
              className="flex flex-1 items-center justify-center gap-1 rounded-md bg-[#204E4D] px-3 py-2 text-xs font-medium text-white hover:bg-[#1a3f3e] disabled:opacity-50"
            >
              <Icons.Users size={13} className="text-white" />
              {isFull
                ? t('pages.training.groupTrainings.full', 'Full')
                : t('pages.training.groupTrainings.assign', 'Assign')}
            </button>
          </div>
        ) : (
          /* Operator self-service fallback. */
          <button
            type="button"
            disabled={
              register.isPending || unregister.isPending || (!training.is_registered && isFull)
            }
            onClick={() =>
              training.is_registered ? unregister.mutate(training.id) : register.mutate(training.id)
            }
            className={`rounded-md px-3 py-2 text-xs font-medium disabled:opacity-50 ${
              training.is_registered
                ? 'border border-[#EDEDED] bg-white text-[#05040D]'
                : 'bg-[#204E4D] text-white'
            }`}
          >
            {training.is_registered
              ? t('pages.training.groupTrainings.registered', 'Registered — leave')
              : isFull
                ? t('pages.training.groupTrainings.full', 'Full')
                : t('pages.training.groupTrainings.register', 'Register')}
          </button>
        )}

        {canManage && !isCompleted && !isCancelled ? (
          <button
            type="button"
            onClick={() => cancel.mutate(training.id)}
            className="text-[10px] font-medium text-[#B91C1C] hover:underline"
          >
            {t('pages.training.groupTrainings.cancel', 'Cancel session')}
          </button>
        ) : null}
      </div>
    </div>
  )
}

function ScheduleTrainingDialog({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation('common')
  const create = useCreateGroupTraining()

  const [title, setTitle] = useState('')
  const [type, setType] = useState('')
  const [location, setLocation] = useState('')
  const [scheduledAt, setScheduledAt] = useState('')
  const [durationMinutes, setDurationMinutes] = useState('60')
  const [maxParticipants, setMaxParticipants] = useState('')
  const [meetingUrl, setMeetingUrl] = useState('')

  const canSubmit = title.trim().length > 0 && scheduledAt.length > 0
  const field =
    'h-9 rounded-lg border border-[#EBECE8] bg-white px-3 text-xs text-[#05040D] focus:outline-none'

  const submit = () => {
    if (!canSubmit) return
    const duration = Number(durationMinutes)
    const seats = maxParticipants.trim() ? Number(maxParticipants) : null
    create.mutate(
      {
        title: title.trim(),
        type: type.trim() || null,
        location: location.trim() || null,
        scheduled_at: new Date(scheduledAt).toISOString(),
        duration_minutes: Number.isFinite(duration) && duration > 0 ? duration : 60,
        max_participants: seats != null && Number.isFinite(seats) && seats > 0 ? seats : null,
        meeting_url: meetingUrl.trim() || null,
      },
      {
        onSuccess: () => {
          toast.success(t('pages.training.groupTrainings.created', 'Group training scheduled.'))
          onClose()
        },
        onError: (err) => {
          const detail =
            err instanceof Error
              ? err.message
              : t('pages.training.groupTrainings.createFailed', 'Could not schedule the training.')
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
              <Icons.Users size={18} className="text-[#05040D]" />
            </span>
            <h3 className="text-xl font-semibold text-[#05040D]">
              {t('pages.training.groupTrainings.schedule', 'Schedule a Training')}
            </h3>
          </div>
          <button type="button" onClick={onClose} aria-label={t('common.close', 'Close')}>
            <Icons.Close size={18} className="text-[#676767]" />
          </button>
        </div>

        <div className="flex flex-1 flex-col gap-4 overflow-y-auto px-5 py-4">
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-[#05040D]">
              {t('pages.training.groupTrainings.title', 'Title')}
            </span>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={t(
                'pages.training.groupTrainings.titlePlaceholder',
                'e.g. Objection-handling workshop'
              )}
              className={field}
            />
          </label>

          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1">
              <span className="text-xs font-medium text-[#05040D]">
                {t('pages.training.groupTrainings.type', 'Type')}
              </span>
              <input
                type="text"
                value={type}
                onChange={(e) => setType(e.target.value)}
                placeholder={t('pages.training.groupTrainings.typePlaceholder', 'Optional label')}
                className={field}
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs font-medium text-[#05040D]">
                {t('pages.training.groupTrainings.location', 'Location')}
              </span>
              <input
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder={t(
                  'pages.training.groupTrainings.locationPlaceholder',
                  'e.g. Conference Room A / Zoom'
                )}
                className={field}
              />
            </label>
          </div>

          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-[#05040D]">
              {t('pages.training.groupTrainings.scheduledAt', 'Date & time')}
            </span>
            <input
              type="datetime-local"
              value={scheduledAt}
              onChange={(e) => setScheduledAt(e.target.value)}
              className={field}
            />
          </label>

          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1">
              <span className="text-xs font-medium text-[#05040D]">
                {t('pages.training.groupTrainings.durationMinutes', 'Duration (min)')}
              </span>
              <input
                type="number"
                min={1}
                value={durationMinutes}
                onChange={(e) => setDurationMinutes(e.target.value)}
                className={field}
              />
            </label>

            <label className="flex flex-col gap-1">
              <span className="text-xs font-medium text-[#05040D]">
                {t('pages.training.groupTrainings.maxParticipants', 'Max participants')}
              </span>
              <input
                type="number"
                min={1}
                value={maxParticipants}
                onChange={(e) => setMaxParticipants(e.target.value)}
                placeholder={t('pages.training.groupTrainings.unlimited', 'Unlimited')}
                className={field}
              />
            </label>
          </div>

          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-[#05040D]">
              {t('pages.training.groupTrainings.meetingUrl', 'Meeting URL')}
            </span>
            <input
              type="url"
              value={meetingUrl}
              onChange={(e) => setMeetingUrl(e.target.value)}
              placeholder="https://…"
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
            disabled={!canSubmit || create.isPending}
            className="rounded-md bg-[#BBFB5B] px-5 py-2 text-xs font-semibold text-[#05040D] hover:bg-[#a9e94f] disabled:opacity-50"
          >
            {t('pages.training.groupTrainings.scheduleConfirm', 'Schedule')}
          </button>
        </div>
      </div>
    </div>
  )
}

function formatRegisteredAt(iso: string, language: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return formatDate(d, language)
}

function ParticipantsDialog({
  training,
  nameById,
  onClose,
}: {
  training: GroupTrainingCardData
  nameById: NameById
  onClose: () => void
}) {
  const { t, i18n } = useTranslation('common')
  const { data, isLoading, isError } = useGroupTrainingParticipants(training.id)
  const participants = data?.participants ?? []
  const isCompleted = training.status === 'completed'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
      <div className="flex max-h-[80vh] w-full max-w-md flex-col rounded-xl bg-white shadow-xl">
        <div className="flex items-start justify-between border-b border-[#EBECE8] px-5 py-4">
          <div className="flex flex-col gap-0.5">
            <h3 className="text-sm font-semibold text-[#05040D]">
              {isCompleted
                ? t('pages.training.groupTrainings.reportTitle', 'Attendance report')
                : t('pages.training.groupTrainings.participantsTitle', 'Participants')}
            </h3>
            <span className="text-[11px] text-[#676767]">{training.title}</span>
          </div>
          <button type="button" onClick={onClose} aria-label={t('common.close', 'Close')}>
            <Icons.Close size={18} className="text-[#676767]" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {isLoading ? (
            <p className="py-6 text-center text-xs text-[#676767]">
              {t('common.loading', 'Loading…')}
            </p>
          ) : isError ? (
            <p className="py-6 text-center text-xs text-[#EF4444]">
              {t(
                'pages.training.groupTrainings.participantsFailed',
                'Failed to load participants.'
              )}
            </p>
          ) : participants.length === 0 ? (
            <p className="py-6 text-center text-xs text-[#676767]">
              {t('pages.training.groupTrainings.noParticipants', 'No one registered yet.')}
            </p>
          ) : (
            <div className="flex flex-col gap-1">
              {participants.map((p) => (
                <div
                  key={p.operator_id}
                  className="flex items-center justify-between rounded-lg bg-[#F7F7F7] px-3 py-2"
                >
                  <span className="text-xs text-[#05040D]">
                    {nameById.get(p.operator_id) ?? `#${p.operator_id}`}
                  </span>
                  <span className="text-[10px] text-[#9CA3AF]">
                    {formatRegisteredAt(p.registered_at, i18n.language)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between border-t border-[#EBECE8] px-5 py-4">
          <span className="text-xs font-medium text-[#05040D]">
            {t('pages.training.groupTrainings.total', 'Total')}: {data?.registered_count ?? 0}
            {training.max_participants != null ? `/${training.max_participants}` : ''}
          </span>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-[#EDEDED] bg-white px-4 py-2 text-xs font-medium text-[#05040D] hover:bg-[#F7F7F7]"
          >
            {t('common.close', 'Close')}
          </button>
        </div>
      </div>
    </div>
  )
}

function AssignParticipantsDialog({
  training,
  operators,
  onClose,
}: {
  training: GroupTrainingCardData
  operators: { id: number; full_name: string }[]
  onClose: () => void
}) {
  const { t } = useTranslation('common')
  const assign = useAssignGroupTraining()
  const [selected, setSelected] = useState<number[]>([])

  const toggle = (id: number) =>
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]))

  const submit = () => {
    if (selected.length === 0) return
    assign.mutate(
      { id: training.id, operatorIds: selected },
      {
        onSuccess: (res) => {
          if (res.skipped_full > 0) {
            toast.warning(
              t(
                'pages.training.groupTrainings.assignedPartial',
                '{{assigned}} assigned, {{skipped}} skipped (session full).',
                { assigned: res.assigned, skipped: res.skipped_full }
              )
            )
          } else {
            toast.success(t('pages.training.groupTrainings.assigned', 'Operators assigned.'))
          }
          onClose()
        },
        onError: (err) => {
          const detail =
            err instanceof Error
              ? err.message
              : t('pages.training.groupTrainings.assignFailed', 'Could not assign operators.')
          toast.error(detail)
        },
      }
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
      <div className="flex max-h-[80vh] w-full max-w-md flex-col rounded-xl bg-white p-5 shadow-xl">
        <h3 className="mb-1 text-sm font-semibold text-[#05040D]">
          {t('pages.training.groupTrainings.assign', 'Assign')}: {training.title}
        </h3>
        <p className="mb-3 text-[11px] text-[#676767]">
          {t(
            'pages.training.groupTrainings.assignHint',
            'Select operators to register for this session.'
          )}
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
            {t('pages.training.groupTrainings.assignCta', 'Assign')} ({selected.length})
          </button>
        </div>
      </div>
    </div>
  )
}

export default GroupTrainingsTab
