import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useSearchParams } from 'react-router-dom'
import { useAuthStore } from '@/stores/authStore'
import { useOperators } from '@/features/users/hooks'
import {
  useInteractionContactTypes,
  useInteractionResults,
} from '@/features/clients/hooks/useNoteInteraction'
import {
  useInteractionMonitoring,
  type InteractionMonitoringFilters,
  type InteractionMonitoringSortBy,
  type InteractionMonitoringSortDir,
} from '@/features/actionAnalysis'
import { Pagination } from '@/components/ui/Pagination'
import { defaultCustomDateRange } from '../lib/dateRange'
import {
  INTERACTION_FILTERS_DEFAULT,
  readInteractionBarState,
  writeInteractionBarState,
  toInteractionMonitoringQuery,
  resolveInteractionUsers,
  type InteractionBarState,
} from '../lib/interactionsUrlState'
import { InteractionFiltersBar } from './InteractionFiltersBar'
import { InteractionHistoryTable } from './InteractionHistoryTable'

const PAGE_SIZE = 20

export function InteractionHistoryTab() {
  const { t } = useTranslation('common')
  const [searchParams, setSearchParams] = useSearchParams()

  const activeProjectId = useAuthStore((s) => s.user?.active_project_id)
  const userTimezone = useAuthStore((s) => s.user?.timezone)
  const { data: operators = [] } = useOperators(activeProjectId ? Number(activeProjectId) : null)
  const { data: contactTypes = [] } = useInteractionContactTypes()
  const { data: results = [] } = useInteractionResults()

  const barState = useMemo(() => readInteractionBarState(searchParams), [searchParams])

  useEffect(() => {
    if (searchParams.get('period') !== 'custom') return
    if (searchParams.get('from_date') && searchParams.get('to_date')) return
    const s = readInteractionBarState(searchParams)
    const d = defaultCustomDateRange(userTimezone)
    setSearchParams(
      writeInteractionBarState(new URLSearchParams(searchParams), {
        ...s,
        customFromDate: d.from,
        customToDate: d.to,
      }),
      { replace: true }
    )
  }, [searchParams, setSearchParams, userTimezone])

  const resolvedUsers = useMemo(
    () => resolveInteractionUsers(barState, operators),
    [barState, operators]
  )

  const [page, setPage] = useState(1)

  const queryFilters: InteractionMonitoringFilters = useMemo(() => {
    const base = toInteractionMonitoringQuery(barState, operators)
    return {
      ...base,
      page,
      page_size: PAGE_SIZE,
    }
  }, [barState, operators, page])

  const queryEnabled =
    (barState.period !== 'custom' || !!(barState.customFromDate && barState.customToDate)) &&
    resolvedUsers.kind !== 'empty'

  const { data, error } = useInteractionMonitoring(queryFilters, queryEnabled)

  const handleApply = (next: InteractionBarState) => {
    let out: InteractionBarState = next
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
    setSearchParams(writeInteractionBarState(new URLSearchParams(searchParams), out), {
      replace: true,
    })
    setPage(1)
  }

  const handleClear = () => {
    setSearchParams(
      writeInteractionBarState(new URLSearchParams(searchParams), INTERACTION_FILTERS_DEFAULT),
      { replace: true }
    )
    setPage(1)
  }

  const handleSortChange = (
    sortBy: InteractionMonitoringSortBy,
    sortDir: InteractionMonitoringSortDir
  ) => {
    // Sort changes commit immediately (no Apply step) — clicking a column
    // header is meant as a one-click reorder, not a draft edit.
    setSearchParams(
      writeInteractionBarState(new URLSearchParams(searchParams), {
        ...barState,
        sort_by: sortBy,
        sort_dir: sortDir,
      }),
      { replace: true }
    )
    setPage(1)
  }

  const items = resolvedUsers.kind === 'empty' ? [] : (data?.items ?? [])
  const total = resolvedUsers.kind === 'empty' ? 0 : (data?.total ?? 0)
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  const emptyDeptMessage = resolvedUsers.kind === 'empty'

  return (
    <div className="flex flex-col gap-4">
      <InteractionFiltersBar
        value={barState}
        operators={operators}
        results={results}
        contactTypes={contactTypes}
        onApply={handleApply}
        onClear={handleClear}
        userTimezone={userTimezone}
      />

      <div className="text-sm text-gray-700">
        <span className="font-medium">{total}</span>{' '}
        {t('pages.actionAnalysis.summary.totalInteractions', 'interactions')}
      </div>

      {emptyDeptMessage ? (
        <div className="rounded-md border border-gray-200 bg-gray-50 p-3 text-sm text-gray-700">
          {t(
            'pages.actionAnalysis.errors.departmentNoOperators',
            'No operators in this department for the current project.'
          )}
        </div>
      ) : error ? (
        <div className="border-error-200 bg-error-50 text-error-700 rounded-md border p-3 text-sm">
          {t('pages.actionAnalysis.errors.loadInteractionsFailed', 'Failed to load interactions')}
        </div>
      ) : (
        <>
          <InteractionHistoryTable
            data={items}
            sortBy={barState.sort_by ?? 'date'}
            sortDir={barState.sort_dir ?? 'desc'}
            onSortChange={handleSortChange}
          />
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

export default InteractionHistoryTab
