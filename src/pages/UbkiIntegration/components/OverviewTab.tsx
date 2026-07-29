import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  MdEdit,
  MdCheck,
  MdOutlineWifiTethering,
  MdSync,
  MdOutlineDescription,
  MdNorthEast,
  MdOutlineVisibility,
  MdOutlineVisibilityOff,
} from 'react-icons/md'
import { Icons } from '@/lib/icons'
import { DataTable, type Column } from '@/components/ui/DataTable'
import { Button } from '@/components/ui/Button'
import { Pagination } from '@/components/ui/Pagination'
import { TableSkeleton } from '@/components/ui/TableSkeleton'
import { DateSelect } from '@/components/ui/DateSelect'
import {
  MultiCheckboxDropdown,
  type MultiCheckboxOption,
} from '@/pages/Training/components/MultiCheckboxDropdown'
import { type SubmissionLogRow, type SubmissionStatus, type UbkiEnv } from '../mockData'
import {
  useUbkiLogs,
  useUbkiLogFacets,
  mapLogItemToRow,
  useUbkiKpis,
  useUbkiConnection,
  useUbkiSettings,
  useTestUbkiConnection,
  useUpdateUbkiConnection,
  getUbkiConnectionCredentials,
  type UbkiTestResult,
  type UbkiConnectionUpdate,
} from '../api'
import { SubmissionDrawer } from './SubmissionDrawer'

const PERIODS = ['Today', 'Yesterday', 'Last 7 days', 'Last 30 days', 'Custom range'] as const

/** Map a period label to a from/to ISO range for the KPIs query. */
function periodRange(period: (typeof PERIODS)[number]): { date_from?: string; date_to?: string } {
  const now = new Date()
  const sod = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0)
  const eod = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59)
  const back = (n: number) => {
    const d = new Date(now)
    d.setDate(now.getDate() - n)
    return d
  }
  switch (period) {
    case 'Today':
      return { date_from: sod(now).toISOString(), date_to: now.toISOString() }
    case 'Yesterday': {
      const y = back(1)
      return { date_from: sod(y).toISOString(), date_to: eod(y).toISOString() }
    }
    case 'Last 7 days':
      return { date_from: back(7).toISOString(), date_to: now.toISOString() }
    case 'Last 30 days':
    default:
      // 'Custom range' has no picker yet → treat as last 30 days.
      return { date_from: back(30).toISOString(), date_to: now.toISOString() }
  }
}

const fmtPct = (p: number) => `${p >= 0 ? '+' : ''}${p}%`
const deltaClass = (p: number) => (p >= 0 ? 'text-success-600' : 'text-error-600')

const EMPTY_KPIS = {
  total_submissions: 0,
  total_delta_pct: 0,
  success: 0,
  success_delta_pct: 0,
  failed: 0,
  failed_error_codes: 0,
  pending: 0,
  opt_out: 0,
}

const STATUS_STYLES: Record<SubmissionStatus, string> = {
  success: 'bg-success-50 text-success-700',
  failed: 'bg-error-50 text-error-700',
  pending: 'bg-warning-50 text-warning-700',
}

function StatusPill({ status }: { status: SubmissionStatus }) {
  const { t } = useTranslation('common')
  const labels: Record<SubmissionStatus, string> = {
    success: t('pages.ubkiIntegration.overview.filters.status.success', 'Success'),
    failed: t('pages.ubkiIntegration.overview.filters.status.failed', 'Failed'),
    pending: t('pages.ubkiIntegration.overview.filters.status.pending', 'Pending'),
  }
  return (
    <span
      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium capitalize ${STATUS_STYLES[status]}`}
    >
      {labels[status]}
    </span>
  )
}

function KpiCard({
  icon,
  label,
  value,
  trend = false,
  sub,
  subClass = 'text-muted-foreground',
}: {
  icon: React.ReactNode
  label: string
  value: string
  trend?: boolean
  sub?: string
  subClass?: string
}) {
  return (
    <div className="border-border bg-card flex flex-1 items-center gap-3 rounded-xl border px-4 py-3">
      <div className="border-border bg-card text-muted-foreground flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border">
        {icon}
      </div>
      <div className="flex flex-1 items-center justify-between gap-2">
        <p className="text-muted-foreground text-xs leading-tight">{label}</p>
        <div className="text-right">
          <p className="text-foreground inline-flex items-center gap-1 text-lg font-semibold">
            {trend && <MdNorthEast size={13} className="text-success-600" />}
            {value}
          </p>
          {sub && <p className={`text-[11px] ${subClass}`}>{sub}</p>}
        </div>
      </div>
    </div>
  )
}

// Default UBKI auth endpoint per environment. Selecting Test/Production in the
// connection editor fills the URL from here (unless a custom URL was typed).
const DEFAULT_AUTH_URL: Record<UbkiEnv, string> = {
  test: 'https://test.ubki.ua/b2_api_xml/ubki/auth',
  production: 'https://secure.ubki.ua/b2_api_xml/ubki/auth',
}

export function OverviewTab() {
  const { t } = useTranslation('common')
  const STATUS_OPTIONS: MultiCheckboxOption<string>[] = useMemo(
    () => [
      {
        value: 'success',
        label: t('pages.ubkiIntegration.overview.filters.status.success', 'Success'),
      },
      {
        value: 'failed',
        label: t('pages.ubkiIntegration.overview.filters.status.failed', 'Failed'),
      },
      {
        value: 'pending',
        label: t('pages.ubkiIntegration.overview.filters.status.pending', 'Pending'),
      },
    ],
    [t]
  )
  const MODE_OPTIONS: MultiCheckboxOption<string>[] = useMemo(
    () => [
      {
        value: 'Auto',
        label: t('pages.ubkiIntegration.overview.filters.mode.automatic', 'Automatic'),
      },
      { value: 'Manual', label: t('pages.ubkiIntegration.overview.filters.mode.manual', 'Manual') },
      { value: 'Bulk', label: t('pages.ubkiIntegration.overview.filters.mode.bulk', 'Bulk') },
    ],
    [t]
  )
  const periodLabel = (p: (typeof PERIODS)[number]): string => {
    switch (p) {
      case 'Today':
        return t('pages.ubkiIntegration.overview.periods.today', 'Today')
      case 'Yesterday':
        return t('pages.ubkiIntegration.overview.periods.yesterday', 'Yesterday')
      case 'Last 7 days':
        return t('pages.ubkiIntegration.overview.periods.last7Days', 'Last 7 days')
      case 'Last 30 days':
        return t('pages.ubkiIntegration.overview.periods.last30Days', 'Last 30 days')
      case 'Custom range':
      default:
        return t('pages.ubkiIntegration.overview.periods.customRange', 'Custom range')
    }
  }
  // Connection config + live Test-connection (real UBKI auth via the ubki-service).
  const { data: conn } = useUbkiConnection()
  const testConn = useTestUbkiConnection()
  const updateConn = useUpdateUbkiConnection()
  const [testResult, setTestResult] = useState<UbkiTestResult | null>(null)
  const [editing, setEditing] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [form, setForm] = useState({
    environment: 'test',
    endpoint_url: '',
    login: '',
    password: '',
  })
  const env: UbkiEnv =
    (editing ? form.environment : conn?.environment) === 'production' ? 'production' : 'test'

  const startEdit = async () => {
    const startEnv: UbkiEnv = conn?.environment === 'production' ? 'production' : 'test'
    // Pre-fill the real saved login/password so they're visible while editing
    // (admin-only; fetched on demand, not on page load). Fall back to blank if
    // the fetch fails or nothing is saved yet.
    let creds = { login: '', password: '' }
    try {
      const c = await getUbkiConnectionCredentials()
      creds = { login: c.login ?? '', password: c.password ?? '' }
    } catch {
      // ignore — leave fields blank
    }
    setForm({
      environment: startEnv,
      endpoint_url: conn?.auth_url || DEFAULT_AUTH_URL[startEnv],
      login: creds.login,
      password: creds.password,
    })
    setShowPassword(false)
    setEditing(true)
  }
  // Login + password are mandatory — can't save when either is empty.
  const canSaveConn = !!form.login.trim() && !!form.password.trim()
  const saveEdit = () => {
    if (!canSaveConn) return
    const payload: UbkiConnectionUpdate = {
      environment: form.environment,
      endpoint_url: form.endpoint_url,
      login: form.login.trim(),
      password: form.password,
    }
    updateConn.mutate(payload, { onSuccess: () => setEditing(false) })
  }

  const [period, setPeriod] = useState<(typeof PERIODS)[number]>('Last 30 days')
  const [customFrom, setCustomFrom] = useState<Date | null>(null)
  const [customTo, setCustomTo] = useState<Date | null>(null)

  // KPI cards — real stats for the selected period (memoised range so the query
  // key is stable, not recomputed every render). 'Custom range' uses the pickers.
  const kpiRange = useMemo(() => {
    if (period === 'Custom range') {
      const sod = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0)
      const eod = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59)
      return {
        date_from: customFrom ? sod(customFrom).toISOString() : undefined,
        date_to: customTo ? eod(customTo).toISOString() : undefined,
      }
    }
    return periodRange(period)
  }, [period, customFrom, customTo])
  const { data: kpiData } = useUbkiKpis(kpiRange)
  const kpis = kpiData ?? EMPTY_KPIS
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [statusF, setStatusF] = useState<string[]>([])
  const [modeF, setModeF] = useState<string[]>([])
  const [operatorF, setOperatorF] = useState<string[]>([])
  const [errorF, setErrorF] = useState<string[]>([])
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [selected, setSelected] = useState<SubmissionLogRow | null>(null)

  // Debounce the search box so typing doesn't fire a request per keystroke.
  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedSearch(search)
      setPage(1)
    }, 350)
    return () => clearTimeout(t)
  }, [search])

  // The selected period scopes the log too — reset to page 1 when it changes.
  // Done during render (tracking the previous range) rather than in an effect,
  // to avoid a cascading re-render.
  const [prevRange, setPrevRange] = useState(kpiRange)
  if (prevRange !== kpiRange) {
    setPrevRange(kpiRange)
    setPage(1)
  }

  // Server-side pagination + filtering: GET /api/v1/ubki/logs returns one page
  // (items) plus the total matching the filters. The period date range applies
  // to both the KPIs and the log.
  const logParams = useMemo(
    () => ({
      limit: pageSize,
      offset: (page - 1) * pageSize,
      status: statusF,
      mode: modeF,
      operator: operatorF,
      error_code: errorF,
      search: debouncedSearch.trim() || undefined,
      date_from: kpiRange.date_from,
      date_to: kpiRange.date_to,
    }),
    [pageSize, page, statusF, modeF, operatorF, errorF, debouncedSearch, kpiRange]
  )
  // Log timestamps follow the UBKI Settings timezone (the schedule's timezone),
  // not the viewer's personal profile timezone — so the log always matches when
  // automatic submissions actually fire. Falls back to the settings default.
  const { data: ubkiSettings } = useUbkiSettings()
  const logTimezone = ubkiSettings?.timezone ?? 'Europe/Kyiv'
  const { data: logPage, isLoading, isError } = useUbkiLogs(logParams)
  const rows = useMemo(
    () => (logPage?.items ?? []).map((i) => mapLogItemToRow(i, logTimezone)),
    [logPage, logTimezone]
  )
  const total = logPage?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const safePage = Math.min(page, totalPages)

  // Filter dropdown options come from a facets endpoint (whole dataset, not just
  // the current page).
  const { data: facets } = useUbkiLogFacets()
  const operatorOptions = useMemo<MultiCheckboxOption<string>[]>(
    () => (facets?.operators ?? []).map((o) => ({ value: o.value, label: o.label })),
    [facets]
  )
  const errorOptions = useMemo<MultiCheckboxOption<string>[]>(
    () => (facets?.error_codes ?? []).map((e) => ({ value: e, label: e })),
    [facets]
  )

  const columns: Column<SubmissionLogRow>[] = [
    {
      key: 'dateTime',
      header: t('pages.ubkiIntegration.overview.columns.dateTime', 'Date / time'),
      render: (r) => (
        <span className="text-muted-foreground text-xs whitespace-pre-line">{r.dateTime}</span>
      ),
    },
    {
      key: 'type',
      header: t('pages.ubkiIntegration.overview.columns.type', 'Type'),
      render: (r) => <span className="text-muted-foreground text-xs">{r.type}</span>,
    },
    {
      key: 'mode',
      header: t('pages.ubkiIntegration.overview.columns.mode', 'Mode'),
      render: (r) => <span className="text-muted-foreground text-xs">{r.mode}</span>,
    },
    {
      key: 'client',
      header: t('pages.ubkiIntegration.overview.columns.client', 'Client'),
      render: (r) => (
        <div className="text-xs">
          <div className="text-foreground font-medium">{r.clientName}</div>
          <div className="text-muted-foreground">{r.clientTin}</div>
        </div>
      ),
    },
    {
      key: 'creditContract',
      header: t('pages.ubkiIntegration.overview.columns.creditContract', 'Credit contract'),
      render: (r) => (
        <span className="text-muted-foreground text-xs">{r.creditContract || '—'}</span>
      ),
    },
    {
      key: 'status',
      header: t('pages.ubkiIntegration.overview.columns.status', 'Status'),
      render: (r) => <StatusPill status={r.status} />,
    },
    {
      key: 'error',
      header: t('pages.ubkiIntegration.overview.columns.error', 'Error'),
      render: (r) => <span className="text-error-600 text-xs">{r.error ?? '—'}</span>,
    },
    {
      key: 'operator',
      header: t('pages.ubkiIntegration.overview.columns.operator', 'Operator'),
      render: (r) => <span className="text-muted-foreground text-xs">{r.operator}</span>,
    },
    {
      key: 'actions',
      header: t('pages.ubkiIntegration.overview.columns.actions', 'Actions'),
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
          {t('pages.ubkiIntegration.overview.columns.view', 'View')}
        </button>
      ),
    },
  ]

  return (
    <div className="flex flex-col gap-4">
      {/* ── Connection Settings ─────────────────────────────────────────── */}
      <div className="border-border bg-card rounded-2xl border p-5">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-foreground text-sm font-semibold">
            {t('pages.ubkiIntegration.overview.connection.title', 'Connection Settings')}
          </h2>
          {editing ? (
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={updateConn.isPending}
                onClick={() => setEditing(false)}
              >
                {t('pages.ubkiIntegration.overview.connection.cancel', 'Cancel')}
              </Button>
              <Button
                variant="secondary"
                size="sm"
                leftIcon={<MdCheck size={14} />}
                disabled={updateConn.isPending || !canSaveConn}
                title={
                  !canSaveConn
                    ? t(
                        'pages.ubkiIntegration.overview.connection.loginPasswordRequired',
                        'Login and password are required'
                      )
                    : undefined
                }
                onClick={saveEdit}
              >
                {updateConn.isPending
                  ? t('pages.ubkiIntegration.overview.connection.saving', 'Saving…')
                  : t('pages.ubkiIntegration.overview.connection.done', 'Done')}
              </Button>
            </div>
          ) : (
            <Button
              variant="outline"
              size="sm"
              leftIcon={<MdEdit size={14} />}
              onClick={() => void startEdit()}
            >
              {t('pages.ubkiIntegration.overview.connection.edit', 'Edit')}
            </Button>
          )}
        </div>

        <div className="flex flex-wrap items-end gap-4">
          {/* Environment — editable radio when in edit mode. */}
          <div className="min-w-[210px]">
            <label className="text-muted-foreground mb-1 block text-xs font-medium">
              {t('pages.ubkiIntegration.overview.connection.environmentLabel', 'Connection')}
            </label>
            <div className="border-border bg-card inline-flex gap-1 rounded-lg border p-1">
              {(['test', 'production'] as UbkiEnv[]).map((e) => {
                const active = env === e
                return (
                  <button
                    key={e}
                    type="button"
                    disabled={!editing}
                    onClick={() =>
                      setForm((f) => {
                        // Auto-fill the endpoint from the chosen environment,
                        // unless the user typed a custom (non-default) URL.
                        const isDefaultUrl =
                          !f.endpoint_url ||
                          (Object.values(DEFAULT_AUTH_URL) as string[]).includes(f.endpoint_url)
                        return {
                          ...f,
                          environment: e,
                          endpoint_url: isDefaultUrl ? DEFAULT_AUTH_URL[e] : f.endpoint_url,
                        }
                      })
                    }
                    className={`inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                      active ? 'bg-primary-600 text-white' : 'text-muted-foreground'
                    } ${editing ? 'cursor-pointer' : 'cursor-default'}`}
                  >
                    <span
                      className={`flex h-3.5 w-3.5 items-center justify-center rounded-full border-2 ${
                        active ? 'border-primary-300' : 'border-border'
                      }`}
                    >
                      {active && <span className="bg-primary-300 h-1.5 w-1.5 rounded-full" />}
                    </span>
                    {e === 'test'
                      ? t('pages.ubkiIntegration.overview.connection.test', 'Test')
                      : t('pages.ubkiIntegration.overview.connection.production', 'Production')}
                  </button>
                )
              })}
            </div>
          </div>

          <div className="min-w-[220px] flex-1">
            <label className="text-muted-foreground mb-1 block text-xs font-medium">
              {t('pages.ubkiIntegration.overview.connection.endpointUrl', 'Endpoint URL')}
            </label>
            <input
              readOnly={!editing}
              value={editing ? form.endpoint_url : (conn?.auth_url ?? '')}
              onChange={(e) => setForm((f) => ({ ...f, endpoint_url: e.target.value }))}
              className={`border-border text-foreground h-10 w-full rounded-lg border px-3 text-xs ${
                editing ? 'focus:border-primary-500 bg-card focus:outline-none' : 'bg-muted'
              }`}
            />
          </div>

          <div className="min-w-[160px] flex-1">
            <label className="text-muted-foreground mb-1 block text-xs font-medium">
              {t('pages.ubkiIntegration.overview.connection.login', 'Login')}
            </label>
            <input
              readOnly={!editing}
              value={editing ? form.login : (conn?.login ?? '—')}
              placeholder={
                editing
                  ? t('pages.ubkiIntegration.overview.connection.required', 'Required')
                  : undefined
              }
              onChange={(e) => setForm((f) => ({ ...f, login: e.target.value }))}
              className={`border-border text-foreground h-10 w-full rounded-lg border px-3 text-xs ${
                editing ? 'focus:border-primary-500 bg-card focus:outline-none' : 'bg-muted'
              }`}
            />
          </div>

          <div className="min-w-[150px] flex-1">
            <label className="text-muted-foreground mb-1 flex items-center gap-1.5 text-xs font-medium">
              {t('pages.ubkiIntegration.overview.connection.password', 'Password')}
              {/* Show that a password is stored (the view-mode field is masked). */}
              {conn?.credentials_configured && (
                <span className="text-success-700 inline-flex items-center gap-0.5 text-[10px] font-medium">
                  <MdCheck size={11} />
                  {t('pages.ubkiIntegration.overview.connection.saved', 'Saved')}
                </span>
              )}
            </label>
            <div className="relative">
              <input
                type={editing && showPassword ? 'text' : 'password'}
                readOnly={!editing}
                value={editing ? form.password : '********'}
                placeholder={
                  editing
                    ? t('pages.ubkiIntegration.overview.connection.required', 'Required')
                    : undefined
                }
                onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                className={`border-border text-foreground h-10 w-full rounded-lg border pl-3 text-xs ${
                  editing
                    ? 'focus:border-primary-500 bg-card pr-9 focus:outline-none'
                    : 'bg-muted pr-3'
                }`}
              />
              {/* Reveal the saved/typed password while editing. */}
              {editing && (
                <button
                  type="button"
                  tabIndex={-1}
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={
                    showPassword
                      ? t('pages.ubkiIntegration.overview.connection.hidePassword', 'Hide password')
                      : t('pages.ubkiIntegration.overview.connection.showPassword', 'Show password')
                  }
                  className="text-muted-foreground hover:text-foreground absolute inset-y-0 right-0 flex items-center pr-2.5"
                >
                  {showPassword ? (
                    <MdOutlineVisibilityOff size={16} />
                  ) : (
                    <MdOutlineVisibility size={16} />
                  )}
                </button>
              )}
            </div>
          </div>

          {/* Test connection — performs a real UBKI authorization. */}
          <Button
            variant="secondary"
            leftIcon={<MdOutlineWifiTethering size={16} />}
            className="h-10"
            disabled={testConn.isPending || editing}
            onClick={() => testConn.mutate(undefined, { onSuccess: setTestResult })}
          >
            {testConn.isPending
              ? t('pages.ubkiIntegration.overview.connection.testing', 'Testing…')
              : t('pages.ubkiIntegration.overview.connection.testConnection', 'Test connection')}
          </Button>
        </div>
        {updateConn.isError && (
          <p className="text-error-600 mt-2 text-xs">
            {t(
              'pages.ubkiIntegration.overview.connection.saveError',
              'Failed to save connection settings.'
            )}
          </p>
        )}

        {/* status strip — reflects the last Test connection ONLY. It never
            falls back to the background submission session, so a wrong saved
            password shows "Not tested"/"Connection failed" instead of riding
            on a cached ticket. */}
        {(() => {
          const connected = testResult?.connected ?? false
          const sessionId = testResult?.session_id ?? null
          const expiresAt = testResult?.expires_at ?? null
          return (
            <div className="border-border bg-muted text-muted-foreground mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border px-3 py-2 text-xs">
              <span
                className={`inline-flex items-center gap-1.5 font-medium ${
                  connected
                    ? 'text-success-700'
                    : testResult?.error
                      ? 'text-error-600'
                      : 'text-muted-foreground'
                }`}
              >
                <span
                  className={`h-1.5 w-1.5 rounded-full ${
                    connected
                      ? 'bg-success-500'
                      : testResult?.error
                        ? 'bg-error-500'
                        : 'bg-muted-foreground'
                  }`}
                />
                {connected
                  ? t('pages.ubkiIntegration.overview.status.connected', 'Connected')
                  : testResult
                    ? t(
                        'pages.ubkiIntegration.overview.status.connectionFailed',
                        'Connection failed'
                      )
                    : t('pages.ubkiIntegration.overview.status.notTested', 'Not tested')}
              </span>
              {sessionId && (
                <>
                  <span className="bg-border h-3 w-px" />
                  <span>
                    {t('pages.ubkiIntegration.overview.status.sessionId', 'Session ID')}:{' '}
                    <span className="text-foreground font-medium">{sessionId}</span>
                  </span>
                </>
              )}
              {testResult && (
                <>
                  <span className="bg-border h-3 w-px" />
                  <span>
                    {t('pages.ubkiIntegration.overview.status.lastChecked', 'Last checked')}:{' '}
                    <span className="text-foreground font-medium">
                      {t('pages.ubkiIntegration.overview.status.justNow', 'just now')}
                    </span>
                  </span>
                </>
              )}
              {expiresAt && (
                <>
                  <span className="bg-border h-3 w-px" />
                  <span>
                    {t('pages.ubkiIntegration.overview.status.authExpires', 'Auth expires')}:{' '}
                    <span className="text-foreground font-medium">
                      {new Date(expiresAt).toLocaleString()}
                    </span>
                  </span>
                </>
              )}
              {testResult?.error && (
                <>
                  <span className="bg-border h-3 w-px" />
                  <span className="text-error-600">{testResult.error}</span>
                </>
              )}
              {!conn?.credentials_configured && (
                <>
                  <span className="bg-border h-3 w-px" />
                  <span className="text-error-600">
                    {t(
                      'pages.ubkiIntegration.overview.status.credentialsNotConfigured',
                      'Credentials not configured'
                    )}
                  </span>
                </>
              )}
            </div>
          )
        })()}
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
                ? 'bg-primary-600 text-white'
                : 'bg-card text-muted-foreground hover:bg-muted'
            }`}
          >
            {periodLabel(p)}
          </button>
        ))}
      </div>

      {/* Custom-range date pickers — only when 'Custom range' is selected. */}
      {period === 'Custom range' && (
        <div className="flex flex-wrap items-center gap-2">
          <div className="w-44">
            <DateSelect
              value={customFrom}
              onChange={({ value }) => setCustomFrom(value)}
              onClear={() => setCustomFrom(null)}
              max={customTo ?? undefined}
              format="dd / MM / yyyy"
              placeholder={t('pages.ubkiIntegration.overview.customRange.fromDate', 'From date')}
            />
          </div>
          <span className="text-muted-foreground">—</span>
          <div className="w-44">
            <DateSelect
              value={customTo}
              onChange={({ value }) => setCustomTo(value)}
              onClear={() => setCustomTo(null)}
              min={customFrom ?? undefined}
              format="dd / MM / yyyy"
              placeholder={t('pages.ubkiIntegration.overview.customRange.toDate', 'To date')}
            />
          </div>
        </div>
      )}

      {/* ── KPI cards ───────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-3 sm:flex-row">
        <KpiCard
          icon={<Icons.File size={18} />}
          label={t('pages.ubkiIntegration.overview.kpis.totalSubmissions', 'Total submissions')}
          value={kpis.total_submissions.toLocaleString()}
          trend={kpis.total_delta_pct >= 0}
          sub={t('pages.ubkiIntegration.overview.kpis.vsPriorPeriod', {
            defaultValue: '{{pct}} vs prior period',
            pct: fmtPct(kpis.total_delta_pct),
          })}
          subClass={deltaClass(kpis.total_delta_pct)}
        />
        <KpiCard
          icon={<Icons.Checkmark size={18} />}
          label={t('pages.ubkiIntegration.overview.kpis.success', 'Success')}
          value={kpis.success.toLocaleString()}
          sub={fmtPct(kpis.success_delta_pct)}
          subClass={deltaClass(kpis.success_delta_pct)}
        />
        <KpiCard
          icon={<Icons.FileRemove size={18} />}
          label={t('pages.ubkiIntegration.overview.kpis.failed', 'Failed')}
          value={String(kpis.failed)}
          sub={t('pages.ubkiIntegration.overview.kpis.differentErrorCodes', {
            defaultValue: '{{codes}} different error codes',
            codes: kpis.failed_error_codes,
          })}
          subClass="text-error-600"
        />
        <KpiCard
          icon={<Icons.Reload size={18} />}
          label={t('pages.ubkiIntegration.overview.kpis.pending', 'Pending')}
          value={String(kpis.pending)}
          sub={t('pages.ubkiIntegration.overview.kpis.retryScheduled', 'retry scheduled')}
        />
        <KpiCard
          icon={<Icons.Cancel01 size={18} />}
          label={t('pages.ubkiIntegration.overview.kpis.optOutClients', 'Opt-out clients')}
          value={String(kpis.opt_out)}
          sub={t('pages.ubkiIntegration.overview.kpis.excludedPerLaw', 'excluded per law')}
        />
      </div>

      {/* ── Submission log ──────────────────────────────────────────────── */}
      <div className="border-border bg-card rounded-2xl border p-5">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-foreground text-sm font-semibold">
            {t('pages.ubkiIntegration.overview.log.title', 'Submission log')}
          </h2>
          <span className="text-muted-foreground text-xs">
            {t('pages.ubkiIntegration.overview.log.clickRowHint', 'Click a row to see full report')}
          </span>
        </div>

        <div className="mb-4 flex flex-wrap items-center gap-2">
          <div className="min-w-[130px] flex-1">
            <MultiCheckboxDropdown
              options={STATUS_OPTIONS}
              selected={statusF}
              onChange={(v) => {
                setStatusF(v)
                setPage(1)
              }}
              allLabel={t('pages.ubkiIntegration.overview.log.allStatuses', 'All statuses')}
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
              allLabel={t('pages.ubkiIntegration.overview.log.allModes', 'All modes')}
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
              allLabel={t('pages.ubkiIntegration.overview.log.allOperators', 'All operators')}
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
              allLabel={t('pages.ubkiIntegration.overview.log.allErrorCodes', 'All error codes')}
            />
          </div>
          <input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value)
              setPage(1)
            }}
            placeholder={t(
              'pages.ubkiIntegration.overview.log.searchPlaceholder',
              'Search by client / TIN / contract…'
            )}
            className="focus:border-primary-500 border-border bg-card text-foreground h-[45px] min-w-[200px] flex-[1.5] rounded-full border px-4 text-xs focus:outline-none"
          />
          <Button
            variant="transparent-black"
            size="sm"
            className="text-muted-foreground rounded-full"
            leftIcon={<MdSync size={15} />}
            onClick={() => {
              setSearch('')
              setStatusF([])
              setModeF([])
              setOperatorF([])
              setErrorF([])
              setPage(1)
            }}
          >
            {t('pages.ubkiIntegration.overview.log.reset', 'Reset')}
          </Button>
        </div>

        {isLoading ? (
          <TableSkeleton columns={9} rows={5} />
        ) : isError ? (
          <div className="text-error-600 py-16 text-center text-sm">
            {t(
              'pages.ubkiIntegration.overview.log.loadError',
              'Failed to load the submission log. Please try again.'
            )}
          </div>
        ) : rows.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
            <MdOutlineDescription size={28} className="text-muted-foreground" />
            <p className="text-foreground text-sm font-medium">
              {t('pages.ubkiIntegration.overview.log.noSubmissions', 'No submissions found')}
            </p>
            <p className="text-muted-foreground text-xs">
              {t(
                'pages.ubkiIntegration.overview.log.adjustFilters',
                'Try adjusting your filters or search query.'
              )}
            </p>
            <Button
              variant="secondary"
              size="sm"
              className="mt-1"
              onClick={() => {
                setSearch('')
                setStatusF([])
                setModeF([])
                setOperatorF([])
                setErrorF([])
                setPage(1)
              }}
            >
              {t('pages.ubkiIntegration.overview.log.clearFilters', 'Clear all filters')}
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

      {/* ── Row drawer ──────────────────────────────────────────────────── */}
      <SubmissionDrawer logId={selected?.id ?? null} onClose={() => setSelected(null)} />
    </div>
  )
}
