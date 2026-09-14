import { useEffect, useState } from 'react'
import { getDateStringInTimezone } from '@/lib/dateUtils'

/**
 * "Today" as the operator's profile timezone defines it, held in state.
 *
 * "Now" is a real moment; the calendar day it falls on is not. Near midnight
 * the browser's day and the operator's day differ, and the reports send that
 * same timezone to the backend, which cuts its days in it — so both ends of
 * the request must agree on what "today" means, and the browser's own day is
 * the wrong answer.
 *
 * HELD IN STATE, not read off the wall clock in render. A render-time read
 * picks up a new day on ANY re-render, which sounds harmless until you notice
 * what that means: a tab sitting open across midnight shows yesterday's work
 * list until something unrelated re-renders it, and then silently switches.
 * Seeded once at mount and re-resolved on window focus instead, so the day
 * rolls over at the moment the operator comes back to the tab — an observable,
 * explainable instant rather than whenever React happened to run.
 *
 * The functional update returns the PREVIOUS string when the day has not
 * changed, so a same-day focus re-renders nothing. That matters more than it
 * looks: `refetchOnWindowFocus` is false globally (`src/main.tsx`), so this
 * listener is the only thing on the reports page that reacts to focus at all,
 * and a new string identity here would be a new request on every focus.
 *
 * The effect also re-resolves IMMEDIATELY, not only on the next focus: the
 * profile timezone can load or change after mount, which changes what "today"
 * means with the clock standing still.
 *
 * DELIBERATELY NOT USED BY EVERY REPORT TAB. Four tabs (client processing,
 * promises-daily, operator-promises, third-party verification) read their
 * "today" in render instead. Adopting this hook there would change their
 * behaviour — the day would stop following re-renders, and they would gain a
 * focus listener and therefore a refetch they do not have today — and none of
 * them has a focus test that would catch it. Converting them is a change of
 * behaviour with its own tests, not part of an extraction.
 *
 * @param timezone IANA zone from the user's profile; falsy falls back to the
 *   browser zone inside `getDateStringInTimezone`.
 * @returns today's date as `YYYY-MM-DD`.
 */
export function useTodayInTimezone(timezone: string | null | undefined): string {
  const [today, setToday] = useState(() => getDateStringInTimezone(new Date(), timezone))

  useEffect(() => {
    const refreshToday = () =>
      setToday((prev) => {
        const next = getDateStringInTimezone(new Date(), timezone)
        return next === prev ? prev : next
      })
    refreshToday()
    window.addEventListener('focus', refreshToday)
    return () => window.removeEventListener('focus', refreshToday)
  }, [timezone])

  return today
}
