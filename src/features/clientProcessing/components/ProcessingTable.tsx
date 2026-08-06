/**
 * ProcessingTable Component
 *
 * "Відпрацювання за ЦД" per-employee table (9 columns) built on the shared
 * DataTable. The component only formats and colours — rows arrive
 * pre-filtered by department and pre-sorted by employee name from the
 * backend.
 *
 * Percents arrive on the 0..100 scale and render as "XX.XX%" with a
 * red → yellow → green fill over the fixed 0–100 scale; null cells render
 * "—" without a fill.
 */

import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { DataTable, type Column } from '@/components/ui/DataTable'
import { intlLocaleForUiLanguage } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import type { ProcessingReportRow } from '../types'
import { formatPercent, percentCellBackground } from '../utils/percentGradient'

export interface ProcessingTableProps {
  rows: ProcessingReportRow[]
}

/** DataTable requires an `id`; employee_id is unique per row. */
type ProcessingTableRow = ProcessingReportRow & { id: number }

function PercentValue({ value }: { value: number | null }) {
  const background = percentCellBackground(value)

  return (
    <span
      className={cn(
        'inline-block min-w-16 rounded-md px-2 py-1 tabular-nums',
        // Gradient fills are always light pastels, so pin dark text on top of
        // them regardless of the active (light/dark) theme.
        background && 'text-dark-500'
      )}
      // The fill is computed per value — it cannot be a static Tailwind class
      // (same precedent as TagBadge's dynamic tag colours).
      style={background ? { backgroundColor: background } : undefined}
    >
      {formatPercent(value)}
    </span>
  )
}

export function ProcessingTable({ rows }: ProcessingTableProps) {
  const { t, i18n } = useTranslation('common')

  const numberFormat = useMemo(
    () => new Intl.NumberFormat(intlLocaleForUiLanguage(i18n.language)),
    [i18n.language]
  )

  const data: ProcessingTableRow[] = useMemo(
    () => rows.map((row) => ({ ...row, id: row.employee_id })),
    [rows]
  )

  const columns: Column<ProcessingTableRow>[] = useMemo(
    () => [
      {
        key: 'full_name',
        header: t('pages.reports.processing.columns.employee'),
      },
      {
        key: 'group_name',
        header: t('pages.reports.processing.columns.group'),
        render: (row) => row.group_name ?? '—',
      },
      {
        key: 'count_client',
        header: t('pages.reports.processing.columns.assignedClients'),
        align: 'center',
        render: (row) => (
          <span className="tabular-nums">{numberFormat.format(row.count_client)}</span>
        ),
      },
      {
        key: 'count_processed',
        header: t('pages.reports.processing.columns.processed'),
        align: 'center',
        render: (row) => (
          <span className="tabular-nums">{numberFormat.format(row.count_processed)}</span>
        ),
      },
      {
        key: 'percent_processed',
        header: t('pages.reports.processing.columns.percent'),
        align: 'center',
        render: (row) => <PercentValue value={row.percent_processed} />,
      },
      {
        key: 'count_processed_client',
        header: t('pages.reports.processing.columns.processedClient'),
        align: 'center',
        render: (row) => (
          <span className="tabular-nums">{numberFormat.format(row.count_processed_client)}</span>
        ),
      },
      {
        key: 'percent_processed_client',
        header: t('pages.reports.processing.columns.percent'),
        align: 'center',
        render: (row) => <PercentValue value={row.percent_processed_client} />,
      },
      {
        key: 'count_processed_contact',
        header: t('pages.reports.processing.columns.processedContact'),
        align: 'center',
        render: (row) => (
          <span className="tabular-nums">{numberFormat.format(row.count_processed_contact)}</span>
        ),
      },
      {
        key: 'percent_processed_contact',
        header: t('pages.reports.processing.columns.percent'),
        align: 'center',
        render: (row) => <PercentValue value={row.percent_processed_contact} />,
      },
    ],
    [t, numberFormat]
  )

  return (
    <DataTable
      columns={columns}
      data={data}
      emptyMessage={t('pages.reports.processing.empty')}
      className="w-full"
    />
  )
}
