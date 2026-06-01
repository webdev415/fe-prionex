import { useTranslation } from 'react-i18next'
import { MOCK_INBOX_TEAM_EVENTS } from '../../mocks/trainerWorkplaceMocks'

/**
 * Event Feed tab — Figma `Details-RightView - ENG (1).svg` (360px panel).
 */
export function MockInboxEventFeed() {
  const { t } = useTranslation('common')

  return (
    <div className="flex flex-col px-4 pt-3 pb-4">
      <div className="mb-1 flex items-center justify-between py-2">
        <div className="flex items-center gap-2">
          <span className="relative flex h-3 w-3 items-center justify-center">
            <span className="absolute inline-flex h-3 w-3 rounded-full bg-[#22C55E] opacity-30" />
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-[#22C55E]" />
          </span>
          <span className="text-xs font-semibold text-[#05040D]">
            {t('pages.training.inbox.feed.live', 'Live')}
          </span>
        </div>
        <span className="text-[11px] text-[#676767]">
          {t('pages.training.inbox.feed.today', 'Today')}
        </span>
      </div>

      <ul className="flex flex-col">
        {MOCK_INBOX_TEAM_EVENTS.map((event, index) => (
          <li
            key={event.id}
            className={`flex gap-3 py-4 ${
              index < MOCK_INBOX_TEAM_EVENTS.length - 1 ? 'border-b border-[#EBECE8]' : ''
            }`}
          >
            <div className="relative flex-shrink-0">
              <div
                className="flex h-7 w-7 items-center justify-center rounded-full text-[10px] font-semibold text-[#05040D]"
                style={{ backgroundColor: event.avatarRingBg }}
              >
                {event.initials}
              </div>
              {event.statusDotColor ? (
                <span
                  className="absolute -right-0.5 -bottom-0.5 h-1.5 w-1.5 rounded-full border border-white"
                  style={{ backgroundColor: event.statusDotColor }}
                />
              ) : null}
            </div>

            <span
              className="mt-0.5 h-5 w-5 flex-shrink-0 rounded-full"
              style={{ backgroundColor: event.badgeColor }}
              aria-hidden
            />

            <div className="min-w-0 flex-1">
              <div className="flex items-start justify-between gap-2">
                <p className="text-xs leading-4 font-semibold text-[#05040D]">{event.title}</p>
                <span className="flex-shrink-0 text-[11px] leading-4 text-[#676767]">
                  {event.timeLabel}
                </span>
              </div>
              <p className="mt-0.5 text-[11px] leading-4 text-[#676767]">{event.operatorName}</p>
              <p className="mt-1 text-[11px] leading-[15px] text-[#374151]">{event.description}</p>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}

export default MockInboxEventFeed
