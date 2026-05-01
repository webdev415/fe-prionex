import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'
import { useAuthStore } from '@/stores/authStore'
import { useOperators } from '@/features/users/hooks'
import {
  useInteractionContactTypes,
  useInteractionResults,
} from '@/features/clients/hooks/useNoteInteraction'
import {
  useInteractionMonitoring,
  useExportInteractions,
  type InteractionMonitoringFilters,
  type InteractionMonitoringSortBy,
  type InteractionMonitoringSortDir,
} from '@/features/actionAnalysis'
import { Button } from '@/components/ui/Button'
import { Pagination } from '@/components/ui/Pagination'
import { Icons } from '@/lib/icons'
import { defaultCustomDateRange } from '../lib/dateRange'
import {
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

  const { data, isFetching, error } = useInteractionMonitoring(queryFilters, queryEnabled)

  const exportMutation = useExportInteractions()

  const handleFiltersChange = (next: Partial<InteractionBarState>) => {
    const merged: InteractionBarState = { ...barState, ...next }
    let out: InteractionBarState = merged
    if (merged.period === 'custom' && (!merged.customFromDate || !merged.customToDate)) {
      const d = defaultCustomDateRange(userTimezone)
      out = {
        ...merged,
        customFromDate: merged.customFromDate || d.from,
        customToDate: merged.customToDate || d.to,
      }
    }
    if (merged.period !== 'custom') {
      out = {
        ...merged,
        customFromDate: undefined,
        customToDate: undefined,
      }
    }
    setSearchParams(writeInteractionBarState(new URLSearchParams(searchParams), out), {
      replace: true,
    })
    setPage(1)
  }

  const handleSortChange = (
    sortBy: InteractionMonitoringSortBy,
    sortDir: InteractionMonitoringSortDir
  ) => {
    handleFiltersChange({ sort_by: sortBy, sort_dir: sortDir })
  }

  const handleExport = async () => {
    try {
      const exportPayload = toInteractionMonitoringQuery(barState, operators)
      await exportMutation.mutateAsync(exportPayload)
    } catch (err) {
      console.error('Interaction export failed:', err)
      toast.error(t('pages.actionAnalysis.errors.exportFailed', 'Export failed'))
    }
  }

  const items = resolvedUsers.kind === 'empty' ? [] : (data?.items ?? [])
  const total = resolvedUsers.kind === 'empty' ? 0 : (data?.total ?? 0)
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  const emptyDeptMessage = resolvedUsers.kind === 'empty'

  return (
    <div className="flex flex-col gap-4">
      <InteractionFiltersBar
        state={barState}
        operators={operators}
        results={results}
        contactTypes={contactTypes}
        onChange={handleFiltersChange}
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="text-sm text-gray-700">
          <span className="font-medium">{total}</span>{' '}
          {t('pages.actionAnalysis.summary.totalInteractions', 'interactions')}
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleExport}
          disabled={exportMutation.isPending || isFetching || !queryEnabled}
        >
          <Icons.FileDownload size={16} strokeWidth={1.5} />
          {exportMutation.isPending
            ? t('pages.actionAnalysis.actions.exporting', 'Exporting…')
            : t('pages.actionAnalysis.actions.exportExcel', 'Export to Excel')}
        </Button>
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
