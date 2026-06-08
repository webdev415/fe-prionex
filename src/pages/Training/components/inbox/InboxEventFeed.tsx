import { useTranslation } from 'react-i18next'
import { MOCK_INBOX_TEAM_EVENTS, type MockInboxTeamEvent } from '../../mocks/trainerWorkplaceMocks'

/**
 * Team event feed inside the operator detail panel (KAN-413 Figma
 * `Details-RightView - ENG.svg`).
 *
 * **Data source — temporary.** The BE does not yet expose a team-events
 * stream; the FE renders `MOCK_INBOX_TEAM_EVENTS` so the surface stays
 * visually faithful to the Figma frame. A follow-up ticket will back this
 * feed with `GET /api/v1/quality/coaching/team-events` (or whatever the
 * notification-service projection ends up being); the view component will
 * keep this exact JSX once the hook plugs in.
 */
export interface InboxEventFeedProps {
  events?: MockInboxTeamEvent[]
}

export function InboxEventFeed({ events = MOCK_INBOX_TEAM_EVENTS }: InboxEventFeedProps) {
  const { t } = useTranslation('common')

  if (events.length === 0) {
    return (
      <p className="px-4 py-8 text-center text-xs text-gray-500">
        {t('pages.training.inbox.eventFeed.empty', 'No recent team events.')}
      </p>
    )
  }

  return (
    <ol className="flex flex-col">
      {events.map((event, index) => {
        const isLast = index === events.length - 1
        return (
          <li
            key={event.id}
            className={`relative flex gap-3 px-4 py-3 ${isLast ? '' : 'border-b border-[#F2F3F0]'}`}
          >
            <span className="w-12 flex-shrink-0 pt-0.5 text-[11px] font-medium text-[#676767]">
              {event.timeLabel}
            </span>

            <div className="relative flex-shrink-0">
              <span
                className="flex h-9 w-9 items-center justify-center rounded-full text-xs font-semibold text-[#05040D]"
                style={{ backgroundColor: event.avatarRingBg }}
              >
                {event.initials}
              </span>
              <span
                className="absolute -right-0.5 -bottom-0.5 inline-block h-3 w-3 rounded-full border-2 border-white"
                style={{ backgroundColor: event.badgeColor }}
                aria-hidden
              />
              {event.statusDotColor ? (
                <span
                  className="absolute -top-0.5 -left-0.5 inline-block h-2.5 w-2.5 rounded-full border-2 border-white"
                  style={{ backgroundColor: event.statusDotColor }}
                  aria-hidden
                />
              ) : null}
            </div>

            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
              <p className="text-xs font-semibold text-[#05040D]">{event.operatorName}</p>
              <p className="text-[11px] leading-[15px] font-medium text-[#05040D]">{event.title}</p>
              <p className="text-[11px] leading-[15px] text-[#676767]">{event.description}</p>
            </div>
          </li>
        )
      })}
    </ol>
  )
}

export default InboxEventFeed
