/**
 * StatusBadge Component
 *
 * Reusable status badge component with pill shape and circle icon.
 * Matches the design specification for Active/Disabled statuses.
 */

export type StatusType = 'active' | 'disabled' | 'inactive' | 'suspended' | 'pending' | 'archived'

interface StatusBadgeProps {
  status: StatusType
  className?: string
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const isActive = status === 'active'

  return (
    <span
      className={`inline-flex h-[33px] items-center gap-1.5 rounded-full px-3 text-xs font-medium text-white ${isActive ? 'bg-[#204E4D]' : 'bg-[#ADADAD]'} ${className || ''}`}
    >
      {isActive ? (
        <span className="h-2 w-2 rounded-full bg-white" />
      ) : (
        <span className="h-2 w-2 rounded-full border border-[#DFDFDF] bg-transparent" />
      )}
      {isActive
        ? 'Active'
        : status === 'inactive'
          ? 'Inactive'
          : status === 'suspended'
            ? 'Suspended'
            : status === 'pending'
              ? 'Pending'
              : status === 'archived'
                ? 'Archived'
                : 'Disabled'}
    </span>
  )
}

export default StatusBadge
