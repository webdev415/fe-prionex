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

export function ImportClientsPage() {
  const { t } = useTranslation('common')
  const navigate = useNavigate()
  const [currentStep, setCurrentStep] = useState(1)
  const [showImportHistory, setShowImportHistory] = useState(false) // Change from true to false
  const [currentJobId, setCurrentJobId] = useState<number | string | null>(null)

  // Track previous status to detect transitions
  const previousStatusRef = useRef<string | null>(null)
  const lastShownJobIdRef = useRef<number | string | null>(null)

  // Fetch latest pending or in-progress import job (check both currentJobId and latest pending/in-progress)
  const { data: importJobsData, refetch: refetchImportJobs } = useImportJobs({
    page: 1,
    page_size: 10, // Get more jobs to filter client-side
  })

  // Get the latest pending or in-progress job
  const latestInProgressJob = importJobsData?.items?.find(
    (job) => job.status === 'pending' || job.status === 'in_progress'
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
        startedAt: new Date(jobDetail.uploaded_at).toLocaleTimeString('en-US', {
          hour: '2-digit',
          minute: '2-digit',
        }),
        progressPercentage: jobDetail.progress_percentage || 0,
        jobId: jobDetail.id,
        status: jobDetail.status,
      }
    : latestInProgressJob
      ? {
          fileName: latestInProgressJob.file_name,
          startedAt: new Date(latestInProgressJob.uploaded_at).toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit',
          }),
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
        uploadedAt: new Date(jobDetailForModal.uploaded_at).toLocaleTimeString('en-US', {
          hour: '2-digit',
          minute: '2-digit',
        }),
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

  const [step1Data, setStep1Data] = useState<Step1Data>({
    sellerId: '',
    projectCode: '',
    purchaseDate: new Date().toISOString().split('T')[0], // Today's date
    comment: '',
    importType: 'simple',
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
    return (
      step1Data.sellerId !== '' && step1Data.projectCode !== '' && step1Data.purchaseDate !== ''
    )
  }

  const handleViewHistory = () => {
    navigate('/dashboard/import/history')
  }

  const handleGoToImportHistory = () => {
    // Navigate to Import History page
    navigate('/dashboard/import/history')
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
      <div className="mb-8 flex items-center justify-between">
        <div className="flex items-center gap-6">
          {currentStep > 1 && (
            <Button
              variant="white-secondary"
              onClick={handlePreviousStep}
              leftIcon={<Icons.ArrowLeft02 size={20} />}
              className="flex h-12 flex-row items-center justify-center rounded-full text-sm leading-[150%] font-medium"
            >
              {t('pages.imports.back')}
            </Button>
          )}
          <h1 className="text-dark-500 text-2xl font-light">{t('pages.imports.title')}</h1>
        </div>

        <Button
          variant="primary"
          onClick={handleViewHistory}
          leftIcon={<Icons.TransactionHistory size={20} className="text-dark-500" />}
          className="flex h-12 flex-row items-center justify-center rounded-full text-xs leading-[150%] font-medium"
        >
          {t('pages.imports.viewHistory')}
        </Button>
      </div>

      {/* Main Content */}
      <div className="flex gap-5">
        {/* Left Panel - Step Indicator */}
        <div className="flex w-[24%] shrink-0 gap-0 rounded-xl bg-white/50 px-6 py-11 shadow-sm">
          <StepIndicator steps={STEPS} currentStep={currentStep} />
        </div>

        {/* Right Panel - Form Content */}
        <div className="flex-1 flex-col gap-3">
          <div className="rounded-xl bg-white/50 p-6 shadow-sm">
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

      {/* Import Progress Banner - Absolutely Positioned */}
      {isImportInProgress && importProgress ? (
        <div className="fixed bottom-6 left-1/2 z-50 flex w-[calc(100%-3rem)] max-w-7xl -translate-x-1/2 transform items-center justify-between gap-4 rounded-[10px] border border-gray-200 bg-white px-6 py-4 shadow-[0_12px_16px_-4px_rgba(16,24,40,0.08),0_4px_6px_-2px_rgba(16,24,40,0.03)]">
          <div className="text-warning-500 flex items-center gap-2.5 py-1 pl-3">
            {/* Icon - document with refresh symbol */}
            <Icons.FileImport size={20} />
            <span className="text-sm font-medium whitespace-nowrap">
              {t('pages.imports.importInProgress')}
            </span>
          </div>
          <span className="font-lexend text-dark-500 text-sm leading-[150%] font-light tracking-[-0.28px]">
            {t('pages.imports.file')}:{' '}
            <span className="font-lexend text-dark-500 text-sm leading-[150%] font-medium tracking-[-0.28px]">
              {importProgress.fileName}
            </span>
          </span>
          <span className="font-lexend text-dark-500 text-sm leading-[150%] font-light tracking-[-0.28px]">
            {t('pages.imports.started')}:{' '}
            <span className="font-lexend text-dark-500 text-sm leading-[150%] font-medium tracking-[-0.28px]">
              {importProgress.startedAt}
            </span>
          </span>
          <span className="font-lexend text-dark-500 text-sm leading-[150%] font-light tracking-[-0.28px]">
            {t('pages.imports.status')}:{' '}
            <span className="font-lexend text-dark-500 text-sm leading-[150%] font-medium tracking-[-0.28px]">
              {importProgress.status === 'pending'
                ? t('pages.imports.queued')
                : `${importProgress.progressPercentage}% ${t('pages.imports.complete')}`}
            </span>
          </span>
          <Button
            variant="secondary"
            onClick={handleViewDetails}
            className="h-10 rounded-lg text-sm font-medium"
          >
            {t('pages.imports.viewDetails')}
          </Button>
          <Button
            variant="cancel"
            onClick={handleCancelImport}
            disabled={cancelImportMutation.isPending}
            className="h-10 rounded-lg text-sm font-medium"
          >
            {cancelImportMutation.isPending
              ? t('pages.imports.cancelling')
              : t('pages.imports.cancelImport')}
          </Button>
          <Button
            variant="outline"
            onClick={handleGoToImportHistory}
            className="h-10 rounded-lg text-sm font-medium"
          >
            {t('pages.imports.goToImportHistory')}
          </Button>
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
