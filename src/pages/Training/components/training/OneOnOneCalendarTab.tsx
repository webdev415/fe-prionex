import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/Button'
import { Icons } from '@/lib/icons'
import {
  MOCK_ONE_ON_ONES_PAST,
  MOCK_ONE_ON_ONES_PLANNED,
  type MockOneOnOneSession,
  type SessionFormat,
} from '../../mocks/trainerWorkplaceMocks'

/**
 * 1-on-1 Calendar sub-tab — Figma step 4. Two stacked groups: planned
 * sessions (today/upcoming) and past sessions for reference.
 */
const FORMAT_TONE: Record<SessionFormat, { label: string; tone: string }> = {
  in_person: { label: 'In person', tone: 'bg-emerald-100 text-emerald-700' },
  zoom: { label: 'Zoom', tone: 'bg-blue-100 text-blue-700' },
  phone: { label: 'Phone', tone: 'bg-amber-100 text-amber-700' },
}

export function OneOnOneCalendarTab() {
  const { t } = useTranslation('common')

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-dark-500 text-base font-semibold">
          {t('pages.training.calendar.title', 'Calendar of 1-on-1 sessions')}
        </h2>
        <Button
          variant="primary"
          size="md"
          leftIcon={<Icons.Add size={14} className="text-white" />}
          className="h-[40px] rounded-full px-4 text-xs"
        >
          {t('pages.training.calendar.plan', 'Plan a session')}
        </Button>
      </div>

      <div className="flex flex-col gap-3">
        <h3 className="text-dark-500 text-sm font-semibold">
          {t('pages.training.calendar.planned', 'Planned sessions')}
        </h3>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {MOCK_ONE_ON_ONES_PLANNED.map((s) => (
            <SessionCard key={s.id} session={s} />
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <h3 className="text-dark-500 text-sm font-semibold">
          {t('pages.training.calendar.past', 'Past sessions')}
        </h3>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {MOCK_ONE_ON_ONES_PAST.map((s) => (
            <SessionCard key={s.id} session={s} />
          ))}
        </div>
      </div>
    </div>
  )
}

function SessionCard({ session }: { session: MockOneOnOneSession }) {
  const { t } = useTranslation('common')
  const format = FORMAT_TONE[session.format]
  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
      <div className="flex items-start gap-3">
        <div className="flex flex-col items-center justify-center rounded-xl bg-emerald-50 px-3 py-2 text-emerald-700">
          <span className="text-base leading-tight font-bold">{session.timeLabel}</span>
          <span className="text-[10px]">{session.dateLabel}</span>
        </div>
        <div className="flex min-w-0 flex-1 flex-col">
          <span className="text-dark-500 truncate text-sm font-semibold">{session.title}</span>
          <span className="text-[10px] text-gray-500">{session.topic}</span>
        </div>
        <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${format.tone}`}>
          {format.label}
        </span>
      </div>

      <div className="flex items-center gap-2 rounded-lg bg-gray-50/60 px-3 py-2">
        <div className="flex flex-shrink-0 -space-x-1.5">
          <div
            className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-white text-[10px] font-semibold text-gray-700"
            style={{ backgroundColor: session.trainerAvatar }}
          >
            {session.trainerInitials}
          </div>
          <div
            className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-white text-[10px] font-semibold text-gray-700"
            style={{ backgroundColor: session.operatorAvatar }}
          >
            {session.operatorInitials}
          </div>
        </div>
        <div className="flex min-w-0 flex-1 flex-col">
          <span className="truncate text-[11px] text-gray-700">
            <span className="font-medium">{session.trainerName}</span>
          </span>
          <span className="truncate text-[10px] text-gray-500">→ {session.operatorName}</span>
        </div>
        <span className="text-[10px] text-gray-500">{session.durationLabel}</span>
      </div>

      {session.isPlanned ? (
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" className="flex-1 rounded-full text-[11px]">
            {t('pages.training.calendar.reschedule', 'Reschedule')}
          </Button>
          <Button
            variant="primary"
            size="sm"
            className="flex-1 rounded-full text-[11px]"
            leftIcon={<Icons.ArrowRight02 size={12} className="text-white" />}
          >
            {t('pages.training.calendar.join', 'Join')}
          </Button>
        </div>
      ) : (
        <Button
          variant="ghost"
          size="sm"
          className="rounded-full text-[11px]"
          leftIcon={<Icons.View size={12} />}
        >
          {t('pages.training.calendar.viewSummary', 'View summary')}
        </Button>
      )}
    </div>
  )
}

export default OneOnOneCalendarTab
