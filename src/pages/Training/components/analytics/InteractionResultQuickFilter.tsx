import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import type { InteractionResultResponse } from '@/features/clients/api/types'
import { AnalyticsRadioChips } from './AnalyticsRadioChips'

interface Props {
  results: InteractionResultResponse[]
  selectedResultId?: number
  onChange: (resultId: number | undefined) => void
  total?: number
}

/**
 * Compact table toolbar — Figma "Filters" row with Status label + radio chips.
 * Applies immediately (no Apply step), like column sort.
 */
export function InteractionResultQuickFilter({
  results,
  selectedResultId,
  onChange,
  total,
}: Props) {
  const { t } = useTranslation('common')

  const chips = useMemo(() => {
    const top = results.slice(0, 5)
    return [
      {
        id: 'all',
        label: t('pages.training.interactions.status.all', 'All'),
        active: selectedResultId == null,
        onClick: () => onChange(undefined),
      },
      ...top.map((r) => ({
        id: String(r.id),
        label: t(`interactionResults.${r.code}`, { defaultValue: r.name }),
        active: selectedResultId === r.id,
        onClick: () => onChange(r.id),
      })),
    ]
  }, [results, selectedResultId, onChange, t])

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[#EBECE8] bg-white px-4 py-3 shadow-[0px_1px_2px_rgba(0,0,0,0.04)]">
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-xs font-medium tracking-[-0.02em] text-[#05040D]">
          {t('pages.training.interactions.status.label', 'Status')}
        </span>
        <AnalyticsRadioChips items={chips} />
      </div>
      {total != null ? (
        <span className="text-xs text-[#545454]">
          <span className="font-medium text-[#05040D]">{total}</span>{' '}
          {t('pages.training.summary.totalInteractions', 'interactions')}
        </span>
      ) : null}
    </div>
  )
}

export default InteractionResultQuickFilter
