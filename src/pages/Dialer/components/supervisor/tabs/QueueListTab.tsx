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
import { ToggleSwitch } from '@/components/ui/ToggleSwitch'
import { useConfirm } from '@/components/ui/useConfirm'
import {
  ACCESS_GROUP_LABELS,
  useDeleteDialerQueue,
  useDialerQueues,
  useSetDialerQueueActive,
  type AccessGroup,
  type DialerQueue,
} from '@/features/dialer'
import { Icons } from '@/lib/icons'

import { QueueFormModal } from '../QueueFormModal'

type QueueFilter = 'all' | 'active'

function StatusBadge({ status }: { status: DialerQueue['status'] }) {
  const { t } = useTranslation('common')
  const isActive = status === 'active'
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium ${
        isActive ? 'bg-success-50 text-success-600' : 'bg-muted text-muted-foreground'
      }`}
    >
      <span
        className={`h-1.5 w-1.5 rounded-full ${isActive ? 'bg-success-500' : 'bg-muted-foreground/50'}`}
      />
      {t(`dialer.queueStatus.${status}`, isActive ? 'Active' : 'Inactive')}
    </span>
  )
}

export function QueueListTab() {
  const { t } = useTranslation('common')
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<QueueFilter>('all')
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<DialerQueue | null>(null)

  const { data, isLoading, isError } = useDialerQueues()
  const setActiveMutation = useSetDialerQueueActive()
  const deleteMutation = useDeleteDialerQueue()
  const { confirm, confirmDialog } = useConfirm()

  const queues = useMemo(() => data ?? [], [data])

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase()
    return queues.filter((q) => {
      if (filter === 'active' && !q.is_active) return false
      if (term && !q.name.toLowerCase().includes(term)) return false
      return true
    })
  }, [queues, search, filter])

  const activeCount = useMemo(() => queues.filter((q) => q.is_active).length, [queues])

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
        key: 'department_name',
        header: t('dialer.queueList.department', 'Department'),
        render: (q) => q.department_name ?? '—',
      },
      {
        key: 'access_group',
        header: t('dialer.queueList.accessGroup', 'Access group'),
        render: (q) => {
          const group = q.access_group as AccessGroup | undefined
          if (!group) return '—'
          return t(`dialer.accessGroup.${group}`, ACCESS_GROUP_LABELS[group] ?? group)
        },
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
        render: (q) => <StatusBadge status={q.status} />,
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
              leftIcon={<Icons.PencilEdit size={16} />}
              onClick={() => openEdit(q)}
            >
              {t('actions.edit', 'Edit')}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              leftIcon={<Icons.Delete size={16} className="text-error-600" />}
              onClick={() => handleDelete(q)}
              disabled={deleteMutation.isPending}
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

      {/* Header: count + search + filter + add */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-muted-foreground text-sm">
          {t('dialer.queueList.found', 'Found: {{count}} queues', { count: queues.length })}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <div className="border-border inline-flex rounded-lg border p-0.5">
            <button
              type="button"
              onClick={() => setFilter('all')}
              className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
                filter === 'all' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'
              }`}
            >
              {t('dialer.queueList.allQueues', 'All queues')} {queues.length}
            </button>
            <button
              type="button"
              onClick={() => setFilter('active')}
              className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
                filter === 'active' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'
              }`}
            >
              {t('dialer.queueList.onlyActive', 'Only active')} {activeCount}
            </button>
          </div>
          <Button variant="primary" leftIcon={<Icons.Add size={16} />} onClick={openCreate}>
            {t('dialer.queueList.addNew', 'Add new queue')}
          </Button>
        </div>
      </div>

      <Input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        leftIcon={<Icons.Search size={16} />}
        placeholder={t('dialer.queueList.searchPlaceholder', 'Search for queue by name...')}
        inputSize="sm"
        className="max-w-sm"
      />

      {isError ? (
        <div className="text-error-600 border-border rounded-xl border bg-white p-10 text-center text-sm">
          {t('dialer.queueList.loadError', 'Failed to load queues.')}
        </div>
      ) : isLoading ? (
        <div className="text-muted-foreground border-border rounded-xl border bg-white p-10 text-center text-sm">
          {t('common.loading', 'Loading...')}
        </div>
      ) : (
        <DataTable
          columns={columns}
          data={filtered}
          emptyMessage={t('dialer.queueList.empty', 'No queues yet. Create your first queue.')}
        />
      )}

      <QueueFormModal
        open={formOpen}
        queue={editing ?? undefined}
        onClose={() => setFormOpen(false)}
      />
    </div>
  )
}

export default QueueListTab
