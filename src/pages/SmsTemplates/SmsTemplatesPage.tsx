/**
 * SMS Templates Management Page
 *
 * Main page for managing SMS templates with table view, create, edit, view, and delete actions.
 */

import { useState, useMemo, useEffect, useRef, startTransition } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { DataTable, type Column, type SortConfig } from '@/components/ui/DataTable'
import { LinkButton } from '@/components/ui/LinkButton'
import { DoubleButton } from '@/components/ui/DoubleButton'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/DropdownMenu'
import { Icons } from '@/lib/icons'
import type { SmsTemplate } from './types'
import { mapTemplateResponseArray } from './utils'
import { useDeletedSMSTemplates, useRestoreSMSTemplate, useSMSTemplates } from '@/features/sms'
import type { TemplateTrashResponse } from '@/features/sms'
import { useAuthStore } from '@/stores/authStore'
import { Button } from '@/components/ui/Button'
import { PermissionGuard } from '@/components/auth'
import { DeletedItemsSection, useExpiryLabel } from '@/components/softDelete'
import { formatDateTime } from '@/lib/formatters'
import { PERMISSIONS } from '@/constants/permissions'
import {
  CreateTemplateModal,
  EditTemplateModal,
  ViewTemplateModal,
  DeleteTemplateModal,
  SmsTemplatesPageSkeleton,
  SmsTemplatesTableSectionSkeleton,
} from './components'

// Maximum length for message text excerpt in table
const MESSAGE_EXCERPT_LENGTH = 80

export function SmsTemplatesPage() {
  const { t } = useTranslation('common')
  const [searchParams] = useSearchParams()
  const searchQuery = searchParams.get('search') || ''
  const searchType = searchParams.get('type') || 'name'
  const { user } = useAuthStore()

  const [currentPage, setCurrentPage] = useState(1)
  const rowsPerPage = 10
  const [sortConfig, setSortConfig] = useState<SortConfig | undefined>()
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [viewTemplateId, setViewTemplateId] = useState<number | null>(null)
  const [editTemplateId, setEditTemplateId] = useState<number | null>(null)
  const [deleteTemplateId, setDeleteTemplateId] = useState<number | null>(null)
  const [openDropdownTemplateId, setOpenDropdownTemplateId] = useState<number | null>(null)
  const prevSearchQueryRef = useRef(searchQuery)

  // Close dropdown when screen size crosses breakpoint (in either direction)
  useEffect(() => {
    let wasMobile = window.innerWidth < 1024 // lg breakpoint

    const handleResize = () => {
      const isMobile = window.innerWidth < 1024

      // Close dropdown if transitioning across breakpoint (mobile <-> desktop)
      if (wasMobile !== isMobile && openDropdownTemplateId !== null) {
        setOpenDropdownTemplateId(null)
      }

      wasMobile = isMobile
    }

    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [openDropdownTemplateId])

  // Fetch templates from API
  const {
    data: templatesData,
    isPending: templatesPending,
    isFetching: templatesFetching,
    isPlaceholderData: templatesIsPlaceholder,
  } = useSMSTemplates(
    user?.active_project_id ? { project_id: parseInt(user.active_project_id, 10) } : undefined
  )

  // Scoped by the caller's token server-side, so no project_id is passed here.
  const deletedTemplates = useDeletedSMSTemplates()
  const restoreTemplate = useRestoreSMSTemplate()
  const expiryLabel = useExpiryLabel()

  const deletedColumns: Column<TemplateTrashResponse>[] = [
    { key: 'name', header: t('pages.smsTemplates.tableHeaders.templateName') },
    {
      key: 'category',
      header: t('pages.smsTemplates.tableHeaders.category'),
      render: (row) => row.category || '-',
    },
    {
      key: 'deleted_at',
      header: t('softDelete.columns.deletedAt', 'Deleted'),
      render: (row) => (row.deleted_at ? formatDateTime(row.deleted_at) : '-'),
    },
    {
      key: 'expires',
      header: t('softDelete.columns.expires', 'Expires'),
      render: (row) => expiryLabel(row.deleted_at),
    },
    {
      key: 'actions',
      header: t('softDelete.columns.actions', 'Actions'),
      align: 'right',
      render: (row) => (
        <PermissionGuard permission={PERMISSIONS.SYSTEM.MANAGE_SETTINGS}>
          <Button
            type="button"
            variant="secondary"
            disabled={restoreTemplate.isPending}
            onClick={() => restoreTemplate.mutate(row.id)}
          >
            {t('softDelete.actions.restore', 'Restore')}
          </Button>
        </PermissionGuard>
      ),
    },
  ]

  // Full-page skeleton: no data yet (keepPreviousData does not apply on first load).
  const showFullPageSkeleton = templatesPending && !templatesData
  // Table-only skeleton: new query key is fetching while showing previous list as placeholder (e.g. project change).
  const showTableSkeleton = templatesIsPlaceholder && templatesFetching

  // Map API templates to frontend format
  const apiTemplates = useMemo(() => {
    if (!templatesData?.templates) return []
    return mapTemplateResponseArray(templatesData.templates)
  }, [templatesData])

  // Reset to page 1 when search query changes
  useEffect(() => {
    if (searchQuery !== prevSearchQueryRef.current) {
      prevSearchQueryRef.current = searchQuery
      startTransition(() => {
        setCurrentPage(1)
      })
    }
  }, [searchQuery])

  // Filter and sort templates
  const filteredTemplates = useMemo(() => {
    let result = [...apiTemplates]

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim()
      result = result.filter((template) => {
        switch (searchType) {
          case 'name':
            return template.name.toLowerCase().includes(query)
          case 'category':
            return template.category.toLowerCase().includes(query)
          case 'message':
            return template.messageText.toLowerCase().includes(query)
          default:
            return (
              template.name.toLowerCase().includes(query) ||
              template.category.toLowerCase().includes(query) ||
              template.messageText.toLowerCase().includes(query)
            )
        }
      })
    }

    // Apply sorting
    if (sortConfig) {
      result.sort((a, b) => {
        const aValue = (a as unknown as Record<string, unknown>)[sortConfig.key]
        const bValue = (b as unknown as Record<string, unknown>)[sortConfig.key]
        if (aValue === bValue) return 0
        const comparison = String(aValue) > String(bValue) ? 1 : -1
        return sortConfig.order === 'asc' ? comparison : -comparison
      })
    }

    return result
  }, [apiTemplates, searchQuery, searchType, sortConfig])

  // Helper function to truncate message text
  const truncateMessage = (text: string, maxLength: number) => {
    if (text.length <= maxLength) return text
    return text.substring(0, maxLength).trim() + '...'
  }

  // Paginate templates
  const paginatedTemplates = useMemo(() => {
    const start = (currentPage - 1) * rowsPerPage
    const end = start + rowsPerPage
    return filteredTemplates.slice(start, end)
  }, [filteredTemplates, currentPage, rowsPerPage])

  const totalPages = Math.ceil(filteredTemplates.length / rowsPerPage)

  const handleSort = (key: string, order: 'asc' | 'desc') => {
    setSortConfig({ key, order })
  }

  const handleView = (template: SmsTemplate) => {
    setViewTemplateId(template.id)
  }

  const handleEdit = (template: SmsTemplate) => {
    setEditTemplateId(template.id)
  }

  const handleDelete = (template: SmsTemplate) => {
    setDeleteTemplateId(template.id)
  }

  const handleCreateSuccess = () => {
    setShowCreateModal(false)
    // Templates will refresh automatically via query invalidation in mutation hook
  }

  const handleEditSuccess = () => {
    setEditTemplateId(null)
    // Templates will refresh automatically via query invalidation in mutation hook
  }

  const handleDeleteSuccess = () => {
    setDeleteTemplateId(null)
    // Templates will refresh automatically via query invalidation in mutation hook
  }

  const columns: Column<SmsTemplate>[] = [
    {
      key: 'id',
      header: '#',
      align: 'left',
      render: (template) => {
        const index = paginatedTemplates.findIndex((t) => t.id === template.id)
        const rowNumber = (currentPage - 1) * rowsPerPage + index + 1
        return rowNumber
      },
    },
    {
      key: 'name',
      header: t('pages.smsTemplates.tableHeaders.templateName'),
      align: 'left',
      sortable: true,
      sortKey: 'name',
      render: (template) => (
        <div className="flex flex-col gap-1">
          <span className="text-foreground font-medium">{template.name}</span>
          <span className="text-muted-foreground text-xs font-light">
            {t('pages.smsTemplates.forms.variables')}: {template.variables.length}{' '}
            {t('pages.smsTemplates.used')}: {template.usageCount} {t('pages.smsTemplates.times')}
          </span>
        </div>
      ),
    },
    {
      key: 'messageText',
      header: t('pages.smsTemplates.tableHeaders.messageTextExcerpt'),
      align: 'left',
      render: (template) => (
        <span className="text-foreground text-sm">
          {truncateMessage(template.messageText, MESSAGE_EXCERPT_LENGTH)}
        </span>
      ),
    },
    {
      key: 'category',
      header: t('pages.smsTemplates.tableHeaders.category'),
      align: 'left',
      sortable: true,
      sortKey: 'category',
      render: (template) => <span className="text-foreground text-sm">{template.category}</span>,
    },
    {
      key: 'actions',
      header: t('pages.smsTemplates.tableHeaders.actions'),
      align: 'center',
      render: (template) => (
        <div className="flex items-center justify-center gap-2 sm:gap-4">
          {/* Desktop: Individual link buttons */}
          <div className="hidden items-center gap-4 lg:flex">
            <PermissionGuard permission={PERMISSIONS.SYSTEM.MANAGE_SETTINGS}>
              <LinkButton
                variant="regular-black"
                size="xs"
                onClick={() => handleEdit(template)}
                leftIcon={
                  <Icons.PencilEdit size={16} className="text-foreground" strokeWidth={1.5} />
                }
              >
                {t('actions.edit')}
              </LinkButton>
            </PermissionGuard>
            <LinkButton
              variant="regular-black"
              size="xs"
              onClick={() => handleView(template)}
              leftIcon={<Icons.View size={16} className="text-foreground" strokeWidth={1.5} />}
            >
              {t('pages.smsTemplates.view')}
            </LinkButton>
            <PermissionGuard permission={PERMISSIONS.SYSTEM.MANAGE_SETTINGS}>
              <LinkButton
                variant="regular-black"
                size="xs"
                onClick={() => handleDelete(template)}
                leftIcon={<Icons.Delete size={16} className="text-foreground" strokeWidth={1.5} />}
              >
                {t('actions.delete')}
              </LinkButton>
            </PermissionGuard>
          </div>

          {/* Mobile/Tablet: Dropdown button group */}
          <div className="lg:hidden">
            <DropdownMenu
              modal={false}
              open={openDropdownTemplateId === template.id}
              onOpenChange={(open) => setOpenDropdownTemplateId(open ? template.id : null)}
            >
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="border-border bg-card text-foreground hover:bg-muted flex h-8 w-8 cursor-pointer items-center justify-center rounded-md border transition-colors focus:outline-none"
                  aria-label={t('pages.smsTemplates.tableHeaders.actions')}
                >
                  <Icons.FilterVertical size={16} strokeWidth={1.5} />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="bg-card">
                <PermissionGuard permission={PERMISSIONS.SYSTEM.MANAGE_SETTINGS}>
                  <DropdownMenuItem
                    onClick={() => handleEdit(template)}
                    className="text-foreground flex cursor-pointer items-center gap-2 text-sm"
                  >
                    <Icons.PencilEdit size={16} strokeWidth={1.5} />
                    <span>{t('actions.edit')}</span>
                  </DropdownMenuItem>
                </PermissionGuard>
                <DropdownMenuItem
                  onClick={() => handleView(template)}
                  className="text-foreground flex cursor-pointer items-center gap-2 text-sm"
                >
                  <Icons.View size={16} strokeWidth={1.5} />
                  <span>{t('pages.smsTemplates.view')}</span>
                </DropdownMenuItem>
                <PermissionGuard permission={PERMISSIONS.SYSTEM.MANAGE_SETTINGS}>
                  <DropdownMenuItem
                    onClick={() => handleDelete(template)}
                    className="text-foreground flex cursor-pointer items-center gap-2 text-sm disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <Icons.Delete size={16} strokeWidth={1.5} />
                    <span>{t('actions.delete')}</span>
                  </DropdownMenuItem>
                </PermissionGuard>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      ),
    },
  ]

  if (showFullPageSkeleton) {
    return <SmsTemplatesPageSkeleton />
  }

  return (
    <div className="flex w-full flex-col items-start gap-4">
      {/* Page Header */}
      <div className="mb-4 flex w-full flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-2 sm:gap-3">
          <h1 className="text-foreground text-xl font-light sm:text-2xl">
            {t('pages.smsTemplates.title')}
          </h1>
          <span className="text-muted-foreground text-sm font-light sm:text-base">
            {filteredTemplates.length} {t('pages.smsTemplates.templates')}
          </span>
        </div>

        {/* Desktop: Full button with text, Mobile: Icon-only button */}
        <PermissionGuard permission={PERMISSIONS.SYSTEM.MANAGE_SETTINGS}>
          <div className="hidden sm:block">
            <DoubleButton
              size="md"
              icon={<Icons.Add size={20} strokeWidth={2} />}
              iconPosition="left"
              onClick={() => setShowCreateModal(true)}
            >
              {t('pages.smsTemplates.createTemplate')}
            </DoubleButton>
          </div>
          {/* Mobile: Icon-only button */}
          <button
            onClick={() => setShowCreateModal(true)}
            className="bg-primary-300 text-primary-foreground hover:bg-primary-500 flex h-10 w-10 items-center justify-center rounded-full transition-colors focus:outline-none sm:hidden"
            aria-label={t('pages.smsTemplates.createTemplate')}
          >
            <Icons.Add size={20} strokeWidth={2} />
          </button>
        </PermissionGuard>
      </div>

      {showTableSkeleton ? (
        <SmsTemplatesTableSectionSkeleton />
      ) : (
        <>
          {/* Data Table */}
          <DataTable
            columns={columns}
            data={paginatedTemplates}
            sortConfig={sortConfig}
            onSort={handleSort}
            emptyMessage={t('pages.smsTemplates.noTemplatesFound')}
            className="flex flex-col items-start gap-8 self-stretch"
          />

          {/* Three tracks so the page controls stay optically centred: the count
              on the left is balanced by an empty track of equal width on the
              right, whatever the text length. */}
          <div className="flex w-full flex-row justify-center gap-3 sm:items-center">
            <span className="text-muted-foreground hidden flex-1 text-xs font-light sm:inline sm:text-sm">
              {t('pages.smsTemplates.showing')} {paginatedTemplates.length}{' '}
              {t('pages.smsTemplates.of')} {filteredTemplates.length}{' '}
              {t('pages.smsTemplates.templates')}
            </span>
            <div className="flex items-center justify-center gap-2">
              {/* Previous Arrow */}
              <button
                onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                disabled={currentPage === 1}
                className="border-border bg-card hover:bg-muted disabled:hover:bg-card flex h-10 w-10 items-center justify-center rounded-full border transition-colors disabled:cursor-not-allowed disabled:opacity-40"
                aria-label={t('components.pagination.previousPage')}
              >
                <Icons.ArrowLeft size={16} className="text-foreground" strokeWidth={1.5} />
              </button>

              {/* Page Numbers */}
              {(() => {
                const pages: (number | string)[] = []
                const maxVisible = 5

                if (totalPages <= maxVisible) {
                  // Show all pages if 5 or fewer
                  for (let i = 1; i <= totalPages; i++) {
                    pages.push(i)
                  }
                } else {
                  // Always show first page
                  pages.push(1)

                  // Determine pages around current
                  if (currentPage <= 3) {
                    // Near the start: show 1, 2, 3, 4
                    for (let i = 2; i <= 4; i++) {
                      pages.push(i)
                    }
                    pages.push('ellipsis')
                    pages.push(totalPages)
                  } else if (currentPage >= totalPages - 2) {
                    // Near the end: show last-3, last-2, last-1, last
                    pages.push('ellipsis')
                    for (let i = totalPages - 3; i <= totalPages; i++) {
                      pages.push(i)
                    }
                  } else {
                    // In the middle: show current-1, current, current+1
                    pages.push('ellipsis')
                    pages.push(currentPage - 1)
                    pages.push(currentPage)
                    pages.push(currentPage + 1)
                    pages.push('ellipsis')
                    pages.push(totalPages)
                  }
                }

                return pages.map((page, index) => {
                  if (page === 'ellipsis') {
                    return (
                      <span
                        key={`ellipsis-${index}`}
                        className="text-foreground px-1 text-xs sm:px-2 sm:text-sm"
                      >
                        ...
                      </span>
                    )
                  }
                  return (
                    <button
                      key={page}
                      onClick={() => setCurrentPage(page as number)}
                      className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-medium transition-colors sm:h-10 sm:w-10 sm:text-sm ${
                        currentPage === page
                          ? 'bg-secondary-800 text-secondary-foreground'
                          : 'border-border bg-card text-foreground hover:bg-muted border'
                      }`}
                      aria-label={`Go to page ${page}`}
                      aria-current={currentPage === page ? 'page' : undefined}
                    >
                      {page}
                    </button>
                  )
                })
              })()}

              {/* Next Arrow */}
              <button
                onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                disabled={currentPage === totalPages}
                className="border-border bg-card hover:bg-muted disabled:hover:bg-card flex h-10 w-10 items-center justify-center rounded-full border transition-colors disabled:cursor-not-allowed disabled:opacity-40"
                aria-label={t('components.pagination.nextPage')}
              >
                <Icons.ArrowRight size={16} className="text-foreground" strokeWidth={1.5} />
              </button>
            </div>
            <span className="hidden flex-1 sm:block" aria-hidden="true" />
          </div>
          <DeletedItemsSection
            items={deletedTemplates.data?.templates ?? []}
            total={deletedTemplates.data?.total ?? 0}
            columns={deletedColumns}
            title={t('pages.smsTemplates.deleted.title', 'Deleted templates')}
          />
        </>
      )}

      {/* Modals */}
      {showCreateModal && (
        <CreateTemplateModal
          open={showCreateModal}
          onClose={() => setShowCreateModal(false)}
          onSuccess={handleCreateSuccess}
        />
      )}

      {viewTemplateId && (
        <ViewTemplateModal
          open={viewTemplateId !== null}
          templateId={viewTemplateId}
          onClose={() => setViewTemplateId(null)}
        />
      )}

      {editTemplateId && (
        <EditTemplateModal
          open={editTemplateId !== null}
          templateId={editTemplateId}
          onClose={() => setEditTemplateId(null)}
          onSuccess={handleEditSuccess}
        />
      )}

      {deleteTemplateId && (
        <DeleteTemplateModal
          open={deleteTemplateId !== null}
          templateId={deleteTemplateId}
          onClose={() => setDeleteTemplateId(null)}
          onSuccess={handleDeleteSuccess}
        />
      )}
    </div>
  )
}

export default SmsTemplatesPage
