import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  HEATMAP_DAYS,
  HEATMAP_HOURS,
  MOCK_HEATMAP_GRID,
  MOCK_HEATMAP_PEAK,
  MOCK_HEATMAP_TOTALS,
} from '../../mocks/trainerWorkplaceMocks'
import { PeriodFilterStrip, type PeriodOption } from './PeriodFilterStrip'

/**
 * Mock Heat Map sub-tab (KAN-502). 7 day × 14 hour interaction-volume grid
 * with a green ramp legend. Replaces the legacy operator × time HeatmapTab
 * per the redesign — team-level call volume by weekday/hour.
 */
const RAMP_CLASSES = [
  'bg-gray-100',
  'bg-emerald-100',
  'bg-emerald-200',
  'bg-emerald-300',
  'bg-emerald-500',
  'bg-emerald-700',
]

function bucketFor(value: number, max: number): number {
  if (max === 0 || value === 0) return 0
  const ratio = value / max
  if (ratio < 0.15) return 1
  if (ratio < 0.35) return 2
  if (ratio < 0.55) return 3
  if (ratio < 0.8) return 4
  return 5
}

export function MockHeatMapSubTab() {
  const { t } = useTranslation('common')
  const [period, setPeriod] = useState<PeriodOption>('today')
  const [department, setDepartment] = useState('all')

  const flat = MOCK_HEATMAP_GRID.flat()
  const maxVal = Math.max(...flat)

  return (
    <div className="flex flex-col gap-4">
      <PeriodFilterStrip
        value={period}
        onChange={setPeriod}
        rightSlot={
          <div className="flex items-center gap-2">
            <span className="text-[10px] tracking-wide text-gray-500 uppercase">
              {t('pages.training.heatmap.department', 'Department')}
            </span>
            <select
              value={department}
              onChange={(e) => setDepartment(e.target.value)}
              className="h-8 rounded-lg border border-[#DFDFDF] bg-white px-3 text-xs text-[#05040D] focus:outline-none"
            >
              <option value="all">
                {t('pages.training.heatmap.allDepartments', 'All departments')}
              </option>
              <option value="hard">Hard Collection</option>
              <option value="soft">Soft Collection</option>
            </select>
          </div>
        }
      />

      {/* KPI strip */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <KpiTile
          label={t('pages.training.heatmap.kpi.totalInteractions', 'Total interactions')}
          value={MOCK_HEATMAP_TOTALS.totalInteractions.toLocaleString()}
          tone="text-dark-500"
        />
        <KpiTile
          label={t('pages.training.heatmap.kpi.workingHours', 'Working hours')}
          value={MOCK_HEATMAP_TOTALS.workingHours}
          tone="text-blue-600"
        />
        <KpiTile
          label={t('pages.training.heatmap.kpi.peakSlot', 'Peak slot')}
          value={`${MOCK_HEATMAP_PEAK.day} · ${MOCK_HEATMAP_PEAK.hour}`}
          tone="text-emerald-600"
        />
      </div>

      {/* Heatmap card */}
      <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
        <div className="mb-4 flex items-baseline justify-between">
          <div>
            <h3 className="text-dark-500 text-sm font-semibold">
              {t('pages.training.heatmap.title', 'Call volume by weekday & hour')}
            </h3>
            <p className="text-[11px] text-gray-500">
              {t(
                'pages.training.heatmap.subtitle',
                'Darker cells indicate higher interaction volume.'
              )}
            </p>
          </div>
          <Legend />
        </div>

        <div className="overflow-x-auto">
          <table className="w-full border-separate border-spacing-1">
            <thead>
              <tr>
                <th className="w-12" />
                {HEATMAP_HOURS.map((hr) => (
                  <th key={hr} className="text-[9px] font-medium text-gray-500">
                    {hr}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {HEATMAP_DAYS.map((day, dIdx) => (
                <tr key={day}>
                  <td className="pr-2 text-right text-[10px] font-medium text-gray-600">{day}</td>
                  {HEATMAP_HOURS.map((hr, hIdx) => {
                    const value = MOCK_HEATMAP_GRID[dIdx][hIdx]
                    const bucket = bucketFor(value, maxVal)
                    return (
                      <td
                        key={`${day}-${hr}`}
                        className={`h-7 rounded-md ${RAMP_CLASSES[bucket]} relative`}
                        title={`${day} ${hr} — ${value} interactions`}
                      >
                        <span className="sr-only">{value}</span>
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

function KpiTile({ label, value, tone }: { label: string; value: string; tone: string }) {
  return (
    <div className="flex flex-col gap-1 rounded-2xl border border-gray-100 bg-white p-3 shadow-sm">
      <span className="text-[10px] tracking-wide text-gray-500 uppercase">{label}</span>
      <span className={`text-lg font-semibold ${tone}`}>{value}</span>
    </div>
  )
}

function Legend() {
  const { t } = useTranslation('common')
  return (
    <div className="flex items-center gap-2 text-[10px] text-gray-500">
      <span>{t('pages.training.heatmap.legend.less', 'Less')}</span>
      {RAMP_CLASSES.map((cls, idx) => (
        <span key={idx} className={`block h-3 w-3 rounded ${cls}`} />
      ))}
      <span>{t('pages.training.heatmap.legend.more', 'More')}</span>
    </div>
  )
}

export default MockHeatMapSubTab
