/**
 * ProgressBar Component
 *
 * Reusable progress bar component for displaying percentage-based progress.
 * Matches Figma design with vibrant lime green fill and subtle 3D shadow effect.
 */

import { cn } from '@/lib/utils'

export interface ProgressBarProps {
  percentage: number
  className?: string
  barClassName?: string
  height?: 'sm' | 'md' | 'lg'
}

const heightClasses = {
  sm: 'h-2',
  md: 'h-3',
  lg: 'h-4',
}

export function ProgressBar({
  percentage,
  className,
  barClassName,
  height = 'md',
}: ProgressBarProps) {
  const clampedPercentage = Math.min(100, Math.max(0, percentage))

  return (
    <div
      className={cn(
        'w-full overflow-hidden rounded-full bg-white shadow-[inset_0_1px_2px_0_rgba(0,0,0,0.06),inset_0_2px_5px_0_rgba(0,0,0,0.10)]',
        heightClasses[height],
        className
      )}
    >
      <div
        className={cn(
          'h-full rounded-full transition-all duration-300',
          'shadow-[inset_0_1px_2px_0_rgba(0,0,0,0.06),inset_0_2px_5px_0_rgba(0,0,0,0.10)]',
          barClassName
        )}
        style={{ width: `${clampedPercentage}%` }}
      />
    </div>
  )
}
