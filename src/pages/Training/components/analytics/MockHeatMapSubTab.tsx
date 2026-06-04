import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Icons } from '@/lib/icons'
import {
  HEATMAP_HOURS,
  MOCK_HEATMAP_OPERATORS,
  type HeatmapState,
} from '../../mocks/trainerWorkplaceMocks'

/**
 * Mock Heat Map sub-tab (KAN-502). Mirrors the Figma frame:
 *   1) Top strip — state legend chips (Call / After the call / Waiting /
 *      Idle / Break / Offline) on the left, "Department" dropdown on the
 *      right.
 *   2) Heatmap title + subtitle ("Dominant state by hour - today").
 *   3) Grid — rows are operators (avatar + name), columns are hours, each
 *      cell colored by the dominant state for that hour.
 */

const STATE_BG: Record<HeatmapState, string> = {
  call: 'bg-[#D1FAE5]',
  after_call: 'bg-[#DBEAFE]',
  waiting: 'bg-[#FEF3C7]',
  idle: 'bg-[#FEE2E2]',
  break: 'bg-[#E5E7EB]',
  offline: 'bg-[#F3F4F6]',
}

/** Darker accent color for the left-edge inset of each heatmap cell. */
const STATE_ACCENT: Record<HeatmapState, string> = {
  call: '#86EFAC',
  after_call: '#93C5FD',
  waiting: '#FCD34D',
  idle: '#FCA5A5',
  break: '#CBD5E1',
  offline: '#E5E7EB',
}

const STATE_DOT: Record<HeatmapState, string> = {
  call: 'bg-[#22C55E]',
  after_call: 'bg-[#3B82F6]',
  waiting: 'bg-[#F59E0B]',
  idle: 'bg-[#EF4444]',
  break: 'bg-[#9CA3AF]',
  offline: 'bg-white border border-[#D1D5DB]',
}

const STATE_ORDER: HeatmapState[] = ['call', 'after_call', 'waiting', 'idle', 'break', 'offline']

const STATE_LABEL: Record<HeatmapState, { key: string; fallback: string }> = {
  call: { key: 'pages.training.heatmap.state.call', fallback: 'Call' },
  after_call: { key: 'pages.training.heatmap.state.afterCall', fallback: 'After the call' },
  waiting: { key: 'pages.training.heatmap.state.waiting', fallback: 'Waiting' },
  idle: { key: 'pages.training.heatmap.state.idle', fallback: 'Idle' },
  break: { key: 'pages.training.heatmap.state.break', fallback: 'Break' },
  offline: { key: 'pages.training.heatmap.state.offline', fallback: 'Offline' },
}

export function MockHeatMapSubTab() {
  const { t } = useTranslation('common')
  const [department, setDepartment] = useState('all')

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
              <option value="hard">Hard Collection</option>
              <option value="soft">Soft Collection</option>
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
                {HEATMAP_HOURS.map((hr) => (
                  <th key={hr} className="px-1 text-center text-[10px] font-medium text-[#676767]">
                    {hr}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {MOCK_HEATMAP_OPERATORS.map((op) => (
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
                        title={`${op.name} · ${HEATMAP_HOURS[idx]} · ${t(STATE_LABEL[state].key, STATE_LABEL[state].fallback)}`}
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

export default MockHeatMapSubTab
