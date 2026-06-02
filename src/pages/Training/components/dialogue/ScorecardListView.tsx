import { useTranslation } from 'react-i18next'
import { Icons } from '@/lib/icons'
import type { MockScorecardRow } from '../../mocks/trainerWorkplaceMocks'
import {
  ANALYTICS_TABLE_HEAD,
  ANALYTICS_TABLE_ROW,
  ANALYTICS_TABLE_TD,
  ANALYTICS_TABLE_TH,
} from '../analytics/analyticsTableStyles'
import { AnalyticsMockTable } from '../analytics/AnalyticsMockTable'

export interface ScorecardListViewProps {
  rows: MockScorecardRow[]
  selectedId: number | null
  onSelect: (id: number) => void
}

const CATEGORY_TONE: Record<MockScorecardRow['category'], string> = {
  New: 'bg-[#EFF6FF] text-[#2563EB]',
  Average: 'bg-[#FFFBEB] text-[#D97706]',
  Risk: 'bg-[#FEF2F2] text-[#B91C1C]',
}

function scoreBadgeClass(score: number): string {
  if (score >= 80) return 'bg-[#15803D] text-white'
  if (score >= 60) return 'bg-[#EAB308] text-[#05040D]'
  return 'bg-[#EF4444] text-white'
}

/** Figma left pane — table with #F7F7F7 header, lime selected tint, score + action icons. */
export function ScorecardListView({ rows, selectedId, onSelect }: ScorecardListViewProps) {
  const { t } = useTranslation('common')

  return (
    <AnalyticsMockTable>
      <thead className={ANALYTICS_TABLE_HEAD}>
        <tr>
          <th className={ANALYTICS_TABLE_TH}>{t('pages.training.dialogue.list.date', 'Date')}</th>
          <th className={ANALYTICS_TABLE_TH}>
            {t('pages.training.dialogue.list.operator', 'Operator')}
          </th>
          <th className={ANALYTICS_TABLE_TH}>
            {t('pages.training.dialogue.list.category', 'Category')}
          </th>
          <th className={ANALYTICS_TABLE_TH}>
            {t('pages.training.dialogue.list.duration', 'Duration')}
          </th>
          <th className={ANALYTICS_TABLE_TH}>
            {t('pages.training.dialogue.list.trigger', 'Trigger')}
          </th>
          <th className={`${ANALYTICS_TABLE_TH} text-right`}>
            {t('pages.training.dialogue.list.score', 'Score')}
          </th>
          <th className={ANALYTICS_TABLE_TH}>
            {t('pages.training.dialogue.list.example', 'Example')}
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
              className={`${ANALYTICS_TABLE_ROW} cursor-pointer ${isActive ? 'bg-[#F7FFE5]' : ''}`}
            >
              <td className={ANALYTICS_TABLE_TD}>{row.dateLabel}</td>
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
              <td className={ANALYTICS_TABLE_TD}>{row.duration}</td>
              <td className={ANALYTICS_TABLE_TD}>{row.trigger}</td>
              <td className={`${ANALYTICS_TABLE_TD} text-right`}>
                <div className="flex items-center justify-end gap-1.5">
                  {row.scoreDelta != null ? (
                    <span
                      className={`text-[10px] font-semibold ${
                        row.scoreDelta >= 0 ? 'text-[#15803D]' : 'text-[#B91C1C]'
                      }`}
                    >
                      {row.scoreDelta >= 0 ? '+' : ''}
                      {row.scoreDelta}
                    </span>
                  ) : null}
                  <span
                    className={`inline-flex min-w-[3rem] items-center justify-center rounded-full px-2 py-1 text-[10px] font-semibold ${scoreBadgeClass(row.score)}`}
                  >
                    {row.score}/{row.scoreOutOf}
                  </span>
                </div>
              </td>
              <td className={`${ANALYTICS_TABLE_TD} max-w-[120px] truncate text-[#4B5563]`}>
                {row.exampleLabel ?? '—'}
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
