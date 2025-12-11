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
import { colors } from '@/lib/colors'
import { Icons } from '@/lib/icons'
import { ImportHistoryModal, type ImportHistoryData } from './components/ImportHistoryModal'

export function ImportClientsPage() {
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
    // TODO: Implement view history functionality
    console.log('View History clicked')
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
              leftIcon={<Icons.ArrowLeft02 size={20} color={colors.secondary[800]} />}
              className="flex flex-row items-center justify-center"
              style={{
                padding: '10px 16px',
                borderRadius: '9999px',
                borderColor: '#FFFFFF',
                backgroundColor: '#FFFFFF',
                color: colors.secondary[800],
                fontSize: '14px',
                fontWeight: 500,
                lineHeight: '150%',
                height: '48px',
              }}
            >
              Back
            </Button>
          )}
          <h1
            className="font-light"
            style={{
              fontSize: '24px',
              fontWeight: 300,
              color: colors.neutral.dark[500],
            }}
          >
            Import Clients
          </h1>
        </div>

        <Button
          variant="primary"
          onClick={handleViewHistory}
          leftIcon={<Icons.TransactionHistory size={20} color={colors.neutral.dark[500]} />}
          style={{
            display: 'flex',
            flexDirection: 'row',
            backgroundColor: colors.primary[300], // #BBFB5B
            color: colors.neutral.dark[500], // #05040D
            borderRadius: '9999px', // Pill shape
            height: '48px',
            padding: '10px 16px',
            fontSize: '12px',
            justifyContent: 'center',
            alignItems: 'center',
            textAlign: 'center',
          }}
        >
          View History
        </Button>
      </div>

      {/* Main Content */}
      <div className="flex gap-5">
        {/* Left Panel - Step Indicator */}
        <div
          className="w-64 shrink-0 gap-0 rounded-xl bg-white px-6 py-11 shadow-sm"
          style={{
            backgroundColor: '#FFFFFF80',
            width: '24%',
            display: 'flex',
          }}
        >
          <StepIndicator steps={STEPS} currentStep={currentStep} />
        </div>

        {/* Right Panel - Form Content */}
        <div className="flex-1 flex-col gap-3">
          <div
            className="rounded-xl p-6 shadow-sm"
            style={{
              backgroundColor: '#FFFFFF80',
            }}
          >
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
                  style={{
                    backgroundColor: colors.secondary[800],
                    color: '#FFFFFF',
                    borderRadius: '9999px',
                    padding: '4px 4px 4px 24px',
                    height: '48px',
                    display: 'flex',
                    alignItems: 'center',
                    fontSize: '14px',
                    gap: '10px',
                  }}
                >
                  <span>Next Step</span>
                  <div
                    style={{
                      width: '40px',
                      height: '40px',
                      borderRadius: '50%',
                      backgroundColor: colors.primary[300],
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}
                  >
                    <Icons.ArrowRight02 size={24} color={colors.neutral.dark[500]} />
                  </div>
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Import Progress Banner */}
      {isImportInProgress && (
        <div
          className="z-50 mx-50 my-10 flex items-center justify-between px-6 py-4"
          style={{
            backgroundColor: '#FFFFFF',
            borderRadius: '10px',
            border: '1px solid #ECEFF3',
            boxShadow:
              '0 12px 16px -4px rgba(16, 24, 40, 0.08), 0 4px 6px -2px rgba(16, 24, 40, 0.03)',
            gap: '16px',
          }}
        >
          <div
            className="flex items-center"
            style={{
              gap: '10px',
              padding: '4px 0 4px 12px',
              color: '#EAB308',
            }}
          >
            {/* Icon - document with refresh symbol */}
            <Icons.FileImport size={20} />
            <span
              style={{
                fontSize: '14px',
                fontWeight: 500,
                whiteSpace: 'nowrap',
              }}
            >
              Import in progress
            </span>
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
            style={{
              backgroundColor: colors.secondary[800],
              color: '#FFFFFF',
              gap: '10px',
              borderRadius: '8px',
              padding: '10px 16px',
              fontSize: '14px',
              fontWeight: 500,
              height: '40px',
            }}
          >
            View Details
          </Button>
          <Button
            variant="outline"
            onClick={handleGoToImportHistory}
            style={{
              borderColor: colors.secondary[800],
              backgroundColor: '#FFFFFF',
              color: colors.secondary[800],
              borderRadius: '8px',
              gap: '10px',
              padding: '10px 16px',
              fontSize: '14px',
              fontWeight: 500,
            }}
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
