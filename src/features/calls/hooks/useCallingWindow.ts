import { useRef } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
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
 * Takes the debtor when one is known, because origination resolves the window
 * in that debtor's own timezone — without it the button and the call can
 * disagree by an hour for a Canary debtor.
 *
 * Polled rather than fetched once because the window closes *during* a shift.
 * A minute is close enough: the backend refuses regardless, so the only cost
 * of being briefly stale is a button that looks live for a few seconds.
 */
const POLL_INTERVAL_MS = 60_000

export function useCallingWindow(clientId?: number | null) {
  const { t } = useTranslation('common')
  const queryClient = useQueryClient()
  // The client is part of the key: in Spain the window is judged in the
  // debtor's own zone, so two debtors in one project can differ by an hour.
  const queryKey = ['callingWindowStatus', clientId ?? null]

  const { data, isLoading } = useQuery<CallingWindowStatus>({
    queryKey,
    queryFn: () => callService.getCallingWindowStatus(clientId),
    refetchInterval: POLL_INTERVAL_MS,
    refetchOnWindowFocus: true,
    staleTime: 30_000,
  })

  // Absent while loading, or if the request failed. Treated as allowed on
  // purpose: the server is the control, and a failed status check must not
  // disable calling for projects that have no window at all.
  const allowed = data?.allowed ?? true

  const message = data && !data.allowed ? reasonMessage(t, data.reason) : null

  // A ref, not the mutation's isPending: that is read from the last render, so
  // two presses landing in the same frame both saw "not pending" and both
  // wrote a record.
  const inFlight = useRef(false)
  const report = useMutation({
    mutationFn: () => callService.reportBlockedCallAttempt(clientId),
    onSettled: () => {
      inFlight.current = false
    },
    onError: (error) => {
      // Not shown to the operator: they already have the refusal on screen and
      // can do nothing about a failed audit write. But it must not vanish —
      // the record is the whole point of the feature.
      console.error('Could not record a blocked call attempt', error)
    },
    onSuccess: (result) => {
      // The server re-checks the window before recording anything. If it has
      // opened since the page last asked, nothing was recorded — refresh so
      // the button comes back rather than refusing a call that is now legal.
      if (result.allowed) queryClient.invalidateQueries({ queryKey })
    },
  })

  /**
   * An operator pressed a call button the window had disabled.
   *
   * The button stays disabled, so this is the only trace the attempt leaves:
   * without it the audit log showed no blocked calls at all. The reason is
   * shown straight away rather than after the round trip — it is what the
   * operator pressed the button to find out.
   */
  const reportBlocked = () => {
    if (message) toast.warning(message)
    // One record per press: a double-click or a key held down must not write
    // a burst of identical entries.
    if (inFlight.current) return
    inFlight.current = true
    report.mutate()
  }

  return {
    allowed,
    isLoading,
    reason: data?.reason ?? null,
    message,
    reportBlocked,
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
