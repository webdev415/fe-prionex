/**
 * WorkdayErrorState Component
 *
 * The failure panel of both workday tabs and both modals. The shared ladder
 * (`useFeedErrorMessage`: 403, a 400 with the server's — translated — detail,
 * the generic title) covers what it covers; on top of it this panel answers
 * the report's own cases (see `utils/errors.ts`):
 *
 * - 404 without a code → «the report is not available» (switched off, or the
 *   backend that serves it is not deployed yet) — an empty state, no retry,
 *   never a crash;
 * - 404 `WORKDAY_OPERATOR_NOT_FOUND` → the operator left the population;
 * - 503 `WORKDAY_MONTH_NOT_READY` → the stale days, listed, and NO automatic
 *   retry (only the nightly job heals them; the button stays for a manual try);
 * - any other 503 → the translated `codes.<CODE>` sentence and «try again in
 *   N s» from `params.retry_after_seconds`.
 */

import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/Button'
import { useFeedErrorMessage } from '@/hooks'
import { translateErrorCode } from '@/lib/errors'
import { Icons } from '@/lib/icons'
import { classifyWorkdayFailure, responseParams } from '../utils/errors'
import { formatCalendarDay } from '../utils/format'

export interface WorkdayErrorStateProps {
  error: unknown
  /** Which tab's wording to use (the day tab's or the month tab's section). */
  tab: 'workday' | 'workmonth'
  onRetry: () => void
}

export function WorkdayErrorState({ error, tab, onRetry }: WorkdayErrorStateProps) {
  const { t, i18n } = useTranslation('common')
  const language = i18n.language
  const { errorMessage, isForbidden } = useFeedErrorMessage(error, tab)
  const failure = classifyWorkdayFailure(error)

  const unavailable =
    tab === 'workday'
      ? t('pages.reports.workday.unavailable')
      : t('pages.reports.workmonth.unavailable')
  const retryLabel =
    tab === 'workday'
      ? t('pages.reports.workday.error.retry')
      : t('pages.reports.workmonth.error.retry')

  if (failure.kind === 'notAvailable') {
    return (
      <Panel kind={failure.kind} icon={<Icons.Info size={40} className="text-muted-foreground" />}>
        <p className="text-foreground text-center text-sm font-medium">
          {t('pages.reports.workday.notAvailable.title')}
        </p>
        <p className="text-muted-foreground text-center text-xs">
          {t('pages.reports.workday.notAvailable.body')}
        </p>
      </Panel>
    )
  }

  if (failure.kind === 'operatorNotFound') {
    return (
      <Panel kind={failure.kind} icon={<Icons.Info size={40} className="text-muted-foreground" />}>
        <p className="text-foreground text-center text-sm font-medium">
          {t('pages.reports.workday.operatorNotFound')}
        </p>
      </Panel>
    )
  }

  if (failure.kind === 'monthNotReady') {
    return (
      <Panel
        kind={failure.kind}
        icon={<Icons.Clock01 size={40} className="text-muted-foreground" />}
      >
        <p className="text-foreground text-center text-sm font-medium">
          {t('pages.reports.workmonth.notReady.title')}
        </p>
        <p className="text-muted-foreground text-center text-xs">
          {t('pages.reports.workmonth.notReady.body', { days: failure.staleDays.length })}
        </p>
        {failure.staleDays.length > 0 && (
          <ul
            className="text-foreground flex flex-wrap justify-center gap-2 text-xs tabular-nums"
            data-testid="workmonth-stale-days"
          >
            {failure.staleDays.map((day) => (
              <li key={day} className="border-border rounded-full border px-2 py-0.5">
                {formatCalendarDay(day, language)}
              </li>
            ))}
          </ul>
        )}
        {/* Manual only: the contract forbids an automatic retry here. */}
        <Button variant="secondary" size="sm" onClick={onRetry}>
          {retryLabel}
        </Button>
      </Panel>
    )
  }

  if (failure.kind === 'retryLater') {
    // The code's own translated sentence; an unknown (newer) code falls back
    // to the tab's «temporarily unavailable», never to the English detail,
    // which names server settings.
    const message = translateErrorCode(failure.code, unavailable, responseParams(error))
    return (
      <Panel kind={failure.kind} icon={<Icons.Warning size={40} className="text-error-500" />}>
        <p className="text-foreground text-center text-sm font-medium">{message}</p>
        {failure.retryAfterSeconds !== null && (
          <p
            className="text-muted-foreground text-center text-xs"
            data-testid="workday-retry-after"
          >
            {t('pages.reports.workday.retryAfter', { seconds: failure.retryAfterSeconds })}
          </p>
        )}
        <Button variant="secondary" size="sm" onClick={onRetry}>
          {retryLabel}
        </Button>
      </Panel>
    )
  }

  return (
    <Panel kind={failure.kind} icon={<Icons.Warning size={40} className="text-error-500" />}>
      <p className="text-foreground text-center text-sm font-medium">{errorMessage}</p>
      {/* Retrying cannot fix missing permissions — no button on 403 */}
      {!isForbidden && (
        <Button variant="secondary" size="sm" onClick={onRetry}>
          {retryLabel}
        </Button>
      )}
    </Panel>
  )
}

function Panel({
  kind,
  icon,
  children,
}: {
  kind: string
  icon: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <div
      data-testid="workday-error"
      data-kind={kind}
      className="border-border bg-card flex w-full flex-col items-center justify-center gap-3 rounded-xl border p-8"
    >
      {icon}
      {children}
    </div>
  )
}
