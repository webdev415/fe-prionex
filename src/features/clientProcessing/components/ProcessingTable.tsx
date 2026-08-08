/**
 * ProcessingTable Component
 *
 * "Відпрацювання за ЦД" per-employee table (9 columns) built on the shared
 * DataTable. The component only formats and colours — rows arrive
 * pre-filtered by department and pre-sorted by employee name from the
 * backend.
 *
 * Percents arrive on the 0..100 scale and render as "XX.XX%" (locale-aware,
 * uk → «XX,XX%») with a red → yellow → green fill over the fixed 0–100
 * scale; missing values render "—" without a fill.
 */

import { useMemo, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { DataTable, type Column } from '@/components/ui/DataTable'
import { formatNumber } from '@/lib/localeFormat'
import type { ProcessingReportRow } from '../types'
import { formatPercent, percentCellBackground } from '../utils/percentGradient'

export interface ProcessingTableProps {
  rows: ProcessingReportRow[]
}

/** DataTable requires an `id`; employee_id is unique per row. */
type ProcessingTableRow = ProcessingReportRow & { id: number }

/**
 * Visible "%" plus a screen-reader-only full column name — the three percent
 * headers are visually identical, and aria-label on <th> is unreliable
 * across assistive technologies.
 */
function PercentHeader({ visible, srLabel }: { visible: string; srLabel: string }): ReactNode {
  return (
    <>
      <span aria-hidden="true">{visible}</span>
      <span className="sr-only">{srLabel}</span>
    </>
  )
}

function PercentValue({ value, language }: { value: number | null; language: string }) {
  const background = percentCellBackground(value)

  return (
    <span
      className="inline-block min-w-16 rounded-md px-2 py-1 tabular-nums"
      // The fill is computed per value — it cannot be a static Tailwind class.
      // The text colour is hardcoded alongside it (TagBadge precedent): the
      // dark-500 token is theme-scoped and flips to near-white in dark themes
      // (src/theme/themes.css), which would be unreadable on the light pastel
      // fill.
      style={background ? { backgroundColor: background, color: '#05040d' } : undefined}
    >
      {formatPercent(value, language)}
    </span>
  )
}

export function ProcessingTable({ rows }: ProcessingTableProps) {
  const { t, i18n } = useTranslation('common')
  const language = i18n.language

  const data: ProcessingTableRow[] = useMemo(
    () => rows.map((row) => ({ ...row, id: row.employee_id })),
    [rows]
  )

  const columns: Column<ProcessingTableRow>[] = useMemo(() => {
    const percentLabel = t('pages.reports.processing.columns.percent')
    return [
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
          <span className="tabular-nums">{formatNumber(row.count_client, language)}</span>
        ),
      },
      {
        key: 'count_processed',
        header: t('pages.reports.processing.columns.processed'),
        align: 'center',
        render: (row) => (
          <span className="tabular-nums">{formatNumber(row.count_processed, language)}</span>
        ),
      },
      {
        key: 'percent_processed',
        header: (
          <PercentHeader
            visible={percentLabel}
            srLabel={t('pages.reports.processing.columns.percentProcessedAria')}
          />
        ),
        align: 'center',
        render: (row) => <PercentValue value={row.percent_processed} language={language} />,
      },
      {
        key: 'count_processed_client',
        header: t('pages.reports.processing.columns.processedClient'),
        align: 'center',
        render: (row) => (
          <span className="tabular-nums">{formatNumber(row.count_processed_client, language)}</span>
        ),
      },
      {
        key: 'percent_processed_client',
        header: (
          <PercentHeader
            visible={percentLabel}
            srLabel={t('pages.reports.processing.columns.percentClientAria')}
          />
        ),
        align: 'center',
        render: (row) => <PercentValue value={row.percent_processed_client} language={language} />,
      },
      {
        key: 'count_processed_contact',
        header: t('pages.reports.processing.columns.processedContact'),
        align: 'center',
        render: (row) => (
          <span className="tabular-nums">
            {formatNumber(row.count_processed_contact, language)}
          </span>
        ),
      },
      {
        key: 'percent_processed_contact',
        header: (
          <PercentHeader
            visible={percentLabel}
            srLabel={t('pages.reports.processing.columns.percentContactAria')}
          />
        ),
        align: 'center',
        render: (row) => <PercentValue value={row.percent_processed_contact} language={language} />,
      },
    ]
  }, [t, language])

  return (
    <DataTable
      columns={columns}
      data={data}
      emptyMessage={t('pages.reports.processing.empty')}
      className="w-full"
    />
  )
}
