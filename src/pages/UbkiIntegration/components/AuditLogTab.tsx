import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { MdOutlineFileDownload, MdSync, MdInfoOutline } from 'react-icons/md'
import { DataTable, type Column } from '@/components/ui/DataTable'
import { Button } from '@/components/ui/Button'
import { Pagination } from '@/components/ui/Pagination'
import { TableSkeleton } from '@/components/ui/TableSkeleton'
import { DateSelect } from '@/components/ui/DateSelect'
import { formatDateTime } from '@/lib/formatters'
import { useAuthStore } from '@/stores/authStore'
import {
  MultiCheckboxDropdown,
  type MultiCheckboxOption,
} from '@/pages/Training/components/MultiCheckboxDropdown'
import { useUbkiAudit, useUbkiAuditFacets, exportUbkiAudit, type AuditLogItem } from '../api'

const STATUS_STYLES: Record<string, string> = {
  success: 'bg-success-50 text-success-700',
  failed: 'bg-error-50 text-error-700',
  pending: 'bg-warning-50 text-warning-700',
}

// Event-type vocabulary (server stores this on each row → used directly).
// Values are raw event_type codes sent to the API; only labels are localized.
const EVENT_TYPE_VALUES = [
  'Settings changed',
  'Credentials updated',
  'Connection tested',
  'Opt-out added/removed',
  'Bulk action triggered',
] as const

interface Row {
  id: number
  dateTime: string
  event: string
  eventType: string
  performedBy: string
  details: string
  status: string
}

export function AuditLogTab() {
  const { t } = useTranslation('common')
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [eventTypes, setEventTypes] = useState<string[]>([])
  const [actors, setActors] = useState<string[]>([])
  const [dateFrom, setDateFrom] = useState<Date | null>(null)
  const [dateTo, setDateTo] = useState<Date | null>(null)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [exporting, setExporting] = useState(false)

  // Debounce the search box so typing doesn't fire a request per keystroke.
  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedSearch(search)
      setPage(1)
    }, 350)
    return () => clearTimeout(t)
  }, [search])

  // Server-side pagination + filtering: GET /api/v1/ubki/audit.
  const auditParams = useMemo(() => {
    const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0)
    const endOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59)
    return {
      limit: pageSize,
      offset: (page - 1) * pageSize,
      event_type: eventTypes,
      actor: actors,
      search: debouncedSearch.trim() || undefined,
      date_from: dateFrom ? startOfDay(dateFrom).toISOString() : undefined,
      date_to: dateTo ? endOfDay(dateTo).toISOString() : undefined,
    }
  }, [pageSize, page, eventTypes, actors, debouncedSearch, dateFrom, dateTo])

  const userTimezone = useAuthStore((s) => s.user?.timezone)
  const { data, isLoading, isError } = useUbkiAudit(auditParams)
  const rows = useMemo<Row[]>(
    () =>
      (data?.items ?? []).map((a: AuditLogItem) => ({
        id: a.id,
        dateTime: formatDateTime(a.created_at, userTimezone),
        event: a.event,
        eventType: a.event_type,
        performedBy:
          a.performed_by_name ??
          (a.performed_by != null
            ? t('pages.ubkiIntegration.audit.performedByUser', {
                defaultValue: 'User #{{id}}',
                id: a.performed_by,
              })
            : t('pages.ubkiIntegration.audit.performedBySystem', 'System')),
        details: a.details ?? '—',
        status: a.status,
      })),
    [data, userTimezone, t]
  )
  const total = data?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const safePage = Math.min(page, totalPages)

  // Actor options from a facets endpoint (whole dataset, not just this page).
  const { data: facets } = useUbkiAuditFacets()
  const actorOptions = useMemo<MultiCheckboxOption<string>[]>(
    () => (facets?.actors ?? []).map((a) => ({ value: a, label: a })),
    [facets]
  )

  // Localized labels for the event-type filter; values stay as raw API codes.
  const eventTypeLabels: Record<(typeof EVENT_TYPE_VALUES)[number], string> = {
    'Settings changed': t(
      'pages.ubkiIntegration.audit.eventTypes.settingsChanged',
      'Settings changed'
    ),
    'Credentials updated': t(
      'pages.ubkiIntegration.audit.eventTypes.credentialsUpdated',
      'Credentials updated'
    ),
    'Connection tested': t(
      'pages.ubkiIntegration.audit.eventTypes.connectionTested',
      'Connection tested'
    ),
    'Opt-out added/removed': t(
      'pages.ubkiIntegration.audit.eventTypes.optOutAddedRemoved',
      'Opt-out added/removed'
    ),
    'Bulk action triggered': t(
      'pages.ubkiIntegration.audit.eventTypes.bulkActionTriggered',
      'Bulk action triggered'
    ),
  }
  const eventTypeOptions: MultiCheckboxOption<string>[] = EVENT_TYPE_VALUES.map((value) => ({
    value,
    label: eventTypeLabels[value],
  }))

  const resetFilters = () => {
    setSearch('')
    setEventTypes([])
    setActors([])
    setDateFrom(null)
    setDateTo(null)
    setPage(1)
  }

  const handleExport = async () => {
    setExporting(true)
    try {
      const blob = await exportUbkiAudit({
        event_type: eventTypes,
        actor: actors,
        search: debouncedSearch.trim() || undefined,
        date_from: auditParams.date_from,
        date_to: auditParams.date_to,
      })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'ubki-audit-log.csv'
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      toast.error(t('pages.ubkiIntegration.audit.export.error', 'Export failed. Please try again.'))
    } finally {
      setExporting(false)
    }
  }

  const columns: Column<Row>[] = [
    {
      key: 'dateTime',
      header: t('pages.ubkiIntegration.audit.columns.dateTime', 'Date / time'),
      render: (r) => (
        <span className="text-muted-foreground text-xs whitespace-pre-line">{r.dateTime}</span>
      ),
    },
    {
      key: 'event',
      header: t('pages.ubkiIntegration.audit.columns.event', 'Event'),
      render: (r) => <span className="text-foreground text-xs font-medium">{r.event}</span>,
    },
    {
      key: 'performedBy',
      header: t('pages.ubkiIntegration.audit.columns.performedBy', 'Performed By'),
      render: (r) => <span className="text-muted-foreground text-xs">{r.performedBy}</span>,
    },
    {
      key: 'details',
      header: t('pages.ubkiIntegration.audit.columns.details', 'Details'),
      render: (r) => <span className="text-muted-foreground text-xs">{r.details}</span>,
    },
    {
      key: 'status',
      header: t('pages.ubkiIntegration.audit.columns.status', 'Status'),
      render: (r) => (
        <span
          className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium capitalize ${STATUS_STYLES[r.status] ?? 'bg-muted text-muted-foreground'}`}
        >
          {r.status}
        </span>
      ),
    },
  ]

  return (
    <div className="flex flex-col gap-4">
      <div className="border-border bg-card rounded-2xl border p-5">
        {/* Card header — title + subtitle + Export, inside the card. */}
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-foreground flex items-center gap-1.5 text-sm font-semibold">
              {t('pages.ubkiIntegration.audit.title', 'Audit log')}
              <MdInfoOutline size={15} className="text-muted-foreground" />
            </h2>
            <p className="text-muted-foreground text-xs">
              {t(
                'pages.ubkiIntegration.audit.subtitle',
                'All configuration changes and admin actions for UBKI integration.'
              )}
            </p>
          </div>
          <Button
            variant="secondary"
            size="sm"
            leftIcon={<MdOutlineFileDownload size={14} />}
            disabled={exporting || total === 0}
            onClick={handleExport}
          >
            {exporting
              ? t('pages.ubkiIntegration.audit.export.inProgress', 'Exporting…')
              : t('pages.ubkiIntegration.audit.export.button', 'Export')}
          </Button>
        </div>

        <div className="mb-4 flex flex-wrap items-center gap-2">
          <div className="w-48">
            <MultiCheckboxDropdown
              options={eventTypeOptions}
              selected={eventTypes}
              onChange={(v) => {
                setEventTypes(v)
                setPage(1)
              }}
              allLabel={t('pages.ubkiIntegration.audit.filters.allEventTypes', 'All event types')}
            />
          </div>
          <div className="w-48">
            <MultiCheckboxDropdown
              options={actorOptions}
              selected={actors}
              onChange={(v) => {
                setActors(v)
                setPage(1)
              }}
              allLabel={t('pages.ubkiIntegration.audit.filters.allActors', 'All actors')}
            />
          </div>
          <div className="w-40">
            <DateSelect
              value={dateFrom}
              onChange={({ value }) => {
                setDateFrom(value)
                setPage(1)
              }}
              onClear={() => setDateFrom(null)}
              format="dd / MM / yyyy"
              placeholder="dd / mm / yyyy"
            />
          </div>
          <span className="text-muted-foreground">—</span>
          <div className="w-40">
            <DateSelect
              value={dateTo}
              onChange={({ value }) => {
                setDateTo(value)
                setPage(1)
              }}
              onClear={() => setDateTo(null)}
              min={dateFrom ?? undefined}
              format="dd / MM / yyyy"
              placeholder="dd / mm / yyyy"
            />
          </div>
          <input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value)
              setPage(1)
            }}
            placeholder={t(
              'pages.ubkiIntegration.audit.filters.searchPlaceholder',
              'Search by event / actor / details…'
            )}
            className="focus:border-primary-500 border-border bg-card text-foreground h-[45px] min-w-[200px] flex-1 rounded-full border px-4 text-xs focus:outline-none"
          />
          <Button
            variant="transparent-black"
            size="sm"
            className="text-muted-foreground rounded-full"
            leftIcon={<MdSync size={15} />}
            onClick={resetFilters}
          >
            {t('pages.ubkiIntegration.audit.filters.reset', 'Reset')}
          </Button>
        </div>

        {isLoading ? (
          <TableSkeleton columns={5} rows={5} />
        ) : isError ? (
          <div className="text-error-600 py-16 text-center text-sm">
            {t('pages.ubkiIntegration.audit.loadError', 'Failed to load the audit log.')}
          </div>
        ) : rows.length === 0 ? (
          <div className="text-muted-foreground py-16 text-center text-sm">
            {t(
              'pages.ubkiIntegration.audit.empty',
              'No audit entries yet. Saving settings or changing the opt-out list will appear here.'
            )}
          </div>
        ) : (
          <>
            <DataTable columns={columns} data={rows} className="w-full" />
            <div className="mt-4">
              <Pagination
                currentPage={safePage}
                totalPages={totalPages}
                pageSize={pageSize}
                onPageChange={setPage}
                onPageSizeChange={(s) => {
                  setPageSize(s)
                  setPage(1)
                }}
              />
            </div>
          </>
        )}
      </div>
    </div>
  )
}
