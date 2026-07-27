import { useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Pagination } from '@/components/ui/Pagination'
import { useConfirm } from '@/components/ui/useConfirm'
import { useAuthStore } from '@/stores/authStore'
import { useOperators } from '@/features/users/hooks'
import { useCallMonitoring } from '@/features/training'
import type { CallMonitoringItem, ScorecardCategory, TelephonyType } from '@/features/training'
import { useMyOperators, useOperatorTrainers } from '@/features/quality/coaching/hooks'
import { useClientNames } from '@/features/clients/hooks/useClients'
import { useScopedUserIds } from '../../lib/scope'
import { EmployeeMultiSelect } from './EmployeeMultiSelect'
import { CallReviewPanel } from './CallReviewPanel'
import {
  ANALYTICS_TABLE_HEAD,
  ANALYTICS_TABLE_ROW,
  ANALYTICS_TABLE_TD,
  ANALYTICS_TABLE_TH,
} from '../analytics/analyticsTableStyles'
import { AnalyticsMockTable } from '../analytics/AnalyticsMockTable'
import { formatDateTime as formatDateTimeLocale } from '@/lib/localeFormat'

type TelephonyFilter = '' | TelephonyType
type CategoryFilter = '' | ScorecardCategory

const PAGE_SIZE = 50

const CALL_TYPE_TONE: Record<string, string> = {
  white: 'bg-[#F3F4F6] text-[#374151]',
  grey: 'bg-[#E5E7EB] text-[#4B5563]',
  unknown: 'bg-gray-100 text-gray-400',
}
const CATEGORY_TONE: Record<string, string> = {
  unscored: 'bg-gray-100 text-gray-400',
  low: 'bg-[#FEE2E2] text-[#B91C1C]',
  average: 'bg-[#FEF3C7] text-[#B45309]',
  high: 'bg-[#DCFCE7] text-[#15803D]',
}
const CATEGORIES: ScorecardCategory[] = ['unscored', 'low', 'average', 'high']

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
function formatDateTime(iso: string, language: string): string {
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? '—' : formatDateTimeLocale(d, language)
}
function categoryOf(call: CallMonitoringItem): ScorecardCategory {
  return call.has_scorecard ? (call.scorecard_category ?? 'unscored') : 'unscored'
}

interface Selected {
  callId: string
  operatorId: number
  scorecardId?: number
  createdAt?: string
  operatorName?: string
  talkDurationSec?: number | null
}

/**
 * Dialogue Evaluation list — one row per recorded call. Trainers see every
 * project call (filterable), open any to view its evaluation, and score the
 * ones for operators assigned to them. The scorecard summary (category, rating,
 * comment) is served inline by call-service so filtering is server-side.
 */
export function DialogsListTab() {
  const { t } = useTranslation('common')
  const activeProjectId = useAuthStore((s) => s.user?.active_project_id)
  const { data: operators = [] } = useOperators(activeProjectId ? Number(activeProjectId) : null)
  const scoped = useScopedUserIds(operators)

  const [selectedEmployeeIds, setSelectedEmployeeIds] = useState<number[]>([])
  const [departmentId, setDepartmentId] = useState<number | 'all'>('all')
  const [telephonyType, setTelephonyType] = useState<TelephonyFilter>('')
  const [category, setCategory] = useState<CategoryFilter>('')
  const [callFrom, setCallFrom] = useState('')
  const [callTo, setCallTo] = useState('')
  const [minDuration, setMinDuration] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(PAGE_SIZE)
  const [selected, setSelected] = useState<Selected | null>(null)
  const [reviewDirty, setReviewDirty] = useState(false)
  const { confirm, confirmDialog } = useConfirm()

  const myOperatorsQuery = useMyOperators()
  const myOperatorIds = useMemo(() => myOperatorsQuery.data ?? [], [myOperatorsQuery.data])
  const { data: operatorTrainers = [] } = useOperatorTrainers()

  // Nothing to filter by until the trainer has operators under their control;
  // without this the button would be a silent no-op.
  const myEmployeesUnavailable =
    myOperatorsQuery.isLoading || myOperatorsQuery.isError || myOperatorIds.length === 0
  const myEmployeesHint = myOperatorsQuery.isError
    ? t('pages.training.dialogue.dialogs.myEmployeesError', 'Could not load your operators')
    : myOperatorIds.length === 0
      ? t(
          'pages.training.dialogue.dialogs.myEmployeesEmpty',
          'You have no operators under your control yet'
        )
      : undefined

  const trainerByOperator = useMemo(() => {
    const map = new Map<number, string>()
    for (const ot of operatorTrainers) map.set(ot.operator_id, ot.trainer_name)
    return map
  }, [operatorTrainers])

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

  // Scope ∩ employee picker ∩ department → the operators whose calls we list.
  const operatorIds = useMemo<number[] | undefined>(() => {
    let ids = selectedEmployeeIds.length > 0 ? selectedEmployeeIds : scoped.userIds
    if (departmentId !== 'all') {
      const inDept = new Set(
        operators.filter((o) => o.department_id === departmentId).map((o) => o.id)
      )
      ids = (ids ?? operators.map((o) => o.id)).filter((id) => inDept.has(id))
    }
    return ids
  }, [selectedEmployeeIds, scoped.userIds, departmentId, operators])

  const { extensions, operatorByExtension } = useMemo(() => {
    const base = operatorIds ?? operators.map((o) => o.id)
    const byId = new Map(operators.map((o) => [o.id, o]))
    const exts: string[] = []
    const extToOp = new Map<string, { id: number; name: string }>()
    for (const id of base) {
      const op = byId.get(id)
      if (op?.asterisk_extension) {
        exts.push(op.asterisk_extension)
        extToOp.set(op.asterisk_extension, { id: op.id, name: op.full_name ?? `#${op.id}` })
      }
    }
    return { extensions: exts, operatorByExtension: extToOp }
  }, [operators, operatorIds])

  const useCustomRange = !!(callFrom || callTo)
  const filters = useMemo(
    () => ({
      agent_extensions: extensions,
      period: useCustomRange ? undefined : ('last_30d' as const),
      from_datetime: dayStartIso(callFrom),
      to_datetime: dayEndIso(callTo),
      telephony_types: telephonyType ? [telephonyType] : undefined,
      category: category || undefined,
      min_duration: parsePositiveInt(minDuration),
      sort: 'date_desc' as const,
      limit: pageSize,
      offset: (page - 1) * pageSize,
    }),
    [
      extensions,
      useCustomRange,
      callFrom,
      callTo,
      telephonyType,
      category,
      minDuration,
      page,
      pageSize,
    ]
  )

  const resetKey = useMemo(
    () =>
      JSON.stringify([
        extensions,
        telephonyType,
        category,
        callFrom,
        callTo,
        minDuration,
        pageSize,
      ]),
    [extensions, telephonyType, category, callFrom, callTo, minDuration, pageSize]
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

  const clientIds = useMemo(
    () =>
      Array.from(new Set(calls.map((c) => c.client_id).filter((id): id is number => id != null))),
    [calls]
  )
  const clientNames = useClientNames(clientIds)

  const selectCall = (call: CallMonitoringItem, operatorId: number) => {
    setSelected({
      callId: call.call_id,
      operatorId,
      scorecardId: call.scorecard_id ?? undefined,
      createdAt: call.initiated_at,
      operatorName: operatorByExtension.get(call.agent_extension)?.name,
      talkDurationSec: call.talk_duration,
    })
  }

  // Open the newest reviewable dialog on first load so the panel isn't empty.
  // Deliberately once — re-selecting on every filter change would refetch the
  // panel (and its recording) while the trainer is still narrowing the list.
  const [autoSelected, setAutoSelected] = useState(false)
  if (!autoSelected && selected == null && calls.length > 0) {
    setAutoSelected(true)
    const first = calls.find((c) => operatorByExtension.has(c.agent_extension))
    const op = first ? operatorByExtension.get(first.agent_extension) : undefined
    if (first && op) selectCall(first, op.id)
  }

  const handleSelectRow = async (call: CallMonitoringItem, operatorId: number) => {
    if (reviewDirty && call.call_id !== selected?.callId) {
      const ok = await confirm({
        title: t('pages.training.scorecard.unsaved', 'Unsaved changes'),
        message: t(
          'pages.training.scorecard.unsavedConfirm',
          'You have unsaved changes that will be lost. Close anyway?'
        ),
        confirmLabel: t('pages.training.scorecard.discardConfirm', 'Discard changes'),
        tone: 'danger',
      })
      if (!ok) return
    }
    selectCall(call, operatorId)
  }

  const clearFilters = () => {
    setSelectedEmployeeIds([])
    setDepartmentId('all')
    setTelephonyType('')
    setCategory('')
    setCallFrom('')
    setCallTo('')
    setMinDuration('')
  }
  const hasAnyFilter =
    selectedEmployeeIds.length > 0 ||
    departmentId !== 'all' ||
    !!(telephonyType || category || callFrom || callTo || minDuration)

  const inputCls =
    'h-9 rounded-lg border border-[#DFDFDF] bg-white px-3 text-xs text-[#05040D] focus:outline-none'

  return (
    <div className="flex flex-col gap-3">
      {confirmDialog}
      <div className="flex flex-wrap items-center gap-2">
        <EmployeeMultiSelect
          value={selectedEmployeeIds}
          onChange={setSelectedEmployeeIds}
          operators={operators}
          quickSelect={{
            label: t('pages.training.dialogue.dialogs.myEmployees', 'My employees'),
            ids: myOperatorIds,
            disabled: myEmployeesUnavailable,
            hint: myEmployeesHint,
          }}
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

      <div className="inline-flex max-w-full flex-wrap gap-1">
        <button
          type="button"
          onClick={() => setCategory('')}
          className={`rounded-full px-3 py-1 text-[11px] font-medium transition-colors ${
            category === ''
              ? 'bg-[#204E4D] text-white'
              : 'bg-white text-[#545454] hover:bg-[#F7F7F7]'
          }`}
        >
          {t('pages.training.dialogue.chips.all', 'All calls')}
        </button>
        {CATEGORIES.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => setCategory(c)}
            className={`rounded-full px-3 py-1 text-[11px] font-medium transition-colors ${
              category === c
                ? 'bg-[#204E4D] text-white'
                : 'bg-white text-[#545454] hover:bg-[#F7F7F7]'
            }`}
          >
            {t(`pages.training.dialogue.category.${c}`, c)}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-3 xl:grid-cols-[1fr_520px]">
        <div className="flex flex-col gap-3">
          {isLoading ? (
            <EmptyBox>{t('common.loading', 'Loading…')}</EmptyBox>
          ) : isError ? (
            <EmptyBox tone="error">
              {t('pages.training.dialogue.dialogs.loadError', 'Failed to load dialogs.')}
            </EmptyBox>
          ) : calls.length === 0 ? (
            <EmptyBox>
              {t('pages.training.dialogue.dialogs.empty', 'No dialogs match the filters.')}
            </EmptyBox>
          ) : (
            <DialogsTable
              calls={calls}
              operatorByExtension={operatorByExtension}
              trainerByOperator={trainerByOperator}
              clientNames={clientNames}
              selectedCallId={selected?.callId}
              onSelect={handleSelectRow}
            />
          )}
          {!isLoading && !isError && total > 0 ? (
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
          talkDurationSec={selected?.talkDurationSec}
          canEdit={selected != null && myOperatorIds.includes(selected.operatorId)}
          onDirtyChange={setReviewDirty}
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
  trainerByOperator,
  clientNames,
  selectedCallId,
  onSelect,
}: {
  calls: CallMonitoringItem[]
  operatorByExtension: Map<string, { id: number; name: string }>
  trainerByOperator: Map<number, string>
  clientNames: Map<number, string>
  selectedCallId?: string
  onSelect: (call: CallMonitoringItem, operatorId: number) => void
}) {
  const { t, i18n } = useTranslation('common')
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
          <th className={ANALYTICS_TABLE_TH}>
            {t('pages.training.dialogue.list.trainer', 'Trainer')}
          </th>
          <th className={ANALYTICS_TABLE_TH}>
            {t('pages.training.dialogue.list.client', 'Client')}
          </th>
          <th className={ANALYTICS_TABLE_TH}>
            {t('pages.training.dialogue.list.callType', 'Call type')}
          </th>
          <th className={ANALYTICS_TABLE_TH}>
            {t('pages.training.dialogue.list.duration', 'Duration')}
          </th>
          <th className={ANALYTICS_TABLE_TH}>
            {t('pages.training.dialogue.list.category', 'Category')}
          </th>
          <th className={ANALYTICS_TABLE_TH}>
            {t('pages.training.dialogue.list.rating', 'Rating')}
          </th>
          <th className={ANALYTICS_TABLE_TH}>
            {t('pages.training.dialogue.list.comment', 'Comment')}
          </th>
        </tr>
      </thead>
      <tbody>
        {calls.map((call) => {
          const op = operatorByExtension.get(call.agent_extension)
          const isActive = call.call_id === selectedCallId
          const clickable = !!op
          const cat = categoryOf(call)
          const rating =
            call.scorecard_weighted_score != null
              ? Math.round(call.scorecard_weighted_score * 20)
              : null
          const clientName = call.client_id != null ? clientNames.get(call.client_id) : undefined
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
                {formatDateTime(call.initiated_at, i18n.language)}
              </td>
              <td className={ANALYTICS_TABLE_TD}>{op?.name ?? call.agent_extension}</td>
              <td className={ANALYTICS_TABLE_TD}>
                {op ? (trainerByOperator.get(op.id) ?? '—') : '—'}
              </td>
              <td className={ANALYTICS_TABLE_TD}>
                {clientName ?? (call.client_id != null ? `#${call.client_id}` : '—')}
              </td>
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
                <span
                  className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${CATEGORY_TONE[cat]}`}
                >
                  {t(`pages.training.dialogue.category.${cat}`, cat)}
                </span>
              </td>
              <td className={`${ANALYTICS_TABLE_TD} tabular-nums`}>{rating ?? '—'}</td>
              <td
                className={`${ANALYTICS_TABLE_TD} max-w-[220px] truncate`}
                title={call.scorecard_comment ?? undefined}
              >
                {call.scorecard_comment ?? '—'}
              </td>
            </tr>
          )
        })}
      </tbody>
    </AnalyticsMockTable>
  )
}

export default DialogsListTab
