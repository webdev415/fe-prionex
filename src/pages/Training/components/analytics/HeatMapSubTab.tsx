import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Icons } from '@/lib/icons'
import { useAuthStore } from '@/stores/authStore'
import { useOperators } from '@/features/users/hooks'
import { useHeatmap } from '@/features/operatorAnalytics/hooks/useHeatmap'
import type {
  HeatmapResponse,
  HeatmapState as BackendHeatmapState,
} from '@/features/operatorAnalytics/types'

/**
 * Heat Map sub-tab (KAN-731 Block 2 — wired to /api/v1/analytics/heatmap).
 *
 * UI parity with the prior MockHeatMapSubTab is preserved: state legend chips
 * on the left, department dropdown on the right, hour×operator grid below
 * with the same color scheme and left-edge accent inset.
 */

// UI-side state vocabulary preserved from the mock (six states including
// `offline` for hours where the BE returned no data).
type UiHeatmapState = 'call' | 'after_call' | 'waiting' | 'idle' | 'break' | 'offline'

const STATE_BG: Record<UiHeatmapState, string> = {
  call: 'bg-[#D1FAE5]',
  after_call: 'bg-[#DBEAFE]',
  waiting: 'bg-[#FEF3C7]',
  idle: 'bg-[#FEE2E2]',
  break: 'bg-[#E5E7EB]',
  offline: 'bg-[#F3F4F6]',
}

const STATE_ACCENT: Record<UiHeatmapState, string> = {
  call: '#86EFAC',
  after_call: '#93C5FD',
  waiting: '#FCD34D',
  idle: '#FCA5A5',
  break: '#CBD5E1',
  offline: '#E5E7EB',
}

const STATE_DOT: Record<UiHeatmapState, string> = {
  call: 'bg-[#22C55E]',
  after_call: 'bg-[#3B82F6]',
  waiting: 'bg-[#F59E0B]',
  idle: 'bg-[#EF4444]',
  break: 'bg-[#9CA3AF]',
  offline: 'bg-white border border-[#D1D5DB]',
}

const STATE_ORDER: UiHeatmapState[] = ['call', 'after_call', 'waiting', 'idle', 'break', 'offline']

const STATE_LABEL: Record<UiHeatmapState, { key: string; fallback: string }> = {
  call: { key: 'pages.training.heatmap.state.call', fallback: 'Call' },
  after_call: { key: 'pages.training.heatmap.state.afterCall', fallback: 'After the call' },
  waiting: { key: 'pages.training.heatmap.state.waiting', fallback: 'Waiting' },
  idle: { key: 'pages.training.heatmap.state.idle', fallback: 'Idle' },
  break: { key: 'pages.training.heatmap.state.break', fallback: 'Break' },
  offline: { key: 'pages.training.heatmap.state.offline', fallback: 'Offline' },
}

// BE returns 5 states (`active_call` / `post_call` / waiting / idle / break);
// map to the 6-state UI vocabulary. `offline` is synthesised for hours that
// have no bucket on the response.
const BACKEND_TO_UI_STATE: Record<BackendHeatmapState, UiHeatmapState> = {
  active_call: 'call',
  post_call: 'after_call',
  waiting: 'waiting',
  idle: 'idle',
  break: 'break',
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

const FALLBACK_HOURS = [
  '8:00',
  '9:00',
  '10:00',
  '11:00',
  '12:00',
  '13:00',
  '14:00',
  '15:00',
  '16:00',
  '17:00',
]

function deriveInitials(fullName: string): string {
  const parts = fullName.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase()
}

function avatarColorFor(operatorId: number): string {
  return AVATAR_PALETTE[Math.abs(operatorId) % AVATAR_PALETTE.length]
}

/** "HH:00" → "H:00" to match the mock's column-header style. */
function formatHourLabel(hour: string): string {
  const match = /^0?(\d{1,2}):(\d{2})/.exec(hour)
  if (!match) return hour
  return `${parseInt(match[1], 10)}:${match[2]}`
}

interface OperatorRow {
  id: number
  name: string
  initials: string
  avatarColor: string
  states: UiHeatmapState[]
}

function buildRows(
  data: HeatmapResponse | undefined,
  operatorNameById: Map<number, string>,
  hourOrder: string[]
): OperatorRow[] {
  if (!data) return []
  return data.operators.map((op) => {
    const stateByHour = new Map<string, UiHeatmapState>()
    op.hours.forEach((bucket) => {
      stateByHour.set(bucket.hour, BACKEND_TO_UI_STATE[bucket.dominant_state] ?? 'offline')
    })
    const states = hourOrder.map<UiHeatmapState>((hr) => stateByHour.get(hr) ?? 'offline')
    const name = operatorNameById.get(op.operator_id) ?? `#${op.operator_id}`
    return {
      id: op.operator_id,
      name,
      initials: deriveInitials(name),
      avatarColor: avatarColorFor(op.operator_id),
      states,
    }
  })
}

export function HeatMapSubTab() {
  const { t } = useTranslation('common')
  const [department, setDepartment] = useState('all')

  const activeProjectId = useAuthStore((s) => s.user?.active_project_id)
  const projectIdNum = activeProjectId ? Number(activeProjectId) : null

  const { data: operators = [] } = useOperators(projectIdNum)

  // Department filter is FE-only for v1 — the analytics-service heatmap
  // endpoint doesn't accept a `department_ids` parameter yet (flagged as a
  // KAN-731 follow-up in the spec). We narrow the operator_ids list before
  // querying so the cells still react to the picker.
  const filteredOperatorIds = useMemo<number[] | undefined>(() => {
    if (department === 'all') return undefined
    return operators
      .filter((op) => (op.department_name ?? '').toLowerCase() === department)
      .map((op) => op.id)
  }, [operators, department])

  const heatmapQuery = useHeatmap(
    {
      period: 'today',
      operator_ids: filteredOperatorIds,
    },
    projectIdNum != null
  )

  const operatorNameById = useMemo(() => {
    const m = new Map<number, string>()
    operators.forEach((op) => m.set(op.id, op.full_name))
    return m
  }, [operators])

  // Derive the hour axis from the first operator's buckets so the columns
  // reflect the actual analytics window (BE may return any HH:00 range).
  const hourOrder = useMemo<string[]>(() => {
    const first = heatmapQuery.data?.operators[0]
    if (!first || first.hours.length === 0) return FALLBACK_HOURS
    return first.hours.map((b) => b.hour)
  }, [heatmapQuery.data])

  const rows = useMemo<OperatorRow[]>(
    () => buildRows(heatmapQuery.data, operatorNameById, hourOrder),
    [heatmapQuery.data, operatorNameById, hourOrder]
  )

  // Departments come from the operators list so the picker matches the
  // active project rather than a hardcoded mock. "All departments" stays
  // pinned at the top.
  const departmentOptions = useMemo<{ value: string; label: string }[]>(() => {
    const seen = new Map<string, string>()
    operators.forEach((op) => {
      if (op.department_name) seen.set(op.department_name.toLowerCase(), op.department_name)
    })
    return Array.from(seen, ([value, label]) => ({ value, label }))
  }, [operators])

  return (
    <div className="flex flex-col gap-4">
      {/* Top strip — state legend + department dropdown */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[#EBECE8] bg-white px-4 py-3 shadow-[0px_1px_2px_rgba(0,0,0,0.04)]">
        <div className="flex flex-wrap items-center gap-4">
          <span className="text-xs font-medium tracking-[-0.02em] text-[#05040D]">
            {t('pages.training.heatmap.stand', 'Stand')}:
          </span>
          {STATE_ORDER.map((s) => (
            <span key={s} className="flex items-center gap-1.5 text-xs text-[#05040D]">
              <span className={`block h-2.5 w-2.5 rounded-full ${STATE_DOT[s]}`} aria-hidden />
              {t(STATE_LABEL[s].key, STATE_LABEL[s].fallback)}
            </span>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs font-medium tracking-[-0.02em] text-[#05040D]">
            {t('pages.training.heatmap.department', 'Department')}
          </span>
          <div className="relative min-w-[180px]">
            <select
              value={department}
              onChange={(e) => setDepartment(e.target.value)}
              className="h-9 w-full appearance-none rounded-lg border border-[#EBECE8] bg-white px-3 pr-8 text-xs text-[#05040D] focus:outline-none"
            >
              <option value="all">
                {t('pages.training.heatmap.allDepartments', 'All departments')}
              </option>
              {departmentOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            <Icons.ArrowDown
              size={12}
              className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-[#676767]"
            />
          </div>
        </div>
      </div>

      {/* Heatmap card */}
      <div className="overflow-hidden rounded-xl border border-[#EBECE8] bg-white p-4 shadow-[0px_1px_2px_rgba(0,0,0,0.04)]">
        <div className="mb-4">
          <h3 className="text-sm font-semibold text-[#05040D]">
            {t('pages.training.heatmap.title', 'Heatmap of activity')}
          </h3>
          <p className="text-[11px] text-[#676767]">
            {t('pages.training.heatmap.subtitle', 'Dominant state by hour · today')}
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full border-separate border-spacing-y-2">
            <thead>
              <tr>
                <th className="w-44" />
                {hourOrder.map((hr) => (
                  <th key={hr} className="px-1 text-center text-[10px] font-medium text-[#676767]">
                    {formatHourLabel(hr)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {heatmapQuery.isLoading && rows.length === 0 ? (
                <tr>
                  <td
                    colSpan={hourOrder.length + 1}
                    className="py-6 text-center text-xs text-[#676767]"
                  >
                    {t('pages.training.heatmap.loading', 'Loading…')}
                  </td>
                </tr>
              ) : heatmapQuery.isError ? (
                <tr>
                  <td
                    colSpan={hourOrder.length + 1}
                    className="py-6 text-center text-xs text-[#EF4444]"
                  >
                    {t(
                      'pages.training.heatmap.loadFailed',
                      'Failed to load heatmap. Please retry.'
                    )}
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td
                    colSpan={hourOrder.length + 1}
                    className="py-6 text-center text-xs text-[#676767]"
                  >
                    {t(
                      'pages.training.heatmap.empty',
                      'No activity in the selected window — operators may be offline or outside working hours.'
                    )}
                  </td>
                </tr>
              ) : (
                rows.map((op) => (
                  <tr key={op.id}>
                    <td className="pr-3 align-middle">
                      <div className="flex items-center gap-2">
                        <span
                          className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full text-[10px] font-semibold text-[#05040D]"
                          style={{ backgroundColor: op.avatarColor }}
                        >
                          {op.initials}
                        </span>
                        <span className="text-xs font-medium text-[#05040D]">{op.name}</span>
                      </div>
                    </td>
                    {op.states.map((state, idx) => (
                      <td key={idx} className="px-0.5 align-middle">
                        <span
                          className={`block h-7 w-full rounded-md ${STATE_BG[state]}`}
                          style={{ boxShadow: `inset 3px 0 0 ${STATE_ACCENT[state]}` }}
                          title={`${op.name} · ${formatHourLabel(hourOrder[idx])} · ${t(
                            STATE_LABEL[state].key,
                            STATE_LABEL[state].fallback
                          )}`}
                        />
                      </td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

export default HeatMapSubTab
