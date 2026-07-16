/**
 * ImportDetailsPage Component
 *
 * Page for viewing detailed information about a specific import.
 * Shows import summary and error details.
 */

import { useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useURLState, useAutoPersistedState } from '@/hooks'
import { Button } from '@/components/ui/Button'
import { LinkButton } from '@/components/ui/LinkButton'
import { DataTable, type Column } from '@/components/ui/DataTable'
import { Pagination } from '@/components/ui/Pagination'
import { TableSkeleton } from '@/components/ui/TableSkeleton'
import { Icons } from '@/lib/icons'
import { SemiCircularProgress, VendorPhaseProgress } from './components'
import {
  useImportJob,
  useImportJobErrors,
  useExportImportErrors,
  computeImportUiStatusFromDetail,
} from '@/features/imports'
import { ImportDetailsPageSkeleton } from './components/ImportDetailsPageSkeleton'
import { ImportStatusBadge } from './components/ImportBadges'
import { useAuthStore } from '@/stores/authStore'
import { convertUTCToUserTimezone } from '@/lib/formatters'

// Status badge — see components/ImportBadges.tsx

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
  const { t } = useTranslation('common')
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const userTimezone = useAuthStore((state) => state.user?.timezone)

  // URL state for pagination
  const [errorPage, setErrorPage] = useURLState<number>('page', 1)
  const [errorPageSize, setErrorPageSize] = useURLState<number>('pageSize', 50)

  // Reset to page 1 whenever the route's job id changes. Without this, stale
  // ?page=N from a previous (large-error) job carries over to a new job and
  // makes the errors fetch hit a non-existent offset, returning empty.
  useEffect(() => {
    setErrorPage(1)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  // Add persistence for state
  useAutoPersistedState(
    'import-details-state',
    {
      errorPage,
      errorPageSize,
    },
    {
      errorPage: setErrorPage,
      errorPageSize: setErrorPageSize,
    }
  )

  // Fetch import job detail from API
  const { data: jobDetail, isLoading: isLoadingJob } = useImportJob(id, {
    refetchInterval: (query) => {
      // Poll every 5 seconds if job is in progress
      const data = query.state.data
      return data?.status === 'in_progress' ? 5000 : false
    },
  })

  // Fetch import errors with pagination. `refetchOnMount: 'always'`
  // dodges a stale failed-state cache. `refetchInterval` keeps the
  // errors table in sync with the live `errors_count` while a vendor
  // import is mid-flight — the backend now flushes per-file errors as
  // each file completes, so polling reveals them progressively.
  const {
    data: errorsData,
    isLoading: isLoadingErrors,
    isFetching: isFetchingErrors,
  } = useImportJobErrors(
    id,
    { page: errorPage, page_size: errorPageSize },
    {
      refetchOnMount: 'always',
      retry: 2,
      refetchInterval: jobDetail?.status === 'in_progress' ? 5000 : false,
    }
  )

  // Show skeleton while the errors query is loading the current page
  // (initial load or pagination), but NOT during background polling
  // refetches when the import is still in progress — those should leave
  // the table on screen.
  const isPollingErrors = jobDetail?.status === 'in_progress'
  const showErrorsSkeleton =
    isLoadingErrors || (isFetchingErrors && !isPollingErrors && !errorsData)

  // Export errors mutation
  const exportErrorsMutation = useExportImportErrors()

  const isVendor = jobDetail?.import_type === 'vendor'
  const isTagAssignment = jobDetail?.import_type === 'tag_assignment'

  // Convert API data to component format
  const importDetail = jobDetail
    ? {
        id: jobDetail.id,
        file: jobDetail.file_name,
        uploadedBy: jobDetail.uploaded_by,
        uploadedAt: convertUTCToUserTimezone(jobDetail.uploaded_at, userTimezone),
        // Single source of truth for the badge status; aggregates per-phase
        // signals so vendor jobs whose downstream phase silently dropped
        // rows render as 'completed_with_errors' instead of green 'done'.
        status: computeImportUiStatusFromDetail(jobDetail),
        totalRows: jobDetail.total_rows,
        newClients: jobDetail.new_clients,
        updatedClients: jobDetail.updated_clients,
        successfulClients: jobDetail.successful_clients ?? 0,
        errors: jobDetail.errors_count,
        processingTime: jobDetail.processing_time,
        errorList: (errorsData?.items || []).map((err) => ({
          id: err.id,
          row: err.row,
          error: err.error,
          suggested_fix: err.suggested_fix,
        })),
        // Calculate progress percentage: use provided value, or calculate for cancelled status
        progressPercentage:
          jobDetail.progress_percentage !== undefined
            ? jobDetail.progress_percentage
            : jobDetail.status === 'cancelled' && jobDetail.total_rows > 0
              ? Math.round(
                  ((jobDetail.new_clients + jobDetail.updated_clients + jobDetail.errors_count) /
                    jobDetail.total_rows) *
                    100
                )
              : 0,
        processingRow: jobDetail.processing_row || 0,
      }
    : null

  const handleDownloadErrors = () => {
    if (id) {
      exportErrorsMutation.mutate(id)
    }
  }

  if (isLoadingJob) {
    return <ImportDetailsPageSkeleton />
  }

  if (!importDetail || !jobDetail) {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <p className="text-muted-foreground">{t('pages.imports.details.importNotFound')}</p>
        <LinkButton
          variant="regular-black"
          onClick={() => navigate('/dashboard/import/history')}
          leftIcon={<Icons.ArrowLeft size={16} className="text-foreground" />}
          className="mt-4"
        >
          {t('common.back', 'Back')}
        </LinkButton>
      </div>
    )
  }

  const errorColumns: Column<{
    id: number
    row: number
    error: string
    suggested_fix?: string | null
  }>[] = [
    {
      key: 'row',
      header: t('pages.imports.details.row'),
      align: 'center',
      render: (item) => <span>{item.row}</span>,
    },
    {
      key: 'error',
      header: t('pages.imports.details.error'),
      render: (item) => (
        <div className="flex flex-col gap-1">
          <span>{item.error}</span>
          {item.suggested_fix && (
            <span className="text-muted-foreground text-xs italic">
              💡 {t('pages.imports.details.suggestedFix')}: {item.suggested_fix}
            </span>
          )}
        </div>
      ),
    },
  ]

  return (
    <div>
      {/* Page Header */}
      <div className="mb-4 flex w-full flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2 sm:gap-4">
          <LinkButton
            variant="regular-black"
            onClick={() => navigate('/dashboard/import/history')}
            leftIcon={<Icons.ArrowLeft size={16} className="text-foreground" />}
            className="text-sm"
          >
            {t('common.back', 'Back')}
          </LinkButton>
          <h1 className="text-foreground text-xl font-light sm:text-2xl">
            {t('pages.imports.details.title')}
          </h1>
        </div>

        <Button
          variant="primary"
          onClick={handleDownloadErrors}
          disabled={exportErrorsMutation.isPending || importDetail.errors === 0}
          leftIcon={<Icons.FileDownload size={20} className="text-primary-foreground" />}
          className="h-10 w-full rounded-full text-xs font-medium sm:h-12 sm:w-auto sm:text-sm"
        >
          {exportErrorsMutation.isPending
            ? t('pages.imports.details.exporting')
            : t('pages.imports.details.downloadErrorCsv')}
        </Button>
      </div>

      {/* Content Cards */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Last Import Summary Card */}
        <div className="border-border bg-card/50 flex flex-1 flex-col gap-3 rounded-xl border p-4 shadow-sm sm:p-6">
          <h2 className="text-foreground self-stretch text-lg leading-[150%] font-light tracking-[-0.4px] sm:text-xl">
            {t('pages.imports.details.lastImportSummary')}
          </h2>

          {/* Divider */}
          <div className="bg-border mb-4 h-px w-full" />

          <div className="flex flex-col items-start gap-3 self-stretch">
            <div className="flex flex-col gap-2 self-stretch sm:flex-row sm:items-center sm:gap-6">
              <span className="text-foreground w-full text-sm leading-[155%] font-light tracking-[-0.32px] sm:w-[120px] sm:text-base">
                {t('pages.imports.details.file')}{' '}
              </span>
              <span className="text-foreground flex-1 text-sm leading-[155%] font-medium tracking-[-0.32px] break-words sm:text-base">
                {importDetail.file}
              </span>
            </div>

            <div className="flex flex-col gap-2 self-stretch sm:flex-row sm:items-center sm:gap-6">
              <span className="text-foreground w-full text-sm leading-[155%] font-light tracking-[-0.32px] sm:w-[120px] sm:text-base">
                {t('pages.imports.details.uploadedBy')}{' '}
              </span>
              <span className="text-foreground flex-1 text-sm leading-[155%] font-medium tracking-[-0.32px] break-words sm:text-base">
                {importDetail.uploadedBy} at {importDetail.uploadedAt}
              </span>
            </div>

            <div className="flex flex-col gap-2 self-stretch sm:flex-row sm:items-center sm:gap-6">
              <span className="text-foreground w-full text-sm leading-[155%] font-light tracking-[-0.32px] sm:w-[120px] sm:text-base">
                {t('pages.imports.details.status')}{' '}
              </span>
              <div className="flex flex-1">
                <ImportStatusBadge status={importDetail.status} labelScope="details" />
              </div>
            </div>
          </div>

          {/* Divider */}
          <div className="bg-border my-4 h-px w-full" />

          {/* Summary Statistics - Grid Layout. Vendor jobs use the
              right-hand VendorPhaseProgress panel instead of these
              client-CSV-shaped counters, so skip this block. */}
          {importDetail.status !== 'failed' && !isVendor && (
            <>
              <div className="flex flex-col items-start gap-3 self-stretch">
                <div className="flex flex-col gap-2 self-stretch sm:flex-row sm:items-center sm:gap-6">
                  <span className="text-foreground w-full text-sm leading-[155%] font-light tracking-[-0.32px] sm:w-[120px] sm:text-base">
                    {isTagAssignment
                      ? t('pages.imports.details.updatedClients')
                      : t('pages.imports.details.totalRows')}
                  </span>
                  <span className="text-foreground flex-1 text-sm leading-[155%] font-medium tracking-[-0.32px] sm:text-base">
                    {isTagAssignment
                      ? importDetail.successfulClients.toLocaleString()
                      : importDetail.totalRows.toLocaleString()}
                  </span>
                </div>

                {!isTagAssignment && (
                  <div className="flex flex-col gap-2 self-stretch sm:flex-row sm:items-center sm:gap-6">
                    <span className="text-foreground w-full text-sm leading-[155%] font-light tracking-[-0.32px] sm:w-[120px] sm:text-base">
                      {t('pages.imports.details.newClients')}
                    </span>
                    <span className="text-foreground flex-1 text-sm leading-[155%] font-medium tracking-[-0.32px] sm:text-base">
                      {importDetail.newClients.toLocaleString()}
                    </span>
                  </div>
                )}

                <div className="flex flex-col gap-2 self-stretch sm:flex-row sm:items-center sm:gap-6">
                  <span className="text-foreground w-full text-sm leading-[155%] font-light tracking-[-0.32px] sm:w-[120px] sm:text-base">
                    {isTagAssignment
                      ? t('pages.imports.details.tagsApplied', 'Tags Applied')
                      : t('pages.imports.details.updatedClients')}
                  </span>
                  <span className="text-foreground flex-1 text-sm leading-[155%] font-medium tracking-[-0.32px] sm:text-base">
                    {importDetail.updatedClients.toLocaleString()}
                  </span>
                </div>

                <div className="flex flex-col gap-2 self-stretch sm:flex-row sm:items-center sm:gap-6">
                  <span className="text-foreground w-full text-sm leading-[155%] font-light tracking-[-0.32px] sm:w-[120px] sm:text-base">
                    {t('pages.imports.details.errors')}
                  </span>
                  <span className="text-foreground flex-1 text-sm leading-[155%] font-medium tracking-[-0.32px] sm:text-base">
                    {importDetail.errors}
                  </span>
                </div>
              </div>

              {/* Processing time - separate from grid */}
              <div className="flex flex-col gap-2 self-stretch sm:flex-row sm:items-center sm:gap-6">
                <span className="text-foreground w-full text-sm leading-[155%] font-light tracking-[-0.32px] sm:w-[120px] sm:text-base">
                  {t('pages.imports.details.processingTime')}
                </span>
                <span className="text-foreground flex-1 text-sm leading-[155%] font-medium tracking-[-0.32px] sm:text-base">
                  {importDetail.processingTime}
                </span>
              </div>
            </>
          )}

          {/* Vendor jobs: per-target totals derived from the same counters
              the worker reported, so the user can see at a glance how many
              of each downstream record actually persisted. */}
          {!!isVendor && (
            <div className="flex flex-col items-start gap-3 self-stretch">
              <div className="flex flex-col gap-2 self-stretch sm:flex-row sm:items-center sm:gap-6">
                <span className="text-foreground w-full text-sm leading-[155%] font-light tracking-[-0.32px] sm:w-[140px] sm:text-base">
                  {t('pages.imports.details.totalRows')}
                </span>
                <span className="text-foreground flex-1 text-sm leading-[155%] font-medium tracking-[-0.32px] sm:text-base">
                  {importDetail.totalRows.toLocaleString()}
                </span>
              </div>
              <div className="flex flex-col gap-2 self-stretch sm:flex-row sm:items-center sm:gap-6">
                <span className="text-foreground w-full text-sm leading-[155%] font-light tracking-[-0.32px] sm:w-[140px] sm:text-base">
                  {t('pages.imports.details.vendor.accepted', 'Accepted')}
                </span>
                <span className="text-foreground flex-1 text-sm leading-[155%] font-medium tracking-[-0.32px] sm:text-base">
                  {importDetail.newClients.toLocaleString()}
                </span>
              </div>
              <div className="flex flex-col gap-2 self-stretch sm:flex-row sm:items-center sm:gap-6">
                <span className="text-foreground w-full text-sm leading-[155%] font-light tracking-[-0.32px] sm:w-[140px] sm:text-base">
                  {t('pages.imports.details.errors')}
                </span>
                <span className="text-foreground flex-1 text-sm leading-[155%] font-medium tracking-[-0.32px] sm:text-base">
                  {importDetail.errors.toLocaleString()}
                </span>
              </div>
              <div className="flex flex-col gap-2 self-stretch sm:flex-row sm:items-center sm:gap-6">
                <span className="text-foreground w-full text-sm leading-[155%] font-light tracking-[-0.32px] sm:w-[140px] sm:text-base">
                  {t('pages.imports.details.processingTime')}
                </span>
                <span className="text-foreground flex-1 text-sm leading-[155%] font-medium tracking-[-0.32px] sm:text-base">
                  {importDetail.processingTime}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Right-hand card. Vendor jobs render the multi-file phase
            panel; simple jobs keep the legacy progress / errors UI. */}
        {isVendor && jobDetail?.vendor_phases ? (
          <VendorPhaseProgress
            phases={jobDetail.vendor_phases}
            errorMessage={importDetail.status === 'failed' ? jobDetail.vendor_error : undefined}
          />
        ) : importDetail.status === 'failed' ? (
          <div className="border-border bg-card/50 flex min-h-[448px] flex-1 flex-col items-center gap-3 self-stretch rounded-xl border p-4 shadow-sm sm:p-6">
            <h2 className="text-foreground self-stretch text-lg leading-[150%] font-light tracking-[-0.4px] sm:text-xl">
              {t('pages.imports.details.progress')}
            </h2>

            {/* Divider */}
            <div className="bg-border h-px w-full" />

            <div className="flex flex-1 flex-col items-center justify-center gap-8 self-stretch">
              <Icons.SettingsError02 size={48} className="text-error-500" strokeWidth={1} />
              <div className="flex flex-col items-center gap-2">
                <span className="text-error-500 text-2xl leading-[150%] font-light tracking-[-0.28px]">
                  {t('pages.imports.details.systemError')}
                </span>
                <span className="text-error-500 text-2xl leading-[150%] font-light tracking-[-0.28px]">
                  {t('pages.imports.details.noRowsImported')}
                </span>
              </div>
            </div>
          </div>
        ) : importDetail.status === 'pending' ? (
          <div className="border-border bg-card/50 flex min-h-[448px] flex-1 flex-col gap-3 self-stretch rounded-xl border p-4 shadow-sm sm:p-6">
            <h2 className="text-foreground self-stretch text-lg leading-[150%] font-light tracking-[-0.4px] sm:text-xl">
              {t('pages.imports.details.progress')}
            </h2>

            {/* Divider */}
            <div className="bg-border h-px w-full" />

            <div className="flex flex-1 flex-col items-center justify-center gap-6 self-stretch">
              <SemiCircularProgressBar percentage={0} />
              <div className="flex flex-col items-center gap-1">
                <span className="text-foreground text-base leading-[155%] font-light tracking-[-0.32px]">
                  {t('pages.imports.details.statuses.pending')}
                </span>
              </div>
            </div>
          </div>
        ) : importDetail.status === 'cancelled' ? (
          <div className="border-border bg-card/50 flex min-h-[448px] flex-1 flex-col gap-3 self-stretch rounded-xl border p-4 shadow-sm sm:p-6">
            <h2 className="text-foreground self-stretch text-lg leading-[150%] font-light tracking-[-0.4px] sm:text-xl">
              {t('pages.imports.details.progress')}
            </h2>

            {/* Divider */}
            <div className="bg-border h-px w-full" />

            <div className="flex flex-1 flex-col items-center justify-center gap-6 self-stretch">
              <SemiCircularProgressBar percentage={importDetail.progressPercentage} />
              <div className="flex flex-col items-center gap-1">
                <span className="text-foreground text-base leading-[155%] font-light tracking-[-0.32px]">
                  {t('pages.imports.details.statuses.cancelled')}
                </span>
              </div>
            </div>
          </div>
        ) : importDetail.status === 'in_progress' ? (
          <div className="border-border bg-card/50 flex min-h-[448px] flex-1 flex-col gap-3 self-stretch rounded-xl border p-4 shadow-sm sm:p-6">
            <h2 className="text-foreground self-stretch text-lg leading-[150%] font-light tracking-[-0.4px] sm:text-xl">
              {t('pages.imports.details.progress')}
            </h2>

            {/* Divider */}
            <div className="bg-border h-px w-full" />

            <div className="flex flex-1 flex-col items-center justify-center gap-6 self-stretch">
              <SemiCircularProgressBar percentage={importDetail.progressPercentage} />
              <div className="flex flex-col items-center gap-1">
                <span className="text-foreground text-base leading-[155%] font-light tracking-[-0.32px]">
                  {t('pages.imports.details.processingRow')}{' '}
                  <span className="text-foreground text-base leading-[155%] font-medium tracking-[-0.32px]">
                    {importDetail.processingRow}
                  </span>
                </span>
              </div>
            </div>
          </div>
        ) : importDetail.status === 'completed_with_errors' && importDetail.errors > 0 ? (
          // Show errors panel when completed with errors
          <div className="border-border bg-card/50 rounded-xl border p-4 shadow-sm sm:p-6">
            <h2 className="text-foreground mb-4 text-lg font-light sm:mb-6 sm:text-xl">
              {t('pages.imports.details.errorsTitle')} ({importDetail.errors.toLocaleString()})
            </h2>

            {showErrorsSkeleton ? (
              <TableSkeleton columns={errorColumns.length} rows={errorPageSize} />
            ) : (
              <DataTable
                columns={errorColumns}
                data={importDetail.errorList}
                emptyMessage={t('pages.imports.details.noErrors')}
              />
            )}

            {/* Pagination Controls */}
            {errorsData && errorsData.total > errorPageSize && (
              <Pagination
                currentPage={errorPage}
                totalPages={Math.ceil(errorsData.total / errorPageSize)}
                pageSize={errorPageSize}
                onPageChange={setErrorPage}
                onPageSizeChange={(newSize) => {
                  setErrorPageSize(newSize)
                  setErrorPage(1) // Reset to first page
                }}
              />
            )}
          </div>
        ) : importDetail.status === 'done' || importDetail.status === 'completed_with_errors' ? (
          // Show progress bar at 100% for completed imports (without errors)
          <div className="border-border bg-card/50 flex min-h-[448px] flex-1 flex-col gap-3 self-stretch rounded-xl border p-4 shadow-sm sm:p-6">
            <h2 className="text-foreground self-stretch text-lg leading-[150%] font-light tracking-[-0.4px] sm:text-xl">
              {t('pages.imports.details.progress')}
            </h2>

            {/* Divider */}
            <div className="bg-border h-px w-full" />

            <div className="flex flex-1 flex-col items-center justify-center gap-6 self-stretch">
              <SemiCircularProgressBar percentage={100} />
              <div className="flex flex-col items-center gap-1">
                <span className="text-foreground text-base leading-[155%] font-light tracking-[-0.32px]">
                  {t('pages.imports.details.totalRows')}{' '}
                  <span className="text-foreground text-base leading-[155%] font-medium tracking-[-0.32px]">
                    {importDetail.totalRows.toLocaleString()}
                  </span>
                </span>
              </div>
            </div>
          </div>
        ) : (
          // Fallback: Show progress bar at 100%
          <div className="border-border bg-card/50 flex min-h-[448px] flex-1 flex-col gap-3 self-stretch rounded-xl border p-4 shadow-sm sm:p-6">
            <h2 className="text-foreground self-stretch text-lg leading-[150%] font-light tracking-[-0.4px] sm:text-xl">
              {t('pages.imports.details.progress')}
            </h2>

            {/* Divider */}
            <div className="bg-border h-px w-full" />

            <div className="flex flex-1 flex-col items-center justify-center gap-6 self-stretch">
              <SemiCircularProgressBar percentage={100} />
            </div>
          </div>
        )}
      </div>

      {/* Vendor jobs: errors table renders BELOW the 2-column grid because
          the right-hand slot is occupied by VendorPhaseProgress. Only show
          when there are real errors to surface. */}
      {!!isVendor && importDetail.errors > 0 && (
        <div className="border-border bg-card/50 mt-6 rounded-xl border p-4 shadow-sm sm:p-6">
          <h2 className="text-foreground mb-4 text-lg font-light sm:mb-6 sm:text-xl">
            {t('pages.imports.details.errorsTitle')} ({importDetail.errors.toLocaleString()})
          </h2>
          {showErrorsSkeleton ? (
            <TableSkeleton columns={errorColumns.length} rows={errorPageSize} />
          ) : (
            <DataTable
              columns={errorColumns}
              data={importDetail.errorList}
              emptyMessage={t('pages.imports.details.noErrors')}
            />
          )}
          {errorsData && errorsData.total > errorPageSize && (
            <Pagination
              currentPage={errorPage}
              totalPages={Math.ceil(errorsData.total / errorPageSize)}
              pageSize={errorPageSize}
              onPageChange={setErrorPage}
              onPageSizeChange={(newSize) => {
                setErrorPageSize(newSize)
                setErrorPage(1)
              }}
            />
          )}
        </div>
      )}
    </div>
  )
}

export default ImportDetailsPage
