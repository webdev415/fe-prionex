/**
 * Supervisor "Add from CRM" tab (KAN-379, design: supervisor-06).
 *
 * Filter clients (tag / last contact / department), select them in a table,
 * and bulk-add the selected client IDs to a destination dialer queue.
 *
 * Reuses the ClientManagement filter → selectable DataTable → bulk-action
 * pattern, backed by useClients(). Department has no server-side client filter,
 * so a picked department is resolved to its member employee IDs and passed via
 * `responsible_employee_ids` (see plan §7.5).
 */

import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { Button } from '@/components/ui/Button'
import { DataTable, type Column } from '@/components/ui/DataTable'
import { Pagination } from '@/components/ui/Pagination'
import { TableSkeleton } from '@/components/ui/TableSkeleton'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/Select'
import type { Client, GetClientsParams } from '@/features/clients/api/types'
import { useClients } from '@/features/clients/hooks/useClients'
import { useDepartments } from '@/features/departments'
import { useAddClientsToQueue, useDialerQueues } from '@/features/dialer'
import { useTags } from '@/features/tags/hooks/useTags'
import { usersApi } from '@/features/users/api/usersApi'
import { Icons } from '@/lib/icons'
import { useAuthStore } from '@/stores/authStore'

const DEFAULT_PAGE_SIZE = 20
const ALL = 'all'

/** "Last contact more than N days ago" presets → number of days. */
const LAST_CONTACT_OPTIONS = [7, 30, 60, 90]

interface AppliedFilters {
  tagId: number | null
  lastContactDays: number | null
  departmentId: number | null
}

const EMPTY_FILTERS: AppliedFilters = { tagId: null, lastContactDays: null, departmentId: null }

function daysAgoIso(days: number): string {
  return new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10)
}

function clientName(c: Client): string {
  return [c.last_name, c.first_name, c.middle_name].filter(Boolean).join(' ')
}

function relativeDays(iso?: string | null): string {
  if (!iso) return '—'
  const diffMs = Date.now() - new Date(iso).getTime()
  const days = Math.floor(diffMs / 86_400_000)
  if (days <= 0) return 'today'
  return `${days}d ago`
}

export function AddFromCrmTab() {
  const { t } = useTranslation('common')
  const { user } = useAuthStore()
  const projectId = user?.active_project_id ? parseInt(user.active_project_id) : undefined

  const { data: tags } = useTags()
  const { data: departmentsData } = useDepartments({
    project_id: projectId,
    is_active: true,
    page_size: 100,
  })
  const departments = departmentsData?.departments ?? []
  const { data: queues } = useDialerQueues()

  // Draft (form) vs applied (committed to the query on "Apply").
  const [draft, setDraft] = useState<AppliedFilters>(EMPTY_FILTERS)
  const [applied, setApplied] = useState<AppliedFilters>(EMPTY_FILTERS)

  const [selected, setSelected] = useState<Set<number | string>>(new Set())
  const [destQueueId, setDestQueueId] = useState<number | null>(null)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE)

  const addMutation = useAddClientsToQueue()

  // Resolve a picked department to its member employee IDs (no server-side
  // department filter exists on the clients endpoint).
  const deptMembers = useQuery({
    queryKey: ['dialerDeptMembers', projectId, applied.departmentId],
    queryFn: () =>
      usersApi.getUsers({
        project_id: projectId,
        department_id: applied.departmentId as number,
        page_size: 500,
      }),
    enabled: !!applied.departmentId,
  })
  const departmentEmployeeIds = deptMembers.data?.users.map((u) => u.id) ?? []

  const apiParams: GetClientsParams = useMemo(() => {
    const params: GetClientsParams = { skip: (page - 1) * pageSize, limit: pageSize }
    if (applied.tagId) params.tag_ids = String(applied.tagId)
    if (applied.lastContactDays) params.interaction_date_to = daysAgoIso(applied.lastContactDays)
    if (applied.departmentId) {
      // "0" matches nothing, so an empty department shows no clients rather than all.
      params.responsible_employee_ids = departmentEmployeeIds.join(',') || '0'
    }
    return params
    // departmentEmployeeIds is derived from applied.departmentId's query.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [applied, page, pageSize, departmentEmployeeIds.join(',')])

  // Wait for department members before querying clients (avoids a flash of the
  // unfiltered list while members resolve).
  const clientsEnabled = !applied.departmentId || deptMembers.isSuccess
  const {
    data: clientsData,
    isLoading,
    isError,
  } = useClients(apiParams, { enabled: clientsEnabled })

  const clients = clientsData?.items ?? []
  const total = clientsData?.total ?? 0

  const totalPages = Math.max(1, Math.ceil(total / pageSize))

  const applyFilters = () => {
    setApplied(draft)
    setSelected(new Set())
    setPage(1)
  }
  const clearFilters = () => {
    setDraft(EMPTY_FILTERS)
    setApplied(EMPTY_FILTERS)
    setSelected(new Set())
    setPage(1)
  }
  const handlePageSizeChange = (size: number) => {
    setPageSize(size)
    setPage(1)
  }

  const handleAdd = async () => {
    if (!destQueueId || selected.size === 0) return
    const clientIds = [...selected].map(Number)
    try {
      const res = await addMutation.mutateAsync({ queueId: destQueueId, clientIds })
      toast.success(
        t('dialer.crm.added', '{{count}} clients added to the queue', { count: res.added_count })
      )
      setSelected(new Set())
    } catch {
      // onError toast handled by the mutation.
    }
  }

  const columns: Column<Client>[] = useMemo(
    () => [
      { key: 'name', header: t('dialer.crm.client', 'Client'), render: (c) => clientName(c) },
      {
        key: 'phone_primary',
        header: t('dialer.crm.phone', 'Phone'),
        render: (c) => c.phone_primary ?? '—',
      },
      {
        key: 'tags',
        header: t('dialer.crm.tags', 'Tags'),
        render: (c) =>
          c.tags && c.tags.length > 0 ? (
            <div className="flex flex-wrap gap-1">
              {c.tags.slice(0, 3).map((tag) => (
                <span
                  key={tag.id}
                  className="rounded-full px-2 py-0.5 text-xs font-medium"
                  style={{ backgroundColor: `${tag.color}22`, color: tag.color }}
                >
                  {tag.name}
                </span>
              ))}
            </div>
          ) : (
            '—'
          ),
      },
      {
        key: 'last_contact_date',
        header: t('dialer.crm.lastContact', 'Last contact'),
        render: (c) => relativeDays(c.last_contact_date ?? c.last_ta_date),
      },
    ],
    [t]
  )

  return (
    <div className="flex flex-col gap-4">
      {/* Filter bar (design: supervisor-06) */}
      <div className="rounded-xl bg-white/50 px-6 py-5">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div>
            <label className="text-dark-500 mb-1 block text-xs font-medium">
              {t('dialer.crm.filterTag', 'Client tag')}
            </label>
            <Select
              value={draft.tagId ? String(draft.tagId) : ALL}
              onValueChange={(v) =>
                setDraft((d) => ({ ...d, tagId: v === ALL ? null : Number(v) }))
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>{t('dialer.crm.anyTag', 'Any tag')}</SelectItem>
                {(tags ?? []).map((tag) => (
                  <SelectItem key={tag.id} value={String(tag.id)}>
                    {tag.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="text-dark-500 mb-1 block text-xs font-medium">
              {t('dialer.crm.filterLastContact', 'Last contact')}
            </label>
            <Select
              value={draft.lastContactDays ? String(draft.lastContactDays) : ALL}
              onValueChange={(v) =>
                setDraft((d) => ({ ...d, lastContactDays: v === ALL ? null : Number(v) }))
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>{t('dialer.crm.anyTime', 'Any time')}</SelectItem>
                {LAST_CONTACT_OPTIONS.map((days) => (
                  <SelectItem key={days} value={String(days)}>
                    {t('dialer.crm.moreThanDays', 'More than {{days}} days ago', { days })}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="text-dark-500 mb-1 block text-xs font-medium">
              {t('dialer.crm.filterDepartment', 'Department')}
            </label>
            <Select
              value={draft.departmentId ? String(draft.departmentId) : ALL}
              onValueChange={(v) =>
                setDraft((d) => ({ ...d, departmentId: v === ALL ? null : Number(v) }))
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>
                  {t('dialer.crm.anyDepartment', 'All departments')}
                </SelectItem>
                {departments.map((dept) => (
                  <SelectItem key={dept.id} value={String(dept.id)}>
                    {dept.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Found count + Clear All / Apply Filters on one line (design: supervisor-06). */}
        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-muted-foreground text-sm font-light">
            {t('dialer.crm.found', 'Found: {{total}} clients', {
              total: total.toLocaleString(),
            })}
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="white-secondary"
              onClick={clearFilters}
              leftIcon={<Icons.Reload size={18} strokeWidth={1.5} />}
              className="h-[45px] rounded"
            >
              {t('dialer.crm.clearAll', 'Clear All')}
            </Button>
            <Button variant="secondary" onClick={applyFilters} className="h-[45px] w-40 rounded">
              {t('dialer.crm.applyFilters', 'Apply Filters')}
            </Button>
          </div>
        </div>
      </div>

      {isError ? (
        <div className="text-error-600 border-border rounded-xl border bg-white p-10 text-center text-sm">
          {t('dialer.crm.loadError', 'Failed to load clients.')}
        </div>
      ) : isLoading ? (
        <div className="dialer-crm-card overflow-hidden rounded-xl bg-white/50 shadow-[0px_1px_3px_0px_#00000012]">
          <TableSkeleton
            columns={4}
            rows={8}
            enableBulkSelection
            showBulkHeader
            className="rounded-none! border-0! bg-transparent! shadow-none!"
          />
        </div>
      ) : (
        <div className="dialer-crm-card overflow-hidden rounded-xl bg-white/50 shadow-[0px_1px_3px_0px_#00000012]">
          <DataTable
            columns={columns}
            data={clients}
            enableBulkSelection
            selectedItems={selected}
            onSelectionChange={setSelected}
            totalCount={total}
            emptyMessage={t('dialer.crm.empty', 'No clients match these filters.')}
            // Destination + action live in the table's bulk header (design:
            // supervisor-06 — same line as the "Selected N of Y" checkbox).
            bulkHeaderActions={
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-dark-500 hidden text-sm font-medium sm:inline">
                  {t('dialer.crm.addToDialer', 'Add to dialer')}:
                </span>
                <div className="w-56">
                  <Select
                    value={destQueueId ? String(destQueueId) : undefined}
                    onValueChange={(v) => setDestQueueId(Number(v))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={t('dialer.crm.selectQueue', 'Select queue')} />
                    </SelectTrigger>
                    <SelectContent>
                      {(queues ?? []).map((q) => (
                        <SelectItem key={q.id} value={String(q.id)}>
                          {q.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button
                  variant="primary"
                  size="lg"
                  onClick={handleAdd}
                  disabled={!destQueueId || selected.size === 0}
                  isLoading={addMutation.isPending}
                  leftIcon={<Icons.PlusSignCircle size={20} strokeWidth={1.5} />}
                  className="h-[45px] rounded-md text-sm leading-[150%] font-medium tracking-[-0.02em]"
                >
                  {t('dialer.crm.addToQueue', 'Add to queue')}
                </Button>
              </div>
            }
          />
          {total > 0 && (
            <Pagination
              currentPage={page}
              totalPages={totalPages}
              pageSize={pageSize}
              onPageChange={setPage}
              onPageSizeChange={handlePageSizeChange}
              className="border-t border-gray-100 bg-gray-50 px-4"
            />
          )}
        </div>
      )}
    </div>
  )
}

export default AddFromCrmTab
