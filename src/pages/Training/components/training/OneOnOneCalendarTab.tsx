import { useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Icons } from '@/lib/icons'
import { useHasPermission } from '@/hooks'
import { useAuthStore } from '@/stores/authStore'
import { useOperators } from '@/features/users/hooks'
import { useCourses } from '@/features/training/hooks/useCourses'
import {
  useCalibrationCalendar,
  useCompleteCalibrationSession,
  useCreateCalibrationSession,
  useRescheduleCalibrationSession,
} from '@/features/training/hooks/useCalibrationSessions'
import type {
  CalibrationFormat,
  CalibrationSessionCard,
} from '@/features/training/types/calibrationSessions'
import { TrainingPrimaryButton } from './TrainingToolbar'

const FORMAT_LABEL: Record<CalibrationFormat, { label: string; tone: string }> = {
  in_person: { label: 'In-person', tone: 'bg-[#F0FDF4] text-[#15803D]' },
  zoom: { label: 'Zoom', tone: 'bg-[#EFF6FF] text-[#2563EB]' },
  phone: { label: 'Phone', tone: 'bg-[#FFFBEB] text-[#D97706]' },
}

const AVATAR_PALETTE = [
  '#E0F2EC',
  '#FEF3C7',
  '#FEE4E2',
  '#E0E7FF',
  '#FCE7F3',
  '#DBEAFE',
  '#FFEDD5',
  '#D1FAE5',
]
const avatarColorFor = (id: number) => AVATAR_PALETTE[Math.abs(id) % AVATAR_PALETTE.length]

function deriveInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase()
}

function formatTime(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

function formatDateLabel(iso: string, today: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  const ymd = d.toISOString().slice(0, 10)
  if (ymd === today) return 'Today'
  return `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}`
}

interface OperatorLite {
  id: number
  full_name: string
  department_name?: string | null
}

export function OneOnOneCalendarTab() {
  const { t } = useTranslation('common')
  const canManage = useHasPermission('manage_trainings')
  const [scheduleOpen, setScheduleOpen] = useState(false)

  const activeProjectId = useAuthStore((s) => s.user?.active_project_id)
  const projectIdNum = activeProjectId ? Number(activeProjectId) : null
  const { data: operators = [] } = useOperators(projectIdNum)
  const byId = useMemo(
    () => new Map<number, OperatorLite>(operators.map((op) => [op.id, op])),
    [operators]
  )

  const { data, isLoading, isError } = useCalibrationCalendar()
  const sessions = useMemo(() => (data?.days ?? []).flatMap((day) => day.sessions), [data])

  const [now] = useState(() => Date.now())
  const today = useMemo(() => new Date(now).toISOString().slice(0, 10), [now])
  const { planned, past } = useMemo(() => {
    const isUpcoming = (s: CalibrationSessionCard) =>
      s.status === 'scheduled' && new Date(s.scheduled_at).getTime() >= now
    return {
      planned: sessions.filter(isUpcoming),
      past: sessions.filter((s) => !isUpcoming(s)),
    }
  }, [sessions, now])

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-base font-semibold text-[#05040D]">
          {t('pages.training.calendar.title', '1-on-1 Session Calendar')}
        </h2>
        {canManage ? (
          <TrainingPrimaryButton
            onClick={() => setScheduleOpen(true)}
            leftIcon={<Icons.Add size={14} className="text-white" />}
          >
            {t('pages.training.calendar.schedule', 'Schedule a Calibration Session')}
          </TrainingPrimaryButton>
        ) : null}
      </div>

      {isLoading ? (
        <p className="py-8 text-center text-xs text-[#676767]">{t('common.loading', 'Loading…')}</p>
      ) : isError ? (
        <p className="py-8 text-center text-xs text-[#EF4444]">
          {t('pages.training.calendar.loadFailed', 'Failed to load sessions.')}
        </p>
      ) : sessions.length === 0 ? (
        <p className="py-8 text-center text-xs text-[#676767]">
          {t('pages.training.calendar.empty', 'No sessions in this window.')}
        </p>
      ) : (
        <>
          <Section title={t('pages.training.calendar.planned', 'Planned sessions')}>
            {planned.length === 0 ? (
              <EmptyHint text={t('pages.training.calendar.noPlanned', 'No upcoming sessions.')} />
            ) : (
              <Grid>
                {planned.map((s) => (
                  <SessionCard
                    key={s.id}
                    session={s}
                    byId={byId}
                    today={today}
                    canManage={canManage}
                    planned
                  />
                ))}
              </Grid>
            )}
          </Section>

          <Section title={t('pages.training.calendar.past', 'Past Sessions')}>
            {past.length === 0 ? (
              <EmptyHint text={t('pages.training.calendar.noPast', 'No past sessions.')} />
            ) : (
              <Grid>
                {past.map((s) => (
                  <SessionCard
                    key={s.id}
                    session={s}
                    byId={byId}
                    today={today}
                    canManage={canManage}
                    planned={false}
                  />
                ))}
              </Grid>
            )}
          </Section>
        </>
      )}

      {scheduleOpen ? (
        <ScheduleCalibrationPanel operators={operators} onClose={() => setScheduleOpen(false)} />
      ) : null}
    </div>
  )
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-3">
      <h3 className="text-sm font-semibold text-[#05040D]">{title}</h3>
      {children}
    </div>
  )
}

function Grid({ children }: { children: ReactNode }) {
  return <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">{children}</div>
}

function EmptyHint({ text }: { text: string }) {
  return <p className="text-xs text-[#9CA3AF]">{text}</p>
}

function StatTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-1 flex-col items-center gap-0.5 rounded-lg bg-[#F7F7F7] py-2">
      <span className="text-xs font-semibold text-[#05040D]">{value}</span>
      <span className="text-[9px] text-[#6B7280] uppercase">{label}</span>
    </div>
  )
}

function SessionCard({
  session,
  byId,
  today,
  canManage,
  planned,
}: {
  session: CalibrationSessionCard
  byId: Map<number, OperatorLite>
  today: string
  canManage: boolean
  planned: boolean
}) {
  const { t } = useTranslation('common')
  const reschedule = useRescheduleCalibrationSession()
  const complete = useCompleteCalibrationSession()
  const [postponeOpen, setPostponeOpen] = useState(false)

  const fmt = FORMAT_LABEL[session.format]
  const primaryId = session.participant_ids[0]
  const primary = primaryId != null ? byId.get(primaryId) : undefined
  const primaryName = primary?.full_name ?? (primaryId != null ? `#${primaryId}` : '—')
  const extra = Math.max(0, session.participant_ids.length - 1)

  return (
    <div className="overflow-hidden rounded-xl border border-[#EBECE8] bg-white shadow-[0px_1px_2px_rgba(0,0,0,0.04)]">
      <div className="relative h-14 w-full bg-gradient-to-br from-[#F3FAF9] to-[#E3F6F3]">
        <span
          className={`absolute top-3 right-3 rounded-full px-2.5 py-0.5 text-[10px] font-medium ${
            session.status === 'completed'
              ? 'bg-[#F0FDF4] text-[#15803D]'
              : session.status === 'cancelled'
                ? 'bg-[#FEF2F2] text-[#B91C1C]'
                : fmt.tone
          }`}
        >
          {session.status === 'completed'
            ? t('pages.training.calendar.completed', 'Completed')
            : session.status === 'cancelled'
              ? t('pages.training.calendar.cancelled', 'Cancelled')
              : fmt.label}
        </span>
      </div>

      <div className="flex flex-col gap-3 p-4">
        <div className="flex items-start gap-3">
          <div className="flex flex-col items-center justify-center rounded-xl bg-[#F0FDF4] px-3 py-1.5 text-[#204E4D]">
            <span className="text-base leading-tight font-bold">
              {formatTime(session.scheduled_at)}
            </span>
            <span className="text-[10px]">{formatDateLabel(session.scheduled_at, today)}</span>
          </div>
          <div className="flex min-w-0 flex-1 flex-col">
            <span className="truncate text-sm font-semibold text-[#05040D]">{session.title}</span>
            {session.topic ? (
              <span className="truncate text-[10px] text-[#6B7280]">
                {t('pages.training.calendar.skill', 'Skill')}: {session.topic}
              </span>
            ) : null}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div
            className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full text-[10px] font-semibold text-[#05040D]"
            style={{ backgroundColor: avatarColorFor(primaryId ?? 0) }}
          >
            {deriveInitials(primaryName)}
          </div>
          <div className="flex min-w-0 flex-1 flex-col">
            <span className="truncate text-[11px] font-medium text-[#05040D]">
              {primaryName}
              {extra > 0 ? ` +${extra}` : ''}
            </span>
            {primary?.department_name ? (
              <span className="truncate text-[10px] text-[#6B7280]">
                {t('pages.training.calendar.from', 'From')} {primary.department_name}
              </span>
            ) : null}
          </div>
        </div>

        <div className="flex gap-2">
          <StatTile
            label={t('pages.training.calendar.duration', 'Duration')}
            value={`${session.duration_minutes} ${t('pages.training.calendar.min', 'min')}`}
          />
          <StatTile label={t('pages.training.calendar.location', 'Location')} value={fmt.label} />
        </div>

        {planned ? (
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setPostponeOpen(true)}
              disabled={!canManage || reschedule.isPending}
              className="flex-1 rounded-md border border-[#EDEDED] bg-white py-2 text-[11px] font-medium text-[#05040D] hover:bg-[#F7F7F7] disabled:opacity-50"
            >
              {t('pages.training.calendar.postpone', 'Postpone')}
            </button>
            <button
              type="button"
              onClick={() => complete.mutate(session.id)}
              disabled={!canManage || complete.isPending}
              className="flex flex-1 items-center justify-center gap-1 rounded-md bg-[#204E4D] py-2 text-[11px] font-medium text-white hover:bg-[#1a3f3e] disabled:opacity-50"
            >
              <Icons.ArrowUp size={12} className="rotate-45 text-white" />
              {t('pages.training.calendar.start', 'Start')}
            </button>
          </div>
        ) : null}
      </div>

      {postponeOpen ? (
        <PostponeDialog
          currentValue={session.scheduled_at}
          isPending={reschedule.isPending}
          onClose={() => setPostponeOpen(false)}
          onConfirm={(iso) =>
            reschedule.mutate(
              { id: session.id, scheduledAt: iso },
              { onSuccess: () => setPostponeOpen(false) }
            )
          }
        />
      ) : null}
    </div>
  )
}

function PostponeDialog({
  currentValue,
  isPending,
  onClose,
  onConfirm,
}: {
  currentValue: string
  isPending: boolean
  onClose: () => void
  onConfirm: (iso: string) => void
}) {
  const { t } = useTranslation('common')
  // datetime-local wants `YYYY-MM-DDTHH:mm` in local time.
  const [value, setValue] = useState(() => {
    const d = new Date(currentValue)
    if (Number.isNaN(d.getTime())) return ''
    const pad = (n: number) => String(n).padStart(2, '0')
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
  })

  const submit = () => {
    if (!value) return
    const d = new Date(value)
    if (Number.isNaN(d.getTime())) return
    onConfirm(d.toISOString())
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
      <div className="w-full max-w-sm rounded-xl bg-white p-5 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-[#05040D]">
            {t('pages.training.calendar.postpone', 'Postpone')}
          </h3>
          <button type="button" onClick={onClose} aria-label={t('common.close', 'Close')}>
            <Icons.Close size={18} className="text-[#676767]" />
          </button>
        </div>
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-[#05040D]">
            {t('pages.training.calendar.newDateTime', 'New date & time')}
          </span>
          <input
            type="datetime-local"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            className="h-9 rounded-lg border border-[#EBECE8] px-3 text-xs text-[#05040D] focus:outline-none"
          />
        </label>
        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-[#EDEDED] bg-white px-4 py-2 text-xs font-medium text-[#05040D] hover:bg-[#F7F7F7]"
          >
            {t('common.cancel', 'Cancel')}
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={!value || isPending}
            className="rounded-md bg-[#204E4D] px-4 py-2 text-xs font-medium text-white hover:bg-[#1a3f3e] disabled:opacity-50"
          >
            {t('pages.training.calendar.postponeConfirm', 'Reschedule')}
          </button>
        </div>
      </div>
    </div>
  )
}

interface MemberPickerProps {
  label: string
  operators: OperatorLite[]
  selected: number[]
  onChange: (ids: number[]) => void
}

function MemberPicker({ label, operators, selected, onChange }: MemberPickerProps) {
  const { t } = useTranslation('common')
  // Local rows: a chosen operator id, or '' for a freshly-added pending row
  // (renders a picker until an operator is chosen). Matches the Figma flow:
  // "+ Add" appends a row, then you pick who fills it.
  const [slots, setSlots] = useState<Array<number | ''>>(selected)
  const nameById = new Map(operators.map((op) => [op.id, op.full_name]))
  const chosen = new Set(slots.filter((s): s is number => s !== ''))

  const commit = (next: Array<number | ''>) => {
    setSlots(next)
    onChange(next.filter((s): s is number => s !== ''))
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold text-[#05040D]">{label}</span>
        <button
          type="button"
          onClick={() => commit([...slots, ''])}
          className="inline-flex items-center gap-1 rounded-md bg-[#204E4D] px-3 py-1.5 text-xs font-medium text-white hover:bg-[#1a3f3e]"
        >
          <Icons.Add size={13} className="text-white" />
          {t('common.add', 'Add')}
        </button>
      </div>
      {slots.map((slot, i) => (
        <div key={i} className="flex items-center gap-2 rounded-lg bg-[#F7F7F7] px-3 py-2">
          <span className="w-4 text-center text-[11px] text-[#9CA3AF]">{i + 1}</span>
          {slot === '' ? (
            <select
              value=""
              onChange={(e) => {
                const id = Number(e.target.value)
                if (!id) return
                const next = [...slots]
                next[i] = id
                commit(next)
              }}
              className="h-7 flex-1 rounded-md border border-[#EBECE8] bg-white px-2 text-xs focus:outline-none"
            >
              <option value="">{t('common.select', 'Select…')}</option>
              {operators
                .filter((op) => !chosen.has(op.id))
                .map((op) => (
                  <option key={op.id} value={op.id}>
                    {op.full_name}
                  </option>
                ))}
            </select>
          ) : (
            <span className="flex-1 truncate text-xs text-[#05040D]">
              {nameById.get(slot) ?? `#${slot}`}
            </span>
          )}
          <button
            type="button"
            onClick={() => commit(slots.filter((_, j) => j !== i))}
            aria-label={t('actions.remove', 'Remove')}
          >
            <Icons.Close size={13} className="text-[#9CA3AF]" />
          </button>
        </div>
      ))}
    </div>
  )
}

function ScheduleCalibrationPanel({
  operators,
  onClose,
}: {
  operators: OperatorLite[]
  onClose: () => void
}) {
  const { t } = useTranslation('common')
  const create = useCreateCalibrationSession()
  const { data: coursesData } = useCourses({})
  const courses = coursesData?.data ?? []

  const [date, setDate] = useState('')
  const [time, setTime] = useState('10:00')
  const [courseId, setCourseId] = useState('')
  const [trainers, setTrainers] = useState<number[]>([])
  const [participants, setParticipants] = useState<number[]>([])
  const [topic, setTopic] = useState('')

  const canSubmit = date && time && participants.length > 0

  const submit = () => {
    if (!canSubmit) return
    const scheduledAt = new Date(`${date}T${time}`).toISOString()
    create.mutate(
      {
        scheduled_at: scheduledAt,
        course_id: courseId ? Number(courseId) : null,
        topic: topic.trim() || null,
        trainer_ids: trainers,
        participant_ids: participants,
      },
      { onSuccess: onClose }
    )
  }

  const field =
    'h-9 rounded-lg border border-[#EBECE8] px-3 text-xs text-[#05040D] focus:outline-none'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
      <div className="flex max-h-[90vh] w-full max-w-md flex-col rounded-xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-[#EBECE8] px-5 py-4">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#BBFB5B]">
              <Icons.Calendar size={18} className="text-[#05040D]" />
            </span>
            <h3 className="text-xl font-semibold text-[#05040D]">
              {t('pages.training.calendar.schedule', 'Schedule a Calibration Session')}
            </h3>
          </div>
          <button type="button" onClick={onClose} aria-label={t('common.close', 'Close')}>
            <Icons.Close size={18} className="text-[#676767]" />
          </button>
        </div>

        <div className="flex flex-1 flex-col gap-4 overflow-y-auto px-5 py-4">
          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1">
              <span className="text-xs font-medium text-[#05040D]">
                {t('pages.training.calendar.date', 'Date')}
              </span>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className={field}
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs font-medium text-[#05040D]">
                {t('pages.training.calendar.time', 'Time')}
              </span>
              <input
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className={field}
              />
            </label>
          </div>

          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-[#05040D]">
              {t('pages.training.calendar.courseFromCatalog', 'Course from the catalog')}
            </span>
            <select
              value={courseId}
              onChange={(e) => setCourseId(e.target.value)}
              className={field}
            >
              <option value="">
                {t('pages.training.calendar.selectCourse', 'Select a course')}
              </option>
              {courses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.title}
                </option>
              ))}
            </select>
          </label>

          <MemberPicker
            label={t('pages.training.calendar.trainers', 'Trainers')}
            operators={operators}
            selected={trainers}
            onChange={setTrainers}
          />
          <MemberPicker
            label={t('pages.training.calendar.participants', 'Participants (operators)')}
            operators={operators}
            selected={participants}
            onChange={setParticipants}
          />

          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-[#05040D]">
              {t('pages.training.calendar.topic', 'Topic / focus')}
            </span>
            <textarea
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              rows={3}
              placeholder={t(
                'pages.training.calendar.topicPlaceholder',
                'For example: greeting by script'
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
            disabled={!canSubmit || create.isPending}
            className="rounded-md bg-[#BBFB5B] px-4 py-2 text-xs font-semibold text-[#05040D] hover:bg-[#a9e94f] disabled:opacity-50"
          >
            {t('pages.training.calendar.scheduleCta', 'Schedule')}
          </button>
        </div>
      </div>
    </div>
  )
}

export default OneOnOneCalendarTab
