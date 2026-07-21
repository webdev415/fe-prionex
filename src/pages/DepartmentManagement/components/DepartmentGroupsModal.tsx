/**
 * DepartmentGroupsModal - Manage groups within a department.
 */

import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Modal, ModalHeader, ModalContent, ModalFooter } from '@/components/ui/Modal'
import { ModalSkeleton } from '@/components/ui/ModalSkeleton'
import { Button } from '@/components/ui/Button'
import { Icons } from '@/lib/icons'
import { useDepartment } from '@/features/departments'
import { useGroups } from '@/features/groups'
import type { Group } from '@/features/groups/types'
import { DataTable, type Column } from '@/components/ui'
import { PermissionGuard } from '@/components/auth'
import { PERMISSIONS } from '@/constants/permissions'
import { CreateGroupModal } from './CreateGroupModal'
import { EditGroupModal } from './EditGroupModal'
import { ArchiveGroupModal } from './ArchiveGroupModal'

interface DepartmentGroupsModalProps {
  open: boolean
  departmentId: number
  onClose: () => void
}

export function DepartmentGroupsModal({ open, departmentId, onClose }: DepartmentGroupsModalProps) {
  const { t } = useTranslation('common')
  const { data: department, isLoading: departmentLoading } = useDepartment(departmentId)
  const {
    data: groupsData,
    isLoading: groupsLoading,
    refetch,
  } = useGroups({ department_id: departmentId, page: 1, page_size: 100, is_active: true }, open)

  const [showCreate, setShowCreate] = useState(false)
  const [editGroupId, setEditGroupId] = useState<number | null>(null)
  const [archiveGroupId, setArchiveGroupId] = useState<number | null>(null)

  const groups = groupsData?.groups ?? []
  const isLoading = departmentLoading || groupsLoading

  const columns: Column<Group>[] = [
    {
      key: 'name',
      header: t('pages.groups.tableHeaders.name'),
      render: (g) => <span className="font-medium">{g.name}</span>,
    },
    {
      key: 'description',
      header: t('pages.groups.tableHeaders.description'),
      render: (g) => <span>{g.description || '—'}</span>,
    },
    {
      key: 'assigned_operators_count',
      header: t('pages.groups.tableHeaders.assignedOperators'),
      align: 'center',
      render: (g) => <span>{g.assigned_operators_count ?? 0}</span>,
    },
    {
      key: 'actions',
      header: t('pages.groups.tableHeaders.actions'),
      align: 'center',
      render: (g) => (
        <div className="flex items-center justify-center gap-3">
          <PermissionGuard permission={PERMISSIONS.SYSTEM.MANAGE_ROLES}>
            <button
              type="button"
              className="text-foreground flex items-center gap-1 text-xs font-medium"
              onClick={() => setEditGroupId(g.id)}
            >
              <Icons.PencilEdit size={14} />
              {t('pages.groups.actions.edit')}
            </button>
            <button
              type="button"
              className="text-foreground flex items-center gap-1 text-xs font-medium"
              onClick={() => setArchiveGroupId(g.id)}
            >
              <Icons.Delete size={14} />
              {t('pages.groups.actions.delete')}
            </button>
          </PermissionGuard>
        </div>
      ),
    },
  ]

  return (
    <>
      <Modal open={open} onClose={onClose} maxWidth="2xl">
        <ModalHeader
          icon={
            <div className="bg-primary-400 flex h-7 w-7 items-center justify-center rounded-full sm:h-8 sm:w-8">
              <Icons.Users size={18} className="text-foreground" strokeWidth={2} />
            </div>
          }
          title={
            department
              ? t('pages.groups.modals.manage.title', { departmentName: department.name })
              : t('pages.groups.modals.manage.defaultTitle')
          }
          onClose={onClose}
        />
        <ModalContent>
          {isLoading ? (
            <ModalSkeleton />
          ) : (
            <div className="space-y-4">
              <PermissionGuard permission={PERMISSIONS.SYSTEM.MANAGE_ROLES}>
                <div className="flex justify-end">
                  <Button
                    type="button"
                    variant="primary"
                    size="sm"
                    leftIcon={<Icons.Add size={16} />}
                    onClick={() => setShowCreate(true)}
                  >
                    {t('pages.groups.newGroup')}
                  </Button>
                </div>
              </PermissionGuard>
              <DataTable<Group>
                columns={columns}
                data={groups}
                emptyMessage={t('pages.groups.noGroups')}
              />
            </div>
          )}
        </ModalContent>
        <ModalFooter>
          <Button
            type="button"
            variant="cancel"
            onClick={onClose}
            className="h-[45px] flex-1 text-sm"
          >
            {t('actions.close')}
          </Button>
        </ModalFooter>
      </Modal>

      {showCreate && (
        <CreateGroupModal
          open={showCreate}
          departmentId={departmentId}
          onClose={() => setShowCreate(false)}
          onSuccess={() => {
            setShowCreate(false)
            refetch()
          }}
        />
      )}

      {editGroupId && (
        <EditGroupModal
          open={editGroupId !== null}
          groupId={editGroupId}
          onClose={() => setEditGroupId(null)}
          onSuccess={() => {
            setEditGroupId(null)
            refetch()
          }}
        />
      )}

      {archiveGroupId && (
        <ArchiveGroupModal
          open={archiveGroupId !== null}
          groupId={archiveGroupId}
          onClose={() => setArchiveGroupId(null)}
          onSuccess={() => {
            setArchiveGroupId(null)
            refetch()
          }}
        />
      )}
    </>
  )
}
