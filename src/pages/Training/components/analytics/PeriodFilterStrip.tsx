import { useTranslation } from 'react-i18next'
import { Icons } from '@/lib/icons'
import { AnalyticsRadioChips, type AnalyticsRadioChipItem } from './AnalyticsRadioChips'

/**
 * Shared period selector used by every Action Analysis sub-tab. Mirrors the
 * Figma white filter bar with period pills + optional status radio chips.
 */
export type PeriodOption = 'today' | 'yesterday' | '7d' | '30d' | 'custom'

export interface PeriodFilterStripProps {
  value?: PeriodOption
  onChange?: (next: PeriodOption) => void
  extraChips?: AnalyticsRadioChipItem[]
  statusLabel?: string
  rightSlot?: React.ReactNode
}

const PERIODS: { id: PeriodOption; key: string; fallback: string }[] = [
  { id: 'today', key: 'pages.training.period.today', fallback: 'Today' },
  { id: 'yesterday', key: 'pages.training.period.yesterday', fallback: 'Yesterday' },
  { id: '7d', key: 'pages.training.period.7days', fallback: '7 days' },
  { id: '30d', key: 'pages.training.period.30days', fallback: '30 days' },
  { id: 'custom', key: 'pages.training.period.custom', fallback: 'Custom' },
]

export function PeriodFilterStrip({
  value = 'today',
  onChange,
  extraChips = [],
  statusLabel,
  rightSlot,
}: PeriodFilterStripProps) {
  const { t } = useTranslation('common')

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[#EBECE8] bg-white px-4 py-3 shadow-[0px_1px_2px_rgba(0,0,0,0.04)]">
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-xs font-medium tracking-[-0.02em] text-[#05040D]">
          {t('pages.training.period.label', 'Period')}
        </span>
        <div className="inline-flex flex-wrap gap-1 rounded-md border border-[#EBECE8] bg-[#F7F7F7] p-0.5">
          {PERIODS.map((p) => {
            const isActive = p.id === value
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => onChange?.(p.id)}
                className={`flex items-center gap-1 rounded px-3 py-1.5 text-xs font-medium tracking-[-0.02em] transition-colors ${
                  isActive ? 'bg-[#204E4D] text-white shadow-sm' : 'text-[#545454] hover:bg-white'
                }`}
              >
                {p.id === 'custom' ? (
                  <Icons.Calendar
                    size={12}
                    className={isActive ? 'text-white' : 'text-[#676767]'}
                  />
                ) : null}
                {t(p.key, p.fallback)}
              </button>
            )
          })}
        </div>
        {extraChips.length > 0 ? (
          <>
            <span className="hidden h-6 w-px bg-[#EDEDED] sm:block" aria-hidden />
            <span className="text-xs font-medium tracking-[-0.02em] text-[#05040D]">
              {statusLabel ?? t('pages.training.interactions.status.label', 'Status')}
            </span>
            <AnalyticsRadioChips items={extraChips} />
          </>
        ) : null}
      </div>
      {rightSlot ? <div className="flex items-center gap-2">{rightSlot}</div> : null}
    </div>
  )
}

export default PeriodFilterStrip
