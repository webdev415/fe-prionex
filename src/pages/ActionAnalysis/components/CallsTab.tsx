import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'
import { useAuthStore } from '@/stores/authStore'
import { useOperators } from '@/features/users/hooks'
import {
  useCallMonitoring,
  useExportCalls,
  type CallMonitoringFilters,
  type CallMonitoringItem,
  type CallMonitoringPeriod,
  type CallMonitoringOutcomeFilter,
} from '@/features/actionAnalysis'
import { Button } from '@/components/ui/Button'
import { Pagination } from '@/components/ui/Pagination'
import { Icons } from '@/lib/icons'
import { CallRecordingModal } from '@/pages/ClientManagement/components/CallRecordingModal'
import { formatDateTime } from '@/lib/formatters'
import { CallFiltersBar } from './CallFiltersBar'
import { CallsTable } from './CallsTable'
import { PhoneSearchPanel } from './PhoneSearchPanel'

const PAGE_SIZE = 20
const DEFAULT_PERIOD: CallMonitoringPeriod = 'last_7d'

function formatDuration(seconds: number | null | undefined): string {
  if (seconds == null) return '0:00'
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

function readFiltersFromUrl(params: URLSearchParams): CallMonitoringFilters {
  const ext = params.get('agent_extension') ?? params.get('employee_id')
  const period = (params.get('period') as CallMonitoringPeriod | null) ?? DEFAULT_PERIOD
  const status = (params.get('status') as CallMonitoringOutcomeFilter | null) ?? 'all'
  const min = params.get('min_duration')
  const max = params.get('max_duration')

  return {
    agent_extensions: ext ? [ext] : undefined,
    period,
    outcome_filter: status,
    min_duration: min ? Number(min) : undefined,
    max_duration: max ? Number(max) : undefined,
  }
}

function writeFiltersToUrl(
  params: URLSearchParams,
  filters: CallMonitoringFilters
): URLSearchParams {
  const next = new URLSearchParams(params)
  next.delete('agent_extension')
  next.delete('employee_id')
  next.delete('period')
  next.delete('status')
  next.delete('min_duration')
  next.delete('max_duration')

  const ext = filters.agent_extensions?.[0]
  if (ext) next.set('agent_extension', ext)
  if (filters.period && filters.period !== DEFAULT_PERIOD) next.set('period', filters.period)
  if (filters.outcome_filter && filters.outcome_filter !== 'all')
    next.set('status', filters.outcome_filter)
  if (filters.min_duration != null) next.set('min_duration', String(filters.min_duration))
  if (filters.max_duration != null) next.set('max_duration', String(filters.max_duration))
  return next
}

export function CallsTab() {
  const { t } = useTranslation('common')
  const [searchParams, setSearchParams] = useSearchParams()

  const activeProjectId = useAuthStore((s) => s.user?.active_project_id)
  const { data: operators = [] } = useOperators(
    activeProjectId ? Number(activeProjectId) : null
  )

  const filters = useMemo(() => readFiltersFromUrl(searchParams), [searchParams])

  const [page, setPage] = useState(1)

  const queryFilters: CallMonitoringFilters = {
    ...filters,
    sort: 'date_desc',
    limit: PAGE_SIZE,
    offset: (page - 1) * PAGE_SIZE,
  }
  const { data, isLoading, isFetching, error } = useCallMonitoring(queryFilters)

  const exportMutation = useExportCalls()

  const [recordingCall, setRecordingCall] = useState<CallMonitoringItem | null>(null)

  const handleFiltersChange = (next: Partial<CallMonitoringFilters>) => {
    const merged = { ...filters, ...next }
    setSearchParams(writeFiltersToUrl(searchParams, merged), { replace: true })
    setPage(1)
  }

  const handleExport = async () => {
    try {
      await exportMutation.mutateAsync(queryFilters)
    } catch (err) {
      console.error('Export failed:', err)
      toast.error(t('pages.actionAnalysis.errors.exportFailed', 'Export failed'))
    }
  }

  const operatorLookup = useMemo(() => {
    const byExt: Record<string, string> = {}
    for (const op of operators) {
      if (op.asterisk_extension) {
        byExt[op.asterisk_extension] = op.full_name
      }
    }
    return byExt
  }, [operators])

  const summary = data?.summary
  const calls = data?.calls ?? []
  const total = data?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-lg border border-gray-200 bg-white p-4">
        <CallFiltersBar
          filters={filters}
          operators={operators}
          onChange={handleFiltersChange}
        />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-4 text-sm text-gray-700">
          <span>
            <span className="font-medium">{summary?.total_calls ?? 0}</span>{' '}
            {t('pages.actionAnalysis.summary.total', 'total')}
          </span>
          <span>
            <span className="font-medium">{summary?.outgoing_calls ?? 0}</span>{' '}
            {t('pages.actionAnalysis.summary.outgoing', 'outgoing')}
          </span>
          <span>
            <span className="font-medium">{summary?.answered_calls ?? 0}</span>{' '}
            {t('pages.actionAnalysis.summary.answered', 'answered')}
          </span>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleExport}
          disabled={exportMutation.isPending || isLoading}
        >
          <Icons.FileDownload size={16} strokeWidth={1.5} />
          {exportMutation.isPending
            ? t('pages.actionAnalysis.actions.exporting', 'Exporting…')
            : t('pages.actionAnalysis.actions.exportExcel', 'Export to Excel')}
        </Button>
      </div>

      {error ? (
        <div className="rounded-md border border-error-200 bg-error-50 p-3 text-sm text-error-700">
          {t('pages.actionAnalysis.errors.loadFailed', 'Failed to load calls')}
        </div>
      ) : (
        <>
          <CallsTable
            data={calls}
            loading={isFetching}
            onPlayRecording={setRecordingCall}
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

      <PhoneSearchPanel onPlayRecording={setRecordingCall} />

      {recordingCall && (
        <CallRecordingModal
          open={true}
          onClose={() => setRecordingCall(null)}
          callData={{
            type: recordingCall.direction ?? 'call',
            clientName: recordingCall.client_id ? `#${recordingCall.client_id}` : '',
            date: formatDateTime(recordingCall.initiated_at).split(' ')[0] ?? '',
            time: formatDateTime(recordingCall.initiated_at).split(' ')[1] ?? '',
            operator:
              operatorLookup[recordingCall.agent_extension] ?? recordingCall.agent_extension,
            duration: formatDuration(recordingCall.talk_duration),
            phone: recordingCall.customer_number,
            call_id: recordingCall.call_id,
          }}
        />
      )}
    </div>
  )
}

export default CallsTab
