/**
 * Seller Management Page
 *
 * Main page component for managing sellers.
 * Based on User Management page structure.
 */

import { useState, useCallback, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useURLState, useAutoPersistedState } from '@/hooks'
import { Icons } from '@/lib/icons'
import { DataTable, type Column } from '@/components/ui/DataTable'
import { Pagination } from '@/components/ui/Pagination'
import { TableSkeleton } from '@/components/ui/TableSkeleton'
import { ErrorState } from '@/components/ErrorState'
import { LinkButton } from '@/components/ui/LinkButton'
import { DoubleButton } from '@/components/ui/DoubleButton'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/DropdownMenu'
import { CreateSellerModal, EditSellerModal, DeleteSellerConfirmationModal } from './components'
import { useSellers, useDeleteSeller, type Seller } from '@/features/sellers'
import { PermissionGuard } from '@/components/auth'
import { PERMISSIONS } from '@/constants/permissions'

const DEFAULT_PAGE_SIZE = 10

export function SellerManagementPage() {
  const { t } = useTranslation('common')

  // URL state for pagination and search
  const [currentPage, setCurrentPage] = useURLState<number>('page', 1)
  const [pageSize, setPageSize] = useURLState<number>('pageSize', DEFAULT_PAGE_SIZE)
  const [searchQuery, setSearchQuery] = useURLState<string>('search', '')

  // Add persistence for state
  useAutoPersistedState(
    'seller-management-state',
    {
      currentPage,
      pageSize,
      searchQuery,
    },
    {
      currentPage: setCurrentPage,
      pageSize: setPageSize,
      searchQuery: setSearchQuery,
    }
  )

  const [showCreateModal, setShowCreateModal] = useState(false)
  const [editSellerId, setEditSellerId] = useState<number | null>(null)
  const [deletingSeller, setDeletingSeller] = useState<Seller | null>(null)
  const [openDropdownSellerId, setOpenDropdownSellerId] = useState<number | null>(null)

  // Fetch sellers from API
  const {
    data: sellersData,
    isLoading,
    isError,
    refetch,
  } = useSellers({
    search: searchQuery,
    skip: (currentPage - 1) * pageSize,
    limit: pageSize,
  })

  const deleteSellerMutation = useDeleteSeller()

  // Close dropdown when screen size crosses breakpoint (in either direction)
  useEffect(() => {
    let wasMobile = window.innerWidth < 1024 // lg breakpoint

    const handleResize = () => {
      const isMobile = window.innerWidth < 1024

      // Close dropdown if transitioning across breakpoint (mobile <-> desktop)
      if (wasMobile !== isMobile && openDropdownSellerId !== null) {
        setOpenDropdownSellerId(null)
      }

      wasMobile = isMobile
    }

    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [openDropdownSellerId])

  // Pagination
  const sellers = sellersData?.sellers || []
  const totalSellers = sellersData?.total || 0
  const totalPages = Math.ceil(totalSellers / pageSize)

  const handleSearch = useCallback(() => {
    setCurrentPage(1) // Reset to first page on search
  }, [setCurrentPage])

  const navigate = useNavigate()

  const handleViewAgreements = (seller: Seller) => {
    navigate(`/dashboard/sellers/${seller.id}`)
  }

  const handleEdit = (seller: Seller) => {
    setEditSellerId(seller.id)
  }

  const handleDelete = (seller: Seller) => {
    setDeletingSeller(seller)
  }

  const handleDeleteConfirm = async () => {
    if (!deletingSeller) return

    try {
      await deleteSellerMutation.mutateAsync({ sellerId: deletingSeller.id })
      setDeletingSeller(null)
      refetch() // Refresh seller list
    } catch (error) {
      console.error('Failed to delete seller:', error)
    }
  }

  const handleDeleteCancel = () => {
    setDeletingSeller(null)
  }

  const handleCreateSuccess = () => {
    setShowCreateModal(false)
    refetch() // Refresh seller list
  }

  const handleEditSuccess = () => {
    setEditSellerId(null)
    refetch() // Refresh seller list
  }

  const handleCloseEdit = () => {
    setEditSellerId(null)
  }

  // Get seller data for edit modal
  const editSeller = editSellerId ? sellers.find((s) => s.id === editSellerId) : undefined

  // Table columns definition
  const columns: Column<Seller>[] = [
    {
      key: 'seller_code',
      header: t('pages.sellers.tableHeaders.sellerCode'),
      render: (seller) => <span className="font-medium">{seller.seller_code}</span>,
    },
    {
      key: 'seller_name',
      header: t('pages.sellers.tableHeaders.sellerName'),
      render: (seller) => <span className="font-medium">{seller.seller_name}</span>,
    },
    {
      key: 'legal_name',
      header: t('pages.sellers.tableHeaders.legalName'),
      render: (seller) => (
        <span className="font-light text-gray-700">{seller.legal_name || '—'}</span>
      ),
    },
    {
      key: 'seller_type',
      header: t('pages.sellers.tableHeaders.sellerType'),
      render: (seller) => (
        <span className="text-gray-700 capitalize">{seller.seller_type.replace('_', ' ')}</span>
      ),
    },
    {
      key: 'contact_email',
      header: t('pages.sellers.tableHeaders.email'),
      render: (seller) => <span className="text-gray-700">{seller.contact_email || '-'}</span>,
    },
    {
      key: 'contact',
      header: t('pages.sellers.tableHeaders.contact'),
      render: (seller) => (
        <div className="flex flex-col">
          <span>{seller.contact_person || '-'}</span>
          {seller.contact_phone && (
            <span className="text-xs text-gray-500">{seller.contact_phone}</span>
          )}
        </div>
      ),
    },
    {
      key: 'is_active',
      header: t('pages.sellers.tableHeaders.status'),
      render: (seller) => (
        <span
          className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${
            seller.is_active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
          }`}
        >
          {seller.is_active ? t('pages.sellers.status.active') : t('pages.sellers.status.inactive')}
        </span>
      ),
    },
    {
      key: 'actions',
      header: t('pages.sellers.tableHeaders.actions'),
      align: 'center',
      render: (seller) => (
        <div className="flex items-center justify-center gap-2 sm:gap-4">
          {/* Desktop: Individual buttons */}
          <div className="hidden items-center gap-4 lg:flex">
            <PermissionGuard permission={PERMISSIONS.SELLERS.VIEW}>
              <LinkButton
                variant="regular-black"
                size="xs"
                onClick={() => handleViewAgreements(seller)}
                leftIcon={<Icons.View size={16} color="#05040D" strokeWidth={1.5} />}
              >
                {t('pages.sellers.actions.viewAgreements')}
              </LinkButton>
            </PermissionGuard>
            <PermissionGuard permission={PERMISSIONS.SELLERS.EDIT}>
              <LinkButton
                variant="regular-black"
                size="xs"
                onClick={() => handleEdit(seller)}
                leftIcon={<Icons.PencilEdit size={16} color="#05040D" strokeWidth={1.5} />}
              >
                {t('pages.sellers.actions.edit')}
              </LinkButton>
            </PermissionGuard>
            <PermissionGuard permission={PERMISSIONS.SELLERS.DELETE}>
              <LinkButton
                variant="regular-black"
                size="xs"
                onClick={() => handleDelete(seller)}
                leftIcon={<Icons.Delete size={16} color="#05040D" strokeWidth={1.5} />}
              >
                {t('pages.sellers.actions.delete')}
              </LinkButton>
            </PermissionGuard>
          </div>

          {/* Mobile/Tablet: Dropdown button group */}
          <div className="lg:hidden">
            <DropdownMenu
              modal={false}
              open={openDropdownSellerId === seller.id}
              onOpenChange={(open) => setOpenDropdownSellerId(open ? seller.id : null)}
            >
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="text-dark-500 flex h-8 w-8 cursor-pointer items-center justify-center rounded-md border border-gray-300 bg-white transition-colors hover:bg-gray-100 focus:outline-none"
                  aria-label={t('pages.sellers.tableHeaders.actions')}
                >
                  <Icons.FilterVertical size={16} strokeWidth={1.5} />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="bg-white">
                <PermissionGuard permission={PERMISSIONS.SELLERS.VIEW}>
                  <DropdownMenuItem
                    onClick={() => handleViewAgreements(seller)}
                    className="text-dark-500 flex cursor-pointer items-center gap-2 text-sm"
                  >
                    <Icons.View size={16} strokeWidth={1.5} />
                    <span>{t('pages.sellers.actions.viewAgreements')}</span>
                  </DropdownMenuItem>
                </PermissionGuard>
                <PermissionGuard permission={PERMISSIONS.SELLERS.EDIT}>
                  <DropdownMenuItem
                    onClick={() => handleEdit(seller)}
                    className="text-dark-500 flex cursor-pointer items-center gap-2 text-sm"
                  >
                    <Icons.PencilEdit size={16} strokeWidth={1.5} />
                    <span>{t('pages.sellers.actions.edit')}</span>
                  </DropdownMenuItem>
                </PermissionGuard>
                <PermissionGuard permission={PERMISSIONS.SELLERS.DELETE}>
                  <DropdownMenuItem
                    onClick={() => handleDelete(seller)}
                    className="text-dark-500 flex cursor-pointer items-center gap-2 text-sm"
                  >
                    <Icons.Delete size={16} strokeWidth={1.5} />
                    <span>{t('pages.sellers.actions.delete')}</span>
                  </DropdownMenuItem>
                </PermissionGuard>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      ),
    },
  ]

  return (
    <div>
      {/* Page Header */}
      <div className="mb-4 flex items-center justify-between gap-2 sm:gap-3">
        <div className="flex items-center gap-2 sm:gap-3">
          <h1 className="text-dark-500 text-xl font-light sm:text-2xl">
            {t('pages.sellers.title')}
          </h1>
          <span className="text-sm font-light text-gray-500 sm:text-base">{totalSellers}</span>
        </div>

        <PermissionGuard permission={PERMISSIONS.SELLERS.CREATE}>
          {/* Desktop: Full button with text, Mobile: Icon-only button */}
          <div className="hidden sm:block">
            <DoubleButton
              size="md"
              icon={<Icons.Add size={20} strokeWidth={2} />}
              iconPosition="left"
              onClick={() => setShowCreateModal(true)}
            >
              {t('pages.sellers.addNewSeller')}
            </DoubleButton>
          </div>
          {/* Mobile: Icon-only button */}
          <button
            onClick={() => setShowCreateModal(true)}
            className="bg-primary-300 text-dark-500 hover:bg-primary-500 flex h-10 w-10 items-center justify-center rounded-full transition-colors focus:outline-none sm:hidden"
            aria-label={t('pages.sellers.addNewSeller')}
          >
            <Icons.Add size={20} strokeWidth={2} />
          </button>
        </PermissionGuard>
      </div>

      {/* Search Bar */}
      <div className="mb-6 flex w-full items-center gap-4">
        {/* Search pill - responsive width only */}
        <div className="flex items-center gap-3">
          <div className="flex w-[280px] items-center gap-3 rounded-full border border-gray-200 bg-white pr-2 pl-4 shadow-sm sm:w-[400px] md:w-[500px] lg:w-[600px]">
            {/* Search Input */}
            <div className="flex flex-1 items-center gap-2 py-1">
              <input
                type="text"
                placeholder={t('pages.sellers.searchPlaceholder')}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleSearch()
                  }
                }}
                className="text-dark-500 h-9 w-full bg-transparent text-sm font-light outline-none placeholder:text-gray-500"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full transition-colors hover:bg-gray-100"
                  type="button"
                  aria-label="Clear search"
                >
                  <Icons.Close size={14} className="text-gray-500" />
                </button>
              )}
            </div>

            {/* Search Button - circular green button with icon only */}
            <button
              type="button"
              onClick={handleSearch}
              disabled={isLoading}
              className="bg-primary-300 flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition-all duration-200 hover:scale-105 disabled:opacity-60"
              aria-label={t('pages.sellers.searchButton')}
            >
              <Icons.Search size={18} className="text-dark-500" strokeWidth={1.5} />
            </button>
          </div>
        </div>
      </div>

      {/* Loading State */}
      {isLoading && <TableSkeleton columns={columns.length} rows={pageSize} />}

      {/* Error State */}
      {isError && (
        <ErrorState
          error={new Error('Failed to load sellers')}
          onRetry={() => window.location.reload()}
          title={t('pages.sellers.errorLoading')}
        />
      )}

      {/* Seller Table */}
      {!isLoading && !isError && (
        <DataTable
          columns={columns}
          data={sellers}
          emptyMessage={t('pages.sellers.noSellersFound')}
        />
      )}

      {/* Pagination */}
      {!isLoading && !isError && (
        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          pageSize={pageSize}
          onPageChange={setCurrentPage}
          onPageSizeChange={(newSize) => {
            setPageSize(newSize)
            setCurrentPage(1) // Reset to first page when changing page size
          }}
        />
      )}

      {/* Modals */}
      {showCreateModal && (
        <CreateSellerModal
          open={showCreateModal}
          onClose={() => setShowCreateModal(false)}
          onSuccess={handleCreateSuccess}
        />
      )}

      {editSellerId && (
        <EditSellerModal
          open={editSellerId !== null}
          sellerId={editSellerId}
          seller={editSeller}
          onClose={handleCloseEdit}
          onSuccess={handleEditSuccess}
        />
      )}

      {/* Delete Confirmation Modal */}
      {deletingSeller && (
        <DeleteSellerConfirmationModal
          open={deletingSeller !== null}
          onConfirm={handleDeleteConfirm}
          onCancel={handleDeleteCancel}
          isLoading={deleteSellerMutation.isPending}
        />
      )}
    </div>
  )
}

export default SellerManagementPage
