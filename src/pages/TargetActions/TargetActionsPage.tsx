/**
 * Target Actions management page (KAN-317).
 *
 * Lists all Target Actions with search, create, edit (only when unused),
 * clone, and hide/unhide actions. Mirrors the look and feel of the
 * SMS Templates settings page.
 */

import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { DataTable, type Column } from '@/components/ui/DataTable'
import { LinkButton } from '@/components/ui/LinkButton'
import { DoubleButton } from '@/components/ui/DoubleButton'
import { Input } from '@/components/ui/Input'
import { Icons } from '@/lib/icons'
import { PermissionGuard } from '@/components/auth'
import { PERMISSIONS } from '@/constants/permissions'
import {
  useTargetActions,
  useCloneTargetAction,
  useHideTargetAction,
  useUnhideTargetAction,
} from '@/features/targetActions/hooks/useTargetActions'
import { useDepartments } from '@/features/departments/hooks/useDepartments'
import { useAuthStore } from '@/stores/authStore'
import type { TargetAction } from '@/features/targetActions/api/types'
import { CreateTargetActionModal, EditTargetActionModal } from './components'
import { getErrorMessage } from '@/lib/errors'

const TYPE_BADGE: Record<string, string> = {
  text: 'bg-emerald-100 text-emerald-700',
  dropdown: 'bg-purple-100 text-purple-700',
  date: 'bg-orange-100 text-orange-700',
  amount: 'bg-blue-100 text-blue-700',
}

export function TargetActionsPage() {
  const { t } = useTranslation('common')
  const { user } = useAuthStore()
  const projectId = user?.active_project_id ? parseInt(user.active_project_id) : undefined

  const [search, setSearch] = useState('')
  const [showHidden, setShowHidden] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [editId, setEditId] = useState<number | null>(null)

  const { data, isLoading } = useTargetActions({ include_hidden: showHidden })
  const { data: departmentsData } = useDepartments({
    project_id: projectId,
    page_size: 100,
  })
  const deptNameById = useMemo(() => {
    const map = new Map<number, string>()
    for (const d of departmentsData?.departments ?? []) map.set(d.id, d.name)
    return map
  }, [departmentsData])
  const cloneMut = useCloneTargetAction()
  const hideMut = useHideTargetAction()
  const unhideMut = useUnhideTargetAction()

  const filtered = useMemo(() => {
    const items = data?.items ?? []
    if (!search.trim()) return items
    const q = search.toLowerCase().trim()
    return items.filter((ta) => ta.name.toLowerCase().includes(q))
  }, [data, search])

  const handleClone = async (ta: TargetAction) => {
    try {
      await cloneMut.mutateAsync(ta.id)
      toast.success(t('pages.targetActions.toasts.cloned'))
    } catch (err) {
      toast.error(getErrorMessage(err))
    }
  }

  const handleHide = async (ta: TargetAction) => {
    try {
      if (ta.is_hidden) {
        await unhideMut.mutateAsync(ta.id)
        toast.success(t('pages.targetActions.toasts.unhidden'))
      } else {
        await hideMut.mutateAsync(ta.id)
        toast.success(t('pages.targetActions.toasts.hidden'))
      }
    } catch (err) {
      toast.error(getErrorMessage(err))
    }
  }

  const columns: Column<TargetAction>[] = [
    {
      key: 'name',
      header: t('pages.targetActions.table.name'),
      align: 'left',
      render: (ta) => (
        <span
          className={`text-sm font-medium ${
            ta.is_hidden ? 'text-gray-400 line-through' : 'text-dark-500'
          }`}
        >
          {ta.name}
        </span>
      ),
    },
    {
      key: 'field_type',
      header: t('pages.targetActions.table.type'),
      align: 'left',
      render: (ta) => (
        <span
          className={`rounded-full px-2 py-0.5 text-xs ${
            TYPE_BADGE[ta.field_type] ?? 'bg-gray-100 text-gray-700'
          }`}
        >
          {t(`pages.targetActions.fieldTypes.${ta.field_type}`)}
        </span>
      ),
    },
    {
      key: 'department_id',
      header: t('pages.targetActions.table.department'),
      align: 'left',
      render: (ta) => {
        const normalizedDepartmentId = Number(ta.department_id)
        const departmentName = Number.isNaN(normalizedDepartmentId)
          ? undefined
          : deptNameById.get(normalizedDepartmentId)

        return <span className="text-sm">{departmentName ?? `#${ta.department_id}`}</span>
      },
    },
    {
      key: 'usage_count',
      header: t('pages.targetActions.table.usedInChains'),
      align: 'left',
      render: (ta) => (
        <span className="text-sm">
          {ta.usage_count} {t('pages.targetActions.table.chainsSuffix')}
        </span>
      ),
    },
    {
      key: 'is_hidden',
      header: t('pages.targetActions.table.status'),
      align: 'left',
      render: (ta) => (
        <span
          className={`rounded-full px-2 py-0.5 text-xs ${
            ta.is_hidden ? 'bg-gray-200 text-gray-700' : 'bg-green-100 text-green-700'
          }`}
        >
          {ta.is_hidden
            ? t('pages.targetActions.status.hidden')
            : t('pages.targetActions.status.active')}
        </span>
      ),
    },
    {
      key: 'actions',
      header: t('pages.targetActions.table.actions'),
      align: 'center',
      render: (ta) => (
        <div className="flex items-center justify-center gap-3">
          <PermissionGuard permission={PERMISSIONS.SYSTEM.MANAGE_SETTINGS}>
            {ta.usage_count === 0 && !ta.is_hidden && (
              <LinkButton
                variant="regular-black"
                size="xs"
                onClick={() => setEditId(ta.id)}
                leftIcon={<Icons.PencilEdit size={16} strokeWidth={1.5} />}
              >
                {t('actions.edit')}
              </LinkButton>
            )}
            <LinkButton variant="regular-black" size="xs" onClick={() => handleClone(ta)}>
              {t('pages.targetActions.actions.clone')}
            </LinkButton>
            <LinkButton variant="regular-black" size="xs" onClick={() => handleHide(ta)}>
              {ta.is_hidden
                ? t('pages.targetActions.actions.unhide')
                : t('pages.targetActions.actions.hide')}
            </LinkButton>
          </PermissionGuard>
        </div>
      ),
    },
  ]

  return (
    <div className="flex w-full flex-col items-start gap-4">
      <div className="mb-4 flex w-full flex-col items-start gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-dark-500 text-2xl font-light">{t('pages.targetActions.title')}</h1>
          <span className="text-sm text-gray-500">{filtered.length}</span>
        </div>

        <div className="flex w-full flex-wrap items-center gap-3 md:w-auto md:flex-nowrap md:justify-end">
          <label className="flex shrink-0 items-center gap-2 text-sm whitespace-nowrap text-gray-700">
            <input
              type="checkbox"
              checked={showHidden}
              onChange={(e) => setShowHidden(e.target.checked)}
            />
            {t('pages.targetActions.showHidden')}
          </label>
          <Input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('pages.targetActions.searchPlaceholder')}
            className="w-full md:w-64"
          />
          <PermissionGuard permission={PERMISSIONS.SYSTEM.MANAGE_SETTINGS}>
            <DoubleButton
              size="md"
              className="shrink-0 whitespace-nowrap"
              icon={<Icons.Add size={20} strokeWidth={2} />}
              iconPosition="left"
              onClick={() => setShowCreate(true)}
            >
              {t('pages.targetActions.createButton')}
            </DoubleButton>
          </PermissionGuard>
        </div>
      </div>

      <DataTable
        columns={columns}
        data={filtered}
        emptyMessage={isLoading ? t('common.loading') : t('pages.targetActions.empty')}
        className="flex flex-col items-start gap-8 self-stretch"
      />

      {showCreate && (
        <CreateTargetActionModal
          open={showCreate}
          onClose={() => setShowCreate(false)}
          onSuccess={() => setShowCreate(false)}
        />
      )}

      {editId !== null && (
        <EditTargetActionModal
          open={editId !== null}
          taId={editId}
          onClose={() => setEditId(null)}
          onSuccess={() => setEditId(null)}
        />
      )}
    </div>
  )
}

export default TargetActionsPage
