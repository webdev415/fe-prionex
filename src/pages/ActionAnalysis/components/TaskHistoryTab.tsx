import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useSearchParams } from 'react-router-dom'
import { useAuthStore } from '@/stores/authStore'
import { useOperators } from '@/features/users/hooks'
import {
  useTaskHistory,
  useTaskHistoryAnalytics,
  useTaskSubjects,
  type TaskHistorySort,
} from '@/features/actionAnalysis'
import { Pagination } from '@/components/ui/Pagination'
import { TableSkeleton } from '@/components/ui/TableSkeleton'
import { defaultCustomDateRange } from '../lib/dateRange'
import {
  TASK_HISTORY_FILTERS_DEFAULT,
  readTaskHistoryUrlState,
  writeTaskHistoryUrlState,
  toTaskHistoryQuery,
  toTaskHistoryAnalyticsQuery,
  type TaskHistoryBarState,
} from '../lib/taskHistoryUrlState'
import { useScopedUserIds } from '../lib/scope'
import { TaskHistoryAnalytics } from './TaskHistoryAnalytics'
import { TaskHistoryFiltersBar } from './TaskHistoryFiltersBar'
import { TaskHistoryTable } from './TaskHistoryTable'

export function TaskHistoryTab() {
  const { t } = useTranslation('common')
  const [searchParams, setSearchParams] = useSearchParams()

  const activeProjectId = useAuthStore((s) => s.user?.active_project_id)
  const userTimezone = useAuthStore((s) => s.user?.timezone)
  const { data: operators = [] } = useOperators(activeProjectId ? Number(activeProjectId) : null)
  const { data: subjects = [] } = useTaskSubjects()

  const barState = useMemo(() => readTaskHistoryUrlState(searchParams), [searchParams])

  useEffect(() => {
    if (searchParams.get('period') !== 'custom') return
    if (searchParams.get('from_date') && searchParams.get('to_date')) return
    const s = readTaskHistoryUrlState(searchParams)
    const d = defaultCustomDateRange(userTimezone)
    setSearchParams(
      writeTaskHistoryUrlState(new URLSearchParams(searchParams), {
        ...s,
        customFromDate: d.from,
        customToDate: d.to,
      }),
      { replace: true }
    )
  }, [searchParams, setSearchParams, userTimezone])

  // Page-level scope (KAN-506) decides the base user_ids[]; the tab-level
  // Department/Employee pickers refine within that scope. Scope locks out the
  // pickers entirely when narrower than "all" (handled in the filter bar).
  const scoped = useScopedUserIds(operators)

  const assignedToUserIds = useMemo<number[] | undefined>(() => {
    // Tab-level Department refinement still applies as long as the scope
    // allows it (scope=all and scope=department both leave the employee
    // picker editable, and scope=department additionally locks Department to
    // the current user's own — handled inside the filter bar).
    if (barState.departmentId != null) {
      const ids = operators
        .filter((o) => o.department_id === barState.departmentId)
        .map((o) => o.id)
      const intersected =
        scoped.userIds == null ? ids : ids.filter((id) => scoped.userIds!.includes(id))
      return intersected.length ? intersected : []
    }
    if (barState.employeeIds.length > 0) {
      if (scoped.userIds == null) return barState.employeeIds
      const scopeSet = new Set(scoped.userIds)
      return barState.employeeIds.filter((id) => scopeSet.has(id))
    }
    return scoped.userIds
  }, [barState.departmentId, barState.employeeIds, operators, scoped.userIds])

  const createdByIn = useMemo<number[] | undefined>(
    () => (barState.authorIds.length > 0 ? barState.authorIds : undefined),
    [barState.authorIds]
  )

  const isDeptEmpty =
    (barState.departmentId != null || scoped.isEmptyResolution) &&
    (assignedToUserIds == null || assignedToUserIds.length === 0)

  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)

  const listFilters = useMemo(
    () => ({
      ...toTaskHistoryQuery(barState, assignedToUserIds, createdByIn),
      skip: (page - 1) * pageSize,
      limit: pageSize,
    }),
    [barState, assignedToUserIds, createdByIn, page, pageSize]
  )

  const analyticsFilters = useMemo(
    () => toTaskHistoryAnalyticsQuery(barState, assignedToUserIds, createdByIn),
    [barState, assignedToUserIds, createdByIn]
  )

  const queryEnabled =
    (barState.period !== 'custom' || !!(barState.customFromDate && barState.customToDate)) &&
    !isDeptEmpty

  const { data, error, isPending } = useTaskHistory(listFilters, queryEnabled)
  const { data: analytics, isPending: analyticsPending } = useTaskHistoryAnalytics(
    analyticsFilters,
    queryEnabled
  )

  const handleApply = (next: TaskHistoryBarState) => {
    let out: TaskHistoryBarState = next
    if (next.period === 'custom' && (!next.customFromDate || !next.customToDate)) {
      const d = defaultCustomDateRange(userTimezone)
      out = {
        ...next,
        customFromDate: next.customFromDate || d.from,
        customToDate: next.customToDate || d.to,
      }
    }
    if (next.period !== 'custom') {
      out = { ...next, customFromDate: undefined, customToDate: undefined }
    }
    setSearchParams(writeTaskHistoryUrlState(new URLSearchParams(searchParams), out), {
      replace: true,
    })
    setPage(1)
  }

  const handleClear = () => {
    setSearchParams(
      writeTaskHistoryUrlState(new URLSearchParams(searchParams), TASK_HISTORY_FILTERS_DEFAULT),
      { replace: true }
    )
    setPage(1)
  }

  const handleSortChange = (sort: TaskHistorySort) => {
    setSearchParams(
      writeTaskHistoryUrlState(new URLSearchParams(searchParams), {
        ...barState,
        sort,
      }),
      { replace: true }
    )
    setPage(1)
  }

  const items = isDeptEmpty ? [] : (data?.items ?? [])
  const total = isDeptEmpty ? 0 : (data?.total ?? 0)
  const totalPages = Math.max(1, Math.ceil(total / pageSize))

  return (
    <div className="flex flex-col gap-4">
      <TaskHistoryAnalytics
        buckets={isDeptEmpty ? [] : (analytics?.buckets ?? [])}
        total={isDeptEmpty ? 0 : (analytics?.total ?? 0)}
        isLoading={queryEnabled && analyticsPending}
      />

      <TaskHistoryFiltersBar
        value={barState}
        operators={operators}
        subjects={subjects}
        onApply={handleApply}
        onClear={handleClear}
        userTimezone={userTimezone}
        scope={scoped}
      />

      <div className="text-foreground text-sm">
        <span className="font-medium">{total}</span>{' '}
        {t('pages.actionAnalysis.taskHistorySummary.total', 'tasks')}
      </div>

      {isDeptEmpty ? (
        <div className="border-border bg-muted text-foreground rounded-md border p-3 text-sm">
          {t(
            'pages.actionAnalysis.errors.departmentNoOperators',
            'No operators in this department for the current project.'
          )}
        </div>
      ) : error ? (
        <div className="border-error-200 bg-error-100 text-error-700 rounded-md border p-3 text-sm">
          {t('pages.actionAnalysis.errors.loadTaskHistoryFailed', 'Failed to load task history')}
        </div>
      ) : (
        <>
          {queryEnabled && isPending ? (
            <TableSkeleton columns={8} rows={pageSize} className="w-full" />
          ) : (
            <TaskHistoryTable
              data={items}
              userTimezone={userTimezone}
              sort={barState.sort}
              onSortChange={handleSortChange}
            />
          )}
          {total > pageSize && (
            <Pagination
              currentPage={page}
              totalPages={totalPages}
              pageSize={pageSize}
              onPageChange={setPage}
              onPageSizeChange={setPageSize}
            />
          )}
        </>
      )}
    </div>
  )
}

export default TaskHistoryTab
