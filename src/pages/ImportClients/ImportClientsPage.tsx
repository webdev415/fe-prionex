/**
 * ImportClientsPage Component
 *
 * Main page for importing clients with multi-step form.
 * Uses reusable components following the same pattern as other pages.
 */

import { useState } from 'react'
import { StepIndicator, type Step } from '@/components/ui/StepIndicator'
import { Button } from '@/components/ui/Button'
import { Step1LoanSource, type Step1Data } from './components/Step1LoanSource'
import { Step2FileUpload, type Step2Data } from './components/Step2FileUpload'
import { Step2VendorDump, type Step2VendorDumpData } from './components/Step2VendorDump'
import { Icons } from '@/lib/icons'
import { ImportHistoryModal, type ImportHistoryData } from './components/ImportHistoryModal'
import { useNavigate } from 'react-router-dom'

export function ImportClientsPage() {
  const navigate = useNavigate()
  const [currentStep, setCurrentStep] = useState(1)
  const [isImportInProgress] = useState(false) // Add this state
  const [showImportHistory, setShowImportHistory] = useState(false)

  // Mock data for import history - in real app, this would come from API
  const [importHistoryData] = useState<ImportHistoryData | null>({
    file: 'clients_batch_2024-11-20.csv',
    uploadedBy: 'Supervisor Olena K.',
    uploadedAt: '10:03',
    status: 'failed', // Can be 'completed', 'completed_with_errors', or 'failed'
    totalRows: 10000,
    newClients: 7500,
    updatedClients: 2500,
    errors: 0,
    processingTime: '7 min 42 s',
  })

  const [step1Data, setStep1Data] = useState<Step1Data>({
    sellerCreditor: '',
    projectCode: '',
    purchaseDate: '2024-11-20',
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
    // TODO: Fetch actual import history data from API
    // For now, using mock data
    setShowImportHistory(true)
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
              />
            )}

            {currentStep === 2 && step1Data.importType === 'vendor' && (
              <Step2VendorDump
                data={step2VendorData}
                onChange={(data) => setStep2VendorData((prev) => ({ ...prev, ...data }))}
                isImportInProgress={isImportInProgress}
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
      {isImportInProgress && (
        <div className="z-50 mx-50 my-10 flex items-center justify-between gap-4 rounded-[10px] border border-[#ECEFF3] bg-white px-6 py-4 shadow-[0_12px_16px_-4px_rgba(16,24,40,0.08),0_4px_6px_-2px_rgba(16,24,40,0.03)]">
          <div className="flex items-center gap-2.5 py-1 pl-3 text-[#EAB308]">
            {/* Icon - document with refresh symbol */}
            <Icons.FileImport size={20} />
            <span className="text-sm font-medium whitespace-nowrap">Import in progress</span>
          </div>
          <span className="font-lexend text-sm leading-[150%] font-light tracking-[-0.28px] text-[#05040D]">
            File:{' '}
            <span className="font-lexend text-sm leading-[150%] font-medium tracking-[-0.28px] text-[#05040D]">
              clients_batch_2024-11-20.csv
            </span>
          </span>
          <span className="font-lexend text-sm leading-[150%] font-light tracking-[-0.28px] text-[#05040D]">
            Started:{' '}
            <span className="font-lexend text-sm leading-[150%] font-medium tracking-[-0.28px] text-[#05040D]">
              10:03
            </span>
          </span>
          <span className="font-lexend text-sm leading-[150%] font-light tracking-[-0.28px] text-[#05040D]">
            Status:{' '}
            <span className="font-lexend text-sm leading-[150%] font-medium tracking-[-0.28px] text-[#05040D]">
              45% complete
            </span>
          </span>
          <Button
            variant="primary"
            onClick={() => {
              // TODO: Implement view details functionality
              console.log('View Details clicked')
            }}
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
      )}

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
