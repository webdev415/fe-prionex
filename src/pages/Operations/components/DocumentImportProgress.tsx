/**
 * DocumentImportProgress
 *
 * Polls a bulk-document import job after the ZIP upload finishes and renders
 * the progress banner + result summary (per-category counts). Mirrors the
 * SaleNotesProgress UX pattern. Document processing runs in the client-service
 * worker with no incremental percentage, so the active state shows an
 * indeterminate spinner rather than a progress bar (the 0-100 bar on the page
 * covers the upload phase).
 */

import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'

import { documentImportApi } from '@/features/documentImport'
import { Icons } from '@/lib/icons'
import { Button } from '@/components/ui/Button'

interface Props {
  jobId: number
  onComplete: () => void
}

export function DocumentImportProgress({ jobId, onComplete }: Props) {
  const { t } = useTranslation('common')
  const navigate = useNavigate()

  const { data: job } = useQuery({
    queryKey: ['documentImportJob', jobId],
    queryFn: () => documentImportApi.getJobStatus(jobId),
    refetchInterval: (query) => {
      const status = query.state.data?.status
      if (status === 'completed' || status === 'failed' || status === 'cancelled') {
        return false
      }
      return 2000
    },
  })

  const p = 'pages.imports.documents.progress'

  if (!job) {
    return (
      <div className="flex items-center justify-center py-12">
        <Icons.Spinner className="h-8 w-8" />
      </div>
    )
  }

  const isActive =
    job.status === 'pending' || job.status === 'validated' || job.status === 'processing'
  const isComplete = job.status === 'completed'
  const isFailed = job.status === 'failed'
  const isCancelled = job.status === 'cancelled'
  const isTerminal = isComplete || isFailed || isCancelled

  const counts = job.counts
  const stats = [
    {
      key: 'filesAttached',
      value: counts?.files_attached ?? 0,
      label: t(`${p}.filesAttached`, 'Files attached'),
      className: 'border-success-200 bg-success-50',
      valueClassName: 'text-success-700',
    },
    {
      key: 'matchedFolders',
      value: counts?.matched_folders ?? 0,
      label: t(`${p}.matchedFolders`, 'Folders matched'),
      className: 'border-gray-200 bg-white/50',
      valueClassName: 'text-dark-500',
    },
    {
      key: 'skippedNoMatch',
      value: counts?.skipped_no_match ?? 0,
      label: t(`${p}.skippedNoMatch`, 'Skipped (no match)'),
      className: 'border-gray-200 bg-white/50',
      valueClassName: 'text-dark-500',
    },
    {
      key: 'duplicateSkipped',
      value: counts?.duplicate_skipped ?? 0,
      label: t(`${p}.duplicateSkipped`, 'Skipped (duplicate)'),
      className: 'border-gray-200 bg-white/50',
      valueClassName: 'text-dark-500',
    },
    {
      key: 'executablesBlocked',
      value: counts?.executables_blocked ?? 0,
      label: t(`${p}.executablesBlocked`, 'Blocked (executable)'),
      className: 'border-error-200 bg-error-50',
      valueClassName: 'text-error-700',
    },
    {
      key: 'oversizedSkipped',
      value: counts?.oversized_skipped ?? 0,
      label: t(`${p}.oversizedSkipped`, 'Skipped (too large)'),
      className: 'border-gray-200 bg-white/50',
      valueClassName: 'text-dark-500',
    },
    {
      key: 'errors',
      value: counts?.errors ?? 0,
      label: t(`${p}.errors`, 'Errors'),
      className: 'border-error-200 bg-error-50',
      valueClassName: 'text-error-700',
    },
  ]

  return (
    <div className="space-y-6 rounded-xl border border-gray-200 bg-white/50 p-4 shadow-sm sm:p-6">
      <div className="flex items-center gap-3">
        {isComplete && <Icons.Success size={24} className="text-success-500" />}
        {isFailed && <Icons.Cancel01 size={24} className="text-error-500" />}
        {isCancelled && <Icons.Cancel01 size={24} className="text-gray-400" />}
        {isActive && <Icons.Spinner className="h-6 w-6" />}
        <div>
          <h3 className="text-dark-500 text-lg font-medium">
            {isComplete && t(`${p}.headingComplete`, 'Document import complete')}
            {isFailed && t(`${p}.headingFailed`, 'Document import failed')}
            {isCancelled && t(`${p}.headingCancelled`, 'Document import cancelled')}
            {isActive && t(`${p}.processing`, 'Processing documents…')}
          </h3>
          <p className="text-sm text-gray-600">
            {isActive
              ? t(
                  `${p}.processingHint`,
                  'Matching folders and attaching documents. This can take a while for large archives.'
                )
              : t(`${p}.jobRef`, 'Job #{{id}}', { id: job.job_id })}
          </p>
        </div>
      </div>

      {isActive && job.progress_percent != null && (
        <div>
          <div className="mb-1 flex justify-between text-xs text-gray-500">
            <span>
              {t(`${p}.attaching`, 'Attaching documents…')}
              {job.total ? ` (${job.processed ?? 0}/${job.total})` : ''}
            </span>
            <span>{job.progress_percent}%</span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-gray-200">
            <div
              className="bg-primary-400 h-full rounded-full transition-all"
              style={{ width: `${job.progress_percent}%` }}
            />
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {stats.map((s) => (
          <div key={s.key} className={`rounded-xl border px-4 py-3 shadow-sm ${s.className}`}>
            <p className={`text-2xl font-bold ${s.valueClassName}`}>{isTerminal ? s.value : '—'}</p>
            <p className="text-xs text-gray-600">{s.label}</p>
          </div>
        ))}
      </div>

      {isFailed && job.error && (
        <div className="border-error-200 bg-error-50 rounded-lg border p-3">
          <p className="text-error-700 text-sm font-medium">
            {t(`${p}.errorDetails`, 'Error details')}
          </p>
          <p className="text-error-600 mt-1 text-sm">{job.error}</p>
        </div>
      )}

      <div className="flex items-center justify-end gap-3 border-t border-gray-200 pt-4">
        {isTerminal && (
          <>
            <Button
              variant="secondary"
              size="md"
              onClick={() => navigate(`/dashboard/import/history/${job.job_id}`)}
            >
              {t('pages.imports.viewDetails', 'View Details')}
            </Button>
            <Button variant="white-secondary" size="md" onClick={onComplete}>
              {t(`${p}.startNewImport`, 'Start new import')}
            </Button>
          </>
        )}
      </div>
    </div>
  )
}
