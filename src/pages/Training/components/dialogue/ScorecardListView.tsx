import { useTranslation } from 'react-i18next'
import { Icons } from '@/lib/icons'
import type { DialogueScorecardRow } from '../../lib/dialogueScorecardAdapter'
import {
  ANALYTICS_TABLE_HEAD,
  ANALYTICS_TABLE_ROW,
  ANALYTICS_TABLE_TD,
  ANALYTICS_TABLE_TH,
} from '../analytics/analyticsTableStyles'
import { AnalyticsMockTable } from '../analytics/AnalyticsMockTable'

export interface ScorecardListViewProps {
  rows: DialogueScorecardRow[]
  selectedId: number | null
  onSelect: (id: number) => void
}

const CATEGORY_TONE: Record<DialogueScorecardRow['category'], string> = {
  High: 'bg-[#ECFDF5] text-[#15803D]',
  Average: 'bg-[#FFFBEB] text-[#D97706]',
  Low: 'bg-[#FEF2F2] text-[#B91C1C]',
  Unscored: 'bg-gray-100 text-gray-500',
}

/** Figma score-ring tones — stroke + text both tinted by the band. */
function scoreBandTones(score: number): { ring: string; text: string } {
  if (score >= 80) return { ring: 'stroke-[#15803D]', text: 'text-[#15803D]' }
  if (score >= 60) return { ring: 'stroke-[#EAB308]', text: 'text-[#A16207]' }
  return { ring: 'stroke-[#EF4444]', text: 'text-[#B91C1C]' }
}

interface ScoreRingProps {
  score: number
  outOf: number
  hasScore: boolean
}

function ScoreRing({ score, outOf, hasScore }: ScoreRingProps) {
  const radius = 18
  const circumference = 2 * Math.PI * radius
  // Unscored drafts: empty grey ring with a "—", not a misleading 0.
  const offset = hasScore ? circumference - (score / outOf) * circumference : circumference
  const tones = hasScore
    ? scoreBandTones(score)
    : { ring: 'stroke-[#EDEDED]', text: 'text-gray-400' }
  return (
    <div className="relative h-11 w-11 flex-shrink-0">
      <svg viewBox="0 0 44 44" className="h-11 w-11 -rotate-90">
        <circle
          cx="22"
          cy="22"
          r={radius}
          strokeWidth="3"
          fill="none"
          className="stroke-[#EDEDED]"
        />
        <circle
          cx="22"
          cy="22"
          r={radius}
          strokeWidth="3"
          fill="none"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className={tones.ring}
        />
      </svg>
      <span
        className={`absolute inset-0 flex items-center justify-center text-[11px] font-semibold ${tones.text}`}
      >
        {hasScore ? score : '—'}
      </span>
    </div>
  )
}

/** Figma left pane — table with #F7F7F7 header, lime selected tint, score + action icons. */
export function ScorecardListView({ rows, selectedId, onSelect }: ScorecardListViewProps) {
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
          <th className={ANALYTICS_TABLE_TH}>
            {t('pages.training.dialogue.list.category', 'Category')}
          </th>
          <th className={`${ANALYTICS_TABLE_TH} text-right`}>
            {t('pages.training.dialogue.list.rating', 'Rating')}
          </th>
          <th className={ANALYTICS_TABLE_TH}>
            {t('pages.training.dialogue.list.comment', 'Comment')}
          </th>
          <th className={`${ANALYTICS_TABLE_TH} text-right`}>
            {t('pages.training.dialogue.list.actions', 'Actions')}
          </th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => {
          const isActive = row.id === selectedId
          return (
            <tr
              key={row.id}
              onClick={() => onSelect(row.id)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  onSelect(row.id)
                }
              }}
              role="button"
              tabIndex={0}
              aria-current={isActive || undefined}
              className={`${ANALYTICS_TABLE_ROW} cursor-pointer ${isActive ? 'bg-[#F7FFE5]' : ''}`}
            >
              <td className={ANALYTICS_TABLE_TD}>
                <div className="flex flex-col leading-tight">
                  <span className="text-xs font-medium text-[#05040D]">{row.dateLabel}</span>
                  <span className="text-[10px] text-[#6B7280]">{row.timeLabel}</span>
                </div>
              </td>
              <td className={ANALYTICS_TABLE_TD}>
                <div className="flex items-center gap-2">
                  <div
                    className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full text-[10px] font-semibold text-[#05040D]"
                    style={{ backgroundColor: row.avatarColor }}
                  >
                    {row.operatorInitials}
                  </div>
                  <span className="text-xs font-medium text-[#05040D]">{row.operatorName}</span>
                </div>
              </td>
              <td className={ANALYTICS_TABLE_TD}>
                <span
                  className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${CATEGORY_TONE[row.category]}`}
                >
                  {row.category}
                </span>
              </td>
              <td className={`${ANALYTICS_TABLE_TD} text-right`}>
                <div className="flex items-center justify-end gap-2">
                  <ScoreRing score={row.score} outOf={row.scoreOutOf} hasScore={row.hasScore} />
                </div>
              </td>
              <td className={`${ANALYTICS_TABLE_TD} max-w-[160px] truncate text-[#4B5563]`}>
                {row.comment ?? '—'}
              </td>
              <td className={`${ANALYTICS_TABLE_TD} text-right`}>
                <div className="flex justify-end gap-1">
                  <span className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-[#204E4D]/20 text-[#204E4D]">
                    <Icons.Mic02 size={12} />
                  </span>
                  <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-[#F0FDF4] text-[#204E4D]">
                    <Icons.View size={12} />
                  </span>
                </div>
              </td>
            </tr>
          )
        })}
      </tbody>
    </AnalyticsMockTable>
  )
}

export default ScorecardListView
