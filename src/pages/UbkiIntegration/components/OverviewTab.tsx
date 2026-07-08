import { useMemo, useState } from 'react'
import {
  MdEdit,
  MdOutlineWifiTethering,
  MdRefresh,
  MdOutlineDescription,
  MdNorthEast,
} from 'react-icons/md'
import { Icons } from '@/lib/icons'
import { DataTable, type Column } from '@/components/ui/DataTable'
import { Button } from '@/components/ui/Button'
import { Pagination } from '@/components/ui/Pagination'
import { TableSkeleton } from '@/components/ui/TableSkeleton'
import {
  MultiCheckboxDropdown,
  type MultiCheckboxOption,
} from '@/pages/Training/components/MultiCheckboxDropdown'
import {
  MOCK_CONNECTION,
  MOCK_KPIS,
  mockDetailFor,
  type SubmissionLogRow,
  type SubmissionStatus,
  type UbkiEnv,
} from '../mockData'
import { useUbkiLogs, mapLogItemToRow } from '../api'
import { SubmissionDrawer } from './SubmissionDrawer'

const PERIODS = ['Today', 'Yesterday', 'Last 7 days', 'Last 30 days', 'Custom range'] as const

const STATUS_STYLES: Record<SubmissionStatus, string> = {
  success: 'bg-success-50 text-success-700',
  failed: 'bg-error-50 text-error-700',
  pending: 'bg-warning-50 text-warning-700',
}

function StatusPill({ status }: { status: SubmissionStatus }) {
  return (
    <span
      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium capitalize ${STATUS_STYLES[status]}`}
    >
      {status}
    </span>
  )
}

function KpiCard({
  icon,
  label,
  value,
  trend = false,
  sub,
  subClass = 'text-gray-400',
}: {
  icon: React.ReactNode
  label: string
  value: string
  trend?: boolean
  sub?: string
  subClass?: string
}) {
  return (
    <div className="flex flex-1 items-center gap-3 rounded-xl border border-gray-200 bg-white px-4 py-3">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-gray-200 bg-white text-gray-500">
        {icon}
      </div>
      <div className="flex flex-1 items-center justify-between gap-2">
        <p className="text-xs leading-tight text-gray-600">{label}</p>
        <div className="text-right">
          <p className="text-dark-500 inline-flex items-center gap-1 text-lg font-semibold">
            {trend && <MdNorthEast size={13} className="text-success-600" />}
            {value}
          </p>
          {sub && <p className={`text-[11px] ${subClass}`}>{sub}</p>}
        </div>
      </div>
    </div>
  )
}

const TYPE_OPTIONS: MultiCheckboxOption<string>[] = [
  { value: 'Outbound', label: 'Outbound (KAN-609)' },
  { value: 'Inbound', label: 'Inbound report (KAN-250)' },
]
const STATUS_OPTIONS: MultiCheckboxOption<string>[] = [
  { value: 'success', label: 'Success' },
  { value: 'failed', label: 'Failed' },
  { value: 'pending', label: 'Pending' },
]
const MODE_OPTIONS: MultiCheckboxOption<string>[] = [
  { value: 'Auto', label: 'Automatic' },
  { value: 'Manual', label: 'Manual' },
  { value: 'Bulk', label: 'Bulk' },
]

export function OverviewTab() {
  const conn = MOCK_CONNECTION
  const kpis = MOCK_KPIS
  const [env, setEnv] = useState<UbkiEnv>(conn.env)
  const [editing, setEditing] = useState(false)
  const [period, setPeriod] = useState<(typeof PERIODS)[number]>('Last 7 days')
  const [search, setSearch] = useState('')
  const [typeF, setTypeF] = useState<string[]>([])
  const [statusF, setStatusF] = useState<string[]>([])
  const [modeF, setModeF] = useState<string[]>([])
  const [operatorF, setOperatorF] = useState<string[]>([])
  const [errorF, setErrorF] = useState<string[]>([])
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [selected, setSelected] = useState<SubmissionLogRow | null>(null)

  // Real backend: GET /api/v1/ubki/logs (project-scoped, newest first).
  const { data: logItems, isLoading, isError } = useUbkiLogs({ limit: 100 })
  const allRows = useMemo(() => (logItems ?? []).map(mapLogItemToRow), [logItems])

  // Operator / error-code options come straight from the loaded rows (the backend
  // /logs response has no fixed vocabulary for these).
  const operatorOptions = useMemo<MultiCheckboxOption<string>[]>(() => {
    const seen = new Set<string>()
    const opts: MultiCheckboxOption<string>[] = []
    for (const r of allRows) {
      if (seen.has(r.operator)) continue
      seen.add(r.operator)
      opts.push({ value: r.operator, label: r.operator })
    }
    return opts
  }, [allRows])
  const errorOptions = useMemo<MultiCheckboxOption<string>[]>(() => {
    const seen = new Set<string>()
    const opts: MultiCheckboxOption<string>[] = []
    for (const r of allRows) {
      if (!r.error || seen.has(r.error)) continue
      seen.add(r.error)
      opts.push({ value: r.error, label: r.error })
    }
    return opts
  }, [allRows])

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase()
    return allRows.filter((r) => {
      if (typeF.length && !typeF.includes(r.type)) return false
      if (statusF.length && !statusF.includes(r.status)) return false
      if (modeF.length && !modeF.includes(r.mode)) return false
      if (operatorF.length && !operatorF.includes(r.operator)) return false
      if (errorF.length && !(r.error && errorF.includes(r.error))) return false
      if (
        q &&
        !r.clientName.toLowerCase().includes(q) &&
        !r.clientTin.toLowerCase().includes(q) &&
        !r.creditContract.toLowerCase().includes(q)
      ) {
        return false
      }
      return true
    })
  }, [search, allRows, typeF, statusF, modeF, operatorF, errorF])

  const columns: Column<SubmissionLogRow>[] = [
    {
      key: 'dateTime',
      header: 'Date / time',
      render: (r) => (
        <span className="text-xs whitespace-pre-line text-gray-700">{r.dateTime}</span>
      ),
    },
    {
      key: 'type',
      header: 'Type',
      render: (r) => <span className="text-xs text-gray-700">{r.type}</span>,
    },
    {
      key: 'mode',
      header: 'Mode',
      render: (r) => <span className="text-xs text-gray-700">{r.mode}</span>,
    },
    {
      key: 'client',
      header: 'Client',
      render: (r) => (
        <div className="text-xs">
          <div className="text-dark-500 font-medium">{r.clientName}</div>
          <div className="text-gray-500">{r.clientTin}</div>
        </div>
      ),
    },
    {
      key: 'creditContract',
      header: 'Credit contract',
      render: (r) => <span className="text-xs text-gray-700">{r.creditContract || '—'}</span>,
    },
    { key: 'status', header: 'Status', render: (r) => <StatusPill status={r.status} /> },
    {
      key: 'error',
      header: 'Error',
      render: (r) => <span className="text-error-600 text-xs">{r.error ?? '—'}</span>,
    },
    {
      key: 'operator',
      header: 'Operator',
      render: (r) => <span className="text-xs text-gray-700">{r.operator}</span>,
    },
    {
      key: 'actions',
      header: 'Actions',
      align: 'right',
      render: (r) => (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            setSelected(r)
          }}
          className="text-primary-600 text-xs font-medium hover:underline"
        >
          View
        </button>
      ),
    },
  ]

  return (
    <div className="flex flex-col gap-4">
      {/* ── Connection Settings ─────────────────────────────────────────── */}
      <div className="rounded-2xl border border-gray-200 bg-white p-5">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-dark-500 text-sm font-semibold">Connection Settings</h2>
          <Button
            variant="outline"
            size="sm"
            leftIcon={<MdEdit size={14} />}
            onClick={() => setEditing((v) => !v)}
          >
            {editing ? 'Done' : 'Edit'}
          </Button>
        </div>

        <div className="flex flex-wrap items-end gap-4">
          {/* Connection — segmented radio control (Test / Production) */}
          <div className="min-w-[210px]">
            <label className="mb-1 block text-xs font-medium text-gray-500">Connection</label>
            <div className="inline-flex gap-1 rounded-lg border border-gray-200 bg-white p-1">
              {(['test', 'production'] as UbkiEnv[]).map((e) => {
                const active = env === e
                return (
                  <button
                    key={e}
                    type="button"
                    disabled={!editing}
                    onClick={() => setEnv(e)}
                    className={`inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                      active ? 'bg-secondary-800 text-white' : 'text-gray-600 hover:bg-gray-50'
                    } ${!editing ? 'cursor-default' : ''}`}
                  >
                    <span
                      className={`flex h-3.5 w-3.5 items-center justify-center rounded-full border-2 ${
                        active ? 'border-primary-300' : 'border-gray-300'
                      }`}
                    >
                      {active && <span className="bg-primary-300 h-1.5 w-1.5 rounded-full" />}
                    </span>
                    {e === 'test' ? 'Test' : 'Production'}
                  </button>
                )
              })}
            </div>
          </div>

          <div className="min-w-[220px] flex-1">
            <label className="mb-1 block text-xs font-medium text-gray-500">Endpoint URL</label>
            <input
              disabled={!editing}
              defaultValue={conn.endpointUrl}
              className="h-10 w-full rounded-lg border border-gray-200 bg-white px-3 text-xs text-gray-700 disabled:bg-gray-50"
            />
          </div>

          <div className="min-w-[160px] flex-1">
            <label className="mb-1 block text-xs font-medium text-gray-500">Login</label>
            <input
              disabled={!editing}
              defaultValue={conn.login}
              placeholder="Enter your login"
              className="h-10 w-full rounded-lg border border-gray-200 bg-white px-3 text-xs text-gray-700 disabled:bg-gray-50"
            />
          </div>

          <div className="min-w-[150px] flex-1">
            <label className="mb-1 block text-xs font-medium text-gray-500">Password</label>
            <input
              type="password"
              disabled={!editing}
              defaultValue="password"
              className="h-10 w-full rounded-lg border border-gray-200 bg-white px-3 text-xs text-gray-700 disabled:bg-gray-50"
            />
          </div>

          {/* Test connection — full dark button on the right */}
          {/* TODO(ubki-backend): POST test-connection endpoint */}
          <Button
            variant="secondary"
            leftIcon={<MdOutlineWifiTethering size={16} />}
            className="h-10"
          >
            Test connection
          </Button>
        </div>

        {/* status strip */}
        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-500">
          <span className="text-success-700 inline-flex items-center gap-1.5 font-medium">
            <span className="bg-success-500 h-1.5 w-1.5 rounded-full" />
            {conn.connected ? 'Connected' : 'Disconnected'}
          </span>
          <span>Session ID: {conn.sessionId}</span>
          <span>Last checked: {conn.lastChecked}</span>
          <span>Auth expires in {conn.authExpiresIn}</span>
        </div>
      </div>

      {/* ── Period selector ─────────────────────────────────────────────── */}
      <div className="flex flex-wrap gap-2">
        {PERIODS.map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => setPeriod(p)}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
              period === p
                ? 'bg-secondary-800 text-white'
                : 'bg-white text-gray-600 hover:bg-gray-50'
            }`}
          >
            {p}
          </button>
        ))}
      </div>

      {/* ── KPI cards ───────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-3 sm:flex-row">
        <KpiCard
          icon={<Icons.File size={18} />}
          label="Total submissions"
          value={kpis.totalSubmissions.toLocaleString()}
          trend
          sub={`+${kpis.totalDeltaPct}% vs prior period`}
          subClass="text-success-600"
        />
        <KpiCard
          icon={<Icons.Checkmark size={18} />}
          label="Success"
          value={kpis.success.toLocaleString()}
          sub={`+${kpis.successDeltaPct}%`}
          subClass="text-success-600"
        />
        <KpiCard
          icon={<Icons.FileRemove size={18} />}
          label="Failed"
          value={String(kpis.failed)}
          sub={`${kpis.failedErrorCodes} different error codes`}
          subClass="text-error-600"
        />
        <KpiCard
          icon={<Icons.Reload size={18} />}
          label="Pending"
          value={String(kpis.pending)}
          sub="retry scheduled"
        />
        <KpiCard
          icon={<Icons.Cancel01 size={18} />}
          label="Opt-out clients"
          value={String(kpis.optOut)}
          sub="excluded per law"
        />
      </div>

      {/* ── Submission log ──────────────────────────────────────────────── */}
      <div className="rounded-2xl border border-gray-200 bg-white p-5">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-dark-500 text-sm font-semibold">Submission log</h2>
          <span className="text-xs text-gray-400">Click a row to see full report</span>
        </div>

        <div className="mb-4 flex flex-wrap items-center gap-2">
          <div className="min-w-[130px] flex-1">
            <MultiCheckboxDropdown
              options={TYPE_OPTIONS}
              selected={typeF}
              onChange={(v) => {
                setTypeF(v)
                setPage(1)
              }}
              allLabel="All types"
            />
          </div>
          <div className="min-w-[130px] flex-1">
            <MultiCheckboxDropdown
              options={STATUS_OPTIONS}
              selected={statusF}
              onChange={(v) => {
                setStatusF(v)
                setPage(1)
              }}
              allLabel="All statuses"
            />
          </div>
          <div className="min-w-[130px] flex-1">
            <MultiCheckboxDropdown
              options={MODE_OPTIONS}
              selected={modeF}
              onChange={(v) => {
                setModeF(v)
                setPage(1)
              }}
              allLabel="All modes"
            />
          </div>
          <div className="min-w-[130px] flex-1">
            <MultiCheckboxDropdown
              options={operatorOptions}
              selected={operatorF}
              onChange={(v) => {
                setOperatorF(v)
                setPage(1)
              }}
              allLabel="All operators"
            />
          </div>
          <div className="min-w-[130px] flex-1">
            <MultiCheckboxDropdown
              options={errorOptions}
              selected={errorF}
              onChange={(v) => {
                setErrorF(v)
                setPage(1)
              }}
              allLabel="All error codes"
            />
          </div>
          <input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value)
              setPage(1)
            }}
            placeholder="Search by client / TIN / contract…"
            className="focus:border-primary-500 h-[45px] min-w-[200px] flex-[1.5] rounded-lg border border-gray-400 bg-white px-3 text-xs text-gray-700 focus:outline-none"
          />
          <Button
            variant="outline"
            size="sm"
            leftIcon={<MdRefresh size={14} />}
            onClick={() => {
              setSearch('')
              setTypeF([])
              setStatusF([])
              setModeF([])
              setOperatorF([])
              setErrorF([])
              setPage(1)
            }}
          >
            Reset
          </Button>
        </div>

        {isLoading ? (
          <TableSkeleton columns={9} rows={5} />
        ) : isError ? (
          <div className="text-error-600 py-16 text-center text-sm">
            Failed to load the submission log. Please try again.
          </div>
        ) : rows.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
            <MdOutlineDescription size={28} className="text-gray-400" />
            <p className="text-dark-500 text-sm font-medium">No submissions found</p>
            <p className="text-xs text-gray-500">Try adjusting your filters or search query.</p>
            <Button
              variant="secondary"
              size="sm"
              className="mt-1"
              onClick={() => {
                setSearch('')
                setTypeF([])
                setStatusF([])
                setModeF([])
                setOperatorF([])
                setErrorF([])
                setPage(1)
              }}
            >
              Clear all filters
            </Button>
          </div>
        ) : (
          <>
            <DataTable
              columns={columns}
              data={rows}
              onRowClick={(r) => setSelected(r)}
              className="w-full"
            />
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
          </>
        )}
      </div>

      {/* ── Row drawer ──────────────────────────────────────────────────── */}
      <SubmissionDrawer
        detail={selected ? mockDetailFor(selected) : null}
        onClose={() => setSelected(null)}
      />
    </div>
  )
}
