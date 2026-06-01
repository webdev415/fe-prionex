import { useTranslation } from 'react-i18next'
import { MOCK_INBOX_TEAM_EVENTS } from '../../mocks/trainerWorkplaceMocks'

/**
 * Team event stream — Figma Inbox View B / shared with Kanban & Grid sidebars.
 */
export function MockInboxEventFeed() {
  const { t } = useTranslation('common')

  return (
    <div className="flex flex-col gap-3 p-4">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-[#05040D]">
          {t('pages.training.inbox.feed.live', 'Live')}
        </span>
        <span className="text-[10px] text-gray-500">
          {t('pages.training.inbox.feed.today', 'Today')}
        </span>
      </div>
      <h3 className="text-sm font-medium text-[#05040D]">
        {t('pages.training.inbox.feed.latestTeamEvents', 'Latest team events')}
      </h3>
      <ul className="flex flex-col gap-2">
        {MOCK_INBOX_TEAM_EVENTS.map((event) => (
          <li
            key={event.id}
            className="flex gap-2 rounded-lg border border-[#EBECE8] bg-[#FAFAFA] px-3 py-2.5"
          >
            <div
              className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-[10px] font-semibold text-[#05040D]"
              style={{ backgroundColor: event.avatarColor }}
            >
              {event.initials}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline justify-between gap-2">
                <span className="truncate text-xs font-semibold text-[#05040D]">{event.title}</span>
                <span className="flex-shrink-0 text-[10px] text-gray-500">{event.timeLabel}</span>
              </div>
              <p className="text-[10px] text-gray-500">{event.operatorName}</p>
              <p className="mt-0.5 text-[11px] text-gray-600">{event.description}</p>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}

export default MockInboxEventFeed
