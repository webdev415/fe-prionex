/**
 * ProcessingTable Component
 *
 * "Відпрацювання за ЦД" per-employee table (9 columns). The component only
 * formats and colours — rows arrive pre-filtered by department and pre-sorted
 * by employee name from the backend.
 *
 * Percents arrive on the 0..100 scale and render as "XX.XX%" with a
 * red → yellow → green background over the fixed 0–100 scale; null cells
 * render "—" without a fill.
 */

import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { intlLocaleForUiLanguage } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import type { ProcessingReportRow } from '../types'
import { formatPercent, percentCellBackground } from '../utils/percentGradient'

export interface ProcessingTableProps {
  rows: ProcessingReportRow[]
}

const TH_CLASS = 'text-foreground border-border h-[49px] border-r px-3 text-xs font-medium'
const TD_CLASS = 'text-foreground border-border h-[49px] border-r px-3 text-xs font-medium'

function PercentCell({ value, isLast = false }: { value: number | null; isLast?: boolean }) {
  const background = percentCellBackground(value)

  return (
    <td
      className={cn(
        TD_CLASS,
        'text-center tabular-nums',
        isLast && 'border-r-0',
        // Gradient fills are always light pastels, so pin dark text on top of
        // them regardless of the active (light/dark) theme.
        background && 'text-dark-500'
      )}
      // The fill is computed per value — it cannot be a static Tailwind class
      // (same precedent as TagBadge's dynamic tag colours).
      style={background ? { backgroundColor: background } : undefined}
    >
      {formatPercent(value)}
    </td>
  )
}

export function ProcessingTable({ rows }: ProcessingTableProps) {
  const { t, i18n } = useTranslation('common')

  const numberFormat = useMemo(
    () => new Intl.NumberFormat(intlLocaleForUiLanguage(i18n.language)),
    [i18n.language]
  )

  if (rows.length === 0) {
    return (
      <div className="border-border bg-card text-muted-foreground w-full rounded-xl border p-8 text-center text-sm shadow-sm">
        {t('pages.reports.processing.empty')}
      </div>
    )
  }

  return (
    <div className="border-border bg-card w-full overflow-x-auto rounded-xl border shadow-sm">
      <table className="w-full min-w-[900px] border-collapse">
        <thead>
          <tr className="bg-card">
            <th scope="col" className={cn(TH_CLASS, 'text-left')}>
              {t('pages.reports.processing.columns.employee')}
            </th>
            <th scope="col" className={cn(TH_CLASS, 'text-left')}>
              {t('pages.reports.processing.columns.group')}
            </th>
            <th scope="col" className={cn(TH_CLASS, 'text-center')}>
              {t('pages.reports.processing.columns.assignedClients')}
            </th>
            <th scope="col" className={cn(TH_CLASS, 'text-center')}>
              {t('pages.reports.processing.columns.processed')}
            </th>
            <th scope="col" className={cn(TH_CLASS, 'text-center')}>
              {t('pages.reports.processing.columns.percent')}
            </th>
            <th scope="col" className={cn(TH_CLASS, 'text-center')}>
              {t('pages.reports.processing.columns.processedClient')}
            </th>
            <th scope="col" className={cn(TH_CLASS, 'text-center')}>
              {t('pages.reports.processing.columns.percent')}
            </th>
            <th scope="col" className={cn(TH_CLASS, 'text-center')}>
              {t('pages.reports.processing.columns.processedContact')}
            </th>
            <th scope="col" className={cn(TH_CLASS, 'border-r-0 text-center')}>
              {t('pages.reports.processing.columns.percent')}
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, rowIndex) => (
            <tr
              key={row.employee_id}
              className={cn('transition-colors', rowIndex % 2 === 0 ? 'bg-muted' : 'bg-card')}
            >
              <td className={cn(TD_CLASS, 'text-left whitespace-nowrap')}>{row.full_name}</td>
              <td className={cn(TD_CLASS, 'text-left whitespace-nowrap')}>
                {row.group_name ?? '—'}
              </td>
              <td className={cn(TD_CLASS, 'text-center tabular-nums')}>
                {numberFormat.format(row.count_client)}
              </td>
              <td className={cn(TD_CLASS, 'text-center tabular-nums')}>
                {numberFormat.format(row.count_processed)}
              </td>
              <PercentCell value={row.percent_processed} />
              <td className={cn(TD_CLASS, 'text-center tabular-nums')}>
                {numberFormat.format(row.count_processed_client)}
              </td>
              <PercentCell value={row.percent_processed_client} />
              <td className={cn(TD_CLASS, 'text-center tabular-nums')}>
                {numberFormat.format(row.count_processed_contact)}
              </td>
              <PercentCell value={row.percent_processed_contact} isLast />
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
