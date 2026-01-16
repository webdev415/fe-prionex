/**
 * Tags Management Page
 *
 * Admin page for managing tags used throughout the system.
 * Integrated with real API using React Query.
 */

import { useState, useMemo, useEffect } from 'react'
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/DropdownMenu'
import { TagFormModal } from './components/TagFormModal'
import { DeleteTagDialog } from './components/DeleteTagDialog'

export function TagsPage() {
  const { t, i18n } = useTranslation('common')
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [editTag, setEditTag] = useState<Tag | null>(null)
  const [deleteTagId, setDeleteTagId] = useState<number | null>(null)
  const [openDropdownTagId, setOpenDropdownTagId] = useState<number | null>(null)

  // Get current user and active project
  const { user } = useAuth()
  const activeProjectName = useMemo(() => {
    if (!user?.active_project_id || !user?.projects) return undefined
    const activeProject = user.projects.find((p) => p.id === user.active_project_id)
    return activeProject?.name
  }, [user])

  // Fetch tags
  const { data: tags = [], isLoading, isError, error } = useTags()

  // Close dropdown when screen size crosses breakpoint (in either direction)
  useEffect(() => {
    let wasMobile = window.innerWidth < 1024 // lg breakpoint

    const handleResize = () => {
      const isMobile = window.innerWidth < 1024

      // Close dropdown if transitioning across breakpoint (mobile <-> desktop)
      if (wasMobile !== isMobile && openDropdownTagId !== null) {
        setOpenDropdownTagId(null)
      }

      wasMobile = isMobile
    }

    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [openDropdownTagId])

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

  // Table columns definition - recalculate when language changes
  const columns: Column<Tag>[] = useMemo(
    () => [
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
            {/* Desktop: Individual link buttons */}
            <div className="hidden items-center gap-4 lg:flex">
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

            {/* Mobile/Tablet: Dropdown button group */}
            <div className="lg:hidden">
              <DropdownMenu
                modal={false}
                open={openDropdownTagId === tag.id}
                onOpenChange={(open) => setOpenDropdownTagId(open ? tag.id : null)}
              >
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    className="text-dark-500 flex h-8 w-8 cursor-pointer items-center justify-center rounded-md border border-gray-300 bg-white transition-colors hover:bg-gray-100 focus:outline-none"
                    aria-label={t('pages.tags.tableHeaders.actions', 'Actions')}
                  >
                    <Icons.FilterVertical size={16} strokeWidth={1.5} />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="bg-white">
                  <PermissionGuard permission={PERMISSIONS.TAGS.EDIT}>
                    <DropdownMenuItem
                      onClick={() => {
                        handleEdit(tag)
                        setOpenDropdownTagId(null)
                      }}
                      className="text-dark-500 flex cursor-pointer items-center gap-2 text-sm"
                    >
                      <Icons.PencilEdit size={16} strokeWidth={1.5} />
                      <span>{t('pages.tags.actions.edit', 'Edit')}</span>
                    </DropdownMenuItem>
                  </PermissionGuard>
                  <PermissionGuard permission={PERMISSIONS.TAGS.DELETE}>
                    <DropdownMenuItem
                      onClick={() => {
                        handleDelete(tag.id)
                        setOpenDropdownTagId(null)
                      }}
                      className="text-dark-500 flex cursor-pointer items-center gap-2 text-sm"
                    >
                      <Icons.Delete size={16} strokeWidth={1.5} />
                      <span>{t('pages.tags.actions.delete', 'Delete')}</span>
                    </DropdownMenuItem>
                  </PermissionGuard>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        ),
      },
    ],
    // i18n.language is needed to recalculate columns when language changes
    // openDropdownTagId is needed to update dropdown state in render function
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [t, i18n?.language, openDropdownTagId]
  )

  return (
    <div>
      {/* Page Header */}
      <div className="mb-4 flex items-center justify-between gap-2 sm:gap-3">
        <div className="flex items-center gap-2 sm:gap-3">
          <h1 className="text-dark-500 text-xl font-light sm:text-2xl">
            {t('pages.tags.title', 'Tags')}
          </h1>
          <span className="text-sm font-light text-gray-500 sm:text-base">{tags.length}</span>
        </div>

        <PermissionGuard permission={PERMISSIONS.TAGS.CREATE}>
          {/* Desktop: Full button with text */}
          <div className="hidden sm:block">
            <DoubleButton
              size="md"
              icon={<Icons.Add size={20} strokeWidth={2} />}
              iconPosition="left"
              onClick={() => setShowCreateModal(true)}
            >
              {t('pages.tags.createTag', 'Create Tag')}
            </DoubleButton>
          </div>
          {/* Mobile: Icon-only button */}
          <button
            onClick={() => setShowCreateModal(true)}
            className="bg-primary-300 text-dark-500 hover:bg-primary-500 flex h-10 w-10 items-center justify-center rounded-full transition-colors focus:outline-none sm:hidden"
            aria-label={t('pages.tags.createTag', 'Create Tag')}
          >
            <Icons.Add size={20} strokeWidth={2} />
          </button>
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
