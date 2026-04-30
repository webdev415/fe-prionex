import { useMemo, useState } from 'react'
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
  type CallMonitoringPeriod,
} from '@/features/actionAnalysis'
import { Button } from '@/components/ui/Button'
import { Pagination } from '@/components/ui/Pagination'
import { Icons } from '@/lib/icons'
import { InteractionFiltersBar } from './InteractionFiltersBar'
import { InteractionHistoryTable } from './InteractionHistoryTable'

const PAGE_SIZE = 20
const DEFAULT_PERIOD: CallMonitoringPeriod = 'last_7d'
const DEFAULT_SORT_BY: InteractionMonitoringSortBy = 'date'
const DEFAULT_SORT_DIR: InteractionMonitoringSortDir = 'desc'

function readFiltersFromUrl(params: URLSearchParams): InteractionMonitoringFilters {
  const userId = params.get('employee_id')
  const period = (params.get('period') as CallMonitoringPeriod | null) ?? DEFAULT_PERIOD
  const resultId = params.get('result_id')
  const contactTypeId = params.get('contact_type_id')
  const promiseMin = params.get('promise_min')
  const promiseMax = params.get('promise_max')
  const sortBy = (params.get('sort_by') as InteractionMonitoringSortBy | null) ?? DEFAULT_SORT_BY
  const sortDir = (params.get('sort_dir') as InteractionMonitoringSortDir | null) ?? DEFAULT_SORT_DIR

  return {
    user_ids: userId ? [Number(userId)] : undefined,
    period,
    result_ids: resultId ? [Number(resultId)] : undefined,
    contact_type_ids: contactTypeId ? [Number(contactTypeId)] : undefined,
    promise_amount_min: promiseMin ? Number(promiseMin) : undefined,
    promise_amount_max: promiseMax ? Number(promiseMax) : undefined,
    sort_by: sortBy,
    sort_dir: sortDir,
  }
}

function writeFiltersToUrl(
  base: URLSearchParams,
  filters: InteractionMonitoringFilters
): URLSearchParams {
  const next = new URLSearchParams(base)
  next.delete('employee_id')
  next.delete('period')
  next.delete('result_id')
  next.delete('contact_type_id')
  next.delete('promise_min')
  next.delete('promise_max')
  next.delete('sort_by')
  next.delete('sort_dir')

  const userId = filters.user_ids?.[0]
  if (userId) next.set('employee_id', String(userId))
  if (filters.period && filters.period !== DEFAULT_PERIOD) next.set('period', filters.period)
  const resultId = filters.result_ids?.[0]
  if (resultId) next.set('result_id', String(resultId))
  const contactTypeId = filters.contact_type_ids?.[0]
  if (contactTypeId) next.set('contact_type_id', String(contactTypeId))
  if (filters.promise_amount_min != null)
    next.set('promise_min', String(filters.promise_amount_min))
  if (filters.promise_amount_max != null)
    next.set('promise_max', String(filters.promise_amount_max))
  if (filters.sort_by && filters.sort_by !== DEFAULT_SORT_BY)
    next.set('sort_by', filters.sort_by)
  if (filters.sort_dir && filters.sort_dir !== DEFAULT_SORT_DIR)
    next.set('sort_dir', filters.sort_dir)
  return next
}

export function InteractionHistoryTab() {
  const { t } = useTranslation('common')
  const [searchParams, setSearchParams] = useSearchParams()

  const activeProjectId = useAuthStore((s) => s.user?.active_project_id)
  const { data: operators = [] } = useOperators(
    activeProjectId ? Number(activeProjectId) : null
  )
  const { data: contactTypes = [] } = useInteractionContactTypes()
  const { data: results = [] } = useInteractionResults()

  const filters = useMemo(() => readFiltersFromUrl(searchParams), [searchParams])
  const [page, setPage] = useState(1)

  const queryFilters: InteractionMonitoringFilters = {
    ...filters,
    page,
    page_size: PAGE_SIZE,
  }
  const { data, isFetching, error } = useInteractionMonitoring(queryFilters)

  const exportMutation = useExportInteractions()

  const handleFiltersChange = (next: Partial<InteractionMonitoringFilters>) => {
    const merged = { ...filters, ...next }
    setSearchParams(writeFiltersToUrl(searchParams, merged), { replace: true })
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
      await exportMutation.mutateAsync(queryFilters)
    } catch (err) {
      console.error('Interaction export failed:', err)
      toast.error(t('pages.actionAnalysis.errors.exportFailed', 'Export failed'))
    }
  }

  const items = data?.items ?? []
  const total = data?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-lg border border-gray-200 bg-white p-4">
        <InteractionFiltersBar
          filters={filters}
          operators={operators}
          results={results}
          contactTypes={contactTypes}
          onChange={handleFiltersChange}
        />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="text-sm text-gray-700">
          <span className="font-medium">{total}</span>{' '}
          {t('pages.actionAnalysis.summary.totalInteractions', 'interactions')}
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleExport}
          disabled={exportMutation.isPending || isFetching}
        >
          <Icons.FileDownload size={16} strokeWidth={1.5} />
          {exportMutation.isPending
            ? t('pages.actionAnalysis.actions.exporting', 'Exporting…')
            : t('pages.actionAnalysis.actions.exportExcel', 'Export to Excel')}
        </Button>
      </div>

      {error ? (
        <div className="rounded-md border border-error-200 bg-error-50 p-3 text-sm text-error-700">
          {t('pages.actionAnalysis.errors.loadInteractionsFailed', 'Failed to load interactions')}
        </div>
      ) : (
        <>
          <InteractionHistoryTable
            data={items}
            sortBy={filters.sort_by ?? DEFAULT_SORT_BY}
            sortDir={filters.sort_dir ?? DEFAULT_SORT_DIR}
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
