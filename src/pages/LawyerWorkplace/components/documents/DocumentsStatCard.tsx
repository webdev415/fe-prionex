import { cn } from '@/lib/utils'

interface DocumentsStatCardProps {
  icon: React.ReactNode
  iconClassName: string
  label: string
  value: string
  compact: boolean
}

export function DocumentsStatCard({
  icon,
  iconClassName,
  label,
  value,
  compact,
}: DocumentsStatCardProps) {
  return (
    <div className="border-card bg-card flex min-w-0 flex-1 items-center gap-3 rounded-xl border px-3 py-3 shadow-sm sm:px-4">
      <div
        className={cn(
          'flex shrink-0 items-center justify-center rounded-lg',
          compact ? 'h-9 w-9' : 'h-10 w-10',
          iconClassName
        )}
      >
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-light-600 truncate text-[10px] font-medium tracking-wide uppercase sm:text-[11px]">
          {label}
        </p>
        <p
          className={cn(
            'text-dark-500 truncate leading-tight font-light',
            compact ? 'text-base' : 'text-[18px]'
          )}
        >
          {value}
        </p>
      </div>
    </div>
  )
}
