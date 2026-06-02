import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Icons } from '@/lib/icons'
import {
  MOCK_ONE_ON_ONES_PAST,
  MOCK_ONE_ON_ONES_PLANNED,
  type MockOneOnOneSession,
  type SessionFormat,
} from '../../mocks/trainerWorkplaceMocks'
import { PendingFeatureDialog } from '../inbox/PendingFeatureDialog'
import { TrainingPrimaryButton } from './TrainingToolbar'

const FORMAT_TONE: Record<SessionFormat, { label: string; tone: string }> = {
  in_person: { label: 'In person', tone: 'bg-[#F0FDF4] text-[#15803D]' },
  zoom: { label: 'Zoom', tone: 'bg-[#EFF6FF] text-[#2563EB]' },
  phone: { label: 'Phone', tone: 'bg-[#FFFBEB] text-[#D97706]' },
}

export function OneOnOneCalendarTab() {
  const { t } = useTranslation('common')
  const [planOpen, setPlanOpen] = useState(false)

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

      <div className="flex flex-col gap-3">
        <h3 className="text-sm font-semibold text-[#05040D]">
          {t('pages.training.calendar.planned', 'Planned sessions')}
        </h3>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {MOCK_ONE_ON_ONES_PLANNED.map((s) => (
            <SessionCard key={s.id} session={s} />
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <h3 className="text-sm font-semibold text-[#05040D]">
          {t('pages.training.calendar.past', 'Past sessions')}
        </h3>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {MOCK_ONE_ON_ONES_PAST.map((s) => (
            <SessionCard key={s.id} session={s} />
          ))}
        </div>
      </div>

      <PendingFeatureDialog
        open={planOpen}
        onClose={() => setPlanOpen(false)}
        titleKey="pages.training.calendar.plan"
        titleFallback="Plan a session"
        descriptionKey="pages.training.training.pending.planSession"
        descriptionFallback="Schedule a 1-on-1 coaching session with an operator."
        dependsOnIssue="KAN-416"
      />
    </div>
  )
}

function SessionCard({ session }: { session: MockOneOnOneSession }) {
  const { t } = useTranslation('common')
  const format = FORMAT_TONE[session.format]
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-[#EBECE8] bg-white p-4 shadow-[0px_1px_2px_rgba(0,0,0,0.04)]">
      <div className="flex items-start gap-3">
        <div className="flex flex-col items-center justify-center rounded-xl bg-[#F0FDF4] px-3 py-2 text-[#204E4D]">
          <span className="text-base leading-tight font-bold">{session.timeLabel}</span>
          <span className="text-[10px]">{session.dateLabel}</span>
        </div>
        <div className="flex min-w-0 flex-1 flex-col">
          <span className="truncate text-sm font-semibold text-[#05040D]">{session.title}</span>
          <span className="text-[10px] text-[#6B7280]">{session.topic}</span>
        </div>
        <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${format.tone}`}>
          {format.label}
        </span>
      </div>

      <div className="flex items-center gap-2 rounded-lg bg-[#F7F7F7] px-3 py-2">
        <div className="flex flex-shrink-0 -space-x-1.5">
          <div
            className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-white text-[10px] font-semibold text-[#05040D]"
            style={{ backgroundColor: session.trainerAvatar }}
          >
            {session.trainerInitials}
          </div>
          <div
            className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-white text-[10px] font-semibold text-[#05040D]"
            style={{ backgroundColor: session.operatorAvatar }}
          >
            {session.operatorInitials}
          </div>
        </div>
        <div className="flex min-w-0 flex-1 flex-col">
          <span className="truncate text-[11px] font-medium text-[#05040D]">
            {session.trainerName}
          </span>
          <span className="truncate text-[10px] text-[#6B7280]">→ {session.operatorName}</span>
        </div>
        <span className="text-[10px] text-[#6B7280]">{session.durationLabel}</span>
      </div>

      {session.isPlanned ? (
        <div className="flex gap-2">
          <button
            type="button"
            className="flex-1 rounded-md border border-[#EDEDED] bg-white py-2 text-[11px] font-medium text-[#05040D]"
          >
            {t('pages.training.calendar.reschedule', 'Reschedule')}
          </button>
          <button
            type="button"
            className="flex-1 rounded-md bg-[#204E4D] py-2 text-[11px] font-medium text-white"
          >
            {t('pages.training.calendar.join', 'Join')}
          </button>
        </div>
      ) : (
        <button
          type="button"
          className="rounded-md border border-[#EDEDED] py-2 text-[11px] font-medium text-[#05040D]"
        >
          {t('pages.training.calendar.viewSummary', 'View summary')}
        </button>
      )}
    </div>
  )
}

export default OneOnOneCalendarTab
