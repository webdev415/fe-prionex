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
import { colors } from '@/lib/colors'
import { Icons } from '@/lib/icons'

const STEPS: Step[] = [
  {
    number: 1,
    label: 'Loan source & import type',
  },
  {
    number: 2,
    label: 'Files (Simple CSV)',
  },
]

export function ImportClientsPage() {
  const [currentStep, setCurrentStep] = useState(1)
  const [step1Data, setStep1Data] = useState<Step1Data>({
    sellerCreditor: '',
    projectCode: '',
    purchaseDate: '2024-11-20',
    comment: '',
    importType: 'simple',
  })

  const handleStep1Change = (data: Partial<Step1Data>) => {
    setStep1Data((prev) => ({ ...prev, ...data }))
  }

  const handleNextStep = () => {
    if (currentStep < STEPS.length) {
      setCurrentStep(currentStep + 1)
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

  return (
    <div>
      {/* Page Header */}
      <div className="mb-8 flex items-center justify-between">
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
          className="w-64 shrink-0 rounded-xl bg-white shadow-sm px-6 py-11 gap-0"
          style={{
            backgroundColor: '#FFFFFF80',
            width: '24%',
            display: 'flex',
          }}
        >
          <StepIndicator steps={STEPS} currentStep={currentStep} />
        </div>

        {/* Right Panel - Form Content */}
        <div 
            className="flex-1 flex-col gap-3"
        >
          <div
            className="rounded-xl p-6 shadow-sm "
            style={{
              backgroundColor: '#FFFFFF80',
            }}
          >
            {currentStep === 1 && <Step1LoanSource data={step1Data} onChange={handleStep1Change} />}

            {currentStep === 2 && (
              <div>
                <p>Step 2: File upload will go here</p>
              </div>
            )}

            {/* Navigation Buttons */}
            <div className="mt-8 flex justify-center">
              {currentStep < STEPS.length ? (
                <Button
                  variant="primary"
                  onClick={handleNextStep}
                  disabled={!isStep1Valid()}
                  style={{
                    backgroundColor: colors.secondary[800], // #204E4D
                    color: '#FFFFFF',
                    borderRadius: '9999px', // Pill shape
                    padding: '4px 4px 4px 24px',
                    height: '48px',
                    display: 'flex',
                    alignItems: 'center',
                    fontSize: '14px',
                    gap: '10px',
                  }}
                >
                  <span>Next Step</span>
                  {/* Circular icon with arrow - matching SVG design */}
                  <div
                    style={{
                      width: '40px',
                      height: '40px',
                      borderRadius: '50%',
                      backgroundColor: colors.primary[300], // #BBFB5B
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}
                  >
                    <Icons.ArrowRight02 size={24} color={colors.neutral.dark[500]} />
                  </div>
                </Button>
              ) : (
                <Button
                  variant="primary"
                  onClick={() => {
                    // Handle final submission
                    console.log('Submit import:', step1Data)
                  }}
                  style={{
                    backgroundColor: colors.secondary[800],
                    color: '#FFFFFF',
                    borderRadius: '24px',
                    height: '48px',
                  }}
                >
                  Import
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default ImportClientsPage
