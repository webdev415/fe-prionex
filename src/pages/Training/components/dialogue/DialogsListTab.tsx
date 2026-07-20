import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Pagination } from '@/components/ui/Pagination'
import { useAuthStore } from '@/stores/authStore'
import { useOperators } from '@/features/users/hooks'
import { useCallMonitoring } from '@/features/training'
import type { CallMonitoringItem, TelephonyType } from '@/features/training'
import { useScorecardStatusByCalls } from '@/features/quality'
import type { CallScorecardStatus } from '@/features/quality'
import { useMyOperators } from '@/features/quality/coaching/hooks'
import { useScopedUserIds } from '../../lib/scope'
import { CallReviewPanel } from './CallReviewPanel'
import {
  ANALYTICS_TABLE_HEAD,
  ANALYTICS_TABLE_ROW,
  ANALYTICS_TABLE_TD,
  ANALYTICS_TABLE_TH,
} from '../analytics/analyticsTableStyles'
import { AnalyticsMockTable } from '../analytics/AnalyticsMockTable'

type TelephonyFilter = '' | TelephonyType

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

/**
 * Call-first Dialogue Evaluation list (KAN-827, PM feedback): shows ALL recorded
 * dialogs for the scoped operators by default — no more adding one-by-one — with
 * "My employees" / department / dialing-type filters and a per-dialog evaluation
 * status. Selecting a row opens the call in the review panel to evaluate it.
 */
export function DialogsListTab() {
  const { t } = useTranslation('common')
  const activeProjectId = useAuthStore((s) => s.user?.active_project_id)
  const { data: operators = [] } = useOperators(activeProjectId ? Number(activeProjectId) : null)
  const scoped = useScopedUserIds(operators)

  const [myEmployeesOnly, setMyEmployeesOnly] = useState(false)
  const [departmentId, setDepartmentId] = useState<number | 'all'>('all')
  const [telephonyType, setTelephonyType] = useState<TelephonyFilter>('')
  const [callFrom, setCallFrom] = useState('')
  const [callTo, setCallTo] = useState('')
  const [minDuration, setMinDuration] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(PAGE_SIZE)
  const [selected, setSelected] = useState<{ callId: string; operatorId: number } | null>(null)

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

  // Resolve the scoped + filtered operator set → their Asterisk extensions (the
  // call service filters by extension, not user_id).
  const { extensions, operatorByExtension } = useMemo(() => {
    const base = scoped.userIds ?? operators.map((o) => o.id)
    let ids = base
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
    const byId = new Map(operators.map((o) => [o.id, o]))
    const exts: string[] = []
    const extToOp = new Map<string, { id: number; name: string }>()
    for (const id of ids) {
      const op = byId.get(id)
      if (op?.asterisk_extension) {
        exts.push(op.asterisk_extension)
        extToOp.set(op.asterisk_extension, { id: op.id, name: op.full_name ?? `#${op.id}` })
      }
    }
    return { extensions: exts, operatorByExtension: extToOp }
  }, [scoped.userIds, operators, myEmployeesOnly, myOperatorIds, departmentId])

  const useCustomRange = !!(callFrom || callTo)
  const filters = useMemo(
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

  // Reset to page 1 when the query changes.
  const resetKey = useMemo(
    () => JSON.stringify([extensions, telephonyType, callFrom, callTo, minDuration, pageSize]),
    [extensions, telephonyType, callFrom, callTo, minDuration, pageSize]
  )
  const [trackedResetKey, setTrackedResetKey] = useState(resetKey)
  if (resetKey !== trackedResetKey) {
    setTrackedResetKey(resetKey)
    setPage(1)
  }

  const { data, isLoading, isError } = useCallMonitoring(filters, extensions.length > 0)
  const calls = useMemo(() => data?.calls ?? [], [data?.calls])
  const total = data?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(total / pageSize))

  const callIds = useMemo(() => calls.map((c) => c.call_id), [calls])
  const { data: statusList = [] } = useScorecardStatusByCalls(callIds, callIds.length > 0)
  const statusByCall = useMemo(() => {
    const map = new Map<string, CallScorecardStatus>()
    for (const s of statusList) map.set(s.call_id, s)
    return map
  }, [statusList])

  const clearFilters = () => {
    setMyEmployeesOnly(false)
    setDepartmentId('all')
    setTelephonyType('')
    setCallFrom('')
    setCallTo('')
    setMinDuration('')
  }
  const hasAnyFilter =
    myEmployeesOnly ||
    departmentId !== 'all' ||
    !!(telephonyType || callFrom || callTo || minDuration)

  const inputCls =
    'h-9 rounded-lg border border-[#DFDFDF] bg-white px-3 text-xs text-[#05040D] focus:outline-none'

  return (
    <div className="flex flex-col gap-3">
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

      <div className="grid grid-cols-1 gap-3 xl:grid-cols-[1fr_520px]">
        <div className="flex flex-col gap-3">
          {extensions.length === 0 ? (
            <div className="rounded-xl bg-white/50 p-12 text-center text-sm text-gray-500 shadow-sm">
              {t(
                'pages.training.errors.emptyScopeResolution',
                'The selected scope returned no operators.'
              )}
            </div>
          ) : isLoading ? (
            <div className="rounded-xl bg-white p-12 text-center text-sm text-[#6B7280] shadow-sm">
              {t('common.loading', 'Loading…')}
            </div>
          ) : isError ? (
            <div className="rounded-xl bg-white p-12 text-center text-sm text-red-500 shadow-sm">
              {t('pages.training.dialogue.dialogs.loadError', 'Failed to load dialogs.')}
            </div>
          ) : calls.length === 0 ? (
            <div className="rounded-xl bg-white p-12 text-center text-sm text-[#6B7280] shadow-sm">
              {t('pages.training.dialogue.dialogs.empty', 'No dialogs match the filters.')}
            </div>
          ) : (
            <DialogsTable
              calls={calls}
              operatorByExtension={operatorByExtension}
              statusByCall={statusByCall}
              selectedCallId={selected?.callId}
              onSelect={(callId, operatorId) => setSelected({ callId, operatorId })}
              t={t}
            />
          )}
          {extensions.length > 0 && !isLoading && !isError && total > 0 ? (
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
          operatorName={
            selected
              ? operatorByExtension.get(findExtForCall(calls, selected.callId))?.name
              : undefined
          }
          createdAt={calls.find((c) => c.call_id === selected?.callId)?.initiated_at}
        />
      </div>
    </div>
  )
}

function findExtForCall(calls: CallMonitoringItem[], callId: string): string {
  return calls.find((c) => c.call_id === callId)?.agent_extension ?? ''
}

function DialogsTable({
  calls,
  operatorByExtension,
  statusByCall,
  selectedCallId,
  onSelect,
  t,
}: {
  calls: CallMonitoringItem[]
  operatorByExtension: Map<string, { id: number; name: string }>
  statusByCall: Map<string, CallScorecardStatus>
  selectedCallId?: string
  onSelect: (callId: string, operatorId: number) => void
  t: (key: string, fallback: string) => string
}) {
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
              onClick={() => op && onSelect(call.call_id, op.id)}
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
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                      STATUS_TONE[status.latest_status] ?? 'bg-gray-100 text-gray-500'
                    }`}
                  >
                    {status.latest_score != null
                      ? `${Math.round(status.latest_score * 20)}`
                      : t(
                          `pages.training.tests.status.${status.latest_status}`,
                          status.latest_status
                        )}
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
