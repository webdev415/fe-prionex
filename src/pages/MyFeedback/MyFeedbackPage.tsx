/**
 * MyFeedbackPage — operator-self feedback inbox (KAN-410, Feature 2.3).
 *
 * Spec calls for "Feedback log in operator profile · Feedback tab" but no
 * operator profile page exists yet (plan §3.5). v1 ships this as a
 * dedicated route `/dashboard/my-feedback`; when a profile page is built
 * later this view can be re-mounted as a tab there with zero code changes.
 */
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/Button'
import {
  FEEDBACK_TYPES,
  type Feedback,
  type FeedbackStatus,
  type FeedbackType,
} from '@/features/quality'
import { FeedbackThreadView, useMyFeedback } from '@/features/quality'

const STATUSES: FeedbackStatus[] = ['unread', 'read', 'completed']
const DEFAULT_PAGE_SIZE = 25

export function MyFeedbackPage() {
  const { t } = useTranslation('common')

  const [page, setPage] = useState(1)
  const [typeFilter, setTypeFilter] = useState<FeedbackType | ''>('')
  const [statusFilter, setStatusFilter] = useState<FeedbackStatus | ''>('')
  const [openFeedbackId, setOpenFeedbackId] = useState<number | null>(null)

  const filters = useMemo(
    () => ({
      feedback_type: typeFilter ? [typeFilter] : undefined,
      status: statusFilter ? [statusFilter] : undefined,
      page,
      page_size: DEFAULT_PAGE_SIZE,
    }),
    [typeFilter, statusFilter, page]
  )

  const { data, isLoading, isError } = useMyFeedback(filters)

  const rows: Feedback[] = data?.data ?? []
  const total = data?.pagination.total ?? 0
  const totalPages = data?.pagination.total_pages ?? 0

  return (
    <div className="flex flex-col gap-4">
      <header>
        <h1 className="text-dark-500 text-xl font-light sm:text-2xl">
          {t('pages.myFeedback.title', 'My Feedback')}
        </h1>
        <p className="mt-1 text-sm font-light text-gray-600">
          {t('pages.myFeedback.subtitle', 'All feedback your trainers have sent you.')}
        </p>
      </header>

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <label className="text-sm text-gray-600">
            {t('pages.actionAnalysis.filters.feedbackType', 'Type')}
          </label>
          <select
            value={typeFilter}
            onChange={(e) => {
              setTypeFilter(e.target.value as FeedbackType | '')
              setPage(1)
            }}
            className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm"
          >
            <option value="">
              {t('pages.actionAnalysis.filters.allFeedbackTypes', 'All types')}
            </option>
            {FEEDBACK_TYPES.map((ft) => (
              <option key={ft} value={ft}>
                {t(`pages.actionAnalysis.feedback.types.${ft}`, ft.replace(/_/g, ' '))}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2">
          <label className="text-sm text-gray-600">
            {t('pages.actionAnalysis.filters.status', 'Status')}
          </label>
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value as FeedbackStatus | '')
              setPage(1)
            }}
            className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm"
          >
            <option value="">
              {t('pages.actionAnalysis.filters.allStatuses', 'All statuses')}
            </option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {t(`pages.actionAnalysis.feedback.status.${s}`, s)}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl bg-white shadow-sm">
        <table className="min-w-full divide-y divide-gray-100 text-sm">
          <thead className="bg-gray-50">
            <tr className="text-left text-xs font-medium tracking-wide text-gray-500 uppercase">
              <th className="px-3 py-2">{t('pages.actionAnalysis.columns.date', 'Date')}</th>
              <th className="px-3 py-2">
                {t('pages.actionAnalysis.columns.feedbackType', 'Type')}
              </th>
              <th className="px-3 py-2">{t('pages.actionAnalysis.columns.preview', 'Text')}</th>
              <th className="px-3 py-2">{t('pages.actionAnalysis.columns.status', 'Status')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 text-gray-700">
            {isLoading ? (
              <tr>
                <td className="px-3 py-6 text-center text-gray-400" colSpan={4}>
                  {t('common.loading', 'Loading…')}
                </td>
              </tr>
            ) : isError ? (
              <tr>
                <td className="px-3 py-6 text-center text-red-500" colSpan={4}>
                  {t('pages.actionAnalysis.errors.loadFeedbackFailed', 'Failed to load feedback')}
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td className="px-3 py-6 text-center text-gray-400" colSpan={4}>
                  {t('pages.myFeedback.empty', 'No feedback yet — your trainers haven’t sent any.')}
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr
                  key={row.id}
                  onClick={() => setOpenFeedbackId((cur) => (cur === row.id ? null : row.id))}
                  className={`cursor-pointer hover:bg-gray-50 ${
                    openFeedbackId === row.id ? 'bg-primary-50' : ''
                  }`}
                >
                  <td className="px-3 py-2">{new Date(row.created_at).toLocaleString()}</td>
                  <td className="px-3 py-2">
                    {t(
                      `pages.actionAnalysis.feedback.types.${row.feedback_type}`,
                      row.feedback_type.replace(/_/g, ' ')
                    )}
                  </td>
                  <td className="max-w-[24rem] truncate px-3 py-2 text-gray-600">{row.text}</td>
                  <td className="px-3 py-2">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        row.status === 'completed'
                          ? 'bg-green-100 text-green-700'
                          : row.status === 'read'
                            ? 'bg-blue-100 text-blue-700'
                            : 'bg-gray-100 text-gray-700'
                      }`}
                    >
                      {t(`pages.actionAnalysis.feedback.status.${row.status}`, row.status)}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {openFeedbackId != null ? (
        <FeedbackThreadView feedbackId={openFeedbackId} viewerRole="operator" />
      ) : null}

      {totalPages > 1 ? (
        <div className="flex items-center justify-between text-sm text-gray-600">
          <span>
            {t('common.page', 'Page')} {page} {t('common.of', 'of')} {totalPages} · {total}{' '}
            {t('pages.actionAnalysis.feedbackTotalSuffix', 'items')}
          </span>
          <div className="flex gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="rounded-full"
            >
              {t('common.previous', 'Previous')}
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="rounded-full"
            >
              {t('common.next', 'Next')}
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  )
}

export default MyFeedbackPage
