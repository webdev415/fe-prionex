import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useSearchParams } from 'react-router-dom'
import { useAuthStore } from '@/stores/authStore'
import { useOperators } from '@/features/users/hooks'
import { useTAChains } from '@/features/taChains/hooks/useTAChains'
import { useTargetActions } from '@/features/targetActions/hooks/useTargetActions'
import type { TargetAction } from '@/features/targetActions/api/types'
import { useTaHistory } from '@/features/training'
import { Pagination } from '@/components/ui/Pagination'
import { TableSkeleton } from '@/components/ui/TableSkeleton'
import { defaultCustomDateRange } from '../lib/dateRange'
import {
  TA_HISTORY_FILTERS_DEFAULT,
  readTaHistoryUrlState,
  writeTaHistoryUrlState,
  toTaHistoryQuery,
  type TaHistoryBarState,
} from '../lib/taHistoryUrlState'
import { useScopedUserIds } from '../lib/scope'
import { TaHistoryFiltersBar } from './TaHistoryFiltersBar'
import { TaHistoryTable } from './TaHistoryTable'

export function TaHistoryTab() {
  const { t } = useTranslation('common')
  const [searchParams, setSearchParams] = useSearchParams()

  const activeProjectId = useAuthStore((s) => s.user?.active_project_id)
  const userTimezone = useAuthStore((s) => s.user?.timezone)
  const { data: operators = [] } = useOperators(activeProjectId ? Number(activeProjectId) : null, {
    includeInactive: true,
  })
  const { data: chainsResp } = useTAChains({ include_inactive: true })
  const chains = useMemo(() => chainsResp?.items ?? [], [chainsResp])
  const { data: tasResp } = useTargetActions({ include_hidden: true })
  const tasById = useMemo(() => {
    const m = new Map<number, TargetAction>()
    for (const ta of tasResp?.items ?? []) m.set(ta.id, ta)
    return m
  }, [tasResp])

  const barState = useMemo(() => readTaHistoryUrlState(searchParams), [searchParams])

  useEffect(() => {
    if (searchParams.get('period') !== 'custom') return
    if (searchParams.get('from_date') && searchParams.get('to_date')) return
    const s = readTaHistoryUrlState(searchParams)
    const d = defaultCustomDateRange(userTimezone)
    setSearchParams(
      writeTaHistoryUrlState(new URLSearchParams(searchParams), {
        ...s,
        customFromDate: d.from,
        customToDate: d.to,
      }),
      { replace: true }
    )
  }, [searchParams, setSearchParams, userTimezone])

  const scoped = useScopedUserIds(operators)

  const recordedByIn = useMemo<number[] | undefined>(() => {
    // Tab-level Department picker still refines within scope when scope=all.
    if (barState.departmentId != null) {
      const ids = operators
        .filter((o) => o.department_id === barState.departmentId)
        .map((o) => o.id)
      const intersected =
        scoped.userIds == null ? ids : ids.filter((id) => scoped.userIds!.includes(id))
      return intersected.length ? intersected : undefined
    }
    if (barState.employeeIds.length > 0) {
      if (scoped.userIds == null) return barState.employeeIds
      const scopeSet = new Set(scoped.userIds)
      const intersected = barState.employeeIds.filter((id) => scopeSet.has(id))
      return intersected.length ? intersected : undefined
    }
    return scoped.userIds && scoped.userIds.length > 0 ? scoped.userIds : undefined
  }, [barState.departmentId, barState.employeeIds, operators, scoped.userIds])

  const isDeptEmpty =
    (barState.departmentId != null || scoped.isEmptyResolution) &&
    (recordedByIn == null || recordedByIn.length === 0)

  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)

  const queryFilters = useMemo(
    () => ({
      ...toTaHistoryQuery(barState, recordedByIn),
      skip: (page - 1) * pageSize,
      limit: pageSize,
    }),
    [barState, recordedByIn, page, pageSize]
  )

  const queryEnabled =
    (barState.period !== 'custom' || !!(barState.customFromDate && barState.customToDate)) &&
    !isDeptEmpty

  const { data, error, isPending } = useTaHistory(queryFilters, queryEnabled)

  const handleApply = (next: TaHistoryBarState) => {
    let out: TaHistoryBarState = next
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
    setSearchParams(writeTaHistoryUrlState(new URLSearchParams(searchParams), out), {
      replace: true,
    })
    setPage(1)
  }

  const handleClear = () => {
    setSearchParams(
      writeTaHistoryUrlState(new URLSearchParams(searchParams), TA_HISTORY_FILTERS_DEFAULT),
      { replace: true }
    )
    setPage(1)
  }

  const items = isDeptEmpty ? [] : (data?.items ?? [])
  const total = isDeptEmpty ? 0 : (data?.total_count ?? 0)
  const totalPages = Math.max(1, Math.ceil(total / pageSize))

  return (
    <div className="flex flex-col gap-4">
      <TaHistoryFiltersBar
        value={barState}
        operators={operators}
        chains={chains}
        tasById={tasById}
        onApply={handleApply}
        onClear={handleClear}
        userTimezone={userTimezone}
        scope={scoped}
      />

      <div className="text-sm text-gray-700">
        <span className="font-medium">{total}</span>{' '}
        {t('pages.training.summary.totalInteractions', 'interactions')}
      </div>

      {isDeptEmpty ? (
        <div className="rounded-md border border-gray-200 bg-gray-50 p-3 text-sm text-gray-700">
          {t(
            'pages.training.errors.departmentNoOperators',
            'No operators in this department for the current project.'
          )}
        </div>
      ) : error ? (
        <div className="border-error-200 bg-error-50 text-error-700 rounded-md border p-3 text-sm">
          {t('pages.training.errors.loadTaHistoryFailed', 'Failed to load TA history')}
        </div>
      ) : (
        <>
          {queryEnabled && isPending ? (
            <TableSkeleton columns={8} rows={pageSize} className="w-full" />
          ) : (
            <TaHistoryTable
              data={items}
              chains={chains}
              tasById={tasById}
              userTimezone={userTimezone}
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

export default TaHistoryTab
