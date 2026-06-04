/**
 * SellerDetailPage
 *
 * Dedicated detail view for one seller. Shows the seller's identity
 * (name + legal name) plus a read-only table of factoring agreements
 * scoped to the caller's active project.
 *
 * Route: /dashboard/sellers/:id
 */

import { useTranslation } from 'react-i18next'
import { Link, useParams } from 'react-router-dom'
import { Icons } from '@/lib/icons'
import { ErrorState } from '@/components/ErrorState'
import { Pagination } from '@/components/ui/Pagination'
import { useURLState } from '@/hooks'
import { useSellerDetail, useSellerFactoringAgreements } from '@/features/sellers'

const DEFAULT_PAGE_SIZE = 10

export function SellerDetailPage() {
  const { t } = useTranslation('common')
  const { id } = useParams<{ id: string }>()
  const sellerId = id ? Number(id) : undefined

  // URL-backed pagination state (`?agreementPage=2&agreementPageSize=20`)
  // — uses the standard pattern from SellerManagementPage so refreshing
  // or sharing a link preserves the page.
  const [currentPage, setCurrentPage] = useURLState<number>('agreementPage', 1)
  const [pageSize, setPageSize] = useURLState<number>('agreementPageSize', DEFAULT_PAGE_SIZE)

  const sellerQuery = useSellerDetail(sellerId ?? 0, false)
  const agreementsQuery = useSellerFactoringAgreements(sellerId, {
    skip: (currentPage - 1) * pageSize,
    limit: pageSize,
  })

  if (!sellerId || Number.isNaN(sellerId)) {
    return (
      <ErrorState
        title={t('pages.sellers.detail.invalidId', 'Invalid seller ID')}
        error={t('pages.sellers.detail.invalidIdMessage', 'No seller ID was provided.')}
      />
    )
  }

  if (sellerQuery.isLoading) {
    return (
      <p className="text-dark-500 text-sm font-light">
        {t('pages.sellers.detail.loading', 'Loading seller...')}
      </p>
    )
  }

  if (sellerQuery.isError || !sellerQuery.data) {
    return (
      <ErrorState
        title={t('pages.sellers.detail.notFound', 'Seller not found')}
        error={t(
          'pages.sellers.detail.notFoundMessage',
          'The requested seller does not exist or you do not have access.'
        )}
      />
    )
  }

  const seller = sellerQuery.data
  const agreementsPage = agreementsQuery.data
  const agreements = agreementsPage?.items ?? []
  const totalAgreements = agreementsPage?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(totalAgreements / pageSize))

  return (
    <div className="space-y-6">
      {/* Back link */}
      <Link
        to="/dashboard/sellers"
        className="text-dark-500 hover:text-primary-500 inline-flex items-center gap-1 text-sm font-light"
      >
        <Icons.ArrowLeft size={16} strokeWidth={1.5} />
        {t('pages.sellers.detail.back', 'Back to sellers')}
      </Link>

      {/* Header */}
      <div>
        <h1 className="text-dark-500 flex flex-wrap items-baseline gap-3 text-2xl font-medium">
          <span>{seller.seller_name}</span>
          {seller.legal_name && (
            <span className="text-base font-light text-gray-500">{seller.legal_name}</span>
          )}
        </h1>
      </div>

      <div className="h-px w-full bg-gray-200" />

      {/* Factoring Agreements section */}
      <div className="space-y-4">
        <h2 className="text-dark-500 text-lg font-medium">
          {t('pages.sellers.detail.factoringAgreements.title', 'Factoring Agreements')}
        </h2>

        {agreementsQuery.isLoading ? (
          <p className="text-sm font-light text-gray-500">
            {t('pages.sellers.detail.factoringAgreements.loading', 'Loading agreements...')}
          </p>
        ) : agreementsQuery.isError ? (
          <p className="text-sm font-light text-red-500">
            {t(
              'pages.sellers.detail.factoringAgreements.error',
              'Failed to load factoring agreements.'
            )}
          </p>
        ) : agreements.length === 0 ? (
          <p className="text-sm font-light text-gray-500">
            {t(
              'pages.sellers.detail.factoringAgreements.empty',
              'No factoring agreements for this seller yet.'
            )}
          </p>
        ) : (
          <>
            <div className="overflow-x-auto rounded-md border border-gray-200">
              <table className="min-w-full divide-y divide-gray-200 text-sm">
                <thead className="bg-gray-50">
                  <tr className="text-xs font-medium tracking-wide text-gray-500 uppercase">
                    <th className="px-4 py-3 text-center">
                      {t(
                        'pages.sellers.detail.factoringAgreements.columns.number',
                        'Agreement number'
                      )}
                    </th>
                    <th className="px-4 py-3 text-center">
                      {t(
                        'pages.sellers.detail.factoringAgreements.columns.previousLender',
                        'Who sold'
                      )}
                    </th>
                    <th className="px-4 py-3 text-center">
                      {t(
                        'pages.sellers.detail.factoringAgreements.columns.purchaseDate',
                        'Purchase date'
                      )}
                    </th>
                    <th className="px-4 py-3 text-center">
                      {t(
                        'pages.sellers.detail.factoringAgreements.columns.debtCount',
                        'Number of debts'
                      )}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {agreements.map((a) => (
                    <tr key={a.id} className="text-dark-500 odd:bg-white even:bg-gray-50">
                      <td className="px-4 py-3 text-center font-medium">{a.agreement_number}</td>
                      <td className="px-4 py-3 text-center font-light">
                        {a.previous_lender || '—'}
                      </td>
                      <td className="px-4 py-3 text-center font-light">
                        {a.contract_purchase_date || '—'}
                      </td>
                      <td className="px-4 py-3 text-center font-medium">{a.debt_count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              pageSize={pageSize}
              onPageChange={setCurrentPage}
              onPageSizeChange={(newSize) => {
                setPageSize(newSize)
                setCurrentPage(1)
              }}
            />
          </>
        )}
      </div>
    </div>
  )
}

export default SellerDetailPage
