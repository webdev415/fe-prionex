import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { callService } from '../api/callService'
import type { CallingWindowReason, CallingWindowStatus } from '../types'

/**
 * Whether the operator's project allows a call right now (KAN-1107).
 *
 * The decision is the server's. Nothing here recomputes the window: the rule
 * is a compliance control and the client clock is not trustworthy for it — an
 * operator whose machine is an hour fast would otherwise see an enabled button
 * outside the legal hours, click it, and get a 403 with no explanation.
 *
 * Polled rather than fetched once because the window closes *during* a shift.
 * A minute is close enough: the backend refuses regardless, so the only cost
 * of being briefly stale is a button that looks live for a few seconds.
 */
const POLL_INTERVAL_MS = 60_000

export function useCallingWindow() {
  const { t } = useTranslation('common')

  const { data, isLoading } = useQuery<CallingWindowStatus>({
    queryKey: ['callingWindowStatus'],
    queryFn: () => callService.getCallingWindowStatus(),
    refetchInterval: POLL_INTERVAL_MS,
    refetchOnWindowFocus: true,
    staleTime: 30_000,
  })

  // Absent while loading, or if the request failed. Treated as allowed on
  // purpose: the server is the control, and a failed status check must not
  // disable calling for projects that have no window at all.
  const allowed = data?.allowed ?? true

  return {
    allowed,
    isLoading,
    reason: data?.reason ?? null,
    message: data && !data.allowed ? reasonMessage(t, data.reason) : null,
  }
}

type TFn = (key: string, fallback: string) => string

export function reasonMessage(t: TFn, reason: CallingWindowReason | null): string {
  switch (reason) {
    case 'before_window_start':
    case 'after_window_end':
      return t('pages.calls.callingWindow.outsideHours', 'Outside the allowed calling hours')
    case 'weekday_not_allowed':
      return t('pages.calls.callingWindow.weekend', 'Calls are not allowed today')
    case 'public_holiday':
      return t('pages.calls.callingWindow.holiday', 'Today is a public holiday')
    case 'holiday_calendar_missing':
      // Not "today is a holiday": it is not one, the calendar for this year
      // has simply never been generated. The operator cannot wait that out —
      // an administrator has to set it up.
      return t(
        'pages.calls.callingWindow.noCalendar',
        'Calling is blocked until this year\u2019s holiday calendar is set up'
      )
    case 'timezone_unresolved':
    case 'window_misconfigured':
      // Deliberately not "outside the hours": the call is refused because the
      // window could not be established, and telling the operator the wrong
      // reason sends them to the wrong person for help.
      return t('pages.calls.callingWindow.unavailable', 'Calling hours cannot be checked right now')
    default:
      return t('pages.calls.callingWindow.blocked', 'Calling is not allowed right now')
  }
}
