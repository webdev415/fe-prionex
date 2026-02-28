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
import { useSMSTemplates } from '@/features/sms'
import { useAuthStore } from '@/stores/authStore'
import { PermissionGuard } from '@/components/auth'
import { PERMISSIONS } from '@/constants/permissions'
import {
  CreateTemplateModal,
  EditTemplateModal,
  ViewTemplateModal,
  DeleteTemplateModal,
  SmsTemplatesPageSkeleton,
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
  const { data: templatesData, isLoading } = useSMSTemplates(
    user?.active_project_id ? { project_id: parseInt(user.active_project_id) } : undefined
  )

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
          <span className="text-dark-500 font-medium">{template.name}</span>
          <span className="text-xs font-light text-gray-700">
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
        <span className="text-dark-500 text-sm">
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
      render: (template) => <span className="text-dark-500 text-sm">{template.category}</span>,
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
                leftIcon={<Icons.PencilEdit size={16} color="#05040D" strokeWidth={1.5} />}
              >
                {t('actions.edit')}
              </LinkButton>
            </PermissionGuard>
            <LinkButton
              variant="regular-black"
              size="xs"
              onClick={() => handleView(template)}
              leftIcon={<Icons.View size={16} color="#05040D" strokeWidth={1.5} />}
            >
              {t('pages.smsTemplates.view')}
            </LinkButton>
            <PermissionGuard permission={PERMISSIONS.SYSTEM.MANAGE_SETTINGS}>
              <LinkButton
                variant="regular-black"
                size="xs"
                disabled={template.isSystem}
                onClick={() => handleDelete(template)}
                leftIcon={<Icons.Delete size={16} color="#05040D" strokeWidth={1.5} />}
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
                  className="text-dark-500 flex h-8 w-8 cursor-pointer items-center justify-center rounded-md border border-gray-300 bg-white transition-colors hover:bg-gray-100 focus:outline-none"
                  aria-label={t('pages.smsTemplates.tableHeaders.actions')}
                >
                  <Icons.FilterVertical size={16} strokeWidth={1.5} />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="bg-white">
                <PermissionGuard permission={PERMISSIONS.SYSTEM.MANAGE_SETTINGS}>
                  <DropdownMenuItem
                    onClick={() => handleEdit(template)}
                    className="text-dark-500 flex cursor-pointer items-center gap-2 text-sm"
                  >
                    <Icons.PencilEdit size={16} strokeWidth={1.5} />
                    <span>{t('actions.edit')}</span>
                  </DropdownMenuItem>
                </PermissionGuard>
                <DropdownMenuItem
                  onClick={() => handleView(template)}
                  className="text-dark-500 flex cursor-pointer items-center gap-2 text-sm"
                >
                  <Icons.View size={16} strokeWidth={1.5} />
                  <span>{t('pages.smsTemplates.view')}</span>
                </DropdownMenuItem>
                <PermissionGuard permission={PERMISSIONS.SYSTEM.MANAGE_SETTINGS}>
                  <DropdownMenuItem
                    onClick={() => handleDelete(template)}
                    disabled={template.isSystem}
                    className="text-dark-500 flex cursor-pointer items-center gap-2 text-sm disabled:cursor-not-allowed disabled:opacity-50"
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

  // Show loading skeleton
  if (isLoading) {
    return <SmsTemplatesPageSkeleton />
  }

  return (
    <div className="flex w-full flex-col items-start gap-4">
      {/* Page Header */}
      <div className="mb-4 flex w-full flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-2 sm:gap-3">
          <h1 className="text-dark-500 text-xl font-light sm:text-2xl">
            {t('pages.smsTemplates.title')}
          </h1>
          <span className="text-sm font-light text-gray-500 sm:text-base">
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
            className="bg-primary-300 text-dark-500 hover:bg-primary-500 flex h-10 w-10 items-center justify-center rounded-full transition-colors focus:outline-none sm:hidden"
            aria-label={t('pages.smsTemplates.createTemplate')}
          >
            <Icons.Add size={20} strokeWidth={2} />
          </button>
        </PermissionGuard>
      </div>

      {/* Data Table */}
      <DataTable
        columns={columns}
        data={paginatedTemplates}
        sortConfig={sortConfig}
        onSort={handleSort}
        emptyMessage={t('pages.smsTemplates.noTemplatesFound')}
        className="flex flex-col items-start gap-8 self-stretch"
      />

      {/* Pagination */}
      <div className="flex w-full flex-row justify-center gap-3 sm:items-center sm:justify-between">
        <span className="hidden text-xs font-light text-gray-700 sm:inline sm:text-sm">
          {t('pages.smsTemplates.showing')} {paginatedTemplates.length} {t('pages.smsTemplates.of')}{' '}
          {filteredTemplates.length} {t('pages.smsTemplates.templates')}
        </span>
        <div className="flex items-center justify-center gap-2">
          {/* Previous Arrow */}
          <button
            onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
            disabled={currentPage === 1}
            className="flex h-10 w-10 items-center justify-center rounded-full border border-gray-300 bg-white transition-colors hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-white"
            aria-label="Previous page"
          >
            <Icons.ArrowLeft size={16} className="text-dark-500" strokeWidth={1.5} />
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
                    className="text-dark-500 px-1 text-xs sm:px-2 sm:text-sm"
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
                      ? 'bg-secondary-800 text-white'
                      : 'text-dark-500 border border-gray-300 bg-white hover:bg-gray-100'
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
            className="flex h-10 w-10 items-center justify-center rounded-full border border-gray-300 bg-white transition-colors hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-white"
            aria-label="Next page"
          >
            <Icons.ArrowRight size={16} className="text-dark-500" strokeWidth={1.5} />
          </button>
        </div>
        <div className="flex hidden items-center gap-1 sm:flex">
          <Icons.Info size={14} className="text-gray-500 sm:size-4" strokeWidth={1.5} />
          <span className="text-[10px] font-light text-gray-700 sm:text-xs">
            {t('pages.smsTemplates.systemTemplatesCannotBeDeleted')}
          </span>
        </div>
      </div>

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
