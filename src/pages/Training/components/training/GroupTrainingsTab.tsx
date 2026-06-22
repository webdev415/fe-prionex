import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Icons } from '@/lib/icons'
import { useHasPermission } from '@/hooks'
import {
  useCancelGroupTraining,
  useCreateGroupTraining,
  useGroupTrainings,
  useRegisterForTraining,
  useUnregisterFromTraining,
} from '@/features/training/hooks/useGroupTrainings'
import type { GroupTrainingCardData } from '@/features/training/types/groupTrainings'
import { TrainingPrimaryButton } from './TrainingToolbar'

function formatDateTime(iso: string): { date: string; time: string } {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return { date: iso, time: '' }
  const date = `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}`
  const time = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
  return { date, time }
}

export function GroupTrainingsTab() {
  const { t } = useTranslation('common')
  const canManage = useHasPermission('manage_trainings')
  const [createOpen, setCreateOpen] = useState(false)

  const { data, isLoading, isError } = useGroupTrainings({ status: 'scheduled' })
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
            <GroupTrainingCard key={g.id} training={g} canManage={canManage} />
          ))}
        </div>
      )}

      {createOpen ? <ScheduleTrainingDialog onClose={() => setCreateOpen(false)} /> : null}
    </div>
  )
}

function GroupTrainingCard({
  training,
  canManage,
}: {
  training: GroupTrainingCardData
  canManage: boolean
}) {
  const { t } = useTranslation('common')
  const register = useRegisterForTraining()
  const unregister = useUnregisterFromTraining()
  const cancel = useCancelGroupTraining()
  const { date, time } = formatDateTime(training.scheduled_at)
  const seatsLeft =
    training.max_participants != null ? training.max_participants - training.registered_count : null
  const isFull = seatsLeft != null && seatsLeft <= 0

  return (
    <div className="overflow-hidden rounded-xl border border-[#EBECE8] bg-white shadow-[0px_1px_2px_rgba(0,0,0,0.04)]">
      <div className="relative h-20 w-full bg-gradient-to-br from-[#F3FAF9] to-[#E3F6F3]">
        {training.type ? (
          <span className="absolute top-3 right-3 rounded-full bg-[#EFF6FF] px-2.5 py-0.5 text-[10px] font-medium text-[#2563EB]">
            {training.type}
          </span>
        ) : null}
        <div className="absolute top-3 left-3 flex flex-col text-[#204E4D]">
          <span className="text-2xl leading-none font-semibold">{date.split('.')[0]}</span>
          <span className="text-[10px]">{date}</span>
        </div>
      </div>
      <div className="flex flex-col gap-3 p-4">
        <h3 className="text-sm font-semibold text-[#05040D]">{training.title}</h3>

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

        {seatsLeft != null && seatsLeft > 0 && seatsLeft <= 5 ? (
          <span className="text-[10px] font-medium text-[#D97706]">
            {t('pages.training.groupTrainings.seatsLeft', '{{count}} seats left', {
              count: seatsLeft,
            })}
          </span>
        ) : null}

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

        {canManage ? (
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
  const [scheduledAt, setScheduledAt] = useState('')
  const [duration, setDuration] = useState('60')
  const [maxParticipants, setMaxParticipants] = useState('')

  const submit = () => {
    if (!title.trim() || !scheduledAt) return
    create.mutate(
      {
        title: title.trim(),
        type: type.trim() || null,
        scheduled_at: new Date(scheduledAt).toISOString(),
        duration_minutes: duration ? Number(duration) : 60,
        max_participants: maxParticipants ? Number(maxParticipants) : null,
      },
      { onSuccess: onClose }
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
      <div className="w-full max-w-md rounded-xl bg-white p-5 shadow-xl">
        <h3 className="mb-4 text-sm font-semibold text-[#05040D]">
          {t('pages.training.groupTrainings.schedule', 'Schedule a training')}
        </h3>
        <div className="flex flex-col gap-3">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={t('pages.training.groupTrainings.fieldTitle', 'Title')}
            className="h-9 rounded-lg border border-[#EBECE8] px-3 text-xs focus:outline-none"
          />
          <input
            value={type}
            onChange={(e) => setType(e.target.value)}
            placeholder={t('pages.training.groupTrainings.fieldType', 'Type (webinar/workshop)')}
            className="h-9 rounded-lg border border-[#EBECE8] px-3 text-xs focus:outline-none"
          />
          <input
            value={scheduledAt}
            onChange={(e) => setScheduledAt(e.target.value)}
            type="datetime-local"
            className="h-9 rounded-lg border border-[#EBECE8] px-3 text-xs focus:outline-none"
          />
          <div className="flex gap-3">
            <input
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
              type="number"
              placeholder={t('pages.training.groupTrainings.fieldDuration', 'Duration (min)')}
              className="h-9 flex-1 rounded-lg border border-[#EBECE8] px-3 text-xs focus:outline-none"
            />
            <input
              value={maxParticipants}
              onChange={(e) => setMaxParticipants(e.target.value)}
              type="number"
              placeholder={t('pages.training.groupTrainings.fieldMax', 'Max participants')}
              className="h-9 flex-1 rounded-lg border border-[#EBECE8] px-3 text-xs focus:outline-none"
            />
          </div>
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
            disabled={!title.trim() || !scheduledAt || create.isPending}
            className="rounded-md bg-[#204E4D] px-3 py-2 text-xs font-medium text-white hover:bg-[#1a3f3e] disabled:opacity-50"
          >
            {t('pages.training.groupTrainings.schedule', 'Schedule')}
          </button>
        </div>
      </div>
    </div>
  )
}

export default GroupTrainingsTab
