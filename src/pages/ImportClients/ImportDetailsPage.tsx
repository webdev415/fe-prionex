/**
 * ImportDetailsPage Component
 *
 * Page for viewing detailed information about a specific import.
 * Shows import summary and error details.
 */

import { useParams, useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/Button'
import { DataTable, type Column } from '@/components/ui/DataTable'
import { Icons } from '@/lib/icons'
import { SemiCircularProgress } from './components'
import { useImportJob, useImportJobErrors, useExportImportErrors } from '@/features/imports'

// Status Badge Component
function ImportDetailStatusBadge({
  status,
}: {
  status: 'done' | 'failed' | 'completed_with_errors' | 'in_progress'
}) {
  if (status === 'done') {
    return (
      <span className="bg-secondary-800 inline-flex h-[33px] items-center gap-1.5 rounded-full px-3 text-xs font-medium text-white">
        <span className="h-2 w-2 rounded-full bg-white" />
        Completed
      </span>
    )
  }

  if (status === 'completed_with_errors') {
    return (
      <span className="inline-flex h-[33px] items-center gap-1.5 rounded-full bg-gray-600 px-3 text-xs font-medium text-white">
        <Icons.Warning size={14} className="text-white" />
        Completed with errors
      </span>
    )
  }

  if (status === 'in_progress') {
    return (
      <span className="bg-secondary-800 inline-flex h-[33px] items-center gap-1.5 rounded-full px-3 text-xs font-medium text-white">
        <span className="h-2 w-2 rounded-full bg-white" />
        In progress
      </span>
    )
  }

  return (
    <span className="bg-error-600 inline-flex h-[33px] items-center gap-1.5 rounded-full px-3 text-xs font-medium text-white">
      <span className="h-2 w-2 rounded-full bg-white" />
      Failed
    </span>
  )
}

// Semi-circular Progress Bar Component
function SemiCircularProgressBar({ percentage }: { percentage: number }) {
  return (
    <div className="relative flex flex-col items-center justify-center">
      {/* Semi-circular progress bar */}
      <div className="relative mb-4">
        <SemiCircularProgress percentage={percentage} size={300} />
      </div>
    </div>
  )
}

export function ImportDetailsPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  // Fetch import job detail from API
  const { data: jobDetail, isLoading: isLoadingJob } = useImportJob(id, {
    refetchInterval: (query) => {
      // Poll every 5 seconds if job is in progress
      const data = query.state.data
      return data?.status === 'in_progress' ? 5000 : false
    },
  })

  // Fetch import errors
  const { data: errorsData } = useImportJobErrors(id, {
    page: 1,
    page_size: 100, // Get first 100 errors
  })

  // Export errors mutation
  const exportErrorsMutation = useExportImportErrors()

  // Convert API data to component format
  const importDetail = jobDetail
    ? {
        id: jobDetail.id,
        file: jobDetail.file_name,
        uploadedBy: jobDetail.uploaded_by,
        uploadedAt: new Date(jobDetail.uploaded_at).toLocaleTimeString('en-US', {
          hour: '2-digit',
          minute: '2-digit',
        }),
        status:
          jobDetail.status === 'completed'
            ? jobDetail.errors_count > 0
              ? ('completed_with_errors' as
                  | 'done'
                  | 'failed'
                  | 'completed_with_errors'
                  | 'in_progress')
              : ('done' as 'done' | 'failed' | 'completed_with_errors' | 'in_progress')
            : jobDetail.status === 'failed'
              ? ('failed' as 'done' | 'failed' | 'completed_with_errors' | 'in_progress')
              : jobDetail.status === 'in_progress'
                ? ('in_progress' as 'done' | 'failed' | 'completed_with_errors' | 'in_progress')
                : ('done' as 'done' | 'failed' | 'completed_with_errors' | 'in_progress'),
        totalRows: jobDetail.total_rows,
        newClients: jobDetail.new_clients,
        updatedClients: jobDetail.updated_clients,
        errors: jobDetail.errors_count,
        processingTime: jobDetail.processing_time,
        errorList: (errorsData?.items || []).map((err) => ({
          id: err.id,
          row: err.row,
          error: err.error,
        })),
        progressPercentage: jobDetail.progress_percentage || 0,
        processingRow: jobDetail.processing_row || 0,
      }
    : null

  const handleDownloadErrors = () => {
    if (id) {
      exportErrorsMutation.mutate(id)
    }
  }

  if (isLoadingJob) {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <p className="text-gray-600">Loading import details...</p>
      </div>
    )
  }

  if (!importDetail || !jobDetail) {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <p className="text-gray-600">Import not found</p>
        <Button
          variant="outline"
          onClick={() => navigate('/dashboard/import/history')}
          className="mt-4"
        >
          Back to History
        </Button>
      </div>
    )
  }

  const errorColumns: Column<{ id: number; row: number; error: string }>[] = [
    {
      key: 'row',
      header: 'Row',
      align: 'center',
      render: (item) => <span>{item.row}</span>,
    },
    {
      key: 'error',
      header: 'Error',
      render: (item) => <span>{item.error}</span>,
    },
  ]

  return (
    <div>
      {/* Page Header */}
      <div className="mb-8 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="white-secondary"
            onClick={() => navigate('/dashboard/import/history')}
            leftIcon={<Icons.ArrowLeft02 size={20} />}
            className="flex h-12 flex-row items-center justify-center rounded-full text-sm leading-[150%] font-medium"
          >
            Back to History
          </Button>
          <h1 className="text-dark-500 text-2xl font-light">Import Details</h1>
        </div>

        <Button
          variant="primary"
          onClick={handleDownloadErrors}
          disabled={exportErrorsMutation.isPending || importDetail.errors === 0}
          leftIcon={<Icons.FileDownload size={20} className="text-dark-500" />}
          className="h-12 rounded-full text-sm font-medium"
        >
          {exportErrorsMutation.isPending ? 'Exporting...' : 'Download Error CSV'}
        </Button>
      </div>

      {/* Content Cards */}
      <div className="grid grid-cols-2 gap-6">
        {/* Last Import Summary Card */}
        <div className="flex flex-1 flex-col gap-3 rounded-xl border border-gray-200 bg-white/50 p-6 shadow-sm">
          <h2 className="text-dark-500 self-stretch text-xl leading-[150%] font-light tracking-[-0.4px]">
            Last Import Summary
          </h2>

          {/* Divider */}
          <div className="mb-4 h-px w-full bg-gray-200" />

          <div className="flex flex-col items-start gap-3 self-stretch">
            <div className="flex items-center gap-6 self-stretch">
              <span className="text-dark-500 w-[120px] text-base leading-[155%] font-light tracking-[-0.32px]">
                File:{' '}
              </span>
              <span className="text-dark-500 flex-1 text-base leading-[155%] font-medium tracking-[-0.32px]">
                {importDetail.file}
              </span>
            </div>

            <div className="flex items-center gap-6 self-stretch">
              <span className="text-dark-500 w-[120px] text-base leading-[155%] font-light tracking-[-0.32px]">
                Uploaded by:{' '}
              </span>
              <span className="text-dark-500 flex-1 text-base leading-[155%] font-medium tracking-[-0.32px]">
                {importDetail.uploadedBy} at {importDetail.uploadedAt}
              </span>
            </div>

            <div className="flex items-center gap-6 self-stretch">
              <span className="text-dark-500 w-[120px] text-base leading-[155%] font-light tracking-[-0.32px]">
                Status:{' '}
              </span>
              <div className="flex flex-1">
                <ImportDetailStatusBadge status={importDetail.status} />
              </div>
            </div>
          </div>

          {/* Divider */}
          <div className="my-4 h-px w-full bg-gray-200" />

          {/* Summary Statistics - Grid Layout */}
          {importDetail.status !== 'failed' && (
            <>
              <div className="flex flex-col items-start gap-3 self-stretch">
                <div className="flex items-center gap-6 self-stretch">
                  <span className="text-dark-500 w-[120px] text-base leading-[155%] font-light tracking-[-0.32px]">
                    Total rows:
                  </span>
                  <span className="text-dark-500 flex-1 text-base leading-[155%] font-medium tracking-[-0.32px]">
                    {importDetail.totalRows.toLocaleString()}
                  </span>
                </div>

                <div className="flex items-center gap-6 self-stretch">
                  <span className="text-dark-500 w-[120px] text-base leading-[155%] font-light tracking-[-0.32px]">
                    New clients:
                  </span>
                  <span className="text-dark-500 flex-1 text-base leading-[155%] font-medium tracking-[-0.32px]">
                    {importDetail.newClients.toLocaleString()}
                  </span>
                </div>

                <div className="flex items-center gap-6 self-stretch">
                  <span className="text-dark-500 w-[120px] text-base leading-[155%] font-light tracking-[-0.32px]">
                    Updated clients:
                  </span>
                  <span className="text-dark-500 flex-1 text-base leading-[155%] font-medium tracking-[-0.32px]">
                    {importDetail.updatedClients.toLocaleString()}
                  </span>
                </div>

                <div className="flex items-center gap-6 self-stretch">
                  <span className="text-dark-500 w-[120px] text-base leading-[155%] font-light tracking-[-0.32px]">
                    Errors:
                  </span>
                  <span className="text-dark-500 flex-1 text-base leading-[155%] font-medium tracking-[-0.32px]">
                    {importDetail.errors}
                  </span>
                </div>
              </div>

              {/* Processing time - separate from grid */}
              <div className="flex items-center gap-6 self-stretch">
                <span className="text-dark-500 w-[120px] text-base leading-[155%] font-light tracking-[-0.32px]">
                  Processing time:
                </span>
                <span className="text-dark-500 flex-1 text-base leading-[155%] font-medium tracking-[-0.32px]">
                  {importDetail.processingTime}
                </span>
              </div>
            </>
          )}
        </div>

        {/* Errors Card or Progress Card */}
        {importDetail.status === 'failed' ? (
          <div className="flex min-h-[448px] flex-1 flex-col items-center gap-3 self-stretch rounded-xl border border-gray-200 bg-white/50 p-6 shadow-sm">
            <h2 className="text-dark-500 self-stretch text-xl leading-[150%] font-light tracking-[-0.4px]">
              Progress
            </h2>

            {/* Divider */}
            <div className="h-px w-full bg-gray-200" />

            <div className="flex flex-1 flex-col items-center justify-center gap-8 self-stretch">
              <Icons.SettingsError02 size={48} className="text-error-500" strokeWidth={1} />
              <div className="flex flex-col items-center gap-2">
                <span className="text-error-500 text-2xl leading-[150%] font-light tracking-[-0.28px]">
                  System error while processing file.
                </span>
                <span className="text-error-500 text-2xl leading-[150%] font-light tracking-[-0.28px]">
                  No rows imported.
                </span>
              </div>
            </div>
          </div>
        ) : importDetail.status === 'in_progress' ? (
          <div className="flex min-h-[448px] flex-1 flex-col gap-3 self-stretch rounded-xl border border-gray-200 bg-white/50 p-6 shadow-sm">
            <h2 className="text-dark-500 self-stretch text-xl leading-[150%] font-light tracking-[-0.4px]">
              Progress
            </h2>

            {/* Divider */}
            <div className="h-px w-full bg-gray-200" />

            <div className="flex flex-1 flex-col items-center justify-center gap-6 self-stretch">
              <SemiCircularProgressBar percentage={importDetail.progressPercentage} />
              <div className="flex flex-col items-center gap-1">
                <span className="text-dark-500 text-base leading-[155%] font-light tracking-[-0.32px]">
                  Processing row:{' '}
                  <span className="text-dark-500 text-base leading-[155%] font-medium tracking-[-0.32px]">
                    {importDetail.processingRow}
                  </span>
                </span>
              </div>
            </div>
          </div>
        ) : (
          importDetail.errorList.length > 0 && (
            <div className="rounded-xl border border-gray-200 bg-white/50 p-6 shadow-sm">
              <h2 className="text-dark-500 mb-6 text-xl font-light">Errors</h2>

              <DataTable
                columns={errorColumns}
                data={importDetail.errorList}
                emptyMessage="No errors"
              />
            </div>
          )
        )}
      </div>
    </div>
  )
}

export default ImportDetailsPage
