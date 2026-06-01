import { useTranslation } from 'react-i18next'
import { Icons } from '@/lib/icons'

/**
 * Shared period selector used by every Action Analysis sub-tab. Mirrors the
 * "Period · Today · Yesterday · 7 days · 30 days" pill row in the Figma.
 */
export type PeriodOption = 'today' | 'yesterday' | '7d' | '30d' | 'custom'

export interface PeriodFilterStripProps {
  value?: PeriodOption
  onChange?: (next: PeriodOption) => void
  extraChips?: { id: string; label: string; active?: boolean; onClick?: () => void }[]
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
  rightSlot,
}: PeriodFilterStripProps) {
  const { t } = useTranslation('common')

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-gray-100 bg-white px-3 py-2 shadow-sm">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[10px] font-medium tracking-wide text-gray-500 uppercase">
          {t('pages.training.period.label', 'Period')}
        </span>
        {PERIODS.map((p) => {
          const isActive = p.id === value
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => onChange?.(p.id)}
              className={`flex items-center gap-1 rounded-full border px-3 py-1 text-[11px] font-medium transition-colors ${
                isActive
                  ? 'bg-primary-500 border-primary-500 text-white'
                  : 'border-gray-200 bg-white text-gray-600'
              }`}
            >
              {p.id === 'custom' ? (
                <Icons.Calendar size={11} className={isActive ? 'text-white' : 'text-gray-500'} />
              ) : null}
              {t(p.key, p.fallback)}
            </button>
          )
        })}
        {extraChips.length > 0 ? <span className="mx-1 h-4 w-px bg-gray-200" aria-hidden /> : null}
        {extraChips.map((chip) => (
          <button
            key={chip.id}
            type="button"
            onClick={chip.onClick}
            className={`rounded-full border px-3 py-1 text-[11px] font-medium transition-colors ${
              chip.active
                ? 'bg-primary-50 border-primary-300 text-primary-700'
                : 'border-gray-200 bg-white text-gray-600'
            }`}
          >
            {chip.label}
          </button>
        ))}
      </div>
      {rightSlot ? <div className="flex items-center gap-2">{rightSlot}</div> : null}
    </div>
  )
}

export default PeriodFilterStrip
