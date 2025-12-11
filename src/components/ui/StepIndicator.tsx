/**
 * StepIndicator Component
 *
 * Reusable component for displaying multi-step progress indicators
 * Matches the design specification with proper styling and spacing
 */

import { colors } from '@/lib/colors'
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
                  className="absolute z-1 h-11 w-11 rounded-full border-1"
                  style={{
                    borderColor: isActive
                      ? colors.primary[300]
                      : isCompleted
                        ? colors.gray[200]
                        : colors.gray[200],
                  }}
                />

                {/* Main circle - 48px as per design */}
                <div
                  className={cn(
                    'font-size-16 relative flex h-12 w-12 items-center justify-center rounded-full border-1'
                  )}
                  style={{
                    backgroundColor:
                      isActive || isCompleted
                        ? colors.secondary[800] // Dark green background (#204E4D)
                        : '#FFFFFF', // White background for inactive
                    borderColor: '#FFFFFF',
                    color:
                      isActive || isCompleted
                        ? '#BBFB5B' // White text for number in active/completed
                        : colors.gray[500], // Gray text (#A1A1A1) for inactive
                  }}
                >
                  {isCompleted ? (
                    <Icons.Tick01 size={24} color={colors.primary[300]} />
                  ) : (
                    step.number
                  )}
                </div>
              </div>

              {/* Step Content */}
              <div className="flex flex-col gap-0 pt-0.5">
                {/* Step X text */}
                <div
                  className="font-size-16 leading-tight"
                  style={{
                    color:
                      isActive || isCompleted
                        ? colors.secondary[800] // Dark green (#204E4D) for active/completed
                        : colors.gray[500], // Gray (#A1A1A1) for inactive
                  }}
                >
                  Step {step.number}
                </div>

                {/* Step Label/Description */}
                <div
                  className="font-size-16 leading-tight"
                  style={{
                    color: colors.neutral.dark[500], // Dark text (#05040D) for all descriptions
                  }}
                >
                  {step.label}
                </div>
              </div>
            </div>
            {/* Vertical connecting line */}
            {!isLast && (
              <div
                className="flex justify-center gap-10 align-middle"
                style={{
                  width: '48px',
                }}
              >
                <div
                  className="mx-2 flex flex-shrink-0 justify-center align-middle outline-3 outline-white outline-solid"
                  style={{
                    width: '2px',
                    height: '80px', // Height from SVG (80px)
                    backgroundColor: colors.gray[100],
                  }}
                />
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
