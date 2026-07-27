import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import { importsApi } from '@/features/imports/api/importsApi'
import { importJobsKeys } from '@/features/imports/hooks/useImportJobs'
import { useCancelImport, useExportImportErrors } from '@/features/imports/hooks/useImportMutations'
import { Icons } from '@/lib/icons'
import { Button } from '@/components/ui/Button'

interface Props {
  jobId: number
  onComplete: () => void
}

export function TagAssignmentProgress({ jobId, onComplete }: Props) {
  const { t } = useTranslation('common')
  const cancelMutation = useCancelImport()
  const exportErrorsMutation = useExportImportErrors()

  const { data: job } = useQuery({
    queryKey: importJobsKeys.detail(jobId),
    queryFn: () => importsApi.getImportJobDetail(jobId),
    refetchInterval: (query) => {
      const status = query.state.data?.status
      if (status === 'completed' || status === 'failed' || status === 'cancelled') {
        return false
      }
      return 2000
    },
  })

  if (!job) {
    return (
      <div className="flex items-center justify-center py-12">
        <Icons.Spinner className="h-8 w-8" />
      </div>
    )
  }

  const isActive = job.status === 'in_progress' || job.status === 'pending'
  const isComplete = job.status === 'completed'
  const isFailed = job.status === 'failed'
  const isCancelled = job.status === 'cancelled'
  const isTerminal = isComplete || isFailed || isCancelled
  const hasErrors = job.errors_count > 0
  const progressPct =
    job.progress_percentage ??
    (job.total_rows > 0 ? Math.round((job.new_clients / job.total_rows) * 100) : 0)

  // Applied/Failed are per-client tallies derived from the DB-truth fields
  // (successful_clients = unique clients with ≥1 successful tag op;
  // unique_clients = distinct clients in the upload). Both stay at 0 until
  // the operation reaches a terminal state — no DB writes have happened yet
  // during pending/in_progress, so showing partial sums there would be
  // misleading.
  const appliedClients = isTerminal ? (job.successful_clients ?? 0) : 0
  const failedClients = isTerminal
    ? Math.max(0, (job.unique_clients ?? 0) - (job.successful_clients ?? 0))
    : 0

  const p = 'pages.imports.tagAssignment.progress'

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        {isComplete && <Icons.Success size={24} className="text-success-500" />}
        {isFailed && <Icons.Cancel01 size={24} className="text-error-500" />}
        {isCancelled && <Icons.Cancel01 size={24} className="text-muted-foreground" />}
        {isActive && <Icons.Spinner className="h-6 w-6" />}
        <div>
          <h3 className="text-foreground text-lg font-medium">
            {isComplete && t(`${p}.headingComplete`, 'Tag operation complete')}
            {isFailed && t(`${p}.headingFailed`, 'Tag operation failed')}
            {isCancelled && t(`${p}.headingCancelled`, 'Tag operation cancelled')}
            {isActive && t(`${p}.processing`, 'Processing tags…')}
          </h3>
          <p className="text-muted-foreground text-sm">{job.file_name}</p>
        </div>
      </div>

      {isActive && (
        <div>
          <div className="text-muted-foreground mb-1 flex justify-between text-sm">
            <span>{t(`${p}.progress`, 'Progress')}</span>
            <span>{progressPct}%</span>
          </div>
          <div className="bg-muted h-2.5 w-full rounded-full">
            <div
              className="bg-primary-500 h-2.5 rounded-full transition-all duration-500"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>
      )}

      <div className="grid grid-cols-3 gap-4">
        <div className="border-border bg-card/50 rounded-xl border px-4 py-3 shadow-sm">
          <p className="text-foreground text-2xl font-bold">{job.total_rows}</p>
          <p className="text-muted-foreground text-xs">{t(`${p}.totalRecords`, 'Total records')}</p>
        </div>
        <div className="border-success-200 bg-success-50 rounded-xl border px-4 py-3 shadow-sm">
          <p className="text-success-700 text-2xl font-bold">{appliedClients}</p>
          <p className="text-muted-foreground text-xs">{t(`${p}.successful`, 'Applied')}</p>
        </div>
        <div className="border-error-200 bg-error-50 rounded-xl border px-4 py-3 shadow-sm">
          <p className="text-error-700 text-2xl font-bold">{failedClients}</p>
          <p className="text-muted-foreground text-xs">{t(`${p}.failed`, 'Failed')}</p>
        </div>
      </div>

      {isFailed && job.error_summary && (
        <div className="border-error-200 bg-error-50 rounded-lg border p-3">
          <p className="text-error-700 text-sm font-medium">
            {t(`${p}.errorDetails`, 'Error details')}
          </p>
          <p className="text-error-600 mt-1 text-sm">
            {typeof job.error_summary === 'string'
              ? job.error_summary
              : (job.error_summary as Record<string, unknown>)?.fatal
                ? String((job.error_summary as Record<string, unknown>).fatal)
                : JSON.stringify(job.error_summary)}
          </p>
        </div>
      )}

      {(isComplete || isFailed) && job.processing_time && (
        <p className="text-muted-foreground text-sm">
          {t(`${p}.processingTime`, {
            defaultValue: 'Took {{time}}',
            time: job.processing_time,
          })}
        </p>
      )}

      <div className="border-border flex items-center justify-end gap-3 border-t pt-4">
        {isActive && (
          <Button
            variant="danger"
            size="md"
            onClick={() => cancelMutation.mutate(jobId)}
            disabled={cancelMutation.isPending}
            isLoading={cancelMutation.isPending}
          >
            {t(`${p}.cancel`, 'Cancel')}
          </Button>
        )}
        {(isComplete || isFailed || isCancelled) && hasErrors && (
          <Button
            variant="white-secondary"
            size="md"
            onClick={() => exportErrorsMutation.mutate(jobId)}
            disabled={exportErrorsMutation.isPending}
            isLoading={exportErrorsMutation.isPending}
          >
            {t(`${p}.downloadErrors`, 'Download error report')}
          </Button>
        )}
        {(isComplete || isFailed || isCancelled) && (
          <Button variant="secondary" size="md" onClick={onComplete}>
            {t(`${p}.startNew`, 'Start a new operation')}
          </Button>
        )}
      </div>
    </div>
  )
}
