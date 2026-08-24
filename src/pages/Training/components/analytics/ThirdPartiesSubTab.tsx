import { useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Icons } from '@/lib/icons'
import { formatMonthDay, formatTimeShort } from '@/lib/localeFormat'
import { Pagination } from '@/components/ui/Pagination'
import { useAuthStore } from '@/stores/authStore'
import { useOperators } from '@/features/users/hooks'
import { useThirdParty } from '@/features/training/hooks/useThirdParty'
import { useExportThirdParty } from '@/features/training/hooks/useExportThirdParty'
import {
  CallRecordingModal,
  type CallRecordingModalHandle,
} from '@/pages/ClientManagement/components/CallRecordingModal'
import { CallTranscriptPanel } from '@/features/quality'
import type {
  CallMonitoringPeriod,
  ThirdPartyFilters,
  ThirdPartyItem,
  ThirdPartyResultChip,
  ThirdPartyResultFilter,
} from '@/features/training/types'
import { AnalyticsMockTable } from './AnalyticsMockTable'
import { AnalyticsKpiTile } from './AnalyticsKpiTile'
import {
  ANALYTICS_TABLE_HEAD,
  ANALYTICS_TABLE_ROW,
  ANALYTICS_TABLE_TD,
  ANALYTICS_TABLE_TH,
} from './analyticsTableStyles'

/**
 * Third Parties sub-tab (KAN-736). Layout / UI styling mirror the Figma frame
 * verbatim (the mock is the source of truth):
 *   1) 4 horizontal icon-tile KPIs (Calls / Returned / Did not return / Positive)
 *   2) Filter strip — period chips + operator dropdown on the left, result chip
 *      strip + export on the right
 *   3) Table — operator avatar, blue client code, third-party phone with
 *      relation sub-label, result pill, "Returned to client" check (Yes +
 *      timestamp) / red cross (Did not return)
 *
 * Data is wired to /api/v1/interactions/third-party: KPIs come from the BE
 * `kpis` (the mock's four tiles, §1), rows from `items`, the result pill from
 * the server-mapped `result_chip` (§3), and "returned to client" from the
 * server-side heuristic (§5). Row click opens the recording in
 * `CallRecordingModal` when a `call_id` is present (deferred in v1 — §4).
 */

const RESULT_TONE: Record<ThirdPartyResultChip, string> = {
  promise: 'bg-emerald-100 text-emerald-700',
  refusal: 'bg-red-100 text-red-700',
  missed_call: 'bg-gray-100 text-gray-600',
  will_pass_on: 'bg-blue-100 text-blue-700',
}

const RESULT_LABEL: Record<ThirdPartyResultChip, { key: string; fallback: string }> = {
  promise: { key: 'pages.training.thirdParties.result.promise', fallback: 'Promise' },
  refusal: { key: 'pages.training.thirdParties.result.refusal', fallback: 'Refusal' },
  missed_call: { key: 'pages.training.thirdParties.result.missedCall', fallback: 'Missed call' },
  will_pass_on: { key: 'pages.training.thirdParties.result.willPassOn', fallback: 'Will pass on' },
}

const RESULT_CHIPS: ThirdPartyResultFilter[] = [
  'all',
  'promise',
  'refusal',
  'missed_call',
  'will_pass_on',
]

type PeriodOption = 'today' | 'yesterday' | '7d' | '30d'

const PERIODS: { id: PeriodOption; key: string; fallback: string }[] = [
  { id: 'today', key: 'pages.training.period.today', fallback: 'Today' },
  { id: 'yesterday', key: 'pages.training.period.yesterday', fallback: 'Yesterday' },
  { id: '7d', key: 'pages.training.period.7days', fallback: '7 days' },
  { id: '30d', key: 'pages.training.period.30days', fallback: '30 days' },
]

const PERIOD_TO_BACKEND: Record<PeriodOption, CallMonitoringPeriod> = {
  today: 'today',
  yesterday: 'yesterday',
  '7d': 'last_7d',
  '30d': 'last_30d',
}

const AVATAR_PALETTE = [
  '#E0F2EC',
  '#FEF3C7',
  '#FEE4E2',
  '#E0E7FF',
  '#FCE7F3',
  '#DBEAFE',
  '#FFEDD5',
  '#D1FAE5',
]

function avatarColorFor(operatorId: number | null): string {
  if (operatorId == null) return '#EDEDED'
  return AVATAR_PALETTE[Math.abs(operatorId) % AVATAR_PALETTE.length]
}

function deriveInitials(fullName: string): string {
  const parts = fullName.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return ''
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase()
}

function pad(n: number): string {
  return String(n).padStart(2, '0')
}

function formatDateTime(iso: string | null, language: string): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return `${formatMonthDay(d, language)} ${formatTimeShort(d, language)}`
}

function formatDuration(seconds: number | null): string {
  if (seconds == null) return '—'
  const m = Math.floor(seconds / 60)
  return `${m}:${pad(seconds % 60)}`
}

export function ThirdPartiesSubTab() {
  const { t } = useTranslation('common')
  const [period, setPeriod] = useState<PeriodOption>('today')
  const [operatorFilter, setOperatorFilter] = useState<string>('all')
  const [resultFilter, setResultFilter] = useState<ThirdPartyResultFilter>('all')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(50)
  const [selected, setSelected] = useState<ThirdPartyItem | null>(null)

  const activeProjectId = useAuthStore((s) => s.user?.active_project_id)
  const projectIdNum = activeProjectId ? Number(activeProjectId) : null
  const { data: operators } = useOperators(projectIdNum ?? undefined)

  const resetPage = () => setPage(1)

  const filters = useMemo<ThirdPartyFilters>(
    () => ({
      period: PERIOD_TO_BACKEND[period],
      user_ids: operatorFilter === 'all' ? undefined : [Number(operatorFilter)],
      result_filter: resultFilter,
      sort_by: 'date',
      sort_dir: 'desc',
      page,
      page_size: pageSize,
    }),
    [period, operatorFilter, resultFilter, page, pageSize]
  )

  const query = useThirdParty(filters, projectIdNum != null)
  const exportMutation = useExportThirdParty()

  const kpis = query.data?.kpis
  const rows = query.data?.items ?? []
  const total = query.data?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(total / pageSize))

  // Seek target for the transcript's timecodes (the modal delegates to its
  // embedded player).
  const callModalRef = useRef<CallRecordingModalHandle>(null)

  const modalCallData = useMemo(() => {
    if (!selected || !selected.call_id) return null
    return {
      type: t('pages.training.thirdParties.recordingType', 'Third-party call'),
      clientName: selected.primary_client_full_name ?? `#${selected.primary_client_id}`,
      clientId: selected.primary_client_id,
      date: selected.datetime,
      time: '',
      operator: selected.operator_name ?? '',
      duration: formatDuration(selected.duration_seconds),
      phone: selected.contacted_phone ?? '',
      call_id: selected.call_id,
    }
  }, [selected, t])

  return (
    <div className="flex flex-col gap-4">
      {/* KPI strip — 4 horizontal icon tiles */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <AnalyticsKpiTile
          label={t('pages.training.thirdParties.kpi.calls', 'Calls to 3 people')}
          value={kpis?.total_calls ?? 0}
          icon={<Icons.Call02 size={18} />}
          iconBg="bg-[#F7F7F7]"
          iconTone="text-[#05040D]"
        />
        <AnalyticsKpiTile
          label={t('pages.training.thirdParties.kpi.returned', 'Returned to the client')}
          value={kpis?.returned_to_client ?? 0}
          icon={<Icons.UserCheck01 size={18} />}
          iconBg="bg-[#EFF6FF]"
          iconTone="text-[#3B82F6]"
        />
        <AnalyticsKpiTile
          label={t('pages.training.thirdParties.kpi.didNotReturn', 'Did not return to the client')}
          value={kpis?.did_not_return ?? 0}
          icon={<Icons.User size={18} />}
          iconBg="bg-[#FEF2F2]"
          iconTone="text-[#EF4444]"
        />
        <AnalyticsKpiTile
          label={t('pages.training.thirdParties.kpi.positiveResult', 'Positive result')}
          value={kpis?.positive_count ?? 0}
          icon={<Icons.Success size={18} />}
          iconBg="bg-[#ECFDF5]"
          iconTone="text-[#22C55E]"
        />
      </div>

      {/* Filter strip — period + operator on left, result chips + export on right */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[#EBECE8] bg-white px-4 py-3 shadow-[0px_1px_2px_rgba(0,0,0,0.04)]">
        <div className="flex flex-wrap items-center gap-4">
          {PERIODS.map((p) => {
            const isActive = p.id === period
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => {
                  setPeriod(p.id)
                  resetPage()
                }}
                className="flex items-center gap-1.5 text-xs font-medium text-[#05040D]"
              >
                <span
                  className={`flex h-3.5 w-3.5 flex-shrink-0 items-center justify-center rounded-full border ${
                    isActive ? 'border-[#22C55E] bg-white' : 'border-[#DFDFDF] bg-white'
                  }`}
                >
                  {isActive ? <span className="block h-2 w-2 rounded-full bg-[#22C55E]" /> : null}
                </span>
                <span className={isActive ? 'text-[#05040D]' : 'text-[#676767]'}>
                  {t(p.key, p.fallback)}
                </span>
              </button>
            )
          })}

          <div className="relative min-w-[180px]">
            <select
              value={operatorFilter}
              onChange={(e) => {
                setOperatorFilter(e.target.value)
                resetPage()
              }}
              className="h-9 w-full appearance-none rounded-lg border border-[#EBECE8] bg-white px-3 pr-8 text-xs text-[#05040D] focus:outline-none"
            >
              <option value="all">
                {t('pages.training.thirdParties.filters.allOperators', 'All operators')}
              </option>
              {operators?.map((op) => (
                <option key={op.id} value={op.id}>
                  {op.full_name}
                </option>
              ))}
            </select>
            <Icons.ArrowDown
              size={12}
              className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-[#676767]"
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {RESULT_CHIPS.map((id) => {
            const isActive = resultFilter === id
            const label =
              id === 'all'
                ? t('pages.training.thirdParties.chips.allResults', 'All results')
                : t(RESULT_LABEL[id].key, RESULT_LABEL[id].fallback)
            return (
              <button
                key={id}
                type="button"
                onClick={() => {
                  setResultFilter(id)
                  resetPage()
                }}
                className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                  isActive ? 'bg-[#204E4D] text-white' : 'text-[#545454] hover:bg-[#F7F7F7]'
                }`}
              >
                {label}
                {id === 'all' ? (
                  <span
                    className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${
                      isActive ? 'bg-[#BBFB5B] text-[#05040D]' : 'bg-[#EDEDED] text-[#05040D]'
                    }`}
                  >
                    {kpis?.total_calls ?? 0}
                  </span>
                ) : null}
              </button>
            )
          })}

          <button
            type="button"
            onClick={() => exportMutation.mutate(filters)}
            disabled={exportMutation.isPending || total === 0}
            className="flex items-center gap-1.5 rounded-full border border-[#EBECE8] bg-white px-3 py-1.5 text-xs font-medium text-[#05040D] hover:bg-[#F7F7F7] disabled:opacity-50"
          >
            <Icons.Download size={14} />
            {exportMutation.isPending
              ? t('pages.training.thirdParties.exporting', 'Exporting…')
              : t('pages.training.thirdParties.export', 'Export')}
          </button>
        </div>
      </div>

      <AnalyticsMockTable>
        <thead className={ANALYTICS_TABLE_HEAD}>
          <tr>
            <th className={ANALYTICS_TABLE_TH}>
              {t('pages.training.thirdParties.cols.date', 'Date / Time')}
            </th>
            <th className={ANALYTICS_TABLE_TH}>
              {t('pages.training.thirdParties.cols.operator', 'Operator')}
            </th>
            <th className={ANALYTICS_TABLE_TH}>
              {t('pages.training.thirdParties.cols.clientMain', 'Client (main)')}
            </th>
            <th className={ANALYTICS_TABLE_TH}>
              {t('pages.training.thirdParties.cols.thirdPartyPhone', 'Third party phone')}
            </th>
            <th className={ANALYTICS_TABLE_TH}>
              {t('pages.training.thirdParties.cols.duration', 'Duration')}
            </th>
            <th className={ANALYTICS_TABLE_TH}>
              {t('pages.training.thirdParties.cols.result', 'Result')}
            </th>
            <th className={ANALYTICS_TABLE_TH}>
              {t('pages.training.thirdParties.cols.returned', 'Returned to the client')}
            </th>
          </tr>
        </thead>
        <tbody>
          {query.isLoading ? (
            <tr>
              <td colSpan={7} className="px-4 py-6 text-center text-[11px] text-[#9CA3AF]">
                {t('pages.training.thirdParties.loading', 'Loading…')}
              </td>
            </tr>
          ) : query.isError ? (
            <tr>
              <td colSpan={7} className="px-4 py-6 text-center text-[11px] text-[#EF4444]">
                {t('pages.training.thirdParties.loadFailed', 'Failed to load. Please retry.')}
              </td>
            </tr>
          ) : rows.length === 0 ? (
            <tr>
              <td colSpan={7} className="px-4 py-6 text-center text-[11px] text-[#9CA3AF]">
                {t('pages.training.thirdParties.empty', 'No third-party calls match the filters.')}
              </td>
            </tr>
          ) : (
            rows.map((row) => (
              <ThirdPartyRow
                key={row.id}
                row={row}
                onOpen={() => row.call_id && setSelected(row)}
                yesLabel={t('pages.training.thirdParties.returned.yes', 'Yes')}
                didNotReturnLabel={t('pages.training.thirdParties.returned.no', 'Did not return')}
              />
            ))
          )}
        </tbody>
      </AnalyticsMockTable>

      {total > pageSize ? (
        <Pagination
          currentPage={page}
          totalPages={totalPages}
          pageSize={pageSize}
          onPageChange={setPage}
          onPageSizeChange={setPageSize}
        />
      ) : null}

      {/* Call QA — third-party calls are exactly where a trainer wants the AI
        read of the conversation; the panel gates itself on `view_transcripts`
        plus the global Call QA switch. */}
      {selected && modalCallData ? (
        <CallRecordingModal
          ref={callModalRef}
          open
          onClose={() => setSelected(null)}
          callData={modalCallData}
          transcriptPanel={
            modalCallData.call_id ? (
              <CallTranscriptPanel
                callId={modalCallData.call_id}
                active
                onSeek={(ms) => callModalRef.current?.seekTo(ms)}
              />
            ) : undefined
          }
        />
      ) : null}
    </div>
  )
}

function ThirdPartyRow({
  row,
  onOpen,
  yesLabel,
  didNotReturnLabel,
}: {
  row: ThirdPartyItem
  onOpen: () => void
  yesLabel: string
  didNotReturnLabel: string
}) {
  const { t, i18n } = useTranslation('common')
  const operatorName = row.operator_name ?? (row.operator_id ? `#${row.operator_id}` : '—')
  const initials = row.operator_name ? deriveInitials(row.operator_name) : ''
  const chip = row.result_chip
  const isReturned = row.returned_to_client === 'yes'
  const clickable = !!row.call_id
  return (
    <tr
      className={`${ANALYTICS_TABLE_ROW} ${clickable ? 'cursor-pointer' : ''}`}
      onClick={clickable ? onOpen : undefined}
    >
      <td className={ANALYTICS_TABLE_TD}>{formatDateTime(row.datetime, i18n.language)}</td>
      <td className={ANALYTICS_TABLE_TD}>
        <div className="flex items-center gap-2">
          {initials ? (
            <span
              className="flex h-7 w-7 items-center justify-center rounded-full text-[10px] font-semibold text-[#05040D]"
              style={{ backgroundColor: avatarColorFor(row.operator_id) }}
            >
              {initials}
            </span>
          ) : null}
          <span className="text-xs font-medium text-[#05040D]">{operatorName}</span>
        </div>
      </td>
      <td className={`${ANALYTICS_TABLE_TD} text-[#3B82F6]`}>#{row.primary_client_id}</td>
      <td className={ANALYTICS_TABLE_TD}>
        <div className="flex flex-col leading-tight">
          <span className="font-medium text-[#05040D]">{row.contacted_phone ?? '—'}</span>
          {row.contact_relationship ? (
            <span className="text-[11px] text-[#676767]">{row.contact_relationship}</span>
          ) : null}
        </div>
      </td>
      <td className={ANALYTICS_TABLE_TD}>{formatDuration(row.duration_seconds)}</td>
      <td className={ANALYTICS_TABLE_TD}>
        {chip ? (
          <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${RESULT_TONE[chip]}`}>
            {t(RESULT_LABEL[chip].key, RESULT_LABEL[chip].fallback)}
          </span>
        ) : (
          '—'
        )}
      </td>
      <td className={ANALYTICS_TABLE_TD}>
        {isReturned ? (
          <div className="flex flex-col leading-tight">
            <span className="inline-flex w-fit items-center gap-1 text-[11px] font-medium text-emerald-600">
              <Icons.Success size={10} />
              {yesLabel}
            </span>
            {row.returned_at ? (
              <span className="mt-0.5 text-[10px] text-[#9CA3AF]">
                {formatDateTime(row.returned_at, i18n.language)}
              </span>
            ) : null}
          </div>
        ) : (
          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-[#EF4444]">
            <Icons.Close size={10} />
            {didNotReturnLabel}
          </span>
        )}
      </td>
    </tr>
  )
}

export default ThirdPartiesSubTab
