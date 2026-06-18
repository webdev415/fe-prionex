/**
 * Document Generation page (KAN-403).
 *
 * Tab 1 — Document Journal: cross-client list of uploaded/generated documents
 * with filters by type, action, operator, client, credit, and date range.
 *
 * Tab 2 — Document Templates: placeholder; implemented in a follow-up slice.
 */

import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { DataTable, type Column } from '@/components/ui/DataTable'
import { Pagination } from '@/components/ui/Pagination'
import { Input } from '@/components/ui/Input'
import { DateSelect } from '@/components/ui/DateSelect'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/Select'
import { Button } from '@/components/ui/Button'
import { TableSkeleton } from '@/components/ui/TableSkeleton'
import { cn } from '@/lib/utils'
import { intlLocaleForUiLanguage } from '@/lib/i18n'
import {
  useDocumentJournal,
  type DocumentJournalEntry,
  type DocumentJournalParams,
  type DocumentAction,
  type DocumentType,
} from '@/features/documents'
import { useOperators } from '@/features/users/hooks/useUsers'
import { useAuthStore } from '@/stores/authStore'
import { useHasPermission, useHasAnyPermission } from '@/hooks'
import { PERMISSIONS } from '@/constants/permissions'
import { DocumentTemplatesTab } from './components'

const DOCUMENT_TYPES: DocumentType[] = [
  'passport',
  'inn',
  'contract',
  'income',
  'outcome',
  'signature',
  'military',
  'other',
]

const ACTIONS: DocumentAction[] = ['uploaded', 'generated']

const DEFAULT_PAGE_SIZE = 20
const ALL_VALUE = '__all__'

type Tab = 'journal' | 'templates'

interface Filters {
  document_type?: DocumentType
  action?: DocumentAction
  operator_id?: string
  client_search?: string
  creditor_search?: string
  date_from?: string
  date_to?: string
}

function parseId(v?: string): number | undefined {
  if (!v) return undefined
  const n = Number(v)
  return Number.isFinite(n) && n > 0 ? n : undefined
}

/**
 * Format a YYYY-MM-DD date string into a *naive* ISO datetime to send to the
 * journal API. We deliberately omit the trailing `Z` because the backend's
 * `client_documents.created_at` column is `TIMESTAMP WITHOUT TIME ZONE`, and
 * asyncpg rejects a tz-aware datetime when comparing against a naive column.
 */
function toIsoOrUndefined(v?: string, endOfDay = false): string | undefined {
  if (!v) return undefined
  // Validate the date can be parsed
  const d = new Date(`${v}T00:00:00`)
  if (Number.isNaN(d.getTime())) return undefined
  return `${v}T${endOfDay ? '23:59:59.999' : '00:00:00'}`
}

/** Convert a Date picked by DateSelect into a YYYY-MM-DD string in local time. */
function dateToYmd(d: Date | null): string | undefined {
  if (!d) return undefined
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/** Parse a YYYY-MM-DD string into a Date at local midnight (avoids TZ surprises). */
function ymdToDate(s?: string): Date | null {
  if (!s) return null
  const [y, m, d] = s.split('-').map(Number)
  if (!y || !m || !d) return null
  return new Date(y, m - 1, d)
}

export function DocumentGenerationPage() {
  const { t, i18n } = useTranslation('common')
  const canViewJournal = useHasPermission(PERMISSIONS.DOCUMENT_GENERATION.VIEW_JOURNAL)
  const canViewTemplates = useHasAnyPermission([
    PERMISSIONS.DOCUMENT_GENERATION.VIEW_TEMPLATES,
    PERMISSIONS.DOCUMENT_GENERATION.CREATE_EDIT_TEMPLATES,
    PERMISSIONS.DOCUMENT_GENERATION.DELETE_TEMPLATES,
  ])
  const [tab, setTab] = useState<Tab>(canViewJournal ? 'journal' : 'templates')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE)
  const [filters, setFilters] = useState<Filters>({})

  const activeProjectId = useAuthStore((s) =>
    s.user?.active_project_id ? Number(s.user.active_project_id) : null
  )
  const { data: operators } = useOperators(activeProjectId)
  const operatorMap = useMemo(
    () => new Map((operators ?? []).map((o) => [o.id, o.full_name])),
    [operators]
  )
  const sortedOperators = useMemo(
    () =>
      [...(operators ?? [])].sort((a, b) =>
        a.full_name.localeCompare(b.full_name, undefined, { sensitivity: 'base' })
      ),
    [operators]
  )

  const apiParams = useMemo<DocumentJournalParams>(() => {
    const params: DocumentJournalParams = { page, limit: pageSize }
    if (filters.document_type) params.document_type = filters.document_type
    if (filters.action) params.action = filters.action
    const opId = parseId(filters.operator_id)
    if (opId !== undefined) params.operator_id = opId
    const cs = filters.client_search?.trim()
    if (cs) params.client_search = cs
    const cr = filters.creditor_search?.trim()
    if (cr) params.creditor_search = cr
    const from = toIsoOrUndefined(filters.date_from, false)
    if (from) params.date_from = from
    const to = toIsoOrUndefined(filters.date_to, true)
    if (to) params.date_to = to
    return params
  }, [page, pageSize, filters])

  const { data, isLoading, isError } = useDocumentJournal(apiParams, {
    enabled: tab === 'journal',
  })

  const totalItems = data?.total ?? 0
  const totalPages = totalItems > 0 ? Math.ceil(totalItems / pageSize) : 0

  const dateFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat(intlLocaleForUiLanguage(i18n.language), {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      }),
    [i18n.language]
  )

  const columns: Column<DocumentJournalEntry>[] = useMemo(
    () => [
      {
        key: 'document_name',
        header: t('pages.documentGeneration.journal.columns.documentName', 'Document Name'),
        render: (row) => <span className="text-sm">{row.document_name}</span>,
      },
      {
        key: 'document_type',
        header: t('pages.documentGeneration.journal.columns.documentType', 'Document Type'),
        render: (row) => (
          <span className="text-sm">
            {t(`pages.documentGeneration.documentTypes.${row.document_type}`, row.document_type)}
          </span>
        ),
      },
      {
        key: 'client',
        header: t('pages.documentGeneration.journal.columns.client', 'Client'),
        render: (row) => (
          <Link
            to={`/dashboard/clients/${row.client_id}`}
            className="text-primary-600 hover:underline"
          >
            {row.client_full_name}
          </Link>
        ),
      },
      {
        key: 'credit_id',
        header: t('pages.documentGeneration.journal.columns.creditId', 'Credit ID'),
        render: (row) => <span className="text-sm">{row.debt_contract_number ?? '—'}</span>,
      },
      {
        key: 'creditor',
        header: t('pages.documentGeneration.journal.columns.creditor', 'Creditor'),
        render: (row) => <span className="text-sm">{row.creditor_name ?? '—'}</span>,
      },
      {
        key: 'action',
        header: t('pages.documentGeneration.journal.columns.action', 'Action'),
        render: (row) => (
          <span
            className={cn(
              'inline-flex rounded-full px-2 py-0.5 text-xs font-medium',
              row.action === 'generated' ? 'bg-blue-50 text-blue-700' : 'bg-green-50 text-green-700'
            )}
          >
            {t(`pages.documentGeneration.actions.${row.action}`, row.action)}
          </span>
        ),
      },
      {
        key: 'performed_by',
        header: t('pages.documentGeneration.journal.columns.performedBy', 'Performed by'),
        render: (row) => {
          if (!row.performed_by_user_id) return <span>—</span>
          const name = operatorMap.get(row.performed_by_user_id)
          return <span className="text-sm">{name ?? `#${row.performed_by_user_id}`}</span>
        },
      },
      {
        key: 'created_at',
        header: t('pages.documentGeneration.journal.columns.dateTime', 'Date and time'),
        render: (row) => dateFormatter.format(new Date(row.created_at)),
      },
    ],
    [t, dateFormatter, operatorMap]
  )

  const updateFilter = <K extends keyof Filters>(key: K, value: Filters[K]) => {
    setFilters((prev) => ({ ...prev, [key]: value }))
    setPage(1)
  }

  const resetFilters = () => {
    setFilters({})
    setPage(1)
  }

  return (
    <div className="flex h-full flex-col gap-4">
      <h1 className="text-2xl font-semibold text-gray-900">
        {t('pages.documentGeneration.title', 'Document Generation')}
      </h1>

      <div className="flex gap-2 border-b border-gray-200">
        {canViewJournal && (
          <button
            type="button"
            onClick={() => setTab('journal')}
            className={cn(
              '-mb-px border-b-2 px-4 py-2 text-sm font-medium transition-colors',
              tab === 'journal'
                ? 'border-primary-600 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            )}
          >
            {t('pages.documentGeneration.tabs.journal', 'Document Journal')}
          </button>
        )}
        {canViewTemplates && (
          <button
            type="button"
            onClick={() => setTab('templates')}
            className={cn(
              '-mb-px border-b-2 px-4 py-2 text-sm font-medium transition-colors',
              tab === 'templates'
                ? 'border-primary-600 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            )}
          >
            {t('pages.documentGeneration.tabs.templates', 'Document Templates')}
          </button>
        )}
      </div>

      {tab === 'journal' && canViewJournal ? (
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-1 gap-3 rounded-xl border border-gray-200 bg-white p-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-gray-600">
                {t('pages.documentGeneration.filters.documentType', 'Document type')}
              </label>
              <Select
                value={filters.document_type ?? ALL_VALUE}
                onValueChange={(v) =>
                  updateFilter('document_type', v === ALL_VALUE ? undefined : (v as DocumentType))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL_VALUE}>
                    {t('pages.documentGeneration.filters.all', 'All')}
                  </SelectItem>
                  {DOCUMENT_TYPES.map((dt) => (
                    <SelectItem key={dt} value={dt}>
                      {t(`pages.documentGeneration.documentTypes.${dt}`, dt)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-gray-600">
                {t('pages.documentGeneration.filters.action', 'Action')}
              </label>
              <Select
                value={filters.action ?? ALL_VALUE}
                onValueChange={(v) =>
                  updateFilter('action', v === ALL_VALUE ? undefined : (v as DocumentAction))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL_VALUE}>
                    {t('pages.documentGeneration.filters.all', 'All')}
                  </SelectItem>
                  {ACTIONS.map((a) => (
                    <SelectItem key={a} value={a}>
                      {t(`pages.documentGeneration.actions.${a}`, a)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-gray-600">
                {t('pages.documentGeneration.filters.operator', 'Operator')}
              </label>
              <Select
                value={filters.operator_id ?? ALL_VALUE}
                onValueChange={(v) => updateFilter('operator_id', v === ALL_VALUE ? undefined : v)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL_VALUE}>
                    {t('pages.documentGeneration.filters.all', 'All')}
                  </SelectItem>
                  {sortedOperators.map((op) => (
                    <SelectItem key={op.id} value={String(op.id)}>
                      {op.full_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-gray-600">
                {t('pages.documentGeneration.filters.client', 'Client')}
              </label>
              <Input
                type="text"
                placeholder={t('pages.documentGeneration.filters.clientPlaceholder', 'Name')}
                value={filters.client_search ?? ''}
                onChange={(e) => updateFilter('client_search', e.target.value || undefined)}
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-gray-600">
                {t('pages.documentGeneration.filters.creditor', 'Creditor')}
              </label>
              <Input
                type="text"
                placeholder={t(
                  'pages.documentGeneration.filters.creditorPlaceholder',
                  'Credit ID or creditor name'
                )}
                value={filters.creditor_search ?? ''}
                onChange={(e) => updateFilter('creditor_search', e.target.value || undefined)}
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-gray-600">
                {t('pages.documentGeneration.filters.dateFrom', 'Date from')}
              </label>
              <DateSelect
                value={ymdToDate(filters.date_from)}
                onChange={({ value }) => updateFilter('date_from', dateToYmd(value))}
                max={ymdToDate(filters.date_to) ?? undefined}
                placeholder={t('pages.documentGeneration.filters.dateFrom', 'Date from')}
                allowManualInput
                format="dd.MM.yyyy"
                className="rounded-lg border-gray-400"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-gray-600">
                {t('pages.documentGeneration.filters.dateTo', 'Date to')}
              </label>
              <DateSelect
                value={ymdToDate(filters.date_to)}
                onChange={({ value }) => updateFilter('date_to', dateToYmd(value))}
                min={ymdToDate(filters.date_from) ?? undefined}
                placeholder={t('pages.documentGeneration.filters.dateTo', 'Date to')}
                allowManualInput
                format="dd.MM.yyyy"
                className="rounded-lg border-gray-400"
              />
            </div>
            <div className="flex items-end">
              <Button variant="secondary" onClick={resetFilters} className="h-[45px] w-full">
                {t('pages.documentGeneration.filters.reset', 'Reset')}
              </Button>
            </div>
          </div>

          {isError ? (
            <div className="border-error-200 bg-error-50 text-error-700 rounded-xl border p-4 text-sm">
              {t('pages.documentGeneration.journal.loadError', 'Failed to load document journal.')}
            </div>
          ) : isLoading ? (
            <section
              className="min-h-[200px]"
              aria-busy="true"
              aria-label={t('pages.documentGeneration.journal.loading', 'Loading…')}
            >
              <TableSkeleton columns={columns.length} rows={6} className="shadow-sm" />
            </section>
          ) : (
            <DataTable<DocumentJournalEntry>
              columns={columns}
              data={data?.items ?? []}
              emptyMessage={t('pages.documentGeneration.journal.empty', 'No documents found.')}
            />
          )}

          {totalPages > 0 && (
            <Pagination
              currentPage={page}
              totalPages={totalPages}
              pageSize={pageSize}
              onPageChange={setPage}
              onPageSizeChange={(size) => {
                setPageSize(size)
                setPage(1)
              }}
            />
          )}
        </div>
      ) : tab === 'templates' && canViewTemplates ? (
        <DocumentTemplatesTab />
      ) : null}
    </div>
  )
}
