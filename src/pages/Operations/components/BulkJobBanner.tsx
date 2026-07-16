import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { useImportJob, useImportJobs, useCancelImport } from '@/features/imports'
import type { ImportType } from '@/features/imports/types'
import { useAuthStore } from '@/stores/authStore'
import { convertUTCToUserTimezone } from '@/lib/formatters'
import { Icons } from '@/lib/icons'
import { Button } from '@/components/ui/Button'

interface Props {
  importType: Extract<
    ImportType,
    'tag_assignment' | 'operator_assignment' | 'payment_import' | 'sale_notes'
  >
  label: string
  onViewHistory: () => void
  hidden?: boolean
}

export function BulkJobBanner({ importType, label, onViewHistory, hidden }: Props) {
  const { t } = useTranslation('common')
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)
  const currentUserId = user?.id ? Number(user.id) : undefined

  const { data: jobsData, refetch: refetchJobs } = useImportJobs({
    page: 1,
    page_size: 10,
    user_id: currentUserId,
    import_type: importType,
  })

  const latestInProgress = jobsData?.items?.find(
    (job) => job.status === 'pending' || job.status === 'in_progress'
  )
  const activeJobId = latestInProgress?.id ?? null

  const { data: jobDetail } = useImportJob(activeJobId, {
    enabled: !!activeJobId,
    refetchInterval: (query) => {
      const status = query.state.data?.status
      if (!status || status === 'pending' || status === 'in_progress') return 2000
      return false
    },
  })

  const cancelMutation = useCancelImport()

  const isJobActive =
    !!activeJobId &&
    (!jobDetail ||
      (jobDetail.status !== 'completed' &&
        jobDetail.status !== 'failed' &&
        jobDetail.status !== 'cancelled'))

  if (hidden || !isJobActive) return null

  const progress = jobDetail
    ? {
        fileName: jobDetail.file_name,
        startedAt: convertUTCToUserTimezone(jobDetail.uploaded_at, user?.timezone),
        percent: jobDetail.progress_percentage || 0,
        status: jobDetail.status,
        ownerId: jobDetail.user_id,
      }
    : latestInProgress
      ? {
          fileName: latestInProgress.file_name,
          startedAt: convertUTCToUserTimezone(latestInProgress.uploaded_at, user?.timezone),
          percent: 0,
          status: latestInProgress.status,
          ownerId: latestInProgress.user_id,
        }
      : null

  if (!progress) return null

  const isOwn = progress.ownerId === undefined || progress.ownerId === currentUserId

  const handleCancel = async () => {
    if (!activeJobId) return
    try {
      await cancelMutation.mutateAsync(activeJobId)
      refetchJobs()
    } catch (err) {
      console.error('Failed to cancel job:', err)
    }
  }

  return (
    <div className="fixed bottom-10 left-1/2 z-50 flex w-full -translate-x-1/2 transform justify-center p-10">
      <div className="border-border bg-card flex w-[calc(100%-2rem)] max-w-7xl flex-col justify-center rounded-[10px] border px-4 py-3 shadow-lg sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:px-6 sm:py-4">
        <div className="text-warning-500 flex items-center gap-2.5 py-3">
          <Icons.FileImport size={20} />
          <span className="text-xs font-medium whitespace-nowrap sm:text-sm">{label}</span>
        </div>
        <div className="flex w-full flex-wrap items-center justify-center gap-5">
          <div className="flex flex-wrap gap-3">
            <span className="text-foreground font-sans text-xs leading-[150%] font-light tracking-[-0.28px] sm:text-sm">
              {t('pages.imports.file')}:{' '}
              <span className="text-foreground font-sans text-xs leading-[150%] font-medium tracking-[-0.28px] sm:text-sm">
                {progress.fileName}
              </span>
            </span>
            <span className="text-foreground font-sans text-xs leading-[150%] font-light tracking-[-0.28px] sm:text-sm">
              {t('pages.imports.started')}:{' '}
              <span className="text-foreground font-sans text-xs leading-[150%] font-medium tracking-[-0.28px] sm:text-sm">
                {progress.startedAt}
              </span>
            </span>
            <span className="text-foreground font-sans text-xs leading-[150%] font-light tracking-[-0.28px] sm:text-sm">
              {t('pages.imports.status')}:{' '}
              <span className="text-foreground font-sans text-xs leading-[150%] font-medium tracking-[-0.28px] sm:text-sm">
                {progress.status === 'pending'
                  ? t('pages.imports.queued')
                  : `${progress.percent}% ${t('pages.imports.complete')}`}
              </span>
            </span>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button
              variant="secondary"
              onClick={() => {
                if (activeJobId) {
                  navigate(`/dashboard/import/history/${activeJobId}`)
                }
              }}
              className="flex h-9 w-full flex-1 rounded-lg text-xs font-medium sm:h-10 sm:w-auto sm:text-sm"
            >
              {t('pages.imports.viewDetails')}
            </Button>
            <Button
              variant="cancel"
              onClick={handleCancel}
              disabled={cancelMutation.isPending || !isOwn}
              title={
                isOwn
                  ? undefined
                  : t('pages.imports.cancelOwnerOnly', {
                      defaultValue: 'Only the user who started this job can cancel it',
                    })
              }
              className="flex h-9 w-full flex-1 rounded-lg text-xs font-medium sm:h-10 sm:w-auto sm:text-sm"
            >
              {cancelMutation.isPending
                ? t('pages.imports.cancelling')
                : t('pages.imports.cancelImport')}
            </Button>
            <Button
              variant="outline"
              onClick={onViewHistory}
              className="flex h-9 w-full flex-1 rounded-lg text-xs font-medium sm:h-10 sm:w-auto sm:text-sm"
            >
              {t('pages.imports.goToImportHistory')}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
