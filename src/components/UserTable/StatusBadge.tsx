/**
 * StatusBadge Component
 *
 * Displays user account status with appropriate color coding.
 * - Active: Green background
 * - Disabled: Gray background
 *
 * @example
 * <StatusBadge status="Active" />
 * <StatusBadge status="Disabled" size="md" />
 */

import type { UserStatus } from '@/types/user'

interface StatusBadgeProps {
  /** User status to display */
  status: UserStatus
  /** Badge size variant */
  size?: 'sm' | 'md' | 'lg'
}

export function StatusBadge({ status, size = 'sm' }: StatusBadgeProps) {
  // Size mapping
  const sizeClasses = {
    sm: 'px-4 py-1.5 text-xs',
    md: 'px-5 py-2 text-sm',
    lg: 'px-6 py-2.5 text-base',
  }

  const sizeClass = sizeClasses[size]

  // Determine colors based on status
  const isActive = status === 'Active'
  const bgColor = isActive ? '#204E4D' : '#E5E5E5'
  const textColor = isActive ? 'white' : '#6B7280'

  return (
    <span
      className={`inline-flex items-center justify-center rounded-full font-medium ${sizeClass}`}
      style={{ backgroundColor: bgColor, color: textColor }}
      role="status"
      aria-label={`User status: ${status}`}
    >
      {status}
    </span>
  )
}

export default StatusBadge
