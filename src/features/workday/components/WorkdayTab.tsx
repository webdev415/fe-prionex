/**
 * WorkdayTab Component
 *
 * «Робочий день з розривами» report tab (migrated Metabase Cards 73 + 74 and
 * Techno-Finance «KPI > Факторинг > Робочий день»): one row per operator of
 * the whitelisted departments who was active on the Kyiv day — start and end
 * of the day, working time, breaks, and Card 145 call metrics. A click on a
 * row opens that operator's breaks (`WorkdayBreaksModal`).
 *
 * THE DAY IS KYIV'S. The backend cuts every day in `Europe/Kyiv` whatever zone
 * the request carries, so the default day is today IN KYIV (decision
 * 06.10.2026: today, not yesterday — a live day with «на зараз»), and every
 * clock time is rendered in the answer's `timezone`, with a «Київ» hint. The
 * profile timezone still travels with the request, as in every sibling tab —
 * the backend validates it and moves nothing with it.
 *
 * URL state (registry: `src/lib/reportsUrlKeys.ts`): `wd` = the day (absent
 * = today, never written by default), `wdc` = the calls window (absent = the
 * backend default `day`). Updates use `replace`. Each user action writes ONE
 * key, so the simple functional `setSearchParams` form is enough here — the
 * paramsRef composition the paged feeds need exists for two writes in one
 * tick (Pagination), which this tab never makes.
 *
 * NOT FEATURE-FLAGGED on the frontend, like every sibling report tab: the
 * backend's own switch (`WORKDAY_REPORT_ENABLED`) answers 404 — and so does a
 * backend that does not have the route yet — and the tab renders that as
 * «the report is not available» (`WorkdayErrorState`), never as a crash.
 */

import { useCallback, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useSearchParams } from 'react-router-dom'
import { DateSelect } from '@/components/ui/DateSelect'
import { SegmentedTabs } from '@/components/ui/SegmentedTabs'
import {
  ReportRefreshingOverlay,
  ReportTableLoading,
} from '@/features/report/components/ReportLoadingState'
import { formatPickerDateAsYMD, getDateStringInTimezone } from '@/lib/dateUtils'
import { Icons } from '@/lib/icons'
import { REPORTS_URL_KEYS } from '@/lib/reportsUrlKeys'
import { useAuthStore } from '@/stores/authStore'
import type { WorkdayCallsMode, WorkdayRow } from '../api/types'
import { useWorkdayReport } from '../hooks'
import { WORKDAY_TIMEZONE, formatCalendarDay, parseYmd, secondsToMinutes } from '../utils/format'
import { WORKDAY_HISTORY_FROM } from '../utils/limits'
import { WorkdayBreaksModal } from './WorkdayBreaksModal'
import { WorkdayErrorState } from './WorkdayErrorState'
import { WorkdayNotice } from './WorkdayNotice'
import { WORKDAY_COLUMN_COUNT, WorkdayTable } from './WorkdayTable'

const { day: DAY_KEY, calls: CALLS_KEY } = REPORTS_URL_KEYS.workday

const CALLS_MODES: readonly WorkdayCallsMode[] = ['day', 'cumulative']

/** Anything but the one non-default value reads as the default. */
function readCallsMode(raw: string | null): WorkdayCallsMode {
  return raw === 'cumulative' ? 'cumulative' : 'day'
}

export function WorkdayTab() {
  const { t, i18n } = useTranslation('common')
  const language = i18n.language
  const [searchParams, setSearchParams] = useSearchParams()

  // Same project resolution as every sibling report tab.
  const user = useAuthStore((state) => state.user)
  const projectId: number = Number(user?.active_project_id ?? user?.projects?.[0]?.id ?? 1)
  const userTimezone = user?.timezone

  // Today IN KYIV — the report's own calendar, not the profile's.
  const today = getDateStringInTimezone(new Date(), WORKDAY_TIMEZONE)

  const rawDay = searchParams.get(DAY_KEY)
  // An absent key is the default; a present but unusable one blocks the
  // request and is flagged on the field (sibling-tab rule for URL values).
  const day = rawDay === null ? today : parseYmd(rawDay) ? rawDay : null
  const calls = readCallsMode(searchParams.get(CALLS_KEY))

  const setUrlParam = (key: string, value: string | null) => {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        if (value === null) next.delete(key)
        else next.set(key, value)
        return next
      },
      { replace: true }
    )
  }

  const query = useWorkdayReport({
    projectId,
    day: day ?? today,
    calls,
    timezone: userTimezone,
    enabled: day !== null,
  })

  const [openOperator, setOpenOperator] = useState<{ user_id: number; fio: string } | null>(null)
  const handleOpenOperator = useCallback(
    (row: WorkdayRow) => setOpenOperator({ user_id: row.user_id, fio: row.fio }),
    []
  )

  const rows = useMemo(() => query.data?.rows ?? [], [query.data])
  const isRefreshing = query.isPlaceholderData
  const meta = query.data?.meta
  const redMinutes = secondsToMinutes(meta?.red_threshold_seconds)
  const breakMinutes = secondsToMinutes(meta?.break_threshold_seconds)

  return (
    <div className="flex w-full flex-col gap-4">
      <div className="bg-card flex flex-wrap items-end gap-3 rounded-xl p-4 shadow-sm sm:gap-4">
        <DateSelect
          label={t('pages.reports.workday.day')}
          value={day}
          error={day === null ? t('pages.reports.workday.invalidDay') : undefined}
          onChange={({ value }) => {
            // A cleared field is not a filter change: the day is REQUIRED.
            if (value) setUrlParam(DAY_KEY, formatPickerDateAsYMD(value))
          }}
          // Mirrors the backend's 400s (history start, no future day) so the
          // picker does not offer what the API refuses; a hand-edited URL
          // still gets the server's translated sentence.
          min={meta?.history_from ?? WORKDAY_HISTORY_FROM}
          max={today}
          allowManualInput
          resyncInvalidOnBlur
          format="dd.MM.yyyy"
          className="w-full min-w-0 sm:w-44"
        />
        <div className="flex flex-col gap-1">
          <span className="text-muted-foreground text-xs font-medium" id="workday-calls-label">
            {t('pages.reports.workday.calls.label')}
          </span>
          <SegmentedTabs<WorkdayCallsMode>
            items={CALLS_MODES.map((mode) => ({
              id: mode,
              label: t(`pages.reports.workday.calls.${mode}`),
            }))}
            value={calls}
            onChange={(mode) => setUrlParam(CALLS_KEY, mode === 'day' ? null : mode)}
            ariaLabel={t('pages.reports.workday.calls.label')}
            idPrefix="workday-calls"
          />
        </div>
        <p className="text-muted-foreground flex items-center gap-1 text-xs sm:ml-auto">
          <Icons.Clock01 size={14} className="text-muted-foreground" />
          {t('pages.reports.workday.timezoneHint')}
        </p>
      </div>

      {day === null ? null : query.isLoading ? (
        <ReportTableLoading columns={WORKDAY_COLUMN_COUNT} />
      ) : query.isError ? (
        <WorkdayErrorState error={query.error} tab="workday" onRetry={() => query.refetch()} />
      ) : query.data && meta ? (
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1" data-testid="workday-notices">
            {!meta.day_closed && (
              <WorkdayNotice testId="workday-notice-running">
                {t('pages.reports.workday.dayRunning')}
              </WorkdayNotice>
            )}
            {meta.calls_unavailable && (
              <WorkdayNotice testId="workday-notice-calls-unavailable" warning>
                {t('pages.reports.workday.callsUnavailable')}
              </WorkdayNotice>
            )}
            {query.data.calls === 'cumulative' && !meta.calls_unavailable && (
              <WorkdayNotice testId="workday-notice-cumulative">
                {t('pages.reports.workday.calls.cumulativeHint', {
                  from: formatCalendarDay(meta.calls_from, language),
                  to: formatCalendarDay(meta.calls_to, language),
                })}
              </WorkdayNotice>
            )}
            {redMinutes !== null && (
              <p className="text-muted-foreground text-xs" data-testid="workday-legend">
                {t('pages.reports.workday.legend', {
                  red: redMinutes,
                  gap: breakMinutes ?? '—',
                })}
              </p>
            )}
            {/* Contract decision 5 (06.10.2026): department and group are the
                CURRENT ones for every day — a transferred operator shows under the
                new department on old days, a dismissed one is badged. */}
            <p className="text-muted-foreground text-xs" data-testid="workday-org-hint">
              {t('pages.reports.workday.orgHint')}
            </p>
          </div>
          <div className="relative w-full" aria-busy={isRefreshing || undefined}>
            <WorkdayTable
              rows={rows}
              timezone={query.data.timezone}
              dayClosed={meta.day_closed}
              emptyMessage={t('pages.reports.workday.empty')}
              onOpenOperator={handleOpenOperator}
            />
            {isRefreshing && <ReportRefreshingOverlay testId="workday-refreshing" />}
          </div>
        </div>
      ) : null}

      <WorkdayBreaksModal
        projectId={projectId}
        operator={openOperator}
        // The day of the answer on screen — the row clicked belongs to it.
        day={query.data?.day ?? day ?? today}
        requestTimezone={userTimezone}
        onClose={() => setOpenOperator(null)}
      />
    </div>
  )
}
