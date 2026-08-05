/**
 * StatusBadge Component
 *
 * Reusable status badge component with pill shape and circle icon.
 * Matches the design specification for Active/Disabled statuses.
 */

import { useTranslation } from 'react-i18next'

export type StatusType = 'active' | 'disabled' | 'inactive' | 'suspended' | 'pending' | 'archived'

interface StatusBadgeProps {
  status: StatusType
  className?: string
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const { t } = useTranslation('common')
  const isActive = status === 'active'
  const label = t(isActive ? 'statusLabels.active' : `statusLabels.${status}`, {
    defaultValue: status,
  })

  return (
    <span
      className={`inline-flex h-[33px] items-center gap-1.5 rounded-full px-3 text-xs font-medium ${
        isActive ? 'bg-secondary-800 text-secondary-foreground' : 'bg-muted text-muted-foreground'
      } ${className || ''}`}
    >
      {isActive ? (
        <span className="bg-secondary-foreground h-2 w-2 rounded-full" />
      ) : (
        <span className="border-border h-2 w-2 rounded-full border bg-transparent" />
      )}
      {label}
    </span>
  )
}

export default StatusBadge
