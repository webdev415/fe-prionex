/**
 * Supervisor Queue List tab (KAN-379, design: supervisor-01).
 *
 * Lists dialer queues (campaigns/presets) with name search, an
 * all/active filter, an active toggle, edit/delete actions, and an
 * "Add new queue" button that opens the create/edit modal.
 *
 * Cloned from the documentTypes DataTable + useConfirm CRUD pattern.
 */

import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { Button } from '@/components/ui/Button'
import { DataTable, type Column } from '@/components/ui/DataTable'
import { Input } from '@/components/ui/Input'
import { Pagination } from '@/components/ui/Pagination'
import { TableSkeleton } from '@/components/ui/TableSkeleton'
import { ToggleSwitch } from '@/components/ui/ToggleSwitch'
import { useConfirm } from '@/components/ui/useConfirm'
import {
  ACCESS_GROUP_LABELS,
  useDeleteDialerQueue,
  useDialerQueuesPaged,
  useSetDialerQueueActive,
  type AccessGroup,
  type DialerQueue,
} from '@/features/dialer'
import { useDebounce } from '@/hooks/useDebounce'
import { Icons } from '@/lib/icons'

const DEFAULT_PAGE_SIZE = 20

import { QueueFormModal } from '../QueueFormModal'

type QueueFilter = 'all' | 'active'

/**
 * Dialer queue status pill (Figma): light-green pill + green dot for active,
 * light-grey pill + grey dot for inactive. All colours are design tokens.
 *
 * A queue with no campaign on the external dialer takes precedence over both.
 * Campaign sync is fail-soft, so such a queue otherwise renders as a perfectly
 * ordinary Active queue while being unable to place a single call — the only
 * previous trace was a warning in a container log.
 */
export function QueueStatusBadge({ active, synced }: { active: boolean; synced?: boolean }) {
  const { t } = useTranslation('common')

  // Only `false` means "known unsynced". `undefined` is an older payload (or the
  // fake driver, which never provisions a campaign) and must not raise an alarm.
  if (synced === false) {
    return (
      <span
        className="bg-warning-100 text-warning-700 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs leading-[130%] font-medium tracking-[-0.02em]"
        title={t(
          'dialer.queueList.notSyncedHint',
          'This queue has no campaign on the dialer and cannot place calls. Re-save it to retry.'
        )}
      >
        <span className="bg-warning-500 h-2 w-2 shrink-0 rounded-full" />
        {t('dialer.queueList.notSynced', 'Not synced')}
      </span>
    )
  }

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs leading-[130%] font-medium tracking-[-0.02em] ${
        active ? 'bg-success-100 text-success-700' : 'bg-muted text-muted-foreground'
      }`}
    >
      <span
        className={`h-2 w-2 shrink-0 rounded-full ${active ? 'bg-success-500' : 'bg-muted-foreground'}`}
      />
      {t(active ? 'statusLabels.active' : 'statusLabels.inactive', active ? 'Active' : 'Inactive')}
    </span>
  )
}

export function QueueListTab() {
  const { t } = useTranslation('common')
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<QueueFilter>('all')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE)
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<DialerQueue | null>(null)

  const debouncedSearch = useDebounce(search, 400)

  const { data, isLoading, isError } = useDialerQueuesPaged({
    page,
    page_size: pageSize,
    active_only: filter === 'active',
    q: debouncedSearch.trim() || undefined,
  })
  const setActiveMutation = useSetDialerQueueActive()
  const deleteMutation = useDeleteDialerQueue()
  const { confirm, confirmDialog } = useConfirm()

  const queues = data?.items ?? []
  const total = data?.total ?? 0
  const totalAll = data?.total_all ?? 0
  const totalActive = data?.total_active ?? 0
  const totalPages = Math.max(1, Math.ceil(total / pageSize))

  // Filter / search / page-size changes reset to page 1. Done in the handlers
  // (not an effect) to avoid react-hooks/set-state-in-effect.
  const handleSearchChange = (value: string) => {
    setSearch(value)
    setPage(1)
  }
  const handleFilterChange = (next: QueueFilter) => {
    setFilter(next)
    setPage(1)
  }
  const handlePageSizeChange = (size: number) => {
    setPageSize(size)
    setPage(1)
  }

  const openCreate = () => {
    setEditing(null)
    setFormOpen(true)
  }

  const openEdit = (queue: DialerQueue) => {
    setEditing(queue)
    setFormOpen(true)
  }

  const handleToggleActive = async (queue: DialerQueue) => {
    try {
      await setActiveMutation.mutateAsync({ id: queue.id, isActive: !queue.is_active })
    } catch {
      // onError toast handled by the mutation.
    }
  }

  const handleDelete = async (queue: DialerQueue) => {
    const ok = await confirm({
      title: t('dialer.queueList.deleteTitle', "Delete '{{name}}'?", { name: queue.name }),
      message: t(
        'dialer.queueList.deleteMessage',
        'This action is irreversible. The queue will be deleted along with all settings.'
      ),
      confirmLabel: t('actions.delete', 'Delete'),
      cancelLabel: t('actions.cancel', 'Cancel'),
      tone: 'danger',
      icon: <Icons.Delete size={24} className="text-error-600" strokeWidth={2} />,
    })
    if (!ok) return
    try {
      await deleteMutation.mutateAsync(queue.id)
      toast.success(t('dialer.queueList.deleted', 'Queue deleted'))
    } catch {
      // onError toast handled by the mutation.
    }
  }

  const columns: Column<DialerQueue>[] = useMemo(
    () => [
      { key: 'name', header: t('dialer.queueList.name', 'Queue name') },
      {
        key: 'department_names',
        header: t('dialer.queueList.department', 'Department'),
        render: (q) =>
          q.department_names?.length
            ? q.department_names.join(', ')
            : t('dialer.queueForm.allDepartments', 'All departments'),
      },
      {
        key: 'access_groups',
        header: t('dialer.queueList.accessGroup', 'Access group'),
        render: (q) =>
          q.access_groups?.length
            ? q.access_groups
                .map((g) =>
                  t(`dialer.accessGroup.${g}`, ACCESS_GROUP_LABELS[g as AccessGroup] ?? g)
                )
                .join(', ')
            : t('dialer.accessGroup.all_groups', ACCESS_GROUP_LABELS.all_groups),
      },
      {
        key: 'total_in_queue',
        header: t('dialer.queueList.entries', 'Number of entries'),
        align: 'right',
        render: (q) => (q.total_in_queue ?? 0).toLocaleString(),
      },
      {
        key: 'status',
        header: t('dialer.queueList.status', 'Status'),
        align: 'center',
        render: (q) => <QueueStatusBadge active={q.is_active} synced={q.telephony_synced} />,
      },
      {
        key: 'is_active',
        header: t('dialer.queueList.activeQueue', 'Active queue'),
        align: 'center',
        render: (q) => (
          <ToggleSwitch
            checked={q.is_active}
            onChange={() => handleToggleActive(q)}
            disabled={setActiveMutation.isPending}
            ariaLabel={t('dialer.queueList.toggleActive', 'Toggle active')}
          />
        ),
      },
      {
        key: 'actions',
        header: t('dialer.queueList.actions', 'Actions'),
        align: 'right',
        render: (q) => (
          <div className="flex items-center justify-end gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => openEdit(q)}
              leftIcon={<Icons.PencilEdit size={16} strokeWidth={2} />}
              className="text-foreground hover:bg-muted hover:text-foreground active:bg-muted"
            >
              {t('actions.edit', 'Edit')}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleDelete(q)}
              disabled={deleteMutation.isPending}
              leftIcon={<Icons.Delete01 size={16} strokeWidth={2} />}
              className="text-foreground hover:bg-muted hover:text-foreground active:bg-muted disabled:opacity-40"
            >
              {t('actions.delete', 'Delete')}
            </Button>
          </div>
        ),
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [t, setActiveMutation.isPending, deleteMutation.isPending]
  )

  return (
    <div className="flex flex-col gap-4">
      {confirmDialog}

      {/* Header: found count + segmented filter (Figma "CTAs" strip) */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-muted-foreground text-sm">
          {t('dialer.queueList.foundLabel', 'Found:')}{' '}
          <span className="text-foreground font-bold">{total}</span>{' '}
          {t('dialer.queueList.queuesWord', 'queues')}
        </p>
        <div className="bg-card inline-flex items-center gap-1 rounded-lg p-1 shadow-[0px_1px_3px_0px_#0000001A,0px_1px_2px_0px_#0000000F]">
          {(
            [
              ['all', t('dialer.queueList.allQueues', 'All queues'), totalAll],
              ['active', t('dialer.queueList.onlyActive', 'Only active'), totalActive],
            ] as const
          ).map(([id, label, count]) => {
            const isActive = filter === id
            return (
              <button
                key={id}
                type="button"
                onClick={() => handleFilterChange(id)}
                className={`flex items-center gap-1.5 rounded-md px-4 py-2 text-xs font-medium transition-colors ${
                  isActive ? 'bg-secondary-800 text-white' : 'text-foreground hover:bg-muted'
                }`}
              >
                {label}
                <span
                  className={`flex h-4 min-w-4 items-center justify-center rounded-full px-1.5 text-[10px] font-medium ${
                    isActive ? 'bg-white/20 text-white' : 'bg-muted text-foreground'
                  }`}
                >
                  {count}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Container: search + create row, then the table — one Figma card
          (header/zebra recolor + card reset scoped via .dialer-queue-card in index.css) */}
      <div className="dialer-queue-card bg-card/50 overflow-hidden rounded-xl shadow-[0px_1px_3px_0px_#00000012]">
        <div className="border-border bg-muted flex items-center justify-between gap-3 border-b px-4 py-3">
          <Input
            value={search}
            onChange={(e) => handleSearchChange(e.target.value)}
            placeholder={t('dialer.queueList.searchPlaceholder', 'Search for queue by name...')}
            className="w-full max-w-[400px]"
          />
          <Button
            variant="primary"
            size="lg"
            leftIcon={<Icons.PlusSignCircle size={20} strokeWidth={1.5} />}
            onClick={openCreate}
            className="h-[45px] rounded-md text-sm leading-[150%] font-medium tracking-[-0.02em]"
          >
            {t('dialer.queueList.addNew', 'Add new queue')}
          </Button>
        </div>

        {isError ? (
          <div className="text-error-600 p-10 text-center text-sm">
            {t('dialer.queueList.loadError', 'Failed to load queues.')}
          </div>
        ) : isLoading ? (
          <TableSkeleton
            columns={7}
            rows={8}
            className="rounded-none! border-0! bg-transparent! shadow-none!"
          />
        ) : (
          <>
            <DataTable
              columns={columns}
              data={queues}
              emptyMessage={t('dialer.queueList.empty', 'No queues yet. Create your first queue.')}
            />
            {total > 0 && (
              <Pagination
                currentPage={page}
                totalPages={totalPages}
                pageSize={pageSize}
                onPageChange={setPage}
                onPageSizeChange={handlePageSizeChange}
                className="border-border bg-muted border-t px-4"
              />
            )}
          </>
        )}
      </div>

      <QueueFormModal
        open={formOpen}
        queue={editing ?? undefined}
        onClose={() => setFormOpen(false)}
      />
    </div>
  )
}

export default QueueListTab
