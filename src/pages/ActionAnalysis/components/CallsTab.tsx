import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useSearchParams } from 'react-router-dom'
import { useAuthStore } from '@/stores/authStore'
import { useOperators } from '@/features/users/hooks'
import {
  useCallMonitoring,
  type CallMonitoringFilters,
  type CallMonitoringItem,
} from '@/features/actionAnalysis'
import { Pagination } from '@/components/ui/Pagination'
import { CallRecordingModal } from '@/pages/ClientManagement/components/CallRecordingModal'
import { formatDateTime } from '@/lib/formatters'
import { defaultCustomDateRange } from '../lib/dateRange'
import { readCallsUrlState, writeCallsUrlState, toCallMonitoringQuery } from '../lib/callsUrlState'
import type { CallFiltersBarValue } from './CallFiltersBar'
import { CallFiltersBar } from './CallFiltersBar'
import { CallsTable } from './CallsTable'
import { PhoneSearchPanel } from './PhoneSearchPanel'

const PAGE_SIZE = 20

function formatDuration(seconds: number | null | undefined): string {
  if (seconds == null) return '0:00'
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

export function CallsTab() {
  const { t } = useTranslation('common')
  const [searchParams, setSearchParams] = useSearchParams()

  const activeProjectId = useAuthStore((s) => s.user?.active_project_id)
  const userTimezone = useAuthStore((s) => s.user?.timezone)
  const { data: operators = [] } = useOperators(activeProjectId ? Number(activeProjectId) : null)

  const barState = useMemo(() => readCallsUrlState(searchParams), [searchParams])

  useEffect(() => {
    if (searchParams.get('period') !== 'custom') return
    if (searchParams.get('from_date') && searchParams.get('to_date')) return
    const s = readCallsUrlState(searchParams)
    const d = defaultCustomDateRange(userTimezone)
    setSearchParams(
      writeCallsUrlState(new URLSearchParams(searchParams), {
        ...s,
        customFromDate: d.from,
        customToDate: d.to,
      }),
      { replace: true }
    )
  }, [searchParams, setSearchParams, userTimezone])

  const apiFiltersBase = useMemo(() => toCallMonitoringQuery(barState), [barState])

  const [page, setPage] = useState(1)

  const callsQueryEnabled =
    barState.period !== 'custom' || !!(barState.customFromDate && barState.customToDate)

  const queryFilters: CallMonitoringFilters = {
    ...apiFiltersBase,
    sort: 'date_desc',
    limit: PAGE_SIZE,
    offset: (page - 1) * PAGE_SIZE,
  }
  const { data, isFetching, error } = useCallMonitoring(queryFilters, callsQueryEnabled)

  const [recordingCall, setRecordingCall] = useState<CallMonitoringItem | null>(null)

  const handleFiltersChange = (next: Partial<CallFiltersBarValue>) => {
    const merged: CallFiltersBarValue = { ...barState, ...next }
    let out: CallFiltersBarValue = merged
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
    setSearchParams(writeCallsUrlState(new URLSearchParams(searchParams), out), { replace: true })
    setPage(1)
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
      <CallFiltersBar
        filters={barState}
        operators={operators}
        onChange={handleFiltersChange}
        userTimezone={userTimezone}
      />

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

      {error ? (
        <div className="border-error-200 bg-error-50 text-error-700 rounded-md border p-3 text-sm">
          {t('pages.actionAnalysis.errors.loadFailed', 'Failed to load calls')}
        </div>
      ) : (
        <>
          <CallsTable data={calls} loading={isFetching} onPlayRecording={setRecordingCall} />
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
