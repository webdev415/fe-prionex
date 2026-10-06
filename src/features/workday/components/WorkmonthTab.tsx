/**
 * WorkmonthTab Component
 *
 * «Робочий місяць з розривами» report tab (Techno-Finance «KPI > Факторинг >
 * Робочий місяць»): one row per operator active in the month's window —
 * totals over the weekdays, the days with activity and the average break per
 * active day. A click on a row opens every calendar day of the month for that
 * operator (`WorkmonthDaysModal`).
 *
 * The window is `[1st .. min(month end, yesterday in Kyiv)]`, cut by the
 * server; the default month is the current one IN KYIV. On the 1st of the
 * month (and for a future month) the window is empty and the answer is a
 * normal 200 with no rows and `window_from = null` — the tab says «no closed
 * day yet», not «no activity».
 *
 * URL state: `wm` (`YYYY-MM`, absent = the current month, never written by
 * default; registry `src/lib/reportsUrlKeys.ts`), `replace` updates.
 *
 * 503 `WORKDAY_MONTH_NOT_READY` (more stale days than may be computed live)
 * is NOT retried automatically — neither here nor in the api client (see
 * `api/workdayApi.ts`); the panel lists the stale days. Same 404 handling and
 * no frontend flag as the day tab (see `WorkdayTab`).
 */

import { useCallback, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useSearchParams } from 'react-router-dom'
import { DateSelect } from '@/components/ui/DateSelect'
import {
  ReportRefreshingOverlay,
  ReportTableLoading,
} from '@/features/report/components/ReportLoadingState'
import { getDateStringInTimezone } from '@/lib/dateUtils'
import { Icons } from '@/lib/icons'
import { REPORTS_URL_KEYS } from '@/lib/reportsUrlKeys'
import { useAuthStore } from '@/stores/authStore'
import type { WorkmonthRow } from '../api/types'
import { useWorkmonthReport } from '../hooks'
import {
  WORKDAY_TIMEZONE,
  defaultWorkmonth,
  formatCalendarDay,
  isValidMonth,
  secondsToMinutes,
} from '../utils/format'
import { WORKMONTH_HISTORY_FROM } from '../utils/limits'
import { WorkdayErrorState } from './WorkdayErrorState'
import { WorkdayNotice } from './WorkdayNotice'
import { WorkmonthDaysModal } from './WorkmonthDaysModal'
import { WORKMONTH_COLUMN_COUNT, WorkmonthTable } from './WorkmonthTable'

const { month: MONTH_KEY } = REPORTS_URL_KEYS.workmonth

const pad = (n: number) => String(n).padStart(2, '0')

export function WorkmonthTab() {
  const { t, i18n } = useTranslation('common')
  const language = i18n.language
  const [searchParams, setSearchParams] = useSearchParams()

  const user = useAuthStore((state) => state.user)
  const projectId: number = Number(user?.active_project_id ?? user?.projects?.[0]?.id ?? 1)
  const userTimezone = user?.timezone

  const todayKyiv = getDateStringInTimezone(new Date(), WORKDAY_TIMEZONE)
  // The picker's upper bound: the month that holds today.
  const currentMonth = todayKyiv.slice(0, 7)
  // The default (absent `wm`): the previous month on the 1st, else this one.
  const defaultMonth = defaultWorkmonth(todayKyiv)
  const rawMonth = searchParams.get(MONTH_KEY)
  const month = rawMonth === null ? defaultMonth : isValidMonth(rawMonth) ? rawMonth : null

  const query = useWorkmonthReport({
    projectId,
    month: month ?? defaultMonth,
    timezone: userTimezone,
    enabled: month !== null,
  })

  const [openOperator, setOpenOperator] = useState<{ user_id: number; fio: string } | null>(null)
  const handleOpenOperator = useCallback(
    (row: WorkmonthRow) => setOpenOperator({ user_id: row.user_id, fio: row.fio }),
    []
  )

  const rows = useMemo(() => query.data?.rows ?? [], [query.data])
  const isRefreshing = query.isPlaceholderData
  const data = query.data
  const meta = data?.meta
  const redMinutes = secondsToMinutes(meta?.red_threshold_seconds)
  const hasWindow = !!data?.window_from && !!data?.window_to

  return (
    <div className="flex w-full flex-col gap-4">
      <div className="bg-card flex flex-wrap items-end gap-3 rounded-xl p-4 shadow-sm sm:gap-4">
        <DateSelect
          label={t('pages.reports.workmonth.month')}
          showMonthYearPicker
          format="MMMM yyyy"
          value={month ? `${month}-01` : null}
          error={month === null ? t('pages.reports.workmonth.invalidMonth') : undefined}
          onChange={({ value }) => {
            // The picker hands a local-midnight Date of the clicked month.
            if (!value) return
            const picked = `${value.getFullYear()}-${pad(value.getMonth() + 1)}`
            setSearchParams(
              (prev) => {
                const next = new URLSearchParams(prev)
                next.set(MONTH_KEY, picked)
                return next
              },
              { replace: true }
            )
          }}
          min={`${meta?.history_from?.slice(0, 7) ?? WORKMONTH_HISTORY_FROM}-01`}
          max={`${currentMonth}-01`}
          className="w-full min-w-0 sm:w-52"
        />
        <p className="text-muted-foreground flex items-center gap-1 text-xs sm:ml-auto">
          <Icons.Clock01 size={14} className="text-muted-foreground" />
          {t('pages.reports.workday.timezoneHint')}
        </p>
      </div>

      {month === null ? null : query.isLoading ? (
        <ReportTableLoading columns={WORKMONTH_COLUMN_COUNT} />
      ) : query.isError ? (
        <WorkdayErrorState error={query.error} tab="workmonth" onRetry={() => query.refetch()} />
      ) : data && meta ? (
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1" data-testid="workmonth-notices">
            {hasWindow && (
              <p className="text-muted-foreground text-xs" data-testid="workmonth-window">
                {t('pages.reports.workmonth.window', {
                  from: formatCalendarDay(data.window_from, language),
                  to: formatCalendarDay(data.window_to, language),
                  days: meta.weekdays_in_period,
                })}
              </p>
            )}
            {meta.holidays_unavailable && (
              <WorkdayNotice testId="workmonth-notice-holidays-unavailable" warning>
                {t('pages.reports.workmonth.holidaysUnavailable')}
              </WorkdayNotice>
            )}
            {redMinutes !== null && hasWindow && (
              <p className="text-muted-foreground text-xs" data-testid="workmonth-legend">
                {t('pages.reports.workmonth.legend', { red: redMinutes })}
              </p>
            )}
            {/* Contract decision 5 (06.10.2026): department and group are the
                CURRENT ones for every day — a transferred operator shows under the
                new department on old days, a dismissed one is badged. */}
            <p className="text-muted-foreground text-xs" data-testid="workmonth-org-hint">
              {t('pages.reports.workday.orgHint')}
            </p>
          </div>
          <div className="relative w-full" aria-busy={isRefreshing || undefined}>
            <WorkmonthTable
              rows={rows}
              emptyMessage={
                hasWindow
                  ? t('pages.reports.workmonth.empty')
                  : t('pages.reports.workmonth.emptyWindow')
              }
              onOpenOperator={handleOpenOperator}
            />
            {isRefreshing && <ReportRefreshingOverlay testId="workmonth-refreshing" />}
          </div>
        </div>
      ) : null}

      <WorkmonthDaysModal
        projectId={projectId}
        operator={openOperator}
        month={data?.month ?? month ?? defaultMonth}
        requestTimezone={userTimezone}
        onClose={() => setOpenOperator(null)}
      />
    </div>
  )
}
