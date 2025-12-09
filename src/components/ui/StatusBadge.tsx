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
      className={`inline-flex items-center gap-1.5 rounded-full px-3 text-xs font-medium ${className || ''}`}
      style={{
        height: '33px',
        backgroundColor: isActive ? '#204E4D' : '#ADADAD', // Color/Secondary/800 for active, Color/Gray/400 for disabled
        color: '#FFFFFF',
      }}
    >
      {isActive ? (
        <span
          className="h-2 w-2 rounded-full"
          style={{
            backgroundColor: '#FFFFFF',
          }}
        />
      ) : (
        <span
          className="h-2 w-2 rounded-full border"
          style={{
            borderColor: '#DFDFDF', // Color/Gray/200
            backgroundColor: 'transparent',
          }}
        />
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
