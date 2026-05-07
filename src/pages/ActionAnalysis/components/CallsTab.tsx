import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'
import { useAuthStore } from '@/stores/authStore'
import { useOperators } from '@/features/users/hooks'
import {
  useCallMonitoring,
  type CallMonitoringFilters,
  type CallMonitoringItem,
} from '@/features/actionAnalysis'
import { useCallDetail } from '@/features/calls/hooks/useCall'
import { Pagination } from '@/components/ui/Pagination'
import { CallRecordingModal } from '@/pages/ClientManagement/components/CallRecordingModal'
import { defaultCustomDateRange } from '../lib/dateRange'
import {
  CALL_FILTERS_DEFAULT,
  readCallsUrlState,
  writeCallsUrlState,
  toCallMonitoringQuery,
} from '../lib/callsUrlState'
import type { CallFiltersBarValue } from './CallFiltersBar'
import { CallFiltersBar } from './CallFiltersBar'
import { CallsTable } from './CallsTable'

/**
 * Lightweight superset of fields used to seed the recording modal. Both
 * `CallMonitoringItem` (the table-row payload) and the deep-link single
 * fetch payload (`CallDetailResponse`) satisfy this shape.
 */
interface CallSeed {
  call_id: string
  agent_extension: string
  customer_number: string
  direction?: string | null
  initiated_at: string
  talk_duration?: number | null
  client_id?: number | null
}

const PAGE_SIZE = 20
const CALL_ID_PARAM = 'call_id'

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

  // Modal state lives entirely in the URL (?call_id=…) so deep-links work:
  // pasting the URL into another browser opens the modal with that exact call.
  const selectedCallId = searchParams.get(CALL_ID_PARAM)
  const calls = useMemo(() => data?.calls ?? [], [data?.calls])
  const callFromList = useMemo<CallMonitoringItem | null>(
    () => (selectedCallId ? (calls.find((c) => c.call_id === selectedCallId) ?? null) : null),
    [selectedCallId, calls]
  )

  // Deep-link fallback: when the URL references a call that isn't in the
  // current page (different filters / different page / fresh tab), fetch it
  // directly from the call-service. The modal still opens with whatever
  // fields the single-fetch endpoint returns.
  const needsFallbackFetch = !!selectedCallId && !callFromList
  const {
    data: fetchedDetail,
    isFetching: isFetchingDetail,
    isError: detailFetchError,
  } = useCallDetail(needsFallbackFetch ? selectedCallId : null)

  const detailForModal = useMemo<CallSeed | null>(() => {
    if (callFromList) return callFromList
    if (fetchedDetail) {
      return {
        call_id: fetchedDetail.call_id,
        agent_extension: fetchedDetail.agent_extension,
        customer_number: fetchedDetail.customer_number,
        direction: null,
        initiated_at: fetchedDetail.initiated_at,
        talk_duration: fetchedDetail.talk_duration ?? null,
        client_id: null,
      }
    }
    return null
  }, [callFromList, fetchedDetail])

  const isModalOpen = !!selectedCallId && (!!callFromList || !!fetchedDetail || isFetchingDetail)

  // Stale or invalid `call_id` in the URL (deleted call, wrong project,
  // malformed UUID): show a toast and strip the param so the page reverts
  // to the filter view rather than leaving the user staring at an inert URL.
  useEffect(() => {
    if (!detailFetchError) return
    if (!selectedCallId || callFromList) return
    toast.error(t('pages.actionAnalysis.errors.callNotFound', 'Call not found'))
    const next = new URLSearchParams(searchParams)
    next.delete(CALL_ID_PARAM)
    setSearchParams(next, { replace: true })
  }, [detailFetchError, selectedCallId, callFromList, searchParams, setSearchParams, t])

  const handleOpenCall = (call: CallMonitoringItem) => {
    const next = new URLSearchParams(searchParams)
    next.set(CALL_ID_PARAM, call.call_id)
    setSearchParams(next, { replace: false })
  }

  const handleCloseCall = () => {
    const next = new URLSearchParams(searchParams)
    next.delete(CALL_ID_PARAM)
    setSearchParams(next, { replace: false })
  }

  const handleApply = (next: CallFiltersBarValue) => {
    let out: CallFiltersBarValue = next
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
    setSearchParams(writeCallsUrlState(new URLSearchParams(searchParams), out), { replace: true })
    setPage(1)
  }

  const handleClear = () => {
    setSearchParams(writeCallsUrlState(new URLSearchParams(searchParams), CALL_FILTERS_DEFAULT), {
      replace: true,
    })
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
  const total = data?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  // Modal feed: prefer the row from the listing (richer fields like client_id
  // and direction), fall back to the single-fetch when deep-linked.
  //
  // Notes on the shape we hand to `CallRecordingModal`:
  //   - `type` is localized here ("Outgoing"/"Incoming"/"Call") so the modal
  //     title doesn't render the raw `direction` string.
  //   - `date` is the raw ISO so the modal's `new Date(dateStr)` parses cleanly
  //     and renders e.g. "April 28, 2026 16:39" instead of the previous
  //     "undefined NaN, NaN 16:39" caused by feeding it `DD-MM-YYYY`.
  //   - `clientId` enables the modal's clientName→client-page link for the
  //     trainer flow without affecting operator-side call sites.
  const modalCallData = useMemo(() => {
    if (!detailForModal) return null
    const dt = new Date(detailForModal.initiated_at)
    const time = Number.isFinite(dt.getTime())
      ? `${String(dt.getHours()).padStart(2, '0')}:${String(dt.getMinutes()).padStart(2, '0')}`
      : ''
    const isInbound = detailForModal.direction === 'inbound'
    const localizedType = detailForModal.direction
      ? isInbound
        ? t('pages.actionAnalysis.callType.incoming', 'Incoming')
        : t('pages.actionAnalysis.callType.outgoing', 'Outgoing')
      : t('pages.clients.modals.callRecording.title', 'Call')
    return {
      type: localizedType,
      clientName: detailForModal.client_id ? `#${detailForModal.client_id}` : '',
      date: detailForModal.initiated_at,
      time,
      operator: operatorLookup[detailForModal.agent_extension] ?? detailForModal.agent_extension,
      duration: formatDuration(detailForModal.talk_duration),
      phone: detailForModal.customer_number,
      call_id: detailForModal.call_id,
      clientId: detailForModal.client_id ?? null,
    }
  }, [detailForModal, operatorLookup, t])

  return (
    <div className="flex flex-col gap-4">
      <CallFiltersBar
        value={barState}
        operators={operators}
        onApply={handleApply}
        onClear={handleClear}
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
          <CallsTable data={calls} loading={isFetching} onOpenCall={handleOpenCall} />
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

      {isModalOpen && modalCallData && (
        <CallRecordingModal open={true} onClose={handleCloseCall} callData={modalCallData} />
      )}
    </div>
  )
}

export default CallsTab
