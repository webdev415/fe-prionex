import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Icons } from '@/lib/icons'
import { useAuthStore } from '@/stores/authStore'
import { useOperators } from '@/features/users/hooks'
import { useOneOnOneCalendar } from '@/features/training/hooks/useOneOnOnes'
import type { OneOnOneRecord } from '@/features/training/types/oneOnOnes'
import { PendingFeatureDialog } from '../inbox/PendingFeatureDialog'
import { TrainingPrimaryButton } from './TrainingToolbar'

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

function avatarColorFor(id: number): string {
  return AVATAR_PALETTE[Math.abs(id) % AVATAR_PALETTE.length]
}

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

function formatDateLabel(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}`
}

export function OneOnOneCalendarTab() {
  const { t } = useTranslation('common')
  const [planOpen, setPlanOpen] = useState(false)

  const activeProjectId = useAuthStore((s) => s.user?.active_project_id)
  const projectIdNum = activeProjectId ? Number(activeProjectId) : null
  const { data: operators = [] } = useOperators(projectIdNum)
  const nameById = useMemo(
    () => new Map(operators.map((op) => [op.id, op.full_name] as const)),
    [operators]
  )

  const { data, isLoading, isError } = useOneOnOneCalendar()
  const sessions = useMemo(() => (data?.days ?? []).flatMap((day) => day.sessions), [data])

  // Snapshot "now" once at mount so the planned/past split stays stable across
  // renders (it refreshes on refetch); reading the clock during render is impure.
  const [now] = useState(() => Date.now())
  const { planned, past } = useMemo(() => {
    const isUpcoming = (s: OneOnOneRecord) =>
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
          {t('pages.training.calendar.title', 'Calendar of 1-on-1 sessions')}
        </h2>
        <TrainingPrimaryButton
          onClick={() => setPlanOpen(true)}
          leftIcon={<Icons.Add size={14} className="text-white" />}
        >
          {t('pages.training.calendar.plan', 'Plan a session')}
        </TrainingPrimaryButton>
      </div>

      {isLoading ? (
        <p className="py-8 text-center text-xs text-[#676767]">{t('common.loading', 'Loading…')}</p>
      ) : isError ? (
        <p className="py-8 text-center text-xs text-[#EF4444]">
          {t('pages.training.calendar.loadFailed', 'Failed to load sessions.')}
        </p>
      ) : sessions.length === 0 ? (
        <p className="py-8 text-center text-xs text-[#676767]">
          {t('pages.training.calendar.empty', 'No 1-on-1 sessions in this window.')}
        </p>
      ) : (
        <>
          <div className="flex flex-col gap-3">
            <h3 className="text-sm font-semibold text-[#05040D]">
              {t('pages.training.calendar.planned', 'Planned sessions')}
            </h3>
            {planned.length === 0 ? (
              <p className="text-xs text-[#9CA3AF]">
                {t('pages.training.calendar.noPlanned', 'No upcoming sessions.')}
              </p>
            ) : (
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
                {planned.map((s) => (
                  <SessionCard key={s.id} session={s} nameById={nameById} planned />
                ))}
              </div>
            )}
          </div>

          <div className="flex flex-col gap-3">
            <h3 className="text-sm font-semibold text-[#05040D]">
              {t('pages.training.calendar.past', 'Past sessions')}
            </h3>
            {past.length === 0 ? (
              <p className="text-xs text-[#9CA3AF]">
                {t('pages.training.calendar.noPast', 'No past sessions.')}
              </p>
            ) : (
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
                {past.map((s) => (
                  <SessionCard key={s.id} session={s} nameById={nameById} planned={false} />
                ))}
              </div>
            )}
          </div>
        </>
      )}

      <PendingFeatureDialog
        open={planOpen}
        onClose={() => setPlanOpen(false)}
        titleKey="pages.training.calendar.plan"
        titleFallback="Plan a session"
        descriptionKey="pages.training.calendar.planHint"
        descriptionFallback="1-on-1 sessions are scheduled from the Inbox Quick Action overlay."
        dependsOnIssue="KAN-413"
      />
    </div>
  )
}

function SessionCard({
  session,
  nameById,
  planned,
}: {
  session: OneOnOneRecord
  nameById: Map<number, string>
  planned: boolean
}) {
  const { t } = useTranslation('common')
  const trainerName = nameById.get(session.trainer_id) ?? `#${session.trainer_id}`
  const operatorName = nameById.get(session.operator_id) ?? `#${session.operator_id}`

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-[#EBECE8] bg-white p-4 shadow-[0px_1px_2px_rgba(0,0,0,0.04)]">
      <div className="flex items-start gap-3">
        <div className="flex flex-col items-center justify-center rounded-xl bg-[#F0FDF4] px-3 py-2 text-[#204E4D]">
          <span className="text-base leading-tight font-bold">
            {formatTime(session.scheduled_at)}
          </span>
          <span className="text-[10px]">{formatDateLabel(session.scheduled_at)}</span>
        </div>
        <div className="flex min-w-0 flex-1 flex-col">
          <span className="truncate text-sm font-semibold text-[#05040D]">
            {t('pages.training.calendar.sessionTitle', '1-on-1 session')}
          </span>
          {session.notes ? (
            <span className="truncate text-[10px] text-[#6B7280]">{session.notes}</span>
          ) : null}
        </div>
        <span className="rounded-full bg-[#F3F4F6] px-2 py-0.5 text-[10px] font-medium text-[#6B7280] capitalize">
          {session.status}
        </span>
      </div>

      <div className="flex items-center gap-2 rounded-lg bg-[#F7F7F7] px-3 py-2">
        <div className="flex flex-shrink-0 -space-x-1.5">
          <div
            className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-white text-[10px] font-semibold text-[#05040D]"
            style={{ backgroundColor: avatarColorFor(session.trainer_id) }}
          >
            {deriveInitials(trainerName)}
          </div>
          <div
            className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-white text-[10px] font-semibold text-[#05040D]"
            style={{ backgroundColor: avatarColorFor(session.operator_id) }}
          >
            {deriveInitials(operatorName)}
          </div>
        </div>
        <div className="flex min-w-0 flex-1 flex-col">
          <span className="truncate text-[11px] font-medium text-[#05040D]">{trainerName}</span>
          <span className="truncate text-[10px] text-[#6B7280]">→ {operatorName}</span>
        </div>
        <span className="text-[10px] text-[#6B7280]">
          {session.duration_minutes} {t('pages.training.calendar.min', 'min')}
        </span>
      </div>

      {planned ? (
        <button
          type="button"
          disabled
          className="rounded-md border border-[#EDEDED] bg-white py-2 text-[11px] font-medium text-[#9CA3AF]"
        >
          {t('pages.training.calendar.manageFromInbox', 'Manage from Inbox')}
        </button>
      ) : (
        <span className="text-center text-[10px] text-[#9CA3AF]">
          {t(`pages.training.calendar.statusLabel.${session.status}`, session.status)}
        </span>
      )}
    </div>
  )
}

export default OneOnOneCalendarTab
