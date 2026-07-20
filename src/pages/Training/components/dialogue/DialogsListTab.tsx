import { useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Pagination } from '@/components/ui/Pagination'
import { useConfirm } from '@/components/ui/useConfirm'
import { useDebounce } from '@/hooks/useDebounce'
import { useAuthStore } from '@/stores/authStore'
import { useOperators } from '@/features/users/hooks'
import { useCallMonitoring } from '@/features/training'
import type { CallMonitoringItem, TelephonyType } from '@/features/training'
import { useScorecards, useDeleteScorecard, useScorecardStatusByCalls } from '@/features/quality'
import type { CallScorecardStatus } from '@/features/quality'
import { useMyOperators } from '@/features/quality/coaching/hooks'
import { useCallsBatch } from '@/features/calls/hooks/useCall'
import { useClientNames } from '@/features/clients/hooks/useClients'
import { buildDialogueRows } from '../../lib/dialogueScorecardAdapter'
import type { CallContactInfo } from '../../lib/dialogueScorecardAdapter'
import { useScopedUserIds } from '../../lib/scope'
import { ScorecardListView } from './ScorecardListView'
import { CallReviewPanel } from './CallReviewPanel'
import {
  ANALYTICS_TABLE_HEAD,
  ANALYTICS_TABLE_ROW,
  ANALYTICS_TABLE_TD,
  ANALYTICS_TABLE_TH,
} from '../analytics/analyticsTableStyles'
import { AnalyticsMockTable } from '../analytics/AnalyticsMockTable'

type TelephonyFilter = '' | TelephonyType
/** All + the not-evaluated queue (call source) + the three scorecard statuses. */
type EvalStatus = 'all' | 'not_evaluated' | 'draft' | 'completed' | 'sent'
type CategoryChip = 'all' | 'low' | 'average' | 'high'

const SCORECARD_STATUSES: EvalStatus[] = ['draft', 'completed', 'sent']
const PAGE_SIZE = 50

const CALL_TYPE_TONE: Record<string, string> = {
  white: 'bg-[#F3F4F6] text-[#374151]',
  grey: 'bg-[#E5E7EB] text-[#4B5563]',
  unknown: 'bg-gray-100 text-gray-400',
}
const STATUS_TONE: Record<string, string> = {
  draft: 'bg-[#FEF3C7] text-[#B45309]',
  completed: 'bg-[#DCFCE7] text-[#15803D]',
  sent: 'bg-[#DBEAFE] text-[#1D4ED8]',
}

function dayStartIso(date: string): string | undefined {
  return date ? new Date(`${date}T00:00:00`).toISOString() : undefined
}
function dayEndIso(date: string): string | undefined {
  return date ? new Date(`${date}T23:59:59.999`).toISOString() : undefined
}
function parsePositiveInt(value: string): number | undefined {
  const n = Math.floor(Number(value))
  return Number.isFinite(n) && n > 0 ? n : undefined
}
function sanitizeIntInput(raw: string): string {
  if (raw.trim() === '') return ''
  const n = Math.floor(Number(raw))
  return Number.isFinite(n) && n >= 0 ? String(n) : ''
}
function formatDuration(seconds: number | null): string {
  if (seconds == null || seconds < 0) return '—'
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}:${String(s).padStart(2, '0')}`
}
function formatDateTime(iso: string): string {
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleString()
}

interface Selected {
  callId: string
  operatorId: number
  scorecardId?: number
  createdAt?: string
  operatorName?: string
}

/**
 * Merged Dialogue Evaluation surface (KAN-827, PM feedback). One list of
 * dialogs with an evaluation-status filter that switches the data source:
 *   - All / Not evaluated → /calls/monitoring (call-first work queue)
 *   - Draft / Completed / Sent → /quality/scorecards (evaluation records, with
 *     score bands, per-scorecard rows and delete-draft)
 * Selecting a row opens the call in the review panel to evaluate / review it.
 */
export function DialogsListTab() {
  const { t } = useTranslation('common')
  const activeProjectId = useAuthStore((s) => s.user?.active_project_id)
  const { data: operators = [] } = useOperators(activeProjectId ? Number(activeProjectId) : null)
  const scoped = useScopedUserIds(operators)
  const { confirm, confirmDialog } = useConfirm()

  const [evalStatus, setEvalStatus] = useState<EvalStatus>('all')
  const [myEmployeesOnly, setMyEmployeesOnly] = useState(false)
  const [departmentId, setDepartmentId] = useState<number | 'all'>('all')
  const [telephonyType, setTelephonyType] = useState<TelephonyFilter>('')
  const [callFrom, setCallFrom] = useState('')
  const [callTo, setCallTo] = useState('')
  const [minDuration, setMinDuration] = useState('')
  const [nameQuery, setNameQuery] = useState('')
  const [activeCategory, setActiveCategory] = useState<CategoryChip>('all')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(PAGE_SIZE)
  const [selected, setSelected] = useState<Selected | null>(null)

  const debouncedName = useDebounce(nameQuery, 300)
  const isScorecardMode = SCORECARD_STATUSES.includes(evalStatus)
  const { data: myOperatorIds = [] } = useMyOperators(myEmployeesOnly)

  const departmentOptions = useMemo(() => {
    const map = new Map<number, string>()
    for (const o of operators) {
      if (o.department_id != null && !map.has(o.department_id)) {
        map.set(o.department_id, o.department_name?.trim() || `ID ${o.department_id}`)
      }
    }
    return Array.from(map, ([id, label]) => ({ id, label })).sort((a, b) =>
      a.label.localeCompare(b.label)
    )
  }, [operators])

  // Shared operator resolution (scope ∩ my-employees ∩ department ∩ name).
  const operatorIds = useMemo<number[] | undefined>(() => {
    let ids = scoped.userIds ?? operators.map((o) => o.id)
    if (myEmployeesOnly) {
      const mine = new Set(myOperatorIds)
      ids = ids.filter((id) => mine.has(id))
    }
    if (departmentId !== 'all') {
      const inDept = new Set(
        operators.filter((o) => o.department_id === departmentId).map((o) => o.id)
      )
      ids = ids.filter((id) => inDept.has(id))
    }
    const q = debouncedName.trim().toLowerCase()
    if (q) {
      const named = new Set(
        operators.filter((o) => o.full_name?.toLowerCase().includes(q)).map((o) => o.id)
      )
      ids = ids.filter((id) => named.has(id))
    }
    return ids
  }, [scoped.userIds, operators, myEmployeesOnly, myOperatorIds, departmentId, debouncedName])

  const { extensions, operatorByExtension } = useMemo(() => {
    const byId = new Map(operators.map((o) => [o.id, o]))
    const exts: string[] = []
    const extToOp = new Map<string, { id: number; name: string }>()
    for (const id of operatorIds ?? []) {
      const op = byId.get(id)
      if (op?.asterisk_extension) {
        exts.push(op.asterisk_extension)
        extToOp.set(op.asterisk_extension, { id: op.id, name: op.full_name ?? `#${op.id}` })
      }
    }
    return { extensions: exts, operatorByExtension: extToOp }
  }, [operators, operatorIds])

  // Genuinely empty (scope resolved empty, or filters narrowed to zero) — not
  // merely operators still loading.
  const noOperators =
    scoped.isEmptyResolution || (operators.length > 0 && (operatorIds?.length ?? 0) === 0)

  // Reset to page 1 (and clear category on leaving scorecard mode) when the
  // query changes.
  const resetKey = useMemo(
    () =>
      JSON.stringify([
        evalStatus,
        operatorIds ?? null,
        telephonyType,
        callFrom,
        callTo,
        minDuration,
        pageSize,
      ]),
    [evalStatus, operatorIds, telephonyType, callFrom, callTo, minDuration, pageSize]
  )
  const [trackedResetKey, setTrackedResetKey] = useState(resetKey)
  if (resetKey !== trackedResetKey) {
    setTrackedResetKey(resetKey)
    setPage(1)
    if (!isScorecardMode && activeCategory !== 'all') setActiveCategory('all')
  }

  // ── Call path (All / Not evaluated) ─────────────────────────────────
  const useCustomRange = !!(callFrom || callTo)
  const callFilters = useMemo(
    () => ({
      agent_extensions: extensions,
      period: useCustomRange ? undefined : ('last_30d' as const),
      from_datetime: dayStartIso(callFrom),
      to_datetime: dayEndIso(callTo),
      telephony_types: telephonyType ? [telephonyType] : undefined,
      min_duration: parsePositiveInt(minDuration),
      sort: 'date_desc' as const,
      limit: pageSize,
      offset: (page - 1) * pageSize,
    }),
    [extensions, useCustomRange, callFrom, callTo, telephonyType, minDuration, page, pageSize]
  )
  const callQuery = useCallMonitoring(callFilters, !isScorecardMode && extensions.length > 0)
  const calls = useMemo(() => callQuery.data?.calls ?? [], [callQuery.data?.calls])
  const callIds = useMemo(() => calls.map((c) => c.call_id), [calls])
  const { data: statusList = [] } = useScorecardStatusByCalls(callIds, callIds.length > 0)
  const statusByCall = useMemo(() => {
    const map = new Map<string, CallScorecardStatus>()
    for (const s of statusList) map.set(s.call_id, s)
    return map
  }, [statusList])
  const visibleCalls = useMemo(
    () =>
      evalStatus === 'not_evaluated' ? calls.filter((c) => !statusByCall.has(c.call_id)) : calls,
    [calls, evalStatus, statusByCall]
  )

  // ── Scorecard path (Draft / Completed / Sent) ───────────────────────
  const scFilters = useMemo(
    () => ({
      operator_id: operatorIds,
      status: isScorecardMode ? [evalStatus as 'draft' | 'completed' | 'sent'] : undefined,
      telephony_type: telephonyType || undefined,
      call_from: dayStartIso(callFrom),
      call_to: dayEndIso(callTo),
      min_talk_duration: parsePositiveInt(minDuration),
      page,
      page_size: pageSize,
    }),
    [
      operatorIds,
      isScorecardMode,
      evalStatus,
      telephonyType,
      callFrom,
      callTo,
      minDuration,
      page,
      pageSize,
    ]
  )
  const scQuery = useScorecards(scFilters, isScorecardMode && !noOperators)
  const scCallIds = useMemo(
    () => (scQuery.data?.data ?? []).map((s) => s.call_id),
    [scQuery.data?.data]
  )
  const { data: callBatch } = useCallsBatch(scCallIds)
  const callLookup = useMemo(() => {
    const map = new Map<string, CallContactInfo>()
    for (const c of callBatch ?? [])
      map.set(c.call_id, { customer_number: c.customer_number, client_id: c.client_id })
    return map
  }, [callBatch])
  const clientIds = useMemo(
    () =>
      Array.from(
        new Set((callBatch ?? []).map((c) => c.client_id).filter((id): id is number => id != null))
      ),
    [callBatch]
  )
  const clientNames = useClientNames(clientIds)
  const scRows = useMemo(
    () => buildDialogueRows(scQuery.data?.data ?? [], operators, callLookup, clientNames),
    [scQuery.data?.data, operators, callLookup, clientNames]
  )
  const categoryCounts = useMemo(
    () => ({
      all: scRows.length,
      low: scRows.filter((r) => r.category === 'Low').length,
      average: scRows.filter((r) => r.category === 'Average').length,
      high: scRows.filter((r) => r.category === 'High').length,
    }),
    [scRows]
  )
  const filteredScRows = useMemo(
    () =>
      activeCategory === 'all'
        ? scRows
        : scRows.filter((r) => r.category.toLowerCase() === activeCategory),
    [scRows, activeCategory]
  )

  const deleteMutation = useDeleteScorecard()
  const handleDeleteRow = async (scorecardId: number) => {
    const ok = await confirm({
      title: t('pages.training.dialogue.list.deleteTitle', 'Delete draft'),
      message: t('pages.training.dialogue.list.deleteConfirm', 'Delete this draft assessment?'),
      confirmLabel: t('pages.training.dialogue.list.delete', 'Delete draft'),
      tone: 'danger',
    })
    if (!ok) return
    deleteMutation.mutate(scorecardId, {
      onSuccess: () => {
        toast.success(t('pages.training.dialogue.list.deleted', 'Assessment deleted'))
        if (selected?.scorecardId === scorecardId) setSelected(null)
      },
      onError: () =>
        toast.error(t('pages.training.dialogue.list.deleteFailed', 'Could not delete assessment')),
    })
  }

  // ── Pagination + loading/empty (per active source) ──────────────────
  const total = isScorecardMode
    ? (scQuery.data?.pagination?.total ?? 0)
    : (callQuery.data?.total ?? 0)
  const totalPages = isScorecardMode
    ? (scQuery.data?.pagination?.total_pages ?? 1)
    : Math.max(1, Math.ceil((callQuery.data?.total ?? 0) / pageSize))
  const isLoading = isScorecardMode ? scQuery.isLoading : callQuery.isLoading
  const isError = isScorecardMode ? scQuery.isError : callQuery.isError

  const clearFilters = () => {
    setMyEmployeesOnly(false)
    setDepartmentId('all')
    setTelephonyType('')
    setCallFrom('')
    setCallTo('')
    setMinDuration('')
    setNameQuery('')
    setActiveCategory('all')
  }
  const hasAnyFilter =
    myEmployeesOnly ||
    departmentId !== 'all' ||
    !!(telephonyType || callFrom || callTo || minDuration || nameQuery)

  const inputCls =
    'h-9 rounded-lg border border-[#DFDFDF] bg-white px-3 text-xs text-[#05040D] focus:outline-none'

  const statusChips: { id: EvalStatus; label: string }[] = [
    { id: 'all', label: t('pages.training.dialogue.dialogs.statusAll', 'All') },
    {
      id: 'not_evaluated',
      label: t('pages.training.dialogue.dialogs.notEvaluated', 'Not evaluated'),
    },
    { id: 'draft', label: t('pages.training.scorecard.status.draft', 'Draft') },
    { id: 'completed', label: t('pages.training.scorecard.status.completed', 'Completed') },
    { id: 'sent', label: t('pages.training.scorecard.status.sent', 'Sent') },
  ]

  return (
    <div className="flex flex-col gap-3">
      {confirmDialog}

      {/* Evaluation-status filter — switches the list's data source. */}
      <div className="inline-flex max-w-full flex-wrap gap-1 rounded-lg border border-[#EBECE8] bg-white p-1">
        {statusChips.map((chip) => (
          <button
            key={chip.id}
            type="button"
            onClick={() => setEvalStatus(chip.id)}
            className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
              evalStatus === chip.id
                ? 'bg-[#204E4D] text-white'
                : 'text-[#545454] hover:bg-[#F7F7F7]'
            }`}
          >
            {chip.label}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setMyEmployeesOnly((v) => !v)}
          className={`h-9 rounded-lg px-4 text-xs font-medium transition-colors ${
            myEmployeesOnly
              ? 'bg-[#204E4D] text-white'
              : 'border border-[#DFDFDF] bg-white text-[#05040D] hover:bg-[#F7F7F7]'
          }`}
        >
          {t('pages.training.dialogue.dialogs.myEmployees', 'My employees')}
        </button>
        <input
          value={nameQuery}
          onChange={(e) => setNameQuery(e.target.value)}
          placeholder={t('pages.training.dialogue.filters.namePlaceholder', 'Search by full name…')}
          className={`${inputCls} w-[200px]`}
        />
        <select
          value={departmentId}
          onChange={(e) =>
            setDepartmentId(e.target.value === 'all' ? 'all' : Number(e.target.value))
          }
          className={inputCls}
        >
          <option value="all">
            {t('pages.training.dialogue.dialogs.allDepartments', 'All departments')}
          </option>
          {departmentOptions.map((d) => (
            <option key={d.id} value={d.id}>
              {d.label}
            </option>
          ))}
        </select>
        <select
          value={telephonyType}
          onChange={(e) => setTelephonyType(e.target.value as TelephonyFilter)}
          className={inputCls}
        >
          <option value="">{t('pages.training.dialogue.filters.allTypes', 'All types')}</option>
          <option value="white">{t('pages.training.dialogue.filters.white', 'White')}</option>
          <option value="grey">{t('pages.training.dialogue.filters.grey', 'Grey')}</option>
          <option value="unknown">{t('pages.training.dialogue.filters.unknown', 'Unknown')}</option>
        </select>
        <div className="flex items-center gap-1">
          <span className="text-[10px] text-[#6B7280]">
            {t('pages.training.dialogue.filters.callDate', 'Call date')}
          </span>
          <input
            type="date"
            value={callFrom}
            onChange={(e) => setCallFrom(e.target.value)}
            className={inputCls}
          />
          <span className="text-[10px] text-[#6B7280]">–</span>
          <input
            type="date"
            value={callTo}
            onChange={(e) => setCallTo(e.target.value)}
            className={inputCls}
          />
        </div>
        <input
          type="number"
          min={0}
          step={1}
          inputMode="numeric"
          value={minDuration}
          onChange={(e) => setMinDuration(sanitizeIntInput(e.target.value))}
          placeholder={t('pages.training.dialogue.filters.minDuration', 'Min talk (sec)')}
          className={`${inputCls} w-[130px]`}
        />
        {hasAnyFilter ? (
          <button
            type="button"
            onClick={clearFilters}
            className="h-9 rounded-lg border border-[#DFDFDF] bg-white px-4 text-xs font-medium text-[#4B5563] transition-colors hover:bg-[#F7F7F7]"
          >
            {t('pages.training.dialogue.filters.clearAll', 'Clear All')}
          </button>
        ) : null}
      </div>

      {/* Category (score band) chips — only meaningful for evaluated rows. */}
      {isScorecardMode ? (
        <div className="inline-flex max-w-full flex-wrap gap-1">
          {(['all', 'low', 'average', 'high'] as CategoryChip[]).map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setActiveCategory(c)}
              className={`rounded-full px-3 py-1 text-[11px] font-medium transition-colors ${
                activeCategory === c
                  ? 'bg-[#204E4D] text-white'
                  : 'bg-white text-[#545454] hover:bg-[#F7F7F7]'
              }`}
            >
              {t(
                `pages.training.dialogue.chips.${c === 'all' ? 'all' : c}`,
                c === 'all' ? 'All calls' : c
              )}{' '}
              ({categoryCounts[c]})
            </button>
          ))}
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-3 xl:grid-cols-[1fr_520px]">
        <div className="flex flex-col gap-3">
          {noOperators ? (
            <EmptyBox>
              {t(
                'pages.training.errors.emptyScopeResolution',
                'The selected scope returned no operators.'
              )}
            </EmptyBox>
          ) : isLoading ? (
            <EmptyBox>{t('common.loading', 'Loading…')}</EmptyBox>
          ) : isError ? (
            <EmptyBox tone="error">
              {t('pages.training.dialogue.dialogs.loadError', 'Failed to load dialogs.')}
            </EmptyBox>
          ) : isScorecardMode ? (
            filteredScRows.length === 0 ? (
              <EmptyBox>
                {t('pages.training.dialogue.dialogs.empty', 'No dialogs match the filters.')}
              </EmptyBox>
            ) : (
              <ScorecardListView
                rows={filteredScRows}
                selectedId={selected?.scorecardId ?? null}
                onSelect={(id) => {
                  const sc = scQuery.data?.data?.find((s) => s.id === id)
                  if (sc)
                    setSelected({
                      callId: sc.call_id,
                      operatorId: sc.operator_id,
                      scorecardId: sc.id,
                      createdAt: sc.created_at,
                      operatorName: operators.find((o) => o.id === sc.operator_id)?.full_name,
                    })
                }}
                onDelete={evalStatus === 'draft' ? handleDeleteRow : undefined}
              />
            )
          ) : visibleCalls.length === 0 ? (
            <EmptyBox>
              {t('pages.training.dialogue.dialogs.empty', 'No dialogs match the filters.')}
            </EmptyBox>
          ) : (
            <DialogsTable
              calls={visibleCalls}
              operatorByExtension={operatorByExtension}
              statusByCall={statusByCall}
              selectedCallId={selected?.callId}
              onSelect={(call, operatorId) =>
                setSelected({
                  callId: call.call_id,
                  operatorId,
                  createdAt: call.initiated_at,
                  operatorName: operatorByExtension.get(call.agent_extension)?.name,
                })
              }
            />
          )}
          {!noOperators && !isLoading && !isError && total > 0 ? (
            <Pagination
              currentPage={page}
              totalPages={totalPages}
              pageSize={pageSize}
              onPageChange={setPage}
              onPageSizeChange={setPageSize}
            />
          ) : null}
        </div>

        <CallReviewPanel
          callId={selected?.callId}
          operatorId={selected?.operatorId}
          scorecardId={selected?.scorecardId}
          createdAt={selected?.createdAt}
          operatorName={selected?.operatorName}
        />
      </div>
    </div>
  )
}

function EmptyBox({ children, tone }: { children: ReactNode; tone?: 'error' }) {
  return (
    <div
      className={`rounded-xl bg-white p-12 text-center text-sm shadow-sm ${
        tone === 'error' ? 'text-red-500' : 'text-[#6B7280]'
      }`}
    >
      {children}
    </div>
  )
}

function DialogsTable({
  calls,
  operatorByExtension,
  statusByCall,
  selectedCallId,
  onSelect,
}: {
  calls: CallMonitoringItem[]
  operatorByExtension: Map<string, { id: number; name: string }>
  statusByCall: Map<string, CallScorecardStatus>
  selectedCallId?: string
  onSelect: (call: CallMonitoringItem, operatorId: number) => void
}) {
  const { t } = useTranslation('common')
  return (
    <AnalyticsMockTable>
      <thead className={ANALYTICS_TABLE_HEAD}>
        <tr>
          <th className={ANALYTICS_TABLE_TH}>
            {t('pages.training.dialogue.list.dateTime', 'Date / Time')}
          </th>
          <th className={ANALYTICS_TABLE_TH}>
            {t('pages.training.dialogue.list.employee', 'Employee')}
          </th>
          <th className={ANALYTICS_TABLE_TH}>{t('pages.training.dialogue.list.phone', 'Phone')}</th>
          <th className={ANALYTICS_TABLE_TH}>
            {t('pages.training.dialogue.list.callType', 'Call type')}
          </th>
          <th className={ANALYTICS_TABLE_TH}>
            {t('pages.training.dialogue.list.duration', 'Duration')}
          </th>
          <th className={ANALYTICS_TABLE_TH}>
            {t('pages.training.dialogue.dialogs.evaluation', 'Evaluation')}
          </th>
        </tr>
      </thead>
      <tbody>
        {calls.map((call) => {
          const op = operatorByExtension.get(call.agent_extension)
          const status = statusByCall.get(call.call_id)
          const isActive = call.call_id === selectedCallId
          const clickable = !!op
          return (
            <tr
              key={call.call_id}
              onClick={() => op && onSelect(call, op.id)}
              role="button"
              tabIndex={0}
              aria-current={isActive || undefined}
              className={`${ANALYTICS_TABLE_ROW} ${clickable ? 'cursor-pointer' : 'cursor-default opacity-70'} ${
                isActive ? 'bg-[#F7FFE5]' : ''
              }`}
            >
              <td className={`${ANALYTICS_TABLE_TD} whitespace-nowrap`}>
                {formatDateTime(call.initiated_at)}
              </td>
              <td className={ANALYTICS_TABLE_TD}>{op?.name ?? call.agent_extension}</td>
              <td className={`${ANALYTICS_TABLE_TD} tabular-nums`}>{call.customer_number}</td>
              <td className={ANALYTICS_TABLE_TD}>
                <span
                  className={`rounded-full px-2 py-0.5 text-[10px] font-medium capitalize ${
                    CALL_TYPE_TONE[call.telephony_type] ?? CALL_TYPE_TONE.unknown
                  }`}
                >
                  {t(`pages.training.dialogue.filters.${call.telephony_type}`, call.telephony_type)}
                </span>
              </td>
              <td className={`${ANALYTICS_TABLE_TD} tabular-nums`}>
                {formatDuration(call.talk_duration)}
              </td>
              <td className={ANALYTICS_TABLE_TD}>
                {status ? (
                  <span className="inline-flex items-center gap-1">
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                        STATUS_TONE[status.latest_status] ?? 'bg-gray-100 text-gray-500'
                      }`}
                    >
                      {status.latest_score != null
                        ? `${Math.round(Number(status.latest_score) * 20)}`
                        : t(
                            `pages.training.scorecard.status.${status.latest_status}`,
                            status.latest_status
                          )}
                    </span>
                    {status.count > 1 ? (
                      <span className="text-[10px] text-[#9CA3AF]">×{status.count}</span>
                    ) : null}
                  </span>
                ) : (
                  <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-medium text-gray-400">
                    {t('pages.training.dialogue.dialogs.notEvaluated', 'Not evaluated')}
                  </span>
                )}
              </td>
            </tr>
          )
        })}
      </tbody>
    </AnalyticsMockTable>
  )
}

export default DialogsListTab
