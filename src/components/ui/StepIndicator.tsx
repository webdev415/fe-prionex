/**
 * StepIndicator Component
 *
 * Reusable component for displaying multi-step progress indicators
 * Matches the design specification with proper styling and spacing
 */

import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'
import { Icons } from '@/lib/icons'

export interface Step {
  number: number
  label: string
  description?: string
}

export interface StepIndicatorProps {
  steps: Step[]
  currentStep: number
  className?: string
}

export function StepIndicator({ steps, currentStep, className }: StepIndicatorProps) {
  const { t } = useTranslation('common')

  return (
    <div className={cn('flex flex-col', className)}>
      {steps.map((step, index) => {
        const isActive = step.number === currentStep
        const isCompleted = step.number < currentStep
        const isLast = index === steps.length - 1

        return (
          <div key={step.number} className="relative flex flex-col items-start">
            {/* Step Circle and Content */}
            <div className="mb-14 flex items-start gap-2 sm:gap-3">
              {/* Step Circle Container */}
              <div className="relative z-10 flex shrink-0 items-center justify-center">
                {/* Outer ring for each step */}
                <div
                  className={cn(
                    'absolute z-1 h-9 w-9 rounded-full border sm:h-11 sm:w-11',
                    isActive ? 'border-primary-300' : 'border-gray-200'
                  )}
                />

                {/* Main circle - responsive size */}
                <div
                  className={cn(
                    'relative flex h-10 w-10 items-center justify-center rounded-full border border-white text-sm sm:h-12 sm:w-12 sm:text-base',
                    isActive || isCompleted
                      ? 'bg-secondary-800 text-[#BBFB5B]'
                      : 'bg-white text-gray-500'
                  )}
                >
                  {isCompleted ? (
                    <Icons.Tick01 size={20} className="text-primary-300 sm:size-6" />
                  ) : (
                    step.number
                  )}
                </div>
              </div>

              {/* Step Content */}
              <div className="flex flex-col gap-0 pt-0.5">
                {/* Step X text */}
                <div
                  className={cn(
                    'text-sm leading-tight sm:text-base',
                    isActive || isCompleted ? 'text-secondary-800' : 'text-gray-500'
                  )}
                >
                  {t('common.step')} {step.number}
                </div>

                {/* Step Label/Description */}
                <div className="text-dark-500 text-sm leading-tight sm:text-base">{step.label}</div>
              </div>
            </div>
            {/* Vertical connecting line */}
            {!isLast && (
              <div className="absolute flex w-10 justify-center gap-10 align-middle sm:w-12">
                <div className="mx-2 flex h-25 w-0.5 flex-shrink-0 justify-center bg-gray-100 align-middle outline-3 outline-white outline-solid sm:h-35" />
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
