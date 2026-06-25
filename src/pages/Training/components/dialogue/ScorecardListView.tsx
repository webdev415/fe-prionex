import { type ReactElement } from 'react'
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
}

/** Figma score-ring tones — stroke + text both tinted by the band. */
function scoreBandTones(score: number): { ring: string; text: string } {
  if (score >= 80) return { ring: 'stroke-[#15803D]', text: 'text-[#15803D]' }
  if (score >= 60) return { ring: 'stroke-[#EAB308]', text: 'text-[#A16207]' }
  return { ring: 'stroke-[#EF4444]', text: 'text-[#B91C1C]' }
}

/** Per-trigger glyph + tint — matches the small icon set in the Figma row. */
type TriggerFlagKey = keyof NonNullable<DialogueScorecardRow['triggerFlags']>

const TRIGGER_ICONS: {
  key: TriggerFlagKey
  icon: (props: { size?: number; className?: string }) => ReactElement
  tone: string
  bg: string
}[] = [
  { key: 'promise', icon: Icons.TransactionHistory, tone: 'text-[#15803D]', bg: 'bg-[#ECFDF5]' },
  { key: 'refusal', icon: Icons.Close, tone: 'text-[#B91C1C]', bg: 'bg-[#FEF2F2]' },
  { key: 'missedCall', icon: Icons.CallEnd, tone: 'text-[#C2410C]', bg: 'bg-[#FFF7ED]' },
  { key: 'willPass', icon: Icons.UserCheck01, tone: 'text-[#6D28D9]', bg: 'bg-[#F5F3FF]' },
  { key: 'flagged', icon: Icons.Warning, tone: 'text-[#B91C1C]', bg: 'bg-[#FEF2F2]' },
]

interface ScoreRingProps {
  score: number
  outOf: number
}

function ScoreRing({ score, outOf }: ScoreRingProps) {
  const radius = 18
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (score / outOf) * circumference
  const tones = scoreBandTones(score)
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
        {score}
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
              <td className={ANALYTICS_TABLE_TD}>
                <div className="flex items-center gap-1">
                  {TRIGGER_ICONS.filter((tr) => row.triggerFlags?.[tr.key]).map((tr) => {
                    const TrIcon = tr.icon
                    return (
                      <span
                        key={tr.key}
                        className={`inline-flex h-5 w-5 items-center justify-center rounded-full ${tr.bg}`}
                        title={tr.key}
                      >
                        <TrIcon size={10} className={tr.tone} />
                      </span>
                    )
                  })}
                  {!Object.values(row.triggerFlags ?? {}).some(Boolean) ? (
                    <span className="text-[11px] text-[#6B7280]">{row.trigger}</span>
                  ) : null}
                </div>
              </td>
              <td className={`${ANALYTICS_TABLE_TD} text-right`}>
                <div className="flex items-center justify-end gap-2">
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
                  <ScoreRing score={row.score} outOf={row.scoreOutOf} />
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
