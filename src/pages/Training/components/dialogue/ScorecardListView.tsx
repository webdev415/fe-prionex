import { useTranslation } from 'react-i18next'
import { Icons } from '@/lib/icons'
import type { MockScorecardRow } from '../../mocks/trainerWorkplaceMocks'

/**
 * Left-pane scorecard list on the Dialogue Evaluation tab. Each row =
 * one completed scorecard with operator avatar, duration, score badge.
 */
export interface ScorecardListViewProps {
  rows: MockScorecardRow[]
  selectedId: number | null
  onSelect: (id: number) => void
}

const CATEGORY_TONE: Record<MockScorecardRow['category'], string> = {
  New: 'bg-blue-100 text-blue-700',
  Average: 'bg-amber-100 text-amber-700',
  Risk: 'bg-red-100 text-red-700',
}

function scoreToneClass(score: number): string {
  if (score >= 80) return 'bg-emerald-500'
  if (score >= 60) return 'bg-amber-400'
  return 'bg-red-500'
}

export function ScorecardListView({ rows, selectedId, onSelect }: ScorecardListViewProps) {
  const { t } = useTranslation('common')

  return (
    <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white">
      <table className="w-full text-xs">
        <thead className="bg-gray-50 text-left text-[10px] text-gray-500 uppercase">
          <tr>
            <th className="px-3 py-2">{t('pages.training.dialogue.list.date', 'Date')}</th>
            <th className="px-3 py-2">{t('pages.training.dialogue.list.operator', 'Operator')}</th>
            <th className="px-3 py-2">{t('pages.training.dialogue.list.category', 'Category')}</th>
            <th className="px-3 py-2">{t('pages.training.dialogue.list.duration', 'Duration')}</th>
            <th className="px-3 py-2">{t('pages.training.dialogue.list.trigger', 'Trigger')}</th>
            <th className="px-3 py-2 text-right">
              {t('pages.training.dialogue.list.score', 'Score')}
            </th>
            <th className="px-3 py-2 text-right">
              {t('pages.training.dialogue.list.actions', '')}
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
                className={`cursor-pointer border-t border-gray-100 transition-colors ${
                  isActive ? 'bg-primary-50/40' : 'hover:bg-gray-50'
                }`}
              >
                <td className="px-3 py-2 text-gray-600">{row.dateLabel}</td>
                <td className="px-3 py-2">
                  <div className="flex items-center gap-2">
                    <div
                      className="flex h-7 w-7 items-center justify-center rounded-full text-[10px] font-semibold text-gray-700"
                      style={{ backgroundColor: row.avatarColor }}
                    >
                      {row.operatorInitials}
                    </div>
                    <span className="text-dark-500 text-xs font-medium">{row.operatorName}</span>
                  </div>
                </td>
                <td className="px-3 py-2">
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${CATEGORY_TONE[row.category]}`}
                  >
                    {row.category}
                  </span>
                </td>
                <td className="px-3 py-2 text-gray-600">{row.duration}</td>
                <td className="px-3 py-2 text-gray-600">{row.trigger}</td>
                <td className="px-3 py-2 text-right">
                  <span
                    className={`inline-flex h-7 w-12 items-center justify-center rounded-full text-[10px] font-semibold text-white ${scoreToneClass(row.score)}`}
                  >
                    {row.score}/{row.scoreOutOf}
                  </span>
                </td>
                <td className="px-3 py-2 text-right">
                  <span className="bg-primary-50 text-primary-700 inline-flex h-7 w-7 items-center justify-center rounded-full">
                    <Icons.PlayCircle02 size={14} />
                  </span>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

export default ScorecardListView
