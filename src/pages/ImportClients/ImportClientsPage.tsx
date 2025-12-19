/**
 * ImportClientsPage Component
 *
 * Main page for importing clients with multi-step form.
 * Uses reusable components following the same pattern as other pages.
 */

import { useState, useEffect } from 'react'
import { StepIndicator, type Step } from '@/components/ui/StepIndicator'
import { Button } from '@/components/ui/Button'
import { Step1LoanSource, type Step1Data } from './components/Step1LoanSource'
import { Step2FileUpload, type Step2Data } from './components/Step2FileUpload'
import { Step2VendorDump, type Step2VendorDumpData } from './components/Step2VendorDump'
import { Icons } from '@/lib/icons'
import { ImportHistoryModal, type ImportHistoryData } from './components/ImportHistoryModal'
import { useNavigate } from 'react-router-dom'
import { useImportJobs, useImportJob } from '@/features/imports'

export function ImportClientsPage() {
  const navigate = useNavigate()
  const [currentStep, setCurrentStep] = useState(1)
  const [showImportHistory, setShowImportHistory] = useState(true)
  const [currentJobId, setCurrentJobId] = useState<number | string | null>(null)

  // Fetch latest in-progress import job (check both currentJobId and latest in-progress)
  const { data: importJobsData, refetch: refetchImportJobs } = useImportJobs({
    page: 1,
    page_size: 1,
    status: 'in_progress',
  })

  // Get the latest in-progress job
  const latestInProgressJob = importJobsData?.items?.[0]

  // Use currentJobId if set, otherwise use latest in-progress job ID
  const activeJobId = currentJobId || latestInProgressJob?.id || null

  // Fetch detail of the active job for progress updates
  const { data: jobDetail } = useImportJob(activeJobId, {
    enabled: !!activeJobId,
    refetchInterval: (query) => {
      // Poll every 5 seconds if job is in progress
      const data = query.state.data
      return data?.status === 'in_progress' ? 5000 : false
    },
  })

  // Track current job ID for progress banner
  useEffect(() => {
    if (jobDetail?.id && jobDetail.id !== currentJobId) {
      // Use setTimeout to avoid synchronous setState in effect
      setTimeout(() => {
        setCurrentJobId(jobDetail.id)
      }, 0)
    }
  }, [jobDetail?.id, currentJobId])

  // Show ImportHistoryModal when import job completes
  useEffect(() => {
    if (jobDetail?.status && jobDetail.status !== 'in_progress' && jobDetail.status !== 'pending') {
      // Job has completed (either 'completed' or 'failed')
      // Automatically show the import history modal
      // Use setTimeout to avoid synchronous setState in effect
      setTimeout(() => {
        setShowImportHistory(true)
      }, 0)
    }
  }, [jobDetail?.status])

  // Determine if import is in progress
  // Show progress bar if we have an active job ID and either:
  // - Job detail shows status is 'in_progress', OR
  // - Job detail hasn't loaded yet (but we have the ID from upload response)
  const isImportInProgress = !!activeJobId && (jobDetail?.status === 'in_progress' || !jobDetail)

  // Import progress data from API
  // If jobDetail is not loaded yet, use basic info from latestInProgressJob or currentJobId
  const importProgress = jobDetail
    ? {
        fileName: jobDetail.file_name,
        startedAt: new Date(jobDetail.uploaded_at).toLocaleTimeString('en-US', {
          hour: '2-digit',
          minute: '2-digit',
        }),
        progressPercentage: jobDetail.progress_percentage || 0,
        jobId: jobDetail.id,
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
        }
      : currentJobId
        ? {
            fileName: 'Uploading...',
            startedAt: new Date().toLocaleTimeString('en-US', {
              hour: '2-digit',
              minute: '2-digit',
            }),
            progressPercentage: 0,
            jobId: currentJobId,
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
    sellerCreditor: '',
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
      step1Data.sellerCreditor !== '' &&
      step1Data.projectCode !== '' &&
      step1Data.purchaseDate !== ''
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
      step1Data.importType === 'vendor' ? 'Files (Vendor Dump)' : 'Files (Simple CSV)'

    return [
      {
        number: 1,
        label: 'Loan source & import type',
      },
      {
        number: 2,
        label: step2Label,
      },
    ]
  }

  const STEPS = getSteps()

  return (
    <div>
      {/* Page Header */}
      <div className="mb-8 flex items-center justify-between">
        <div className="flex items-center gap-6">
          {currentStep > 1 && (
            <Button
              variant="outline"
              onClick={handlePreviousStep}
              leftIcon={<Icons.ArrowLeft02 size={20} className="text-secondary-800" />}
              className="text-secondary-800 flex h-12 flex-row items-center justify-center rounded-full border-white bg-white px-4 py-2.5 text-sm leading-[150%] font-medium"
            >
              Back
            </Button>
          )}
          <h1 className="text-dark-500 text-2xl font-light">Import Clients</h1>
        </div>

        <Button
          variant="primary"
          onClick={handleViewHistory}
          leftIcon={<Icons.TransactionHistory size={20} className="text-dark-500" />}
          className="bg-primary-300 text-dark-500 flex h-12 flex-row items-center justify-center rounded-full px-4 py-2.5 text-center text-xs"
        >
          View History
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
                <Button
                  variant="primary"
                  onClick={handleNextStep}
                  disabled={!isStep1Valid()}
                  className="bg-secondary-800 flex h-12 items-center gap-2.5 rounded-full py-1 pr-1 pl-6 text-sm text-white"
                >
                  <span>Next Step</span>
                  <div className="bg-primary-300 flex h-10 w-10 shrink-0 items-center justify-center rounded-full">
                    <Icons.ArrowRight02 size={24} className="text-dark-500" />
                  </div>
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Import Progress Banner */}
      {isImportInProgress && importProgress ? (
        <div className="z-50 mx-50 my-10 flex items-center justify-between gap-4 rounded-[10px] border border-gray-200 bg-white px-6 py-4 shadow-[0_12px_16px_-4px_rgba(16,24,40,0.08),0_4px_6px_-2px_rgba(16,24,40,0.03)]">
          <div className="text-warning-500 flex items-center gap-2.5 py-1 pl-3">
            {/* Icon - document with refresh symbol */}
            <Icons.FileImport size={20} />
            <span className="text-sm font-medium whitespace-nowrap">Import in progress</span>
          </div>
          <span className="font-lexend text-dark-500 text-sm leading-[150%] font-light tracking-[-0.28px]">
            File:{' '}
            <span className="font-lexend text-dark-500 text-sm leading-[150%] font-medium tracking-[-0.28px]">
              {importProgress.fileName}
            </span>
          </span>
          <span className="font-lexend text-dark-500 text-sm leading-[150%] font-light tracking-[-0.28px]">
            Started:{' '}
            <span className="font-lexend text-dark-500 text-sm leading-[150%] font-medium tracking-[-0.28px]">
              {importProgress.startedAt}
            </span>
          </span>
          <span className="font-lexend text-dark-500 text-sm leading-[150%] font-light tracking-[-0.28px]">
            Status:{' '}
            <span className="font-lexend text-dark-500 text-sm leading-[150%] font-medium tracking-[-0.28px]">
              {importProgress.progressPercentage}% complete
            </span>
          </span>
          <Button
            variant="primary"
            onClick={handleViewDetails}
            className="bg-secondary-800 h-10 gap-2.5 rounded-lg px-4 py-2.5 text-sm font-medium text-white"
          >
            View Details
          </Button>
          <Button
            variant="outline"
            onClick={handleGoToImportHistory}
            className="border-secondary-800 text-secondary-800 gap-2.5 rounded-lg bg-white px-4 py-2.5 text-sm font-medium"
          >
            Go to Import History
          </Button>
        </div>
      ) : null}

      {/* Import History Modal */}
      <ImportHistoryModal
        open={showImportHistory}
        onClose={() => setShowImportHistory(false)}
        data={importHistoryData}
      />
    </div>
  )
}

export default ImportClientsPage
