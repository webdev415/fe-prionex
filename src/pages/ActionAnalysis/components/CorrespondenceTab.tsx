import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { DataTable, type Column } from '@/components/ui/DataTable'
import { DateSelect } from '@/components/ui/DateSelect'
import { Label } from '@/components/ui/Label'
import { useIncomingRegistry, useOutgoingRegistry } from '@/features/lawyerWorkplace'
import { formatDateTime } from '@/lib/formatters'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/stores/authStore'
import { RegistryCategoryBadge } from '@/pages/LawyerWorkplace/components/registry/RegistryCategoryBadge'
import {
  mergeCorrespondenceActivity,
  type CorrespondenceActivityRow,
} from '../lib/correspondenceActivity'

const RECENT_LIMIT = 25
const DASH = '—'

function parseDateString(value: string): Date | null {
  if (!value) return null
  const [year, month, day] = value.split('-').map(Number)
  if (!year || !month || !day) return null
  return new Date(year, month - 1, day)
}

function formatDateString(value: Date | null): string {
  if (!value) return ''
  const year = value.getFullYear()
  const month = String(value.getMonth() + 1).padStart(2, '0')
  const day = String(value.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/**
 * Action Analysis «Кореспонденція» — a summary activity feed that unions the
 * last rows of the incoming and outgoing correspondence registries, filtered
 * by a shared period.
 */
export function CorrespondenceTab() {
  const { t } = useTranslation('common')
  const timezone = useAuthStore((s) => s.user?.timezone)

  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')

  const filters = useMemo(
    () => ({
      page: 1,
      limit: RECENT_LIMIT,
      ...(dateFrom ? { date_from: dateFrom } : {}),
      ...(dateTo ? { date_to: dateTo } : {}),
    }),
    [dateFrom, dateTo]
  )

  const { data: incomingData, isLoading: incomingLoading } = useIncomingRegistry(filters)
  const { data: outgoingData, isLoading: outgoingLoading } = useOutgoingRegistry(filters)

  const rows = useMemo(
    () => mergeCorrespondenceActivity(incomingData?.items ?? [], outgoingData?.items ?? []),
    [incomingData?.items, outgoingData?.items]
  )

  const isLoading = incomingLoading || outgoingLoading

  const columns: Column<CorrespondenceActivityRow>[] = useMemo(
    () => [
      {
        key: 'date',
        header: t('pages.actionAnalysis.correspondence.columns.date', 'Date'),
        render: (row) => (
          <span className="text-foreground text-xs whitespace-nowrap">
            {row.date ? formatDateTime(row.date, timezone) : DASH}
          </span>
        ),
      },
      {
        key: 'direction',
        header: t('pages.actionAnalysis.correspondence.columns.direction', 'Direction'),
        render: (row) => (
          <span
            className={cn(
              'inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium',
              row.direction === 'incoming'
                ? 'bg-information-50 text-information-700'
                : 'bg-success-100 text-success-700'
            )}
          >
            {row.direction === 'incoming'
              ? t('pages.actionAnalysis.correspondence.directionIncoming', 'Incoming')
              : t('pages.actionAnalysis.correspondence.directionOutgoing', 'Outgoing')}
          </span>
        ),
      },
      {
        key: 'number',
        header: t('pages.actionAnalysis.correspondence.columns.number', 'No.'),
        render: (row) => (
          <span className="text-muted-foreground text-xs font-medium whitespace-nowrap">
            {row.number || DASH}
          </span>
        ),
      },
      {
        key: 'category',
        header: t('pages.actionAnalysis.correspondence.columns.category', 'Category'),
        render: (row) =>
          row.letterType ? (
            <RegistryCategoryBadge letterType={row.letterType} />
          ) : (
            <span className="text-muted-foreground text-xs">{DASH}</span>
          ),
      },
      {
        key: 'party',
        header: t('pages.actionAnalysis.correspondence.columns.party', 'Client / Institution'),
        render: (row) => <span className="text-foreground text-xs">{row.party || DASH}</span>,
      },
      {
        key: 'responsible',
        header: t('pages.actionAnalysis.correspondence.columns.responsible', 'Responsible'),
        render: (row) => <span className="text-foreground text-xs">{row.responsible || DASH}</span>,
      },
    ],
    [t, timezone]
  )

  return (
    <div className="flex flex-col gap-4">
      <div className="border-border bg-card/50 flex flex-col gap-3 rounded-xl border p-4 shadow-sm sm:flex-row sm:items-end">
        <div className="flex w-full flex-col gap-1.5 sm:max-w-[200px]">
          <Label className="text-foreground text-xs font-medium">
            {t('pages.actionAnalysis.correspondence.filters.from', 'From')}
          </Label>
          <DateSelect
            value={parseDateString(dateFrom)}
            onChange={({ value }) => setDateFrom(formatDateString(value))}
            max={parseDateString(dateTo) || undefined}
            placeholder={t(
              'pages.actionAnalysis.correspondence.filters.selectStartDate',
              'Start date'
            )}
            allowManualInput
            format="dd.MM.yyyy"
            className="[&_input]:h-[42px] [&_input]:text-xs [&_input]:font-normal"
          />
        </div>
        <div className="flex w-full flex-col gap-1.5 sm:max-w-[200px]">
          <Label className="text-foreground text-xs font-medium">
            {t('pages.actionAnalysis.correspondence.filters.to', 'To')}
          </Label>
          <DateSelect
            value={parseDateString(dateTo)}
            onChange={({ value }) => setDateTo(formatDateString(value))}
            min={parseDateString(dateFrom) || undefined}
            placeholder={t('pages.actionAnalysis.correspondence.filters.selectEndDate', 'End date')}
            allowManualInput
            format="dd.MM.yyyy"
            className="[&_input]:h-[42px] [&_input]:text-xs [&_input]:font-normal"
          />
        </div>
      </div>

      <DataTable
        columns={columns}
        data={rows}
        emptyMessage={
          isLoading
            ? t('common.loading', 'Loading...')
            : t(
                'pages.actionAnalysis.correspondence.empty',
                'No correspondence activity for this period'
              )
        }
        tableClassName="whitespace-normal"
        className="w-full"
      />
    </div>
  )
}
