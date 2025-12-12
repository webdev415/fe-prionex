/**
 * StepIndicator Component
 *
 * Reusable component for displaying multi-step progress indicators
 * Matches the design specification with proper styling and spacing
 */

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
  return (
    <div className={cn('flex flex-col', className)}>
      {steps.map((step, index) => {
        const isActive = step.number === currentStep
        const isCompleted = step.number < currentStep
        const isLast = index === steps.length - 1

        return (
          <div key={step.number} className="relative flex flex-col items-start">
            {/* Step Circle and Content */}
            <div className="flex items-start gap-3">
              {/* Step Circle Container */}
              <div className="relative z-10 flex shrink-0 items-center justify-center">
                {/* Outer ring for each step */}
                <div
                  className={cn(
                    'absolute z-1 h-11 w-11 rounded-full border',
                    isActive ? 'border-primary-300' : 'border-gray-200'
                  )}
                />

                {/* Main circle - 48px as per design */}
                <div
                  className={cn(
                    'relative flex h-12 w-12 items-center justify-center rounded-full border border-white text-base',
                    isActive || isCompleted
                      ? 'bg-secondary-800 text-[#BBFB5B]'
                      : 'bg-white text-gray-500'
                  )}
                >
                  {isCompleted ? (
                    <Icons.Tick01 size={24} className="text-primary-300" />
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
                    'text-base leading-tight',
                    isActive || isCompleted ? 'text-secondary-800' : 'text-gray-500'
                  )}
                >
                  Step {step.number}
                </div>

                {/* Step Label/Description */}
                <div className="text-dark-500 text-base leading-tight">{step.label}</div>
              </div>
            </div>
            {/* Vertical connecting line */}
            {!isLast && (
              <div className="flex w-12 justify-center gap-10 align-middle">
                <div className="mx-2 flex h-20 w-0.5 flex-shrink-0 justify-center bg-gray-100 align-middle outline-3 outline-white outline-solid" />
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
