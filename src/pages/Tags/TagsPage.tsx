/**
 * Tags Management Page
 *
 * Admin page for managing tags used throughout the system.
 * Integrated with real API using React Query.
 */

import { useState, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useTags } from '@/features/tags'
import type { Tag } from '@/features/tags'
import { useAuth } from '@/features/auth'
import { PermissionGuard } from '@/components/auth'
import { PERMISSIONS } from '@/constants/permissions'
import { Icons } from '@/lib/icons'
import { DataTable, type Column } from '@/components/ui/DataTable'
import { TableSkeleton } from '@/components/ui/TableSkeleton'
import { ErrorState } from '@/components/ErrorState'
import { DoubleButton } from '@/components/ui/DoubleButton'
import { LinkButton } from '@/components/ui/LinkButton'
import { TagFormModal } from './components/TagFormModal'
import { DeleteTagDialog } from './components/DeleteTagDialog'

export function TagsPage() {
  const { t } = useTranslation('common')
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [editTag, setEditTag] = useState<Tag | null>(null)
  const [deleteTagId, setDeleteTagId] = useState<number | null>(null)

  // Get current user and active project
  const { user } = useAuth()
  const activeProjectName = useMemo(() => {
    if (!user?.active_project_id || !user?.projects) return undefined
    const activeProject = user.projects.find((p) => p.id === user.active_project_id)
    return activeProject?.name
  }, [user])

  // Fetch tags
  const { data: tags = [], isLoading, isError, error } = useTags()

  const handleEdit = (tag: Tag) => {
    setEditTag(tag)
  }

  const handleDelete = (tagId: number) => {
    setDeleteTagId(tagId)
  }

  const handleCreateSuccess = () => {
    setShowCreateModal(false)
  }

  const handleEditSuccess = () => {
    setEditTag(null)
  }

  const handleDeleteSuccess = () => {
    setDeleteTagId(null)
  }

  // Find the tag being deleted for display in dialog
  const tagToDelete = tags.find((tag) => tag.id === deleteTagId)

  // Table columns definition
  const columns: Column<Tag>[] = [
    {
      key: 'name',
      header: t('pages.tags.tableHeaders.name', 'Tag Name'),
      render: (tag) => (
        <div className="flex items-center gap-2">
          <div className="h-4 w-4 rounded-full" style={{ backgroundColor: tag.color }} />
          <span className="font-medium">{tag.name}</span>
        </div>
      ),
    },
    {
      key: 'project_name',
      header: t('pages.tags.tableHeaders.project', 'Project'),
      render: (tag) => <span className="text-gray-700">{tag.project_name || '-'}</span>,
    },
    {
      key: 'description',
      header: t('pages.tags.tableHeaders.description', 'Description'),
      render: (tag) => <span className="text-gray-700">{tag.description || '-'}</span>,
    },
    {
      key: 'client_count',
      header: t('pages.tags.tableHeaders.clients', 'Clients'),
      align: 'center',
      render: (tag) => <span className="font-medium">{tag.client_count || 0}</span>,
    },
    {
      key: 'actions',
      header: t('pages.tags.tableHeaders.actions', 'Actions'),
      align: 'center',
      render: (tag) => (
        <div className="flex items-center justify-center gap-2">
          <PermissionGuard permission={PERMISSIONS.TAGS.EDIT}>
            <LinkButton
              variant="regular-black"
              size="xs"
              onClick={() => handleEdit(tag)}
              leftIcon={<Icons.PencilEdit size={16} color="#05040D" strokeWidth={1.5} />}
            >
              {t('pages.tags.actions.edit', 'Edit')}
            </LinkButton>
          </PermissionGuard>
          <PermissionGuard permission={PERMISSIONS.TAGS.DELETE}>
            <LinkButton
              variant="regular-black"
              size="xs"
              onClick={() => handleDelete(tag.id)}
              leftIcon={<Icons.Delete size={16} color="#05040D" strokeWidth={1.5} />}
            >
              {t('pages.tags.actions.delete', 'Delete')}
            </LinkButton>
          </PermissionGuard>
        </div>
      ),
    },
  ]

  return (
    <div>
      {/* Page Header */}
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-dark-500 text-2xl font-light">{t('pages.tags.title', 'Tags')}</h1>
          <span className="text-base font-light text-gray-500">{tags.length}</span>
        </div>

        <PermissionGuard permission={PERMISSIONS.TAGS.CREATE}>
          <DoubleButton
            size="md"
            icon={<Icons.Add size={20} strokeWidth={2} />}
            iconPosition="left"
            onClick={() => setShowCreateModal(true)}
          >
            {t('pages.tags.createTag', 'Create Tag')}
          </DoubleButton>
        </PermissionGuard>
      </div>

      {/* Loading State */}
      {isLoading && <TableSkeleton columns={columns.length} rows={5} />}

      {/* Error State */}
      {isError && (
        <ErrorState
          error={error}
          onRetry={() => window.location.reload()}
          title={t('pages.tags.errorLoading', 'Failed to load tags')}
        />
      )}

      {/* Tags Table */}
      {!isLoading && !isError && (
        <DataTable
          columns={columns}
          data={tags}
          emptyMessage={t('pages.tags.noTagsFound', 'No tags found')}
        />
      )}

      {/* Modals */}
      {showCreateModal && (
        <TagFormModal
          open={showCreateModal}
          activeProjectName={activeProjectName}
          onClose={() => setShowCreateModal(false)}
          onSuccess={handleCreateSuccess}
        />
      )}

      {editTag && (
        <TagFormModal
          open={editTag !== null}
          tag={editTag}
          activeProjectName={activeProjectName}
          onClose={() => setEditTag(null)}
          onSuccess={handleEditSuccess}
        />
      )}

      {deleteTagId && tagToDelete && (
        <DeleteTagDialog
          open={deleteTagId !== null}
          tag={tagToDelete}
          onClose={() => setDeleteTagId(null)}
          onSuccess={handleDeleteSuccess}
        />
      )}
    </div>
  )
}

export default TagsPage
