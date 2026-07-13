import { useEffect, useMemo, useState } from 'react'
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
const EVENT_TYPE_OPTIONS: MultiCheckboxOption<string>[] = [
  { value: 'Settings changed', label: 'Settings changed' },
  { value: 'Credentials updated', label: 'Credentials updated' },
  { value: 'Connection tested', label: 'Connection tested' },
  { value: 'Opt-out added/removed', label: 'Opt-out added/removed' },
  { value: 'Bulk action triggered', label: 'Bulk action triggered' },
]

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
          a.performed_by_name ?? (a.performed_by != null ? `User #${a.performed_by}` : 'System'),
        details: a.details ?? '—',
        status: a.status,
      })),
    [data, userTimezone]
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
      toast.error('Export failed. Please try again.')
    } finally {
      setExporting(false)
    }
  }

  const columns: Column<Row>[] = [
    {
      key: 'dateTime',
      header: 'Date / time',
      render: (r) => (
        <span className="text-xs whitespace-pre-line text-gray-700">{r.dateTime}</span>
      ),
    },
    {
      key: 'event',
      header: 'Event',
      render: (r) => <span className="text-dark-500 text-xs font-medium">{r.event}</span>,
    },
    {
      key: 'performedBy',
      header: 'Performed By',
      render: (r) => <span className="text-xs text-gray-700">{r.performedBy}</span>,
    },
    {
      key: 'details',
      header: 'Details',
      render: (r) => <span className="text-xs text-gray-600">{r.details}</span>,
    },
    {
      key: 'status',
      header: 'Status',
      render: (r) => (
        <span
          className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium capitalize ${STATUS_STYLES[r.status] ?? 'bg-gray-100 text-gray-600'}`}
        >
          {r.status}
        </span>
      ),
    },
  ]

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-2xl border border-gray-200 bg-white p-5">
        {/* Card header — title + subtitle + Export, inside the card. */}
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-dark-500 flex items-center gap-1.5 text-sm font-semibold">
              Audit log
              <MdInfoOutline size={15} className="text-gray-400" />
            </h2>
            <p className="text-xs text-gray-500">
              All configuration changes and admin actions for UBKI integration.
            </p>
          </div>
          <Button
            variant="secondary"
            size="sm"
            leftIcon={<MdOutlineFileDownload size={14} />}
            disabled={exporting || total === 0}
            onClick={handleExport}
          >
            {exporting ? 'Exporting…' : 'Export'}
          </Button>
        </div>

        <div className="mb-4 flex flex-wrap items-center gap-2">
          <div className="w-48">
            <MultiCheckboxDropdown
              options={EVENT_TYPE_OPTIONS}
              selected={eventTypes}
              onChange={(v) => {
                setEventTypes(v)
                setPage(1)
              }}
              allLabel="All event types"
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
              allLabel="All actors"
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
          <span className="text-gray-400">—</span>
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
            placeholder="Search by event / actor / details…"
            className="focus:border-primary-500 h-[45px] min-w-[200px] flex-1 rounded-full border border-gray-400 bg-white px-4 text-xs text-gray-700 focus:outline-none"
          />
          <Button
            variant="transparent-black"
            size="sm"
            className="rounded-full text-gray-600"
            leftIcon={<MdSync size={15} />}
            onClick={resetFilters}
          >
            Reset
          </Button>
        </div>

        {isLoading ? (
          <TableSkeleton columns={5} rows={5} />
        ) : isError ? (
          <div className="text-error-600 py-16 text-center text-sm">
            Failed to load the audit log.
          </div>
        ) : rows.length === 0 ? (
          <div className="py-16 text-center text-sm text-gray-500">
            No audit entries yet. Saving settings or changing the opt-out list will appear here.
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
