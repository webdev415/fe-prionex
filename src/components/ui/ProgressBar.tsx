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
  showBackground?: boolean // If false, only shows the active portion without background track
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
  showBackground = true,
}: ProgressBarProps) {
  const clampedPercentage = Math.min(100, Math.max(0, percentage))

  // If showBackground is false, only render the active bar without background
  if (!showBackground) {
    return (
      <div
        className={cn(
          'overflow-hidden rounded-full transition-all duration-300',
          'shadow-[inset_0_1px_2px_0_rgba(0,0,0,0.06),inset_0_2px_5px_0_rgba(0,0,0,0.10)]',
          heightClasses[height],
          barClassName || 'bg-primary-400',
          className
        )}
        style={{ width: `${clampedPercentage}%` }}
      />
    )
  }

  // Default behavior: show both background track and active portion
  return (
    <div
      className={cn(
        'bg-muted w-full overflow-hidden rounded-full shadow-[inset_0_1px_2px_0_rgba(0,0,0,0.06),inset_0_2px_5px_0_rgba(0,0,0,0.10)]',
        heightClasses[height],
        className
      )}
    >
      <div
        className={cn(
          'h-full rounded-full transition-all duration-300',
          'shadow-[inset_0_1px_2px_0_rgba(0,0,0,0.06),inset_0_2px_5px_0_rgba(0,0,0,0.10)]',
          barClassName || 'bg-primary-400'
        )}
        style={{ width: `${clampedPercentage}%` }}
      />
    </div>
  )
}
