import { useMemo, useState } from 'react'
import { MdOutlineFileDownload, MdSync, MdInfoOutline } from 'react-icons/md'
import { DataTable, type Column } from '@/components/ui/DataTable'
import { Button } from '@/components/ui/Button'
import { Pagination } from '@/components/ui/Pagination'
import { DateSelect } from '@/components/ui/DateSelect'
import {
  MultiCheckboxDropdown,
  type MultiCheckboxOption,
} from '@/pages/Training/components/MultiCheckboxDropdown'
import { MOCK_AUDIT, type AuditEntry, type AuditStatus } from '../mockData'

/** Compact day key (YYYYMMDD) for inclusive from/to comparison. */
const dayNum = (d: Date) => d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate()

/** Mock rows store the date as "DD.MM.YYYY\nHH:MM" — parse the day part. */
function parseRowDate(dateTime: string): Date | null {
  const first = dateTime.split('\n')[0].trim()
  const m = first.match(/^(\d{2})\.(\d{2})\.(\d{4})$/)
  if (!m) return null
  return new Date(+m[3], +m[2] - 1, +m[1])
}

const STATUS_STYLES: Record<AuditStatus, string> = {
  success: 'bg-success-50 text-success-700',
  failed: 'bg-error-50 text-error-700',
  pending: 'bg-warning-50 text-warning-700',
}

// Controlled vocabulary of event categories (matches the design). Each audit row
// is bucketed into one of these for the "event type" filter.
const EVENT_TYPE_OPTIONS: MultiCheckboxOption<string>[] = [
  { value: 'Settings changed', label: 'Settings changed' },
  { value: 'Credentials updated', label: 'Credentials updated' },
  { value: 'Connection tested', label: 'Connection tested' },
  { value: 'Opt-out added/removed', label: 'Opt-out added/removed' },
  { value: 'Bulk action triggered', label: 'Bulk action triggered' },
]

function eventCategory(event: string): string {
  const e = event.toLowerCase()
  if (e.includes('credential')) return 'Credentials updated'
  if (e.includes('opt-out')) return 'Opt-out added/removed'
  if (e.includes('bulk')) return 'Bulk action triggered'
  if (e.includes('connection') || e.includes('tested')) return 'Connection tested'
  return 'Settings changed' // settings / retry policy / everything else
}

// TODO(ubki-backend): UBKI-scoped audit endpoint (config changes / admin actions).
export function AuditLogTab() {
  const [search, setSearch] = useState('')
  const [eventTypes, setEventTypes] = useState<string[]>([])
  const [actors, setActors] = useState<string[]>([])
  const [dateFrom, setDateFrom] = useState<Date | null>(null)
  const [dateTo, setDateTo] = useState<Date | null>(null)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)

  // Actors come straight from the data (distinct performers). "System" is shown
  // as "System (Automatic)" to match the design.
  const actorOptions = useMemo<MultiCheckboxOption<string>[]>(() => {
    const seen = new Set<string>()
    const opts: MultiCheckboxOption<string>[] = []
    for (const r of MOCK_AUDIT) {
      if (seen.has(r.performedBy)) continue
      seen.add(r.performedBy)
      opts.push({
        value: r.performedBy,
        label: r.performedBy === 'System' ? 'System (Automatic)' : r.performedBy,
      })
    }
    return opts
  }, [])

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase()
    return MOCK_AUDIT.filter((r) => {
      if (eventTypes.length && !eventTypes.includes(eventCategory(r.event))) return false
      if (actors.length && !actors.includes(r.performedBy)) return false
      if (dateFrom || dateTo) {
        const rd = parseRowDate(r.dateTime)
        if (dateFrom && rd && dayNum(rd) < dayNum(dateFrom)) return false
        if (dateTo && rd && dayNum(rd) > dayNum(dateTo)) return false
      }
      if (
        q &&
        !r.event.toLowerCase().includes(q) &&
        !r.performedBy.toLowerCase().includes(q) &&
        !r.details.toLowerCase().includes(q)
      )
        return false
      return true
    })
  }, [search, eventTypes, actors, dateFrom, dateTo])

  const resetFilters = () => {
    setSearch('')
    setEventTypes([])
    setActors([])
    setDateFrom(null)
    setDateTo(null)
    setPage(1)
  }

  const columns: Column<AuditEntry>[] = [
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
          className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium capitalize ${STATUS_STYLES[r.status]}`}
        >
          {r.status}
        </span>
      ),
    },
  ]

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-2xl border border-gray-200 bg-white p-5">
        {/* Card header — title + subtitle + Export, inside the card (matches design). */}
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
          {/* TODO(ubki-backend): export audit CSV */}
          <Button variant="secondary" size="sm" leftIcon={<MdOutlineFileDownload size={14} />}>
            Export
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
            placeholder="Search by client / TIN / contract…"
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

        <DataTable columns={columns} data={rows} className="w-full" />
        <div className="mt-4">
          <Pagination
            currentPage={page}
            totalPages={Math.max(1, Math.ceil(rows.length / pageSize))}
            pageSize={pageSize}
            onPageChange={setPage}
            onPageSizeChange={(s) => {
              setPageSize(s)
              setPage(1)
            }}
          />
        </div>
      </div>
    </div>
  )
}
