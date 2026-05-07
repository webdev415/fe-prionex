import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useSearchParams } from 'react-router-dom'
import { useAuthStore } from '@/stores/authStore'
import { useOperators } from '@/features/users/hooks'
import { useTAChains } from '@/features/taChains/hooks/useTAChains'
import { useTaHistory } from '@/features/actionAnalysis'
import { Pagination } from '@/components/ui/Pagination'
import { defaultCustomDateRange } from '../lib/dateRange'
import {
  TA_HISTORY_FILTERS_DEFAULT,
  readTaHistoryUrlState,
  writeTaHistoryUrlState,
  toTaHistoryQuery,
  type TaHistoryBarState,
} from '../lib/taHistoryUrlState'
import { TaHistoryFiltersBar } from './TaHistoryFiltersBar'
import { TaHistoryTable } from './TaHistoryTable'

const PAGE_SIZE = 20

export function TaHistoryTab() {
  const { t } = useTranslation('common')
  const [searchParams, setSearchParams] = useSearchParams()

  const activeProjectId = useAuthStore((s) => s.user?.active_project_id)
  const userTimezone = useAuthStore((s) => s.user?.timezone)
  const { data: operators = [] } = useOperators(activeProjectId ? Number(activeProjectId) : null)
  const { data: chainsResp } = useTAChains({ include_inactive: true })
  const chains = useMemo(() => chainsResp?.items ?? [], [chainsResp])

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

  const recordedByIn = useMemo<number[] | undefined>(() => {
    if (barState.departmentId != null) {
      const ids = operators
        .filter((o) => o.department_id === barState.departmentId)
        .map((o) => o.id)
      return ids.length ? ids : undefined
    }
    if (barState.employeeIds.length > 0) return barState.employeeIds
    return undefined
  }, [barState.departmentId, barState.employeeIds, operators])

  const isDeptEmpty =
    barState.departmentId != null && (recordedByIn == null || recordedByIn.length === 0)

  const [page, setPage] = useState(1)

  const queryFilters = useMemo(
    () => ({
      ...toTaHistoryQuery(barState, recordedByIn),
      skip: (page - 1) * PAGE_SIZE,
      limit: PAGE_SIZE,
    }),
    [barState, recordedByIn, page]
  )

  const queryEnabled =
    (barState.period !== 'custom' || !!(barState.customFromDate && barState.customToDate)) &&
    !isDeptEmpty

  const { data, error } = useTaHistory(queryFilters, queryEnabled)

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
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  return (
    <div className="flex flex-col gap-4">
      <TaHistoryFiltersBar
        value={barState}
        operators={operators}
        chains={chains}
        onApply={handleApply}
        onClear={handleClear}
        userTimezone={userTimezone}
      />

      <div className="text-sm text-gray-700">
        <span className="font-medium">{total}</span>{' '}
        {t('pages.actionAnalysis.summary.totalInteractions', 'interactions')}
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
          {t('pages.actionAnalysis.errors.loadTaHistoryFailed', 'Failed to load TA history')}
        </div>
      ) : (
        <>
          <TaHistoryTable data={items} />
          {total > PAGE_SIZE && (
            <Pagination
              currentPage={page}
              totalPages={totalPages}
              pageSize={PAGE_SIZE}
              onPageChange={setPage}
              onPageSizeChange={() => {}}
            />
          )}
        </>
      )}
    </div>
  )
}

export default TaHistoryTab
