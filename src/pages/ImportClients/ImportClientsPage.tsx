/**
 * ImportClientsPage Component
 *
 * Main page for importing clients with multi-step form.
 * Uses reusable components following the same pattern as other pages.
 */

import { useState, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { StepIndicator, type Step } from '@/components/ui/StepIndicator'
import { Button } from '@/components/ui/Button'
import { DoubleButton } from '@/components/ui/DoubleButton'
import { Step1LoanSource, type Step1Data } from './components/Step1LoanSource'
import { Step2FileUpload, type Step2Data } from './components/Step2FileUpload'
import { Step2VendorDump, type Step2VendorDumpData } from './components/Step2VendorDump'
import { Icons } from '@/lib/icons'
import { ImportHistoryModal, type ImportHistoryData } from './components/ImportHistoryModal'
import { useNavigate } from 'react-router-dom'
import { useImportJobs, useImportJob, useCancelImport } from '@/features/imports'
import { useAuthStore } from '@/stores/authStore'
import { convertUTCToUserTimezone } from '@/lib/formatters'

export function ImportClientsPage() {
  const { t } = useTranslation('common')
  const navigate = useNavigate()
  const user = useAuthStore((state) => state.user)
  const [currentStep, setCurrentStep] = useState(1)
  const [showImportHistory, setShowImportHistory] = useState(false) // Change from true to false
  const [currentJobId, setCurrentJobId] = useState<number | string | null>(null)

  // Track previous status to detect transitions
  const previousStatusRef = useRef<string | null>(null)
  const lastShownJobIdRef = useRef<number | string | null>(null)

  // Scope to the current user so this page's banner doesn't surface another
  // user's running import in the same accessible project.
  const currentUserId = user?.id ? Number(user.id) : undefined

  // Fetch latest pending or in-progress import job (check both currentJobId and latest pending/in-progress)
  // Filter to client import types only — exclude payment_import jobs
  const { data: importJobsData, refetch: refetchImportJobs } = useImportJobs({
    page: 1,
    page_size: 10, // Get more jobs to filter client-side
    user_id: currentUserId,
  })

  // Get the latest pending or in-progress job for the simple/vendor flows
  // this page handles. Bulk operator/tag/payment imports surface their own
  // banner on their dedicated pages, so excluding them here prevents one
  // queued job from appearing on multiple pages at once.
  const latestInProgressJob = importJobsData?.items?.find(
    (job) =>
      (job.status === 'pending' || job.status === 'in_progress') &&
      (job.import_type === 'simple' || job.import_type === 'vendor')
  )

  // Use currentJobId if set, otherwise use latest in-progress job ID
  const activeJobId = currentJobId || latestInProgressJob?.id || null

  // Fetch detail of the active job for progress updates
  // Start polling immediately when jobId is set, poll every 2 seconds for better responsiveness
  const { data: jobDetail, refetch: refetchJobDetail } = useImportJob(activeJobId, {
    enabled: !!activeJobId,
    refetchInterval: (query) => {
      // Poll every 2 seconds if job is pending or in progress
      const data = query.state.data
      const status = data?.status
      // Poll for pending, in_progress, or if data hasn't loaded yet
      if (!status || status === 'pending' || status === 'in_progress') {
        return 2000 // 2 seconds for better UX
      }
      return false // Stop polling when completed/failed/cancelled
    },
  })

  // Track current job ID for progress banner
  // Update currentJobId when jobDetail.id changes, but defer the update
  // to avoid cascading renders (React lint rule)
  const lastSyncedJobIdRef = useRef<number | string | null>(null)
  useEffect(() => {
    if (jobDetail?.id && jobDetail.id !== lastSyncedJobIdRef.current) {
      lastSyncedJobIdRef.current = jobDetail.id
      // Use requestAnimationFrame to defer state update and avoid cascading renders
      const frameId = requestAnimationFrame(() => {
        setCurrentJobId(jobDetail.id)
      })
      return () => cancelAnimationFrame(frameId)
    }
  }, [jobDetail?.id])

  // Immediately refetch job detail when currentJobId is set (from upload response)
  useEffect(() => {
    if (currentJobId && activeJobId === currentJobId && !jobDetail) {
      // Trigger immediate refetch when jobId is set from upload
      refetchJobDetail()
    }
  }, [currentJobId, activeJobId, jobDetail, refetchJobDetail])

  // Show ImportHistoryModal when import job completes
  useEffect(() => {
    // Only show modal when a job transitions from in_progress/pending to completed/failed
    // AND we haven't shown the modal for this job yet
    // Do NOT show modal for cancelled jobs
    if (
      jobDetail?.status &&
      jobDetail.status !== 'in_progress' &&
      jobDetail.status !== 'pending' &&
      jobDetail.status !== 'cancelled' && // Don't show modal for cancelled jobs
      currentJobId === jobDetail.id && // Only show if this is the job we just started
      lastShownJobIdRef.current !== jobDetail.id && // Only show if we haven't shown it for this job yet
      previousStatusRef.current && // Only show if we had a previous status (detects transition)
      (previousStatusRef.current === 'in_progress' || previousStatusRef.current === 'pending') // Previous status was in progress
    ) {
      // Job has transitioned from in_progress/pending to completed/failed
      // Automatically show the import history modal
      setTimeout(() => {
        setShowImportHistory(true)
        lastShownJobIdRef.current = jobDetail.id // Mark that we've shown the modal for this job
      }, 0)
    }

    // Update previous status ref for next comparison
    if (jobDetail?.status) {
      previousStatusRef.current = jobDetail.status
    }
  }, [jobDetail?.status, jobDetail?.id, currentJobId])

  // Clear currentJobId when import completes/fails/cancels to allow new imports
  useEffect(() => {
    if (
      jobDetail?.id &&
      currentJobId === jobDetail.id &&
      (jobDetail.status === 'completed' ||
        jobDetail.status === 'failed' ||
        jobDetail.status === 'cancelled')
    ) {
      // Import is done, clear currentJobId after a short delay to allow modal to show
      // This allows new imports to start
      const timeoutId = setTimeout(() => {
        setCurrentJobId(null)
        // Reset refs for next import
        previousStatusRef.current = null
        lastShownJobIdRef.current = null
      }, 1000) // Small delay to ensure modal shows first

      return () => clearTimeout(timeoutId)
    }
  }, [jobDetail?.status, jobDetail?.id, currentJobId])

  // Reset refs when currentJobId changes (new upload started)
  useEffect(() => {
    if (currentJobId) {
      previousStatusRef.current = null // Reset to detect new transition
      lastShownJobIdRef.current = null // Reset to allow showing modal for new job
    }
  }, [currentJobId])

  // Determine if import is in progress
  // Show progress bar immediately when we have a job ID (even if status is pending or not loaded yet)
  // Keep showing until job is completed, failed, or cancelled
  const isImportInProgress =
    !!activeJobId &&
    (!jobDetail || // Show if jobDetail hasn't loaded yet
      (jobDetail.status !== 'completed' &&
        jobDetail.status !== 'failed' &&
        jobDetail.status !== 'cancelled'))

  // Import progress data from API
  // Show progress immediately when jobId is set, even before jobDetail loads
  const importProgress = jobDetail
    ? {
        fileName: jobDetail.file_name,
        startedAt: convertUTCToUserTimezone(jobDetail.uploaded_at, user?.timezone),
        progressPercentage: jobDetail.progress_percentage || 0,
        jobId: jobDetail.id,
        status: jobDetail.status,
      }
    : latestInProgressJob
      ? {
          fileName: latestInProgressJob.file_name,
          startedAt: convertUTCToUserTimezone(latestInProgressJob.uploaded_at, user?.timezone),
          progressPercentage: 0, // Will update when jobDetail loads
          jobId: latestInProgressJob.id,
          status: latestInProgressJob.status,
        }
      : currentJobId
        ? {
            fileName: t('pages.imports.step2.simple.uploading'),
            startedAt: new Date().toLocaleTimeString('en-US', {
              hour: '2-digit',
              minute: '2-digit',
            }),
            progressPercentage: 0,
            jobId: currentJobId,
            status: 'pending' as const,
          }
        : null

  // Import history data for modal - get latest completed/failed job (excluding in_progress)
  const { data: latestJobData } = useImportJobs({
    page: 1,
    page_size: 1,
    user_id: currentUserId,
  })
  const latestJob = latestJobData?.items?.find(
    (job) => job.status !== 'in_progress' && job.status !== 'pending'
  )

  // Fetch full job detail for the modal if we have a job
  const { data: latestJobDetail } = useImportJob(latestJob?.id || null, {
    enabled: !!latestJob?.id && showImportHistory,
  })

  // Convert job detail to ImportHistoryData format
  // Prefer jobDetail (current job) if available and completed, otherwise use latestJobDetail
  const jobDetailForModal =
    jobDetail && jobDetail.status !== 'in_progress' && jobDetail.status !== 'pending'
      ? jobDetail
      : latestJobDetail

  const importHistoryData: ImportHistoryData | null = jobDetailForModal
    ? {
        file: jobDetailForModal.file_name,
        uploadedBy: jobDetailForModal.uploaded_by,
        uploadedAt: convertUTCToUserTimezone(jobDetailForModal.uploaded_at, user?.timezone),
        status:
          jobDetailForModal.status === 'completed'
            ? jobDetailForModal.errors_count > 0
              ? 'completed_with_errors'
              : 'completed'
            : jobDetailForModal.status === 'failed'
              ? 'failed'
              : 'completed',
        totalRows: jobDetailForModal.total_rows,
        newClients: jobDetailForModal.new_clients,
        updatedClients: jobDetailForModal.updated_clients,
        errors: jobDetailForModal.errors_count,
        processingTime: jobDetailForModal.processing_time,
        jobId: jobDetailForModal.id,
      }
    : null

  // Initialize purchase date: get current date/time, store as UTC
  // The date will be displayed in user's timezone, but stored as UTC
  const getInitialPurchaseDate = () => {
    const now = new Date()
    // Store current time as UTC (backend expects UTC)
    // Display conversion happens in Step1LoanSource component
    return now.toISOString()
  }

  const [step1Data, setStep1Data] = useState<Step1Data>({
    sellerId: '',
    projectCode: '',
    purchaseDate: getInitialPurchaseDate(), // UTC datetime (backend will store as UTC)
    comment: '',
    importType: 'simple',
    schemaCode: '',
  })

  const [step2Data, setStep2Data] = useState<Step2Data>({
    csvFile: null,
    invalidFile: null,
    csvValidationError: null,
  })
  const [step2VendorData, setStep2VendorData] = useState<Step2VendorDumpData>({
    files: [],
    zipFile: null,
    isZipUpload: false,
  })

  const handleStep1Change = (data: Partial<Step1Data>) => {
    setStep1Data((prev) => ({ ...prev, ...data }))
  }

  //   const handleStep2Change = (data: Partial<Step2Data>) => {
  //     setStep2Data((prev) => ({ ...prev, ...data }))
  //   }

  const handleNextStep = () => {
    if (currentStep < STEPS.length) {
      setCurrentStep(currentStep + 1)
    }
  }

  const handlePreviousStep = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1)
    }
  }

  const isStep1Valid = () => {
    const baseValid =
      step1Data.sellerId !== '' && step1Data.projectCode !== '' && step1Data.purchaseDate !== ''
    if (!baseValid) return false
    // Vendor flow needs a schema selected before step 2 can proceed.
    if (step1Data.importType === 'vendor' && !step1Data.schemaCode) return false
    return true
  }

  // Pass an explicit empty `import_type` so the History page sees a non-empty
  // URL on arrival. Without it, useAutoPersistedState restores whichever
  // import_type was last saved (e.g. payment_import from a prior visit via
  // the Bulk Payment page) and injects it back into the URL.
  const handleViewHistory = () => {
    navigate('/dashboard/import/history?import_type=')
  }

  const handleGoToImportHistory = () => {
    navigate('/dashboard/import/history?import_type=')
  }

  const handleViewDetails = () => {
    // Navigate to the in-progress job detail page
    const jobIdToView = currentJobId || latestInProgressJob?.id
    if (jobIdToView) {
      navigate(`/dashboard/import/history/${jobIdToView}`)
    }
  }

  // Get steps based on import type
  const getSteps = (): Step[] => {
    const step2Label =
      step1Data.importType === 'vendor'
        ? t('pages.imports.steps.filesVendor')
        : t('pages.imports.steps.filesSimple')

    return [
      {
        number: 1,
        label: t('pages.imports.steps.loanSource'),
      },
      {
        number: 2,
        label: step2Label,
      },
    ]
  }

  const STEPS = getSteps()

  // Add cancel import mutation
  const cancelImportMutation = useCancelImport()

  // Add cancel handler
  const handleCancelImport = async () => {
    if (!activeJobId) {
      return
    }

    try {
      await cancelImportMutation.mutateAsync(activeJobId)
      // Clear the current job ID and refetch jobs
      setCurrentJobId(null)
      refetchImportJobs()
    } catch (error) {
      // Error is already handled by the mutation hook (toast notification)
      console.error('Failed to cancel import:', error)
    }
  }

  return (
    <div>
      {/* Page Header */}
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2 sm:gap-6">
          {currentStep > 1 && (
            <Button
              variant="white-secondary"
              onClick={handlePreviousStep}
              leftIcon={<Icons.ArrowLeft02 size={20} />}
              className="flex h-10 flex-row items-center justify-center rounded-full text-sm leading-[150%] font-medium sm:h-12"
            >
              <span className="hidden sm:inline">{t('pages.imports.back')}</span>
            </Button>
          )}
          <h1 className="text-dark-500 text-xl font-light sm:text-2xl">
            {t('pages.imports.title')}
          </h1>
        </div>

        <Button
          variant="primary"
          onClick={handleViewHistory}
          leftIcon={<Icons.TransactionHistory size={20} className="text-dark-500" />}
          className="flex h-10 w-full flex-row items-center justify-center rounded-full text-xs leading-[150%] font-medium sm:h-12 sm:w-auto"
        >
          {t('pages.imports.viewHistory')}
        </Button>
      </div>

      {/* Main Content */}
      <div className="flex flex-col gap-5 lg:flex-row">
        {/* Left Panel - Step Indicator */}
        <div className="flex w-full shrink-0 gap-0 rounded-xl bg-white/50 px-4 py-6 shadow-sm lg:w-[24%] lg:px-6 lg:py-11">
          <StepIndicator steps={STEPS} currentStep={currentStep} />
        </div>

        {/* Right Panel - Form Content */}
        <div className="flex flex-1 flex-col gap-3">
          <div className="rounded-xl bg-white/50 p-4 shadow-sm sm:p-6">
            {currentStep === 1 && <Step1LoanSource data={step1Data} onChange={handleStep1Change} />}

            {currentStep === 2 && step1Data.importType === 'simple' && (
              <Step2FileUpload
                data={step2Data}
                onChange={(data) => setStep2Data((prev) => ({ ...prev, ...data }))}
                isImportInProgress={isImportInProgress}
                step1Data={step1Data}
                onImportStarted={(jobId) => {
                  setCurrentJobId(jobId)
                  // Refetch import jobs to get the new job and show progress bar
                  refetchImportJobs()
                }}
              />
            )}

            {currentStep === 2 && step1Data.importType === 'vendor' && (
              <Step2VendorDump
                data={step2VendorData}
                onChange={(data) => setStep2VendorData((prev) => ({ ...prev, ...data }))}
                isImportInProgress={isImportInProgress}
                step1Data={step1Data}
                onImportStarted={(jobId) => {
                  setCurrentJobId(jobId)
                  // Refetch import jobs to get the new job and show progress bar
                  refetchImportJobs()
                }}
              />
            )}

            {/* Navigation Buttons */}
            <div className="mt-8 flex justify-center">
              {currentStep < STEPS.length && currentStep === 1 && (
                <DoubleButton
                  size="md"
                  icon={<Icons.ArrowRight02 size={24} />}
                  iconPosition="right"
                  onClick={handleNextStep}
                  disabled={!isStep1Valid()}
                  className="h-12 rounded-full text-sm leading-[150%] font-medium"
                >
                  {t('pages.imports.nextStep')}
                </DoubleButton>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Import Progress Banner - Centered */}
      {isImportInProgress && importProgress ? (
        <div className="fixed bottom-10 left-1/2 z-50 flex w-full -translate-x-1/2 transform justify-center p-10">
          <div className="flex w-[calc(100%-2rem)] max-w-7xl flex-col justify-center rounded-[10px] border border-gray-200 bg-white px-4 py-3 shadow-[0_12px_16px_-4px_rgba(16,24,40,0.08),0_4px_6px_-2px_rgba(16,24,40,0.03)] sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:px-6 sm:py-4">
            <div className="text-warning-500 flex items-center gap-2.5 py-3">
              {/* Icon - document with refresh symbol */}
              <Icons.FileImport size={20} />
              <span className="text-xs font-medium whitespace-nowrap sm:text-sm">
                {t('pages.imports.importInProgress')}
              </span>
            </div>
            <div className="flex w-full flex-wrap items-center justify-center gap-5">
              <div className="flex flex-wrap gap-3">
                <span className="text-dark-500 font-sans text-xs leading-[150%] font-light tracking-[-0.28px] sm:text-sm">
                  {t('pages.imports.file')}:{' '}
                  <span className="text-dark-500 font-sans text-xs leading-[150%] font-medium tracking-[-0.28px] sm:text-sm">
                    {importProgress.fileName}
                  </span>
                </span>
                <span className="text-dark-500 font-sans text-xs leading-[150%] font-light tracking-[-0.28px] sm:text-sm">
                  {t('pages.imports.started')}:{' '}
                  <span className="text-dark-500 font-sans text-xs leading-[150%] font-medium tracking-[-0.28px] sm:text-sm">
                    {importProgress.startedAt}
                  </span>
                </span>
                <span className="text-dark-500 font-sans text-xs leading-[150%] font-light tracking-[-0.28px] sm:text-sm">
                  {t('pages.imports.status')}:{' '}
                  <span className="text-dark-500 font-sans text-xs leading-[150%] font-medium tracking-[-0.28px] sm:text-sm">
                    {importProgress?.status === 'pending'
                      ? t('pages.imports.queued')
                      : `${importProgress.progressPercentage}% ${t('pages.imports.complete')}`}
                  </span>
                </span>
              </div>
              <div className="flex flex-wrap gap-3">
                <Button
                  variant="secondary"
                  onClick={handleViewDetails}
                  className="flex h-9 w-full flex-1 rounded-lg text-xs font-medium sm:h-10 sm:w-auto sm:text-sm"
                >
                  {t('pages.imports.viewDetails')}
                </Button>
                <Button
                  variant="cancel"
                  onClick={handleCancelImport}
                  disabled={cancelImportMutation.isPending}
                  className="flex h-9 w-full flex-1 rounded-lg text-xs font-medium sm:h-10 sm:w-auto sm:text-sm"
                >
                  {cancelImportMutation.isPending
                    ? t('pages.imports.cancelling')
                    : t('pages.imports.cancelImport')}
                </Button>
                <Button
                  variant="outline"
                  onClick={handleGoToImportHistory}
                  className="flex h-9 w-full flex-1 rounded-lg text-xs font-medium sm:h-10 sm:w-auto sm:text-sm"
                >
                  {t('pages.imports.goToImportHistory')}
                </Button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {/* Import History Modal */}
      <ImportHistoryModal
        open={showImportHistory}
        onClose={() => {
          setShowImportHistory(false)
          // Reset to Step 1 and clear form data when modal closes
          setCurrentStep(1)
          // Clear step 2 data to allow new file upload
          setStep2Data({
            csvFile: null,
            invalidFile: null,
            csvValidationError: null,
          })
          // Reset modal-related state when closing
          // This ensures the modal can show again for subsequent imports
          if (jobDetail?.status === 'completed' || jobDetail?.status === 'failed') {
            // Only reset if import is complete, to allow showing modal again for new imports
            lastShownJobIdRef.current = null
          }
        }}
        data={importHistoryData}
      />
    </div>
  )
}

export default ImportClientsPage
