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
import { formatDate } from '@/lib/formatters'
import {
  SellerDetailAgreementsSkeleton,
  SellerDetailPageSkeleton,
} from './components/SellerDetailPageSkeleton'

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
    return <SellerDetailPageSkeleton />
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
        className="text-foreground hover:text-primary-500 inline-flex items-center gap-1 text-sm font-light"
      >
        <Icons.ArrowLeft size={16} strokeWidth={1.5} />
        {t('pages.sellers.detail.back', 'Back to sellers')}
      </Link>

      {/* Header */}
      <div>
        <h1 className="text-foreground flex flex-wrap items-baseline gap-3 text-2xl font-medium">
          <span>{seller.seller_name}</span>
          {seller.legal_name && (
            <span className="text-muted-foreground text-base font-light">{seller.legal_name}</span>
          )}
        </h1>
      </div>

      <div className="bg-border h-px w-full" />

      {/* Factoring Agreements section */}
      <div className="space-y-4">
        <h2 className="text-foreground text-lg font-medium">
          {t('pages.sellers.detail.factoringAgreements.title', 'Factoring Agreements')}
        </h2>

        {agreementsQuery.isLoading ? (
          <SellerDetailAgreementsSkeleton />
        ) : agreementsQuery.isError ? (
          <p className="text-sm font-light text-red-500">
            {t(
              'pages.sellers.detail.factoringAgreements.error',
              'Failed to load factoring agreements.'
            )}
          </p>
        ) : agreements.length === 0 ? (
          <p className="text-muted-foreground text-sm font-light">
            {t(
              'pages.sellers.detail.factoringAgreements.empty',
              'No factoring agreements for this seller yet.'
            )}
          </p>
        ) : (
          <>
            <div className="border-border overflow-x-auto rounded-md border">
              <table className="divide-border min-w-full divide-y text-sm">
                <thead className="bg-muted">
                  <tr className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
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
                <tbody className="divide-border divide-y">
                  {agreements.map((a) => (
                    <tr key={a.id} className="text-foreground odd:bg-card even:bg-muted">
                      <td className="px-4 py-3 text-center font-medium">{a.agreement_number}</td>
                      <td className="px-4 py-3 text-center font-light">
                        {a.previous_lender || '—'}
                      </td>
                      <td className="px-4 py-3 text-center font-light">
                        {formatDate(a.contract_purchase_date ?? undefined)}
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
