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

  // Department picker resolves to a user_id list on the frontend (same as
  // TaHistoryTab) — keeps the backend filter shape uniform.
  const assignedToUserIds = useMemo<number[] | undefined>(() => {
    if (barState.departmentId != null) {
      const ids = operators
        .filter((o) => o.department_id === barState.departmentId)
        .map((o) => o.id)
      return ids.length ? ids : []
    }
    if (barState.employeeIds.length > 0) return barState.employeeIds
    return undefined
  }, [barState.departmentId, barState.employeeIds, operators])

  const isDeptEmpty =
    barState.departmentId != null && (assignedToUserIds == null || assignedToUserIds.length === 0)

  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)

  const listFilters = useMemo(
    () => ({
      ...toTaskHistoryQuery(barState, assignedToUserIds),
      skip: (page - 1) * pageSize,
      limit: pageSize,
    }),
    [barState, assignedToUserIds, page, pageSize]
  )

  const analyticsFilters = useMemo(
    () => toTaskHistoryAnalyticsQuery(barState, assignedToUserIds),
    [barState, assignedToUserIds]
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
      />

      <div className="text-sm text-gray-700">
        <span className="font-medium">{total}</span>{' '}
        {t('pages.actionAnalysis.taskHistorySummary.total', 'tasks')}
      </div>

      {isDeptEmpty ? (
        <div className="rounded-md border border-gray-200 bg-gray-50 p-3 text-sm text-gray-700">
          {t(
            'pages.actionAnalysis.errors.departmentNoOperators',
            'No operators in this department for the current project.'
          )}
        </div>
      ) : error ? (
        <div className="border-error-200 bg-error-50 text-error-700 rounded-md border p-3 text-sm">
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
