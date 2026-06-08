import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useTeamEvents } from '@/features/quality/coaching/hooks'
import type { TeamEvent, TeamEventSeverity, TeamEventType } from '@/features/quality/coaching/types'
import { useOperators } from '@/features/users/hooks'
import { useAuthStore } from '@/stores/authStore'

/**
 * Team event feed inside the operator detail panel (KAN-413 Figma
 * `Details-RightView - ENG.svg`).
 *
 * Data comes from `GET /api/v1/quality/coaching/team-events`, which
 * aggregates recent score-dynamics alerts, 1-on-1 schedulings /
 * completions, and trainer-assignment transitions. Operator names are
 * resolved client-side via the cached `useOperators` list so the BE
 * doesn't need to fan out to auth-service per event.
 */
export interface InboxEventFeedProps {
  /** Narrow the feed to specific operators. Defaults to all in scope. */
  userIds?: number[]
  /** Lookback window in hours. BE caps at 168. */
  hours?: number
  /** Max events to render. BE caps at 100. */
  limit?: number
}

const SEVERITY_RING: Record<TeamEventSeverity, string> = {
  info: '#BFDBFE',
  warn: '#FDE68A',
  critical: '#FCA5A5',
}

const SEVERITY_DOT: Record<TeamEventSeverity, string | undefined> = {
  info: undefined,
  warn: '#CA8A04',
  critical: '#EF4444',
}

const TYPE_AVATAR_BG: Record<TeamEventType, string> = {
  score_drop: '#FEF2F2',
  score_growth: '#ECFDF5',
  one_on_one_scheduled: '#EFF6FF',
  one_on_one_completed: '#EFF6FF',
  assignment_taken: '#FEFCE8',
  assignment_closed: '#F2F3F0',
}

function initialsFor(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase()
}

function formatClock(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
}

interface FeedRow {
  event: TeamEvent
  operatorName: string
  initials: string
}

export function InboxEventFeed({ userIds, hours = 24, limit = 20 }: InboxEventFeedProps) {
  const { t } = useTranslation('common')
  const activeProjectId = useAuthStore((s) => s.user?.active_project_id)
  const { data: operators = [] } = useOperators(activeProjectId ? Number(activeProjectId) : null)

  const { data, isLoading, isError } = useTeamEvents({ user_ids: userIds, hours, limit })

  const rows = useMemo<FeedRow[]>(() => {
    const events = data?.data ?? []
    return events.map((event) => {
      const operator = operators.find((o) => o.id === event.operator_id)
      const operatorName = event.operator_name || operator?.full_name || `#${event.operator_id}`
      return { event, operatorName, initials: initialsFor(operatorName) }
    })
  }, [data, operators])

  if (isLoading) {
    return (
      <p className="px-4 py-8 text-center text-xs text-gray-500">
        {t('pages.training.inbox.eventFeed.loading', 'Loading…')}
      </p>
    )
  }

  if (isError) {
    return (
      <p className="px-4 py-8 text-center text-xs text-red-500">
        {t('pages.training.inbox.eventFeed.error', 'Could not load team events.')}
      </p>
    )
  }

  if (rows.length === 0) {
    return (
      <p className="px-4 py-8 text-center text-xs text-gray-500">
        {t('pages.training.inbox.eventFeed.empty', 'No recent team events.')}
      </p>
    )
  }

  return (
    <ol className="flex flex-col">
      {rows.map(({ event, operatorName, initials }, index) => {
        const isLast = index === rows.length - 1
        return (
          <li
            key={event.id}
            className={`relative flex gap-3 px-4 py-3 ${isLast ? '' : 'border-b border-[#F2F3F0]'}`}
          >
            <span className="w-12 flex-shrink-0 pt-0.5 text-[11px] font-medium text-[#676767]">
              {formatClock(event.occurred_at)}
            </span>

            <div className="relative flex-shrink-0">
              <span
                className="flex h-9 w-9 items-center justify-center rounded-full text-xs font-semibold text-[#05040D]"
                style={{ backgroundColor: TYPE_AVATAR_BG[event.type] }}
              >
                {initials}
              </span>
              <span
                className="absolute -right-0.5 -bottom-0.5 inline-block h-3 w-3 rounded-full border-2 border-white"
                style={{ backgroundColor: SEVERITY_RING[event.severity] }}
                aria-hidden
              />
              {SEVERITY_DOT[event.severity] ? (
                <span
                  className="absolute -top-0.5 -left-0.5 inline-block h-2.5 w-2.5 rounded-full border-2 border-white"
                  style={{ backgroundColor: SEVERITY_DOT[event.severity] }}
                  aria-hidden
                />
              ) : null}
            </div>

            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
              <p className="text-xs font-semibold text-[#05040D]">{operatorName}</p>
              <p className="text-[11px] leading-[15px] font-medium text-[#05040D]">{event.title}</p>
              {event.description ? (
                <p className="text-[11px] leading-[15px] text-[#676767]">{event.description}</p>
              ) : null}
            </div>
          </li>
        )
      })}
    </ol>
  )
}

export default InboxEventFeed
