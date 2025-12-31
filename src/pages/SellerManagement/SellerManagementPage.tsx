/**
 * Seller Management Page
 *
 * Main page component for managing sellers.
 * Based on User Management page structure.
 */

import { useState, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { Icons } from '@/lib/icons'
import { DataTable, type Column } from '@/components/ui/DataTable'
import { Pagination } from '@/components/ui/Pagination'
import { TableSkeleton } from '@/components/ui/TableSkeleton'
import { ErrorState } from '@/components/ErrorState'
import { LinkButton } from '@/components/ui/LinkButton'
import { DoubleButton } from '@/components/ui/DoubleButton'
import { CreateSellerModal, EditSellerModal, DeleteSellerConfirmationModal } from './components'

const DEFAULT_PAGE_SIZE = 10

// Mock seller data type - replace with actual API type later
interface Seller {
  id: number
  companyName: string
  website?: string
  email?: string
  taxId: string
  contactName: string
  contactPhone?: string
  clientsCount: number
  streetAddress?: string
  city?: string
  stateProvince?: string
  postalCode?: string
  country?: string
  notes?: string
}

// Mock data - replace with actual API call later
const mockSellers: Seller[] = [
  {
    id: 1,
    companyName: 'ABC Bank Corp',
    website: 'abc.bank.com',
    email: 'active@abcbank.com',
    taxId: '123456789',
    contactName: 'John Manager',
    contactPhone: '+1234567890',
    clientsCount: 145,
  },
  {
    id: 2,
    companyName: 'XYZ Financial LLC',
    website: 'xyz-financial.com',
    email: 'info@xyz.com',
    taxId: '987654321',
    contactName: 'Jane Director',
    contactPhone: '+0987654321',
    clientsCount: 87,
  },
  {
    id: 3,
    companyName: 'Quick Loans Inc',
    website: 'quickloans.net',
    email: 'sales@ql.net',
    taxId: '456789123',
    contactName: 'Bob Sales',
    contactPhone: '+5556667777',
    clientsCount: 56,
  },
]

export function SellerManagementPage() {
  const { t } = useTranslation('common')
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE)
  const [searchQuery, setSearchQuery] = useState('')
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [editSellerId, setEditSellerId] = useState<number | null>(null)
  const [deletingSeller, setDeletingSeller] = useState<Seller | null>(null)
  const [isLoading] = useState(false)
  const [isError] = useState(false)

  // Filter sellers based on search query
  const filteredSellers = mockSellers.filter((seller) => {
    if (!searchQuery.trim()) return true
    const query = searchQuery.toLowerCase()
    return (
      seller.companyName.toLowerCase().includes(query) ||
      seller.taxId.toLowerCase().includes(query) ||
      seller.contactName.toLowerCase().includes(query) ||
      seller.email?.toLowerCase().includes(query) ||
      seller.website?.toLowerCase().includes(query)
    )
  })

  // Pagination
  const totalSellers = filteredSellers.length
  const totalPages = Math.ceil(totalSellers / pageSize)
  const startIndex = (currentPage - 1) * pageSize
  const paginatedSellers = filteredSellers.slice(startIndex, startIndex + pageSize)

  const handleSearch = useCallback(() => {
    setCurrentPage(1) // Reset to first page on search
  }, [])

  const handleEdit = (seller: Seller) => {
    setEditSellerId(seller.id)
  }

  const handleDelete = (seller: Seller) => {
    setDeletingSeller(seller)
  }

  const handleDeleteConfirm = async () => {
    if (!deletingSeller) return

    try {
      // TODO: Replace with actual API call
      // await deleteSellerMutation.mutateAsync({ id: deletingSeller.id })
      console.log('Deleting seller:', deletingSeller.id)

      // Simulate API call
      await new Promise((resolve) => setTimeout(resolve, 500))

      setDeletingSeller(null)
      // TODO: Refresh seller list
    } catch (error) {
      console.error('Failed to delete seller:', error)
    }
  }

  const handleDeleteCancel = () => {
    setDeletingSeller(null)
  }

  const handleCreateSuccess = () => {
    setShowCreateModal(false)
    // TODO: Refresh seller list
  }

  const handleEditSuccess = () => {
    setEditSellerId(null)
    // TODO: Refresh seller list
  }

  const handleCloseEdit = () => {
    setEditSellerId(null)
  }

  // Get seller data for edit modal
  const editSeller = editSellerId ? mockSellers.find((s) => s.id === editSellerId) : undefined

  // Table columns definition
  const columns: Column<Seller>[] = [
    {
      key: 'companyName',
      header: t('pages.sellers.tableHeaders.companyName'),
      render: (seller) => <span className="font-medium">{seller.companyName}</span>,
    },
    {
      key: 'website',
      header: t('pages.sellers.tableHeaders.website'),
      render: (seller) => <span className="text-gray-700">{seller.website || '-'}</span>,
    },
    {
      key: 'email',
      header: t('pages.sellers.tableHeaders.email'),
      render: (seller) => <span className="text-gray-700">{seller.email || '-'}</span>,
    },
    {
      key: 'taxId',
      header: t('pages.sellers.tableHeaders.taxId'),
      render: (seller) => <span>{seller.taxId}</span>,
    },
    {
      key: 'contact',
      header: t('pages.sellers.tableHeaders.contact'),
      render: (seller) => (
        <div className="flex flex-col">
          <span>{seller.contactName}</span>
          {seller.contactPhone && (
            <span className="text-xs text-gray-500">{seller.contactPhone}</span>
          )}
        </div>
      ),
    },
    {
      key: 'clients',
      header: t('pages.sellers.tableHeaders.clients'),
      render: (seller) => <span>{seller.clientsCount}</span>,
    },
    {
      key: 'actions',
      header: t('pages.sellers.tableHeaders.actions'),
      align: 'center',
      render: (seller) => (
        <div className="flex items-center justify-center gap-4">
          <LinkButton
            variant="regular-black"
            size="xs"
            onClick={() => handleEdit(seller)}
            leftIcon={<Icons.PencilEdit size={16} color="#05040D" strokeWidth={1.5} />}
          >
            {t('pages.sellers.actions.edit')}
          </LinkButton>
          <LinkButton
            variant="regular-black"
            size="xs"
            onClick={() => handleDelete(seller)}
            leftIcon={<Icons.Delete size={16} color="#05040D" strokeWidth={1.5} />}
          >
            {t('pages.sellers.actions.delete')}
          </LinkButton>
        </div>
      ),
    },
  ]

  return (
    <div>
      {/* Page Header */}
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-dark-500 text-2xl font-light">{t('pages.sellers.title')}</h1>
          <span className="text-base font-light text-gray-500">{totalSellers}</span>
        </div>

        <DoubleButton
          size="md"
          icon={<Icons.Add size={20} strokeWidth={2} />}
          iconPosition="left"
          onClick={() => setShowCreateModal(true)}
        >
          {t('pages.sellers.addNewSeller')}
        </DoubleButton>
      </div>

      {/* Search Bar */}
      <div className="mb-6 flex w-full items-center gap-4">
        {/* Search pill - styled to match screenshot */}
        <div className="flex items-center gap-3">
          <div className="flex w-[600px] items-center gap-3 rounded-full border border-gray-200 bg-white pr-2 pl-4 shadow-sm">
            {/* Search Input */}
            <div className="flex flex-1 items-center gap-2 py-1">
              <input
                type="text"
                placeholder={t('pages.sellers.searchPlaceholder')}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                disabled={isLoading}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleSearch()
                  }
                }}
                className="text-dark-500 h-9 w-full bg-transparent text-sm font-light outline-none placeholder:text-gray-500 disabled:opacity-60"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="flex h-6 w-6 items-center justify-center rounded-full transition-colors hover:bg-gray-100"
                  type="button"
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
          data={paginatedSellers}
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
          isLoading={false} // TODO: Set to actual loading state when API is implemented
        />
      )}
    </div>
  )
}

export default SellerManagementPage
